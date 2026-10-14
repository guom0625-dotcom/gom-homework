import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { useAppStore, type Task } from '../../store/appStore';
import { addDays, formatDay, todayKST } from '../../lib/days';
import { PraiseModal } from '../../components/PraiseModal';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = {
    navigation: NativeStackNavigationProp<ManagerStackParams, 'Approval'>;
    route: RouteProp<ManagerStackParams, 'Approval'>;
};

type DayGroup = {
    day: number;
    tasks: Task[];
    pendingCount: number;
    allDone: boolean;
};

function isPending(t: Task) {
    return t.status === 'plan_submitted' || t.status === 'submitted' || t.status === 'delete_requested';
}

export function ApprovalScreen({ navigation, route }: Props) {
    const { studentId, studentName } = route.params;
    const {
        selectedStudentTasks, fetchStudentTasks, approveTask, rejectTask, approvePlan, rejectPlan,
        approveDelete, rejectDelete, selectedOlderDay,
    } = useAppStore();
    // 최근 1주일치만 보여주고, 아래 "더 보기"로 1주일씩 넓힌다 (검토 대기 중인 할일은 날짜와 무관하게 항상 표시)
    const [from, setFrom] = useState(() => addDays(todayKST(), -6));
    const [refreshing, setRefreshing] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

    useFocusEffect(useCallback(() => {
        fetchStudentTasks(studentId, from).catch(() => {});
    }, [studentId, from]));

    const showOlderWeek = () => {
        if (selectedOlderDay == null) return;
        // 바로 앞 1주일이 비어 있으면, 할일이 있는 가장 가까운 날짜가 포함되도록 더 앞으로
        setFrom(Math.min(addDays(from, -7), addDays(selectedOlderDay, -6)));
    };

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
            .sort(([a], [b]) => b - a)  // 최근 날짜가 위로
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
        await fetchStudentTasks(studentId, from).catch(() => {});
        setRefreshing(false);
    };

    // 완료 승인은 칭찬 한마디 창을 거친다
    const [praiseTarget, setPraiseTarget] = useState<Task | null>(null);

    const handleApproveCompletion = async (id: string, praise: string | null) => {
        setLoadingId(id);
        try {
            await approveTask(id, praise);
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

    const handleApproveDelete = (id: string) => {
        Alert.alert('삭제 승인', '이 할일을 삭제할까요?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제', style: 'destructive',
                onPress: async () => {
                    setLoadingId(id);
                    try { await approveDelete(id); }
                    catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : '삭제 실패'); }
                    finally { setLoadingId(null); }
                },
            },
        ]);
    };

    const handleRejectDelete = async (id: string) => {
        setLoadingId(id);
        try { await rejectDelete(id); }
        catch (e: unknown) { Alert.alert('오류', e instanceof Error ? e.message : '반려 실패'); }
        finally { setLoadingId(null); }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{studentName}의 할일</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('RoomVisit', { studentId, studentName })}
                    style={styles.roomBtn}
                >
                    <Text style={styles.roomBtnText}>🏠 방</Text>
                </TouchableOpacity>
            </View>

            {totalPending > 0 && (
                <View style={styles.pendingBanner}>
                    <Text style={styles.pendingText}>검토 대기 {totalPending}개</Text>
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
                                    <Text style={styles.dayLabel}>{formatDay(group.day)}</Text>
                                    <Text style={[
                                        styles.daySummary,
                                        group.pendingCount > 0 ? styles.daySummaryPending
                                            : group.allDone ? styles.daySummaryDone
                                            : null,
                                    ]}>
                                        {group.pendingCount > 0
                                            ? `검토 대기 ${group.pendingCount}개`
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
                                            onApproveCompletion={() => setPraiseTarget(task)}
                                            onRejectCompletion={() => handleRejectCompletion(task.id)}
                                            onApproveDelete={() => handleApproveDelete(task.id)}
                                            onRejectDelete={() => handleRejectDelete(task.id)}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
                {selectedOlderDay != null && (
                    <TouchableOpacity style={styles.moreBtn} onPress={showOlderWeek}>
                        <Text style={styles.moreBtnText}>이전 1주일 더 보기</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <PraiseModal
                visible={praiseTarget != null}
                title={praiseTarget?.title ?? ''}
                onCancel={() => setPraiseTarget(null)}
                onConfirm={praise => {
                    const target = praiseTarget;
                    setPraiseTarget(null);
                    if (target) handleApproveCompletion(target.id, praise);
                }}
            />
        </SafeAreaView>
    );
}

// 끝난 할일만 ✅, 나머지 상태는 글자로 표시
const STATUS_TEXT: Partial<Record<Task['status'], string>> = {
    approved:      '✅',
    rejected:      '완료 반려',
    plan_approved: '실행 중',
    plan_rejected: '계획 반려',
    todo:          '작성 중',
};

function TaskCard({
    task, isLoading, onApprovePlan, onRejectPlan, onApproveCompletion, onRejectCompletion,
    onApproveDelete, onRejectDelete,
}: {
    task: Task;
    isLoading: boolean;
    onApprovePlan: () => void;
    onRejectPlan: () => void;
    onApproveCompletion: () => void;
    onRejectCompletion: () => void;
    onApproveDelete: () => void;
    onRejectDelete: () => void;
}) {
    const isPlanPending = task.status === 'plan_submitted';
    const isCompletionPending = task.status === 'submitted';
    const isDeletePending = task.status === 'delete_requested';
    const pending = isPlanPending || isCompletionPending || isDeletePending;

    return (
        <View style={[styles.taskCard, pending && styles.taskCardPending]}>
            <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.memo ? <Text style={styles.taskMemo}>{task.memo}</Text> : null}
                {isDeletePending ? <Text style={styles.deleteNote}>삭제를 요청했어요</Text> : null}
            </View>
            {pending && (
                isLoading
                    ? <ActivityIndicator color={colors.ocean[500]} />
                    : (
                        <View style={styles.taskActions}>
                            {isDeletePending ? (
                                <>
                                    <TouchableOpacity style={styles.approveBtn} onPress={onApproveDelete}>
                                        <Text style={styles.approveBtnText}>삭제 승인</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={onRejectDelete}>
                                        <Text style={styles.rejectBtnText}>반려</Text>
                                    </TouchableOpacity>
                                </>
                            ) : isPlanPending ? (
                                <>
                                    <TouchableOpacity style={styles.approveBtn} onPress={onApprovePlan}>
                                        <Text style={styles.approveBtnText}>계획 승인</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={onRejectPlan}>
                                        <Text style={styles.rejectBtnText}>반려</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.approveBtn} onPress={onApproveCompletion}>
                                        <Text style={styles.approveBtnText}>완료 승인</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={onRejectCompletion}>
                                        <Text style={styles.rejectBtnText}>반려</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )
            )}
            {!pending && (
                <Text style={[task.status === 'approved' ? styles.statusDone : styles.statusText, {
                    color: task.status === 'approved' ? colors.ocean[500]
                        : task.status === 'rejected' ? colors.coral[500]
                        : task.status === 'plan_approved' ? colors.ocean[700]
                        : task.status === 'plan_rejected' ? colors.coral[500]
                        : colors.ink[500],
                }]}>
                    {STATUS_TEXT[task.status] ?? '—'}
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
    roomBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.paper2,
    },
    roomBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[700],
    },
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
    deleteNote: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.coral[700],
        marginTop: 4,
    },
    moreBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.ink[200],
        marginTop: 4,
    },
    moreBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
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
    statusDone: { fontSize: 18 },
    statusText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
    },
});
