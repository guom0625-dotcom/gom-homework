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
  diamonds?: number;
  rubies?: number;
  streak?: number;
  photoUrl?: string;
}

export function TopHud({
  name = '지호',
  character = 'bear',
  mood = 'happy',
  diamonds = 0,
  rubies = 0,
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

      {/* 다이아 칩 */}
      <LinearGradient
        colors={gradients.gemChip}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.pointChip}
      >
        <Gem size={18} />
        <Text style={styles.pointNum}>{diamonds.toLocaleString()}</Text>
      </LinearGradient>

      {/* 루비 칩 */}
      <LinearGradient
        colors={gradients.rubyChip}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.pointChip}
      >
        <Gem size={18} kind="ruby" />
        <Text style={[styles.pointNum, styles.rubyNum]}>{rubies.toLocaleString()}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
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
    paddingRight: 10,
    borderRadius: 999,
  },
  rubyNum: { color: '#c4304f' },
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
