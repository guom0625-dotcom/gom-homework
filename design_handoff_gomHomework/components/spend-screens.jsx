// spend-screens.jsx — 보석으로 보상 사용하기 흐름
//
// 흐름:
//   1. 매니저: 보상 카탈로그 (RewardCatalogScreen)
//      → 각 보상에 보석 가격 설정 (예: 게임 30분 = 토파즈 30개)
//   2. 학생: 보상 사용 화면 (SpendScreen)
//      → 카탈로그에서 골라서 "사용 요청"
//   3. 학생: 요청 대기 (SpendPendingScreen)
//      → 매니저 승인 기다림
//   4. 매니저: 사용 요청 승인 (SpendApprovalScreen)
//      → 승인 시 보석 차감 + 사용 처리
//   5. 학생: 사용 확정 화면 (SpendDoneScreen)
//      → 잔액 표시

// 공통 — 더미 카탈로그 (실제 앱이라면 매니저가 만들고 학생과 공유)
const REWARD_CATALOG = [
  { id: 'game30',  name: '게임 30분',     emoji: '🎮', col: '#7b61ff',
    cost: { topaz: 20, sapphire: 3 } },
  { id: 'snack',   name: '편의점 1만원',  emoji: '🛍️', col: '#ff6b6b',
    cost: { ruby: 5, emerald: 4 } },
  { id: 'outing',  name: '주말 외출',     emoji: '🚲', col: '#2dd4a4',
    cost: { emerald: 8, topaz: 20 } },
  { id: 'movie',   name: '영화 보기',     emoji: '🎬', col: '#ffc83a',
    cost: { ruby: 8, sapphire: 10 } },
  { id: 'book',    name: '책 한 권',      emoji: '📚', col: '#3a96ff',
    cost: { emerald: 4, topaz: 10 } },
  { id: 'special', name: '특별 외식',    emoji: '🍱', col: '#ff8855',
    cost: { amethyst: 1, ruby: 5 } },
];

// 학생 더미 인벤토리 (포인트 환산은 보상 시스템과 별개 - 사용은 보석 단위)
const STUDENT_INVENTORY = {
  amethyst: 2,
  ruby: 6,
  emerald: 10,
  sapphire: 15,
  topaz: 42,
};

function costToPoints(cost) {
  return Object.entries(cost).reduce((s, [k, n]) => s + GEM_VALUES[k].pt * n, 0);
}
function canAfford(inv, cost) {
  return Object.entries(cost).every(([k, n]) => (inv[k] || 0) >= n);
}
function subtractCost(inv, cost) {
  const out = { ...inv };
  Object.entries(cost).forEach(([k, n]) => { out[k] = (out[k] || 0) - n; });
  return out;
}

