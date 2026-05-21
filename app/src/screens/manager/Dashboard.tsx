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
import { useAppStore, type StudentSummary } from '../../store/appStore';
import { api } from '../../api/client';
import { gemsToPoints } from '../../lib/gems';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'Dashboard'> };

export function DashboardScreen({ navigation }: Props) {
    const { user, logout } = useAuthStore();
    const { students, fetchStudents } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [codeLoading, setCodeLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    useEffect(() => {
        fetchStudents().finally(() => setLoading(false));
    }, []);

    useFocusEffect(useCallback(() => {
        fetchStudents().catch(() => {});
    }, []));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await fetchStudents().catch(() => {});
        setRefreshing(false);
    }, []);

    const handleGenerateCode = async () => {
        setCodeLoading(true);
        try {
            const res = await api<{ code: string; expires_in_seconds: number }>('/auth/pairing-code', {
                method: 'POST',
            });
            setPairingCode(res.code);
            Alert.alert(
                '페어링 코드',
                `코드: ${res.code}\n\n학생에게 이 코드를 알려주세요.\n5분 안에 입력해야 해요.`,
                [{ text: '확인' }]
            );
        } catch {
            Alert.alert('오류', '코드 생성에 실패했어요');
        } finally {
            setCodeLoading(false);
        }
    };

    const points = (s: StudentSummary) =>
        gemsToPoints({ topaz: s.topaz, emerald: s.emerald, sapphire: s.sapphire, ruby: s.ruby, amethyst: s.amethyst });

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
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>안녕하세요 👋</Text>
                    <Text style={styles.managerName}>{user?.name} 매니저</Text>
                </View>
                <TouchableOpacity onPress={() => { logout(); }} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>로그아웃</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={students}
                keyExtractor={s => s.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListHeaderComponent={
                    <View style={styles.headerBtns}>
                        <TouchableOpacity
                            style={[styles.codeBtn, codeLoading && { opacity: 0.6 }]}
                            onPress={handleGenerateCode}
                            disabled={codeLoading}
                        >
                            {codeLoading
                                ? <ActivityIndicator color={colors.ocean[700]} />
                                : <Text style={styles.codeBtnText}>🔗 학생 초대 코드 생성</Text>
                            }
                        </TouchableOpacity>
                        <View style={styles.mgmtRow}>
                            <TouchableOpacity
                                style={styles.mgmtBtn}
                                onPress={() => navigation.navigate('Catalog')}
                            >
                                <Text style={styles.mgmtBtnText}>🎁 보상 카탈로그</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.mgmtBtn}
                                onPress={() => navigation.navigate('SpendApproval')}
                            >
                                <Text style={styles.mgmtBtnText}>💎 보상 요청</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            연결된 학생이 없어요{'\n'}초대 코드를 생성해서 학생과 연결해보세요
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
                            <Text style={styles.avatarText}>{item.name[0]}</Text>
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
                                        💎 {points(item).toLocaleString()} pt
                                    </Text>
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
    logoutBtn: {
        padding: 8,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    logoutText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
    list: { padding: 16, gap: 10 },
    headerBtns: { gap: 8, marginBottom: 8 },
    codeBtn: {
        backgroundColor: colors.sky[100],
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.sky[300],
        borderStyle: 'dashed',
    },
    codeBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.sky[700],
    },
    mgmtRow: { flexDirection: 'row', gap: 8 },
    mgmtBtn: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        ...shadows.card,
    },
    mgmtBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[700],
    },
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
        borderRadius: 22,
        backgroundColor: colors.ocean[100],
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes.xl,
        color: colors.ocean[700],
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
