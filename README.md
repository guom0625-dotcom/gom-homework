# gomHomework

매일 할일을 완료하며 그 달의 섬(하루 = 섬 하나)을 정복하는 가족용 숙제 관리 앱.

- **책읽기** — 학생이 책을 등록(제목+사진) → 다 읽으면 읽은 내용을 적어 완료 요청 → 매니저 승인 시 루비 1개
- **학생** — 할일 등록 → 제출 → 하루 할일이 전부 승인되면 다음 날 다이아 1개 → 상점에서 보상 구매 → 사용
- **매니저** — 할일 승인/반려, 삭제 요청 승인 → 보상 등록, 학생이 쓰겠다는 보상을 해주고 사용 완료 처리

---

## 프로젝트 구조

```
homework/
├── app/          React Native + Expo 54 클라이언트
├── server/       Node 24 + Fastify 5 + SQLite 서버
└── .github/
    └── workflows/
        └── build-android.yml   Android APK CI 빌드
```

---

## 서버 실행 (termux + proot Ubuntu)

### 최초 설치

```bash
cd server
npm install
cp .env.example .env
# .env 편집: PORT, ADMIN_SECRET 확인
```

### 첫 매니저 계정 생성

```bash
npm run admin create-manager "엄마"
# → Bearer key 출력됨 — 앱 가입 화면에서 사용
```

### 실행 & 관리

```bash
./start.sh            # pm2로 백그라운드 시작 (재시작도 동일)
./start.sh status     # 실행 상태 확인
./start.sh log        # 실시간 로그 (Ctrl+C로 종료)
./start.sh restart    # 재시작
./start.sh stop       # 중지
```

### 개발 모드 (코드 변경 자동 반영)

```bash
./dev.sh
```

### 환경변수 (server/.env)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3100` | 서버 포트 |
| `HOST` | `0.0.0.0` | 바인드 주소 |
| `DB_PATH` | `./data/gom_homework.sqlite3` | SQLite 파일 경로 |
| `LOG_LEVEL` | `info` | 로그 레벨 (debug/info/warn/error) |
| `ADMIN_SECRET` | `changeme` | admin CLI 인증 (강한 값으로 변경 필요) |

---

## 앱 개발

### 로컬 실행

```bash
cd app
npm install
# app/.env 수정 — 서버 LAN IP 설정
# EXPO_PUBLIC_API_URL_INTERNAL=http://<서버-IP>:3100
# EXPO_PUBLIC_API_URL_EXTERNAL=https://<도메인>/hw

npx expo start
```

Expo Go 앱에서 QR 스캔하여 테스트.

### 앱 환경변수 (app/.env)

| 변수 | 예시 | 설명 |
|---|---|---|
| `EXPO_PUBLIC_API_URL_INTERNAL` | `http://192.168.1.225:3100` | 집 WiFi 안에서 서버에 직접 붙는 주소 |
| `EXPO_PUBLIC_API_URL_EXTERNAL` | `https://guom0625.duckdns.org/hw` | 그 외 모든 곳에서 쓰는 주소 |

WiFi에 연결돼 있으면 앱이 내부 주소의 `/health`를 1.5초 안에 찔러 보고, 이 서버가 응답하면 내부 주소를, 아니면 외부 주소를 쓴다 (WiFi 이름을 읽지 않으므로 위치 권한 불필요).

---

## Android APK 빌드 (GitHub Actions)

### GitHub Secrets 설정

레포지토리 Settings → Secrets and variables → Actions에서 아래 4개 등록:

| Secret | 설명 |
|---|---|
| `KEYSTORE_BASE64` | keystore.jks 파일을 base64 인코딩한 값 |
| `KEYSTORE_PASSWORD` | keystore 비밀번호 |
| `KEY_ALIAS` | key alias |
| `KEY_PASSWORD` | key 비밀번호 |

#### keystore 생성 (최초 1회)

```bash
keytool -genkey -v \
  -keystore keystore.jks \
  -alias gom-homework \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# base64 인코딩 후 GitHub Secret에 등록
base64 -w 0 keystore.jks
```

### 릴리즈 빌드 방법

```bash
# 버전 태그 push → CI 자동 빌드 + GitHub Release 생성
git tag v1.0.0
git push origin v1.0.0
```

- `v*` 태그 push 시 자동으로 APK 빌드 후 GitHub Release에 첨부
- 태그 형식: `v<major>.<minor>.<patch>` (semver)
- `workflow_dispatch`로 수동 빌드도 가능 (버전 직접 입력)

