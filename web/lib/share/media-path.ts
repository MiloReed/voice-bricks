export function shareMediaPath(workId: string, kind: "image" | "video") {
  return `${workId}/share.${kind === "video" ? "mp4" : "png"}`;
}

export function isExpectedMediaUrl(candidate: unknown, expected: string) {
  return typeof candidate === "string" && candidate === expected;
}
