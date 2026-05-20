// student-screens.jsx
// 학생용 화면들 — 로그인, 메인(징검다리), 할일 등록, 검토 대기, 포인트, 프로필

// ─────────────────────────────────────────────────────────────
// AppFrame — 폰 안 화면을 감싸는 컨테이너
// ─────────────────────────────────────────────────────────────
function AppFrame({ children, bg = '#fffaf2', noScroll }) {
  return (
    <div className="app" style={{
      width: '100%', height: '100%',
      background: bg,
      overflow: noScroll ? 'hidden' : 'auto',
      position: 'relative',
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. 로그인 / 계정 선택
// ─────────────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <AppFrame bg="linear-gradient(180deg, #b4e6ff 0%, #88d1f5 60%, #5ab6e8 100%)" noScroll>
      {/* Decorative clouds */}
      <Cloud size={70} style={{ position: 'absolute', top: 24, left: 12 }}/>
      <Cloud size={50} style={{ position: 'absolute', top: 60, right: 20, opacity: 0.7 }}/>
      <Cloud size={90} style={{ position: 'absolute', top: 140, left: 80, opacity: 0.6 }}/>

      <div style={{
        position: 'absolute', left: 0, right: 0, top: 60,
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="display" style={{ fontSize: 38, color: '#fff',
          textShadow: '0 3px 0 rgba(29,35,48,.18)', letterSpacing: '-0.02em' }}>
          숙제섬
        </div>
        <div style={{ fontSize: 13, color: '#fff', opacity: .9, marginTop: 4, letterSpacing: '0.05em' }}>
          매일 한 걸음, 보석을 모으자
        </div>
      </div>

      {/* Floating island with characters */}
      <div style={{ position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)' }}>
        <svg width="240" height="160" viewBox="0 0 240 160">
          <ellipse cx="120" cy="120" rx="100" ry="22" fill="rgba(0,0,0,.1)"/>
          <ellipse cx="120" cy="110" rx="100" ry="32" fill="#a26f3d"/>
          <ellipse cx="120" cy="90" rx="100" ry="30" fill="#62b878"/>
          <ellipse cx="120" cy="78" rx="90" ry="22" fill="#7ee0a8"/>
        </svg>
        <div style={{ position: 'absolute', left: 40, top: 26 }}><Character type="fox" size={56}/></div>
        <div style={{ position: 'absolute', left: 100, top: 16 }}><Character type="bear" size={64}/></div>
        <div style={{ position: 'absolute', left: 158, top: 30 }}><Character type="owl" size={52}/></div>
      </div>

      {/* Account selection */}
      <div style={{
        position: 'absolute', left: 20, right: 20, bottom: 30,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div className="display" style={{ fontSize: 18, color: 'var(--ink-900)', marginBottom: 4 }}>
          어떻게 시작할까요?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <RoleCard role="학생" desc="오늘의 할일을 등록해요" color="#ff6b6b" emoji="🎒"/>
          <RoleCard role="매니저" desc="할일을 검토하고 보상" color="#7b61ff" emoji="🧑‍🏫"/>
        </div>
        <button className="btn btn--ghost btn--full btn--sm" style={{ marginTop: 4 }}>
          기존 계정으로 로그인
        </button>
      </div>
    </AppFrame>
  );
}

function RoleCard({ role, desc, color, emoji }) {
  return (
    <div style={{
      flex: 1, background: '#fff',
      borderRadius: 18, padding: '14px 12px',
      boxShadow: `0 4px 0 ${color}33, 0 8px 18px rgba(0,0,0,.08)`,
      border: `2px solid ${color}33`,
      textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 16,
        background: `${color}1a`, margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24,
      }}>{emoji}</div>
      <div className="display" style={{ fontSize: 18, color }}>{role}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2, lineHeight: 1.3 }}>
        {desc}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. 학생 - 오늘의 할일 등록
// ─────────────────────────────────────────────────────────────
function TaskRegisterScreen() {
  const tasks = [
    { title: '수학 문제집 24p', sub: '5-1 곱셈 단원' },
    { title: '영어 단어 외우기', sub: 'unit 12 · 20개' },
    { title: '독서 30분', sub: '해리포터 4권' },
  ];
  return (
    <AppFrame bg="#fffaf2">
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', fontSize: 16, color: 'var(--ink-700)' }}>←</button>
        <div className="display" style={{ fontSize: 22, flex: 1 }}>오늘의 할일</div>
        <div className="chip chip--ocean num">Day 7</div>
      </div>

      {/* Subtitle / progress */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
          11월 18일 · 월요일
        </div>
      </div>

      {/* Task list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((t, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 16, padding: '14px',
            border: '1.5px solid var(--ink-100)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--ocean-100)', color: 'var(--ocean-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 13,
            }} className="num">{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{t.sub}</div>
            </div>
            <button style={{ width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--ink-300)', fontSize: 16 }}>⋯</button>
          </div>
        ))}

        {/* Add task */}
        <button style={{
          padding: '14px', borderRadius: 16, border: '2px dashed var(--ocean-300)',
          background: 'rgba(45,212,164,.08)', color: 'var(--ocean-700)',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 18 }}>+</span> 할일 추가하기
        </button>
      </div>

      {/* Estimated reward */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          background: 'linear-gradient(135deg,#fff7d6,#ffe48a)',
          padding: '12px 14px', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Gem size={28} color="emerald"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--sun-700)', fontWeight: 600 }}>
              완수하면 받을 포인트 (예상)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="num display" style={{ fontSize: 22, color: 'var(--sun-700)', fontWeight: 700 }}>
                +15
              </span>
              <span style={{ fontSize: 12, color: 'var(--sun-700)' }}>pt</span>
              <span style={{ fontSize: 10, color: 'var(--sun-700)', opacity: .7, marginLeft: 4 }}>
                · 9 토파즈 + 1 사파이어
              </span>
            </div>
          </div>
          <div className="chip num" style={{ background: '#fff', color: 'var(--sun-700)' }}>3개 할일</div>
        </div>
      </div>

      {/* Submit button */}
      <div style={{ padding: '20px 16px 30px' }}>
        <button className="btn btn--coral btn--full btn--lg display">
          엄마에게 다 했어요! 알리기
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-500)', marginTop: 8 }}>
          엄마가 옆에서 확인 후 다음 섬으로 이동할 수 있어요
        </div>
      </div>
    </AppFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. 학생 - 검토 요청 / 대기 상태
// ─────────────────────────────────────────────────────────────
function PendingScreen() {
  return (
    <AppFrame bg="linear-gradient(180deg, #fff7e6 0%, #ffe9c2 100%)">
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: '#fff', fontSize: 16, color: 'var(--ink-700)' }}>←</button>
        <div className="display" style={{ fontSize: 20, flex: 1 }}>다 했어요! 알림 전송</div>
      </div>

      {/* Big waiting illustration */}
      <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #fff, #ffd980)',
          margin: '0 auto', position: 'relative',
          boxShadow: '0 8px 30px rgba(255,200,58,.4)',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
            <Character type="bear" size={80} mood="sleep"/>
          </div>
          <div style={{
            position: 'absolute', top: -8, right: 6,
            background: '#fff', borderRadius: 999,
            padding: '4px 10px', fontSize: 14, fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,.1)',
            color: 'var(--sun-700)',
          }}>⏳</div>
        </div>
        <div className="display" style={{ fontSize: 22, marginTop: 16 }}>
          엄마가 확인하러 올거예요
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
          옆에서 직접 검사하고 보석을 줄거예요
        </div>
      </div>

      {/* Submitted tasks */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-500)',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 4 }}>
          제출한 할일 · 3개
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TaskItem state="pending" title="수학 문제집 24p" subtitle="5-1 곱셈 단원"/>
          <TaskItem state="pending" title="영어 단어 외우기" subtitle="unit 12 · 20개"/>
          <TaskItem state="pending" title="독서 30분" subtitle="해리포터 4권"/>
        </div>
      </div>

      {/* Footer info */}
      <div style={{ padding: '20px 16px 30px' }}>
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
              <span className="dot dot--amber"/> 확인하러 오는 중 · 5분 전 알림
            </div>
          </div>
          <button className="btn btn--ghost btn--sm">알림</button>
        </div>
      </div>
    </AppFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. 학생 - 포인트 / 보상 화면
// ─────────────────────────────────────────────────────────────
function RewardsScreen() {
  const inventory = {
    amethyst: 4,
    ruby:     8,
    emerald:  12,
    sapphire: 18,
    topaz:    36,
  };
  const totalPoints = gemsToPoints(inventory);
  const totalGems = Object.values(inventory).reduce((s, n) => s + n, 0);

  const rewards = [
    { name: '게임 30분', cost: 50, emoji: '🎮', col: '#7b61ff' },
    { name: '편의점 1만원', cost: 200, emoji: '🛍️', col: '#ff6b6b' },
    { name: '주말 외출', cost: 120, emoji: '🚲', col: '#2dd4a4' },
    { name: '영화 보기', cost: 180, emoji: '🎬', col: '#ffc83a' },
  ];

  return (
    <AppFrame bg="linear-gradient(180deg, #4d36c4 0%, #7b61ff 60%, #c6b5ff 100%)">
      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 12, border: 'none',
          background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 16 }}>←</button>
        <div className="display" style={{ fontSize: 22, flex: 1, color: '#fff' }}>내 보석함</div>
      </div>

      {/* Big total — points (가치 환산) */}
      <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,.15)', padding: '6px 14px', borderRadius: 999,
          color: '#fff', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
          ✨ 총 포인트
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
          <span className="num display" style={{ fontSize: 64, color: '#fff', lineHeight: 1,
            textShadow: '0 4px 0 rgba(0,0,0,.18)' }}>
            {totalPoints.toLocaleString()}
          </span>
          <span className="display" style={{ fontSize: 20, color: 'rgba(255,255,255,.8)' }}>pt</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 6 }}>
          보석 {totalGems}개 · 오늘 +12pt 적립
        </div>
      </div>

      {/* Inventory breakdown — gem × value */}
      <div style={{ padding: '0 16px 20px' }}>
        <div style={{
          background: 'rgba(255,255,255,.12)', borderRadius: 16, padding: 10,
          border: '1px solid rgba(255,255,255,.18)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {Object.entries(inventory)
            .sort(([a],[b]) => GEM_VALUES[b].pt - GEM_VALUES[a].pt)
            .map(([k, n]) => {
              const g = GEM_VALUES[k];
              const sub = g.pt * n;
              return (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 6px', borderRadius: 8,
                }}>
                  <Gem size={26} color={k}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{g.name}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        background: g.tone, color: '#fff',
                      }}>{g.tier}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', marginTop: 1 }}>
                      개당 {g.pt}pt
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="num" style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
                      ×{n}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>=</span>
                    <span className="num display" style={{ fontSize: 16, color: '#fff',
                      minWidth: 36, textAlign: 'right' }}>
                      {sub}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Rewards grid */}
      <div style={{
        background: 'var(--paper)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '20px 16px 30px', marginTop: 4,
        minHeight: 240,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="display" style={{ fontSize: 18 }}>포인트로 교환</div>
          <button style={{ border: 'none', background: 'transparent',
            fontSize: 12, color: 'var(--grape-700)', fontWeight: 600 }}>내역 보기 →</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {rewards.map((r, i) => {
            const can = totalPoints >= r.cost;
            return (
              <div key={i} style={{
                background: '#fff', borderRadius: 16, padding: '14px 12px',
                boxShadow: '0 2px 0 rgba(29,35,48,.06), 0 6px 16px rgba(29,35,48,.05)',
                border: '1px solid var(--ink-100)',
                opacity: can ? 1 : 0.55,
                position: 'relative',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: `${r.col}1a`, marginBottom: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>{r.emoji}</div>
                <div className="display" style={{ fontSize: 14, color: 'var(--ink-900)' }}>
                  {r.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <span className="num" style={{ fontSize: 14, color: 'var(--ink-900)',
                    fontWeight: 700 }}>{r.cost}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>pt</span>
                </div>
                {!can && (
                  <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 11 }}>🔒</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. 학생 - 프로필 / 설정
// ─────────────────────────────────────────────────────────────
function ProfileScreen() {
  return (
    <AppFrame bg="#fffaf2">
      {/* Cover with character */}
      <div style={{
        position: 'relative', height: 200,
        background: 'linear-gradient(180deg,#88d1f5,#b4e6ff)',
        overflow: 'hidden',
      }}>
        <Cloud size={50} style={{ position: 'absolute', top: 24, left: 14, opacity: .7 }}/>
        <Cloud size={70} style={{ position: 'absolute', top: 50, right: 10, opacity: .8 }}/>

        {/* Mini island */}
        <svg width="180" height="60" viewBox="0 0 180 60" style={{ position: 'absolute',
          left: '50%', bottom: 8, transform: 'translateX(-50%)' }}>
          <ellipse cx="90" cy="40" rx="76" ry="14" fill="#a26f3d"/>
          <ellipse cx="90" cy="28" rx="76" ry="16" fill="#62b878"/>
          <ellipse cx="90" cy="22" rx="68" ry="13" fill="#7ee0a8"/>
        </svg>

        <div style={{ position: 'absolute', left: '50%', bottom: 36,
          transform: 'translateX(-50%)' }}>
          <Character type="bear" size={92} hatColor="#ff6b6b"/>
        </div>

        <button style={{ position: 'absolute', top: 14, right: 14,
          width: 36, height: 36, borderRadius: 12, border: 'none',
          background: 'rgba(255,255,255,.95)', color: 'var(--ink-700)',
          fontSize: 16 }}>⚙</button>
      </div>

      {/* Name + level */}
      <div style={{ textAlign: 'center', padding: '20px 16px 12px' }}>
        <div className="display" style={{ fontSize: 26, color: 'var(--ink-900)' }}>지호</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999, background: 'var(--paper-2)',
          marginTop: 4 }}>
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sun-700)' }}>
            모험가 Lv.5
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{
          background: '#fff', borderRadius: 18, padding: '14px',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          boxShadow: '0 2px 0 rgba(29,35,48,.06), 0 6px 16px rgba(29,35,48,.05)',
        }}>
          <StatCell label="현재 일수" value="7" sub="DAY" color="var(--ocean-700)"/>
          <StatCell label="총 포인트" value="412" sub="pt" color="var(--sun-700)"/>
          <StatCell label="완수율" value="92" sub="%" color="var(--grape-700)"/>
        </div>
      </div>

      {/* Streak calendar */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="display" style={{ fontSize: 16, marginBottom: 8 }}>이번 주 성과</div>
        <div style={{ display: 'flex', gap: 6, background: '#fff', borderRadius: 14, padding: 12,
          boxShadow: '0 2px 0 rgba(29,35,48,.06), 0 6px 16px rgba(29,35,48,.05)' }}>
          {['월','화','수','목','금','토','일'].map((d, i) => {
            const states = ['done', 'done', 'done', 'done', 'done', 'today', 'future'];
            const st = states[i];
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 4 }}>{d}</div>
                <div style={{
                  width: '100%', aspectRatio: '1/1', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: st === 'done' ? 'var(--ocean-100)' :
                              st === 'today' ? 'var(--coral-500)' : 'var(--ink-100)',
                  color: st === 'done' ? 'var(--ocean-700)' :
                         st === 'today' ? '#fff' : 'var(--ink-300)',
                  fontWeight: 700, fontSize: 14,
                }}>
                  {st === 'done' ? '✓' : st === 'today' ? '★' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings list */}
      <div style={{ padding: '0 16px 30px' }}>
        {[
          { icon: '🎨', label: '캐릭터 바꾸기', val: '곰돌이' },
          { icon: '🔔', label: '알림 설정', val: '켜짐' },
          { icon: '🧑‍🏫', label: '연결된 매니저', val: '엄마' },
          { icon: '🚪', label: '로그아웃', val: '' },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px',
            borderBottom: i < 3 ? '1px solid var(--ink-100)' : 'none',
          }}>
            <div style={{ width: 32, fontSize: 18, textAlign: 'center' }}>{row.icon}</div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{row.label}</div>
            {row.val && <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{row.val}</div>}
            <div style={{ color: 'var(--ink-300)' }}>›</div>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}

function StatCell({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 4px' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{label}</div>
      <div style={{ marginTop: 4 }}>
        <span className="num display" style={{ fontSize: 26, color, lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 11, color, marginLeft: 2 }}>{sub}</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  AppFrame, LoginScreen, TaskRegisterScreen, PendingScreen, RewardsScreen, ProfileScreen,
});
