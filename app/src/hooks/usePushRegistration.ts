import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from '../api/client';

// 앱이 켜져 있는 동안 온 알림도 알림바에 표시
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * 로그인된 기기의 푸시 토큰(FCM)을 서버에 등록한다.
 * 알림 권한을 거절했거나 Firebase 설정(google-services.json) 없이 빌드된 앱이면 조용히 건너뛴다.
 */
export function usePushRegistration(userId: string | undefined) {
    useEffect(() => {
        if (!userId || Platform.OS !== 'android') return;
        let cancelled = false;

        (async () => {
            try {
                // Android 13+: 채널이 먼저 있어야 권한 요청 창이 뜬다
                await Notifications.setNotificationChannelAsync('default', {
                    name: '할일 알림',
                    importance: Notifications.AndroidImportance.HIGH,
                });
                let { status } = await Notifications.getPermissionsAsync();
                if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
                if (status !== 'granted') return;

                const token = await Notifications.getDevicePushTokenAsync();
                if (cancelled || typeof token.data !== 'string') return;
                await api('/me', { method: 'PATCH', body: JSON.stringify({ push_token: token.data }) });
            } catch {
                // 푸시를 못 쓰는 환경이어도 앱은 그대로 동작
            }
        })();

        return () => { cancelled = true; };
    }, [userId]);
}
