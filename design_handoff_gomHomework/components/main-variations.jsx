// main-variations.jsx — 메인 화면 (징검다리 진행도) 여러 변형
//
// 4가지 변형:
//   A. 가로 바다 지도 (curving horizontal path)
//   B. 세로 스크롤 경로 (S-curve descending, Candy Crush 스타일)
//   C. 위에서 본 아키펠라고 (top-down archipelago)
//   D. 보드게임 그리드 (board-game grid)

// ─────────────────────────────────────────────────────────────
// 공통 — 메인 화면의 상태(현재 day, 캐릭터, 보석, 검토 상태)는
// AppMain의 props로 주입. 변형마다 visual 차이.
// ─────────────────────────────────────────────────────────────

// 상태 → 칩
function StatusBanner({ status, day }) {
  const cfg = {
    todo:     { bg: 'linear-gradient(135deg,#ffe2d6,#ff8a66)', col: '#d94545', text: '오늘의 할일을 등록하세요', icon: '📝' },
    pending:  { bg: 'linear-gradient(135deg,#fff1c2,#ffd980)', col: '#c98c00', text: '매니저가 확인하러 올거예요',  icon: '🔍' },
    approved: { bg: 'linear-gradient(135deg,#cdf3e2,#7ee0a8)', col: '#0e8a66', text: '모두 통과! 다음 섬으로', icon: '✨' },
    complete: { bg: 'linear-gradient(135deg,#ebe3ff,#c6b5ff)', col: '#4d36c4', text: `Day ${day} 완료! 내일 또 봐요`, icon: '🎉' },
  };
  const c = cfg[status] || cfg.todo;
  return (
    <div style={{
      background: c.bg, color: c.col, borderRadius: 14, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.05)',
    }}>
      <div style={{ fontSize: 18 }}>{c.icon}</div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.text}</div>
      <div style={{ fontSize: 16 }}>›</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VARIATION A — 가로 바다 지도 (curving horizontal path)
