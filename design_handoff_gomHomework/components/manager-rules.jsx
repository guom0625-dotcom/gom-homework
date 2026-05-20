// manager-rules.jsx — 매니저용 자동 지급 규칙 화면
//   • AutoRewardsScreen — 일일/보너스 자동 지급 규칙 설정
//   • AutoGrantResultScreen — 확인 마친 후 자동 지급된 결과 + 추가 보너스 옵션

// ─────────────────────────────────────────────────────────────
// AutoRewardsScreen
//   기본 지급:
//     • 할일 1개당 N개
//     • 모든 할일 완수 보너스 N개
//     • 기본 보석 종류
//   보너스 규칙 (켜짐/꺼짐 + 수량):
//     • 7일 연속, 30일 연속, 완벽 일주일, 얼리버드, 깨끗한 글씨, 미니미션
//   보석 종류 회전:
//     • 매일 다른 색 보석 자동 회전
//   이번 주 예상 지급량 미리보기
// ─────────────────────────────────────────────────────────────
function AutoRewardsScreen() {
  const [perTask, setPerTask] = React.useState(3);
  const [allDone, setAllDone] = React.useState(2);
  const [rotate, setRotate] = React.useState(true);
  const [bonuses, setBonuses] = React.useState({
    streak7: { on: true,  amt: 2, gem: 'ruby' },
    streak30:{ on: true,  amt: 1, gem: 'amethyst' },
    perfect: { on: true,  amt: 3, gem: 'sapphire' },
    early:   { on: false, amt: 1, gem: 'emerald' },
    neat:    { on: true,  amt: 1, gem: 'sapphire' },
    mission: { on: true,  amt: 1, gem: 'sapphire' },
  });
  // Rules → points: perTask is topaz (1pt), allDone is sapphire (3pt)
  const perTaskPt = perTask * GEM_VALUES.topaz.pt;
  const allDonePt = allDone * GEM_VALUES.sapphire.pt;
  // Estimated weekly: 7 days × (3 tasks × perTaskPt + allDonePt)
  const weeklyBase = 7 * (3 * perTaskPt + allDonePt);
  const bonusMax = Object.values(bonuses)
    .filter(b => b.on)
    .reduce((s, b) => s + b.amt * GEM_VALUES[b.gem].pt, 0);
  const weeklyMax = weeklyBase + bonusMax;

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 18, flex: 1, lineHeight: 1.2 }}>
          보석 자동 지급 규칙
        </div>
        <button className="chip chip--ocean">저장</button>
      </div>

      {/* Banner */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg,#cdf3e2,#9ee0c2)',
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1.5px solid #7ee0a8',
        }}>
          <div style={{ fontSize: 24 }}>⚙️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ocean-700)' }}>
              한 번 설정하면 매일 자동
            </div>
            <div style={{ fontSize: 11, color: 'var(--ocean-700)', opacity: .85, marginTop: 2 }}>
              승인만 하면 규칙대로 보석이 지급돼요
            </div>
          </div>
        </div>
      </div>

      {/* Section: 기본 지급 */}
      <SectionTitle>기본 지급</SectionTitle>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RuleCard
          icon="✅" iconBg="var(--ocean-100)" iconCol="var(--ocean-700)"
          title="할일 1개 완수"
          subtitle={`토파즈 1개 = ${GEM_VALUES.topaz.pt}pt`}
        >
          <NumStepper value={perTask} onChange={setPerTask} min={0} max={20} step={1} gemColor="topaz"/>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', textAlign: 'right', marginTop: 6 }}>
            = <span className="num display" style={{ color: 'var(--ocean-700)', fontSize: 14 }}>
              {perTaskPt}pt</span>씩
          </div>
        </RuleCard>

        <RuleCard
          icon="🌟" iconBg="#fff1c2" iconCol="var(--sun-700)"
          title="오늘 모두 완수"
          subtitle={`사파이어 1개 = ${GEM_VALUES.sapphire.pt}pt`}
        >
          <NumStepper value={allDone} onChange={setAllDone} min={0} max={10} step={1} gemColor="sapphire"/>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', textAlign: 'right', marginTop: 6 }}>
            = <span className="num display" style={{ color: 'var(--ocean-700)', fontSize: 14 }}>
              {allDonePt}pt</span>씩
          </div>
        </RuleCard>

        <RuleCard
          icon="🎨" iconBg="#ebe3ff" iconCol="var(--grape-700)"
          title="매일 다른 색 보석"
          subtitle="월~일 색 자동 회전"
          trailing={
            <Switch on={rotate} onChange={setRotate}/>
          }
        >
          {rotate && (
            <div style={{ display: 'flex', gap: 4, padding: '4px 0', alignItems: 'center' }}>
              {['amethyst','ruby','emerald','sapphire','topaz','amethyst','ruby'].map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <Gem size={20} color={c}/>
                  <div style={{ fontSize: 9, color: 'var(--ink-500)', marginTop: 2 }}>
                    {['월','화','수','목','금','토','일'][i]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </RuleCard>
      </div>

      {/* Section: 보석 가치표 */}
      <SectionTitle>보석 가치표 (참고)</SectionTitle>
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '10px 14px',
          border: '1.5px solid var(--ink-100)',
          boxShadow: '0 2px 0 rgba(29,35,48,.06)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 6 }}>
            보석 종류에 따라 가치가 달라요. 합산하면 학생에게는 포인트(pt)로 보여요.
          </div>
          {['amethyst','ruby','emerald','sapphire','topaz'].map(k => {
            const g = GEM_VALUES[k];
            return (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0', borderTop: '1px dashed var(--ink-100)',
              }}>
                <Gem size={22} color={k}/>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                  background: g.tone, color: '#fff',
                }}>{g.tier}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2,
                  minWidth: 56, justifyContent: 'flex-end' }}>
                  <span className="num display" style={{ fontSize: 16, color: 'var(--ink-900)' }}>
                    {g.pt}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>pt</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section: 보너스 */}
      <SectionTitle>보너스 규칙</SectionTitle>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BonusRow icon="🔥" title="7일 연속 완수" desc="한 주 빠짐없이"
          bonus={bonuses.streak7}
          onChange={(p) => setBonuses(b => ({ ...b, streak7: p }))}/>
        <BonusRow icon="🏆" title="30일 연속 완수" desc="한 달 챌린지 끝까지"
          bonus={bonuses.streak30}
          onChange={(p) => setBonuses(b => ({ ...b, streak30: p }))}/>
        <BonusRow icon="⭐" title="완벽 주" desc="한 번도 다시하기 없음"
          bonus={bonuses.perfect}
          onChange={(p) => setBonuses(b => ({ ...b, perfect: p }))}/>
        <BonusRow icon="🌅" title="얼리버드" desc="오전 10시 전 완료"
          bonus={bonuses.early}
          onChange={(p) => setBonuses(b => ({ ...b, early: p }))}/>
        <BonusRow icon="✍️" title="깨끗한 글씨" desc="매니저가 칭찬 시"
          bonus={bonuses.neat}
          onChange={(p) => setBonuses(b => ({ ...b, neat: p }))}/>
        <BonusRow icon="🎯" title="일일 미션" desc="오늘의 추가 미션 완수"
          bonus={bonuses.mission}
          onChange={(p) => setBonuses(b => ({ ...b, mission: p }))}/>
      </div>

      {/* Estimated weekly preview */}
      <SectionTitle>이번 주 예상 지급량</SectionTitle>
      <div style={{ padding: '0 16px 30px' }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 14,
          border: '1.5px solid var(--ink-100)',
          boxShadow: '0 2px 0 rgba(29,35,48,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '4px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-700)' }}>기본 지급 (보너스 없을 때)</div>
            <div style={{ display: 'baseline', display: 'flex', gap: 2 }}>
              <span className="num display" style={{ fontSize: 20, color: 'var(--ink-900)' }}>
                {weeklyBase}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-500)', alignSelf: 'flex-end',
                marginBottom: 3 }}>pt</span>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--ink-100)', margin: '6px 0' }}/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '4px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--ocean-700)', fontWeight: 600 }}>
              최대 (보너스 다 받을 때)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span className="num display" style={{ fontSize: 24, color: 'var(--ocean-700)' }}>
                {weeklyMax}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ocean-700)', opacity: .7 }}>pt</span>
            </div>
          </div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: 'var(--ink-100)',
            overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%',
              background: 'linear-gradient(90deg,#ffe070,#2dd4a4)', borderRadius: 999 }}/>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 6 }}>
            보상 교환 기준 약 <span className="num"
              style={{ fontWeight: 700, color: 'var(--ink-900)' }}>
              {Math.round((weeklyBase + weeklyMax) / 2)}pt</span>는 매주 모을 수 있어요
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      padding: '14px 16px 8px', fontSize: 11, fontWeight: 700,
      color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.08em',
    }}>{children}</div>
  );
}

