import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, fontFamilies, fontSizes } from '../theme';
import type { DayStatus } from '../lib/types';

type GradColors = readonly [string, string, ...string[]];
const CONFIG: Record<DayStatus, { grad: GradColors; color: string; text: string; icon: string }> = {
  todo:     { grad: gradients.statusTodo,     color: '#d94545', text: '오늘의 할일을 등록하세요',   icon: '📝' },
  pending:  { grad: gradients.statusPending,  color: '#c98c00', text: '매니저가 확인하러 올거예요',  icon: '🔍' },
  approved: { grad: gradients.statusApproved, color: '#0e8a66', text: '모두 통과! 다음 섬으로',    icon: '✨' },
  complete: { grad: gradients.statusComplete, color: '#4d36c4', text: '오늘도 완료! 내일 또 봐요', icon: '🎉' },
};

interface StatusBannerProps {
  status: DayStatus;
  day?: number;
}

export function StatusBanner({ status, day }: StatusBannerProps) {
  const cfg = CONFIG[status];
  const text = status === 'complete' && day != null
    ? `Day ${day} 완료! 내일 또 봐요`
    : cfg.text;

  return (
    <LinearGradient
      colors={cfg.grad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Text style={styles.icon}>{cfg.icon}</Text>
      <Text style={[styles.text, { color: cfg.color }]}>{text}</Text>
      <Text style={[styles.arrow, { color: cfg.color }]}>›</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
  },
  arrow: {
    fontSize: fontSizes.lg,
  },
});
