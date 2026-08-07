/** @deprecated Import from @/lib/playModel instead */
export { IDS } from "@/lib/playModel";

export function clampBeatIndex(frames, idx) {
  const max = Math.max(0, (frames?.length ?? 1) - 1);
  return Math.max(0, Math.min(idx ?? 0, max));
}

export function clampBeatRange(frames, fromIdx, toIdx) {
  const from = clampBeatIndex(frames, fromIdx);
  const to = clampBeatIndex(frames, toIdx ?? from);
  return { from, to: Math.max(from, to) };
}
