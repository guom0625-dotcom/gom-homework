import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Character } from '../../components/Character';
import { colors, fontFamilies, fontSizes, radius } from '../../theme';
import type { CharacterType } from '../../lib/types';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

const CHARACTER_TYPES: CharacterType[] = ['bear', 'fox', 'cat', 'owl'];
const CHARACTER_LABELS: Record<CharacterType, string> = {
    bear: '곰돌이',
    fox: '여우',
    cat: '고양이',
    owl: '부엉이',
};

export function ProfileScreen() {
    const navigation = useNavigation();
    const { character: savedCharacter, avatar: savedAvatar, updateProfile } = useAppStore();
    const { user, logout } = useAuthStore();

    const [character, setCharacter] = useState<CharacterType>(savedCharacter);
    const [avatar, setAvatar] = useState<string | null>(savedAvatar);
    const [saving, setSaving] = useState(false);

    const handlePickPhoto = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            const camera = await ImagePicker.requestCameraPermissionsAsync();
            if (!camera.granted) {
                Alert.alert('권한 필요', '사진을 사용하려면 카메라 또는 갤러리 권한이 필요합니다.');
                return;
            }
        }

        Alert.alert('사진 선택', '어디서 가져올까요?', [
            { text: '카메라', onPress: () => pickFrom('camera') },
            { text: '갤러리', onPress: () => pickFrom('library') },
            { text: '사진 삭제', style: 'destructive', onPress: () => setAvatar(null) },
            { text: '취소', style: 'cancel' },
        ]);
    };

    const pickFrom = async (source: 'camera' | 'library') => {
        const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

        if (result.canceled) return;
        const uri = result.assets[0].uri;

        const context = ImageManipulator.manipulate(uri);
        context.resize({ width: 300, height: 300 });
        const imageRef = await context.renderAsync();
        const compressed = await imageRef.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });

        if (compressed.base64) {
            setAvatar(`data:image/jpeg;base64,${compressed.base64}`);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile(character, avatar);
            navigation.goBack();
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('로그아웃', '정말 로그아웃할까요?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: logout },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← 뒤로</Text>
                </TouchableOpacity>
                <Text style={styles.title}>프로필</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.previewRow}>
                    <Character type={character} size={100} mood="happy" photoUrl={avatar ?? undefined} />
                    <View style={styles.previewInfo}>
                        <Text style={styles.previewName}>{user?.name}</Text>
                        <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
                            <Text style={styles.photoBtnText}>📷 사진 변경</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>캐릭터 선택</Text>
                <View style={styles.characterGrid}>
                    {CHARACTER_TYPES.map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[styles.characterTile, character === type && styles.characterTileSelected]}
                            onPress={() => setCharacter(type)}
                            activeOpacity={0.75}
                        >
                            <Character type={type} size={56} mood="happy" />
                            <Text style={[styles.characterLabel, character === type && styles.characterLabelSelected]}>
                                {CHARACTER_LABELS[type]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveBtnText}>저장하기</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>로그아웃</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>
                    v{Constants.expoConfig?.version ?? '—'}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.ink[100],
    },
    backBtn: { width: 60 },
    backText: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ocean[500] },
    title: { fontFamily: fontFamilies.display, fontSize: fontSizes.lg, color: colors.ink[900] },
    body: { padding: 20, paddingBottom: 40 },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 28 },
    previewInfo: { flex: 1, gap: 10 },
    previewName: { fontFamily: fontFamilies.display, fontSize: fontSizes['2xl'], color: colors.ink[900] },
    photoBtn: {
        backgroundColor: colors.ocean[50],
        borderRadius: radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 14,
        alignSelf: 'flex-start',
    },
    photoBtnText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ocean[700] },
    sectionLabel: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginBottom: 12,
    },
    characterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
    characterTile: {
        width: '47%',
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.ink[200],
        backgroundColor: colors.card,
    },
    characterTileSelected: {
        borderColor: colors.ocean[500],
        backgroundColor: colors.ocean[50],
    },
    characterLabel: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 6,
    },
    characterLabelSelected: { color: colors.ocean[700] },
    saveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.pill,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.lg, color: '#fff' },
    logoutBtn: { alignItems: 'center', paddingVertical: 12 },
    logoutText: { fontFamily: fontFamilies.body, fontSize: fontSizes.base, color: colors.ink[300] },
    versionText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.xs,
        color: colors.ink[200],
        textAlign: 'center',
        paddingBottom: 8,
    },
});