### 버전 관리

| 위치 | 역할 |
|---|---|
| `app/app.json` `version` | 로컬 개발용 기본 버전 |
| `app/app.config.js` | CI에서 `EXPO_VERSION` 환경변수로 override |
| git 태그 `v1.2.3` | 릴리즈 버전 (태그명 = APK 버전명) |
| GitHub run_number | `versionCode` (Android 내부 버전, 자동 증가) |

---

## 자체 업데이트 (강제 자동 업데이트)

앱을 켤 때, 앱이 다시 앞으로 올 때, 그리고 켜둔 채로 있는 동안에도 3분마다 GitHub Releases API로 최신 버전을 확인합니다.
최근 릴리즈 목록에서 버전이 가장 높은 것을 고릅니다 (`releases/latest`는 발행 순서 기준이라 쓰지 않음).
새 버전이 있으면 묻지 않고 내려받고, 업데이트가 끝날 때까지 앱 화면을 가립니다.

```
앱 시작 / 앱이 다시 앞으로 옴
  └─ GET https://api.github.com/repos/guom0625-dotcom/gom-homework/releases?per_page=10
       └─ 현재 버전보다 신규 태그 존재?
            └─ YES → 앱 화면을 가리고 APK 자동 다운로드 (진행바 표시)
                  └─ 시스템 패키지 설치 화면 자동 실행
                        └─ 사용자가 "업데이트" 탭 (안드로이드 정책상 생략 불가)
```

- 설치 화면을 취소하고 돌아오면 "설치하기" 버튼만 있는 화면이 계속 앱을 가린다.
- 다운로드에 실패한 경우에만 "이번만 그냥 쓰기"로 넘어갈 수 있다.
- 버전 확인 자체가 안 되면(오프라인 등) 앱은 그대로 동작한다.

**주의사항:**
- Android 전용 기능 (iOS 미지원)
- 개발 모드(`__DEV__`)에서는 동작하지 않음
- 최초 설치 시 Android 설정 > 보안 > **알 수 없는 앱 설치** 허용 필요
- 서명 키가 동일해야 업데이트 설치 가능 (keystore 분실 금지)

---

## 푸시 알림 (알림바)

학생 ↔ 매니저 사이의 일(할일 등록, 계획/완료 상신, 승인/반려, 삭제 요청, 보상 구매/사용 요청/사용 완료, 다이아 지급,
매니저의 "할일 등록 알림")은 서버가 FCM으로 직접 푸시를 보낸다. Firebase 프로젝트가 필요하다 (무료).

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성 → Android 앱 추가
   (패키지 이름 `com.guom0625.gomhomework`) → `google-services.json` 내려받기
2. 앱 빌드용: `base64 -w 0 google-services.json` 값을 GitHub Secret `GOOGLE_SERVICES_JSON_BASE64` 로 등록
   → 이후 빌드부터 앱이 알림 토큰을 서버에 등록한다
3. 서버용: 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → 받은 JSON을
   `server/fcm-credentials.json` 으로 저장 (경로는 `FCM_CREDENTIALS` 로 변경 가능) → 서버 재시작

알림은 계정이 아니라 **기기 단위**로 등록된다 (`push_tokens`). 같은 계정으로 로그인한 폰은 모두 알림을 받고,
매니저 "관리 → 이 폰에서 알림 받기"를 끄면 그 폰만 빠진다.

두 파일 모두 커밋 금지(.gitignore 처리됨). 설정이 없으면 앱과 서버는 알림 없이 그대로 동작한다.

---

## API 엔드포인트

Base URL: `http://<서버-IP>:3100`

