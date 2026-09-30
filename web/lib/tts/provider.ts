export interface TTSGenerateInput {
  text: string;
  signal?: AbortSignal;
  voiceReferenceId: string;
  latency?: "low" | "normal" | "balanced";
  mp3Bitrate?: 64 | 128 | 192;
}

export interface TTSGeneratedAudio {
  bytes: ArrayBuffer;
  contentType: string;
  provider: string;
}

export interface TTSProvider {
  readonly id: string;
  generate(input: TTSGenerateInput): Promise<TTSGeneratedAudio>;
}
