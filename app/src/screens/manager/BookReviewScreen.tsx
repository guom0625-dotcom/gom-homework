import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, Image, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import type { Book } from '../../store/appStore';
import { WEEK_MS } from '../../lib/days';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'BookReview'> };

type FilterTab = 'requested' | 'reading' | 'done';

const TAB_LABEL: Record<FilterTab, string> = { requested: '완료 요청', reading: '읽는 중', done: '완료' };
const TAB_STATUS: Record<FilterTab, Book['status']> = { requested: 'done_requested', reading: 'reading', done: 'done' };
const EMPTY_TEXT: Record<FilterTab, string> = {
    requested: '완료 요청이 없어요',
    reading: '읽고 있는 책이 없어요',
    done: '다 읽은 책이 없어요',
};

function formatTime(ts: number | null): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

// 학생들의 책읽기. 완료 요청이 오면 읽은 내용을 보고 승인(루비 1개 지급) 또는 반려한다
export function BookReviewScreen({ navigation }: Props) {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<FilterTab>('requested');
    const [processingId, setProcessingId] = useState<string | null>(null);
    // 완료한 책은 최근 1주일치만 받고, "더 보기"로 1주일씩 넓힌다
    const [doneSince, setDoneSince] = useState(() => Date.now() - WEEK_MS);
    const [olderDoneAt, setOlderDoneAt] = useState<number | null>(null);

    const load = useCallback(async () => {
        const res = await api<{ books: Book[]; older_done_at: number | null }>(`/books?done_since=${doneSince}`);
        setBooks(res.books);
        setOlderDoneAt(res.older_done_at);
    }, [doneSince]);

    useEffect(() => {
        load().catch(() => {}).finally(() => setLoading(false));
    }, [load]);

    useFocusEffect(useCallback(() => {
        load().catch(() => {});
    }, [load]));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load().catch(() => {});
        setRefreshing(false);
    }, [load]);

    const showOlderWeek = () => {
        if (olderDoneAt == null) return;
        setDoneSince(Math.min(doneSince - WEEK_MS, olderDoneAt));
    };

    const review = async (book: Book, action: 'approve' | 'reject') => {
        setProcessingId(book.id);
        try {
            await api(`/books/${book.id}/${action}`, { method: 'POST' });
            setBooks(prev => prev.map(b => b.id === book.id
                ? { ...b, status: action === 'approve' ? 'done' : 'reading', done_at: action === 'approve' ? Date.now() : null }
                : b));
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '오류');
            load().catch(() => {});
        } finally {
            setProcessingId(null);
        }
    };

    const handleApprove = (book: Book) => {
        Alert.alert('완료 승인', `"${book.title}" 완료를 승인할까요?\n${book.student_name ?? '학생'}에게 루비 1개가 지급돼요.`, [
            { text: '취소', style: 'cancel' },
            { text: '승인', onPress: () => { review(book, 'approve'); } },
        ]);
    };

    const handleReject = (book: Book) => {
        Alert.alert('반려', `"${book.title}" 완료 요청을 반려할까요?\n다시 읽는 중으로 돌아가요.`, [
            { text: '취소', style: 'cancel' },
            { text: '반려', style: 'destructive', onPress: () => { review(book, 'reject'); } },
        ]);
    };

    const displayed = books.filter(b => b.status === TAB_STATUS[tab]);
    const requestedCount = books.filter(b => b.status === 'done_requested').length;

    if (loading) {
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
                <Text style={styles.title}>책읽기</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.tabs}>
                {(['requested', 'reading', 'done'] as const).map(t => (
                    <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                            {TAB_LABEL[t]}{t === 'requested' && requestedCount > 0 ? ` (${requestedCount})` : ''}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={displayed}
                keyExtractor={b => b.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {tab === 'done' && olderDoneAt != null ? '최근 1주일 동안 다 읽은 책이 없어요' : EMPTY_TEXT[tab]}
                        </Text>
                    </View>
                }
                ListFooterComponent={tab === 'done' && olderDoneAt != null ? (
                    <TouchableOpacity style={styles.moreBtn} onPress={showOlderWeek}>
                        <Text style={styles.moreBtnText}>이전 1주일 더 보기</Text>
                    </TouchableOpacity>
                ) : null}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <Image source={{ uri: item.photo }} style={styles.photo} />
                            <View style={styles.cardBody}>
                                <Text style={styles.studentName}>{item.student_name ?? '학생'}</Text>
                                <Text style={styles.bookTitle}>{item.title}</Text>
                                <Text style={styles.dateText}>
                                    {item.status === 'done' ? `완료 ${formatTime(item.done_at)}`
                                        : item.status === 'done_requested' ? `완료 요청 ${formatTime(item.requested_at)}`
                                        : `등록 ${formatTime(item.created_at)}`}
                                </Text>
                            </View>
                        </View>
                        {item.summary && item.status !== 'reading' ? (
                            <View style={styles.summaryBox}>
                                <Text style={styles.summaryLabel}>읽은 내용</Text>
                                <Text style={styles.summary}>{item.summary}</Text>
                            </View>
                        ) : null}
                        {item.status === 'done_requested' && (
                            <View style={styles.actionRow}>
                                {processingId === item.id ? (
                                    <ActivityIndicator color={colors.ocean[500]} />
                                ) : (
                                    <>
                                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                                            <Text style={styles.rejectBtnText}>반려</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                                            <Text style={styles.approveBtnText}>완료 승인</Text>
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
    backBtn: { padding: 4, width: 36 },
    backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.ink[100] },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.ocean[500] },
    tabText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.base, color: colors.ink[300] },
    tabTextActive: { color: colors.ocean[700] },
    list: { padding: 14, gap: 10 },
    empty: { paddingTop: 80, alignItems: 'center' },
    emptyText: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ink[300] },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 12,
        gap: 10,
        ...shadows.card,
    },
    cardRow: { flexDirection: 'row', gap: 12 },
    photo: { width: 66, height: 88, borderRadius: radius.sm, backgroundColor: colors.ink[100] },
    cardBody: { flex: 1, gap: 3 },
    studentName: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sm, color: colors.ink[700] },
    bookTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: colors.ink[900] },
    dateText: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.ink[300] },
    summaryBox: { backgroundColor: colors.paper2, borderRadius: radius.sm, padding: 10, gap: 4 },
    summaryLabel: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.xs, color: colors.ink[500] },
    summary: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[900], lineHeight: 20 },
    actionRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    rejectBtn: {
        borderRadius: radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    rejectBtnText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[500] },
    approveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    approveBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sm, color: '#fff' },
    moreBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.ink[200],
        marginTop: 4,
    },
    moreBtnText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[500] },
});
