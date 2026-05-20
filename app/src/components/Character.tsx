import React from 'react';
import Svg, {
  Circle, Path, Ellipse, ClipPath, Defs,
  Image as SvgImage,  // RN Image와 충돌 방지
} from 'react-native-svg';
import type { CharacterType, CharacterMood } from '../lib/types';

const PRESETS: Record<CharacterType, { body: string; face: string; ear: string }> = {
  bear: { body: '#c98851', face: '#f0c89c', ear: '#a26f3d' },
  fox:  { body: '#ff8855', face: '#ffd6b8', ear: '#d96222' },
  cat:  { body: '#3a4254', face: '#6b7488', ear: '#1d2330' },
  owl:  { body: '#7b61ff', face: '#e3ddff', ear: '#4d36c4' },
};

interface CharacterProps {
  type?: CharacterType;
  size?: number;
  mood?: CharacterMood;
  hatColor?: string;
  photoUrl?: string;
}

export function Character({
  type = 'bear',
  size = 60,
  mood = 'happy',
  hatColor,
  photoUrl,
}: CharacterProps) {
  const p = PRESETS[type] ?? PRESETS.bear;

  // useId() → ":r0:" 형태 콜론 포함 → SVG url(#) 참조 깨짐 → sanitize
  const rawId = React.useId();
  const clipId = React.useMemo(() => `faceClip${rawId.replace(/:/g, '')}`, [rawId]);

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* 귀 — 캐릭터 종류별 */}
      {type === 'bear' && (
        <>
          <Circle cx="14" cy="20" r="8" fill={p.body} />
          <Circle cx="14" cy="20" r="4" fill={p.face} />
          <Circle cx="50" cy="20" r="8" fill={p.body} />
          <Circle cx="50" cy="20" r="4" fill={p.face} />
        </>
      )}
      {type === 'fox' && (
        <>
          <Path d="M8 26 L14 8 L24 22 Z" fill={p.body} stroke={p.ear} strokeWidth="1" />
          <Path d="M56 26 L50 8 L40 22 Z" fill={p.body} stroke={p.ear} strokeWidth="1" />
        </>
      )}
      {type === 'cat' && (
        <>
          <Path d="M12 30 L16 12 L26 24 Z" fill={p.body} />
          <Path d="M52 30 L48 12 L38 24 Z" fill={p.body} />
        </>
      )}
      {type === 'owl' && (
        <>
          <Path d="M14 28 Q10 14 22 14 Q22 22 14 28 Z" fill={p.body} />
          <Path d="M50 28 Q54 14 42 14 Q42 22 50 28 Z" fill={p.body} />
        </>
      )}

      {/* 머리 */}
      <Circle cx="32" cy="36" r="22" fill={p.body} />

      {/* 얼굴 마스크 or 사진 */}
      {!photoUrl && (
        <Ellipse cx="32" cy="40" rx="16" ry="14" fill={p.face} />
      )}
      {photoUrl && (
        <>
          <Defs>
            <ClipPath id={clipId}>
              <Ellipse cx="32" cy="40" rx="16" ry="14" />
            </ClipPath>
          </Defs>
          <SvgImage
            href={{ uri: photoUrl }}
            x="14" y="24" width="36" height="32"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          <Ellipse
            cx="32" cy="40" rx="16" ry="14"
            fill="none" stroke={p.ear} strokeWidth="1.2"
          />
        </>
      )}

      {/* 모자 */}
      {hatColor && (
        <>
          <Ellipse cx="32" cy="18" rx="20" ry="3" fill={hatColor} />
          <Path d="M16 18 Q32 -4 48 18 Z" fill={hatColor} />
          <Circle cx="32" cy="6" r="3" fill="#fff" />
        </>
      )}

      {/* 눈 / 표정 — 사진 없을 때만 */}
      {!photoUrl && mood === 'happy' && (
        <>
          <Path d="M24 36 Q26 33 28 36" stroke="#1d2330" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M36 36 Q38 33 40 36" stroke="#1d2330" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {!photoUrl && mood === 'sleep' && (
        <>
          <Path d="M23 36 L29 36" stroke="#1d2330" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M35 36 L41 36" stroke="#1d2330" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {!photoUrl && mood === 'wow' && (
        <>
          <Circle cx="26" cy="36" r="2.4" fill="#1d2330" />
          <Circle cx="38" cy="36" r="2.4" fill="#1d2330" />
          <Circle cx="26.7" cy="35.3" r="0.8" fill="#fff" />
          <Circle cx="38.7" cy="35.3" r="0.8" fill="#fff" />
        </>
      )}

      {/* 코 / 부리 — 사진 없을 때만 */}
      {!photoUrl && type === 'owl' && (
        <Path d="M30 42 L34 42 L32 46 Z" fill="#ffc83a" stroke={p.ear} strokeWidth="0.8" />
      )}
      {!photoUrl && type !== 'owl' && (
        <Ellipse cx="32" cy="44" rx="2.5" ry="1.8" fill="#1d2330" />
      )}

      {/* 볼 홍조 — 사진 없을 때만 */}
      {!photoUrl && (
        <>
          <Circle cx="22" cy="44" r="2.5" fill="#ff8a8a" fillOpacity={0.45} />
          <Circle cx="42" cy="44" r="2.5" fill="#ff8a8a" fillOpacity={0.45} />
        </>
      )}
    </Svg>
  );
}
