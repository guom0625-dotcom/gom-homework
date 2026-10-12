import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, AppState, useWindowDimensions,
  type AppStateStatus,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TopHud } from '../../components/TopHud';
import { IslandTile } from '../../components/IslandTile';
import { Character } from '../../components/Character';
import { Gem } from '../../components/Gem';
import { Cloud } from '../../components/Cloud';
import { Button } from '../../components/Button';
import { StatusBanner } from '../../components/StatusBanner';
import { colors, fontFamilies, fontSizes, gradients } from '../../theme';
import { dayParts, monthDays } from '../../lib/days';
import type { DayStatus, IslandState } from '../../lib/types';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';

// 이번 달 섬 지도 — 한 줄에 COLS개씩 비스듬히 내려가다 끝에서 방향을 바꾸는 굽이길
const COLS = 4;
const TILE = 76;
const TILE_H = 90;
const PAD_X = 22;
const PAD_TOP = 18;
const SLOPE = 24;                         // 한 칸 옆으로 갈 때마다 내려가는 높이
const WOBBLE = 8;                         // 섬마다 조금씩 어긋나는 정도
const ROW_STEP = (COLS - 1) * SLOPE + 112;
const PATH_Y = 62;                        // 타일 상단 → 섬 중심까지

const ACTION_LABEL: Record<DayStatus, string> = {
  todo:     '오늘의 할일 등록',
  pending:  '할일 목록 보기',
  approved: '오늘 할일 완료! 🎉',
};

// 하단 양옆의 작은 버튼 — 이모지 + 이름
function SideButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <View style={styles.sideBtn}>
      <Button variant="ghost" compact style={styles.squareBtn} onPress={onPress}>
        <View style={styles.sideBtnInner}>
          <Text style={styles.sideBtnIcon}>{icon}</Text>
          <Text style={styles.sideBtnLabel}>{label}</Text>
        </View>
      </Button>
    </View>
  );
}

