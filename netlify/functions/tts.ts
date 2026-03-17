import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const VOICE_MAP = {
  neutral: process.env.ELEVENLABS_NEUTRAL_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM",
  narrative:
    process.env.ELEVENLABS_NARRATIVE_VOICE_ID ?? "AZnzlk1XvdvUeBnXmlld",
};

function cacheKey(text: string, voice: string): string {
  return crypto
    .createHash("sha256")
    .update(`${voice}:${text}`)
    .digest("hex");
}

export const handler: Handler = async event => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY is not set");
    return { statusCode: 500, body: "TTS provider not configured" };
  }

  let text: string, voice: string;
  try {
    ({ text, voice } = JSON.parse(event.body ?? "{}"));
  } catch {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  if (!text || !voice) {
    return { statusCode: 400, body: "Missing required fields: text, voice" };
  }

  if (!["neutral", "narrative"].includes(voice)) {
    return {
      statusCode: 400,
      body: "Invalid voice. Must be neutral or narrative",
    };
  }

  let store: ReturnType<typeof getStore> | null = null;
  try {
    store = getStore("tts-cache");
  } catch {
    // Blobs not available in this environment — skip caching
  }

  const key = cacheKey(text, voice);

  // Check cache first
  if (store) {
    const cached = await store.get(key, { type: "arrayBuffer" });
    if (cached) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "audio/mpeg", "X-Cache": "HIT" },
        body: Buffer.from(cached).toString("base64"),
        isBase64Encoded: true,
      };
    }
  }

  // Generate via ElevenLabs
  const voiceId = VOICE_MAP[voice as keyof typeof VOICE_MAP];
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
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
          speed: 1.25,
        },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`ElevenLabs error ${res.status}:`, errBody);
    return { statusCode: res.status, body: `ElevenLabs error: ${errBody}` };
  }

  const audioBuffer = await res.arrayBuffer();

  // Store in cache (fire and forget — don't block the response)
  if (store) {
    store.set(key, audioBuffer).catch((err: unknown) => {
      console.error("Failed to cache audio:", err);
    });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "audio/mpeg", "X-Cache": "MISS" },
    body: Buffer.from(audioBuffer).toString("base64"),
    isBase64Encoded: true,
  };
};
