# gomHomework

매일 할일을 완료하며 그 달의 섬(하루 = 섬 하나)을 정복하는 가족용 숙제 관리 앱.

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
# EXPO_PUBLIC_API_URL=http://<서버-IP>:3100

npx expo start
```

Expo Go 앱에서 QR 스캔하여 테스트.

### 앱 환경변수 (app/.env)

| 변수 | 예시 | 설명 |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.1.225:3100` | 서버 주소 (폰에서 접근 가능한 LAN IP) |

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

앱을 켤 때와 앱이 다시 앞으로 올 때(최대 10분에 한 번) GitHub Releases API로 최신 버전을 확인합니다.
새 버전이 있으면 묻지 않고 내려받고, 업데이트가 끝날 때까지 앱 화면을 가립니다.

```
앱 시작 / 앱이 다시 앞으로 옴
  └─ GET https://api.github.com/repos/guom0625-dotcom/gom-homework/releases/latest
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
| `POST` | `/tasks` | 할일 등록 (오늘 날짜만) |
| `POST` | `/tasks/:id/submit-plan` | 계획 상신 |
| `POST` | `/tasks/:id/submit` | 완료 상신 |
| `POST` | `/tasks/:id/request-delete` | 할일 삭제 요청 (매니저 승인 필요) |
| `POST` | `/tasks/:id/cancel-delete` | 삭제 요청 취소 |
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
| `POST` | `/tasks/:id/approve` | 할일 완료 승인 |
| `POST` | `/tasks/:id/reject` | 할일 완료 반려 |
| `POST` | `/tasks/:id/approve-plan` · `reject-plan` | 계획 승인 / 반려 |
| `POST` | `/tasks/:id/approve-delete` · `reject-delete` | 삭제 요청 승인(실제 삭제) / 반려 |
| `GET/PUT` | `/rules` | 자동 보상 규칙 조회/설정 |
| `POST` | `/catalog` | 보상 아이템 등록 (`kind`: `once` 1회성 / `always` 상시) |
| `PATCH` | `/catalog/:id` | 보상 아이템 수정 |
| `DELETE` | `/catalog/:id` | 보상 아이템 삭제 |
| `GET` | `/rewards?status=use_requested` | 연결된 학생들의 보유 보상 (상태별 필터) |
| `GET` | `/rewards?used_since=<ms>` | 안 쓴 보상 전부 + 그 시각 이후 사용 완료분 → `{ rewards, older_used_at }` (학생도 동일) |
| `POST` | `/rewards/:id/complete` | 사용 요청된 보상을 사용 완료 처리 |

### 기록 보관

- 할일·보상 기록은 서버에서 지우지 않는다 (삭제 승인된 할일만 실제 삭제).
- 화면에는 최근 1주일치만 보여주고, 목록 아래 "이전 1주일 더 보기"로 1주일씩 더 불러온다.
  매니저 검토를 기다리는 할일과 아직 쓰지 않은 보상은 기간과 무관하게 항상 보인다.

### 보상 (다이아)

- 보석은 다이아 한 종류.
- 날짜는 KST 달력 기준(`day` = `YYYYMMDD` 정수). 할일은 오늘 날짜에만 등록/상신할 수 있다.
- 날짜가 바뀌면(KST 자정) 서버가 전날을 정산: 그날 할일이 **전부 승인**돼 있으면 다이아 1개 자동 지급 (하루 1회).
- 매니저가 날짜가 지난 뒤 늦게 승인해서 전부 승인 상태가 되면 그 시점에 지급.
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
