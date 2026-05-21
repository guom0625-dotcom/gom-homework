import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { colors, fontFamilies, fontSizes, gradients, radius } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<AuthStackParams, 'Welcome'> };

export function WelcomeScreen({ navigation }: Props) {
    const [role, setRole] = useState<'manager' | 'student'>('student');
    const [name, setName] = useState('');
    const [managerKey, setManagerKey] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup, loginWithKey } = useAuthStore();

    const handleStart = async () => {
        setLoading(true);
        try {
            if (role === 'manager') {
                if (!managerKey.trim()) { Alert.alert('키를 입력해주세요'); return; }
                await loginWithKey(managerKey);
            } else {
                if (!name.trim()) { Alert.alert('이름을 입력해주세요'); return; }
                await signup(name.trim(), 'student');
                navigation.replace('Pairing');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '오류가 발생했어요';
            Alert.alert('오류', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <LinearGradient colors={gradients.sea} style={styles.bg}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.inner}
                >
                    <Text style={styles.emoji}>🏝️</Text>
                    <Text style={styles.title}>gomHomework</Text>
                    <Text style={styles.subtitle}>매일 할일로 섬을 정복해요!</Text>

                    <View style={styles.card}>
                        <Text style={styles.label}>역할 선택</Text>
                        <View style={styles.roleRow}>
                            {(['student', 'manager'] as const).map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                                    onPress={() => setRole(r)}
                                >
                                    <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                                        {r === 'student' ? '👧 학생' : '👨‍💼 매니저'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {role === 'student' ? (
                            <>
                                <Text style={[styles.label, { marginTop: 20 }]}>이름</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="예: 홍길동"
                                    placeholderTextColor={colors.ink[300]}
                                    value={name}
                                    onChangeText={setName}
                                    maxLength={20}
                                    returnKeyType="done"
                                    onSubmitEditing={handleStart}
                                />
                            </>
                        ) : (
                            <>
                                <Text style={[styles.label, { marginTop: 20 }]}>Bearer 키</Text>
                                <TextInput
                                    style={[styles.input, styles.keyInput]}
                                    placeholder="서버에서 발급받은 키를 붙여넣으세요"
                                    placeholderTextColor={colors.ink[300]}
                                    value={managerKey}
                                    onChangeText={setManagerKey}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    multiline
                                />
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.startBtn, loading && styles.startBtnDisabled]}
                            onPress={handleStart}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.startBtnText}>
                                    {role === 'manager' ? '로그인 🔑' : '시작하기 🚀'}
                                </Text>
                            }
                        </TouchableOpacity>

                        {role === 'student' && (
                            <Text style={styles.hint}>
                                시작 후 매니저가 준 6자리 코드로 연결해요
                            </Text>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    bg: { flex: 1 },
    inner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    emoji: { fontSize: 64, marginBottom: 8 },
    title: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['6xl'],
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 0,
    },
    subtitle: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 32,
        marginTop: 4,
    },
    card: {
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 6,
    },
    label: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginBottom: 8,
    },
    roleRow: { flexDirection: 'row', gap: 10 },
    roleBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.ink[200],
        alignItems: 'center',
    },
    roleBtnActive: {
        borderColor: colors.ocean[500],
        backgroundColor: colors.ocean[50],
    },
    roleBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[500],
    },
    roleBtnTextActive: { color: colors.ocean[700] },
    input: {
        borderWidth: 1.5,
        borderColor: colors.ink[200],
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        marginBottom: 20,
    },
    keyInput: {
        minHeight: 72,
        textAlignVertical: 'top',
        fontSize: fontSizes.xs,
        fontFamily: fontFamilies.body,
    },
    startBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingVertical: 14,
        alignItems: 'center',
    },
    startBtnDisabled: { opacity: 0.6 },
    startBtnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.lg,
        color: '#fff',
    },
    hint: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.xs,
        color: colors.ink[300],
        textAlign: 'center',
        marginTop: 12,
    },
});
