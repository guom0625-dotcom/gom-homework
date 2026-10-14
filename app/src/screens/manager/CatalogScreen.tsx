import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl, TextInput, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import type { CatalogItem } from '../../store/appStore';
import { Gem } from '../../components/Gem';
import { Price } from '../../components/Price';
import { colors, fontFamilies, fontSizes, radius, shadows } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<ManagerStackParams, 'Catalog'> };

type FormData = {
    title: string;
    description: string;
    cost: string;      // 다이아
    costRuby: string;  // 루비
    kind: CatalogItem['kind'];
};

const KIND_LABEL: Record<CatalogItem['kind'], string> = { once: '1회성', always: '상시' };
const KIND_DESC: Record<CatalogItem['kind'], string> = {
    once: '한 번 팔리면 상점에서 사라져요',
    always: '상점에 계속 남아 여러 번 살 수 있어요',
};

const EMPTY_FORM: FormData = {
    title: '', description: '', cost: '1', costRuby: '0', kind: 'always',
};

function formFromItem(item: CatalogItem): FormData {
    return {
        title: item.title,
        description: item.description ?? '',
        cost: String(item.cost),
        costRuby: String(item.cost_ruby),
        kind: item.kind,
    };
}

function CostRow({ item }: { item: CatalogItem }) {
    return (
        <View style={styles.costRow}>
            <Price diamonds={item.cost} rubies={item.cost_ruby} size={13} />
            <View style={[styles.costChip, item.kind === 'once' && styles.kindChipOnce]}>
                <Text style={styles.costNum}>{KIND_LABEL[item.kind]}</Text>
            </View>
        </View>
    );
}

