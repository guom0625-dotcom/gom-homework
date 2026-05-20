import React from 'react';
import { Pressable, Text, StyleSheet, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { buttonColors, fontFamilies, fontSizes, radius, type ButtonVariant } from '../theme';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

export function Button({
  variant = 'coral',
  size = 'md',
  label,
  children,
  onPress,
  style,
  textStyle,
  disabled = false,
}: ButtonProps) {
  const { bg, shadow, text } = buttonColors[variant];

  const padV = size === 'lg' ? 18 : size === 'sm' ? 10 : 14;
  const padH = size === 'lg' ? 28 : size === 'sm' ? 16 : 24;
  const fontSize = size === 'lg' ? fontSizes.xl : size === 'sm' ? fontSizes.md : fontSizes.lg;

  return (
    // 외부 View = 솔리드 4px 하단 그림자 시뮬레이션
    // Pressable의 marginBottom이 4→2로 줄어들면서 shadow View가 2px만 보임
    <View style={[{ borderRadius: radius.pill, backgroundColor: shadow, alignSelf: 'flex-start' }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          styles.inner,
          {
            backgroundColor: disabled ? '#ccc' : bg,
            borderRadius: radius.pill,
            paddingVertical: padV,
            paddingHorizontal: padH,
            marginTop: pressed ? 2 : 0,
            marginBottom: pressed ? 2 : 4,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        {children ?? (
          <Text style={[styles.text, { color: text, fontSize, fontFamily: fontFamilies.display }, textStyle]}>
            {label}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontFamily: fontFamilies.display,
  },
});