// ─────────────────────────────────────────────────────────────
// CostBreakdown — 보석 ×N 시각화 (보상 카드 안)
// ─────────────────────────────────────────────────────────────
function CostBreakdown({ cost, size = 16, gap = 8, showPt }) {
  const pts = costToPoints(cost);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap' }}>
      {Object.entries(cost).map(([k, n]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Gem size={size} color={k}/>
          <span className="num" style={{ fontSize: size - 2, fontWeight: 700,
            color: 'var(--ink-900)' }}>×{n}</span>
        </div>
      ))}
      {showPt && (
        <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>
          (= {pts}pt)
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 학생: SpendScreen — 보상 사용 메인
// ─────────────────────────────────────────────────────────────
function SpendScreen() {
  const inv = STUDENT_INVENTORY;
  const totalPt = gemsToPoints(inv);
  const [selectedId, setSelectedId] = React.useState(null);
  const selected = REWARD_CATALOG.find(r => r.id === selectedId);

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 20, flex: 1 }}>보상 사용하기</div>
      </div>

      {/* Inventory strip — 내가 가진 보석 */}
      <div style={{ padding: '14px 16px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4d36c4, #7b61ff)',
          borderRadius: 18, padding: '14px',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, opacity: .85 }}>내가 가진 보석</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="num display" style={{ fontSize: 28, lineHeight: 1 }}>
                  {totalPt.toLocaleString()}
                </span>
                <span style={{ fontSize: 13, opacity: .85 }}>pt</span>
              </div>
            </div>
            <div style={{ fontSize: 11, opacity: .75, textAlign: 'right' }}>
              엄마와 협의된<br/>보상만 사용 가능
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(inv)
              .sort(([a],[b]) => GEM_VALUES[b].pt - GEM_VALUES[a].pt)
              .map(([k, n]) => (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: 'rgba(255,255,255,.15)', padding: '4px 8px 4px 6px',
                  borderRadius: 999, border: '1px solid rgba(255,255,255,.18)',
                }}>
                  <Gem size={14} color={k}/>
                  <span className="num" style={{ fontSize: 11, fontWeight: 700 }}>×{n}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Catalog */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
        textTransform: 'uppercase', letterSpacing: '.06em',
        padding: '0 20px 10px', display: 'flex', justifyContent: 'space-between' }}>
        <span>엄마와 협의된 보상</span>
        <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
          {REWARD_CATALOG.filter(r => canAfford(inv, r.cost)).length}개 사용 가능
        </span>
      </div>

      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REWARD_CATALOG.map(r => {
          const ok = canAfford(inv, r.cost);
          const isSelected = selectedId === r.id;
          return (
            <button key={r.id}
              onClick={() => ok && setSelectedId(r.id)}
              disabled={!ok}
              style={{
                background: '#fff',
                border: isSelected ? `2.5px solid ${r.col}` : '1.5px solid var(--ink-100)',
                borderRadius: 16, padding: '14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: isSelected ? '0 2px 0 rgba(29,35,48,.08)' : 'none',
                opacity: ok ? 1 : 0.5,
                cursor: ok ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                position: 'relative',
              }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: `${r.col}1a`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>{r.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 15, color: 'var(--ink-900)' }}>
                  {r.name}
                </div>
                <div style={{ marginTop: 4 }}>
                  <CostBreakdown cost={r.cost} size={14} gap={6} showPt/>
                </div>
              </div>
              {!ok && (
                <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>🔒 부족</div>
              )}
              {ok && isSelected && (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: r.col, color: '#fff', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700,
                }}>✓</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sticky bottom — selected reward preview + 사용 요청 */}
      {selected && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: '#fff', padding: '14px 16px 24px',
          boxShadow: '0 -8px 24px rgba(0,0,0,.08)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: `${selected.col}1a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>{selected.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>차감 예정</div>
              <CostBreakdown cost={selected.cost} size={16}/>
            </div>
          </div>
          <button className="btn btn--coral btn--full btn--lg display">
            엄마에게 사용 요청하기
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 학생: SpendPendingScreen — 사용 요청 후 대기
// ─────────────────────────────────────────────────────────────
function SpendPendingScreen() {
  const reward = REWARD_CATALOG[0]; // 게임 30분
  return (
    <div className="app" style={{ height: '100%', overflow: 'auto',
      background: 'linear-gradient(180deg, #fff7e6 0%, #ffe9c2 100%)' }}>
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', fontSize: 16, color: 'var(--ink-700)' }}>←</button>
        <div className="display" style={{ fontSize: 18, flex: 1 }}>사용 요청 대기 중</div>
      </div>

      {/* Big waiting */}
      <div style={{ textAlign: 'center', padding: '20px 24px 10px' }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #fff, #ffd980)',
          margin: '0 auto', position: 'relative',
          boxShadow: '0 8px 30px rgba(255,200,58,.4)',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>
            {reward.emoji}
          </div>
          <div style={{
            position: 'absolute', top: -6, right: -2,
            background: '#fff', borderRadius: 999,
            padding: '4px 10px', fontSize: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,.1)',
            color: 'var(--sun-700)',
          }}>⏳</div>
        </div>
        <div className="display" style={{ fontSize: 22, marginTop: 16 }}>
          엄마가 확인 중이에요
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
          승인되면 보석이 차감되고<br/>"{reward.name}"을 사용할 수 있어요
        </div>
      </div>

      {/* Request summary */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 4 }}>
          요청 내역
        </div>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '14px',
          border: '1.5px solid var(--sun-300)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${reward.col}1a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>{reward.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>사용할 보상</div>
              <div className="display" style={{ fontSize: 16 }}>{reward.name}</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--ink-100)', marginBottom: 10 }}/>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 6 }}>차감될 보석</div>
          <CostBreakdown cost={reward.cost} size={18} gap={10}/>
        </div>
      </div>

      {/* Footer info */}
      <div style={{ padding: '16px 16px 30px' }}>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1.5px solid var(--ink-100)',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%',
            background: 'var(--grape-500)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>엄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>엄마</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', display: 'flex',
              alignItems: 'center', gap: 4 }}>
              <span className="dot dot--amber"/> 알림 보냄 · 3분 전
            </div>
          </div>
          <button className="btn btn--ghost btn--sm">취소</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 학생: SpendDoneScreen — 승인 후 잔액 확인
// ─────────────────────────────────────────────────────────────
function SpendDoneScreen() {
  const reward = REWARD_CATALOG[0];
  const before = STUDENT_INVENTORY;
  const after = subtractCost(before, reward.cost);
  const beforePt = gemsToPoints(before);
  const afterPt = gemsToPoints(after);
  const usedPt = beforePt - afterPt;

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto',
      background: 'linear-gradient(180deg, #cdf3e2 0%, #fffaf2 30%)' }}>
      <Confetti count={25}/>

      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center',
        gap: 10, position: 'relative', zIndex: 2 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', fontSize: 16, color: 'var(--ink-700)' }}>←</button>
        <div className="display" style={{ fontSize: 18, flex: 1 }}>사용 완료!</div>
      </div>

      <div style={{ textAlign: 'center', padding: '10px 24px 16px', position: 'relative', zIndex: 2 }}>
        <div style={{
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #fff, #7ee0a8)',
          margin: '0 auto', position: 'relative',
          boxShadow: '0 8px 30px rgba(45,212,164,.4)',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 70 }}>
            {reward.emoji}
          </div>
        </div>
        <div className="display" style={{ fontSize: 24, marginTop: 16, color: 'var(--ocean-700)' }}>
          {reward.name} 승인됨!
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
          엄마가 승인했어요 🎉
        </div>
      </div>

      {/* Before / used / after */}
      <div style={{ padding: '8px 16px 16px', position: 'relative', zIndex: 2 }}>
        <div style={{
          background: '#fff', borderRadius: 18, padding: 14,
          boxShadow: '0 4px 0 rgba(29,35,48,.06)',
          border: '1.5px solid var(--ink-100)',
        }}>
          <BalanceRow label="사용 전" pt={beforePt} dim/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 0', borderTop: '1px dashed var(--ink-200)',
            borderBottom: '1px dashed var(--ink-200)', margin: '4px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--coral-700)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>−</span> 차감
              <CostBreakdown cost={reward.cost} size={14} gap={4}/>
            </div>
            <div className="num display" style={{ fontSize: 16, color: 'var(--coral-700)' }}>
              −{usedPt}pt
            </div>
          </div>
          <BalanceRow label="남은 잔액" pt={afterPt} highlight/>
        </div>
      </div>

      {/* Remaining gem breakdown */}
      <div style={{ padding: '0 16px 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 4 }}>
          남은 보석
        </div>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '12px',
          border: '1.5px solid var(--ink-100)',
          display: 'flex', gap: 8, flexWrap: 'wrap',
        }}>
          {Object.entries(after)
            .sort(([a],[b]) => GEM_VALUES[b].pt - GEM_VALUES[a].pt)
            .map(([k, n]) => {
              const was = before[k] || 0;
              const changed = was !== n;
              return (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 999,
                  background: changed ? '#ffe2d6' : 'var(--paper-2)',
                  border: changed ? '1px solid var(--coral-500)' : '1px solid var(--ink-100)',
                }}>
                  <Gem size={16} color={k}/>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700,
                    color: 'var(--ink-900)' }}>×{n}</span>
                  {changed && (
                    <span style={{ fontSize: 10, color: 'var(--coral-700)' }}>
                      ({was}→{n})
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div style={{ padding: '0 16px 30px', position: 'relative', zIndex: 2 }}>
        <button className="btn btn--ocean btn--full btn--lg display">
          돌아가기
        </button>
      </div>
    </div>
  );
}

