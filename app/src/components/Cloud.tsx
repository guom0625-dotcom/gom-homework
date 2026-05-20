import React from 'react';
import Svg, { Ellipse } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

interface CloudProps {
  size?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

export function Cloud({ size = 60, opacity = 0.85, style }: CloudProps) {
  return (
    <View style={[{ opacity }, style]}>
      <Svg width={size} height={size * 0.6} viewBox="0 0 100 60">
        <Ellipse cx="25" cy="40" rx="22" ry="16" fill="#fff" />
        <Ellipse cx="50" cy="30" rx="28" ry="20" fill="#fff" />
        <Ellipse cx="75" cy="40" rx="22" ry="16" fill="#fff" />
      </Svg>
    </View>
  );
}
