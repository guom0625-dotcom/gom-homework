import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { Character } from '../../components/Character';
import { useAppStore, type OwnedReward } from '../../store/appStore';
import { api } from '../../api/client';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'Dashboard'> };

export function DashboardScreen({ navigation }: Props) {
    const { user } = useAuthStore();
    const { students, fetchStudents } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingUse, setPendingUse] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [nudgingId, setNudgingId] = useState<string | null>(null);

    useEffect(() => {
        fetchStudents().finally(() => setLoading(false));
    }, []);

    // 관리 메뉴 안에 있는 보상 사용 요청을 놓치지 않도록 대기 건수를 버튼에 표시
    const fetchPendingUse = useCallback(() =>
        api<OwnedReward[]>('/rewards?status=use_requested')
            .then(list => setPendingUse(list.length))
            .catch(() => {}), []);

    useFocusEffect(useCallback(() => {
        fetchStudents().catch(() => {});
        fetchPendingUse();
    }, []));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchStudents().catch(() => {}), fetchPendingUse()]);
        setRefreshing(false);
    }, []);

    // 오늘 할일을 아직 등록하지 않은 학생에게 등록하라고 알림 보내기
    const handleNudge = async (id: string, name: string) => {
        setNudgingId(id);
        try {
            const res = await api<{ delivered: boolean }>(`/students/${id}/nudge`, { method: 'POST' });
            Alert.alert(
                res.delivered ? '알림을 보냈어요' : '알림을 보내지 못했어요',
                res.delivered
                    ? `${name}에게 할일을 등록하라고 알렸어요`
                    : `${name}의 폰에 알림이 아직 설정되지 않았어요`,
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '';
            if (msg === 'already_registered') await fetchStudents().catch(() => {});
            Alert.alert('오류', msg === 'already_registered' ? '이미 할일을 등록했어요' : '알림 전송에 실패했어요');
        } finally {
            setNudgingId(null);
        }
    };

    // 관리 메뉴 안에서 처리할 것: 보상 사용 요청 + 책 완료 요청
    const menuBadge = pendingUse + students.reduce((sum, s) => sum + s.pending_books, 0);

    const handleRename = async (id: string) => {
        const name = editingName.trim();
        if (!name) { Alert.alert('이름을 입력해주세요'); return; }
        try {
            await api(`/students/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name }),
            });
            await fetchStudents();
            setEditingId(null);
        } catch {
            Alert.alert('오류', '이름 변경에 실패했어요');
        }
    };

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
                <View>
                    <Text style={styles.greeting}>안녕하세요 👋</Text>
                    <Text style={styles.managerName}>{user?.name}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ManagerMenu')} style={styles.menuBtn}>
                    <Text style={styles.menuText}>⚙️ 관리</Text>
                    {menuBadge > 0 && (
                        <View style={styles.menuBadge}>
                            <Text style={styles.menuBadgeText}>{menuBadge}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <FlatList
                data={students}
                keyExtractor={s => s.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            연결된 학생이 없어요{'\n'}관리 메뉴에서 초대 코드를 생성해 학생과 연결해보세요
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.studentCard}>
                        <TouchableOpacity
                            style={styles.studentAvatar}
                            onPress={() => {
                                setEditingId(item.id);
                                setEditingName(item.name);
                            }}
                        >
                            <Character type={item.character} size={44} mood="happy" photoUrl={item.avatar ?? undefined} />
                        </TouchableOpacity>
                        <View style={styles.studentInfo}>
                            {editingId === item.id ? (
                                <View style={styles.editRow}>
                                    <TextInput
                                        style={styles.nameInput}
                                        value={editingName}
                                        onChangeText={setEditingName}
                                        autoFocus
                                        maxLength={20}
                                        onSubmitEditing={() => handleRename(item.id)}
                                    />
                                    <TouchableOpacity onPress={() => handleRename(item.id)} style={styles.saveBtn}>
                                        <Text style={styles.saveBtnText}>저장</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setEditingId(null)} style={styles.cancelBtn}>
                                        <Text style={styles.cancelBtnText}>취소</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.studentName}>{item.name}</Text>
                                    <Text style={styles.studentPoints}>
                                        💎 {item.diamonds.toLocaleString()} · ♦️ {item.rubies.toLocaleString()}
                                        {item.pending_review > 0 ? ` · ⏳ 검토 대기 ${item.pending_review}개` : ''}
                                        {item.pending_books > 0 ? ` · 📚 책 완료 요청 ${item.pending_books}권` : ''}
                                    </Text>
                                    {item.today_total === 0 && (
                                        <View style={styles.nudgeRow}>
                                            <Text style={styles.nudgeText}>오늘 할일 미등록</Text>
                                            <TouchableOpacity
                                                style={styles.nudgeBtn}
                                                onPress={() => handleNudge(item.id, item.name)}
                                                disabled={nudgingId === item.id}
                                            >
                                                {nudgingId === item.id
                                                    ? <ActivityIndicator size="small" color={colors.coral[700]} />
                                                    : <Text style={styles.nudgeBtnText}>📣 등록 알림</Text>
                                                }
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                        {editingId !== item.id && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Approval', {
                                    studentId: item.id,
                                    studentName: item.name,
                                })}
                            >
                                <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    greeting: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
    managerName: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['3xl'],
        color: colors.ink[900],
    },
    menuBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        borderRadius: radius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    menuText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[700],
    },
    menuBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        backgroundColor: colors.coral[500],
        alignItems: 'center',
        justifyContent: 'center',
    },
    // 안드로이드 글꼴 위아래 여백을 없애야 숫자가 원 가운데에 온다
    menuBadgeText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: 10,
        lineHeight: 12,
        color: '#fff',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    list: { padding: 16, gap: 10 },
    empty: { paddingTop: 60, alignItems: 'center' },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 24,
    },
    studentCard: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...shadows.card,
    },
    studentAvatar: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    studentInfo: { flex: 1 },
    studentName: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    studentPoints: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 2,
    },
    nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    nudgeText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.coral[700],
    },
    nudgeBtn: {
        backgroundColor: '#ffe9e4',
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        minWidth: 84,
        alignItems: 'center',
    },
    nudgeBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.xs,
        color: colors.coral[700],
    },
    chevron: {
        fontSize: 22,
        color: colors.ink[300],
        paddingHorizontal: 4,
    },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    nameInput: {
        flex: 1,
        borderBottomWidth: 1.5,
        borderBottomColor: colors.ocean[500],
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        paddingVertical: 2,
    },
    saveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    saveBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.xs, color: '#fff' },
    cancelBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    cancelBtnText: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.ink[300] },
});
