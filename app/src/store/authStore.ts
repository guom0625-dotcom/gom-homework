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

    init: () => Promise<void>;
    signup: (name: string, role: 'manager' | 'student') => Promise<void>;
    loginWithKey: (key: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    key: null,
    isLoading: true,

    init: async () => {
        try {
            const key = await SecureStore.getItemAsync(STORE_KEY);
            if (!key) { set({ isLoading: false }); return; }
            setApiKey(key);
            const me = await api<AuthUser>('/me');
            set({ key, user: { id: me.id, name: me.name, role: me.role }, isLoading: false });
        } catch {
            await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
            setApiKey(null);
            set({ isLoading: false });
        }
    },

    signup: async (name, role) => {
        const res = await api<AuthUser & { key: string }>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, role }),
        });
        await SecureStore.setItemAsync(STORE_KEY, res.key);
        setApiKey(res.key);
        set({ key: res.key, user: { id: res.id, name: res.name, role: res.role } });
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

    logout: async () => {
        await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
        setApiKey(null);
        set({ user: null, key: null });
    },
}));
