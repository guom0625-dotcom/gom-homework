// app.config.js — CI에서 EXPO_VERSION / EXPO_VERSION_CODE 환경변수로 버전 주입
// 로컬 개발: app.json 기본값(1.0.0) 사용
const base = require('./app.json');

const version = process.env.EXPO_VERSION ?? base.expo.version;
const versionCode = Number(process.env.EXPO_VERSION_CODE ?? 1);

// 푸시 알림(FCM)용 Firebase 설정. 파일이 있을 때만 적용 — 없으면 알림 없이 빌드된다.
// CI에서는 GOOGLE_SERVICES_JSON_BASE64 시크릿으로 이 파일을 만든다.
const googleServicesFile = './google-services.json';
const hasGoogleServices = require('fs').existsSync(require('path').join(__dirname, googleServicesFile));

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    version,
    android: {
      ...base.expo.android,
      versionCode,
      ...(hasGoogleServices ? { googleServicesFile } : {}),
      permissions: [
        ...(base.expo.android.permissions ?? []),
        'REQUEST_INSTALL_PACKAGES',
        'POST_NOTIFICATIONS',
      ],
    },
    plugins: [
      'expo-font',
      'expo-secure-store',
      'expo-file-system',
      'expo-notifications',
      // 집 WiFi 안에서는 서버 내부 주소(http://192.168.x.x)로 직접 붙는다 — 릴리즈 빌드는 평문 HTTP가 기본 차단이라 허용 필요
      ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
    ],
    extra: {
      ...base.expo.extra,
      updateRepo: 'guom0625-dotcom/gom-homework',
    },
  },
};
