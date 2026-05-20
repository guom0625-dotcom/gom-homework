# Handoff: gomHomework — 어린이 숙제 관리 앱

## Overview
초·중학생 자녀를 위한 게이미피케이션 숙제 관리 앱. 학생은 매일 할일을 등록하고 부모(매니저)가 직접 검사 후 자동으로 보석을 지급한다. 모은 보석은 사전 협의된 보상(게임 시간, 외출, 용돈 등)에 사용할 수 있다.

핵심 컨셉은 **모험 지도** — 학생은 자기 캐릭터가 섬에서 섬으로 건너는 30일 챌린지로 매일의 진행을 시각화한다.

## About the Design Files
이 폴더 안의 HTML 파일들은 **디자인 레퍼런스**다 — React + Babel로 만든 인터랙티브 프로토타입으로, 최종 UI의 모양/동작/플로우를 보여준다. 그대로 프로덕션에 올리는 코드가 아니다.

해야 할 일은 이 디자인을 **타겟 코드베이스의 환경**(React Native, Flutter, native Android 등)으로 다시 구현하는 것이다. 디자인 시스템, 컴포넌트 라이브러리, 상태관리 패턴은 기존 코드베이스의 컨벤션을 따를 것. 코드베이스가 없는 경우 React Native + Expo + NativeWind 조합을 권장한다 (Android 우선, 한국어 UI, 게임풍 비주얼에 적합).

## Fidelity
**High-fidelity (hifi)** — 색상, 타이포, 여백, 인터랙션이 거의 최종 상태. 픽셀 단위로 재현할 것. 단, 캐릭터 SVG와 보석 SVG는 placeholder 수준이므로 일러스트레이터에게 실제 에셋 발주 권장.

## Target platform
- **Android 우선** (디자인은 412 × 892 기준, Android 시스템 UI 가정)
- iOS 동등 대응 가능
- 한국어 UI

---

## 사용자 역할 (User Roles)

### 학생 (Student)
- 매일 오늘의 할일 등록
- "다 했어요!" 알림으로 매니저 호출
- 매니저 승인 후 자동으로 보석 적립
- 모은 보석으로 협의된 보상 사용 요청
- 자기 캐릭터를 꾸미고 (종류·모자·자기 사진)

### 매니저 (부모/보호자)
- 학생(들) 대시보드 관리
- **자동 지급 규칙**을 한 번 설정 (할일 1개당 ? 보석, 보너스 종류별 ? 보석)
- 학생 알림 받으면 옆에서 직접 검사 후 항목별 ✓/✗
- 학생의 보상 사용 요청 승인/거절
- 보상 카탈로그 관리

---

## 핵심 시스템

### 1. 보석 가치 체계 (Gem Value System)
5종 보석에 티어와 포인트 가치를 매김:

| 보석 | 영문 키 | 티어 | 포인트(pt) | 색상 |
|---|---|---|---|---|
| 자수정 (Amethyst) | `amethyst` | S+ | 25 | `#b076ff` |
| 루비 (Ruby) | `ruby` | S | 10 | `#ff5a7a` |
| 에메랄드 (Emerald) | `emerald` | A | 5 | `#2dd4a4` |
| 사파이어 (Sapphire) | `sapphire` | B | 3 | `#3a96ff` |
| 토파즈 (Topaz) | `topaz` | C | 1 | `#ffc83a` |

**원칙**:
- 매니저가 지급할 때는 "어떤 보석 몇 개" 단위로 설정 (가치 차등으로 인플레이션 방지)
- 학생 표시는 **총 포인트(pt) = Σ(보석 가치 × 개수)**로 환산해 한 눈에 보기 좋게
- 보상 사용도 "어떤 보석 몇 개" 단위로 가격 책정 (계산 단순)

### 2. 자동 지급 규칙 (Auto-Reward Rules)
매니저가 한 번 설정해두면 학생 검사 후 자동 지급. 매번 수동 입력 불필요.

**기본 지급**:
- 할일 1개 완수: 토파즈 N개 (기본 3개)
- 오늘 모두 완수: 사파이어 N개 (기본 2개)
- 매일 다른 색 보석 자동 회전 옵션 (월=자수정, 화=루비, …)

