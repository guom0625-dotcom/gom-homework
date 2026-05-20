// app.config.js — CI에서 EXPO_VERSION / EXPO_VERSION_CODE 환경변수로 버전 주입
// 로컬 개발: app.json 기본값(1.0.0) 사용
const base = require('./app.json');

const version = process.env.EXPO_VERSION ?? base.expo.version;
const versionCode = Number(process.env.EXPO_VERSION_CODE ?? 1);

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    version,
    android: {
      ...base.expo.android,
      versionCode,
      permissions: [
        ...(base.expo.android.permissions ?? []),
        'REQUEST_INSTALL_PACKAGES',
        'ACCESS_FINE_LOCATION',
        'ACCESS_WIFI_STATE',
      ],
    },
    plugins: [
      'expo-font',
      'expo-secure-store',
      'expo-file-system',
    ],
    extra: {
      ...base.expo.extra,
      updateRepo: 'guom0625-dotcom/gom-homework',
    },
  },
};