export function CatalogScreen({ navigation }: Props) {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editing, setEditing] = useState<CatalogItem | null>(null);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const data = await api<CatalogItem[]>('/catalog/all').catch(() =>
            api<CatalogItem[]>('/catalog')
        );
        setItems(data);
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load().catch(() => {});
        setRefreshing(false);
    }, [load]);

    const openNew = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setModalVisible(true);
    };

    const openEdit = (item: CatalogItem) => {
        setEditing(item);
        setForm(formFromItem(item));
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!form.title.trim()) {
            Alert.alert('오류', '이름을 입력해주세요');
            return;
        }
        const cost = Number(form.cost) || 0;
        const costRuby = Number(form.costRuby) || 0;
        if (!Number.isInteger(cost) || !Number.isInteger(costRuby) || cost < 0 || costRuby < 0 || cost + costRuby < 1) {
            Alert.alert('오류', '가격은 다이아와 루비를 합쳐 1개 이상이어야 해요');
            return;
        }
        const body = {
            title: form.title.trim(),
            description: form.description.trim() || null,
            cost,
            cost_ruby: costRuby,
            kind: form.kind,
        };
        setSaving(true);
        try {
            if (editing) {
                const updated = await api<CatalogItem>(`/catalog/${editing.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(body),
                });
                setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
            } else {
                const created = await api<CatalogItem>('/catalog', {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                setItems(prev => [created, ...prev]);
            }
            setModalVisible(false);
        } catch (e: unknown) {
            Alert.alert('오류', e instanceof Error ? e.message : '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (item: CatalogItem) => {
        Alert.alert(
            `"${item.title}" 삭제`,
            '이 보상 아이템을 삭제할까요?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api(`/catalog/${item.id}`, { method: 'DELETE' });
                            setItems(prev => prev.filter(i => i.id !== item.id));
                        } catch (e: unknown) {
                            Alert.alert('오류', e instanceof Error ? e.message : '삭제 실패');
                        }
                    },
                },
            ],
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.ocean[500]} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>보상 카탈로그</Text>
                <TouchableOpacity onPress={openNew} style={styles.addBtn}>
                    <Text style={styles.addText}>+ 추가</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={items}
                keyExtractor={i => i.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            등록된 보상이 없어요{'\n'}+ 추가 버튼으로 보상을 등록해보세요
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    // 카드를 누르면 수정, 삭제만 따로 버튼
                    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openEdit(item)}>
                        <View style={styles.cardBody}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            {item.description ? (
                                <Text style={styles.itemDesc}>{item.description}</Text>
                            ) : null}
                            <CostRow item={item} />
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                                <Text style={styles.deleteBtnText}>삭제</Text>
                            </TouchableOpacity>
                            <Text style={styles.chevron}>›</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModalVisible(false)}
            >
                <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Text style={styles.modalCancel}>취소</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {editing ? '보상 수정' : '보상 추가'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                            {saving
                                ? <ActivityIndicator color={colors.ocean[500]} />
                                : <Text style={styles.modalSave}>저장</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
                        <Text style={styles.fieldLabel}>이름 *</Text>
                        <TextInput
                            style={styles.input}
                            value={form.title}
                            onChangeText={v => setForm(f => ({ ...f, title: v }))}
                            placeholder="보상 이름"
                            placeholderTextColor={colors.ink[300]}
                        />

                        <Text style={styles.fieldLabel}>설명</Text>
                        <TextInput
                            style={[styles.input, styles.inputMulti]}
                            value={form.description}
                            onChangeText={v => setForm(f => ({ ...f, description: v }))}
                            placeholder="설명 (선택)"
                            placeholderTextColor={colors.ink[300]}
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.fieldLabel}>가격 (다이아 · 루비를 섞거나 하나만 써도 돼요)</Text>
                        <View style={styles.gemRow}>
                            <Gem size={18} />
                            <Text style={styles.gemLabel}>다이아</Text>
                            <TextInput
                                style={styles.gemInput}
                                value={form.cost}
                                onChangeText={v => setForm(f => ({ ...f, cost: v }))}
                                keyboardType="number-pad"
                                placeholder="1"
                                placeholderTextColor={colors.ink[300]}
                            />
                        </View>
                        <View style={styles.gemRow}>
                            <Gem size={18} kind="ruby" />
                            <Text style={styles.gemLabel}>루비</Text>
                            <TextInput
                                style={styles.gemInput}
                                value={form.costRuby}
                                onChangeText={v => setForm(f => ({ ...f, costRuby: v }))}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={colors.ink[300]}
                            />
                        </View>

                        <Text style={styles.fieldLabel}>판매 방식</Text>
                        <View style={styles.kindRow}>
                            {(['always', 'once'] as const).map(k => (
                                <TouchableOpacity
                                    key={k}
                                    style={[styles.kindBtn, form.kind === k && styles.kindBtnActive]}
                                    onPress={() => setForm(f => ({ ...f, kind: k }))}
                                >
                                    <Text style={[styles.kindBtnText, form.kind === k && styles.kindBtnTextActive]}>
                                        {KIND_LABEL[k]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.kindDesc}>{KIND_DESC[form.kind]}</Text>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
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
    backBtn: { padding: 4, width: 52 },
    backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
    title: {
        flex: 1,
        fontFamily: fontFamilies.display,
        fontSize: fontSizes['3xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    addBtn: { paddingHorizontal: 8, paddingVertical: 6 },
    addText: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.ocean[700],
    },
    list: { padding: 14, gap: 10 },
    empty: { paddingTop: 80, alignItems: 'center' },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[300],
        textAlign: 'center',
        lineHeight: 24,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...shadows.card,
    },
    cardBody: { flex: 1, gap: 4 },
    itemTitle: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ink[900],
    },
    itemDesc: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
    costRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
    costChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.paper2,
        borderRadius: radius.pill,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    costNum: {
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.xs,
        color: colors.ink[700],
        fontWeight: '700',
    },
    freeBadge: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.ocean[500],
        marginTop: 2,
    },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chevron: { fontSize: 22, color: colors.ink[300], paddingHorizontal: 2 },
    deleteBtn: {
        backgroundColor: colors.paper2,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignItems: 'center',
    },
    deleteBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.xs,
        color: colors.coral[500],
    },
    // Modal
    modal: { flex: 1, backgroundColor: colors.paper },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.ink[100],
    },
    modalCancel: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[500],
    },
    modalTitle: {
        fontFamily: fontFamilies.display,
        fontSize: fontSizes.xl,
        color: colors.ink[900],
    },
    modalSave: {
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSizes.base,
        color: colors.ocean[700],
    },
    formScroll: { flex: 1 },
    formContent: { padding: 16, gap: 6 },
    fieldLabel: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 12,
        marginBottom: 4,
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
        borderColor: colors.ink[100],
    },
    inputMulti: { height: 80, textAlignVertical: 'top' },
    kindChipOnce: { backgroundColor: colors.sun[300] },
    kindRow: { flexDirection: 'row', gap: 8 },
    kindBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: colors.ink[200],
    },
    kindBtnActive: { borderColor: colors.ocean[500], backgroundColor: colors.ocean[50] },
    kindBtnText: {
        fontFamily: fontFamilies.bodyMed,
        fontSize: fontSizes.base,
        color: colors.ink[500],
    },
    kindBtnTextActive: { color: colors.ocean[700] },
    kindDesc: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
        marginTop: 6,
    },
    gemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.ink[100],
    },
    gemLabel: {
        flex: 1,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.base,
        color: colors.ink[700],
    },
    gemInput: {
        width: 72,
        backgroundColor: colors.card,
        borderRadius: radius.sm,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontFamily: fontFamilies.num,
        fontSize: fontSizes.base,
        color: colors.ink[900],
        textAlign: 'right',
        borderWidth: 1,
        borderColor: colors.ink[100],
    },
});
