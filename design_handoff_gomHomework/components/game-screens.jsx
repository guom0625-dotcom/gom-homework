// game-screens.jsx — 게임 요소 화면들
//   • BonusScreen      — Day 7/14/21 보너스 섬 (보물 상자 열기)
//   • AchievementsScreen — 업적/배지 컬렉션
//   • CustomizeScreen  — 얼굴 사진 + 캐릭터 + 모자 커스터마이즈
//   • DailyMissionCard — 메인 화면에 끼울 수 있는 미니 카드

// ─────────────────────────────────────────────────────────────
// Confetti — absolute-positioned colored dots
// ─────────────────────────────────────────────────────────────
function Confetti({ count = 40 }) {
  const colors = ['#ff6b6b', '#ffc83a', '#2dd4a4', '#3a96ff', '#7b61ff', '#ff8855'];
  const pieces = React.useMemo(() => (
    Array.from({ length: count }).map((_, i) => ({
      left: Math.random() * 100,
      top: Math.random() * 90,
      rot: Math.random() * 360,
      size: 6 + Math.random() * 8,
      color: colors[i % colors.length],
      shape: i % 3,
    }))
  ), [count]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.left}%`, top: `${p.top}%`,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.shape === 0 ? '50%' : p.shape === 1 ? 2 : 0,
          transform: `rotate(${p.rot}deg)`,
          opacity: 0.9,
        }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TreasureChest — SVG illustration, open/closed states
// ─────────────────────────────────────────────────────────────
function TreasureChest({ size = 180, open = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="chest-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c98851"/>
          <stop offset="100%" stopColor="#8b4513"/>
        </linearGradient>
        <linearGradient id="chest-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7d6" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#ffe070" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* Glow */}
      {open && (
        <path d="M 40 100 L 100 20 L 160 100 Z" fill="url(#chest-glow)" opacity="0.7"/>
      )}
      {/* Base box */}
      <rect x="30" y="100" width="140" height="70" rx="6" fill="url(#chest-wood)"/>
      <rect x="30" y="100" width="140" height="14" fill="#6b3f1c" opacity="0.4"/>
      {/* Bands */}
      <rect x="30" y="130" width="140" height="6" fill="#ffc83a"/>
      <rect x="30" y="156" width="140" height="6" fill="#ffc83a"/>
      <rect x="92" y="100" width="16" height="70" fill="#ffc83a"/>
      {/* Lock */}
      <rect x="92" y="130" width="16" height="14" fill="#c98c00"/>
      <circle cx="100" cy="137" r="2" fill="#fff"/>
      {/* Lid */}
      {open ? (
        <>
          <path d="M 30 100 Q 30 60 100 50 Q 170 60 170 100 Z"
            fill="url(#chest-wood)" stroke="#6b3f1c" strokeWidth="1.5"
            transform="rotate(-25 30 100)"/>
          {/* Gems spilling */}
          <g transform="translate(60, 70)"><Gem size={20} color="ruby"/></g>
          <g transform="translate(100, 50)"><Gem size={32} color="amethyst"/></g>
          <g transform="translate(130, 80)"><Gem size={18} color="emerald"/></g>
          <g transform="translate(80, 90)"><Gem size={16} color="topaz"/></g>
        </>
      ) : (
        <path d="M 30 105 Q 30 80 100 75 Q 170 80 170 105 Z"
          fill="url(#chest-wood)" stroke="#6b3f1c" strokeWidth="1.5"/>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// BonusScreen — Day 7/14/21 천 도달시 보너스 섬
// ─────────────────────────────────────────────────────────────
function BonusScreen({ day = 7, character = 'bear', photoUrl }) {
  return (
    <div className="app" style={{
      height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #4d36c4 0%, #7b61ff 50%, #ff8855 100%)',
      position: 'relative',
    }}>
      <Confetti count={40}/>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 16px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="chip num" style={{
          background: 'rgba(255,255,255,.18)', color: '#fff',
          border: '1px solid rgba(255,255,255,.3)', backdropFilter: 'blur(8px)',
          padding: '6px 14px',
        }}>
          ✨ {day}일 챌린지 보너스 ✨
        </div>
      </div>

      {/* Big title */}
      <div style={{ position: 'relative', zIndex: 2, padding: '14px 24px',
        textAlign: 'center', color: '#fff' }}>
        <div className="display" style={{
          fontSize: 38, lineHeight: 1.1,
          textShadow: '0 4px 0 rgba(0,0,0,.18)',
        }}>
          비밀의 섬 발견!
        </div>
        <div style={{ fontSize: 14, opacity: .9, marginTop: 6 }}>
          {day}일 연속 완수해서 도착한 곳
        </div>
      </div>

      {/* Treasure chest center */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: 6,
        display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: -20, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.4), transparent 65%)',
            filter: 'blur(8px)',
          }}/>
          <TreasureChest size={200} open/>
        </div>
      </div>

      {/* Character standing next to chest */}
      <div style={{ position: 'absolute', left: 24, top: 320, zIndex: 3 }}>
        <Character type={character} size={84} mood="wow" photoUrl={photoUrl}/>
      </div>

      {/* Reward card */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 30, zIndex: 5,
        background: '#fff', borderRadius: 24, padding: 18,
        boxShadow: '0 10px 40px rgba(0,0,0,.3)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center' }}>
          획득한 보상
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <RewardTile label="자수정 ×1" count="+25pt" color="amethyst"/>
          <RewardTile label="에메랄드 ×3" count="+15pt" color="emerald"/>
          <RewardTile label="레인보우" count="희귀!" color="ruby" special/>
        </div>
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 12,
          background: 'var(--paper-2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 22 }}>🎩</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>새 모자 잠금 해제!</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              프로필에서 캐릭터에 씌워보세요
            </div>
          </div>
        </div>
        <button className="btn btn--coral btn--full display"
          style={{ marginTop: 14, fontSize: 17 }}>
          계속 모험하기 →
        </button>
      </div>
    </div>
  );
}

function RewardTile({ label, count, color, special }) {
  return (
    <div style={{
      padding: '12px 6px', borderRadius: 14, textAlign: 'center',
      background: special ? 'linear-gradient(135deg,#ffd3df,#ffc3d2)' : 'var(--paper-2)',
      border: special ? '2px solid #ff7da0' : '1px solid var(--ink-100)',
      position: 'relative',
    }}>
      {special && (
        <div style={{
          position: 'absolute', top: -8, right: -4,
          background: '#ff5a7a', color: '#fff',
          fontSize: 9, fontWeight: 700, padding: '2px 6px',
          borderRadius: 999, boxShadow: '0 2px 0 #c4304f',
        }}>희귀</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
        <Gem size={32} color={color}/>
      </div>
      <div className="num display" style={{ fontSize: 16, color: 'var(--ink-900)' }}>
        {count}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AchievementsScreen — 업적 배지 컬렉션
// ─────────────────────────────────────────────────────────────
function AchievementsScreen() {
  const badges = [
    { name: '첫 걸음', desc: 'Day 1 완수', emoji: '👶', earned: true, color: '#7ee0a8' },
    { name: '연속 7일', desc: '일주일 완수', emoji: '🔥', earned: true, color: '#ff8855' },
    { name: '연속 30일', desc: '한달 챌린지', emoji: '🏆', earned: false, color: '#ffc83a' },
    { name: '수학 마스터', desc: '수학 10번 완수', emoji: '🧮', earned: true, color: '#3a96ff' },
    { name: '독서왕', desc: '책 5권 읽기', emoji: '📚', earned: true, color: '#7b61ff' },
    { name: '완벽주의자', desc: '한번에 모두 승인', emoji: '⭐', earned: false, color: '#ff5a7a' },
    { name: '보석 수집가', desc: '500개 모으기', emoji: '💎', earned: false, color: '#2dd4a4' },
    { name: '얼리버드', desc: '아침 9시 전 완수', emoji: '🌅', earned: true, color: '#ffd23f' },
    { name: '깨끗한 글씨', desc: '5번 칭찬받기', emoji: '✍️', earned: false, color: '#c6b5ff' },
  ];
  const earned = badges.filter(b => b.earned).length;

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 20, flex: 1 }}>업적 컬렉션</div>
      </div>

      {/* Progress hero */}
      <div style={{ padding: '6px 16px 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4d36c4, #7b61ff)',
          borderRadius: 20, padding: 18, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 4px 0 rgba(77,54,196,.3)',
        }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, opacity: .85 }}>모은 배지</div>
            <div className="num display" style={{ fontSize: 28, lineHeight: 1 }}>
              {earned} / {badges.length}
            </div>
            <div style={{ marginTop: 6, height: 6, borderRadius: 999,
              background: 'rgba(255,255,255,.2)' }}>
              <div style={{ width: `${(earned/badges.length)*100}%`, height: '100%',
                background: 'linear-gradient(90deg,#ffe070,#ff8855)', borderRadius: 999 }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Badges grid */}
      <div style={{ padding: '0 16px 30px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          모은 배지
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {badges.filter(b => b.earned).map((b, i) => <BadgeCell key={i} {...b}/>)}
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          아직 못 얻은 배지
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {badges.filter(b => !b.earned).map((b, i) => <BadgeCell key={i} {...b}/>)}
        </div>
      </div>
    </div>
  );
}

function BadgeCell({ name, desc, emoji, earned, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '14px 8px',
      textAlign: 'center', position: 'relative',
      border: earned ? `2px solid ${color}` : '1.5px solid var(--ink-100)',
      boxShadow: earned ? '0 2px 0 rgba(29,35,48,.08)' : 'none',
      opacity: earned ? 1 : 0.45,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: earned ? `${color}33` : 'var(--ink-100)',
        margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
        filter: earned ? 'none' : 'grayscale(1)',
      }}>{emoji}</div>
      <div className="display" style={{ fontSize: 12, color: 'var(--ink-900)' }}>{name}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>{desc}</div>
      {!earned && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 12 }}>🔒</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CustomizeScreen — 캐릭터 + 얼굴 사진 + 모자 커스터마이즈
// ─────────────────────────────────────────────────────────────
function CustomizeScreen() {
  const [type, setType] = React.useState('bear');
  const [hat, setHat] = React.useState(null);
  // Demo photo via SVG data URL — a colored gradient as a stand-in selfie
  const [usePhoto, setUsePhoto] = React.useState(false);
  const demoPhoto = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
       <defs><radialGradient id="g" cx="40%" cy="35%" r="80%">
         <stop offset="0%" stop-color="#ffe5d2"/>
         <stop offset="100%" stop-color="#d4a279"/>
       </radialGradient></defs>
       <rect width="100" height="100" fill="url(#g)"/>
       <text x="50%" y="55%" text-anchor="middle" font-size="28" fill="#3a2820" font-family="sans-serif" font-weight="600">😊</text>
     </svg>`
  );

  const hats = [
    { id: null, name: '없음', col: 'transparent' },
    { id: '#ff6b6b', name: '빨강', col: '#ff6b6b' },
    { id: '#3a96ff', name: '파랑', col: '#3a96ff' },
    { id: '#7b61ff', name: '보라', col: '#7b61ff' },
    { id: '#2dd4a4', name: '초록', col: '#2dd4a4' },
    { id: '#ffc83a', name: '노랑', col: '#ffc83a' },
  ];

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 20, flex: 1 }}>내 캐릭터 꾸미기</div>
        <button className="btn btn--ghost btn--sm">완료</button>
      </div>

      {/* Big preview */}
      <div style={{
        margin: '0 16px 16px', padding: '24px',
        background: 'linear-gradient(180deg, #b4e6ff, #88d1f5)',
        borderRadius: 22, position: 'relative', overflow: 'hidden',
        boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.05)',
      }}>
        <Cloud size={40} style={{ position: 'absolute', top: 12, left: 14, opacity: .75 }}/>
        <Cloud size={50} style={{ position: 'absolute', top: 6, right: 10, opacity: .65 }}/>
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Character
            type={type} size={140}
            hatColor={hat}
            photoUrl={usePhoto ? demoPhoto : undefined}
          />
        </div>
      </div>

      {/* Use my photo toggle */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1.5px solid var(--ink-100)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--coral-500)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>📷</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>내 얼굴 사진 쓰기</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
              캐릭터 얼굴에 내 사진이 보여요
            </div>
          </div>
          <button
            onClick={() => setUsePhoto(p => !p)}
            style={{
              width: 50, height: 28, borderRadius: 999, border: 'none',
              background: usePhoto ? 'var(--ocean-500)' : 'var(--ink-200)',
              position: 'relative', cursor: 'pointer', transition: 'background .15s',
            }}>
            <div style={{
              position: 'absolute', top: 2, left: usePhoto ? 24 : 2,
              width: 24, height: 24, borderRadius: '50%', background: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,.18)', transition: 'left .15s',
            }}/>
          </button>
        </div>

        {/* Drop slot for actual photo upload */}
        {usePhoto && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 12, marginTop: 8,
            border: '1.5px dashed var(--ocean-300)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <image-slot id="user-face" shape="circle"
              style={{ width: 60, height: 60, flexShrink: 0 }}
              placeholder="사진 드롭"></image-slot>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-500)' }}>
              여기에 사진을 끌어다 놓으면 캐릭터 얼굴이 바뀝니다
            </div>
          </div>
        )}
      </div>

      {/* Character type picker */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          캐릭터 종류
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['bear','fox','cat','owl'].map(t => (
            <button key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: 8, borderRadius: 14,
                background: type === t ? '#fff' : 'transparent',
                border: type === t ? '2px solid var(--ocean-500)' : '1.5px solid var(--ink-200)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, cursor: 'pointer',
              }}>
              <Character type={t} size={42}/>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-700)' }}>
                {{bear:'곰',fox:'여우',cat:'고양이',owl:'부엉이'}[t]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Hat picker */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>모자</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Gem size={12} color="topaz"/>
            <span className="num" style={{ color: 'var(--sun-700)' }}>50</span>씩
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {hats.map((h, i) => (
            <button key={i}
              onClick={() => setHat(h.id)}
              style={{
                flexShrink: 0, width: 56, height: 56, borderRadius: 14,
                background: '#fff',
                border: hat === h.id ? '2.5px solid var(--ocean-500)' : '1.5px solid var(--ink-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', cursor: 'pointer',
              }}>
              {h.id ? (
                <svg width="32" height="22" viewBox="0 0 32 22">
                  <ellipse cx="16" cy="18" rx="14" ry="2" fill={h.col}/>
                  <path d="M4 18 Q16 -2 28 18 Z" fill={h.col}/>
                  <circle cx="16" cy="4" r="2.5" fill="#fff"/>
                </svg>
              ) : (
                <span style={{ fontSize: 10, color: 'var(--ink-500)' }}>없음</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DailyMissionCard — 메인 화면에 끼울 수 있는 미니 카드
// ─────────────────────────────────────────────────────────────
function DailyMissionCard({ done = false }) {
  return (
    <div style={{
      background: done ? 'linear-gradient(135deg,#cdf3e2,#7ee0a8)'
                       : 'linear-gradient(135deg,#fff,#fff7e6)',
      borderRadius: 14, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      border: done ? '1.5px solid #7ee0a8' : '1.5px solid var(--sun-300)',
      position: 'relative',
    }}>
      <div style={{ fontSize: 26 }}>{done ? '✅' : '🎯'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: done ? 'var(--ocean-700)' : 'var(--sun-700)',
          textTransform: 'uppercase', letterSpacing: '.06em' }}>
          오늘의 미니 미션
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginTop: 2 }}>
          깨끗한 글씨로 쓰기
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3,
        background: '#fff', padding: '4px 10px', borderRadius: 999 }}>
        <Gem size={14} color="sapphire"/>
        <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--sky-700)' }}>
          +3pt
        </span>
      </div>
    </div>
  );
}

Object.assign(window, {
  BonusScreen, AchievementsScreen, CustomizeScreen, DailyMissionCard,
  TreasureChest, Confetti,
});
