import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { colors, fontFamilies, fontSizes, radius } from '../../theme';

export function PairingScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { init } = useAuthStore();

    const handleRedeem = async () => {
        if (code.length !== 6) { Alert.alert('6자리 코드를 입력해주세요'); return; }
        setLoading(true);
        try {
            const res = await api<{ manager: { name: string } }>('/auth/redeem', {
                method: 'POST',
                body: JSON.stringify({ code }),
            });
            Alert.alert('연결 완료!', `${res.manager.name} 매니저와 연결됐어요 🎉`, [
                { text: '확인', onPress: () => init() },
            ]);
        } catch {
            Alert.alert('오류', '코드가 올바르지 않거나 만료됐어요');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Text style={styles.emoji}>🔗</Text>
                <Text style={styles.title}>매니저 연결</Text>
                <Text style={styles.sub}>
                    매니저에게 6자리 코드를 받아{'\n'}아래에 입력해주세요
                </Text>

                <TextInput
                    style={styles.codeInput}
                    placeholder="000000"
                    placeholderTextColor={colors.ink[300]}
                    value={code}
                    onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    textAlign="center"
                />

                <TouchableOpacity
                    style={[styles.btn, loading && { opacity: 0.6 }]}
                    onPress={handleRedeem}
                    disabled={loading}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>연결하기</Text>
                    }
                </TouchableOpacity>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emoji: { fontSize: 56, marginBottom: 12 },
    title: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['5xl'],
        color: colors.ink[900],
    },
    sub: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[500],
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 32,
        lineHeight: 22,
    },
    codeInput: {
        width: '100%',
        borderWidth: 2,
        borderColor: colors.ocean[300],
        borderRadius: radius.lg,
        paddingVertical: 18,
        fontFamily: fontFamilies.num,
        fontSize: 36,
        color: colors.ink[900],
        letterSpacing: 12,
        marginBottom: 20,
    },
    btn: {
        width: '100%',
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingVertical: 14,
        alignItems: 'center',
    },
    btnText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.lg,
        color: '#fff',
    },
});