export function MainScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParams>>();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const { today, joinedDay, dayStatus, diamonds, streak, monthProgress, character, avatar, fetchMe } = useAppStore();

  // 화면 포커스 시 데이터 갱신 + 포커스 유지 중 30초 폴링
  useFocusEffect(useCallback(() => {
    fetchMe().catch(() => {});
    const timer = setInterval(() => { fetchMe().catch(() => {}); }, 30_000);
    return () => clearInterval(timer);
  }, []));

  // 앱이 백그라운드에서 포그라운드로 올 때 갱신
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        fetchMe().catch(() => {});
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  const days = useMemo(() => (today ? monthDays(today) : []), [today]);
  const doneDays = useMemo(
    () => new Set(monthProgress.filter(p => p.total > 0 && p.approved === p.total).map(p => p.day)),
    [monthProgress],
  );

  const rows = Math.ceil(days.length / COLS);
  const mapHeight = PAD_TOP + (rows - 1) * ROW_STEP + (COLS - 1) * SLOPE + WOBBLE + TILE_H + 20;
  const colStep = (width - PAD_X * 2 - TILE) / (COLS - 1);
  const wobbleX = Math.max(0, Math.min(WOBBLE, (colStep - TILE) / 2 - 1));

  // 타일 좌상단 좌표. 줄마다 좌↔우로 방향을 바꾸며 계속 아래로 내려간다
  const islandPos = (i: number) => {
    const row = Math.floor(i / COLS);
    const pos = i % COLS;
    const col = row % 2 === 0 ? pos : COLS - 1 - pos;
    return {
      x: PAD_X + col * colStep + Math.sin(i * 1.7) * wobbleX,
      y: PAD_TOP + row * ROW_STEP + pos * SLOPE + Math.cos(i * 2.3) * WOBBLE,
    };
  };

  // 섬 중심을 부드럽게 잇는 곡선 (Catmull-Rom → 베지어)
  const pathD = useMemo(() => {
    const pts = days.map((_, i) => {
      const { x, y } = islandPos(i);
      return { x: x + TILE / 2, y: y + PATH_Y };
    });
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6},`
        + ` ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [days, width]);

  // 길이 비껴가는 빈 바다(줄이 시작되는 쪽 아래)에 잔물결
  const waves = useMemo(() => {
    const list: { x: number; y: number }[] = [];
    for (let row = 0; row < rows - 1; row++) {
      const x = row % 2 === 0 ? PAD_X + TILE / 2 : width - PAD_X - TILE / 2;
      list.push({ x, y: PAD_TOP + row * ROW_STEP + ROW_STEP / 2 + TILE_H / 2 + SLOPE });
    }
    return list;
  }, [rows, width]);

  const islandState = (day: number): IslandState =>
    day > today ? 'locked'
    : day === today ? 'current'
    : doneDays.has(day) ? 'complete'
    : day < joinedDay ? 'pending'
    : 'missed';

  // 오늘 섬이 보이도록 스크롤
  const scrollRef = useRef<ScrollView>(null);
  const scrollToToday = useCallback(() => {
    if (!today) return;
    const { y } = islandPos(dayParts(today).d - 1);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 150), animated: false });
  }, [today, width]);
  useEffect(scrollToToday, [scrollToToday]);

  const handleMainAction = () => {
    if (dayStatus === 'todo') navigation.navigate('TaskRegister', { day: today });
    else navigation.navigate('TaskList', { day: today });
  };

  const { m, d } = dayParts(today);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient colors={gradients.sea} style={styles.bg}>
        <Cloud size={70}  opacity={0.8}  style={styles.cloud1} />
        <Cloud size={50}  opacity={0.65} style={styles.cloud2} />
        <Cloud size={90}  opacity={0.55} style={styles.cloud3} />

        <View style={styles.hudWrap}>
          <TopHud
            name={user?.name ?? ''}
            character={character}
            photoUrl={avatar ?? undefined}
            diamonds={diamonds}
            streak={streak}
          />
        </View>

        {today > 0 && (
          <View style={styles.dayBlock}>
            <View style={styles.dayRow}>
              <Text style={styles.dayLabel}>오늘은</Text>
              <Text style={styles.dayNum}>{m}월 {d}일</Text>
            </View>
            <Text style={styles.daySub}>
              {m}월의 섬 {days.length}개 · 정복한 섬 {doneDays.size}개
            </Text>
          </View>
        )}

        <View style={styles.mapArea}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ height: mapHeight }}
            onLayout={scrollToToday}
          >
            <Svg width={width} height={mapHeight} style={StyleSheet.absoluteFillObject}>
              <Path
                d={pathD}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="3"
                fill="none"
                strokeDasharray="2 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {waves.map((w, i) => (
                <Path
                  key={i}
                  d={`M ${w.x - 20} ${w.y} q 5 -6 10 0 t 10 0 t 10 0 t 10 0 M ${w.x - 8} ${w.y + 12} q 5 -6 10 0 t 10 0 t 10 0`}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
            </Svg>

            {days.map((day, i) => {
              const { x, y } = islandPos(i);
              const state = islandState(day);

              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.8}
                  disabled={state === 'locked'}
                  style={{ position: 'absolute', left: x, top: y }}
                  onPress={() => navigation.navigate('TaskList', { day })}
                >
                  <IslandTile
                    state={state}
                    label={`${dayParts(day).d}일`}
                    size={TILE}
                    character={
                      state === 'current' ? (
                        <Character type={character} size={46} mood="happy" />
                      ) : undefined
                    }
                    gem={<Gem size={28} />}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.bottomSheet}>
          <StatusBanner status={dayStatus} />

          <View style={styles.actionRow}>
            <SideButton icon="📋" label="목록" onPress={() => navigation.navigate('TaskList', { day: today })} />

            <View style={{ flex: 1 }}>
              <Button
                variant={dayStatus === 'approved' ? 'ocean' : 'coral'}
                size="md"
                label={ACTION_LABEL[dayStatus]}
                style={styles.fullBtn}
                onPress={handleMainAction}
              />
            </View>

            <SideButton icon="💎" label="상점" onPress={() => navigation.navigate('Spend')} />

            <SideButton icon="⚙️" label="설정" onPress={() => navigation.navigate('Profile')} />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  bg: { flex: 1, position: 'relative' },
  cloud1: { position: 'absolute', top: 16,  left: 14 },
  cloud2: { position: 'absolute', top: 60,  right: 30 },
  cloud3: { position: 'absolute', top: 110, left: 130 },
  hudWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    zIndex: 5,
  },
  dayBlock: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    zIndex: 4,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  dayLabel: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.md,
    color: '#fff',
    opacity: 0.9,
  },
  dayNum: {
    fontFamily: fontFamilies.display,
    fontSize: 40,
    color: '#fff',
    lineHeight: 46,
    textShadowColor: 'rgba(29,35,48,0.18)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  daySub: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.sm,
    color: '#fff',
    opacity: 0.85,
    marginTop: 2,
  },
  mapArea: { flex: 1 },
  bottomSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  sideBtn: { width: 54 },
  sideBtnInner: { alignItems: 'center' },
  sideBtnIcon: { fontSize: 18, lineHeight: 22 },
  sideBtnLabel: {
    fontFamily: fontFamilies.bodyMed,
    fontSize: 10,
    lineHeight: 14,
    color: colors.ink[700],
  },
  squareBtn: { alignSelf: 'stretch' },
  fullBtn: { alignSelf: 'stretch' },
});
