export const GEM_TYPES = ['topaz', 'emerald', 'sapphire', 'ruby', 'amethyst'] as const;
export type GemType = (typeof GEM_TYPES)[number];

export interface GemBalance {
    topaz: number;
    emerald: number;
    sapphire: number;
    ruby: number;
    amethyst: number;
}

export const GEM_POINTS: Record<GemType, number> = {
    topaz:    1,
    emerald:  5,
    sapphire: 10,
    ruby:     20,
    amethyst: 25,
};

export function totalPoints(b: GemBalance): number {
    return GEM_TYPES.reduce((sum, g) => sum + b[g] * GEM_POINTS[g], 0);
}

export function canAfford(balance: GemBalance, cost: Partial<GemBalance>): boolean {
    return GEM_TYPES.every((g) => (balance[g] ?? 0) >= (cost[g] ?? 0));
}
