// 푸시 알림 발송 — best-effort. 실패해도 요청 처리는 계속된다.
//  · FCM 기기 토큰(앱이 등록하는 기본 형태) → FCM HTTP v1 로 직접 발송 (서비스 계정 키 필요)
//  · ExponentPushToken[...] → Expo Push 서비스
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export interface PushMessage {
    title?: string;
    body: string;
    data?: Record<string, unknown>;
}

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

// Firebase 콘솔에서 내려받은 서비스 계정 키(JSON). 없으면 FCM 발송은 건너뛴다.
const FCM_CREDENTIALS = process.env.FCM_CREDENTIALS ?? './fcm-credentials.json';

let account: ServiceAccount | null | undefined;
function serviceAccount(): ServiceAccount | null {
    if (account === undefined) {
        account = existsSync(FCM_CREDENTIALS)
            ? JSON.parse(readFileSync(FCM_CREDENTIALS, 'utf8')) as ServiceAccount
            : null;
    }
    return account;
}

export function isPushConfigured(): boolean {
    return serviceAccount() !== null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

let cachedToken: { value: string; expiresAt: number } | null = null;
async function accessToken(sa: ServiceAccount): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }))}`;
    const jwt = `${unsigned}.${b64url(createSign('RSA-SHA256').update(unsigned).sign(sa.private_key))}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    if (!res.ok) throw new Error(`fcm_auth_failed_${res.status}`);
    const json = await res.json() as { access_token: string; expires_in: number };
    cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
}

async function sendFcm(token: string, msg: PushMessage): Promise<boolean> {
    const sa = serviceAccount();
    if (!sa) return false;

    // FCM data 값은 문자열만 허용
    const data = Object.fromEntries(Object.entries(msg.data ?? {}).map(([k, v]) => [k, String(v)]));
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: {
                token,
                notification: { title: msg.title, body: msg.body },
                data,
                android: { priority: 'HIGH', notification: { channel_id: 'default', sound: 'default' } },
            },
        }),
    });
    return res.ok;
}

async function sendExpo(token: string, msg: PushMessage): Promise<boolean> {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: token, sound: 'default', ...msg }),
    });
    return res.ok;
}

/** 발송 요청이 받아들여졌으면 true. 토큰이 없거나 설정이 안 됐거나 실패하면 false. */
export async function sendPush(token: string | null | undefined, msg: PushMessage): Promise<boolean> {
    if (!token) return false;
    try {
        return token.startsWith('ExponentPushToken[') ? await sendExpo(token, msg) : await sendFcm(token, msg);
    } catch {
        return false;
    }
}
