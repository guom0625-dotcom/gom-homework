import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

// "이 폰에서 알림 받기" — 계정이 아니라 기기별 설정. 같은 계정을 여러 폰에서 쓸 때 받을 폰만 켜 둔다.
const PREF_KEY = 'gom_push_enabled';

export async function isPushEnabledOnDevice(): Promise<boolean> {
    return (await SecureStore.getItemAsync(PREF_KEY)) !== 'off';  // 기본은 켜짐
}

async function deviceToken(): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    try {
        const token = await Notifications.getDevicePushTokenAsync();
        return typeof token.data === 'string' ? token.data : null;
    } catch {
        return null;  // Firebase 설정 없이 빌드된 앱 등
    }
}

/** 이 기기를 알림 받는 기기로 서버에 등록. 권한이 없거나 꺼 둔 기기면 아무것도 하지 않는다. 등록했으면 true */
export async function registerDeviceForPush(): Promise<boolean> {
    if (Platform.OS !== 'android' || !(await isPushEnabledOnDevice())) return false;
    try {
        // Android 13+: 채널이 먼저 있어야 권한 요청 창이 뜬다
        await Notifications.setNotificationChannelAsync('default', {
            name: '할일 알림',
            importance: Notifications.AndroidImportance.HIGH,
        });
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
        if (status !== 'granted') return false;

        const token = await deviceToken();
        if (!token) return false;
        await api('/me', { method: 'PATCH', body: JSON.stringify({ push_token: token }) });
        return true;
    } catch {
        return false;
    }
}

/** 이 기기만 알림 대상에서 뺀다 (같은 계정의 다른 폰은 그대로) */
export async function unregisterDeviceFromPush(): Promise<void> {
    const token = await deviceToken();
    if (!token) return;
    await api('/me', { method: 'PATCH', body: JSON.stringify({ remove_push_token: token }) }).catch(() => {});
}

export async function setPushEnabledOnDevice(enabled: boolean): Promise<boolean> {
    await SecureStore.setItemAsync(PREF_KEY, enabled ? 'on' : 'off');
    if (enabled) return registerDeviceForPush();
    await unregisterDeviceFromPush();
    return false;
}
