export function roomErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "房间操作失败，请稍后重试";
  if (/fetch|network|load failed|timeout|timed out|aborted/i.test(message)) return "多人服务暂时连接不上，请重试，或先体验单人模式。";
  return message;
}
