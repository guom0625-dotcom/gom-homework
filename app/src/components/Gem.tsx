import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Line } from 'react-native-svg';
import { colors } from '../theme';

interface GemProps {
  size?: number;
}

export function Gem({ size = 24 }: GemProps) {
  // useId()는 ":r0:" 형식으로 콜론 포함 → url(#...) 참조 깨짐, sanitize 필수
  const rawId = React.useId();
  const gradId = React.useMemo(() => `gem${rawId.replace(/:/g, '')}`, [rawId]);

  const [lt, md, dk] = colors.diamond;

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={lt} />
          <Stop offset="60%"  stopColor={md} />
          <Stop offset="100%" stopColor={dk} />
        </LinearGradient>
      </Defs>
      {/* 다이아몬드 본체 */}
      <Path
        d="M16 2 L28 12 L16 30 L4 12 Z"
        fill={`url(#${gradId})`}
        stroke={dk}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* 중앙 세로 하이라이트 */}
      <Path
        d="M16 2 L20 12 L16 30 L12 12 Z"
        fill={md}
        fillOpacity={0.5}
      />
      {/* 가로 구분선 */}
      <Line
        x1="4" y1="12" x2="28" y2="12"
        stroke={dk}
        strokeWidth="1.2"
        strokeOpacity={0.6}
      />
      {/* 왼쪽 상단 반짝임 */}
      <Path
        d="M9 6 L10.5 9.5"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity={0.7}
      />
    </Svg>
  );
}