// 캐릭터는 currentDay 섬에. 좌우 스크롤로 더 보기
// ─────────────────────────────────────────────────────────────
function MainHorizontal({ currentDay = 7, character = 'bear', points = 124, status = 'pending', photoUrl, showMission = true }) {
  const totalDays = 30;
  const islands = Array.from({ length: 14 }, (_, i) => i + 1);

  return (
    <div className="app" style={{
      height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #b4e6ff 0%, #88d1f5 35%, #5ab6e8 100%)',
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      {/* Clouds */}
      <Cloud size={70} style={{ position: 'absolute', top: 16, left: 14, opacity: .8 }}/>
      <Cloud size={50} style={{ position: 'absolute', top: 60, right: 30, opacity: .65 }}/>
      <Cloud size={90} style={{ position: 'absolute', top: 110, left: 130, opacity: .55 }}/>

      {/* HUD */}
      <div style={{ padding: '12px 12px 0', position: 'relative', zIndex: 5 }}>
        <TopHud name="지호" character={character} points={points} streak={currentDay} photoUrl={photoUrl}/>
      </div>

      {/* Day big indicator */}
      <div style={{ padding: '14px 16px 6px', position: 'relative', zIndex: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="display" style={{ fontSize: 14, color: '#fff', opacity: .9 }}>
            오늘은
          </span>
          <span className="display num" style={{
            fontSize: 48, color: '#fff', lineHeight: 1,
            textShadow: '0 3px 0 rgba(29,35,48,.18)',
          }}>
            DAY {currentDay}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#fff', opacity: .85, marginTop: 2 }}>
          / {totalDays}일 챌린지 · 다음 보너스까지 {7 - (currentDay % 7)}일
        </div>
      </div>

      {/* SEA MAP — horizontal scroll */}
      <div style={{ flex: 1, position: 'relative', overflowX: 'auto', overflowY: 'hidden' }}>
        <div className="water-shimmer" style={{
          position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none',
        }}/>

        <svg width={islands.length * 95 + 60} height="100%" viewBox={`0 0 ${islands.length * 95 + 60} 360`}
             style={{ display: 'block', minHeight: 360 }}>
          {/* Wavy dotted path */}
          <path d={islands.map((d, i) => {
            const x = 50 + i * 95;
            const y = 200 + Math.sin(i * 0.6) * 50;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')} stroke="rgba(255,255,255,.55)" strokeWidth="3" fill="none" strokeDasharray="2 8" strokeLinecap="round"/>
        </svg>

        {/* Islands positioned absolutely */}
        <div style={{ position: 'absolute', top: 0, left: 0, height: 360, width: islands.length * 95 + 60 }}>
          {islands.map((d, i) => {
            const x = 50 + i * 95;
            const y = 200 + Math.sin(i * 0.6) * 50;
            const state = d < currentDay ? 'complete' : d === currentDay ? 'current' :
                          d === 7 || d === 14 || d === 21 ? (d <= currentDay ? 'complete' : 'bonus') :
                          d > currentDay + 4 ? 'locked' : 'pending';
            const finalState = (d === 7 && d > currentDay) ? 'bonus' :
                               (d === 14 && d > currentDay) ? 'bonus' : state;
            const gemColors = ['amethyst','ruby','emerald','sapphire','topaz'];
            return (
              <div key={d} style={{
                position: 'absolute', left: x - 42, top: y - 30,
              }}>
                <IslandTile
                  state={finalState}
                  day={d}
                  size={80}
                  character={d === currentDay && <Character type={character} size={48} mood="happy" photoUrl={photoUrl}/>}
                  gem={<Gem size={30} color={gemColors[d % 5]}/>}
                />
              </div>
            );
          })}

          {/* Palm decoration on island 1 */}
          <div style={{ position: 'absolute', left: 22, top: 130 }}>
            <Palm size={36}/>
          </div>
        </div>
      </div>

      {/* Bottom action area */}
      <div style={{
        background: 'var(--paper)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '14px 14px 16px',
        boxShadow: '0 -8px 30px rgba(0,0,0,.1)',
        zIndex: 5,
      }}>
        {showMission && (
          <div style={{ marginBottom: 8 }}>
            <DailyMissionCard/>
          </div>
        )}
        <StatusBanner status={status} day={currentDay}/>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn--ghost" style={{ flex: 0.4 }}>📋</button>
          <button className="btn btn--coral display" style={{ flex: 1 }}>
            {status === 'todo'     ? '오늘의 할일 등록' :
             status === 'pending'  ? '검토 상태 보기' :
             status === 'approved' ? '다음 섬으로 가기' :
                                    '내일 다시 도전'}
          </button>
          <button className="btn btn--ghost" style={{ flex: 0.4 }}>💎</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VARIATION B — 세로 스크롤 경로 (S-curve, Candy Crush 스타일)
// ─────────────────────────────────────────────────────────────
function MainVertical({ currentDay = 7, character = 'bear', points = 124, status = 'pending', photoUrl }) {
  const days = Array.from({ length: 12 }, (_, i) => i + 1);
  // S-curve x positions
  const xPos = (i) => 100 + Math.sin(i * 0.9) * 90;

  return (
    <div className="app" style={{
      height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #88d1f5 0%, #5ab6e8 100%)',
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      {/* HUD on top */}
      <div style={{ padding: '12px 12px 8px', position: 'relative', zIndex: 5 }}>
        <TopHud name="지호" character={character} points={points} streak={currentDay} photoUrl={photoUrl}/>
      </div>

      {/* Goal banner */}
      <div style={{ padding: '6px 16px 10px', position: 'relative', zIndex: 4,
        display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
        <div className="display num" style={{ fontSize: 32,
          textShadow: '0 3px 0 rgba(29,35,48,.18)' }}>DAY {currentDay}</div>
        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.3)', borderRadius: 999,
          overflow: 'hidden' }}>
          <div style={{ width: `${(currentDay/30)*100}%`, height: '100%',
            background: 'linear-gradient(90deg,#ffe070,#ff8855)', borderRadius: 999,
            boxShadow: '0 0 8px rgba(255,200,58,.6)' }}/>
        </div>
        <div className="num" style={{ fontSize: 12, opacity: .9 }}>/30</div>
      </div>

      {/* S-curve scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <Cloud size={50} style={{ position: 'absolute', top: 6, right: 10, opacity: .7, zIndex: 1 }}/>

        <div style={{ position: 'relative', width: '100%', height: days.length * 92 + 40 }}>
          {/* Path SVG behind */}
          <svg width="100%" height="100%" viewBox={`0 0 280 ${days.length * 92}`}
               preserveAspectRatio="xMidYMin meet"
               style={{ position: 'absolute', inset: 0 }}>
            <path d={days.map((d, i) => {
              const x = xPos(i);
              const y = i * 92 + 50;
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')} stroke="rgba(255,255,255,.55)" strokeWidth="4" fill="none"
              strokeDasharray="2 10" strokeLinecap="round"/>
          </svg>

          {/* Islands top-to-bottom */}
          {days.map((d, i) => {
            const x = xPos(i);
            const y = i * 92 + 12;
            const isCurrent = d === currentDay;
            const isComplete = d < currentDay;
            const isBonus = d === 7 || d === 14 || d === 21;
            const state = isComplete ? 'complete' : isCurrent ? 'current' :
                          isBonus ? 'bonus' :
                          d > currentDay + 4 ? 'locked' : 'pending';
            const gemColors = ['amethyst','ruby','emerald','sapphire','topaz'];
            return (
              <div key={d} style={{
                position: 'absolute', left: x - 40, top: y,
              }}>
                <IslandTile
                  state={state}
                  day={d}
                  size={80}
                  character={isCurrent && <Character type={character} size={48} mood="happy" photoUrl={photoUrl}/>}
                  gem={<Gem size={28} color={gemColors[d % 5]}/>}
                />
                {isBonus && (
                  <div style={{ position: 'absolute', top: -10, right: -8,
                    background: '#ff5a7a', color: '#fff', fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 999,
                    boxShadow: '0 2px 0 #c4304f' }}>BONUS</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom action */}
      <div style={{
        background: 'var(--paper)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '14px 14px 16px', zIndex: 5,
        boxShadow: '0 -8px 30px rgba(0,0,0,.1)',
      }}>
        <StatusBanner status={status} day={currentDay}/>
        <button className="btn btn--coral btn--full display" style={{ marginTop: 10 }}>
          {status === 'todo'     ? '오늘의 할일 등록' :
           status === 'pending'  ? '검토 상태 보기' :
           status === 'approved' ? '다음 섬으로 가기' :
                                  '내일 다시 도전'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VARIATION C — 위에서 본 아키펠라고 (top-down archipelago)
// 큰 지도 안에 여러 섬, 현재 섬 강조
// ─────────────────────────────────────────────────────────────
function MainArchipelago({ currentDay = 7, character = 'bear', points = 124, status = 'pending', photoUrl }) {
  // Hand-placed island positions on a fictional map (% of container)
  const islands = [
    { d: 1, x: 18, y: 78 }, { d: 2, x: 28, y: 64 }, { d: 3, x: 22, y: 48 },
    { d: 4, x: 36, y: 38 }, { d: 5, x: 50, y: 50 }, { d: 6, x: 60, y: 32 },
    { d: 7, x: 72, y: 44 }, { d: 8, x: 80, y: 62 }, { d: 9, x: 68, y: 78 },
    { d: 10, x: 50, y: 86 },
  ];

  return (
    <div className="app" style={{
      height: '100%', overflow: 'hidden',
      background: 'linear-gradient(135deg, #5ab6e8 0%, #1d6fd0 100%)',
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      {/* HUD */}
      <div style={{ padding: '12px 12px 6px', position: 'relative', zIndex: 5 }}>
        <TopHud name="지호" character={character} points={points} streak={currentDay} photoUrl={photoUrl}/>
      </div>

      {/* Compass + day */}
      <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 5 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'rgba(255,255,255,.2)', border: '2px solid rgba(255,255,255,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: '#fff',
        }}>🧭</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)' }}>탐험 진행</div>
          <div className="display num" style={{ fontSize: 22, color: '#fff' }}>
            {currentDay}번 섬 · {islands.length - currentDay}개 남음
          </div>
        </div>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Decorative water swirls */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .25 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <ellipse key={i}
              cx={20 + (i * 47) % 380} cy={50 + (i * 71) % 360}
              rx={20 + (i % 4) * 8} ry={4}
              fill="none" stroke="#fff" strokeWidth=".7"/>
          ))}
        </svg>

        {/* Path connecting islands */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {islands.map((isl, i) => {
            if (i === 0) return null;
            const prev = islands[i - 1];
            return (
              <line key={i}
                x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${isl.x}%`} y2={`${isl.y}%`}
                stroke="rgba(255,255,255,.55)" strokeWidth="2" strokeDasharray="2 6"/>
            );
          })}
        </svg>

        {/* Islands */}
        {islands.map((isl) => {
          const state = isl.d < currentDay ? 'complete' :
                        isl.d === currentDay ? 'current' :
                        isl.d === 7 ? 'bonus' :
                        isl.d > currentDay + 3 ? 'locked' : 'pending';
          const size = isl.d === currentDay ? 88 : 60;
          return (
            <div key={isl.d} style={{
              position: 'absolute',
              left: `${isl.x}%`, top: `${isl.y}%`,
              transform: 'translate(-50%, -50%)',
            }}>
              <IslandTile
                state={state}
                day={isl.d}
                size={size}
                character={isl.d === currentDay && <Character type={character} size={42} mood="happy" photoUrl={photoUrl}/>}
              />
            </div>
          );
        })}

        {/* Compass rose decoration top-right */}
        <div style={{ position: 'absolute', top: 12, right: 12,
          width: 50, height: 50, borderRadius: '50%',
          background: 'rgba(255,255,255,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#fff', fontWeight: 600, opacity: .8 }}>
          N↑
        </div>
      </div>

      {/* Bottom */}
      <div style={{
        background: 'var(--paper)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '14px 14px 16px', zIndex: 5,
        boxShadow: '0 -8px 30px rgba(0,0,0,.1)',
      }}>
        <StatusBanner status={status} day={currentDay}/>
        <button className="btn btn--coral btn--full display" style={{ marginTop: 10 }}>
          {status === 'todo'     ? '오늘의 할일 등록' :
           status === 'pending'  ? '검토 상태 보기' :
           status === 'approved' ? '다음 섬으로 가기' :
                                  '내일 다시 도전'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VARIATION D — 보드게임 그리드 (board-game grid, 5x6)
// Snake-and-ladders 같은 보드 위에 캐릭터 말이 놓임
// ─────────────────────────────────────────────────────────────
function MainBoard({ currentDay = 7, character = 'bear', points = 124, status = 'pending', photoUrl }) {
  const cols = 5, rows = 6;
  const totalDays = cols * rows;
  // Snake layout — row 0 left-to-right, row 1 right-to-left, …
  const cellForDay = (d) => {
    const idx = d - 1;
    const r = Math.floor(idx / cols);
    const c = r % 2 === 0 ? idx % cols : cols - 1 - (idx % cols);
    return { r, c };
  };

  return (
    <div className="app" style={{
      height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #fff7e6 0%, #ffe9c2 100%)',
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 0', zIndex: 5 }}>
        <TopHud name="지호" character={character} points={points} streak={currentDay} photoUrl={photoUrl}/>
      </div>

      {/* Title */}
      <div style={{ padding: '14px 16px 8px', textAlign: 'center' }}>
        <div className="display" style={{ fontSize: 14, color: 'var(--ink-500)' }}>30일 챌린지</div>
        <div className="display num" style={{ fontSize: 30, color: 'var(--ink-900)' }}>
          {currentDay} / {totalDays}
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, padding: '0 14px 12px', overflow: 'auto' }}>
        <div style={{
          background: 'var(--paper-2)', borderRadius: 18, padding: 10,
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6,
          boxShadow: 'inset 0 0 0 2px rgba(255,200,58,.4)',
        }}>
          {Array.from({ length: totalDays }).map((_, i) => {
            // Map cell index → day using snake layout reverse
            const r = Math.floor(i / cols);
            const c = i % cols;
            const dayInRow = r % 2 === 0 ? c + 1 : cols - c;
            const d = r * cols + dayInRow;
            const isComplete = d < currentDay;
            const isCurrent = d === currentDay;
            const isBonus = d === 7 || d === 14 || d === 21 || d === 30;
            const isLocked = d > currentDay + 4;

            const bg = isComplete ? 'linear-gradient(135deg,#cdf3e2,#7ee0a8)' :
                       isCurrent  ? 'linear-gradient(135deg,#ffe070,#ff8855)' :
                       isBonus    ? 'linear-gradient(135deg,#ffc3d2,#ff7da0)' :
                       isLocked   ? '#e8e3d8' : '#fff';
            const col = isComplete ? '#0e8a66' :
                        isCurrent  ? '#fff' :
                        isBonus    ? '#c4304f' :
                        isLocked   ? 'var(--ink-300)' : 'var(--ink-700)';
            return (
              <div key={i} style={{
                aspectRatio: '1/1', borderRadius: 12,
                background: bg, color: col,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                boxShadow: isCurrent ? '0 4px 0 rgba(217,68,68,.4), 0 8px 20px rgba(255,107,107,.4)' :
                           isComplete ? '0 2px 0 rgba(14,138,102,.25)' :
                           isBonus ? '0 2px 0 rgba(196,48,79,.3)' : 'none',
                border: isCurrent ? 'none' : '1.5px solid rgba(255,255,255,.6)',
              }}>
                <div className="num" style={{ fontSize: 13, fontWeight: 700, opacity: isLocked ? .5 : 1 }}>
                  {d}
                </div>
                <div style={{ fontSize: 18, marginTop: 2 }}>
                  {isCurrent ? <Character type={character} size={32} photoUrl={photoUrl}/> :
                   isComplete ? <Gem size={20} color={['emerald','sapphire','amethyst','ruby','topaz'][d % 5]}/> :
                   isBonus ? '🎁' :
                   isLocked ? '🔒' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12,
          flexWrap: 'wrap', fontSize: 11, color: 'var(--ink-500)' }}>
          <LegendDot color="linear-gradient(135deg,#cdf3e2,#7ee0a8)" label="완료"/>
          <LegendDot color="linear-gradient(135deg,#ffe070,#ff8855)" label="오늘"/>
          <LegendDot color="linear-gradient(135deg,#ffc3d2,#ff7da0)" label="보너스"/>
          <LegendDot color="#e8e3d8" label="잠김"/>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: '8px 14px 16px', zIndex: 5 }}>
        <StatusBanner status={status} day={currentDay}/>
        <button className="btn btn--coral btn--full display" style={{ marginTop: 10 }}>
          {status === 'todo'     ? '오늘의 할일 등록' :
           status === 'pending'  ? '검토 상태 보기' :
           status === 'approved' ? '다음 칸으로 가기' :
                                  '내일 다시 도전'}
        </button>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 12, height: 12, borderRadius: 4, background: color,
        border: '1px solid rgba(255,255,255,.6)' }}/>
      <span>{label}</span>
    </div>
  );
}

Object.assign(window, { MainHorizontal, MainVertical, MainArchipelago, MainBoard });