function RuleCard({ icon, iconBg, iconCol, title, subtitle, trailing, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '14px',
      border: '1.5px solid var(--ink-100)',
      boxShadow: '0 2px 0 rgba(29,35,48,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: iconBg, color: iconCol,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{subtitle}</div>
        </div>
        {trailing}
      </div>
      {children && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--ink-100)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function BonusRow({ icon, title, desc, bonus, onChange }) {
  const dim = !bonus.on;
  const pt = bonus.amt * GEM_VALUES[bonus.gem].pt;
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '12px 14px',
      border: '1.5px solid var(--ink-100)',
      display: 'flex', alignItems: 'center', gap: 10,
      opacity: dim ? 0.55 : 1,
    }}>
      <div style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 1 }}>{desc}</div>
      </div>
      {bonus.on && (
        <>
          <NumStepper compact value={bonus.amt} min={1} max={5} step={1}
            onChange={(v) => onChange({ ...bonus, amt: v })} gemColor={bonus.gem}/>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1,
            minWidth: 42, justifyContent: 'flex-end' }}>
            <span className="num display" style={{ fontSize: 14, color: 'var(--ink-900)' }}>
              {pt}
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-500)' }}>pt</span>
          </div>
        </>
      )}
      <Switch on={bonus.on} onChange={(v) => onChange({ ...bonus, on: v })}/>
    </div>
  );
}

