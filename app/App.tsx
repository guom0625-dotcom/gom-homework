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
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useUpdateCheck } from './src/hooks/useUpdateCheck';
import { colors, fontFamilies, fontSizes } from './src/theme';

function UpdateOverlay({ pct }: { pct: number }) {
  return (
    <View style={styles.overlay}>
      <Text style={styles.overlayText}>업데이트 다운로드 중... {pct}%</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function AppContent() {
  const { downloadPct } = useUpdateCheck();

  return (
    <>
      <RootNavigator />
      {downloadPct !== null && <UpdateOverlay pct={downloadPct} />}
    </>
  );
}

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
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,35,48,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 9999,
  },
  overlayText: {
    fontFamily: fontFamilies.bodyMed,
    fontSize: fontSizes.lg,
    color: '#fff',
  },
  progressBg: {
    width: 240,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ocean[500],
  },
});
