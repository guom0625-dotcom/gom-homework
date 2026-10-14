import React, { useState } from 'react';
import {
    View, Text, TextInput, Image, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAppStore } from '../../store/appStore';
import { errorMessage } from '../../lib/errors';
import { colors, fontFamilies, fontSizes, radius } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'BookRegister'> };

const PHOTO_WIDTH = 480;  // 서버에 올리는 책 사진 가로 크기 (세로는 비율대로)
const THUMB_WIDTH = 160;  // 책장에 꽂히는 작은 표지

// 책 등록 — 제목과 책 사진이 둘 다 있어야 등록된다. 매니저 승인 없이 바로 등록
export function BookRegisterScreen({ navigation }: Props) {
    const [title, setTitle] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [thumb, setThumb] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const addBook = useAppStore(s => s.addBook);

    const pickFrom = async (source: 'camera' | 'library') => {
        const permission = source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('권한 필요', source === 'camera' ? '카메라 권한이 필요해요' : '갤러리 권한이 필요해요');
            return;
        }

        const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
        if (result.canceled) return;

        const shrink = async (width: number) => {
            const context = ImageManipulator.manipulate(result.assets[0].uri);
            context.resize({ width });
            const imageRef = await context.renderAsync();
            const saved = await imageRef.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
            return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
        };
        const [big, small] = await Promise.all([shrink(PHOTO_WIDTH), shrink(THUMB_WIDTH)]);
        if (big) setPhoto(big);
        setThumb(small ?? undefined);
    };

    const handlePickPhoto = () => {
        Alert.alert('책 사진', '어디서 가져올까요?', [
            { text: '카메라', onPress: () => { pickFrom('camera'); } },
            { text: '갤러리', onPress: () => { pickFrom('library'); } },
            { text: '취소', style: 'cancel' },
        ]);
    };

    const handleSave = async () => {
        if (!title.trim()) { Alert.alert('책 제목을 입력해주세요'); return; }
        if (!photo) { Alert.alert('책 사진을 넣어주세요', '책 표지를 찍거나 갤러리에서 골라주세요'); return; }
        setLoading(true);
        try {
            await addBook(title.trim(), photo, thumb);
            navigation.goBack();
        } catch (e: unknown) {
            Alert.alert('오류', errorMessage(e, '등록 실패'));
        } finally {
            setLoading(false);
        }
    };

    const ready = title.trim().length > 0 && photo != null;

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>책 등록</Text>
                    <View style={{ width: 36 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.label}>책 사진 *</Text>
                    <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto} activeOpacity={0.8}>
                        {photo
                            ? <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
                            : <Text style={styles.photoHint}>📷{'\n'}눌러서 책 표지 사진 넣기</Text>
                        }
                    </TouchableOpacity>

                    <Text style={[styles.label, { marginTop: 20 }]}>책 제목 *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="예: 어린 왕자"
                        placeholderTextColor={colors.ink[300]}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={100}
                    />
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, (!ready || loading) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.saveBtnText}>📚 등록하기</Text>
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
    backText: { fontSize: 20, color: colors.ink[700] },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    content: { padding: 20 },
    label: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginBottom: 8,
    },
    photoBox: {
        alignSelf: 'center',
        width: 180,
        height: 240,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.ink[200],
        borderStyle: 'dashed',
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photo: { width: '100%', height: '100%' },
    photoHint: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 26,
    },
    input: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    footer: { padding: 16 },
    saveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnDisabled: { backgroundColor: colors.ink[200] },
    saveBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: '#fff' },
});
