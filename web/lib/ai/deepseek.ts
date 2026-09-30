type Message = { role: "system" | "user" | "assistant"; content: string };

export type DeepSeekOptions = { key: string; model?: string };

export async function completeDeepSeek(options: DeepSeekOptions, messages: Message[], json = false, transport: typeof fetch = fetch) {
  if (!options.key.trim()) throw new Error("未配置 DEEPSEEK_API_KEY，机器人暂时无法接龙");
  const response = await transport("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${options.key.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model || "deepseek-flash", messages, stream: false,
      thinking: { type: "disabled" }, max_tokens: 200,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("DeepSeek 密钥无效，请检查服务端配置");
    if (response.status === 402) throw new Error("DeepSeek 余额不足，请充值后重试");
    if (response.status === 429) throw new Error("DeepSeek 请求较多，请稍后重试");
    throw new Error("DeepSeek 暂时无法回应，请重试");
  }
  const payload = await response.json() as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] };
  const choice = payload.choices?.[0];
  if (typeof choice?.message?.content !== "string" || choice.finish_reason !== "stop" || !choice.message.content.trim()) {
    throw new Error("DeepSeek 没有返回完整句子，请重试");
  }
  return choice.message.content.trim();
}
