import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setApiKey } from '../api/client';

const STORE_KEY = 'gom_auth_key';

export interface AuthUser {
    id: string;
    name: string;
    role: 'manager' | 'student';
}

interface AuthState {
    user: AuthUser | null;
    key: string | null;
    isLoading: boolean;
    needsPairing: boolean;

    init: () => Promise<void>;
    signup: (name: string, role: 'manager' | 'student') => Promise<void>;
    loginWithKey: (key: string) => Promise<void>;
    recoverWithCode: (code: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    key: null,
    isLoading: true,
    needsPairing: false,

    init: async () => {
        try {
            const key = await SecureStore.getItemAsync(STORE_KEY);
            if (!key) { set({ isLoading: false }); return; }
            setApiKey(key);
            const me = await api<AuthUser & { manager?: object | null }>('/me');
            if (me.role === 'student' && !me.manager) {
                set({ isLoading: false, needsPairing: true });
                return;
            }
            set({ key, user: { id: me.id, name: me.name, role: me.role }, isLoading: false, needsPairing: false });
        } catch {
            await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
            setApiKey(null);
            set({ isLoading: false, needsPairing: false });
        }
    },

    signup: async (name, role) => {
        const res = await api<AuthUser & { key: string }>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, role }),
        });
        await SecureStore.setItemAsync(STORE_KEY, res.key);
        setApiKey(res.key);
        // user는 아직 세팅하지 않음 — 학생은 페어링 완료 후 init()으로 설정
        if (role === 'manager') {
            set({ key: res.key, user: { id: res.id, name: res.name, role: res.role } });
        }
    },

    loginWithKey: async (key) => {
        const trimmed = key.trim();
        setApiKey(trimmed);
        try {
            const me = await api<AuthUser>('/me');
            await SecureStore.setItemAsync(STORE_KEY, trimmed);
            set({ key: trimmed, user: { id: me.id, name: me.name, role: me.role } });
        } catch (e) {
            setApiKey(null);
            throw e;
        }
    },

    // 매니저가 발급한 재로그인 코드로 기존 학생 계정에 다시 들어간다
    recoverWithCode: async (code) => {
        const res = await api<AuthUser & { key: string }>('/auth/recover', {
            method: 'POST',
            body: JSON.stringify({ code: code.trim() }),
        });
        await SecureStore.setItemAsync(STORE_KEY, res.key);
        setApiKey(res.key);
        set({ key: res.key, user: { id: res.id, name: res.name, role: res.role }, needsPairing: false });
    },

    logout: async () => {
        // 로그아웃한 기기로 알림이 계속 가지 않도록 토큰 해제
        await api('/me', { method: 'PATCH', body: JSON.stringify({ push_token: null }) }).catch(() => {});
        await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
        setApiKey(null);
        set({ user: null, key: null, needsPairing: false });
    },
}));
