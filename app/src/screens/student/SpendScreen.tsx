import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAppStore, type CatalogItem, type OwnedReward } from '../../store/appStore';
import { Gem } from '../../components/Gem';
import { WEEK_MS } from '../../lib/days';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'Spend'> };

type Tab = 'shop' | 'mine';

function CostChips({ item }: { item: CatalogItem }) {
    return (
        <View style={styles.costRow}>
            <View style={styles.costChip}>
                <Gem size={14} />
                <Text style={styles.costNum}>{item.cost}</Text>
            </View>
            {item.kind === 'once' && (
                <View style={[styles.costChip, styles.onceChip]}>
                    <Text style={styles.costNum}>딱 1번</Text>
                </View>
            )}
        </View>
    );
}

const REWARD_STATUS: Record<OwnedReward['status'], string> = {
    owned: '보유중',
    use_requested: '⏳ 사용 요청중',
    used: '✅ 사용 완료',
};

// 상점: 다이아로 보상을 구매 → 내 보상에 쌓임 → "사용"을 누르면 매니저가 실제로 해주고 사용 완료 처리
export function SpendScreen({ navigation }: Props) {
    const {
        diamonds, catalog, rewards, rewardsSince, rewardsOlderUsedAt,
        fetchCatalog, fetchRewards, fetchMe, buyReward, requestUseReward,
    } = useAppStore();
    const [tab, setTab] = useState<Tab>('shop');
    const [refreshing, setRefreshing] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const load = useCallback(() => Promise.all([
        fetchMe().catch(() => {}),
        fetchCatalog().catch(() => {}),
        fetchRewards().catch(() => {}),
    ]), []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const handleBuy = (item: CatalogItem) => {
        if (diamonds < item.cost) {
            Alert.alert('다이아가 부족해요', '하루 할일을 모두 완료해서 다이아를 모아봐요!');
            return;
        }
        Alert.alert(
            `"${item.title}" 구매`,
            `다이아 ${item.cost}개로 구매할까요?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '구매',
                    onPress: async () => {
                        setLoadingId(item.id);
                        try {
                            await buyReward(item.id);
                            Alert.alert('구매 완료! 🎉', '"내 보상"에서 쓰고 싶을 때 사용을 눌러요');
                        } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : '오류';
                            Alert.alert('오류',
                                msg === 'insufficient_gems' ? '다이아가 부족해요'
                                : msg === 'catalog_item_not_found' ? '이미 팔렸거나 없어진 보상이에요'
                                : msg);
                            load();
                        } finally {
                            setLoadingId(null);
                        }
                    },
                },
            ],
        );
    };

    const handleUse = (reward: OwnedReward) => {
        Alert.alert(
            `"${reward.title}" 사용`,
            '매니저에게 사용하겠다고 알릴까요?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '사용',
                    onPress: async () => {
                        setLoadingId(reward.id);
                        try {
                            await requestUseReward(reward.id);
                        } catch (e: unknown) {
                            Alert.alert('오류', e instanceof Error ? e.message : '오류');
                            load();
                        } finally {
                            setLoadingId(null);
                        }
                    },
                },
            ],
        );
    };

    // 사용 완료된 보상은 최근 1주일치만 — 더 보기로 1주일씩 넓힌다
    const showOlderWeek = () => {
        if (rewardsOlderUsedAt == null) return;
        fetchRewards(Math.min(rewardsSince - WEEK_MS, rewardsOlderUsedAt)).catch(() => {});
    };

    // 아직 쓰지 않은 보상이 위로
    const myRewards = [...rewards].sort((a, b) =>
        Number(a.status === 'used') - Number(b.status === 'used') || b.purchased_at - a.purchased_at
    );
    const unusedCount = rewards.filter(r => r.status !== 'used').length;

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>보상 상점</Text>
                <View style={styles.balanceChip}>
                    <Gem size={16} />
                    <Text style={styles.balanceNum}>{diamonds}</Text>
                </View>
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, tab === 'shop' && styles.tabActive]} onPress={() => setTab('shop')}>
                    <Text style={[styles.tabText, tab === 'shop' && styles.tabTextActive]}>상점</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, tab === 'mine' && styles.tabActive]} onPress={() => setTab('mine')}>
                    <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
                        내 보상{unusedCount > 0 ? ` (${unusedCount})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {tab === 'shop' ? (
                <FlatList
                    data={catalog}
                    keyExtractor={i => i.id}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>
                                아직 살 수 있는 보상이 없어요{'\n'}매니저에게 보상을 추가해달라고 해봐요
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const affordable = diamonds >= item.cost;
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
                                        onPress={() => handleBuy(item)}
                                        disabled={!affordable}
                                    >
                                        <Text style={[styles.requestBtnText, !affordable && { color: colors.ink[300] }]}>
                                            {affordable ? '구매' : '부족'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    }}
                />
            ) : (
                <FlatList
                    data={myRewards}
                    keyExtractor={r => r.id}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>
                                아직 가진 보상이 없어요{'\n'}상점에서 다이아로 구매해봐요
                            </Text>
                        </View>
                    }
                    ListFooterComponent={rewardsOlderUsedAt != null ? (
                        <TouchableOpacity style={styles.moreBtn} onPress={showOlderWeek}>
                            <Text style={styles.moreBtnText}>이전에 쓴 보상 1주일 더 보기</Text>
                        </TouchableOpacity>
                    ) : null}
                    renderItem={({ item }) => (
                        <View style={[styles.card, item.status === 'used' && styles.cardDisabled]}>
                            <View style={styles.cardBody}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                {item.description ? (
                                    <Text style={styles.itemDesc}>{item.description}</Text>
                                ) : null}
                                <Text style={styles.rewardStatus}>{REWARD_STATUS[item.status]}</Text>
                            </View>
                            {item.status === 'owned' && (
                                loadingId === item.id ? (
                                    <ActivityIndicator color={colors.ocean[500]} />
                                ) : (
                                    <TouchableOpacity style={styles.requestBtn} onPress={() => handleUse(item)}>
                                        <Text style={styles.requestBtnText}>사용</Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    )}
                />
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
        fontSize: fontSizes.base,
        color: colors.ink[300],
    },
    tabTextActive: { color: colors.ocean[700] },
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
    moreBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.ink[200],
        marginTop: 4,
    },
    moreBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
    onceChip: { backgroundColor: colors.sun[300] },
    rewardStatus: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
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
