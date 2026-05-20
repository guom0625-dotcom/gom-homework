// Shared visual primitives — Gem, Character (Bear/Fox/Cat/Owl),
// IslandTile, StatusBadge, mini icons.
// Hand-drawn SVG glyphs are restricted to simple primitives (circles,
// ellipses, paths). Characters use a face composition.

// ─────────────────────────────────────────────────────────────
// Gem — diamond-cut SVG, multiple sizes/colors
// ─────────────────────────────────────────────────────────────
function Gem({ size = 24, color = 'amethyst' }) {
  const palettes = {
    amethyst: ['#e3ccff', '#b076ff', '#7b3fd0'],
    ruby:     ['#ffd3df', '#ff5a7a', '#c4304f'],
    emerald:  ['#b6f0d8', '#2dd4a4', '#0e8a66'],
    sapphire: ['#d2e9ff', '#3a96ff', '#1d6fd0'],
    topaz:    ['#fff0b8', '#ffc83a', '#c98c00'],
  };
  const [lt, md, dk] = palettes[color] || palettes.amethyst;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`gem-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lt}/>
          <stop offset="60%" stopColor={md}/>
          <stop offset="100%" stopColor={dk}/>
        </linearGradient>
      </defs>
      <path d="M16 2 L28 12 L16 30 L4 12 Z" fill={`url(#gem-${color})`} stroke={dk} strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M16 2 L20 12 L16 30 L12 12 Z" fill={md} opacity="0.5"/>
      <path d="M4 12 L28 12" stroke={dk} strokeWidth="1.2" opacity="0.6"/>
      <path d="M9 6 L10.5 9.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Character avatars — round face with ears, varies per type.
// types: bear, fox, cat, owl
// photoUrl: if provided, user's photo replaces the drawn face
//           (clipped to the face ellipse — body/ears/hat stay as is)
// ─────────────────────────────────────────────────────────────
const __charClipCounter = { n: 0 };

// ─────────────────────────────────────────────────────────────
// Gem value table — 보석별 포인트 가치 + 희귀도 라벨
// 매니저 자동지급 규칙에서 매일 다른 보석을 지급해도, 학생이
// 최종적으로 보는 "총 포인트"는 가치 가중합으로 환산되어 보임.
// ─────────────────────────────────────────────────────────────
const GEM_VALUES = {
  topaz:    { pt: 1,  name: '토파즈',   tier: 'C', tone: '#ffc83a' },
  sapphire: { pt: 3,  name: '사파이어', tier: 'B', tone: '#3a96ff' },
  emerald:  { pt: 5,  name: '에메랄드', tier: 'A', tone: '#2dd4a4' },
  ruby:     { pt: 10, name: '루비',     tier: 'S', tone: '#ff5a7a' },
  amethyst: { pt: 25, name: '자수정',   tier: 'S+', tone: '#b076ff' },
};

// Sum a {amethyst: n, ruby: n, ...} inventory → total points
function gemsToPoints(inv) {
  return Object.entries(inv).reduce((s, [k, n]) => s + (GEM_VALUES[k]?.pt || 0) * n, 0);
}
function Character({ type = 'bear', size = 60, mood = 'happy', hatColor, photoUrl }) {
  const T = type;
  const presets = {
    bear: { body: '#c98851', face: '#f0c89c', ear: '#a26f3d' },
    fox:  { body: '#ff8855', face: '#ffd6b8', ear: '#d96222' },
    cat:  { body: '#3a4254', face: '#6b7488', ear: '#1d2330' },
    owl:  { body: '#7b61ff', face: '#e3ddff', ear: '#4d36c4' },
  };
  const p = presets[T] || presets.bear;
  const clipId = React.useMemo(() => `face-clip-${++__charClipCounter.n}`, []);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      {/* Ears — shape varies */}
      {T === 'bear' && (<>
        <circle cx="14" cy="20" r="8" fill={p.body}/>
        <circle cx="14" cy="20" r="4" fill={p.face}/>
        <circle cx="50" cy="20" r="8" fill={p.body}/>
        <circle cx="50" cy="20" r="4" fill={p.face}/>
      </>)}
      {T === 'fox' && (<>
        <path d="M8 26 L14 8 L24 22 Z" fill={p.body} stroke={p.ear} strokeWidth="1"/>
        <path d="M56 26 L50 8 L40 22 Z" fill={p.body} stroke={p.ear} strokeWidth="1"/>
      </>)}
      {T === 'cat' && (<>
        <path d="M12 30 L16 12 L26 24 Z" fill={p.body}/>
        <path d="M52 30 L48 12 L38 24 Z" fill={p.body}/>
      </>)}
      {T === 'owl' && (<>
        <path d="M14 28 Q10 14 22 14 Q22 22 14 28 Z" fill={p.body}/>
        <path d="M50 28 Q54 14 42 14 Q42 22 50 28 Z" fill={p.body}/>
      </>)}

      {/* Head */}
      <circle cx="32" cy="36" r="22" fill={p.body}/>
      {/* Face mask */}
      {!photoUrl && <ellipse cx="32" cy="40" rx="16" ry="14" fill={p.face}/>}

      {/* User photo replaces drawn face */}
      {photoUrl && (
        <>
          <defs>
            <clipPath id={clipId}>
              <ellipse cx="32" cy="40" rx="16" ry="14"/>
            </clipPath>
          </defs>
          <image href={photoUrl} x="14" y="24" width="36" height="32"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}/>
          <ellipse cx="32" cy="40" rx="16" ry="14" fill="none"
            stroke={p.ear} strokeWidth="1.2"/>
        </>
      )}

      {/* Hat (optional) */}
      {hatColor && (<>
        <ellipse cx="32" cy="18" rx="20" ry="3" fill={hatColor}/>
        <path d={`M16 18 Q32 -4 48 18 Z`} fill={hatColor}/>
        <circle cx="32" cy="6" r="3" fill="#fff"/>
      </>)}

      {/* Eyes / face details — hidden when a user photo is shown */}
      {!photoUrl && mood === 'happy' && (<>
        <path d="M24 36 Q26 33 28 36" stroke="#1d2330" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M36 36 Q38 33 40 36" stroke="#1d2330" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </>)}
      {!photoUrl && mood === 'sleep' && (<>
        <path d="M23 36 L29 36" stroke="#1d2330" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M35 36 L41 36" stroke="#1d2330" strokeWidth="2.5" strokeLinecap="round"/>
      </>)}
      {!photoUrl && mood === 'wow' && (<>
        <circle cx="26" cy="36" r="2.4" fill="#1d2330"/>
        <circle cx="38" cy="36" r="2.4" fill="#1d2330"/>
        <circle cx="26.7" cy="35.3" r="0.8" fill="#fff"/>
        <circle cx="38.7" cy="35.3" r="0.8" fill="#fff"/>
      </>)}

      {/* Nose / beak */}
      {!photoUrl && (T === 'owl' ? (
        <path d="M30 42 L34 42 L32 46 Z" fill="#ffc83a" stroke={p.ear} strokeWidth="0.8"/>
      ) : (
        <ellipse cx="32" cy="44" rx="2.5" ry="1.8" fill="#1d2330"/>
      ))}

      {/* Cheek blush */}
      {!photoUrl && <circle cx="22" cy="44" r="2.5" fill="#ff8a8a" opacity="0.45"/>}
      {!photoUrl && <circle cx="42" cy="44" r="2.5" fill="#ff8a8a" opacity="0.45"/>}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// IslandTile — single stepping stone / island, with state
// states: complete (gem on it), current (character on it),
//         locked (foggy), pending (empty stone), bonus (chest)
// ─────────────────────────────────────────────────────────────
function IslandTile({ state = 'pending', day, size = 84, character, gem }) {
  const w = size, h = size * 0.7;
  const baseColors = {
    pending:  { top: '#9ad9a8', mid: '#62b878', base: '#3f8253' },
    current:  { top: '#ffe48a', mid: '#ffc83a', base: '#c98c00' },
    complete: { top: '#a8d8b9', mid: '#7ec8a0', base: '#4d9670' },
    locked:   { top: '#cdd2dd', mid: '#9aa1b3', base: '#6b7488' },
    bonus:    { top: '#ffc3d2', mid: '#ff7da0', base: '#c4304f' },
  };
  const c = baseColors[state];

  return (
    <div style={{ position: 'relative', width: w, height: h + 36 }}>
      {/* Day number */}
      <div className="num" style={{
        position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
        background: '#fff', color: c.base, fontSize: 11, fontWeight: 600,
        padding: '2px 8px', borderRadius: 999, border: `2px solid ${c.mid}`,
        whiteSpace: 'nowrap', zIndex: 3,
      }}>
        DAY {day}
      </div>

      {/* Island */}
      <svg width={w} height={h + 30} viewBox={`0 0 ${w} ${h + 30}`} style={{ position: 'absolute', top: 20, left: 0 }}>
        {/* Base */}
        <ellipse cx={w / 2} cy={h * 0.95} rx={w * 0.42} ry={h * 0.18} fill={c.base}/>
        {/* Mid */}
        <ellipse cx={w / 2} cy={h * 0.75} rx={w * 0.46} ry={h * 0.22} fill={c.mid}/>
        {/* Top grass */}
        <ellipse cx={w / 2} cy={h * 0.55} rx={w * 0.4} ry={h * 0.2} fill={c.top}/>
        {state === 'locked' && (
          <ellipse cx={w / 2} cy={h * 0.55} rx={w * 0.4} ry={h * 0.2} fill="#fff" opacity="0.35"/>
        )}
      </svg>

      {/* On-island content */}
      <div style={{
        position: 'absolute', left: '50%', top: h * 0.05 + 12, transform: 'translateX(-50%)',
        zIndex: 2,
      }}>
        {state === 'current' && character}
        {state === 'complete' && (
          <div style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.15))' }}>
            {gem || <Gem size={32} color="emerald"/>}
          </div>
        )}
        {state === 'pending' && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px dashed rgba(255,255,255,.85)',
            background: 'rgba(255,255,255,.2)',
          }}/>
        )}
        {state === 'locked' && (
          <svg width="26" height="30" viewBox="0 0 26 30">
            <rect x="3" y="14" width="20" height="14" rx="3" fill="#6b7488"/>
            <path d="M7 14 V10 a6 6 0 0 1 12 0 V14" stroke="#6b7488" strokeWidth="3" fill="none"/>
            <circle cx="13" cy="21" r="2.5" fill="#fff"/>
          </svg>
        )}
        {state === 'bonus' && (
          <svg width="34" height="30" viewBox="0 0 34 30">
            <rect x="3" y="10" width="28" height="18" rx="3" fill="#8b4513"/>
            <path d="M3 14 Q17 4 31 14 V18 H3Z" fill="#a0522d"/>
            <rect x="14" y="14" width="6" height="6" fill="#ffc83a"/>
            <rect x="15.5" y="15.5" width="3" height="3" fill="#fff" opacity=".6"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sky decorations — clouds, sun
// ─────────────────────────────────────────────────────────────
function Cloud({ size = 60, opacity = 0.85, style = {} }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60"
         style={{ opacity, ...style }}>
      <ellipse cx="25" cy="40" rx="22" ry="16" fill="#fff"/>
      <ellipse cx="50" cy="30" rx="28" ry="20" fill="#fff"/>
      <ellipse cx="75" cy="40" rx="22" ry="16" fill="#fff"/>
    </svg>
  );
}

function Palm({ size = 50, style = {} }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 50 70" style={style}>
      <path d="M22 70 Q25 50 28 35" stroke="#6b3f1c" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <ellipse cx="22" cy="22" rx="14" ry="5" fill="#2dd4a4" transform="rotate(-30 22 22)"/>
      <ellipse cx="30" cy="20" rx="14" ry="5" fill="#62b878" transform="rotate(25 30 20)"/>
      <ellipse cx="20" cy="14" rx="12" ry="4" fill="#7ee0a8" transform="rotate(-10 20 14)"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// TopHud — character + name + gem count + streak
// ─────────────────────────────────────────────────────────────
function TopHud({ name = '지호', character = 'bear', points = 124, streak = 7, mood = 'happy', photoUrl }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', background: 'rgba(255,255,255,.92)',
      borderRadius: 999, boxShadow: '0 4px 14px rgba(0,0,0,.08)',
      backdropFilter: 'blur(6px)',
    }}>
      <Character type={character} size={36} mood={mood} photoUrl={photoUrl}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="display" style={{ fontSize: 14, lineHeight: 1, color: 'var(--ink-900)' }}>
          {name}
        </div>
        <div className="num" style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
          🔥 {streak}일 연속
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'linear-gradient(180deg,#e8f6ed,#b6f0d8)',
        padding: '6px 12px 6px 8px', borderRadius: 999,
        boxShadow: 'inset 0 -2px 0 rgba(14,138,102,.25)',
      }}>
        <Gem size={20} color="emerald"/>
        <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ocean-700)' }}>
          {points.toLocaleString()}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ocean-700)', opacity: .7,
          marginLeft: -2 }}>pt</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PathConnector — dotted path between islands