function NumStepper({ value, onChange, min = 0, max = 99, step = 1, gemColor = 'topaz', compact }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const btn = {
    width: compact ? 24 : 30, height: compact ? 24 : 30, borderRadius: 8,
    border: 'none', background: 'var(--ink-100)', color: 'var(--ink-700)',
    fontWeight: 700, fontSize: compact ? 14 : 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 8,
      background: compact ? 'transparent' : 'var(--paper-2)',
      padding: compact ? 0 : '4px 6px', borderRadius: 10 }}>
      {!compact && <button onClick={dec} style={btn}>−</button>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4,
        minWidth: compact ? 38 : 70, justifyContent: 'center' }}>
        <Gem size={compact ? 14 : 18} color={gemColor}/>
        <span className="num display" style={{ fontSize: compact ? 14 : 18,
          color: 'var(--ink-900)', fontWeight: 700 }}>
          +{value}
        </span>
      </div>
      {compact ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={inc} style={{ ...btn, width: 18, height: 14, fontSize: 10 }}>▲</button>
          <button onClick={dec} style={{ ...btn, width: 18, height: 14, fontSize: 10 }}>▼</button>
        </div>
      ) : (
        <button onClick={inc} style={btn}>+</button>
      )}
    </div>
  );
}

function Switch({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{
        width: 46, height: 26, borderRadius: 999, border: 'none',
        background: on ? 'var(--ocean-500)' : 'var(--ink-200)',
        position: 'relative', cursor: 'pointer', transition: 'background .15s',
        flexShrink: 0,
      }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,.18)', transition: 'left .15s',
      }}/>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// AutoGrantResultScreen — 확인 마친 직후 자동 지급 결과