**보너스 규칙** (각각 켜기/끄기 + 수량):
- 🔥 7일 연속 완수 — 루비 N개
- 🏆 30일 연속 완수 — 자수정 N개 (희귀)
- ⭐ 완벽 주 (다시하기 0회) — 사파이어 N개
- 🌅 얼리버드 (오전 10시 전) — 에메랄드 N개
- ✍️ 깨끗한 글씨 — 사파이어 N개
- 🎯 일일 미션 완수 — 사파이어 N개

**추가 보너스 (즉시 토글)**:
- 검사 끝낸 후 매니저가 그 자리에서 +5pt~+10pt 즉시 토글 가능 (깨끗한 글씨/미션/기분/특별)

### 3. 보상 사용 흐름 (Spend Flow)
1. 매니저가 **보상 카탈로그** 사전 등록 (학생과 협의)
   - 예: "게임 30분 = 토파즈 20 + 사파이어 3"
2. 학생이 카탈로그에서 선택 → "엄마에게 사용 요청"
3. 매니저가 알림 받음 → 무엇을 사용하려는지/얼마나 차감되는지 확인 → 승인/거절
4. 승인 시 즉시 보석 차감, 학생 화면에 잔액 표시

### 4. 게이미피케이션 요소
- **30일 챌린지**: 메인 화면이 30개 섬을 건너는 지도. 캐릭터가 currentDay 위치에 있음
- **보너스 섬**: Day 7/14/21/30 도달 시 보물상자 화면 (희귀 보석 + 모자 등 잠금 해제)
- **업적 컬렉션**: 9개 배지 (첫걸음, 7일 연속, 30일 연속, 수학 마스터, 독서왕, 완벽주의자, 보석 수집가, 얼리버드, 깨끗한 글씨)
- **캐릭터 커스터마이즈**:
  - 4종 (곰/여우/고양이/부엉이)
  - 모자 5색 (보석으로 구매)
  - **자기 얼굴 사진을 캐릭터 얼굴에 합성** (옵션 토글)

---

## 화면 목록 (Screens)

### 학생 플로우
| 화면 | 컴포넌트 | 목적 |
|---|---|---|
| 로그인 / 계정 선택 | `LoginScreen` | 학생/매니저 역할 분기 |
| **메인 (징검다리)** | `MainHorizontal` / `MainVertical` / `MainArchipelago` / `MainBoard` | 30일 챌린지 진행도, 4가지 시각 변형 |
| 오늘의 할일 등록 | `TaskRegisterScreen` | 할일 1~N개 등록 후 "다 했어요!" 알림 |
| 사용 요청 대기 | `PendingScreen` | 매니저가 검사하러 오는 중 |
| 보상 사용 선택 | `SpendScreen` | 협의된 보상 카탈로그에서 선택 + 차감 미리보기 |
| 사용 요청 대기 | `SpendPendingScreen` | 매니저 승인 대기 |
| 사용 완료 + 잔액 | `SpendDoneScreen` | 컨페티 + 사용 전/후 잔액 비교 |
| 보너스 섬 | `BonusScreen` | Day 7/14/21/30 도달 시 보물상자 |
| 업적 컬렉션 | `AchievementsScreen` | 배지 그리드, 9개 |
| 캐릭터 꾸미기 | `CustomizeScreen` | 종류/모자/얼굴사진 |
| 프로필 / 설정 | `ProfileScreen` | 닉네임, 통계, 연속 일수, 설정 |

### 매니저 플로우
| 화면 | 컴포넌트 | 목적 |
|---|---|---|
| 학생 목록 대시보드 | `ManagerDashboard` | 여러 학생 상태 한눈에 (확인 필요/완료/대기) |
| **자동 지급 규칙 설정** | `AutoRewardsScreen` | 할일당/보너스별 보석 수량 설정 |
| 할일 검사 (직접 검사) | `ApprovalScreen` | 항목별 ✓/✗ — 사진 검증 없이 옆에서 확인 |
| 자동 지급 결과 | `AutoGrantResultScreen` | 규칙대로 지급된 내역 + 즉시 추가 보너스 |
| 보상 카탈로그 관리 | `RewardCatalogScreen` | 보상 추가/수정 (보석 갯수로 가격) |
| 사용 요청 승인 | `SpendApprovalScreen` | 학생 사용 요청 검토 후 승인/거절 |

---

## Design Tokens

### Colors
모두 `styles.css`의 CSS 변수로 정의되어 있다. 주요 토큰:

