const blockedPatterns = [
  /操你/i,
  /傻逼/i,
  /去死/i,
  /裸聊/i,
  /色情交易/i,
  /制作炸弹/i,
  /购买毒品/i,
];

export function normalizeUserText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function isSafeUserText(value: string) {
  const normalized = normalizeUserText(value);
  return normalized.length > 0 && !blockedPatterns.some((pattern) => pattern.test(normalized));
}

export function validateUserText(value: string, maxLength: number) {
  const normalized = normalizeUserText(value);
  if (!normalized || normalized.length > maxLength) return { ok: false as const, error: `内容需要控制在 1–${maxLength} 字` };
  if (!isSafeUserText(normalized)) return { ok: false as const, error: "这段内容暂时不能生成声音，请换一种说法" };
  return { ok: true as const, value: normalized };
}
