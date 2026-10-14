import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import { Price } from '../../components/Price';
import { FurnitureThumb } from '../../components/MiniRoom';
import { FURNITURE, type FurnitureCat, type FurnitureDef } from '../../lib/furnitureData';
import type { Room, RoomItem } from '../../lib/miniroom';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'FurnitureShop'> };

const CATS: [FurnitureCat, string][] = [
    ['furniture', '가구'],
    ['appliance', '가전'],
    ['deco', '소품'],
    ['kitchen', '주방·욕실'],
];

// 가구점: 다이아·루비로 사면 바로 창고로 들어간다
export function FurnitureShopScreen({ navigation }: Props) {
    const { width } = useWindowDimensions();
    const { diamonds, rubies, fetchMe } = useAppStore();
    const [cat, setCat] = useState<FurnitureCat>('furniture');
    const [owned, setOwned] = useState<RoomItem[]>([]);
    const [buying, setBuying] = useState<string | null>(null);

    const loadOwned = useCallback(() =>
        api<Room>('/room').then(r => setOwned(r.items)).catch(() => {}), []);

    useFocusEffect(useCallback(() => {
        loadOwned();
        fetchMe().catch(() => {});
    }, [loadOwned]));

    const ownedCount = useMemo(() => {
        const m = new Map<string, number>();
        for (const i of owned) m.set(i.item_key, (m.get(i.item_key) ?? 0) + 1);
        return m;
    }, [owned]);

    const list = FURNITURE.filter(f => f.cat === cat);
    const canAfford = (f: FurnitureDef) => diamonds >= f.cost && rubies >= f.ruby;
    const cardW = (width - 12 * 2 - 10) / 2;

    const buy = (f: FurnitureDef) => {
        if (!canAfford(f)) {
            Alert.alert('보석이 부족해요', '다이아는 하루 할일을 모두 완료하면, 루비는 책을 다 읽으면 받아요!');
            return;
        }
        const price = [f.cost > 0 ? `다이아 ${f.cost}개` : '', f.ruby > 0 ? `루비 ${f.ruby}개` : '']
            .filter(Boolean).join(' + ');
        Alert.alert(`${f.name} 구매`, `${price}로 살까요?`, [
            { text: '취소', style: 'cancel' },
            {
                text: '구매',
                onPress: async () => {
                    setBuying(f.key);
                    try {
                        const item = await api<RoomItem>('/room/buy', {
                            method: 'POST',
                            body: JSON.stringify({ item_key: f.key }),
                        });
                        setOwned(prev => [item, ...prev]);
                        await fetchMe().catch(() => {});
                        Alert.alert('구매 완료! 🎉', `${f.name}을(를) 창고에 넣었어요.\n내 방에서 꺼내서 꾸며봐요`);
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : '';
                        Alert.alert('오류', msg === 'insufficient_gems' ? '보석이 부족해요' : '구매하지 못했어요');
                        fetchMe().catch(() => {});
                    } finally {
                        setBuying(null);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>가구점</Text>
                <Price diamonds={diamonds} rubies={rubies} size={15} showZero />
            </View>

            <View style={styles.tabs}>
                {CATS.map(([key, label]) => (
                    <TouchableOpacity key={key} style={[styles.tab, cat === key && styles.tabActive]} onPress={() => setCat(key)}>
                        <Text style={[styles.tabText, cat === key && styles.tabTextActive]}>{label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                key={cat}
                data={list}
                keyExtractor={f => f.key}
                numColumns={2}
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={styles.list}
                renderItem={({ item: f }) => {
                    const affordable = canAfford(f);
                    const count = ownedCount.get(f.key) ?? 0;
                    return (
                        <TouchableOpacity
                            style={[styles.card, { width: cardW }, !affordable && styles.cardDim]}
                            activeOpacity={0.7}
                            onPress={() => buy(f)}
                            disabled={buying !== null}
                        >
                            <FurnitureThumb itemKey={f.key} size={cardW - 40} />
                            <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
                            <View style={styles.cardBottom}>
                                <Price diamonds={f.cost} rubies={f.ruby} size={13} />
                                {count > 0 && <Text style={styles.owned}>보유 {count}</Text>}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
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
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.ink[100],
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.ocean[500] },
    tabText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[300],
    },
    tabTextActive: { color: colors.ocean[700] },
    list: { padding: 12, gap: 10 },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 10,
        alignItems: 'center',
        gap: 6,
        ...shadows.card,
    },
    cardDim: { opacity: 0.5 },
    name: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[900],
    },
    cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    owned: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.ocean[700],
    },
});
