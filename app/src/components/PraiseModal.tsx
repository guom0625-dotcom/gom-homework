import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fontFamilies, fontSizes, radius } from '../theme';

const PRESETS = ['👍 잘했어!', '🌟 최고야!', '💪 대단해!', '🎉 멋져!', '❤️ 고생했어'];

interface PraiseModalProps {
    visible: boolean;
    title: string;          // 무엇을 승인하는지 (할일·책 제목)
    note?: string;          // 승인하면 생기는 일 안내 (예: 루비 지급)
    onCancel: () => void;
    onConfirm: (praise: string | null) => void;
}

/** 완료 승인 + 칭찬 한마디 (고르거나 직접 쓰거나, 없이 승인) */
export function PraiseModal({ visible, title, note, onCancel, onConfirm }: PraiseModalProps) {
    const [praise, setPraise] = useState('');

    useEffect(() => { if (visible) setPraise(''); }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>완료 승인</Text>
                    <Text style={styles.subject} numberOfLines={2}>{title}</Text>
                    {note ? <Text style={styles.note}>{note}</Text> : null}

                    <Text style={styles.label}>칭찬 한마디 (선택)</Text>
                    <View style={styles.chips}>
                        {PRESETS.map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.chip, praise === p && styles.chipActive]}
                                onPress={() => setPraise(praise === p ? '' : p)}
                            >
                                <Text style={[styles.chipText, praise === p && styles.chipTextActive]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TextInput
                        style={styles.input}
                        value={praise}
                        onChangeText={setPraise}
                        placeholder="직접 써도 돼요"
                        placeholderTextColor={colors.ink[300]}
                        maxLength={100}
                    />

                    <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(praise.trim() || null)}>
                        <Text style={styles.confirmText}>{praise.trim() ? '칭찬과 함께 승인' : '승인'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                        <Text style={styles.cancelText}>취소</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    card: {
        backgroundColor: colors.paper,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        padding: 20,
        paddingBottom: 32,
        gap: 10,
    },
    title: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    subject: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: colors.ink[700], textAlign: 'center' },
    note: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[500], textAlign: 'center' },
    label: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[500], marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: colors.ink[200],
    },
    chipActive: { borderColor: colors.ocean[500], backgroundColor: colors.ocean[50] },
    chipText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[700] },
    chipTextActive: { color: colors.ocean[700] },
    input: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    confirmBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    confirmText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: '#fff' },
    cancelBtn: { paddingVertical: 8, alignItems: 'center' },
    cancelText: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ink[300] },
});
