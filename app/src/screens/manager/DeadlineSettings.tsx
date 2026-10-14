import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { formatDeadline } from '../../lib/days';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'DeadlineSettings'> };

interface Deadlines { register_deadline_min: number; complete_deadline_min: number }

const STEP = 30;            // 30분 단위
const MIN = 30;
const MAX_REGISTER = 1440;  // 당일 24:00
const MAX_COMPLETE = 2160;  // 다음날 12:00

// 매니저가 정하는 마감시간. 연결된 모든 학생에게 똑같이 적용된다
export function DeadlineSettingsScreen({ navigation }: Props) {
    const [saved, setSaved] = useState<Deadlines | null>(null);
    const [register, setRegister] = useState(MAX_REGISTER);
    const [complete, setComplete] = useState(1800);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api<Deadlines>('/settings')
            .then(d => { setSaved(d); setRegister(d.register_deadline_min); setComplete(d.complete_deadline_min); })
            .catch(() => Alert.alert('오류', '설정을 불러오지 못했어요'));
    }, []);

    // 등록 마감은 완료 마감보다 늦을 수 없다 — 한쪽을 움직이면 다른 쪽을 따라 맞춘다
    const changeRegister = (delta: number) => {
        const next = Math.min(MAX_REGISTER, Math.max(MIN, register + delta));
        setRegister(next);
        if (complete < next) setComplete(next);
    };
    const changeComplete = (delta: number) => {
        const next = Math.min(MAX_COMPLETE, Math.max(MIN, complete + delta));
        setComplete(next);
        if (register > next) setRegister(Math.min(next, MAX_REGISTER));
    };

    const dirty = saved != null
        && (saved.register_deadline_min !== register || saved.complete_deadline_min !== complete);

    const handleSave = async () => {
        setSaving(true);
        try {
            const d = await api<Deadlines>('/settings', {
                method: 'PUT',
                body: JSON.stringify({ register_deadline_min: register, complete_deadline_min: complete }),
            });
            setSaved(d);
            Alert.alert('저장했어요', `등록 마감 ${formatDeadline(d.register_deadline_min)}\n완료 마감 · 다이아 지급 ${formatDeadline(d.complete_deadline_min)}`);
        } catch {
            Alert.alert('오류', '저장에 실패했어요');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>마감시간 설정</Text>
                <View style={{ width: 36 }} />
            </View>

            {saved == null ? (
                <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.ocean[500]} />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    <TimeRow
                        label="할일 등록 마감"
                        desc="이 시각이 지나면 그날은 새 할일을 등록할 수 없어요. 반려된 계획을 고쳐 다시 올리는 건 완료 마감 전까지 돼요."
                        value={register}
                        onChange={changeRegister}
                    />
                    <TimeRow
                        label="할일 완료 마감 · 다이아 지급"
                        desc="이 시각까지 완료 상신을 해야 해요. 그날 할일이 전부 승인돼 있으면 이 시각에 다이아가 지급돼요. 다음날 낮 12시까지 정할 수 있어요."
                        value={complete}
                        onChange={changeComplete}
                    />

                    <TouchableOpacity
                        style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={!dirty || saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.saveBtnText}>{dirty ? '저장' : '저장됨'}</Text>
                        }
                    </TouchableOpacity>
                    <Text style={styles.note}>
                        이미 마감이 지난 날에는 적용되지 않고, 아직 진행 중인 날부터 새 시간으로 계산돼요.
                    </Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function TimeRow({ label, desc, value, onChange }: {
    label: string;
    desc: string;
    value: number;
    onChange: (delta: number) => void;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardLabel}>{label}</Text>
            <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(-60)}>
                    <Text style={styles.stepBtnText}>−1시간</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(-STEP)}>
                    <Text style={styles.stepBtnText}>−30분</Text>
                </TouchableOpacity>
                <Text style={styles.timeText}>{formatDeadline(value)}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(STEP)}>
                    <Text style={styles.stepBtnText}>+30분</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(60)}>
                    <Text style={styles.stepBtnText}>+1시간</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.cardDesc}>{desc}</Text>
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
    list: { padding: 16, gap: 12 },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 16,
        gap: 12,
        ...shadows.card,
    },
    cardLabel: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    cardDesc: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        lineHeight: 20,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: radius.sm,
        backgroundColor: colors.paper2,
    },
    stepBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.ink[700],
    },
    timeText: {
        flex: 1,
        textAlign: 'center',
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.lg,
        fontWeight: '700',
        color: colors.ocean[700],
    },
    saveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    saveBtnDisabled: { backgroundColor: colors.ink[200] },
    saveBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: '#fff',
    },
    note: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.xs,
        color: colors.ink[300],
        textAlign: 'center',
    },
});
