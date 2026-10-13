import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import type { OwnedReward } from '../../store/appStore';
import { WEEK_MS } from '../../lib/days';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'RewardUse'> };

type FilterTab = 'requested' | 'owned' | 'used';

const TAB_LABEL: Record<FilterTab, string> = { requested: '사용 요청', owned: '보유중', used: '사용 완료' };
const TAB_STATUS: Record<FilterTab, OwnedReward['status']> = {
    requested: 'use_requested', owned: 'owned', used: 'used',
};
const EMPTY_TEXT: Record<FilterTab, string> = {
    requested: '사용 요청이 없어요',
    owned: '학생이 아직 쓰지 않고 가진 보상이 없어요',
    used: '사용 완료한 보상이 없어요',
};

function formatTime(ts: number | null): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

// 학생이 구매한 보상 목록. 학생이 "사용"을 누른 보상은 실제로 해준 뒤 여기서 사용 완료 처리한다
export function RewardUseScreen({ navigation }: Props) {
    const [rewards, setRewards] = useState<OwnedReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<FilterTab>('requested');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 사용 완료된 보상은 최근 1주일치만 받고, "더 보기"로 1주일씩 넓힌다 (안 쓴 보상은 항상 전부)
    const [usedSince, setUsedSince] = useState(() => Date.now() - WEEK_MS);
    const [olderUsedAt, setOlderUsedAt] = useState<number | null>(null);

    const load = useCallback(async () => {
        const res = await api<{ rewards: OwnedReward[]; older_used_at: number | null }>(
            `/rewards?used_since=${usedSince}`
        );
        setRewards(res.rewards);
        setOlderUsedAt(res.older_used_at);
    }, [usedSince]);

    useEffect(() => {
        load().catch(() => {}).finally(() => setLoading(false));
    }, [load]);

    const showOlderWeek = () => {
        if (olderUsedAt == null) return;
        // 바로 앞 1주일이 비어 있으면, 가장 가까운 기록이 포함되도록 더 앞으로
        setUsedSince(Math.min(usedSince - WEEK_MS, olderUsedAt));
    };

    useFocusEffect(useCallback(() => {
        load().catch(() => {});
    }, [load]));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load().catch(() => {});
        setRefreshing(false);
    }, [load]);

    const handleComplete = (reward: OwnedReward) => {
        Alert.alert(
            '사용 완료',
            `${reward.student_name ?? '학생'}에게 "${reward.title}" 보상을 해줬나요?`,
            [
                { text: '아직', style: 'cancel' },
                {
                    text: '사용 완료',
                    onPress: async () => {
                        setProcessingId(reward.id);
                        try {
                            await api(`/rewards/${reward.id}/complete`, { method: 'POST' });
                            setRewards(prev =>
                                prev.map(r => r.id === reward.id ? { ...r, status: 'used', used_at: Date.now() } : r)
                            );
                        } catch (e: unknown) {
                            Alert.alert('오류', e instanceof Error ? e.message : '오류');
                            load().catch(() => {});
                        } finally {
                            setProcessingId(null);
                        }
                    },
                },
            ],
        );
    };

    const displayed = rewards.filter(r => r.status === TAB_STATUS[tab]);
    const requestedCount = rewards.filter(r => r.status === 'use_requested').length;

    if (loading) {
        return (
            <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.ocean[500]} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>보상 사용</Text>
                <View style={{ width: 52 }} />
            </View>

            <View style={styles.tabs}>
                {(['requested', 'owned', 'used'] as const).map(t => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, tab === t && styles.tabActive]}
                        onPress={() => setTab(t)}
                    >
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                            {TAB_LABEL[t]}{t === 'requested' && requestedCount > 0 ? ` (${requestedCount})` : ''}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={displayed}
                keyExtractor={r => r.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {tab === 'used' && olderUsedAt != null ? '최근 1주일 동안 사용 완료한 보상이 없어요' : EMPTY_TEXT[tab]}
                        </Text>
                    </View>
                }
                ListFooterComponent={tab === 'used' && olderUsedAt != null ? (
                    <TouchableOpacity style={styles.moreBtn} onPress={showOlderWeek}>
                        <Text style={styles.moreBtnText}>이전 1주일 더 보기</Text>
                    </TouchableOpacity>
                ) : null}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardTop}>
                            <Text style={styles.studentName}>{item.student_name ?? '학생'}</Text>
                            <Text style={styles.dateText}>💎 {item.cost}</Text>
                        </View>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                        <Text style={styles.dateText}>
                            {item.status === 'used' ? `사용 완료 ${formatTime(item.used_at)}`
                                : item.status === 'use_requested' ? `사용 요청 ${formatTime(item.use_requested_at)}`
                                : `구매 ${formatTime(item.purchased_at)}`}
                        </Text>
                        {item.status === 'use_requested' && (
                            <View style={styles.actionRow}>
                                {processingId === item.id ? (
                                    <ActivityIndicator color={colors.ocean[500]} />
                                ) : (
                                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleComplete(item)}>
                                        <Text style={styles.approveBtnText}>사용 완료</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                )}
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
    backBtn: { padding: 4, width: 52 },
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
    list: { padding: 14, gap: 10 },
    empty: { paddingTop: 80, alignItems: 'center' },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 14,
        gap: 4,
        ...shadows.card,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    studentName: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[700],
    },
    itemDesc: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
    itemTitle: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        marginTop: 2,
    },
    dateText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.xs,
        color: colors.ink[300],
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
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        justifyContent: 'flex-end',
    },
    approveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    approveBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: '#fff',
    },
});
