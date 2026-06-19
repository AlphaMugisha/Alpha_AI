/**
 * Level curve for the gamification system.
 *
 * Calibrated to the spec's anchor points (L1:0, L2:100, L3:250, L4:500,
 * L5:800, L10:5000) with strictly increasing per-level spans, then a smooth
 * geometric growth beyond level 10.
 */

// Per-level spans for L1→2 … L9→10 (sum = 5000, so cumulative L10 = 5000).
const BASE_SPANS = [100, 150, 250, 300, 450, 600, 800, 1050, 1300];
const MAX_LEVEL = 60;

const THRESHOLDS: number[] = (() => {
  const cum = [0, 0]; // index 0 unused, level 1 = 0 XP
  let prevSpan = BASE_SPANS[BASE_SPANS.length - 1];
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const idx = level - 2;
    const span = idx < BASE_SPANS.length ? BASE_SPANS[idx] : Math.round(prevSpan * 1.22);
    prevSpan = span;
    cum[level] = cum[level - 1] + span;
  }
  return cum;
})();

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 1; l < THRESHOLDS.length; l++) {
    if (xp >= THRESHOLDS[l]) level = l;
    else break;
  }
  return level;
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= THRESHOLDS.length) return THRESHOLDS[THRESHOLDS.length - 1];
  return THRESHOLDS[level];
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number; // span of the current level
  xpToNext: number; // remaining to reach next level
  pct: number; // 0-100
  isMax: boolean;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const floor = xpForLevel(level);
  const isMax = level >= MAX_LEVEL;
  const ceil = isMax ? floor : xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = totalXp - floor;
  return {
    level,
    totalXp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    xpToNext: isMax ? 0 : Math.max(0, ceil - totalXp),
    pct: isMax ? 100 : Math.min(100, Math.round((into / span) * 100)),
    isMax,
  };
}
