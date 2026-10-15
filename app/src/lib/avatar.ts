// 미니미 캐릭터 — 디자인 캔버스의 캐릭터를 상자(복셀)로 다시 만든 것.
// 옷·색에 따라 상자 목록을 만들고, 방향(rot)과 카메라에 맞춰 보이는 세 면(위·왼쪽·오른쪽)을 그린다.
// 길이 단위 V: 상자 한 칸. 모델 단위로는 V * VOXEL (머리 7칸 ≈ 0.28).

export const VOXEL = 0.04;

export type Body = 'female' | 'male';
export type Top = 'tshirt' | 'hoodie' | 'dress';
export type Bottom = 'pants' | 'skirt';
export type Shoes = 'basic' | 'sneakers' | 'boots';
export type Glasses = 'none' | 'glasses' | 'sunglasses';
export type Hat = 'none' | 'cap' | 'beanie';

export interface Outfit {
    body: Body;
    skin: string;
    hair: string;
    top: Top;
    topColor: string;
    bottom: Bottom;
    bottomColor: string;
    shoes: Shoes;
    glasses: Glasses;
    hat: Hat;
}

export const DEFAULT_OUTFIT: Outfit = {
    body: 'female', skin: '#F1C09A', hair: '#3B2A22',
    top: 'tshirt', topColor: '#3FA37E', bottom: 'pants', bottomColor: '#3C4F78',
    shoes: 'basic', glasses: 'none', hat: 'none',
};

export const SKIN_COLORS = ['#F6D2B4', '#F1C09A', '#C98E62', '#8A5A3B'];
export const HAIR_COLORS = ['#2B2522', '#3B2A22', '#5B3A29', '#C98A3E', '#B8B2AC', '#D9534F'];
export const TOP_COLORS = ['#3FA37E', '#E2734A', '#4A7CC9', '#E8C547', '#7B61FF', '#FF8FB1', '#F4F4F1', '#34363E'];
export const BOTTOM_COLORS = ['#3C4F78', '#4A4F55', '#8A6A4A', '#2F5D4E', '#C9B79C', '#1D2330'];

// 옷 종류 — 서버의 lib/wear.ts 와 같은 목록·가격 (토파즈). 0 = 처음부터 있음
export type WearSlot = 'top' | 'bottom' | 'shoes' | 'glasses' | 'hat';
export const WEAR: Record<WearSlot, { key: string; name: string; price: number }[]> = {
    top: [
        { key: 'tshirt', name: '티셔츠', price: 0 },
        { key: 'hoodie', name: '후드티', price: 5 },
        { key: 'dress', name: '원피스', price: 6 },
    ],
    bottom: [
        { key: 'pants', name: '바지', price: 0 },
        { key: 'skirt', name: '치마', price: 4 },
    ],
    shoes: [
        { key: 'basic', name: '기본 신발', price: 0 },
        { key: 'sneakers', name: '운동화', price: 3 },
        { key: 'boots', name: '부츠', price: 5 },
    ],
    glasses: [
        { key: 'none', name: '없음', price: 0 },
        { key: 'glasses', name: '안경', price: 3 },
        { key: 'sunglasses', name: '선글라스', price: 4 },
    ],
    hat: [
        { key: 'none', name: '없음', price: 0 },
        { key: 'cap', name: '야구모자', price: 4 },
        { key: 'beanie', name: '비니', price: 4 },
    ],
};

// 상자: [x0, y0, z0, x1, y1, z1, 색]. 앞(얼굴)은 -z
type Box = [number, number, number, number, number, number, string];

function shade(hex: string, f: number): string {
    const n = parseInt(hex.slice(1), 16);
    const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))).toString(16).padStart(2, '0');
    return `#${c(16)}${c(8)}${c(0)}`;
}

// 좌우 대칭 한 쌍
const pair = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string): Box[] =>
    [[x0, y0, z0, x1, y1, z1, c], [-x1, y0, z0, -x0, y1, z1, c]];

