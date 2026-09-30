import { fetch as serverFetch, ProxyAgent } from "undici";
import type { TTSGeneratedAudio, TTSGenerateInput, TTSProvider } from "@/lib/tts/provider";

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function requestFishAudio(input: TTSGenerateInput, attempt = 0): Promise<TTSGeneratedAudio> {
  input.signal?.throwIfAborted();
  const apiKey = process.env.FISH_API_KEY;
  if (!apiKey) throw new Error("FISH_API_KEY is not configured");

  let response;
  try {
    response = await serverFetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: process.env.FISH_TTS_MODEL ?? "s2.1-pro-free",
      },
      body: JSON.stringify({
        text: input.text,
        reference_id: input.voiceReferenceId,
        format: "mp3",
        mp3_bitrate: input.mp3Bitrate ?? 128,
        latency: input.latency ?? "balanced",
        normalize: true,
        prosody: { speed: 1, volume: 0, normalize_loudness: true },
        temperature: 0.35,
        top_p: 0.6,
        condition_on_previous_chunks: true,
      }),
      dispatcher,
      signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(input.signal ? [input.signal] : [])]),
    });
  } catch (error) {
    if (attempt < 2 && !input.signal?.aborted) {
      await wait(350 * (attempt + 1));
      return requestFishAudio(input, attempt + 1);
    }
    throw error;
  }

  if (!response.ok || !response.body) {
    if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
      await response.body?.cancel();
      await wait(350 * (attempt + 1));
      return requestFishAudio(input, attempt + 1);
    }
    throw new Error(`Fish Audio request failed with status ${response.status}`);
  }

  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
    provider: "fish-audio",
  };
}

export const fishAudioProvider: TTSProvider = {
  id: "fish-audio",
  generate: requestFishAudio,
};
