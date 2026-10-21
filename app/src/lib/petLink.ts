import { Alert, Linking } from 'react-native';
import { api } from '../api/client';

// 펫 앱(gomTamagotchi) — 1회용 연결 코드를 받아 딥링크로 넘긴다. 펫 앱이 없으면 설치 페이지로.
const PET_RELEASES = 'https://github.com/guom0625-dotcom/gom-tamagotchi/releases/latest';

export async function openPetApp() {
  let code: string;
  try {
    ({ code } = await api<{ code: string }>('/auth/link-code', { method: 'POST', body: '{}' }));
  } catch {
    Alert.alert('펫 앱 열기', '서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.');
    return;
  }
  try {
    await Linking.openURL(`gomtamagotchi://link?code=${code}`);
  } catch {
    Alert.alert('🐣 펫 앱이 없어요', '펫 앱(gomTamagotchi)을 먼저 설치해 주세요.', [
      { text: '닫기', style: 'cancel' },
      { text: '설치하러 가기', onPress: () => { Linking.openURL(PET_RELEASES).catch(() => {}); } },
    ]);
  }
}