```css
/* Brand vivid */
--ocean-500: #00b894;   /* 메인 청록 */
--coral-500: #ff6b6b;   /* 액션 빨강 */
--sun-500:   #ffc83a;   /* 액센트 노랑 */
--grape-500: #7b61ff;   /* 매니저 보라 */
--sky-500:   #3a96ff;

/* Gem tones */
--gem-amethyst: #b076ff;
--gem-ruby:     #ff5a7a;
--gem-emerald:  #2dd4a4;
--gem-sapphire: #3a96ff;
--gem-topaz:    #ffc83a;

/* Surface */
--paper:    #fffaf2;    /* 메인 배경 (warm cream) */
--paper-2:  #fdf3df;
--card:     #ffffff;
--ink-900:  #1d2330;    /* 본문 텍스트 */
--ink-700:  #3a4254;
--ink-500:  #6b7488;    /* 보조 텍스트 */
--ink-300:  #b6bdcc;
--ink-200:  #d9deea;
--ink-100:  #ebeef5;

/* Background gradients */
--sea-bg: linear-gradient(180deg, #b4e6ff 0%, #88d1f5 35%, #5ab6e8 100%);
```

### Typography
- **Display**: `Jua` (한글 게임 느낌 라운디드)
- **Body**: `Noto Sans KR`
- **Numbers**: `Fredoka` (영문 라운디드, tabular-nums)

스케일: 11/12/13/14/15/17/18/20/22/26/28/38/44/56/64 px

### Spacing
- Radius: `10/16/22/28` px, pill `999`
- Card shadow: `0 2px 0 rgba(29,35,48,0.08), 0 8px 24px rgba(29,35,48,0.06)`
- Large card shadow: `0 4px 0 rgba(29,35,48,0.1), 0 18px 40px rgba(29,35,48,0.1)`
- 모든 버튼은 **bottom 4px 색 그림자**로 게임풍 입체감 (active 시 2px로 줄임)

### Buttons
- `.btn` 기본: pill 모양, 14px/24px padding, 17px 폰트
- 색상 변형: `.btn--coral` `.btn--sun` `.btn--grape` `.btn--ghost`
- 크기 변형: `.btn--lg` `.btn--sm` `.btn--full`

---

## State Management 필요사항

### 학생 측 상태
```
user: { id, name, characterType, hatColor, photoUrl, currentDay, streak }
inventory: { amethyst: n, ruby: n, emerald: n, sapphire: n, topaz: n }
todayTasks: [{ id, title, sub, status: 'todo'|'pending'|'approved'|'rejected' }]
dayStatus: 'todo' | 'pending' | 'approved' | 'complete'
achievements: [{ id, earned, earnedAt }]
spendRequests: [{ id, rewardId, status: 'pending'|'approved'|'rejected', cost }]
```

### 매니저 측 상태
```
students: [{ id, name, currentDay, status, points, ... }]
rules: {
  perTask: { gem, count },
  allDone: { gem, count },
  rotate: bool,
  bonuses: { streak7: { on, gem, amt }, streak30, perfect, early, neat, mission }
}
catalog: [{ id, name, emoji, color, cost: { gem: count } }]
pendingApprovals: [{ studentId, type: 'task'|'spend', payload }]
```

### 헬퍼 함수 (재사용)
```js
GEM_VALUES        // 5종 보석 메타데이터 (pt, name, tier, tone)
gemsToPoints(inv) // 인벤토리 → 총 포인트
costToPoints(cost)
canAfford(inv, cost)
subtractCost(inv, cost)
```

---

## Interactions & Behavior

### 인터랙션
- **버튼 active**: `transform: translateY(2px); box-shadow 4px → 2px` (게임풍 누름 효과)
- **컨페티**: 보너스 섬 도착, 보상 사용 승인 시 (40개 정도 색 점)
- **사용 가능 vs 부족**: 보석 부족 시 카드 opacity 0.5 + 🔒 + disabled
- **변경 하이라이트**: 사용 후 잔액 화면에서 차감된 보석 칩만 빨간 테두리

### 알림
- 학생 → 매니저 push: "지호가 다 했어요!", "지호가 보상 사용을 요청했어요"
- 매니저 → 학생 push: "확인 완료 + ?pt 적립!", "사용 요청 승인됨"

### 애니메이션 (선택)
- 캐릭터가 currentDay 섬에 도착할 때 가벼운 바운스
- 보석 적립 시 카운트업 애니메이션
- 보너스 섬 보물상자 빛나는 glow