export function avatarBoxes(o: Outfit): Box[] {
    const b: Box[] = [];
    const skin = o.skin, top = o.topColor, bot = o.bottomColor;
    const dark = '#34363E';

    // 신발
    let shoeTop = 1;
    if (o.shoes === 'basic') {
        b.push(...pair(0.1, 2.9, 0, 1, -2.2, 1.5, dark));
    } else if (o.shoes === 'sneakers') {
        b.push(...pair(0.05, 2.95, 0, 0.35, -2.3, 1.55, '#B9BEC5'));
        b.push(...pair(0.1, 2.9, 0.35, 1.2, -2.2, 1.5, '#F4F4F1'));
        shoeTop = 1.2;
    } else {
        b.push(...pair(0.1, 2.9, 0, 2, -2.2, 1.5, '#7A4E2D'));
        b.push(...pair(0, 3, 2, 2.7, -1.7, 1.6, '#5E3A20'));
        shoeTop = 2.7;
    }

    // 다리 + 치마/원피스 아랫단
    const lower = o.top === 'dress' ? 3.5 : o.bottom === 'skirt' ? 4.5 : 6;
    const legColor = o.top === 'dress' || o.bottom === 'skirt' ? skin : bot;
    b.push(...pair(0.2, 2.8, shoeTop, lower, -1.5, 1.5, legColor));
    if (o.top === 'dress') b.push([-3.4, 3.5, -2.4, 3.4, 6, 2.4, top]);
    else if (o.bottom === 'skirt') b.push([-3.4, 4.5, -2.4, 3.4, 6, 2.4, bot]);

    // 몸통
    b.push([-3, 6, -2, 3, 11, 2, top]);
    if (o.top === 'tshirt') b.push([-1.3, 10.3, -2.15, 1.3, 11, -2, shade(top, 0.78)]);
    if (o.top === 'hoodie') {
        b.push([-2.6, 9.4, 2, 2.6, 11.3, 2.9, shade(top, 0.82)]);   // 등 뒤 모자
        b.push([-2, 7, -2.25, 2, 8.4, -2, shade(top, 0.82)]);      // 주머니
        b.push([-1, 9.1, -2.12, -0.7, 10.8, -2, '#F2F2EE']);        // 끈
        b.push([0.7, 9.1, -2.12, 1, 10.8, -2, '#F2F2EE']);
    }

    // 팔: 위는 소매, 아래는 맨살 (후드티는 손목까지 소매)
    b.push(...pair(3, 4.6, 8.8, 11, -1, 1, top));
    if (o.top === 'hoodie') {
        b.push(...pair(3, 4.6, 7.4, 8.8, -1, 1, top));
        b.push(...pair(3.1, 4.5, 6.6, 7.4, -0.9, 0.9, skin));
    } else {
        b.push(...pair(3.1, 4.5, 6.6, 8.8, -0.9, 0.9, skin));
    }

    // 머리 + 얼굴
    b.push([-3.5, 11, -3.5, 3.5, 18, 3.5, skin]);
    b.push(...pair(1.2, 2.3, 14, 15.3, -3.6, -3.5, '#2A2420'));
    b.push([-0.7, 12.6, -3.6, 0.7, 13.1, -3.5, o.body === 'female' ? '#C9606B' : shade(skin, 0.62)]);
    if (o.body === 'female') b.push(...pair(2.4, 3.2, 13.1, 13.6, -3.56, -3.5, '#F0A3A3'));

    // 머리카락 (모자를 쓰면 정수리는 모자가 덮음)
    const hair = o.hair;
    if (o.hat === 'none') b.push([-3.7, 18, -3.7, 3.7, 19.2, 3.7, hair]);
    if (o.body === 'male') {
        b.push([-3.7, 14, 3.5, 3.7, 18, 3.8, hair]);
        b.push(...pair(3.5, 3.7, 15, 18, -2.5, 3.5, hair));
        b.push([-3.7, 17, -3.7, 3.7, 18, -3.5, hair]);
    } else {
        b.push([-3.7, 11.5, 3.5, 3.7, 18, 4.1, hair]);
        b.push(...pair(3.5, 3.8, 11.5, 18, -3.5, 3.5, hair));
        b.push([-3.7, 16.8, -3.8, 3.7, 18, -3.5, hair]);
        b.push([3.8, 15.9, -1, 4.1, 16.7, -0.3, '#E25F7A']);   // 머리핀
    }

    // 안경
    if (o.glasses !== 'none') {
        const f = '#26282C', z0 = -3.75, z1 = -3.6;
        if (o.glasses === 'sunglasses') {
            b.push(...pair(0.9, 2.7, 13.6, 15.6, z0, z1, '#2F3B47'));
        } else {
            b.push(...pair(0.9, 2.7, 15.35, 15.6, z0, z1, f));
            b.push(...pair(0.9, 2.7, 13.6, 13.85, z0, z1, f));
            b.push(...pair(0.9, 1.15, 13.85, 15.35, z0, z1, f));
            b.push(...pair(2.45, 2.7, 13.85, 15.35, z0, z1, f));
        }
        b.push([-0.9, 14.8, z0, 0.9, 15.1, z1, f]);
    }

    // 모자
    if (o.hat === 'cap') {
        b.push([-3.9, 18, -3.9, 3.9, 20.2, 3.9, '#E2734A']);
        b.push([-3.3, 18, -6.3, 3.3, 18.5, -3.9, '#E2734A']);
        b.push([-0.4, 20.2, -0.4, 0.4, 20.6, 0.4, '#B95A37']);
    } else if (o.hat === 'beanie') {
        b.push([-4, 18, -4, 4, 19.2, 4, '#C9A633']);
        b.push([-3.8, 19.2, -3.8, 3.8, 21, 3.8, '#E8C547']);
        b.push([-0.8, 21, -0.8, 0.8, 22.4, 0.8, '#F4F4F1']);
    }
    return b;
}

