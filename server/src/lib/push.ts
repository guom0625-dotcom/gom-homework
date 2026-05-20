// Expo Push Notifications — simple HTTP POST, no Firebase SDK needed

interface ExpoPushMessage {
    to: string;
    title?: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default' | null;
}

export async function sendPush(token: string | null | undefined, msg: Omit<ExpoPushMessage, 'to'>): Promise<void> {
    if (!token?.startsWith('ExponentPushToken[')) return;

    const payload: ExpoPushMessage = { to: token, sound: 'default', ...msg };
    try {
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch {
        // best-effort — don't let push failure break the request
    }
}
