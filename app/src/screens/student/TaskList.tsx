import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAppStore } from '../../store/appStore';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';
import type { Task } from '../../store/appStore';

type Props = {
    navigation: NativeStackNavigationProp<StudentStackParams, 'TaskList'>;
    route: RouteProp<StudentStackParams, 'TaskList'>;
};

const STATUS_LABEL: Record<Task['status'], string> = {
    todo:           '할일',
    plan_submitted: '⏳ 계획 검토중',
    plan_approved:  '✅ 계획 승인',
    plan_rejected:  '❌ 계획 반려',
    submitted:      '⏳ 완료 검토중',
    approved:       '✅ 완료 승인',
    rejected:       '❌ 완료 반려',
};
const STATUS_COLOR: Record<Task['status'], string> = {
    todo:           colors.ink[300],
    plan_submitted: colors.sun[500],
    plan_approved:  colors.ocean[300],
    plan_rejected:  colors.coral[500],
    submitted:      colors.sun[500],
    approved:       colors.ocean[500],
    rejected:       colors.coral[500],
};

export function TaskListScreen({ navigation, route }: Props) {
    const { day } = route.params;
    const { tasks, fetchTasks, submitTask, deleteTask, submitPlan } = useAppStore();
    const [refreshing, setRefreshing] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    useEffect(() => { fetchTasks(day); }, [day]);

    useFocusEffect(useCallback(() => {
        fetchTasks(day).catch(() => {});
    }, [day]));

    const refresh = async () => {
        setRefreshing(true);
        await fetchTasks(day).catch(() => {});
        setRefreshing(false);
    };

    const handleSubmitPlan = async (id: string) => {
        setLoadingId(id);
        try {
            await submitPlan(id);
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '상신 실패');
        } finally {
            setLoadingId(null);
        }
    };

    const handleSubmit = async (id: string) => {
        setLoadingId(id);
        try {
            await submitTask(id);
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '제출 실패');
        } finally {
            setLoadingId(null);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('삭제', '이 할일을 삭제할까요?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제', style: 'destructive',
                onPress: () => deleteTask(id).catch(e =>
                    Alert.alert('오류', e instanceof Error ? e.message : '삭제 실패')
                ),
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Day {day} 할일 목록</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => navigation.navigate('TaskRegister', { day })}
                >
                    <Text style={styles.addBtnText}>+ 추가</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={tasks}
                keyExtractor={t => t.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>할일이 없어요{'\n'}+ 추가를 눌러 등록해보세요</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.taskCard}>
                        <View style={styles.taskMain}>
                            <Text style={styles.taskTitle}>{item.title}</Text>
                            {item.memo ? <Text style={styles.taskMemo}>{item.memo}</Text> : null}
                            {item.gem_type && item.gem_amount ? (
                                <Text style={styles.rewardText}>
                                    💎 {item.gem_type} × {item.gem_amount}
                                </Text>
                            ) : null}
                        </View>
                        <View style={styles.taskRight}>
                            <Text style={[styles.statusBadge, { color: STATUS_COLOR[item.status] }]}>
                                {STATUS_LABEL[item.status]}
                            </Text>
                            {(item.status === 'todo' || item.status === 'plan_rejected') && (
                                <View style={styles.actionBtns}>
                                    {loadingId === item.id
                                        ? <ActivityIndicator size="small" color={colors.ocean[500]} />
                                        : (
                                            <TouchableOpacity
                                                style={styles.submitBtn}
                                                onPress={() => handleSubmitPlan(item.id)}
                                            >
                                                <Text style={styles.submitBtnText}>계획 상신</Text>
                                            </TouchableOpacity>
                                        )
                                    }
                                    <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                        <Text style={styles.deleteBtn}>🗑</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {(item.status === 'plan_approved' || item.status === 'rejected') && (
                                <View style={styles.actionBtns}>
                                    {loadingId === item.id
                                        ? <ActivityIndicator size="small" color={colors.ocean[500]} />
                                        : (
                                            <TouchableOpacity
                                                style={styles.submitBtn}
                                                onPress={() => handleSubmit(item.id)}
                                            >
                                                <Text style={styles.submitBtnText}>
                                                    {item.status === 'rejected' ? '재제출' : '완료 상신'}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    }
                                </View>
                            )}
                        </View>
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
    backBtn: { padding: 4, marginRight: 4 },
    backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['3xl'],
        color: colors.ink[900],
    },
    addBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    addBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: '#fff',
    },
    list: { padding: 16, gap: 10 },
    empty: { paddingTop: 80, alignItems: 'center' },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 24,
    },
    taskCard: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        ...shadows.card,
    },
    taskMain: { flex: 1 },
    taskTitle: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    taskMemo: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 4,
    },
    rewardText: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.sm,
        color: colors.grape[700],
        marginTop: 4,
    },
    taskRight: { alignItems: 'flex-end', gap: 8, minWidth: 60 },
    statusBadge: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
    },
    actionBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    submitBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    submitBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.xs,
        color: '#fff',
    },
    deleteBtn: { fontSize: 18 },
});