// 매니저가 ApprovalScreen에서 "확인 마치기" 누르면 이 화면이 뜸.
// 보석은 이미 자동 지급되었고, 매니저는 결과를 보고 +추가 보너스 선택 가능
// ─────────────────────────────────────────────────────────────
function AutoGrantResultScreen() {
  const [extra, setExtra] = React.useState({});
  // What got auto-granted — each rule maps to a specific gem type by tier
  const lines = [
    { label: '할일 3개 완수', detail: '3 × 토파즈', gem: 'topaz', count: 3 },
    { label: '오늘 모두 완수 보너스', detail: '에메랄드 1개', gem: 'emerald', count: 2 },
    { label: '7일 연속 보너스', detail: '루비 1개 (희귀)', gem: 'ruby', count: 1 },
  ];
  const autoPoints = lines.reduce((s, l) => s + GEM_VALUES[l.gem].pt * l.count, 0);

  const extras = [
    { id: 'neat',    icon: '✍️', label: '깨끗한 글씨', pt: 5,  gem: 'sapphire', color: 'var(--grape-700)' },
    { id: 'mission', icon: '🎯', label: '미션 완수',  pt: 5,  gem: 'sapphire', color: 'var(--coral-700)' },
    { id: 'mood',    icon: '😄', label: '기분 좋게',  pt: 5,  gem: 'topaz',    color: 'var(--sun-700)' },
    { id: 'extra',   icon: '✨', label: '특별 보너스', pt: 10, gem: 'ruby',     color: 'var(--ocean-700)' },
  ];
  const extraPoints = extras.filter(e => extra[e.id]).reduce((s, e) => s + e.pt, 0);
  const grandTotal = autoPoints + extraPoints;

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 20, flex: 1 }}>자동 지급 완료</div>
      </div>

      {/* Student + total hero (points) */}
      <div style={{ padding: '8px 16px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #2dd4a4 0%, #00b894 100%)',
          borderRadius: 20, padding: 16, color: '#fff',
          boxShadow: '0 4px 0 rgba(0,136,112,.4), 0 10px 30px rgba(45,212,164,.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Character type="bear" size={56}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: .85 }}>지호가 받은 포인트</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="num display" style={{ fontSize: 44, lineHeight: 1,
                  textShadow: '0 3px 0 rgba(0,0,0,.18)' }}>
                  +{grandTotal}
                </span>
                <span className="display" style={{ fontSize: 18, opacity: .85 }}>pt</span>
              </div>
              {/* Tiny gem icons preview */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
                {lines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Gem size={14} color={l.gem}/>
                    <span className="num" style={{ fontSize: 10, opacity: .9 }}>×{l.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,.18)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚙️</span> 규칙대로 자동 지급
            <span style={{ marginLeft: 'auto', opacity: .85 }}>규칙 수정 ›</span>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <SectionTitle>자동 지급 내역</SectionTitle>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((l, i) => {
          const g = GEM_VALUES[l.gem];
          const pts = g.pt * l.count;
          return (
            <div key={i} style={{
              background: '#fff', borderRadius: 12, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              border: '1px solid var(--ink-100)',
            }}>
              <Gem size={26} color={l.gem}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 1 }}>
                  {g.name} ×{l.count} · 개당 {g.pt}pt
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="num display" style={{ fontSize: 18, color: 'var(--ink-900)' }}>
                  +{pts}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>pt</span>
              </div>
            </div>
          );
        })}
        {/* Subtotal */}
        <div style={{
          background: 'var(--paper-2)', borderRadius: 12,
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-700)', fontWeight: 600 }}>
            소계
          </div>
          <div className="num display" style={{ fontSize: 18, color: 'var(--ocean-700)' }}>
            +{autoPoints}pt
          </div>
        </div>
      </div>

      {/* Extra bonuses (manual add-on) */}
      <SectionTitle>오늘만 추가 보너스 (선택)</SectionTitle>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {extras.map(e => {
            const on = extra[e.id];
            return (
              <button key={e.id}
                onClick={() => setExtra(x => ({ ...x, [e.id]: !on }))}
                style={{
                  background: on ? '#fff' : 'rgba(255,255,255,.6)',
                  border: on ? `2px solid ${e.color}` : '1.5px solid var(--ink-200)',
                  borderRadius: 14, padding: '10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: on ? '0 2px 0 rgba(29,35,48,.08)' : 'none',
                }}>
                <div style={{ fontSize: 20 }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-900)' }}>
                    {e.label}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: e.color,
                    fontFamily: 'var(--font-num)' }}>
                    +{e.pt}pt
                  </div>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: on ? e.color : 'var(--ink-100)',
                  color: '#fff', fontSize: 11, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>{on ? '✓' : ''}</div>
              </button>
            );
          })}
        </div>
        {extraPoints > 0 && (
          <div style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 12,
            background: 'var(--paper-2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 18 }}>🎁</div>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-700)' }}>
              추가로 <span className="num display" style={{ color: 'var(--coral-700)', fontSize: 14 }}>
              +{extraPoints}pt</span>가 지급될 거예요
            </div>
          </div>
        )}
      </div>

      {/* Footer message + done */}
      <div style={{ padding: '8px 16px 30px' }}>
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--paper-2)',
          fontSize: 12, color: 'var(--ink-700)', fontStyle: 'italic', marginBottom: 10 }}>
          💬 "오늘도 정말 잘했어! 내일도 화이팅!"
        </div>
        <button className="btn btn--ocean btn--full btn--lg display">
          마무리하기
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  AutoRewardsScreen, AutoGrantResultScreen,
  // helpers re-export for index entry consumption
  SectionTitle, RuleCard, BonusRow, NumStepper, Switch,
});
