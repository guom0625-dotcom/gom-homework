import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, Rect, Path, Circle } from 'react-native-svg';
import type { IslandState } from '../lib/types';
import { colors, fontFamilies, fontSizes } from '../theme';

const BASE_COLORS: Record<IslandState, { top: string; mid: string; base: string }> = {
  pending:  { top: '#9ad9a8', mid: '#62b878', base: '#3f8253' },
  current:  { top: '#ffe48a', mid: '#ffc83a', base: '#c98c00' },
  complete: { top: '#a8d8b9', mid: '#7ec8a0', base: '#4d9670' },
  locked:   { top: '#cdd2dd', mid: '#9aa1b3', base: '#6b7488' },
  bonus:    { top: '#ffc3d2', mid: '#ff7da0', base: '#c4304f' },
};

interface IslandTileProps {
  state?: IslandState;
  day: number;
  size?: number;
  character?: React.ReactNode;
  gem?: React.ReactNode;
}

export function IslandTile({ state = 'pending', day, size = 84, character, gem }: IslandTileProps) {
  const w = size;
  const h = size * 0.7;
  const c = BASE_COLORS[state];

  return (
    <View style={{ width: w, height: h + 36, position: 'relative' }}>
      {/* DAY 라벨 */}
      <View style={[styles.dayLabel, { borderColor: c.mid }]}>
        <Text style={[styles.dayText, { color: c.base }]}>DAY {day}</Text>
      </View>

      {/* 섬 SVG — explicit 숫자 (% 금지) */}
      <Svg
        width={w}
        height={h + 30}
        viewBox={`0 0 ${w} ${h + 30}`}
        style={{ position: 'absolute', top: 20, left: 0 }}
      >
        {/* 섬 기반 (3층 타원) */}
        <Ellipse cx={w / 2} cy={h * 0.95} rx={w * 0.42} ry={h * 0.18} fill={c.base} />
        <Ellipse cx={w / 2} cy={h * 0.75} rx={w * 0.46} ry={h * 0.22} fill={c.mid} />
        <Ellipse cx={w / 2} cy={h * 0.55} rx={w * 0.4}  ry={h * 0.2}  fill={c.top} />
        {/* 잠김 상태 안개 오버레이 */}
        {state === 'locked' && (
          <Ellipse cx={w / 2} cy={h * 0.55} rx={w * 0.4} ry={h * 0.2} fill="#fff" fillOpacity={0.35} />
        )}
      </Svg>

      {/* 섬 위 콘텐츠 */}
      <View style={[styles.content, { top: h * 0.05 + 12 }]}>
        {state === 'current' && character}

        {state === 'complete' && gem}

        {state === 'pending' && (
          <View style={styles.pendingCircle} />
        )}

        {state === 'locked' && (
          <Svg width="26" height="30" viewBox="0 0 26 30">
            <Rect x="3" y="14" width="20" height="14" rx="3" fill={colors.ink[500]} />
            <Path d="M7 14 V10 a6 6 0 0 1 12 0 V14" stroke={colors.ink[500]} strokeWidth="3" fill="none" />
            <Circle cx="13" cy="21" r="2.5" fill="#fff" />
          </Svg>
        )}

        {state === 'bonus' && (
          <Svg width="34" height="30" viewBox="0 0 34 30">
            <Rect x="3" y="10" width="28" height="18" rx="3" fill="#8b4513" />
            <Path d="M3 14 Q17 4 31 14 V18 H3Z" fill="#a0522d" />
            <Rect x="14" y="14" width="6" height="6" fill={colors.sun[500]} />
            <Rect x="15.5" y="15.5" width="3" height="3" fill="#fff" fillOpacity={0.6} />
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayLabel: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  dayText: {
    fontFamily: fontFamilies.num,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 2,
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  pendingCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 3, borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