function BalanceRow({ label, pt, dim, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '4px 0',
    }}>
      <div style={{ fontSize: 13, color: highlight ? 'var(--ocean-700)' : dim ? 'var(--ink-500)' : 'var(--ink-700)',
        fontWeight: highlight ? 700 : 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="num display" style={{
          fontSize: highlight ? 24 : 16,
          color: highlight ? 'var(--ocean-700)' : dim ? 'var(--ink-500)' : 'var(--ink-700)',
        }}>{pt.toLocaleString()}</span>
        <span style={{ fontSize: 11,
          color: highlight ? 'var(--ocean-700)' : 'var(--ink-500)' }}>pt</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 매니저: SpendApprovalScreen — 학생의 사용 요청 승인
// ─────────────────────────────────────────────────────────────
function SpendApprovalScreen() {
  const reward = REWARD_CATALOG[0]; // 게임 30분
  const before = STUDENT_INVENTORY;
  const after = subtractCost(before, reward.cost);
  const beforePt = gemsToPoints(before);
  const afterPt = gemsToPoints(after);

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 18, lineHeight: 1.2 }}>
            지호의 사용 요청
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
            3분 전 · 협의된 보상
          </div>
        </div>
        <Character type="bear" size={40} mood="wow"/>
      </div>

      {/* Reward big card */}
      <div style={{ padding: '8px 16px 14px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${reward.col}, ${reward.col}cc)`,
          borderRadius: 20, padding: 18, color: '#fff', textAlign: 'center',
          boxShadow: `0 4px 0 ${reward.col}66`,
        }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>{reward.emoji}</div>
          <div className="display" style={{ fontSize: 22, marginTop: 6 }}>{reward.name}</div>
          <div style={{ fontSize: 11, opacity: .85, marginTop: 4 }}>
            지호가 사용하려는 보상
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <SectionTitle>차감될 보석</SectionTitle>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '14px',
          border: '1.5px solid var(--ink-100)',
        }}>
          {Object.entries(reward.cost).map(([k, n]) => {
            const have = before[k] || 0;
            const after_ = have - n;
            const g = GEM_VALUES[k];
            return (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                borderTop: '1px dashed var(--ink-100)',
              }}>
                <Gem size={26} color={k}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                    {have}개 → {after_}개
                  </div>
                </div>
                <div className="num display" style={{ fontSize: 18, color: 'var(--coral-700)' }}>
                  −{n}
                </div>
              </div>
            );
          })}
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: '1.5px solid var(--ink-200)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>
              총 차감 포인트
            </span>
            <span className="num display" style={{ fontSize: 22, color: 'var(--coral-700)' }}>
              −{costToPoints(reward.cost)}pt
            </span>
          </div>
        </div>
      </div>

      {/* Balance preview */}
      <SectionTitle>승인 후 잔액</SectionTitle>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #cdf3e2, #9ee0c2)',
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ocean-700)', opacity: .85 }}>
              {beforePt}pt →
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span className="num display" style={{ fontSize: 28, color: 'var(--ocean-700)' }}>
                {afterPt}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ocean-700)' }}>pt</span>
            </div>
          </div>
          <div style={{
            background: '#fff', padding: '6px 10px', borderRadius: 999,
            fontSize: 11, color: 'var(--ocean-700)', fontWeight: 700,
          }}>
            잔액 충분 ✓
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '16px 16px 30px', display: 'flex', gap: 8 }}>
        <button style={{
          flex: 1, padding: '14px', borderRadius: 16, border: '1.5px solid var(--ink-200)',
          background: '#fff', color: 'var(--ink-700)', fontFamily: 'var(--font-display)',
          fontSize: 15, cursor: 'pointer',
        }}>
          거절
        </button>
        <button className="btn btn--coral display" style={{ flex: 2, padding: '14px',
          fontSize: 16 }}>
          승인하고 차감
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 매니저: RewardCatalogScreen — 보상 카탈로그 관리
// ─────────────────────────────────────────────────────────────
function RewardCatalogScreen() {
  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 18, flex: 1, lineHeight: 1.2 }}>
          보상 카탈로그 관리
        </div>
        <button className="chip chip--ocean">저장</button>
      </div>

      {/* Banner */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg,#ebe3ff,#c6b5ff)',
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1.5px solid #c6b5ff',
        }}>
          <div style={{ fontSize: 24 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--grape-700)' }}>
              지호와 협의해서 보상을 정하세요
            </div>
            <div style={{ fontSize: 11, color: 'var(--grape-700)', opacity: .8, marginTop: 2 }}>
              여기 등록한 보상만 학생이 사용할 수 있어요
            </div>
          </div>
        </div>
      </div>

      {/* Catalog rows */}
      <SectionTitle>등록된 보상 ({REWARD_CATALOG.length}개)</SectionTitle>
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REWARD_CATALOG.map(r => (
          <div key={r.id} style={{
            background: '#fff', borderRadius: 14, padding: '12px',
            border: '1.5px solid var(--ink-100)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${r.col}1a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>{r.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="display" style={{ fontSize: 14, color: 'var(--ink-900)' }}>
                {r.name}
              </div>
              <div style={{ marginTop: 3 }}>
                <CostBreakdown cost={r.cost} size={13} gap={5} showPt/>
              </div>
            </div>
            <button style={{ width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--ink-500)', fontSize: 16,
              cursor: 'pointer' }}>⋯</button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ padding: '0 16px 30px' }}>
        <button style={{
          width: '100%', padding: '14px', borderRadius: 16,
          background: 'rgba(123,97,255,.08)', border: '2px dashed var(--grape-500)',
          color: 'var(--grape-700)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 18 }}>+</span> 새 보상 추가하기
        </button>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 8,
          textAlign: 'center', lineHeight: 1.5 }}>
          예: "친구 집 놀러가기", "용돈 5천원", "키오스크 결제"…<br/>
          학생과 같이 만드는 게 좋아요
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  SpendScreen, SpendPendingScreen, SpendDoneScreen,
  SpendApprovalScreen, RewardCatalogScreen,
  REWARD_CATALOG, STUDENT_INVENTORY,
  costToPoints, canAfford, subtractCost,
  CostBreakdown,
});
