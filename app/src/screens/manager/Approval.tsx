import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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

type DayGroup = {
    day: number;
    tasks: Task[];
    pendingCount: number;
    allDone: boolean;
};

function isPending(t: Task) {
    return t.status === 'plan_submitted' || t.status === 'submitted';
}

export function ApprovalScreen({ navigation, route }: Props) {
    const { studentId, studentName } = route.params;
    const { selectedStudentTasks, fetchStudentTasks, approveTask, rejectTask, approvePlan, rejectPlan } = useAppStore();
    const [refreshing, setRefreshing] = useState(false);
    const [approveTarget, setApproveTarget] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchStudentTasks(studentId);
    }, [studentId]);

    useFocusEffect(useCallback(() => {
        fetchStudentTasks(studentId).catch(() => {});
    }, [studentId]));

    // 검토 대기 있는 day는 자동 펼침, 수동 펼침도 유지
    useEffect(() => {
        setExpandedDays(prev => {
            const allDays = new Set(selectedStudentTasks.map(t => t.day));
            const next = new Set<number>();
            selectedStudentTasks.forEach(t => { if (isPending(t)) next.add(t.day); });
            prev.forEach(d => { if (allDays.has(d)) next.add(d); });
            return next;
        });
    }, [selectedStudentTasks]);

    const dayGroups: DayGroup[] = useMemo(() => {
        const map = new Map<number, Task[]>();
        selectedStudentTasks.forEach(t => {
            if (!map.has(t.day)) map.set(t.day, []);
            map.get(t.day)!.push(t);
        });
        return Array.from(map.entries())
            .sort(([a], [b]) => a - b)
            .map(([day, tasks]) => {
                const sorted = [
                    ...tasks.filter(isPending),
                    ...tasks.filter(t => !isPending(t)),
                ];
                return {
                    day,
                    tasks: sorted,
                    pendingCount: tasks.filter(isPending).length,
                    allDone: tasks.every(t => t.status === 'approved'),
                };
            });
    }, [selectedStudentTasks]);

    const totalPending = dayGroups.reduce((s, g) => s + g.pendingCount, 0);

    const toggleDay = (day: number) => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return next;
        });
    };

    const refresh = async () => {
        setRefreshing(true);
        await fetchStudentTasks(studentId).catch(() => {});
        setRefreshing(false);
    };

    const handleApproveCompletion = async (gemKey: GemKey, gemAmount: number) => {
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

    const handleRejectCompletion = (id: string) => {
        Alert.alert('완료 반려', '완료를 반려할까요?', [
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

    const handleApprovePlan = async (id: string) => {
        setLoadingId(id);
        try { await approvePlan(id); }
        catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : '승인 실패'); }
        finally { setLoadingId(null); }
    };

    const handleRejectPlan = (id: string) => {
        Alert.alert('계획 반려', '이 계획을 반려할까요?', [
            { text: '취소', style: 'cancel' },
            {
                text: '반려', style: 'destructive',
                onPress: async () => {
                    setLoadingId(id);
                    try { await rejectPlan(id); }
                    catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : '반려 실패'); }
                    finally { setLoadingId(null); }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{studentName}의 할일</Text>
                <View style={{ width: 36 }} />
            </View>

            {totalPending > 0 && (
                <View style={styles.pendingBanner}>
                    <Text style={styles.pendingText}>📋 검토 대기 {totalPending}개</Text>
                </View>
            )}

            <ScrollView
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
            >
                {dayGroups.length === 0 && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>할일이 없어요</Text>
                    </View>
                )}
                {dayGroups.map(group => {
                    const expanded = expandedDays.has(group.day);
                    return (
                        <View key={group.day} style={styles.daySection}>
                            {/* Day 헤더 */}
                            <TouchableOpacity
                                activeOpacity={0.75}
                                style={[
                                    styles.dayHeader,
                                    group.pendingCount > 0 && styles.dayHeaderPending,
                                    expanded && styles.dayHeaderExpanded,
                                ]}
                                onPress={() => toggleDay(group.day)}
                            >
                                <View style={styles.dayHeaderLeft}>
                                    <Text style={styles.dayLabel}>Day {group.day}</Text>
                                    <Text style={[
                                        styles.daySummary,
                                        group.pendingCount > 0 ? styles.daySummaryPending
                                            : group.allDone ? styles.daySummaryDone
                                            : null,
                                    ]}>
                                        {group.pendingCount > 0
                                            ? `⏳ 검토 대기 ${group.pendingCount}개`
                                            : group.allDone
                                                ? `✅ 완료 ${group.tasks.length}개`
                                                : `진행중 · ${group.tasks.length}개`}
                                    </Text>
                                </View>
                                <Text style={[styles.chevron, expanded && styles.chevronUp]}>›</Text>
                            </TouchableOpacity>

                            {/* 할일 목록 */}
                            {expanded && (
                                <View style={styles.taskList}>
                                    {group.tasks.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            isLoading={loadingId === task.id}
                                            onApprovePlan={() => handleApprovePlan(task.id)}
                                            onRejectPlan={() => handleRejectPlan(task.id)}
                                            onApproveCompletion={() => setApproveTarget(task.id)}
                                            onRejectCompletion={() => handleRejectCompletion(task.id)}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

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
                                onPress={() => handleApproveCompletion(opt.key, opt.amount)}
                            >
                                <Text style={styles.gemOptionText}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setApproveTarget(null)}>
                            <Text style={styles.cancelText}>취소</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const STATUS_ICON: Partial<Record<Task['status'], string>> = {
    approved:      '✅',
    rejected:      '❌',
    plan_approved: '📋✅',
    plan_rejected: '📋❌',
    plan_submitted:'📋⏳',
    todo:          '—',
};

function TaskCard({ task, isLoading, onApprovePlan, onRejectPlan, onApproveCompletion, onRejectCompletion }: {
    task: Task;
    isLoading: boolean;
    onApprovePlan: () => void;
    onRejectPlan: () => void;
    onApproveCompletion: () => void;
    onRejectCompletion: () => void;
}) {
    const isPlanPending = task.status === 'plan_submitted';
    const isCompletionPending = task.status === 'submitted';
    const pending = isPlanPending || isCompletionPending;

    return (
        <View style={[styles.taskCard, pending && styles.taskCardPending]}>
            <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.memo ? <Text style={styles.taskMemo}>{task.memo}</Text> : null}
                {task.gem_type && task.gem_amount ? (
                    <Text style={styles.rewardText}>💎 {task.gem_type} ×{task.gem_amount}</Text>
                ) : null}
            </View>
            {pending && (
                isLoading
                    ? <ActivityIndicator color={colors.ocean[500]} />
                    : (
                        <View style={styles.taskActions}>
                            {isPlanPending ? (
                                <>
                                    <TouchableOpacity style={styles.approveBtn} onPress={onApprovePlan}>
                                        <Text style={styles.approveBtnText}>📋 계획 승인</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={onRejectPlan}>
                                        <Text style={styles.rejectBtnText}>❌ 반려</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.approveBtn} onPress={onApproveCompletion}>
                                        <Text style={styles.approveBtnText}>✅ 완료 승인</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={onRejectCompletion}>
                                        <Text style={styles.rejectBtnText}>❌ 반려</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )
            )}
            {!pending && (
                <Text style={[styles.statusText, {
                    color: task.status === 'approved' ? colors.ocean[500]
                        : task.status === 'rejected' ? colors.coral[500]
                        : task.status === 'plan_approved' ? colors.ocean[300]
                        : task.status === 'plan_rejected' ? colors.coral[500]
                        : colors.ink[300],
                }]}>
                    {STATUS_ICON[task.status] ?? '—'}
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

    // Day 섹션
    daySection: { gap: 2 },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.paper2,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
    },
    dayHeaderPending: {
        borderLeftColor: colors.sun[500],
        backgroundColor: colors.sun[300] + '55',
    },
    dayHeaderExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    dayHeaderLeft: { gap: 2 },
    dayLabel: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    daySummary: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.xs,
        color: colors.ink[300],
    },
    daySummaryPending: { color: colors.sun[700] },
    daySummaryDone:    { color: colors.ocean[500] },
    chevron: {
        fontSize: 22,
        color: colors.ink[300],
        transform: [{ rotate: '90deg' }],
    },
    chevronUp: {
        transform: [{ rotate: '-90deg' }],
    },

    // 할일 목록 컨테이너
    taskList: {
        backgroundColor: colors.paper2,
        borderBottomLeftRadius: radius.md,
        borderBottomRightRadius: radius.md,
        paddingHorizontal: 10,
        paddingBottom: 8,
        paddingTop: 4,
        gap: 6,
    },

    // 개별 할일 카드 (Day 뱃지 제거, 들여쓰기 적용)
    taskCard: {
        backgroundColor: colors.card,
        borderRadius: radius.sm,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        ...shadows.card,
    },
    taskCardPending: {
        borderLeftWidth: 3,
        borderLeftColor: colors.sun[500],
    },
    taskInfo: { flex: 1 },
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

    // 모달
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
    cancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    cancelText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
    },
});
