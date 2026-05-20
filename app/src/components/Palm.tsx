import React from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

interface PalmProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Palm({ size = 50, style }: PalmProps) {
  return (
    <View style={style}>
      <Svg width={size} height={size * 1.4} viewBox="0 0 50 70">
        <Path d="M22 70 Q25 50 28 35" stroke="#6b3f1c" strokeWidth="4" fill="none" strokeLinecap="round" />
        <Ellipse cx="22" cy="22" rx="14" ry="5" fill="#2dd4a4" transform="rotate(-30, 22, 22)" />
        <Ellipse cx="30" cy="20" rx="14" ry="5" fill="#62b878" transform="rotate(25, 30, 20)" />
        <Ellipse cx="20" cy="14" rx="12" ry="4" fill="#7ee0a8" transform="rotate(-10, 20, 14)" />
      </Svg>
    </View>
  );
}
