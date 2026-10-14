import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, Alert, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { colors, fontFamilies, fontSizes, radius } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'BookShelf'> };

interface ShelfBook {
    id: string;
    title: string;
    cover: string;          // 작은 표지 (data URL)
    summary: string | null;
    praise: string | null;
    done_at: number;
}

const PER_ROW = 3;
const KST_OFFSET_MS = 9 * 3_600_000;

/** done_at(ms) → KST 기준 [연, 월] */
function ym(ts: number): [number, number] {
    const d = new Date(ts + KST_OFFSET_MS);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1];
}

// 다 읽은 책을 책장에 꽂힌 모습으로 모아 본다
export function BookShelfScreen({ navigation }: Props) {
    const { width } = useWindowDimensions();
    const [books, setBooks] = useState<ShelfBook[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(() => api<ShelfBook[]>('/books/shelf').then(setBooks), []);

    useFocusEffect(useCallback(() => { load().catch(() => setBooks([])); }, [load]));

    const refresh = async () => {
        setRefreshing(true);
        await load().catch(() => {});
        setRefreshing(false);
    };

    const [nowY, nowM] = ym(Date.now());
    const list = books ?? [];
    const thisYear = list.filter(b => ym(b.done_at)[0] === nowY).length;
    const thisMonth = list.filter(b => { const [y, m] = ym(b.done_at); return y === nowY && m === nowM; }).length;

    const rows: ShelfBook[][] = [];
    for (let i = 0; i < list.length; i += PER_ROW) rows.push(list.slice(i, i + PER_ROW));

    const coverW = Math.floor((width - 32 - (PER_ROW - 1) * 14) / PER_ROW);
    const coverH = Math.round(coverW * 1.35);

    const showBook = (b: ShelfBook) => {
        const [y, m] = ym(b.done_at);
        Alert.alert(
            b.title,
            [
                `${y}년 ${m}월에 다 읽었어요`,
                b.summary ? `\n${b.summary}` : '',
                b.praise ? `\n💬 ${b.praise}` : '',
            ].join(''),
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>내 책장</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.stats}>
                <Stat label="이번 달" value={thisMonth} />
                <Stat label="올해" value={thisYear} />
                <Stat label="전체" value={list.length} />
            </View>

            <ScrollView
                contentContainerStyle={styles.shelf}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
            >
                {books != null && list.length === 0 && (
                    <Text style={styles.empty}>아직 책장이 비어 있어요{'\n'}책을 다 읽고 승인받으면 여기에 꽂혀요 📚</Text>
                )}
                {rows.map((row, i) => (
                    <View key={i} style={styles.rowWrap}>
                        <View style={styles.row}>
                            {row.map(b => (
                                <TouchableOpacity key={b.id} activeOpacity={0.8} onPress={() => showBook(b)} style={{ width: coverW }}>
                                    <Image source={{ uri: b.cover }} style={[styles.cover, { width: coverW, height: coverH }]} />
                                    <Text style={styles.coverTitle} numberOfLines={1}>{b.title}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {/* 선반 */}
                        <View style={styles.plank} />
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>{value}<Text style={styles.statUnit}>권</Text></Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fbf3e6' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
    },
    backBtn: { padding: 4, width: 36 },
    backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: '#5b3a1e',
        textAlign: 'center',
    },
    stats: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: radius.md,
        backgroundColor: '#fff',
        paddingVertical: 12,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontFamily: fontFamilies.display, fontSize: fontSizes['2xl'], color: '#7a5230' },
    statUnit: { fontSize: fontSizes.sm },
    statLabel: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.ink[500] },
    shelf: { padding: 16, gap: 18 },
    empty: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 24,
        paddingTop: 60,
    },
    rowWrap: {},
    row: { flexDirection: 'row', gap: 14, paddingHorizontal: 2 },
    cover: {
        borderRadius: 4,
        backgroundColor: colors.ink[100],
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    coverTitle: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: '#5b3a1e',
        marginTop: 4,
        textAlign: 'center',
    },
    plank: {
        height: 10,
        marginTop: 6,
        borderRadius: 3,
        backgroundColor: '#b07a4a',
        borderBottomWidth: 4,
        borderBottomColor: '#8a5a33',
    },
});
