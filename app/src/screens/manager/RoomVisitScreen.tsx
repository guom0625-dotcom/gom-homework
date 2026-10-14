import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ManagerStackParams } from '../../navigation/RootNavigator';
import { api } from '../../api/client';
import { MiniRoom } from '../../components/MiniRoom';
import { makeLayout, type Room } from '../../lib/miniroom';
import { colors, fontFamilies, fontSizes } from '../../theme';

type Props = {
    navigation: NativeStackNavigationProp<ManagerStackParams, 'RoomVisit'>;
    route: RouteProp<ManagerStackParams, 'RoomVisit'>;
};

// 학생이 꾸민 방 구경 (보기만)
export function RoomVisitScreen({ navigation, route }: Props) {
    const { studentId, studentName } = route.params;
    const { width } = useWindowDimensions();
    const layout = useMemo(() => makeLayout(width - 16), [width]);
    const [room, setRoom] = useState<Room | null>(null);
    const [error, setError] = useState(false);

    useFocusEffect(useCallback(() => {
        api<Room>(`/room?student_id=${encodeURIComponent(studentId)}`)
            .then(r => { setRoom(r); setError(false); })
            .catch(() => setError(true));
    }, [studentId]));

    const placed = room?.items.filter(i => i.placed) ?? [];
    const stored = (room?.items.length ?? 0) - placed.length;

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{studentName}의 방</Text>
                <View style={{ width: 36 }} />
            </View>
            {!room ? (
                <View style={styles.center}>
                    {error
                        ? <Text style={styles.info}>방을 불러오지 못했어요</Text>
                        : <ActivityIndicator size="large" color={colors.ocean[500]} />}
                </View>
            ) : (
                <View style={styles.body}>
                    <MiniRoom layout={layout} wall={room.wall} floor={room.floor} items={placed} />
                    <Text style={styles.info}>
                        {room.items.length === 0
                            ? '아직 가구가 없어요'
                            : `방에 놓은 가구 ${placed.length}개 · 창고 ${stored}개`}
                    </Text>
                </View>
            )}
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
        fontSize: fontSizes['2xl'],
        color: colors.ink[900],
        textAlign: 'center',
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    body: { alignItems: 'center', paddingTop: 12, gap: 14 },
    info: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.sm,
        color: colors.ink[500],
    },
});
