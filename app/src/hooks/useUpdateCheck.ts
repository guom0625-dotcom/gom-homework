import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

const REPO = (Constants.expoConfig?.extra as { updateRepo?: string })?.updateRepo
    ?? 'guom0625-dotcom/gom-homework';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

interface GHRelease {
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
}

/** semver 비교 — latest > current 이면 true */
function isNewer(latest: string, current: string): boolean {
    const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
    const [la, lb, lc] = parse(latest);
    const [ca, cb, cc] = parse(current);
    if (la !== ca) return la > ca;
    if (lb !== cb) return lb > cb;
    return lc > cc;
}

async function downloadAndInstall(url: string, onProgress: (pct: number) => void): Promise<void> {
    const dest = `${FileSystem.cacheDirectory}gom-update.apk`;

    // 기존 파일 삭제
    await FileSystem.deleteAsync(dest, { idempotent: true });

    const dl = FileSystem.createDownloadResumable(url, dest, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) {
            onProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
        }
    });

    await dl.downloadAsync();

    const contentUri = await FileSystem.getContentUriAsync(dest);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,   // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
    });
}

export function useUpdateCheck() {
    const [downloadPct, setDownloadPct] = useState<number | null>(null);
    const checked = useRef(false);

    useEffect(() => {
        // Android 전용, 개발 중 스킵
        if (Platform.OS !== 'android' || __DEV__) return;
        if (checked.current) return;
        checked.current = true;

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(API_URL, {
                    headers: { 'Accept': 'application/vnd.github+json' },
                });
                if (!res.ok) return;

                const release: GHRelease = await res.json();
                const current = Constants.expoConfig?.version ?? '0.0.0';

                if (!isNewer(release.tag_name, current)) return;

                const apk = release.assets.find(a => a.name.endsWith('.apk'));

                Alert.alert(
                    '🎉 업데이트 있어요!',
                    `${release.tag_name} 버전이 출시됐어요.\n(현재 버전: v${current})`,
                    [
                        { text: '나중에', style: 'cancel' },
                        {
                            text: '지금 업데이트',
                            onPress: () => {
                                if (!apk) return;
                                setDownloadPct(0);
                                downloadAndInstall(apk.browser_download_url, setDownloadPct)
                                    .catch(() => Alert.alert('다운로드 실패', '잠시 후 다시 시도해주세요.'))
                                    .finally(() => setDownloadPct(null));
                            },
                        },
                    ],
                );
            } catch {
                // 네트워크 오류는 무시
            }
        }, 3000); // 앱 시작 3초 후 체크 (UX 방해 방지)

        return () => clearTimeout(timer);
    }, []);

    return { downloadPct };
}
