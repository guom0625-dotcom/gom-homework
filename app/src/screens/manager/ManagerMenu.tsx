import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { useAppStore, type OwnedReward } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'ManagerMenu'> };

// 매니저 관리 메뉴 — 자주 쓰지 않는 기능(초대 코드, 보상 카탈로그, 보상 사용 요청, 로그아웃)을 대시보드에서 한 단계 안으로
export function ManagerMenuScreen({ navigation }: Props) {
    const logout = useAuthStore(s => s.logout);
    const [codeLoading, setCodeLoading] = useState(false);
    const [pendingUse, setPendingUse] = useState(0);
    const { students, fetchStudents } = useAppStore();
    const [loginCodeFor, setLoginCodeFor] = useState<string | null>(null);

    useFocusEffect(useCallback(() => {
        api<OwnedReward[]>('/rewards?status=use_requested')
            .then(list => setPendingUse(list.length))
            .catch(() => {});
        fetchStudents().catch(() => {});
    }, []));

    // 로그아웃했거나 폰을 바꾼 학생이 원래 계정으로 다시 들어갈 코드
    const handleLoginCode = async (studentId: string, name: string) => {
        setLoginCodeFor(studentId);
        try {
            const res = await api<{ code: string }>(`/students/${studentId}/login-code`, { method: 'POST' });
            Alert.alert(
                `${name} 재로그인 코드`,
                `코드: ${res.code}\n\n${name}의 폰 첫 화면에서 "전에 쓰던 계정이 있어요"를 누르고 입력하세요.\n5분 안에 입력해야 해요. 예전 폰에서는 자동으로 로그아웃돼요.`,
                [{ text: '확인' }]
            );
        } catch {
            Alert.alert('오류', '코드 생성에 실패했어요');
        } finally {
            setLoginCodeFor(null);
        }
    };

    const handleGenerateCode = async () => {
        setCodeLoading(true);
        try {
            const res = await api<{ code: string; expires_in_seconds: number }>('/auth/pairing-code', {
                method: 'POST',
            });
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

    // 다시 로그인하려면 매니저 키를 입력해야 하므로 한 번 더 확인
    const handleLogout = () => {
        Alert.alert('로그아웃', '다시 로그인하려면 매니저 키가 필요해요. 로그아웃할까요?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: () => { logout(); } },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>관리</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.list}>
                <MenuItem
                    icon="🎁"
                    label="보상 카탈로그"
                    desc="상점에 올릴 보상 등록 · 수정"
                    onPress={() => navigation.navigate('Catalog')}
                />
                <MenuItem
                    icon="💎"
                    label="보상 사용 요청"
                    desc="학생이 쓰겠다고 한 보상을 해주고 사용 완료 처리"
                    badge={pendingUse}
                    onPress={() => navigation.navigate('RewardUse')}
                />
                <MenuItem
                    icon="🔗"
                    label="학생 초대 코드 생성"
                    desc="새 학생을 연결할 6자리 코드 (5분 유효)"
                    loading={codeLoading}
                    onPress={handleGenerateCode}
                />
                {students.map(st => (
                    <MenuItem
                        key={st.id}
                        icon="🔑"
                        label={`${st.name} 재로그인 코드`}
                        desc="로그아웃했거나 폰을 바꿨을 때 원래 계정으로 다시 들어가기"
                        loading={loginCodeFor === st.id}
                        onPress={() => handleLoginCode(st.id, st.name)}
                    />
                ))}

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>로그아웃</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

function MenuItem({ icon, label, desc, badge = 0, loading = false, onPress }: {
    icon: string;
    label: string;
    desc: string;
    badge?: number;
    loading?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.item} onPress={onPress} disabled={loading} activeOpacity={0.75}>
            <Text style={styles.itemIcon}>{icon}</Text>
            <View style={styles.itemBody}>
                <Text style={styles.itemLabel}>{label}</Text>
                <Text style={styles.itemDesc}>{desc}</Text>
            </View>
            {loading
                ? <ActivityIndicator color={colors.ocean[500]} />
                : badge > 0
                    ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
                    : <Text style={styles.chevron}>›</Text>
            }
        </TouchableOpacity>
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
    list: { padding: 16, gap: 10 },
    item: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        ...shadows.card,
    },
    itemIcon: { fontSize: 24 },
    itemBody: { flex: 1 },
    itemLabel: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    itemDesc: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 2,
    },
    chevron: { fontSize: 22, color: colors.ink[300], paddingHorizontal: 4 },
    logoutBtn: {
        marginTop: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    logoutText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.coral[700],
    },
    badge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        backgroundColor: colors.coral[500],
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.xs, color: '#fff' },
});
