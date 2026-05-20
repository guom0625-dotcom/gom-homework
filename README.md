# gomHomework

매일 할일을 완료하며 섬을 정복하는 가족용 숙제 관리 앱.

- **학생** — 할일 등록 → 제출 → 보석 획득 → 보상 교환
- **매니저** — 할일 승인/반려 → 보석 지급 → 보상 카탈로그 관리

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
| `EXPO_PUBLIC_API_URL` | `http://192.168.1.101:3100` | 서버 주소 (폰에서 접근 가능한 LAN IP) |

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

## 자체 업데이트 (앱 내 자동 업데이트)

앱 시작 3초 후 GitHub Releases API를 호출해 최신 버전을 확인합니다.

```
앱 시작
  └─ 3초 후 → GET https://api.github.com/repos/guom0625-dotcom/gom-homework/releases/latest
       └─ 현재 버전보다 신규 태그 존재?
            └─ YES → 업데이트 다이얼로그 표시
                  └─ "지금 업데이트" 탭
                        └─ APK 다운로드 (진행바 표시)
                              └─ 시스템 패키지 설치러 실행
```

**주의사항:**
- Android 전용 기능 (iOS 미지원)
- 개발 모드(`__DEV__`)에서는 동작하지 않음
- 최초 설치 시 Android 설정 > 보안 > **알 수 없는 앱 설치** 허용 필요
- 서명 키가 동일해야 업데이트 설치 가능 (keystore 분실 금지)

---

## API 엔드포인트

Base URL: `http://<서버-IP>:3100`

### 인증

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/auth/signup` | 회원가입 → `{ key }` 반환 |
| `POST` | `/auth/pairing-code` | 매니저 → 6자리 코드 생성 (5분 유효) |
| `POST` | `/auth/redeem` | 학생 → 코드 입력으로 매니저 연결 |

모든 인증 필요 API: `Authorization: Bearer <key>` 헤더 필수.

### 학생

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/me` | 내 정보 + 보석 잔고 + 매니저 정보 |
| `PATCH` | `/me` | 이름 / push_token 수정 |
| `GET` | `/progress` | 일별 진행 상태 목록 |
| `GET` | `/tasks?day=N` | N일차 할일 목록 |
| `POST` | `/tasks` | 할일 등록 |
| `POST` | `/tasks/:id/submit` | 할일 제출 |
| `DELETE` | `/tasks/:id` | 할일 삭제 (todo 상태만) |
| `POST` | `/day/:day/complete` | 하루 완료 (approved → complete) |
| `GET` | `/catalog` | 보상 카탈로그 조회 |
| `POST` | `/spend-requests` | 보상 구매 요청 |

### 매니저

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/students` | 연결된 학생 목록 + 보석 잔고 |
| `GET` | `/students/:id/progress` | 특정 학생 일별 진행 상태 |
| `GET` | `/tasks?student_id=xxx` | 특정 학생 할일 목록 |
| `POST` | `/tasks/:id/approve` | 할일 승인 + 보석 지급 |
| `POST` | `/tasks/:id/reject` | 할일 반려 |
| `GET/PUT` | `/rules` | 자동 보상 규칙 조회/설정 |
| `POST` | `/catalog` | 보상 아이템 등록 |
| `PATCH` | `/catalog/:id` | 보상 아이템 수정 |
| `DELETE` | `/catalog/:id` | 보상 아이템 삭제 |
| `GET` | `/spend-requests` | 보상 구매 요청 목록 |
| `POST` | `/spend-requests/:id/approve` | 보상 요청 승인 (보석 차감) |
| `POST` | `/spend-requests/:id/reject` | 보상 요청 거절 |

### 보석 종류

| 종류 | 포인트 | 등급 |
|---|---|---|
| topaz (토파즈) | 1pt | C |
| sapphire (사파이어) | 3pt | B |
| emerald (에메랄드) | 5pt | A |
| ruby (루비) | 10pt | S |
| amethyst (자수정) | 25pt | S+ |

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
