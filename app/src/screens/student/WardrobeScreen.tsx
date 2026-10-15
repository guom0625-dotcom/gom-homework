import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import { Price } from '../../components/Price';
import { Gem } from '../../components/Gem';
import { AvatarView } from '../../components/MiniRoom';
import {
    DEFAULT_OUTFIT, WEAR, SKIN_COLORS, HAIR_COLORS, TOP_COLORS, BOTTOM_COLORS,
    type Outfit, type WearSlot,
} from '../../lib/avatar';
import type { Room } from '../../lib/miniroom';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<StudentStackParams, 'Wardrobe'> };

const SLOT_LABEL: Record<WearSlot, string> = {
    top: '상의', bottom: '하의', shoes: '신발', glasses: '안경', hat: '모자',
};
const SLOTS: WearSlot[] = ['top', 'bottom', 'shoes', 'glasses', 'hat'];
const priceOf = (key: string) => {
    for (const s of SLOTS) {
        const w = WEAR[s].find(x => x.key === key);
        if (w) return w;
    }
    return undefined;
};

// 옷장: 입혀 보고(미리보기) → 저장. 아직 안 산 옷은 저장할 때 토파즈로 산다
export function WardrobeScreen({ navigation }: Props) {
    const { topaz, fetchMe } = useAppStore();
    const [draft, setDraft] = useState<Outfit | null>(null);
    const [saved, setSaved] = useState<Outfit | null>(null);
    const [owned, setOwned] = useState<Set<string>>(new Set());
    const [rot, setRot] = useState(2);
    const [busy, setBusy] = useState(false);

    useFocusEffect(useCallback(() => {
        fetchMe().catch(() => {});
        api<Room>('/room')
            .then(r => {
                const o = { ...DEFAULT_OUTFIT, ...(r.avatar?.outfit ?? {}) };
                setDraft(o);
                setSaved(o);
                setOwned(new Set(r.wear ?? []));
            })
            .catch(() => Alert.alert('오류', '옷장을 불러오지 못했어요'));
    }, []));

    if (!draft || !saved) {
        return (
            <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.ocean[500]} />
            </SafeAreaView>
        );
    }

    const set = (patch: Partial<Outfit>) => setDraft({ ...draft, ...patch });
    const isOwned = (key: string) => (priceOf(key)?.price ?? 0) === 0 || owned.has(key);
    // 지금 입혀 본 것 중 아직 안 산 옷
    const toBuy = SLOTS.map(s => draft[s] as string).filter(k => !isOwned(k));
    const cost = toBuy.reduce((sum, k) => sum + (priceOf(k)?.price ?? 0), 0);
    const changed = JSON.stringify(draft) !== JSON.stringify(saved);

    const save = async () => {
        if (cost > topaz) {
            Alert.alert('토파즈가 부족해요', `안 산 옷이 ${toBuy.length}벌 있어요 (토파즈 ${cost}개 필요)`);
            return;
        }
        const doSave = async () => {
            setBusy(true);
            try {
                for (const key of toBuy) {
                    await api('/room/wear/buy', { method: 'POST', body: JSON.stringify({ item_key: key }) });
                    setOwned(prev => new Set(prev).add(key));
                }
                await api('/room/avatar', { method: 'PUT', body: JSON.stringify(draft) });
                setSaved(draft);
                await fetchMe().catch(() => {});
                navigation.goBack();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : '';
                Alert.alert('오류', msg === 'insufficient_gems' ? '토파즈가 부족해요' : '저장하지 못했어요');
                fetchMe().catch(() => {});
            } finally {
                setBusy(false);
            }
        };
        if (toBuy.length === 0) { doSave(); return; }
        const names = toBuy.map(k => priceOf(k)?.name).join(', ');
        Alert.alert('옷을 사서 입을까요?', `${names}\n토파즈 ${cost}개`, [
            { text: '취소', style: 'cancel' },
            { text: '사서 입기', onPress: doSave },
        ]);
    };

    const Swatches = ({ list, value, onPick }: { list: string[]; value: string; onPick: (c: string) => void }) => (
        <View style={styles.swatches}>
            {list.map(c => (
                <TouchableOpacity key={c} onPress={() => onPick(c)}
                    style={[styles.swatch, { backgroundColor: c }, value.toLowerCase() === c.toLowerCase() && styles.swatchOn]} />
            ))}
        </View>
    );

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>옷장</Text>
                <Price diamonds={0} topaz={topaz} size={15} showZero={false} />
            </View>

            <View style={styles.preview}>
                <TouchableOpacity style={styles.turnBtn} onPress={() => setRot(r => (r + 3) & 3)}>
                    <Text style={styles.turnText}>↺</Text>
                </TouchableOpacity>
                <AvatarView outfit={draft} size={190} rot={rot} />
                <TouchableOpacity style={styles.turnBtn} onPress={() => setRot(r => (r + 1) & 3)}>
                    <Text style={styles.turnText}>↻</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
                <Text style={styles.label}>몸</Text>
                <View style={styles.chips}>
                    {(['female', 'male'] as const).map(b => (
                        <TouchableOpacity key={b} style={[styles.chip, draft.body === b && styles.chipOn]} onPress={() => set({ body: b })}>
                            <Text style={[styles.chipText, draft.body === b && styles.chipTextOn]}>{b === 'female' ? '여자' : '남자'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.label}>피부색</Text>
                <Swatches list={SKIN_COLORS} value={draft.skin} onPick={c => set({ skin: c })} />
                <Text style={styles.label}>머리색</Text>
                <Swatches list={HAIR_COLORS} value={draft.hair} onPick={c => set({ hair: c })} />

                {SLOTS.map(slot => (
                    <View key={slot} style={{ gap: 8 }}>
                        <Text style={styles.label}>{SLOT_LABEL[slot]}</Text>
                        <View style={styles.chips}>
                            {WEAR[slot].map(w => {
                                const on = draft[slot] === w.key;
                                const have = isOwned(w.key);
                                return (
                                    <TouchableOpacity key={w.key} style={[styles.chip, on && styles.chipOn]}
                                        onPress={() => set({ [slot]: w.key } as Partial<Outfit>)}>
                                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{w.name}</Text>
                                        {!have && (
                                            <View style={styles.chipPrice}>
                                                <Gem size={12} kind="topaz" />
                                                <Text style={styles.chipPriceText}>{w.price}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {slot === 'top' && (
                            <Swatches list={TOP_COLORS} value={draft.topColor} onPick={c => set({ topColor: c })} />
                        )}
                        {slot === 'bottom' && draft.top !== 'dress' && (
                            <Swatches list={BOTTOM_COLORS} value={draft.bottomColor} onPick={c => set({ bottomColor: c })} />
                        )}
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveBtn, (!changed || busy) && styles.saveOff]}
                    onPress={save}
                    disabled={!changed || busy}
                >
                    {busy ? <ActivityIndicator color="#fff" /> : (
                        <Text style={styles.saveText}>
                            {toBuy.length > 0 ? `사서 입기 · 토파즈 ${cost}` : changed ? '이렇게 입기' : '지금 입은 옷'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
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
    backBtn: { padding: 4, width: 36 },
    backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['3xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    preview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 8,
        backgroundColor: colors.paper2,
    },
    turnBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
    },
    turnText: { fontSize: 22, color: colors.ink[700] },
    list: { padding: 16, gap: 10, paddingBottom: 24 },
    label: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ink[700],
        marginTop: 6,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.pill,
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: colors.ink[200],
    },
    chipOn: { borderColor: colors.ocean[500], backgroundColor: colors.ocean[50] },
    chipText: { fontFamily: fontFamilies.bodyMed, fontSize: fontSizes.sm, color: colors.ink[700] },
    chipTextOn: { color: colors.ocean[700] },
    chipPrice: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    chipPriceText: { fontFamily: fontFamilies.num, fontSize: fontSizes.xs, fontWeight: '700', color: colors.ink[500] },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.ink[200],
    },
    swatchOn: { borderWidth: 3, borderColor: colors.ocean[500] },
    footer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: colors.ink[100],
        backgroundColor: colors.paper,
    },
    saveBtn: {
        backgroundColor: colors.ocean[500],
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveOff: { backgroundColor: colors.ink[200] },
    saveText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: '#fff' },
});
