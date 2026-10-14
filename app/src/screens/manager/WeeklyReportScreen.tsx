import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { addDays, formatDay, todayKST } from '../../lib/days';
import { Gem } from '../../components/Gem';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'WeeklyReport'> };

interface StudentWeek {
    id: string;
    name: string;
    days_with_tasks: number;
    days_done: number;
    diamonds: number;
    rubies: number;
    books_done: number;
    streak: number;
}

interface Report { week_start: number; week_end: number; students: StudentWeek[] }

// 월~일 한 주 동안 학생별 요약. 매주 일요일 저녁 8시에 같은 내용이 알림으로도 온다
export function WeeklyReportScreen({ navigation }: Props) {
    const [weekOf, setWeekOf] = useState(todayKST());
    const [report, setReport] = useState<Report | null>(null);

    const load = useCallback(() => {
        setReport(null);
        api<Report>(`/report/weekly?week_start=${weekOf}`).then(setReport).catch(() => {});
    }, [weekOf]);

    useEffect(load, [load]);

    const isThisWeek = report != null && report.week_end >= todayKST();

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>주간 리포트</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.weekNav}>
                <TouchableOpacity style={styles.navBtn} onPress={() => setWeekOf(addDays(report?.week_start ?? weekOf, -7))}>
                    <Text style={styles.navText}>‹ 지난주</Text>
                </TouchableOpacity>
                <Text style={styles.weekText}>
                    {report ? `${formatDay(report.week_start)} ~ ${formatDay(report.week_end)}` : ''}
                </Text>
                <TouchableOpacity
                    style={[styles.navBtn, isThisWeek && { opacity: 0.3 }]}
                    disabled={isThisWeek}
                    onPress={() => setWeekOf(addDays(report?.week_start ?? weekOf, 7))}
                >
                    <Text style={styles.navText}>다음주 ›</Text>
                </TouchableOpacity>
            </View>

            {report == null ? (
                <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.ocean[500]} />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    {report.students.length === 0 && <Text style={styles.empty}>연결된 학생이 없어요</Text>}
                    {report.students.map(s => (
                        <View key={s.id} style={styles.card}>
                            <View style={styles.cardTop}>
                                <Text style={styles.name}>{s.name}</Text>
                                <Text style={styles.streak}>🔥 {s.streak}일 연속</Text>
                            </View>
                            <Row label="할일 다 끝낸 날" value={`${s.days_done} / 7일`} sub={`등록한 날 ${s.days_with_tasks}일`} />
                            <Row label="받은 다이아" icon={<Gem size={14} />} value={String(s.diamonds)} />
                            <Row label="다 읽은 책" value={`${s.books_done}권`} />
                            <Row label="받은 루비" icon={<Gem size={14} kind="ruby" />} value={String(s.rubies)} />
                        </View>
                    ))}
                    <Text style={styles.note}>매주 일요일 저녁 8시에 이번 주 리포트가 알림으로 와요</Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function Row({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <View style={styles.rowRight}>
                <View style={styles.rowValueLine}>
                    {icon}
                    <Text style={styles.rowValue}>{value}</Text>
                </View>
                {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
            </View>
        </View>
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
    weekNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
    navBtn: { paddingHorizontal: 8, paddingVertical: 6 },
    navText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ocean[700] },
    weekText: {
        flex: 1,
        textAlign: 'center',
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    list: { padding: 16, gap: 12 },
    empty: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ink[300], textAlign: 'center', paddingTop: 40 },
    card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 10, ...shadows.card },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontFamily: fontFamilies.display, fontSize: fontSizes.xl, color: colors.ink[900] },
    streak: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.coral[700] },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ink[500] },
    rowRight: { alignItems: 'flex-end' },
    rowValueLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowValue: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: colors.ink[900] },
    rowSub: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.ink[300] },
    note: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.ink[300], textAlign: 'center', marginTop: 4 },
});
