import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, Image, StyleSheet, TouchableOpacity, TextInput, Modal,
    ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAppStore, type Book } from '../../store/appStore';
import { WEEK_MS } from '../../lib/days';
import { errorMessage } from '../../lib/errors';
import { Gem } from '../../components/Gem';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'Books'> };

const STATUS_LABEL: Record<Book['status'], string> = {
    reading: '📖 읽는 중',
    done_requested: '⏳ 완료 확인중',
    done: '✅ 다 읽었어요',
};

// 책읽기: 언제든 등록 → 다 읽으면 읽은 내용을 적어 완료 요청 → 매니저가 승인하면 루비 1개
export function BooksScreen({ navigation }: Props) {
    const { books, booksSince, booksOlderDoneAt, fetchBooks, finishBook, deleteBook, fetchMe } = useAppStore();
    const [refreshing, setRefreshing] = useState(false);
    const [finishing, setFinishing] = useState<Book | null>(null);
    const [summary, setSummary] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => Promise.all([
        fetchBooks().catch(() => {}),
        fetchMe().catch(() => {}),
    ]), []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const openFinish = (book: Book) => {
        setSummary(book.summary ?? '');
        setFinishing(book);
    };

    const handleFinish = async () => {
        if (!finishing) return;
        if (!summary.trim()) { Alert.alert('읽은 내용을 적어주세요'); return; }
        setSaving(true);
        try {
            await finishBook(finishing.id, summary.trim());
            setFinishing(null);
        } catch (e: unknown) {
            Alert.alert('오류', errorMessage(e, '요청 실패'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (book: Book) => {
        Alert.alert('책 삭제', `"${book.title}"을(를) 목록에서 지울까요?`, [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제', style: 'destructive',
                onPress: () => deleteBook(book.id).catch((e: unknown) =>
                    Alert.alert('오류', errorMessage(e, '삭제 실패'))
                ),
            },
        ]);
    };

    // 완료한 책은 최근 1주일치만 — 더 보기로 1주일씩 넓힌다
    const showOlderWeek = () => {
        if (booksOlderDoneAt == null) return;
        fetchBooks(Math.min(booksSince - WEEK_MS, booksOlderDoneAt)).catch(() => {});
    };

    // 읽는 중 → 확인중 → 완료 순서
    const order: Record<Book['status'], number> = { reading: 0, done_requested: 1, done: 2 };
    const sorted = [...books].sort((a, b) => order[a.status] - order[b.status] || b.created_at - a.created_at);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>책읽기</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('BookRegister')}>
                    <Text style={styles.addBtnText}>+ 책 등록</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.infoBar}>
                <Gem size={14} kind="ruby" />
                <Text style={styles.infoText}>책을 다 읽고 승인받으면 루비 1개를 받아요</Text>
            </View>

            <TouchableOpacity style={styles.shelfBtn} onPress={() => navigation.navigate('BookShelf')}>
                <Text style={styles.shelfBtnText}>📚 내 책장 보기</Text>
            </TouchableOpacity>

            <FlatList
                data={sorted}
                keyExtractor={b => b.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            읽고 있는 책이 없어요{'\n'}+ 책 등록을 눌러 읽을 책을 올려봐요
                        </Text>
                    </View>
                }
                ListFooterComponent={booksOlderDoneAt != null ? (
                    <TouchableOpacity style={styles.moreBtn} onPress={showOlderWeek}>
                        <Text style={styles.moreBtnText}>이전에 읽은 책 1주일 더 보기</Text>
                    </TouchableOpacity>
                ) : null}
                renderItem={({ item }) => (
                    <View style={[styles.card, item.status === 'done' && styles.cardDone]}>
                        <Image source={{ uri: item.photo }} style={styles.photo} />
                        <View style={styles.cardBody}>
                            <Text style={styles.bookTitle}>{item.title}</Text>
                            <Text style={styles.status}>{STATUS_LABEL[item.status]}</Text>
                            {item.praise ? <Text style={styles.praise}>💬 {item.praise}</Text> : null}
                            {item.summary && item.status !== 'reading' ? (
                                <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
                            ) : null}
                            {item.status === 'reading' && (
                                <View style={styles.actions}>
                                    <TouchableOpacity style={styles.finishBtn} onPress={() => openFinish(item)}>
                                        <Text style={styles.finishBtnText}>다 읽었어요</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(item)}>
                                        <Text style={styles.deleteBtn}>🗑</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            />

            {/* 완료 요청 — 읽은 내용 적기 */}
            <Modal visible={finishing != null} transparent animationType="slide" onRequestClose={() => setFinishing(null)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{finishing?.title}</Text>
                        <Text style={styles.modalLabel}>어떤 내용이었는지 간단히 적어주세요</Text>
                        <TextInput
                            style={styles.summaryInput}
                            value={summary}
                            onChangeText={setSummary}
                            placeholder="예: 어린 왕자가 여러 별을 여행하며 친구를 만나는 이야기"
                            placeholderTextColor={colors.ink[300]}
                            multiline
                            maxLength={1000}
                            textAlignVertical="top"
                            autoFocus
                        />
                        <TouchableOpacity
                            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                            onPress={handleFinish}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.submitBtnText}>완료 요청 보내기</Text>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setFinishing(null)}>
                            <Text style={styles.cancelText}>취소</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    addBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    addBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sm, color: '#fff' },
    infoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        backgroundColor: '#fff1f4',
    },
    shelfBtn: {
        marginHorizontal: 14,
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: '#f3e7d6',
    },
    shelfBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: '#7a5230' },
    infoText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: '#c4304f' },
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
        padding: 12,
        flexDirection: 'row',
        gap: 12,
        ...shadows.card,
    },
    cardDone: { opacity: 0.6 },
    photo: {
        width: 72,
        height: 96,
        borderRadius: radius.sm,
        backgroundColor: colors.ink[100],
    },
    cardBody: { flex: 1, gap: 4 },
    bookTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: colors.ink[900] },
    status: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[500] },
    praise: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ocean[700] },
    summary: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[700], lineHeight: 19 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
    finishBtn: {
        backgroundColor: '#ff5a7a',
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    finishBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sm, color: '#fff' },
    deleteBtn: { fontSize: 18 },
    moreBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.ink[200],
        marginTop: 4,
    },
    moreBtnText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[500] },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: colors.paper,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        padding: 20,
        paddingBottom: 32,
        gap: 10,
    },
    modalTitle: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    modalLabel: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[500] },
    summaryInput: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 12,
        minHeight: 120,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    submitBtn: {
        backgroundColor: '#ff5a7a',
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: '#fff' },
    cancelBtn: { paddingVertical: 8, alignItems: 'center' },
    cancelText: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ink[300] },
});
