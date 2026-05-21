import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, AppState, type AppStateStatus } from 'react-native';
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
import { Palm } from '../../components/Palm';
import { Button } from '../../components/Button';
import { StatusBanner } from '../../components/StatusBanner';
import { colors, fontFamilies, fontSizes, gradients, radius, shadows } from '../../theme';
import type { DayStatus, IslandState } from '../../lib/types';
import type { GemColor } from '../../theme';
import type { StudentStackParams } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';

const TOTAL_DAYS = 30;
const ISLAND_COUNT = 14;
const ISLAND_STEP = 95;
const MAP_WIDTH = ISLAND_COUNT * ISLAND_STEP + 60;
const MAP_HEIGHT = 360;

const GEM_COLORS: GemColor[] = ['amethyst', 'ruby', 'emerald', 'sapphire', 'topaz'];
const BONUS_DAYS = new Set([7, 14, 21, 30]);

function islandState(day: number, currentDay: number): IslandState {
  const state: IslandState =
    day < currentDay ? 'complete'
    : day === currentDay ? 'current'
    : (day === 7 || day === 14 || day === 21) && day <= currentDay ? 'complete'
    : (day === 7 || day === 14 || day === 21) ? 'bonus'
    : day > currentDay + 4 ? 'locked'
    : 'pending';

  const finalState: IslandState =
    (day === 7 && day > currentDay) ? 'bonus'
    : (day === 14 && day > currentDay) ? 'bonus'
    : state;

  return finalState;
}

const ACTION_LABEL: Record<DayStatus, string> = {
  todo:     '오늘의 할일 등록',
  pending:  '할일 목록 보기',
  approved: '다음 섬으로 가기 🚀',
  complete: '내일 다시 도전',
};

export function MainHorizontal() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParams>>();
  const { user } = useAuthStore();
  const { currentDay, dayStatus, points, gems, character, avatar, fetchMe, completeDay } = useAppStore();

  // 화면 포커스 시 데이터 갱신 (다른 화면 갔다 돌아올 때)
  useFocusEffect(useCallback(() => {
    fetchMe().catch(() => {});
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

  const islands = Array.from({ length: ISLAND_COUNT }, (_, i) => i + 1);

  const islandX = (i: number) => 50 + i * ISLAND_STEP;
  const islandY = (i: number) => 200 + Math.sin(i * 0.6) * 50;

  const pathD = islands
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${islandX(i)} ${islandY(i)}`)
    .join(' ');

  const daysUntilBonus = 7 - (currentDay % 7) || 7;

  const handleMainAction = async () => {
    if (dayStatus === 'todo') {
      navigation.navigate('TaskRegister', { day: currentDay });
    } else if (dayStatus === 'pending') {
      navigation.navigate('TaskList', { day: currentDay });
    } else if (dayStatus === 'approved') {
      try {
        await completeDay(currentDay);
      } catch (e: unknown) {
        Alert.alert('오류', e instanceof Error ? e.message : '오류가 발생했어요');
      }
    }
  };

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
            points={points}
            streak={currentDay}
          />
        </View>

        <View style={styles.dayBlock}>
          <View style={styles.dayRow}>
            <Text style={styles.dayLabel}>오늘은</Text>
            <Text style={styles.dayNum}>DAY {currentDay}</Text>
          </View>
          <Text style={styles.daySub}>
            / {TOTAL_DAYS}일 챌린지 · 다음 보너스까지 {daysUntilBonus}일
          </Text>
        </View>

        <View style={styles.mapArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
          >
            <Svg
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              style={StyleSheet.absoluteFillObject}
            >
              <Path
                d={pathD}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="3"
                fill="none"
                strokeDasharray="2 8"
                strokeLinecap="round"
              />
            </Svg>

            {islands.map((day, i) => {
              const x = islandX(i);
              const y = islandY(i);
              const state = islandState(day, currentDay);
              const isCurrent = day === currentDay;

              return (
                <View
                  key={day}
                  style={{ position: 'absolute', left: x - 42, top: y - 30 }}
                >
                  <IslandTile
                    state={state}
                    day={day}
                    size={80}
                    character={
                      isCurrent ? (
                        <Character type={character} size={48} mood="happy" />
                      ) : undefined
                    }
                    gem={<Gem size={30} color={GEM_COLORS[day % 5]} />}
                  />
                </View>
              );
            })}

            <Palm size={36} style={{ position: 'absolute', left: 22, top: 130 }} />
          </ScrollView>
        </View>

        <View style={styles.bottomSheet}>
          <StatusBanner status={dayStatus} day={currentDay} />

          <View style={styles.actionRow}>
            <View style={styles.sideBtn}>
              <Button
                variant="ghost"
                size="md"
                label="📋"
                style={styles.squareBtn}
                onPress={() => navigation.navigate('TaskList', { day: currentDay })}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Button
                variant={dayStatus === 'approved' ? 'ocean' : 'coral'}
                size="md"
                label={ACTION_LABEL[dayStatus]}
                style={styles.fullBtn}
                onPress={handleMainAction}
              />
            </View>

            <View style={styles.sideBtn}>
              <Button
                variant="ghost"
                size="md"
                label="💎"
                style={styles.squareBtn}
                onPress={() => navigation.navigate('Spend')}
              />
            </View>

            <View style={styles.sideBtn}>
              <Button
                variant="ghost"
                size="md"
                label="⚙️"
                style={styles.squareBtn}
                onPress={() => navigation.navigate('Profile')}
              />
            </View>
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
    fontSize: 48,
    color: '#fff',
    lineHeight: 52,
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
  sideBtn: { width: 52 },
  squareBtn: { alignSelf: 'stretch' },
  fullBtn: { alignSelf: 'stretch' },
});
