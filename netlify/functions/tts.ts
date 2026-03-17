import type { Handler } from "@netlify/functions";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Replace these with your chosen ElevenLabs voice IDs
// Find them at: https://elevenlabs.io/voice-library
const VOICE_MAP = {
  neutral: process.env.ELEVENLABS_NEUTRAL_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM", // Rachel — calm, clear
  narrative: process.env.ELEVENLABS_NARRATIVE_VOICE_ID ?? "AZnzlk1XvdvUeBnXmlld", // Domi — expressive
};

export const handler: Handler = async event => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
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
    return { statusCode: 400, body: "Invalid voice. Must be neutral or narrative" };
  }

  // Primary: ElevenLabs
  if (ELEVENLABS_API_KEY) {
    try {
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
            },
          }),
        }
      );

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer();
        return {
          statusCode: 200,
          headers: { "Content-Type": "audio/mpeg" },
          body: Buffer.from(audioBuffer).toString("base64"),
          isBase64Encoded: true,
        };
      }
    } catch {
      // fall through to OpenAI
    }
  }

  // Fallback: OpenAI TTS
  if (!OPENAI_API_KEY) {
    return { statusCode: 500, body: "No TTS provider configured" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: voice === "narrative" ? "fable" : "alloy",
      }),
    });

    if (!res.ok) {
      return { statusCode: 500, body: "TTS generation failed" };
    }

    const audioBuffer = await res.arrayBuffer();
    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
      body: Buffer.from(audioBuffer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 500, body: "TTS generation failed" };
  }
};
