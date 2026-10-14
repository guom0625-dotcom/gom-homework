import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerDeviceForPush } from '../lib/pushDevice';

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
 * 로그인하면 이 기기를 알림 받는 기기로 등록한다 ("이 폰에서 알림 받기"를 꺼 둔 기기는 건너뜀).
 * 알림 권한을 거절했거나 Firebase 설정 없이 빌드된 앱이어도 앱은 그대로 동작한다.
 */
export function usePushRegistration(userId: string | undefined) {
    useEffect(() => {
        if (userId) registerDeviceForPush();
    }, [userId]);
}
