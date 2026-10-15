import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView,
    ActivityIndicator, Alert, PanResponder, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import { Price } from '../../components/Price';
import { MiniRoom, FurnitureThumb } from '../../components/MiniRoom';
import { useRoomZoom } from '../../hooks/useRoomZoom';
import { FURNITURE_CELL as CELL } from '../../lib/furnitureData';
import {
    makeLayout, defOf, canPlace, clampToRoom, findSpot, surfaceUnder, inRoom, hitTest,
    avatarItem, AVATAR_DEF, AVATAR_ID,
    WALL_COLORS, FLOOR_COLORS,
    type Room, type RoomItem, type Drawn,
} from '../../lib/miniroom';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'MiniRoom'> };
type Tab = 'storage' | 'style';

interface Drag {
    id: string;
    startX: number;
    startZ: number;
    moved: boolean;
}

// 내 방: 가구점에서 산 가구는 창고에 → 꺼내서 끌어다 놓고, 눌러서 돌리고, 다시 창고에 넣을 수 있다
export function MiniRoomScreen({ navigation }: Props) {
    const { width } = useWindowDimensions();
    const base = useMemo(() => makeLayout(width - 16), [width]);
    const zoomer = useRoomZoom(base);
    const layout = zoomer.layout;
    const { topaz, fetchMe } = useAppStore();
    const [room, setRoom] = useState<Room | null>(null);
    const [items, setItems] = useState<RoomItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dragPos, setDragPos] = useState<{ x: number; z: number } | null>(null);
    const [tab, setTab] = useState<Tab>('storage');

    const load = useCallback(async () => {
        try {
            const r = await api<Room>('/room');
            setRoom(r);
            // 미니미도 가구처럼 방에 놓는다 — 한 번도 놓은 적 없으면 가운데 근처 빈자리
            if (r.avatar) {
                const a = r.avatar;
                const spot = a.x != null && a.z != null ? [a.x, a.z] : findSpot(r.items, AVATAR_ID, AVATAR_DEF, a.rot);
                setItems(spot ? [...r.items, avatarItem(spot[0], spot[1], a.rot)] : r.items);
            } else {
                setItems(r.items);
            }
        } catch {
            Alert.alert('오류', '방을 불러오지 못했어요');
        }
    }, []);

    useFocusEffect(useCallback(() => {
        load();
        fetchMe().catch(() => {});
    }, [load]));

    // 바뀐 가구만 서버에 저장 (화면은 먼저 바꿔 둔다)
    const save = useCallback(async (changed: RoomItem[]) => {
        if (changed.length === 0) return;
        try {
            await api('/room/items', {
                method: 'PUT',
                body: JSON.stringify({
                    items: changed.map(i => ({ id: i.id, placed: i.placed, x: i.x, z: i.z, rot: i.rot })),
                }),
            });
        } catch {
            Alert.alert('오류', '저장하지 못했어요. 다시 불러올게요');
            load();
        }
    }, [load]);

    const apply = useCallback((changed: RoomItem[]) => {
        const byId = new Map(changed.map(c => [c.id, c]));
        setItems(prev => prev.map(i => byId.get(i.id) ?? i));
        save(changed);
    }, [save]);

    // 드래그 중인 가구는 손가락 위치로 바꿔서 그린다
    const placed = useMemo(() => items
        .filter(i => i.placed)
        .map(i => (dragPos && i.id === selectedId ? { ...i, x: dragPos.x, z: dragPos.z } : i)),
    [items, dragPos, selectedId]);

    const selected = items.find(i => i.id === selectedId && i.placed) ?? null;
    const selectedDef = selected ? defOf(selected) : undefined;
    const invalid = !!(selected && selectedDef && dragPos &&
        !canPlace(items, selected.id, selectedDef, dragPos.x, dragPos.z, selected.rot));

    // PanResponder 는 한 번만 만들어지므로 최신 값은 ref 로 읽는다
    const live = useRef({ items, selectedId, layout, zoomer });
    live.current = { items, selectedId, layout, zoomer };
    const drawnRef = useRef<Drawn[]>([]);
    const dragRef = useRef<Drag | null>(null);
    const posRef = useRef<{ x: number; z: number } | null>(null);
    // 지금 손가락이 하는 일: 가구 끌기 / 방 이동 / 두 손가락 확대
    const modeRef = useRef<'item' | 'pan' | 'pinch'>('pan');

    const pan = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
            const zm = live.current.zoomer;
            zm.setOffsetFrom(e);
            dragRef.current = null;
            posRef.current = null;
            if (e.nativeEvent.touches.length >= 2) {
                modeRef.current = 'pinch';
                zm.pinchMove(e);
                return;
            }
            const { locationX: px, locationY: py } = e.nativeEvent;
            const hit = hitTest(drawnRef.current, px, py, live.current.selectedId);
            if (hit) {
                modeRef.current = 'item';
                setSelectedId(hit.item.id);
                dragRef.current = { id: hit.item.id, startX: hit.item.x, startZ: hit.item.z, moved: false };
            } else {
                modeRef.current = 'pan';
                zm.panBegin();
            }
        },
        onPanResponderMove: (e, g) => {
            const zm = live.current.zoomer;
            // 두 번째 손가락이 닿으면 하던 끌기는 취소하고 확대로
            if (e.nativeEvent.touches.length >= 2) {
                if (modeRef.current !== 'pinch') {
                    modeRef.current = 'pinch';
                    dragRef.current = null;
                    posRef.current = null;
                    setDragPos(null);
                    zm.panEnd();
                }
                zm.pinchMove(e);
                return;
            }
            if (modeRef.current === 'pinch') return;  // 손가락 하나 뗀 뒤 — 다 뗄 때까지 무시
            if (modeRef.current === 'pan') {
                zm.panMove(g.dx, g.dy);
                return;
            }
            const drag = dragRef.current;
            if (!drag) return;
            const item = live.current.items.find(i => i.id === drag.id);
            const def = item && defOf(item);
            if (!item || !def) return;
            if (!drag.moved && Math.hypot(g.dx, g.dy) < 6) return;
            drag.moved = true;
            // 화면 이동 → 바닥 좌표 이동
            const { k } = live.current.layout;
            const a = g.dx / (Math.SQRT1_2 * k), b = (2 * g.dy) / k;
            const [x, z] = clampToRoom(def,
                drag.startX + Math.round((a + b) / 2 / CELL),
                drag.startZ + Math.round((b - a) / 2 / CELL),
                item.rot);
            if (posRef.current?.x !== x || posRef.current?.z !== z) {
                posRef.current = { x, z };
                setDragPos({ x, z });
            }
        },
        onPanResponderRelease: (_e, g) => {
            const zm = live.current.zoomer;
            const mode = modeRef.current;
            modeRef.current = 'pan';
            zm.pinchEnd();
            zm.panEnd();
            const drag = dragRef.current;
            dragRef.current = null;
            const pos = posRef.current;
            posRef.current = null;
            setDragPos(null);
            if (mode === 'pinch') return;
            if (!drag) {
                // 빈 곳을 톡 누르면 선택 해제
                if (Math.hypot(g.dx, g.dy) < 6) setSelectedId(null);
                return;
            }
            if (!drag.moved || !pos) return;
            const all = live.current.items;
            const item = all.find(i => i.id === drag.id);
            const def = item && defOf(item);
            if (!item || !def) return;
            if (pos.x === item.x && pos.z === item.z) return;
            if (!canPlace(all, item.id, def, pos.x, pos.z, item.rot)) return;  // 놓을 수 없는 자리면 제자리로
            const dx = pos.x - item.x, dz = pos.z - item.z;
            const changed: RoomItem[] = [{ ...item, x: pos.x, z: pos.z }];
            // 탁자를 옮기면 위에 올려둔 소품도 같이
            if (def.surface) {
                for (const o of all) {
                    if (!o.placed || surfaceUnder(all, o)?.id !== item.id) continue;
                    const od = defOf(o)!;
                    if (inRoom(od, o.x + dx, o.z + dz, o.rot)) changed.push({ ...o, x: o.x + dx, z: o.z + dz });
                }
            }
            apply(changed);
        },
        onPanResponderTerminate: () => {
            modeRef.current = 'pan';
            live.current.zoomer.pinchEnd();
            live.current.zoomer.panEnd();
            dragRef.current = null;
            posRef.current = null;
            setDragPos(null);
        },
    }), [apply]);

    const rotate = () => {
        if (!selected || !selectedDef) return;
        // 돌려서 방 밖으로 나가면 안쪽으로 당기고, 그래도 겹치면 못 돌린다
        for (let step = 1; step < 4; step++) {
            const rot = (selected.rot + step) & 3;
            const [x, z] = clampToRoom(selectedDef, selected.x, selected.z, rot);
            if (canPlace(items, selected.id, selectedDef, x, z, rot)) {
                apply([{ ...selected, x, z, rot }]);
                return;
            }
        }
        Alert.alert('돌릴 수 없어요', '옆에 다른 가구가 있어서 자리가 좁아요');
    };

    const putAway = () => {
        if (!selected) return;
        setSelectedId(null);
        apply([{ ...selected, placed: false }]);
    };

    const takeOut = (key: string) => {
        const item = items.find(i => !i.placed && i.item_key === key);
        const def = item && defOf(item);
        if (!item || !def) return;
        for (const rot of [2, 3, 0, 1]) {
            const spot = findSpot(items, item.id, def, rot);
            if (spot) {
                apply([{ ...item, placed: true, x: spot[0], z: spot[1], rot }]);
                setSelectedId(item.id);
                return;
            }
        }
        Alert.alert('자리가 없어요', '방이 꽉 찼어요. 다른 가구를 창고에 넣어봐요');
    };

    const setStyle = async (wall: string, floor: string) => {
        if (!room) return;
        const prev = room;
        setRoom({ ...room, wall, floor });
        try {
            await api('/room/style', { method: 'PUT', body: JSON.stringify({ wall, floor }) });
        } catch {
            setRoom(prev);
            Alert.alert('오류', '바꾸지 못했어요');
        }
    };

    // 창고: 같은 가구는 묶어서 개수로
    const storage = useMemo(() => {
        const groups = new Map<string, number>();
        for (const i of items) {
            if (!i.placed && defOf(i)) groups.set(i.item_key, (groups.get(i.item_key) ?? 0) + 1);
        }
        return [...groups.entries()].map(([key, count]) => ({ key, count, def: defOf({ item_key: key } as RoomItem)! }));
    }, [items]);
    const storageCount = storage.reduce((s, g) => s + g.count, 0);

    if (!room) {
        return (
            <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.ocean[500]} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>내 방</Text>
                <Price diamonds={0} topaz={topaz} size={15} showZero={false} />
            </View>

            <View style={styles.roomWrap}>
                {/* 터치 좌표가 방 그림과 딱 맞도록 방 크기 상자에 터치를 건다 */}
                {/* 버튼은 터치 상자 밖(형제)에 둔다 — 안에 두면 손가락이 조금만 움직여도 방이 터치를 가져가 버튼이 안 눌림 */}
                <View>
                    <View {...pan.panHandlers}>
                        <MiniRoom
                            layout={layout}
                            wall={room.wall}
                            floor={room.floor}
                            items={placed}
                            selectedId={selectedId}
                            invalid={invalid}
                            onDrawn={list => { drawnRef.current = list; }}
                            outfit={room.avatar?.outfit}
                        />
                    </View>
                    {zoomer.zoom > 1.01 && (
                        <TouchableOpacity style={styles.zoomReset} onPress={zoomer.reset}>
                            <Text style={styles.zoomResetText}>전체 보기</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {selected && selectedDef ? (
                <View style={styles.toolbar}>
                    <Text style={styles.toolName} numberOfLines={1}>{selectedDef.name}</Text>
                    <TouchableOpacity style={styles.toolBtn} onPress={rotate}>
                        <Text style={styles.toolBtnText}>↻ 돌리기</Text>
                    </TouchableOpacity>
                    {selected.id === AVATAR_ID ? (
                        <TouchableOpacity style={styles.toolBtn} onPress={() => navigation.navigate('Wardrobe')}>
                            <Text style={styles.toolBtnText}>👕 옷장</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.toolBtn} onPress={putAway}>
                            <Text style={styles.toolBtnText}>📦 창고로</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.toolBtn, styles.toolDone]} onPress={() => setSelectedId(null)}>
                        <Text style={[styles.toolBtnText, { color: '#fff' }]}>완료</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Text style={styles.hint}>가구나 나를 눌러 고르고 끌어서 옮겨요 · 두 손가락으로 확대</Text>
            )}

            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, tab === 'storage' && styles.tabActive]} onPress={() => setTab('storage')}>
                    <Text style={[styles.tabText, tab === 'storage' && styles.tabTextActive]}>
                        창고{storageCount > 0 ? ` (${storageCount})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, tab === 'style' && styles.tabActive]} onPress={() => setTab('style')}>
                    <Text style={[styles.tabText, tab === 'style' && styles.tabTextActive]}>벽지·바닥</Text>
                </TouchableOpacity>
                <View style={styles.shopBtns}>
                    <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('FurnitureShop')}>
                        <Text style={styles.shopBtnText}>🛒 가구점</Text>
                    </TouchableOpacity>
                    {room.avatar && (
                        <TouchableOpacity style={[styles.shopBtn, styles.wardrobeBtn]} onPress={() => navigation.navigate('Wardrobe')}>
                            <Text style={styles.shopBtnText}>👕 옷장</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {tab === 'storage' ? (
                <FlatList
                    data={storage}
                    keyExtractor={g => g.key}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            창고가 비어 있어요{'\n'}가구점에서 가구를 사면 여기에 들어와요
                        </Text>
                    }
                    renderItem={({ item: g }) => (
                        <View style={styles.row}>
                            <FurnitureThumb itemKey={g.key} size={48} />
                            <Text style={styles.rowName} numberOfLines={1}>
                                {g.def.name}{g.count > 1 ? `  ×${g.count}` : ''}
                            </Text>
                            <TouchableOpacity style={styles.takeBtn} onPress={() => takeOut(g.key)}>
                                <Text style={styles.takeBtnText}>꺼내기</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    <Text style={styles.styleLabel}>벽지</Text>
                    <View style={styles.swatches}>
                        {Object.entries(WALL_COLORS).map(([key, c]) => (
                            <TouchableOpacity key={key} style={styles.swatchItem} onPress={() => setStyle(key, room.floor)}>
                                <View style={[styles.swatch, { backgroundColor: c.color }, room.wall === key && styles.swatchOn]} />
                                <Text style={styles.swatchName}>{c.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.styleLabel}>바닥</Text>
                    <View style={styles.swatches}>
                        {Object.entries(FLOOR_COLORS).map(([key, c]) => (
                            <TouchableOpacity key={key} style={styles.swatchItem} onPress={() => setStyle(room.wall, key)}>
                                <View style={[styles.swatch, { backgroundColor: c.color }, room.floor === key && styles.swatchOn]} />
                                <Text style={styles.swatchName}>{c.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.ink[100],
    },
    backBtn: { padding: 4, width: 36 },
    backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['3xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    roomWrap: { alignItems: 'center', paddingTop: 6 },
    zoomReset: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(29,35,48,0.6)',
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    zoomResetText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.xs,
        color: '#fff',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginHorizontal: 12,
        marginVertical: 6,
        padding: 8,
        borderRadius: radius.md,
        backgroundColor: colors.card,
        ...shadows.card,
    },
    toolName: {
        flex: 1,
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[900],
        paddingLeft: 4,
    },
    toolBtn: {
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: colors.paper2,
    },
    toolDone: { backgroundColor: colors.ocean[500] },
    toolBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.xs,
        color: colors.ink[700],
    },
    hint: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        textAlign: 'center',
        marginVertical: 16,
    },
    tabs: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.ink[100],
        paddingRight: 10,
    },
    tab: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.ocean[500] },
    tabText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[300],
    },
    tabTextActive: { color: colors.ocean[700] },
    shopBtns: { marginLeft: 'auto', flexDirection: 'row', gap: 6 },
    wardrobeBtn: { backgroundColor: colors.grape[300] },
    shopBtn: {
        backgroundColor: colors.sun[300],
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    shopBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[900],
    },
    list: { padding: 12, gap: 8 },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 22,
        paddingTop: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 8,
        ...shadows.card,
    },
    rowName: {
        flex: 1,
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    takeBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    takeBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: '#fff',
    },
    styleLabel: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[700],
    },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
    swatchItem: { alignItems: 'center', gap: 4, width: 50 },
    swatch: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    swatchOn: { borderWidth: 3, borderColor: colors.ocean[500] },
    swatchName: {
        fontFamily: fontFamilies.body,
        fontSize: 11,
        color: colors.ink[500],
    },
});
