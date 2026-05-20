// manager-screens.jsx — 매니저용 화면들

// ─────────────────────────────────────────────────────────────
// 1. 매니저 - 학생 목록 대시보드
// ─────────────────────────────────────────────────────────────
function ManagerDashboard() {
  const students = [
    { name: '지호', type: 'bear', day: 7, status: 'review', points: 412, msg: '다 했대요! · 3개 할일' },
    { name: '하늘', type: 'fox',  day: 12, status: 'done', points: 780, msg: '오늘 완료 · 잘했어요!' },
    { name: '서윤', type: 'cat',  day: 3, status: 'idle', points: 95, msg: '아직 할일 등록 전' },
    { name: '민준', type: 'owl',  day: 5, status: 'review', points: 240, msg: '다 했대요! · 2개 할일' },
  ];
  const statusMap = {
    review: { chip: 'chip--coral', dot: 'dot--coral', label: '확인 필요' },
    done:   { chip: 'chip--ocean', dot: 'dot--green', label: '완료' },
    idle:   { chip: 'chip--sun',   dot: 'dot--amber', label: '대기 중' },
  };

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>안녕하세요</div>
            <div className="display" style={{ fontSize: 24, color: 'var(--ink-900)' }}>
              엄마, 오늘 4명이 있어요
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14,
            background: 'var(--grape-500)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16 }}>엄</div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
        <SummaryCard color="var(--coral-500)" big="2" label="확인 필요" icon="🔍"/>
        <SummaryCard color="var(--ocean-500)" big="1" label="오늘 완료" icon="✓"/>
        <SummaryCard color="var(--sun-500)" big="1,527" label="누적 포인트" icon="💎" small/>
      </div>

      {/* Settings entry — auto-rewards rule */}
      <div style={{ padding: '0 16px 14px' }}>
        <button style={{
          width: '100%', background: 'linear-gradient(135deg,#ebe3ff,#c6b5ff)',
          border: '1.5px solid #c6b5ff', borderRadius: 16, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          textAlign: 'left',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>⚙️</div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 15, color: 'var(--grape-700)' }}>
              보석 자동 지급 규칙
            </div>
            <div style={{ fontSize: 11, color: 'var(--grape-700)', opacity: .8, marginTop: 2 }}>
              할일당 +3pt · 모두 완수 +6pt · 7일 +20pt
            </div>
          </div>
          <div style={{ color: 'var(--grape-700)', fontSize: 16 }}>›</div>
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        <button className="chip chip--coral num" style={{
          flexShrink: 0, fontWeight: 600,
          border: '1.5px solid var(--coral-500)',
        }}>전체 4</button>
        <button className="chip num" style={{ flexShrink: 0 }}>확인 필요 2</button>
        <button className="chip num" style={{ flexShrink: 0 }}>완료 1</button>
        <button className="chip num" style={{ flexShrink: 0 }}>대기 중 1</button>
      </div>

      {/* Student cards */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {students.map((s, i) => {
          const sm = statusMap[s.status];
          return (
            <div key={i} style={{
              background: '#fff', borderRadius: 18, padding: '14px',
              boxShadow: '0 2px 0 rgba(29,35,48,.06), 0 6px 16px rgba(29,35,48,.05)',
              display: 'flex', alignItems: 'center', gap: 12,
              border: s.status === 'review' ? '1.5px solid var(--coral-500)' : '1px solid var(--ink-100)',
            }}>
              <div style={{ position: 'relative' }}>
                <Character type={s.type} size={52}/>
                <div className={`dot ${sm.dot}`} style={{
                  position: 'absolute', bottom: 2, right: 2, width: 12, height: 12,
                  border: '2px solid #fff',
                }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="display" style={{ fontSize: 17, color: 'var(--ink-900)' }}>{s.name}</span>
                  <span className="chip chip--sky num" style={{ padding: '2px 8px', fontSize: 11 }}>
                    Day {s.day}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{s.msg}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div className={`chip ${sm.chip}`} style={{ padding: '4px 10px', fontSize: 11 }}>
                  {sm.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Gem size={14} color="emerald"/>
                  <span className="num" style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 700 }}>
                    {s.points}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-500)' }}>pt</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div style={{ padding: '20px 16px 30px' }}>
        <button className="btn btn--grape btn--full">
          + 새 학생 초대하기
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ color, big, label, icon, small }) {
  return (
    <div style={{
      flex: 1, background: '#fff', borderRadius: 14,
      padding: '12px', position: 'relative',
      boxShadow: '0 2px 0 rgba(29,35,48,.06), 0 6px 16px rgba(29,35,48,.04)',
      border: '1px solid var(--ink-100)',
    }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div className="num display" style={{
        fontSize: small ? 22 : 28, color, lineHeight: 1, marginTop: 4,
      }}>{big}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. 매니저 - 승인 화면 (할일 검토)
// ─────────────────────────────────────────────────────────────
function ApprovalScreen() {
  const [decisions, setDecisions] = React.useState({ a: 'y', b: 'y' });
  const tasks = [
    { id: 'a', title: '수학 문제집 24p', sub: '5-1 곱셈 단원' },
    { id: 'b', title: '영어 단어 외우기', sub: 'unit 12 · 20개' },
    { id: 'c', title: '독서 30분', sub: '해리포터 4권' },
  ];
  const approvedCount = Object.values(decisions).filter(d => d === 'y').length;

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 18, lineHeight: 1.2 }}>지호가 다 했대요!</div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
            11월 18일 · Day 7 · 5분 전 알림
          </div>
        </div>
        <Character type="bear" size={40} mood="wow"/>
      </div>

      {/* Hand-off banner — manager checks in person */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #fff7d6, #ffe48a)',
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1.5px solid #ffd980',
        }}>
          <div style={{ fontSize: 26 }}>🔍</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sun-700)' }}>
              지호 옆에서 직접 검사해 주세요
            </div>
            <div style={{ fontSize: 11, color: 'var(--sun-700)', opacity: .8, marginTop: 2 }}>
              눈으로 확인 후 아래에서 항목별로 체크
            </div>
          </div>
        </div>
      </div>

      {/* Top progress */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{
          background: '#fff', padding: '10px 14px', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid var(--ink-100)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>확인 진행</div>
            <div className="num display" style={{ fontSize: 18 }}>
              <span style={{ color: 'var(--ocean-700)' }}>{approvedCount}</span>
              <span style={{ color: 'var(--ink-300)' }}> / {tasks.length}</span>
            </div>
          </div>
          <div style={{ flex: 2, height: 8, borderRadius: 999, background: 'var(--ink-100)',
            overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(approvedCount / tasks.length) * 100}%`,
              background: 'var(--ocean-500)', borderRadius: 999, transition: 'width .25s' }}/>
          </div>
        </div>
      </div>

      {/* Task cards w/ decision — no photo proof */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map((t, i) => {
          const dec = decisions[t.id];
          return (
            <div key={t.id} style={{
              background: '#fff', borderRadius: 16, overflow: 'hidden',
              border: dec === 'y' ? '2px solid var(--ocean-500)' :
                      dec === 'n' ? '2px solid var(--coral-500)' :
                      '1.5px solid var(--ink-100)',
              boxShadow: '0 2px 0 rgba(29,35,48,.06)',
            }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: dec === 'y' ? 'var(--ocean-500)' :
                                dec === 'n' ? 'var(--coral-500)' : 'var(--ink-100)',
                    color: dec ? '#fff' : 'var(--ink-500)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                  }} className="num">{dec === 'y' ? '✓' : dec === 'n' ? '✗' : i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{t.sub}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => setDecisions(d => ({ ...d, [t.id]: 'n' }))}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      border: dec === 'n' ? '2px solid var(--coral-500)' : '1.5px solid var(--ink-200)',
                      background: dec === 'n' ? 'var(--coral-500)' : '#fff',
                      color: dec === 'n' ? '#fff' : 'var(--ink-700)',
                      fontFamily: 'var(--font-display)', fontSize: 13, cursor: 'pointer',
                    }}>다시 하기</button>
                  <button
                    onClick={() => setDecisions(d => ({ ...d, [t.id]: 'y' }))}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      border: dec === 'y' ? '2px solid var(--ocean-500)' : '1.5px solid var(--ink-200)',
                      background: dec === 'y' ? 'var(--ocean-500)' : '#fff',
                      color: dec === 'y' ? '#fff' : 'var(--ink-700)',
                      fontFamily: 'var(--font-display)', fontSize: 13, cursor: 'pointer',
                    }}>잘했어요</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          background: 'var(--paper-2)', borderRadius: 14, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ink-700)', fontWeight: 600,
            marginBottom: 6 }}>💬 한마디 (선택)</div>
          <div style={{ fontSize: 13, color: 'var(--ink-500)', fontStyle: 'italic' }}>
            "오늘도 수고했어, 지호야!"
          </div>
        </div>
      </div>

      {/* Final action */}
      <div style={{ padding: '14px 16px 30px' }}>
        <button className={`btn btn--ocean btn--full btn--lg display`}
                style={approvedCount === 0 ? { opacity: .5 } : {}}>
          확인 마치기 · 자동 지급
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-500)', marginTop: 8 }}>
          설정한 규칙대로 보석이 자동 지급돼요
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. 매니저 - 포인트 지급
// ─────────────────────────────────────────────────────────────
function GrantPointsScreen() {
  const [amount, setAmount] = React.useState(30);
  const [gem, setGem] = React.useState('topaz');
  const presets = [10, 20, 30, 50, 100];
  const gems = ['amethyst','ruby','emerald','sapphire','topaz'];

  return (
    <div className="app" style={{ height: '100%', overflow: 'auto', background: '#fffaf2' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 20, flex: 1 }}>보석 지급</div>
      </div>

      {/* Student selected */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1.5px solid var(--ink-100)',
        }}>
          <Character type="bear" size={48}/>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 17 }}>지호</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
              Day 7 · 3/3 할일 완수 🎉
            </div>
          </div>
          <button className="chip" style={{ background: 'var(--ink-100)' }}>변경</button>
        </div>
      </div>

      {/* Big amount display */}
      <div style={{ padding: '8px 16px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 8 }}>
          지급할 보석 수량
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Gem size={48} color={gem}/>
          <div className="num display" style={{ fontSize: 64, lineHeight: 1, color: 'var(--ink-900)' }}>
            {amount}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4, textTransform: 'capitalize' }}>
          {gem}
        </div>
      </div>

      {/* Quick presets */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          빠른 선택
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {presets.map(p => (
            <button key={p}
              onClick={() => setAmount(p)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 12,
                background: amount === p ? 'var(--ocean-500)' : '#fff',
                color: amount === p ? '#fff' : 'var(--ink-700)',
                border: amount === p ? 'none' : '1.5px solid var(--ink-200)',
                fontFamily: 'var(--font-num)', fontWeight: 600, fontSize: 14,
                cursor: 'pointer',
              }}>+{p}</button>
          ))}
        </div>
      </div>

      {/* Gem type picker */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          보석 종류
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {gems.map(g => (
            <button key={g}
              onClick={() => setGem(g)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 12,
                background: gem === g ? '#fff' : 'transparent',
                border: gem === g ? `2px solid var(--ocean-500)` : '1.5px solid var(--ink-200)',
                display: 'flex', justifyContent: 'center', cursor: 'pointer',
              }}>
              <Gem size={28} color={g}/>
            </button>
          ))}
        </div>
      </div>

      {/* Reason field */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          이유
        </div>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '12px 14px',
          border: '1.5px solid var(--ink-200)', fontSize: 14, color: 'var(--ink-500)',
        }}>
          오늘 할일 모두 완수 · Day 7 보너스
        </div>
      </div>

      {/* Bonus chips */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="chip chip--coral">+10 7일 연속 보너스</span>
        <span className="chip chip--grape">+5 깨끗한 글씨</span>
      </div>

      {/* Submit */}
      <div style={{ padding: '8px 16px 30px' }}>
        <button className="btn btn--coral btn--full btn--lg display">
          {amount}개 보석 지급하기 ✨
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ManagerDashboard, ApprovalScreen, GrantPointsScreen });