### 인증

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/auth/signup` | 회원가입 → `{ key }` 반환 |
| `POST` | `/auth/pairing-code` | 매니저 → 6자리 코드 생성 (5분 유효) |
| `POST` | `/auth/redeem` | 학생 → 코드 입력으로 매니저 연결 |
| `POST` | `/students/:id/login-code` | 매니저 → 기존 학생 계정 재로그인용 6자리 코드 (5분 유효) |
| `POST` | `/auth/recover` | 재로그인 코드 → 그 학생 계정의 새 키 발급 (예전 키는 무효화) |

모든 인증 필요 API: `Authorization: Bearer <key>` 헤더 필수.

### 학생

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/me` | 내 정보 + 다이아 잔고(`diamonds`) + 매니저 정보 |
| `PATCH` | `/me` | 이름 / push_token 수정 |
| `GET` | `/progress?month=YYYYMM` | 해당 월의 날짜별 할일 현황 (기본: 이번 달) |
| `GET` | `/tasks?day=YYYYMMDD` | 해당 날짜 할일 목록 |
| `POST` | `/tasks` | 할일 등록 (오늘 날짜만) — 등록과 동시에 계획 상신 |
| `PATCH` | `/tasks/:id` | 반려된 계획의 제목·메모를 고쳐서 다시 상신 |
| `POST` | `/tasks/:id/submit-plan` | 반려된 계획을 그대로 다시 상신 |
| `POST` | `/tasks/:id/submit` | 완료 상신 |
| `POST` | `/tasks/:id/request-delete` | 할일 삭제 요청 (매니저 승인 필요) |
| `POST` | `/tasks/:id/cancel-delete` | 삭제 요청 취소 |
| `GET` | `/books?done_since=<ms>` | 내 책 목록 (안 끝난 책 전부 + 그 시각 이후 완료분) |
| `POST` | `/books` | 책 등록 (`title`, `photo` 필수) |
| `POST` | `/books/:id/finish` | 읽은 내용(`summary`)을 적어 완료 요청 |
| `DELETE` | `/books/:id` | 읽는 중인 책 삭제 |
| `GET` | `/catalog` | 보상 카탈로그 조회 |
| `POST` | `/catalog/:id/buy` | 보상 구매 (다이아 즉시 차감, 보유 보상으로 추가) |
| `GET` | `/rewards` | 내 보유 보상 목록 |
| `POST` | `/rewards/:id/use` | 보유 보상 사용 요청 |

