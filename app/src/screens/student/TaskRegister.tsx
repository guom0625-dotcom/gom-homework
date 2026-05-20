import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAppStore } from '../../store/appStore';
import { colors, fontFamilies, fontSizes, radius } from '../../theme';

type Props = {
    navigation: NativeStackNavigationProp<StudentStackParams, 'TaskRegister'>;
    route: RouteProp<StudentStackParams, 'TaskRegister'>;
};

export function TaskRegisterScreen({ navigation, route }: Props) {
    const { day } = route.params;
    const [title, setTitle] = useState('');
    const [memo, setMemo] = useState('');
    const [loading, setLoading] = useState(false);
    const createTask = useAppStore(s => s.createTask);

    const handleSave = async () => {
        if (!title.trim()) { Alert.alert('할일 제목을 입력해주세요'); return; }
        setLoading(true);
        try {
            await createTask(day, title.trim(), memo.trim() || undefined);
            navigation.goBack();
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '저장 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.flex}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Day {day} 할일 추가</Text>
                    <View style={{ width: 36 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.label}>할일 제목 *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="예: 수학 2단원 복습"
                        placeholderTextColor={colors.ink[300]}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={100}
                        autoFocus
                    />

                    <Text style={[styles.label, { marginTop: 20 }]}>메모 (선택)</Text>
                    <TextInput
                        style={[styles.input, styles.memoInput]}
                        placeholder="구체적으로 어떻게 할건지 써봐요"
                        placeholderTextColor={colors.ink[300]}
                        value={memo}
                        onChangeText={setMemo}
                        maxLength={500}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, loading && { opacity: 0.6 }]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.saveBtnText}>저장하기</Text>
                        }
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    flex: { flex: 1 },
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
    backText: { fontSize: 18, color: colors.ink[500] },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    content: { padding: 20 },
    label: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginBottom: 8,
    },
    input: {
        borderWidth: 1.5,
        borderColor: colors.ink[200],
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    memoInput: {
        minHeight: 100,
        paddingTop: 12,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.ink[100],
    },
    saveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.lg,
        color: '#fff',
    },
});
