import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import type { SpendRequest } from '../../store/appStore';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'SpendApproval'> };

type FilterTab = 'pending' | 'done';

function StatusBadge({ status }: { status: SpendRequest['status'] }) {
    const map = {
        pending: { label: '대기중', bg: colors.sky[100], text: colors.sky[700] },
        approved: { label: '승인됨', bg: colors.ocean[50], text: colors.ocean[700] },
        rejected: { label: '거절됨', bg: colors.paper2, text: colors.coral[500] },
    };
    const s = map[status];
    return (
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
        </View>
    );
}

export function SpendApprovalScreen({ navigation }: Props) {
    const [requests, setRequests] = useState<SpendRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<FilterTab>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const data = await api<SpendRequest[]>('/spend-requests');
        setRequests(data);
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load().catch(() => {});
        setRefreshing(false);
    }, [load]);

    const handleApprove = (req: SpendRequest) => {
        Alert.alert(
            '요청 승인',
            `"${req.catalog_title}" 요청을 승인할까요?\n${req.student_name ?? '학생'}의 보석이 차감됩니다.`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '승인',
                    onPress: async () => {
                        setProcessingId(req.id);
                        try {
                            await api(`/spend-requests/${req.id}/approve`, { method: 'POST' });
                            setRequests(prev =>
                                prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r)
                            );
                        } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : '오류';
                            Alert.alert('오류', msg === 'insufficient_gems' ? '보석이 부족해요' : msg);
                        } finally {
                            setProcessingId(null);
                        }
                    },
                },
            ],
        );
    };

    const handleReject = (req: SpendRequest) => {
        Alert.alert(
            '요청 거절',
            `"${req.catalog_title}" 요청을 거절할까요?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '거절',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingId(req.id);
                        try {
                            await api(`/spend-requests/${req.id}/reject`, { method: 'POST' });
                            setRequests(prev =>
                                prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r)
                            );
                        } catch (e: unknown) {
                            Alert.alert('오류', e instanceof Error ? e.message : '오류');
                        } finally {
                            setProcessingId(null);
                        }
                    },
                },
            ],
        );
    };

    const displayed = requests.filter(r =>
        tab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
    );

    const pendingCount = requests.filter(r => r.status === 'pending').length;

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
                <Text style={styles.title}>보상 요청</Text>
                <View style={{ width: 52 }} />
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'pending' && styles.tabActive]}
                    onPress={() => setTab('pending')}
                >
                    <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
                        대기중 {pendingCount > 0 ? `(${pendingCount})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === 'done' && styles.tabActive]}
                    onPress={() => setTab('done')}
                >
                    <Text style={[styles.tabText, tab === 'done' && styles.tabTextActive]}>처리됨</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={displayed}
                keyExtractor={r => r.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {tab === 'pending' ? '대기 중인 요청이 없어요' : '처리된 요청이 없어요'}
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardTop}>
                            <Text style={styles.studentName}>{item.student_name ?? '학생'}</Text>
                            <StatusBadge status={item.status} />
                        </View>
                        <Text style={styles.itemTitle}>{item.catalog_title}</Text>
                        <Text style={styles.dateText}>
                            {new Date(item.created_at).toLocaleDateString('ko-KR', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                        </Text>
                        {item.status === 'pending' && (
                            <View style={styles.actionRow}>
                                {processingId === item.id ? (
                                    <ActivityIndicator color={colors.ocean[500]} />
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            style={styles.rejectBtn}
                                            onPress={() => handleReject(item)}
                                        >
                                            <Text style={styles.rejectBtnText}>거절</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.approveBtn}
                                            onPress={() => handleApprove(item)}
                                        >
                                            <Text style={styles.approveBtnText}>승인</Text>
                                        </TouchableOpacity>
                                    </>
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
    badge: {
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    badgeText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
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
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        justifyContent: 'flex-end',
    },
    rejectBtn: {
        borderRadius: radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    rejectBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
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
