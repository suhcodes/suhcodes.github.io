import { getStore } from "@netlify/blobs";
import crypto from "crypto";
import type { Config, Context } from "@netlify/functions";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const VOICE_MAP = {
  neutral: process.env.ELEVENLABS_NEUTRAL_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB",
  narrative: process.env.ELEVENLABS_NARRATIVE_VOICE_ID ?? "VR6AewLTigWG4xSOukaG",
};

function cacheKey(text: string, voice: string): string {
  return crypto.createHash("sha256").update(`${voice}:${text}`).digest("hex");
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!ELEVENLABS_API_KEY) {
    return new Response("TTS provider not configured", { status: 500 });
  }

  let text: string, voice: string;
  try {
    ({ text, voice } = await req.json());
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!text || !voice) {
    return new Response("Missing required fields: text, voice", { status: 400 });
  }

  if (!["neutral", "narrative"].includes(voice)) {
    return new Response("Invalid voice. Must be neutral or narrative", { status: 400 });
  }

  const store = getStore("tts-cache");
  const key = cacheKey(text, voice);

  // Check cache first
  try {
    const cached = await store.get(key, { type: "arrayBuffer" });
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg", "X-Cache": "HIT" },
      });
    }
  } catch (err) {
    console.error("Blobs read error:", err);
  }

  // Generate via ElevenLabs
  const voiceId = VOICE_MAP[voice as keyof typeof VOICE_MAP];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2",
      voice_settings: {
        stability: voice === "narrative" ? 0.35 : 0.55,
        similarity_boost: 0.75,
        style: voice === "narrative" ? 0.4 : 0.0,
        speed: 1.0,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`ElevenLabs error ${res.status}:`, errBody);
    return new Response(`ElevenLabs error: ${errBody}`, { status: res.status });
  }

  const audioBuffer = await res.arrayBuffer();

  // Store in cache (fire and forget)
  context.waitUntil(
    store.set(key, audioBuffer).catch((err: unknown) => {
      console.error("Failed to cache audio:", err);
    })
  );

  return new Response(audioBuffer, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "X-Cache": "MISS" },
  });
}

export const config: Config = {
  path: "/.netlify/functions/tts",
};
