export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n));
}
