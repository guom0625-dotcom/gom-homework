import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { setApiBase } from '../api/client';

const INTERNAL_URL = process.env.EXPO_PUBLIC_API_URL_INTERNAL ?? 'http://192.168.1.101:3100';
const EXTERNAL_URL = process.env.EXPO_PUBLIC_API_URL_EXTERNAL ?? 'https://guom0625.duckdns.org/hw';
const HOME_SSID    = process.env.EXPO_PUBLIC_HOME_SSID ?? '';

function resolveUrl(ssid: string | null | undefined): string {
    if (HOME_SSID && ssid === HOME_SSID) return INTERNAL_URL;
    return EXTERNAL_URL;
}

export function useServerUrl() {
    useEffect(() => {
        // 최초 1회 즉시 적용
        NetInfo.fetch().then(state => {
            const ssid = (state.details as { ssid?: string } | null)?.ssid;
            setApiBase(resolveUrl(ssid));
        });

        // 네트워크 변경 시 재적용
        const unsub = NetInfo.addEventListener(state => {
            const ssid = (state.details as { ssid?: string } | null)?.ssid;
            setApiBase(resolveUrl(ssid));
        });

        return unsub;
    }, []);
}
