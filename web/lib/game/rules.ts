export const MAX_WORK_DURATION = 15;
export const MIN_WORK_DURATION = 10;

export function classicBlockMaxLength(playerCount: number) {
  if (playerCount === 2) return 15;
  if (playerCount === 5) return 12;
  return 13;
}

export function shouldContinueClassicRound(playerCount: number, currentRound: number, totalDuration: number) {
  const minimumRounds = playerCount === 2 ? 2 : 1;
  return currentRound < minimumRounds || totalDuration < MIN_WORK_DURATION;
}

export function canFitDuration(currentDuration: number, nextDuration: number) {
  return nextDuration > 0 && currentDuration + nextDuration <= MAX_WORK_DURATION;
}

export function getTurnTimeHint(seconds: number) {
  if (seconds >= 60) return "已等待 60 秒，房主可以跳过";
  if (seconds >= 45) return "请尽快提交这一块";
  if (seconds >= 30) return "慢慢想，故事还在等你";
  return "";
}
