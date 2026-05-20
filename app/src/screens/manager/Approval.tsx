import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { useAppStore, type Task } from '../../store/appStore';
import { GEM_VALUES, type GemKey } from '../../lib/gems';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = {
    navigation: NativeStackNavigationProp<ManagerStackParams, 'Approval'>;
    route: RouteProp<ManagerStackParams, 'Approval'>;
};

const GEM_OPTIONS: { key: GemKey; amount: number; label: string }[] = [
    { key: 'topaz',    amount: 1,  label: '토파즈 ×1 (+1pt)' },
    { key: 'topaz',    amount: 3,  label: '토파즈 ×3 (+3pt)' },
    { key: 'emerald',  amount: 1,  label: '에메랄드 ×1 (+5pt)' },
    { key: 'sapphire', amount: 1,  label: '사파이어 ×1 (+3pt)' },
    { key: 'ruby',     amount: 1,  label: '루비 ×1 (+10pt)' },
    { key: 'amethyst', amount: 1,  label: '자수정 ×1 (+25pt)' },
];

export function ApprovalScreen({ navigation, route }: Props) {
    const { studentId, studentName } = route.params;
    const { selectedStudentTasks, fetchStudentTasks, approveTask, rejectTask } = useAppStore();
    const [refreshing, setRefreshing] = useState(false);
    const [approveTarget, setApproveTarget] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const submittedTasks = selectedStudentTasks.filter(t => t.status === 'submitted');
    const otherTasks = selectedStudentTasks.filter(t => t.status !== 'submitted');

    useEffect(() => {
        fetchStudentTasks(studentId);
    }, [studentId]);

    const refresh = async () => {
        setRefreshing(true);
        await fetchStudentTasks(studentId).catch(() => {});
        setRefreshing(false);
    };

    const handleApprove = async (gemKey: GemKey, gemAmount: number) => {
        if (!approveTarget) return;
        setLoadingId(approveTarget);
        setApproveTarget(null);
        try {
            await approveTask(approveTarget, gemKey, gemAmount);
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '승인 실패');
        } finally {
            setLoadingId(null);
        }
    };

    const handleReject = (id: string) => {
        Alert.alert('반려', '이 할일을 반려할까요?', [
            { text: '취소', style: 'cancel' },
            {
                text: '반려', style: 'destructive',
                onPress: async () => {
                    setLoadingId(id);
                    try { await rejectTask(id); }
                    catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : '반려 실패'); }
                    finally { setLoadingId(null); }
                },
            },
        ]);
    };

    const allTasks = [...submittedTasks, ...otherTasks];

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{studentName}의 할일</Text>
                <View style={{ width: 36 }} />
            </View>

            {submittedTasks.length > 0 && (
                <View style={styles.pendingBanner}>
                    <Text style={styles.pendingText}>
                        📋 검토 대기 {submittedTasks.length}개
                    </Text>
                </View>
            )}

            <FlatList
                data={allTasks}
                keyExtractor={t => t.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>할일이 없어요</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TaskCard
                        task={item}
                        isLoading={loadingId === item.id}
                        onApprove={() => setApproveTarget(item.id)}
                        onReject={() => handleReject(item.id)}
                    />
                )}
            />

            {/* 보석 선택 모달 */}
            <Modal
                visible={approveTarget !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setApproveTarget(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>보상 보석 선택</Text>
                        {GEM_OPTIONS.map((opt, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.gemOption}
                                onPress={() => handleApprove(opt.key, opt.amount)}
                            >
                                <Text style={styles.gemOptionText}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setApproveTarget(null)}
                        >
                            <Text style={styles.cancelText}>취소</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function TaskCard({ task, isLoading, onApprove, onReject }: {
    task: Task;
    isLoading: boolean;
    onApprove: () => void;
    onReject: () => void;
}) {
    const isSubmitted = task.status === 'submitted';
    return (
        <View style={[styles.taskCard, isSubmitted && styles.taskCardPending]}>
            <View style={styles.taskInfo}>
                <View style={styles.taskDayBadge}>
                    <Text style={styles.taskDayText}>Day {task.day}</Text>
                </View>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.memo ? <Text style={styles.taskMemo}>{task.memo}</Text> : null}
                {task.gem_type && task.gem_amount ? (
                    <Text style={styles.rewardText}>
                        💎 {task.gem_type} ×{task.gem_amount}
                    </Text>
                ) : null}
            </View>
            {isSubmitted && (
                isLoading
                    ? <ActivityIndicator color={colors.ocean[500]} />
                    : (
                        <View style={styles.taskActions}>
                            <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
                                <Text style={styles.approveBtnText}>✅ 승인</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
                                <Text style={styles.rejectBtnText}>❌ 반려</Text>
                            </TouchableOpacity>
                        </View>
                    )
            )}
            {!isSubmitted && (
                <Text style={[styles.statusText, {
                    color: task.status === 'approved' ? colors.ocean[500]
                        : task.status === 'rejected' ? colors.coral[500]
                        : colors.ink[300]
                }]}>
                    {task.status === 'approved' ? '✅' : task.status === 'rejected' ? '❌' : '—'}
                </Text>
            )}
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
    pendingBanner: {
        backgroundColor: colors.sun[300],
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    pendingText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[900],
    },
    list: { padding: 14, gap: 10 },
    empty: { paddingTop: 80, alignItems: 'center' },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
    },
    taskCard: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...shadows.card,
    },
    taskCardPending: {
        borderLeftWidth: 3,
        borderLeftColor: colors.sun[500],
    },
    taskInfo: { flex: 1 },
    taskDayBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.sky[100],
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginBottom: 4,
    },
    taskDayText: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.xs,
        color: colors.sky[700],
    },
    taskTitle: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    taskMemo: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 2,
    },
    rewardText: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.sm,
        color: colors.grape[700],
        marginTop: 4,
    },
    taskActions: { gap: 6 },
    approveBtn: {
        backgroundColor: colors.ocean[50],
        borderRadius: radius.md,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    approveBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.ocean[700],
    },
    rejectBtn: {
        backgroundColor: colors.coral[300] + '33',
        borderRadius: radius.md,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    rejectBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.coral[700],
    },
    statusText: { fontSize: 18 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: colors.card,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        padding: 24,
        paddingBottom: 40,
        gap: 10,
    },
    modalTitle: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
        marginBottom: 4,
    },
    gemOption: {
        backgroundColor: colors.paper2,
        borderRadius: radius.md,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    gemOptionText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        textAlign: 'center',
    },
    cancelBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    cancelText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
    },
});
