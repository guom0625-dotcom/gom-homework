import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gem } from './Gem';
import { Character } from './Character';
import { colors, fontFamilies, fontSizes, gradients, shadows } from '../theme';
import type { CharacterType, CharacterMood } from '../lib/types';

interface TopHudProps {
  name?: string;
  character?: CharacterType;
  mood?: CharacterMood;
  points?: number;
  streak?: number;
  photoUrl?: string;
}

export function TopHud({
  name = '지호',
  character = 'bear',
  mood = 'happy',
  points = 0,
  streak = 0,
  photoUrl,
}: TopHudProps) {
  return (
    <View style={styles.container}>
      <Character type={character} size={36} mood={mood} photoUrl={photoUrl} />

      <View style={styles.nameBlock}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.streak}>🔥 {streak}일 연속</Text>
      </View>

      {/* 포인트 칩 — emerald 그라데이션 */}
      <LinearGradient
        colors={gradients.gemChipEmerald}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.pointChip}
      >
        <Gem size={20} color="emerald" />
        <Text style={styles.pointNum}>{points.toLocaleString()}</Text>
        <Text style={styles.pointUnit}>pt</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    ...shadows.hud,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.md,
    color: colors.ink[900],
    lineHeight: 18,
  },
  streak: {
    fontFamily: fontFamilies.num,
    fontSize: fontSizes.xs,
    color: colors.ink[500],
    marginTop: 2,
  },
  pointChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
  },
  pointNum: {
    fontFamily: fontFamilies.num,
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.ocean[700],
  },
  pointUnit: {
    fontFamily: fontFamilies.num,
    fontSize: fontSizes.xs,
    color: colors.ocean[700],
    opacity: 0.7,
    marginLeft: -2,
  },
});
