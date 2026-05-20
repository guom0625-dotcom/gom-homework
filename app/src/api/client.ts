const DEFAULT_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.101:3100';

let _base = DEFAULT_BASE;
let _key: string | null = null;

export const setApiKey = (key: string | null) => { _key = key; };
export const setApiBase = (url: string) => { _base = url; };

export class ApiError extends Error {
    constructor(public status: number, public body: unknown, message: string) {
        super(message);
    }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers as Record<string, string> | undefined),
    };
    if (_key) headers['Authorization'] = `Bearer ${_key}`;

    const res = await fetch(`${_base}${path}`, { ...init, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(res.status, body, (body as { error?: string }).error ?? 'request_failed');
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
}
