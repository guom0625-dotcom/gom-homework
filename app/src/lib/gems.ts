import type { GemColor } from '../theme';

export type GemKey = GemColor;

export const GEM_VALUES: Record<GemKey, { pt: number; name: string; tier: string; tone: string }> = {
  topaz:    { pt: 1,  name: '토파즈',   tier: 'C',  tone: '#ffc83a' },
  sapphire: { pt: 3,  name: '사파이어', tier: 'B',  tone: '#3a96ff' },
  emerald:  { pt: 5,  name: '에메랄드', tier: 'A',  tone: '#2dd4a4' },
  ruby:     { pt: 10, name: '루비',     tier: 'S',  tone: '#ff5a7a' },
  amethyst: { pt: 25, name: '자수정',   tier: 'S+', tone: '#b076ff' },
};

export type GemInventory = Record<GemKey, number>;

export const EMPTY_INVENTORY: GemInventory = {
  amethyst: 0,
  ruby:     0,
  emerald:  0,
  sapphire: 0,
  topaz:    0,
};

/** 인벤토리 → 총 포인트 */
export function gemsToPoints(inv: GemInventory): number {
  return (Object.entries(inv) as [GemKey, number][]).reduce(
    (sum, [key, count]) => sum + GEM_VALUES[key].pt * count,
    0,
  );
}

/** 보상 비용 → 총 포인트 */
export function costToPoints(cost: Partial<GemInventory>): number {
  return (Object.entries(cost) as [GemKey, number][]).reduce(
    (sum, [key, count]) => sum + GEM_VALUES[key].pt * count,
    0,
  );
}

/** 보상 구매 가능 여부 */
export function canAfford(inv: GemInventory, cost: Partial<GemInventory>): boolean {
  return (Object.entries(cost) as [GemKey, number][]).every(
    ([key, count]) => (inv[key] ?? 0) >= count,
  );
}

/** 인벤토리에서 비용 차감 (불변) */
export function subtractCost(inv: GemInventory, cost: Partial<GemInventory>): GemInventory {
  const result = { ...inv };
  (Object.entries(cost) as [GemKey, number][]).forEach(([key, count]) => {
    result[key] = (result[key] ?? 0) - count;
  });
  return result;
}
