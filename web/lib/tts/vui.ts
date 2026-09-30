function weightedLength(text: string) {
  return Array.from(text).reduce((sum, char) => sum + (/\p{Script=Han}/u.test(char) ? 2 : 1), 0);
}

export async function generateVuiAudio(input: { text: string; voiceId: string; key: string; baseUrl?: string; signal?: AbortSignal }, transport: typeof fetch = fetch) {
  if (!input.text.trim() || weightedLength(input.text) > 500 || /[\[\]]/.test(input.text)) throw new Error("语音文本需要在 500 个加权字符以内，且不包含表演标签。");
  if (!input.key.trim()) throw new Error("请先配置 VUILABS_API_KEY。");
  const response = await transport(`${(input.baseUrl || "https://api.vuilabs.cn").replace(/\/$/, "")}/v1/text-to-speech`, {
    method: "POST", headers: { "X-API-Key": input.key, "Content-Type": "application/json" },
    body: JSON.stringify({ generate_text: input.text, voice_id: input.voiceId, language: "zh", model_id: "luna-tts", text_normalization: true, speed: 1, audio_format: "wav" }),
    signal: AbortSignal.any([AbortSignal.timeout(45000), ...(input.signal ? [input.signal] : [])]), cache: "no-store",
  });
  if (!response.ok) {
    const errors: Record<number, string> = {
      400: "VUI 请求参数无效，请检查音色 ID 是否属于当前项目、语言是否已启用。",
      401: "VUI API Key 无效或已失效，请检查 VUILABS_API_KEY。",
      402: "VUI 账户余额不足，请充值后重试。",
      403: "当前 VUI 项目尚未启用语音合成功能。",
      429: "语音请求较多，请稍后重试。",
      504: "VUI 语音生成超时，请重试。",
    };
    throw new Error(errors[response.status] || `语音服务暂不可用（${response.status}），可以保留文字稍后重试。`);
  }
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "audio/wav") throw new Error("语音服务未返回 WAV 格式。");
  const bytes = await response.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 12));
  if (bytes.byteLength < 44 || head.length < 12 || String.fromCharCode(...head.slice(0, 4)) !== "RIFF" || String.fromCharCode(...head.slice(8, 12)) !== "WAVE") throw new Error("语音服务未返回有效 WAV 音频。");
  return bytes;
}
