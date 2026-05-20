import { useFonts } from 'expo-font';
import {
  Jua_400Regular,
} from '@expo-google-fonts/jua';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';
import {
  Fredoka_500Medium,
} from '@expo-google-fonts/fredoka';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainHorizontal } from './src/screens/student/MainHorizontal';

export default function App() {
  const [fontsLoaded] = useFonts({
    Jua_400Regular,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
    Fredoka_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <MainHorizontal
        currentDay={7}
        character="bear"
        points={124}
        status="pending"
      />
    </SafeAreaProvider>
  );
}
