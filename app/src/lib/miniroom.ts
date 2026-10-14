// 미니룸 계산 — 격자, 화면 투영, 겹침, 그리는 순서
//
// 방 바닥은 ROOM_SIZE x ROOM_SIZE 칸. 칸 좌표 x 는 화면 오른쪽 아래로, z 는 왼쪽 아래로 늘어난다
// (x = 0 쪽이 왼쪽 벽, z = 0 쪽이 오른쪽 벽). 카메라는 45° 돌려 45° 내려다보는 Kenney 렌더와 같다.
import { FURNITURE_BY_KEY, FURNITURE_CELL as CELL, type FurnitureDef } from './furnitureData';

export const ROOM_SIZE = 20;
export const WALL_H = 1.0;          // 벽 높이 (모델 단위)
const C = Math.SQRT1_2;
const SPAN = ROOM_SIZE * CELL;      // 방 한 변 (모델 단위)

export interface RoomItem {
    id: string;
    item_key: string;
    placed: boolean;
    x: number;
    z: number;
    rot: number;
    bought_at: number;
}

export interface Room {
    size: number;
    wall: string;
    floor: string;
    items: RoomItem[];
}

// 벽지·바닥 색 (무료로 바꿀 수 있다). 서버에는 이름만 저장
export const WALL_COLORS: Record<string, { name: string; color: string }> = {
    cream:    { name: '크림', color: '#efe4d0' },
    mint:     { name: '민트', color: '#d3eee0' },
    sky:      { name: '하늘', color: '#d5e6f6' },
    pink:     { name: '분홍', color: '#f7dbe2' },
    lavender: { name: '보라', color: '#e3dbf5' },
    gray:     { name: '회색', color: '#e0e1e4' },
};
export const FLOOR_COLORS: Record<string, { name: string; color: string }> = {
    wood:  { name: '나무', color: '#c99f74' },
    light: { name: '밝은 나무', color: '#e2c79f' },
    gray:  { name: '회색', color: '#b5b9c1' },
    mint:  { name: '민트', color: '#a7cdb6' },
    pink:  { name: '분홍', color: '#e5b6bf' },
    navy:  { name: '남색', color: '#7d8ca6' },
};

export interface Layout {
    k: number;        // 모델 1 단위 = k 픽셀
    width: number;
    height: number;
    ox: number;       // 방 안쪽 모서리 (x = z = 0, 바닥) 의 화면 위치
    oy: number;
}

// 주어진 폭에 방이 꽉 차게
export function makeLayout(width: number): Layout {
    const pad = 6;
    const k = (width - pad * 2) / (2 * SPAN * C);
    return { k, width, height: (SPAN + WALL_H * C) * k + pad * 2, ox: width / 2, oy: WALL_H * C * k + pad };
}

// 모델 좌표 (X, Y, Z) → 화면 좌표
export function project(l: Layout, X: number, Y: number, Z: number): [number, number] {
    return [l.ox + (X - Z) * C * l.k, l.oy + ((X + Z) * 0.5 - Y * C) * l.k];
}

export const defOf = (item: RoomItem): FurnitureDef | undefined => FURNITURE_BY_KEY[item.item_key];

// 방향에 따라 차지하는 칸 [가로(x), 세로(z)]
export function footprint(def: FurnitureDef, rot: number): [number, number] {
    const d = def.dirs[rot] ?? def.dirs[0];
    return [d[0], d[1]];
}

interface Box { x0: number; z0: number; x1: number; z1: number }
const boxOf = (def: FurnitureDef, x: number, z: number, rot: number): Box => {
    const [w, d] = footprint(def, rot);
    return { x0: x, z0: z, x1: x + w, z1: z + d };
};
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const inside = (a: Box, b: Box) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.z0 >= b.z0 && a.z1 <= b.z1;

export function inRoom(def: FurnitureDef, x: number, z: number, rot: number): boolean {
    const [w, d] = footprint(def, rot);
    return x >= 0 && z >= 0 && x + w <= ROOM_SIZE && z + d <= ROOM_SIZE;
}

// 방 밖으로 나가지 않게 칸을 당겨 넣는다
export function clampToRoom(def: FurnitureDef, x: number, z: number, rot: number): [number, number] {
    const [w, d] = footprint(def, rot);
    return [Math.max(0, Math.min(ROOM_SIZE - w, x)), Math.max(0, Math.min(ROOM_SIZE - d, z))];
}

// 그 자리에 놓을 수 있나 — 바닥 가구끼리만 겹치면 안 된다 (러그·소품은 겹쳐도 됨)
export function canPlace(items: RoomItem[], id: string, def: FurnitureDef, x: number, z: number, rot: number): boolean {
    if (!inRoom(def, x, z, rot)) return false;
    if (def.type !== 'floor') return true;
    const box = boxOf(def, x, z, rot);
    return !items.some(o => {
        if (!o.placed || o.id === id) return false;
        const od = defOf(o);
        return od?.type === 'floor' && overlaps(box, boxOf(od, o.x, o.z, o.rot));
    });
}

// 빈 자리 찾기 — 방 가운데에서 가까운 곳부터
export function findSpot(items: RoomItem[], id: string, def: FurnitureDef, rot: number): [number, number] | null {
    const [w, d] = footprint(def, rot);
    const cands: [number, number][] = [];
    for (let x = 0; x + w <= ROOM_SIZE; x++) for (let z = 0; z + d <= ROOM_SIZE; z++) cands.push([x, z]);
    const mid = ROOM_SIZE / 2;
    cands.sort((a, b) =>
        Math.hypot(a[0] + w / 2 - mid, a[1] + d / 2 - mid) - Math.hypot(b[0] + w / 2 - mid, b[1] + d / 2 - mid));
    return cands.find(([x, z]) => canPlace(items, id, def, x, z, rot)) ?? null;
}