---

## Assets

### 자체 SVG (재구현 시 그대로 가능)
- `Character` (4종, 모자/사진 합성 지원) — `components/shared.jsx`
- `Gem` (5색 다이아몬드 컷) — `components/shared.jsx`
- `IslandTile` (5상태: pending/current/complete/locked/bonus) — `components/shared.jsx`
- `Cloud`, `Palm` 장식 SVG
- `TreasureChest` (보너스 섬 보물상자, open/closed) — `components/game-screens.jsx`
- `Confetti` (랜덤 색 점 40개)

### 폰트 (Google Fonts CDN)
- Jua
- Noto Sans KR
- Fredoka

### 이모지
- 보상 아이콘에 이모지 사용 (🎮 🛍️ 🚲 🎬 📚 🍱)
- 프로덕션에서는 일러스트 아이콘으로 교체 권장

### 미공급 에셋 — 발주 필요
- 캐릭터 일러스트 4종 (곰/여우/고양이/부엉이) — 다양한 mood (happy/sleep/wow)
- 보석 5종 일러스트 (현재 SVG는 placeholder 수준)
- 보물상자/장식 일러스트
- 로고

---

## Files in this bundle

```
index.html                      디자인 캔버스 (모든 화면 모아보기)
live.html                       라이브 프로토타입 (Tweaks 패널로 상태 변경)
styles.css                      디자인 토큰 + 버튼/카드 스타일
android-frame.jsx               Android 프레임 컴포넌트
tweaks-panel.jsx                Tweaks 패널 컴포넌트
image-slot.js                   이미지 슬롯 웹 컴포넌트

components/
├── shared.jsx                  공통: Gem, Character, IslandTile, TopHud, TaskItem, GEM_VALUES, gemsToPoints
├── student-screens.jsx         학생: 로그인, 할일 등록, 대기, 보상, 프로필
├── manager-screens.jsx         매니저: 대시보드, 검사
├── manager-rules.jsx           매니저: 자동 지급 규칙, 결과
├── main-variations.jsx         메인 화면 4가지 변형 (Horizontal/Vertical/Archipelago/Board)
├── game-screens.jsx            보너스 섬, 업적, 캐릭터 꾸미기
├── spend-screens.jsx           보상 카탈로그/사용/요청/승인
└── live-prototype.jsx          라이브 프로토타입 (Tweaks)
```

### 보는 법
1. **index.html**을 브라우저로 열기 → 모든 화면을 캔버스에서 한 번에 비교
2. **live.html**을 열고 Tweaks 패널에서 화면/상태/캐릭터/보석을 실시간 변경
3. 각 컴포넌트의 props 구조와 상태를 그대로 가져갈 수 있음

---

## 구현 참고

### 권장 폴더 구조 (React Native / Expo 예시)
```
src/
├── theme/             tokens.ts (이 README의 Design Tokens 그대로 옮기기)
├── components/        Gem, Character, IslandTile, TopHud, TaskItem 등 재구현
├── screens/
│   ├── student/       메인, 할일 등록, 보상, 보너스 등
│   └── manager/       대시보드, 규칙, 검사, 카탈로그 등
├── lib/
│   ├── gems.ts        GEM_VALUES, gemsToPoints, canAfford, subtractCost
│   └── api.ts         (백엔드 연결)
└── store/             Zustand / Redux / TanStack Query
```

### 주의사항
- **한글 자간**: Jua 폰트는 한국 게임 느낌을 잘 살려주지만, 너무 작은 사이즈(<12px)에서는 가독성 떨어짐 — 본문은 Noto Sans KR로
- **숫자 표기**: 보석 개수, 포인트는 모두 tabular-nums + 우측 정렬
- **버튼 그림자**: `box-shadow`의 첫 번째 layer가 색 그림자 (게임풍 입체감의 핵심). active 시 줄어드는 효과 유지
- **캐릭터 사진 합성**: SVG의 `<clipPath>`로 얼굴 ellipse 영역만 클리핑, 몸/귀/모자는 SVG 유지

### 백엔드 고려사항
- 사용자 인증 (학생 / 매니저 페어링)
- 푸시 알림 (학생→매니저, 매니저→학생)
- 보석/할일/카탈로그 CRUD
- 거래 기록 (지급/사용 히스토리)
- 매니저 1명 ↔ 학생 N명 관계