// 화면에 그릴 다각형. project: 모델 단위 (X, Y, Z) → 화면 [x, y]
export interface AvatarPoly { points: string; fill: string }

// rot 번 90° 돌린 상자 (Kenney 가구와 같은 방향 규칙: (x, z) → (z, -x))
function rotate(bx: Box, rot: number): Box {
    let [x0, y0, z0, x1, y1, z1] = bx;
    for (let i = 0; i < (rot & 3); i++) {
        [x0, z0, x1, z1] = [z0, -x1, z1, -x0];
    }
    return [x0, y0, z0, x1, y1, z1, bx[6]];
}

// 뒤에 있는 상자부터 (카메라는 +x, +y, +z 쪽). 한 축으로 완전히 떨어진 쪽이 뒤.
function sortBoxes(list: Box[]): Box[] {
    const behind = (a: Box, b: Box): boolean => {
        const ab = a[3] <= b[0] || a[5] <= b[2] || a[4] <= b[1];
        const ba = b[3] <= a[0] || b[5] <= a[2] || b[4] <= a[1];
        if (ab !== ba) return ab;
        if (ab) return false;  // 대각선으로 떨어짐 — 화면에서 안 겹치니 순서 무관
        return center(a) < center(b);  // 겹친 상자 (없도록 만들었지만 혹시)
    };
    const center = (x: Box) => x[0] + x[3] + x[2] + x[5] + x[1] + x[4];
    const left = [...list];
    const out: Box[] = [];
    while (left.length) {
        let i = left.findIndex(c => !left.some(o => o !== c && behind(o, c)));
        if (i < 0) i = left.reduce((bi, c, j) => (center(c) < center(left[bi]) ? j : bi), 0);
        out.push(left.splice(i, 1)[0]);
    }
    return out;
}

const cache = new Map<string, Box[]>();
function sortedBoxes(o: Outfit, rot: number): Box[] {
    const key = JSON.stringify(o) + rot;
    let v = cache.get(key);
    if (!v) {
        v = sortBoxes(avatarBoxes(o).map(bx => rotate(bx, rot)));
        if (cache.size > 64) cache.clear();
        cache.set(key, v);
    }
    return v;
}

// cx, cz: 발밑 가운데 (모델 단위), elev: 바닥 높이
export function avatarPolys(
    o: Outfit, rot: number, cx: number, cz: number, elev: number,
    project: (X: number, Y: number, Z: number) => [number, number],
): AvatarPoly[] {
    const P = (x: number, y: number, z: number) => project(cx + x * VOXEL, elev + y * VOXEL, cz + z * VOXEL).join(',');
    const polys: AvatarPoly[] = [];
    for (const [x0, y0, z0, x1, y1, z1, c] of sortedBoxes(o, rot)) {
        // 보이는 세 면: 위(밝게), +z(왼쪽 0.86), +x(오른쪽 0.72)
        polys.push({ points: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)].join(' '), fill: c });
        polys.push({ points: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)].join(' '), fill: shade(c, 0.86) });
        polys.push({ points: [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)].join(' '), fill: shade(c, 0.72) });
    }
    return polys;
}

// 캐릭터가 차지하는 범위 (모자 챙·머리핀까지, 칸 단위 V)
export const AVATAR_EXTENT = { x0: -4.7, x1: 4.7, y1: 22.4, z0: -6.4, z1: 4.2 };

export function isOutfit(v: unknown): v is Outfit {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return typeof o.body === 'string' && typeof o.top === 'string' && typeof o.skin === 'string';
}