// 소품이 올라앉은 가구 (탁자·선반 위에 칸이 완전히 들어가면)
export function surfaceUnder(items: RoomItem[], item: RoomItem, x = item.x, z = item.z, rot = item.rot): RoomItem | null {
    const def = defOf(item);
    if (def?.type !== 'small') return null;
    const box = boxOf(def, x, z, rot);
    let best: RoomItem | null = null;
    for (const o of items) {
        const od = o.placed && o.id !== item.id ? defOf(o) : undefined;
        if (!od?.surface || !inside(box, boxOf(od, o.x, o.z, o.rot))) continue;
        if (!best || od.surface > defOf(best)!.surface) best = o;
    }
    return best;
}

export interface Drawn {
    item: RoomItem;
    def: FurnitureDef;
    elev: number;                 // 올라앉은 높이 (모델 단위)
    left: number; top: number; width: number; height: number;  // 그림 사각형
    hit: [number, number][];      // 터치 판정용 육각형 (가구 상자의 화면 윤곽)
    depth: number;
}

// 그림 위치와 터치 영역 계산
export function drawnOf(l: Layout, items: RoomItem[], item: RoomItem): Drawn | null {
    const def = defOf(item);
    if (!def) return null;
    const rot = item.rot & 3;
    const [w, d, ix, iy, iw, ih] = def.dirs[rot];
    const surface = surfaceUnder(items, item);
    const elev = surface ? defOf(surface)!.surface : 0;
    const [cx, cy] = project(l, (item.x + w / 2) * CELL, elev, (item.z + d / 2) * CELL);
    const x0 = item.x * CELL, z0 = item.z * CELL, x1 = (item.x + w) * CELL, z1 = (item.z + d) * CELL;
    const top = elev + Math.max(def.h, 0.02);
    const hit = [
        project(l, x0, elev, z1), project(l, x1, elev, z1), project(l, x1, elev, z0),
        project(l, x1, top, z0), project(l, x0, top, z0), project(l, x0, top, z1),
    ];
    return {
        item, def, elev,
        left: cx + ix * l.k, top: cy + iy * l.k, width: iw * l.k, height: ih * l.k,
        hit,
        depth: item.x + w / 2 + item.z + d / 2,
    };
}

// 손가락 위치에 있는 가구 — 이미 고른 것 먼저, 그다음 앞에 그려진 것부터.
// 작은 소품은 정확히 누르기 어려우니 아무것도 안 걸리면 가까이(slop 픽셀 안) 있는 것을 고른다
export function hitTest(drawn: Drawn[], px: number, py: number, selectedId: string | null, slop = 14): Drawn | null {
    const sel = drawn.find(d => d.item.id === selectedId && pointIn(d.hit, px, py));
    if (sel) return sel;
    const direct = [...drawn].reverse().find(d => pointIn(d.hit, px, py) && d.def.type !== 'rug');
    if (direct) return direct;
    let best: Drawn | null = null, bestDist = slop;
    for (const d of drawn) {
        if (d.def.type === 'rug') continue;
        const dist = distToPoly(d.hit, px, py);
        if (dist < bestDist) { best = d; bestDist = dist; }
    }
    // 그 외에는 러그 (러그는 맨 아래라 다른 가구를 가리지 않게 마지막에)
    return best ?? [...drawn].reverse().find(d => pointIn(d.hit, px, py)) ?? null;
}

function distToPoly(poly: [number, number][], px: number, py: number): number {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[j], [bx, by] = poly[i];
        const vx = bx - ax, vy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
        best = Math.min(best, Math.hypot(px - ax - t * vx, py - ay - t * vy));
    }
    return best;
}

export function pointIn(poly: [number, number][], px: number, py: number): boolean {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
}

// 그리는 순서: 러그 → 나머지는 뒤에 있는 것부터. 칸이 겹치지 않으면 x 나 z 로 완전히 뒤에 있는 쪽이 먼저
// 겹치면 (소품이 탁자 위 등) 아래 있는 것 → 위에 있는 것, 그 외에는 가운데 위치로.
export function drawOrder(list: Drawn[]): Drawn[] {
    const rugs = list.filter(d => d.def.type === 'rug').sort((a, b) => a.depth - b.depth);
    const rest = list.filter(d => d.def.type !== 'rug');
    const box = (d: Drawn) => boxOf(d.def, d.item.x, d.item.z, d.item.rot);
    const behind = (a: Drawn, b: Drawn): boolean => {
        const A = box(a), B = box(b);
        const aBehind = A.x1 <= B.x0 || A.z1 <= B.z0;
        const bBehind = B.x1 <= A.x0 || B.z1 <= A.z0;
        if (aBehind !== bBehind) return aBehind;
        // 양쪽 다 떨어져 있으면 (대각선 방향) 화면에서 겹치지 않으니 순서 상관없음
        if (aBehind) return false;
        // 칸이 겹침 (소품이 탁자 위 등): 낮은 것 먼저
        if (a.elev !== b.elev) return a.elev < b.elev;
        return a.depth < b.depth || (a.depth === b.depth && a.item.id < b.item.id);
    };
    // 단순 위상 정렬 (가구 수가 적어 O(n²) 로 충분)
    const out: Drawn[] = [];
    const left = [...rest];
    while (left.length) {
        let idx = left.findIndex(c => !left.some(o => o !== c && behind(o, c)));
        if (idx < 0) {  // 순환 — 가운데 위치가 가장 뒤인 것
            idx = left.reduce((bi, c, i) => (c.depth < left[bi].depth ? i : bi), 0);
        }
        out.push(left.splice(idx, 1)[0]);
    }
    return [...rugs, ...out];
}
