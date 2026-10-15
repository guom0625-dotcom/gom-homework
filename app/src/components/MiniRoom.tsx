import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import Svg, { Polygon, Line } from 'react-native-svg';
import { FURNITURE_IMAGES, FURNITURE_CELL as CELL } from '../lib/furnitureData';
import {
    ROOM_SIZE, WALL_H, WALL_COLORS, FLOOR_COLORS,
    project, drawnOf, drawOrder, footprint, defOf,
    type Layout, type RoomItem, type Drawn,
} from '../lib/miniroom';

// 색을 조금 어둡게 (왼쪽 벽 그늘, 바닥 줄)
function shade(hex: string, f: number): string {
    const n = parseInt(hex.slice(1), 16);
    const c = (s: number) => Math.round(((n >> s) & 255) * f).toString(16).padStart(2, '0');
    return `#${c(16)}${c(8)}${c(0)}`;
}

interface Props {
    layout: Layout;
    wall: string;
    floor: string;
    items: RoomItem[];            // 방에 놓인 것만
    selectedId?: string | null;
    invalid?: boolean;            // 선택한 가구가 지금 자리에 놓일 수 없음
    onDrawn?: (list: Drawn[]) => void;  // 터치 판정용으로 그린 결과를 알려준다
}

// 미니룸 그림 — 벽·바닥은 SVG, 가구는 Kenney 아이소메트릭 그림. 터치는 부모가 처리한다
export function MiniRoom({ layout: l, wall, floor, items, selectedId, invalid, onDrawn }: Props) {
    const wallColor = (WALL_COLORS[wall] ?? WALL_COLORS.cream).color;
    const floorColor = (FLOOR_COLORS[floor] ?? FLOOR_COLORS.wood).color;
    const S = ROOM_SIZE * CELL;
    const pts = (list: [number, number, number][]) =>
        list.map(([x, y, z]) => project(l, x, y, z).join(',')).join(' ');

    const drawn = useMemo(() => {
        const list = items.map(i => drawnOf(l, items, i)).filter((d): d is Drawn => !!d);
        return drawOrder(list);
    }, [l, items]);
    React.useEffect(() => { onDrawn?.(drawn); }, [drawn]);

    const selected = drawn.find(d => d.item.id === selectedId);
    let mark: string | null = null;
    if (selected) {
        const [w, d] = footprint(selected.def, selected.item.rot);
        const { x, z } = selected.item;
        const e = selected.elev;
        mark = pts([[x * CELL, e, z * CELL], [(x + w) * CELL, e, z * CELL], [(x + w) * CELL, e, (z + d) * CELL], [x * CELL, e, (z + d) * CELL]]);
    }

    const grid: [number, number, number, number][] = [];
    for (let i = 1; i < ROOM_SIZE; i++) {
        const a = project(l, i * CELL, 0, 0), b = project(l, i * CELL, 0, S);
        const c = project(l, 0, 0, i * CELL), d = project(l, S, 0, i * CELL);
        grid.push([a[0], a[1], b[0], b[1]], [c[0], c[1], d[0], d[1]]);
    }

    return (
        <View style={{ width: l.width, height: l.height, overflow: 'hidden' }} pointerEvents="none">
            <Svg width={l.width} height={l.height} style={{ position: 'absolute' }}>
                {/* 오른쪽 벽 (z = 0), 왼쪽 벽 (x = 0) */}
                <Polygon points={pts([[0, 0, 0], [S, 0, 0], [S, WALL_H, 0], [0, WALL_H, 0]])} fill={wallColor} />
                <Polygon points={pts([[0, 0, 0], [0, 0, S], [0, WALL_H, S], [0, WALL_H, 0]])} fill={shade(wallColor, 0.92)} />
                <Polygon points={pts([[0, 0, 0], [S, 0, 0], [S, 0, S], [0, 0, S]])} fill={floorColor} />
                {grid.map(([x1, y1, x2, y2], i) => (
                    <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={shade(floorColor, 0.88)} strokeWidth={selected ? 1 : 0.6} />
                ))}
                {/* 바닥 두께 */}
                <Polygon points={pts([[S, 0, 0], [S, 0, S], [S, -0.06, S], [S, -0.06, 0]])} fill={shade(floorColor, 0.75)} />
                <Polygon points={pts([[0, 0, S], [S, 0, S], [S, -0.06, S], [0, -0.06, S]])} fill={shade(floorColor, 0.65)} />
                {mark && (
                    <Polygon points={mark}
                        fill={invalid ? 'rgba(255,80,80,0.35)' : 'rgba(0,184,148,0.3)'}
                        stroke={invalid ? '#ff5050' : '#00b894'} strokeWidth={2} />
                )}
            </Svg>
            {drawn.map(d => (
                <Image
                    key={d.item.id}
                    source={FURNITURE_IMAGES[d.item.item_key][d.item.rot & 3]}
                    style={{
                        position: 'absolute', left: d.left, top: d.top, width: d.width, height: d.height,
                        opacity: d.item.id === selectedId && invalid ? 0.55 : 1,
                    }}
                    resizeMode="stretch"
                    fadeDuration={0}
                />
            ))}
        </View>
    );
}

// 가구 하나의 그림 (상점·창고 목록용)
export function FurnitureThumb({ itemKey, size, rot = 2 }: { itemKey: string; size: number; rot?: number }) {
    const def = FURNITURE_IMAGES[itemKey] ? defOf({ item_key: itemKey } as RoomItem) : undefined;
    if (!def) return <View style={{ width: size, height: size }} />;
    const [, , , , iw, ih] = def.dirs[rot];
    const scale = size / Math.max(iw, ih);
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Image
                source={FURNITURE_IMAGES[itemKey][rot]}
                style={{ width: iw * scale, height: ih * scale }}
                resizeMode="contain"
                fadeDuration={0}
            />
        </View>
    );
}
