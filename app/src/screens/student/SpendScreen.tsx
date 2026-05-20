import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAppStore, type CatalogItem } from '../../store/appStore';
import { canAfford, GEM_VALUES, type GemKey, type GemInventory } from '../../lib/gems';
import { Gem } from '../../components/Gem';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'Spend'> };

const GEM_KEYS: GemKey[] = ['topaz', 'sapphire', 'emerald', 'ruby', 'amethyst'];

function itemCost(item: CatalogItem): Partial<GemInventory> {
    const cost: Partial<GemInventory> = {};
    for (const g of GEM_KEYS) {
        const v = item[`cost_${g}` as keyof CatalogItem] as number;
        if (v > 0) cost[g] = v;
    }
    return cost;
}

function GemBalanceBar({ gems }: { gems: GemInventory }) {
    return (
        <View style={styles.balanceBar}>
            {GEM_KEYS.filter(g => gems[g] > 0 || true).map(g => (
                <View key={g} style={styles.balanceChip}>
                    <Gem size={16} color={g} />
                    <Text style={styles.balanceNum}>{gems[g]}</Text>
                </View>
            ))}
        </View>
    );
}

function CostChips({ item }: { item: CatalogItem }) {
    const chips = GEM_KEYS.filter(g => (item[`cost_${g}` as keyof CatalogItem] as number) > 0);
    if (chips.length === 0) return <Text style={styles.freeBadge}>무료</Text>;
    return (
        <View style={styles.costRow}>
            {chips.map(g => (
                <View key={g} style={styles.costChip}>
                    <Gem size={14} color={g} />
                    <Text style={styles.costNum}>
                        {item[`cost_${g}` as keyof CatalogItem] as number}
                    </Text>
                </View>
            ))}
        </View>
    );
}

export function SpendScreen({ navigation }: Props) {
    const { gems, catalog, fetchCatalog, requestSpend } = useAppStore();
    const [refreshing, setRefreshing] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    useEffect(() => { fetchCatalog().catch(() => {}); }, []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await fetchCatalog().catch(() => {});
        setRefreshing(false);
    }, []);

    const handleRequest = (item: CatalogItem) => {
        const cost = itemCost(item);
        if (!canAfford(gems, cost)) {
            Alert.alert('보석이 부족해요', '할일을 더 완료해서 보석을 모아봐요!');
            return;
        }
        Alert.alert(
            `"${item.title}" 요청`,
            '매니저에게 구매 요청을 보낼까요?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '요청하기',
                    onPress: async () => {
                        setLoadingId(item.id);
                        try {
                            await requestSpend(item.id);
                            Alert.alert('요청 완료!', '매니저가 확인 후 승인해줄 거예요 🎉');
                        } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : '오류';
                            Alert.alert('오류', msg === 'insufficient_gems' ? '보석이 부족해요' : msg);
                        } finally {
                            setLoadingId(null);
                        }
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>보상 상점</Text>
                <View style={{ width: 36 }} />
            </View>

            <GemBalanceBar gems={gems} />

            <FlatList
                data={catalog}
                keyExtractor={i => i.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            아직 등록된 보상이 없어요{'\n'}매니저에게 보상 아이템을 추가해달라고 해봐요
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const cost = itemCost(item);
                    const affordable = canAfford(gems, cost);
                    return (
                        <View style={[styles.card, !affordable && styles.cardDisabled]}>
                            <View style={styles.cardBody}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                {item.description ? (
                                    <Text style={styles.itemDesc}>{item.description}</Text>
                                ) : null}
                                <CostChips item={item} />
                            </View>
                            {loadingId === item.id ? (
                                <ActivityIndicator color={colors.ocean[500]} />
                            ) : (
                                <TouchableOpacity
                                    style={[styles.requestBtn, !affordable && styles.requestBtnDisabled]}
                                    onPress={() => handleRequest(item)}
                                    disabled={!affordable}
                                >
                                    <Text style={[styles.requestBtnText, !affordable && { color: colors.ink[300] }]}>
                                        {affordable ? '요청' : '부족'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
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
    balanceBar: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.paper2,
        flexWrap: 'wrap',
    },
    balanceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.card,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        ...shadows.card,
    },
    balanceNum: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.sm,
        color: colors.ink[700],
        fontWeight: '700',
    },
    list: { padding: 14, gap: 10 },
    empty: { paddingTop: 80, alignItems: 'center' },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 24,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...shadows.card,
    },
    cardDisabled: { opacity: 0.55 },
    cardBody: { flex: 1, gap: 4 },
    itemTitle: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    itemDesc: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
    costRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
    costChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.paper2,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    costNum: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.xs,
        color: colors.ink[700],
        fontWeight: '700',
    },
    freeBadge: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.ocean[500],
        marginTop: 2,
    },
    requestBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
        minWidth: 52,
        alignItems: 'center',
    },
    requestBtnDisabled: { backgroundColor: colors.ink[100] },
    requestBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: '#fff',
    },
});