// ─────────────────────────────────────────────────────────────
function PathDots({ fromX, fromY, toX, toY, count = 5, color = 'rgba(255,255,255,.9)' }) {
  const dots = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t - Math.sin(t * Math.PI) * 8;
    dots.push(<circle key={i} cx={x} cy={y} r="3" fill={color}/>);
  }
  return <>{dots}</>;
}

// ─────────────────────────────────────────────────────────────
// TaskItem — single task row, multiple states
// ─────────────────────────────────────────────────────────────
function TaskItem({ title, subtitle, state = 'todo', reward, onAction }) {
  const visual = {
    todo:     { bg: '#fff', icon: '◯', col: 'var(--ink-300)', border: 'var(--ink-200)' },
    pending:  { bg: '#fff8e6', icon: '⏳', col: 'var(--sun-700)', border: '#ffd980' },
    approved: { bg: '#e8faf2', icon: '✓', col: 'var(--ocean-700)', border: '#9ee0c2' },
    rejected: { bg: '#ffefe6', icon: '✗', col: 'var(--coral-700)', border: '#ffb39a' },
    done:     { bg: '#f4eeff', icon: '★', col: 'var(--grape-700)', border: '#c6b5ff' },
  }[state];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 14px', background: visual.bg,
      borderRadius: 14, border: `1.5px solid ${visual.border}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: state === 'todo' ? '#fff' : visual.col,
        color: state === 'todo' ? visual.col : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 600, flexShrink: 0,
        border: state === 'todo' ? `2px solid ${visual.border}` : 'none',
      }}>{visual.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.3 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {reward && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Gem size={16} color="emerald"/>
          <span className="num" style={{ fontSize: 13, color: 'var(--ocean-700)', fontWeight: 600 }}>
            +{reward}
          </span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  Gem, Character, IslandTile, Cloud, Palm, TopHud, PathDots, TaskItem,
  GEM_VALUES, gemsToPoints,
});