### 매니저

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/students` | 연결된 학생 목록 + 다이아 잔고 + 오늘 할일 수 |
| `POST` | `/students/:id/nudge` | 오늘 할일 미등록 학생에게 등록 알림 푸시 |
| `DELETE` | `/students/:id` | 학생 삭제 (연결 해제 + 계정과 모든 기록 삭제, 되돌릴 수 없음) |
| `GET` | `/students/:id/progress?month=YYYYMM` | 특정 학생의 월별 날짜 현황 |
| `GET` | `/tasks?student_id=xxx&from=YYYYMMDD` | 특정 학생의 `from` 이후 할일 + 검토 대기 중인 할일 → `{ tasks, older_day }` |
| `POST` | `/tasks/:id/approve` | 할일 완료 승인 (`praise` 칭찬 한마디, 선택) |
| `POST` | `/tasks/:id/reject` | 할일 완료 반려 |
| `POST` | `/tasks/:id/approve-plan` · `reject-plan` | 계획 승인 / 반려 |
| `POST` | `/tasks/:id/approve-delete` · `reject-delete` | 삭제 요청 승인(실제 삭제) / 반려 |
| `GET/PUT` | `/rules` | 자동 보상 규칙 조회/설정 |
| `GET` | `/books?status=done_requested` | 연결된 학생들의 책 (상태별 / `done_since`) |
| `POST` | `/books/:id/approve` · `reject` | 책읽기 완료 승인(루비 1개 지급) / 반려 |
| `GET` | `/report/weekly?week_start=YYYYMMDD` | 주간 리포트 (기본 이번 주) |
| `GET` | `/books/shelf?student_id=xxx` | 학생의 책장 |
| `GET/PUT` | `/settings` | 마감시간 조회/설정 (`register_deadline_min`, `complete_deadline_min`) |
| `POST` | `/catalog` | 보상 아이템 등록 (`cost` 다이아, `cost_ruby` 루비, `kind`: `once` 1회성 / `always` 상시) |
| `PATCH` | `/catalog/:id` | 보상 아이템 수정 |
| `DELETE` | `/catalog/:id` | 보상 아이템 삭제 |
| `GET` | `/rewards?status=use_requested` | 연결된 학생들의 보유 보상 (상태별 필터) |
| `GET` | `/rewards?used_since=<ms>` | 안 쓴 보상 전부 + 그 시각 이후 사용 완료분 → `{ rewards, older_used_at }` (학생도 동일) |
| `POST` | `/rewards/:id/complete` | 사용 요청된 보상을 사용 완료 처리 |

### 기록 보관

- 할일·보상 기록은 서버에서 지우지 않는다 (삭제 승인된 할일만 실제 삭제).
- 화면에는 최근 1주일치만 보여주고, 목록 아래 "이전 1주일 더 보기"로 1주일씩 더 불러온다.
  매니저 검토를 기다리는 할일과 아직 쓰지 않은 보상은 기간과 무관하게 항상 보인다.

### 책읽기와 루비

- 책은 날짜와 무관하게 언제든 등록한다. 제목과 책 사진이 둘 다 있어야 등록되고, 매니저 승인은 필요 없다.
- 다 읽으면 학생이 읽은 내용을 적어 완료 요청 → 매니저가 승인하면 **루비 1개** 지급, 반려하면 다시 읽는 중.
- 보석은 두 종류: **다이아**(하루 할일 전부 승인) · **루비**(책 한 권 완료).
- 보상 가격은 다이아(`cost`)와 루비(`cost_ruby`)를 섞거나 하나만 쓸 수 있다 (합쳐서 1 이상).
  예: 다이아 3 + 루비 2 / 다이아 1 / 루비 4.

### 연속 달성 · 칭찬 · 책장 · 주간 리포트

- **연속 달성 보너스**: 할일을 전부 승인받은 날이 7·14·28·56·112·224·448일 연속이 되는 날,
  그날 다이아에 더해 보너스 1·2·4·8·16·32·64개 (그 이후는 없음). 정산 시점에 그날까지의 연속 일수로 판단하며,
  늦은 승인으로 지난 빈칸이 메워져도 소급 지급하지 않는다.
- **칭찬 한마디**: 매니저가 할일·책 완료를 승인할 때 고르거나 직접 쓴 한마디가 학생 화면과 알림에 표시된다.
- **책장**: 다 읽은 책 표지를 책장 모양으로 모아 보여준다 (이번 달 / 올해 / 전체 권수).
- **주간 리포트**: 매니저 메뉴에서 주별로 보고, 매주 일요일 20:00(KST)에 이번 주 요약이 알림으로 온다.

### 보상 (다이아)

- 보석은 다이아 한 종류.
- 날짜는 KST 달력 기준(`day` = `YYYYMMDD` 정수). 할일은 오늘 날짜에만 등록할 수 있다.
- 마감시간은 매니저가 정한다 (`GET/PUT /settings`, 연결된 모든 학생에게 공통). 값은 그 날 0시로부터의 분.
  - **등록 마감** (`register_deadline_min`) — **기본 꺼짐.** `server/.env`에 `REGISTER_DEADLINE_ENABLED=true`를 넣고
    서버를 재시작하면 켜진다 (앱은 `/me`로 상태를 받으므로 새 빌드 불필요). 켜면: 이 시각까지 하나도 등록하지 않았으면 그날은 등록 불가.
    하나라도 등록해 뒀으면 완료 마감 전까지 추가할 수 있다. 반려된 계획의 수정·재상신도 완료 마감 전까지 가능.
  - **완료 마감 = 다이아 지급 시각** (`complete_deadline_min`, 기본 1800 = 다음날 06:00, 최대 다음날 12:00):
    이 시각까지 완료 상신 가능. 이 시각에 그날 할일이 **전부 승인**돼 있으면 다이아 1개 지급 (하루 1회).
- 매니저가 완료 마감이 지난 뒤 늦게 승인해서 전부 승인 상태가 되면 그 시점에 지급.
- 할일 삭제는 학생이 요청 → 매니저가 승인해야 실제로 삭제된다.
- 보상 카탈로그 비용은 다이아 개수(`cost`) 하나.
- 학생은 상점에서 보상을 **구매**한다 (매니저 승인 없이 다이아 즉시 차감). 구매한 보상은 여러 개 보유할 수 있다.
- 보상 종류: `once`(1회성)는 한 번 팔리면 상점에서 사라지고, `always`(상시)는 계속 구매할 수 있다.
- 학생이 보유 보상의 "사용"을 누르면 매니저에게 알림 → 매니저가 실제로 해준 뒤 "사용 완료" 처리.

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 클라이언트 | React Native 0.81 + Expo SDK 54 + TypeScript |
| 상태관리 | Zustand 5 |
| 네비게이션 | React Navigation 7 (Native Stack) |
| 인증 저장 | expo-secure-store |
| 자체업데이트 | expo-file-system + expo-intent-launcher |
| 서버 | Node 24 + Fastify 5 + better-sqlite3 |
| 스키마 검증 | Zod |
| ID 생성 | ULID |
| 프로세스 관리 | pm2 |
| CI/CD | GitHub Actions |
