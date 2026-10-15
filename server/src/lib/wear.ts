// 미니미 옷 — 앱의 src/lib/avatar.ts 와 같은 목록·가격 (토파즈). 0 = 처음부터 있음
export const WEAR_SLOTS = {
    top: { tshirt: 0, hoodie: 5, dress: 6 },
    bottom: { pants: 0, skirt: 4 },
    shoes: { basic: 0, sneakers: 3, boots: 5 },
    glasses: { none: 0, glasses: 3, sunglasses: 4 },
    hat: { none: 0, cap: 4, beanie: 4 },
} as const;

export type WearSlot = keyof typeof WEAR_SLOTS;

// 살 수 있는 옷 → 가격
export const WEAR_PRICES: Record<string, number> = Object.fromEntries(
    Object.values(WEAR_SLOTS).flatMap(slot => Object.entries(slot)).filter(([, p]) => p > 0),
);

export const DEFAULT_OUTFIT = {
    body: 'female', skin: '#F1C09A', hair: '#3B2A22',
    top: 'tshirt', topColor: '#3FA37E', bottom: 'pants', bottomColor: '#3C4F78',
    shoes: 'basic', glasses: 'none', hat: 'none',
};
