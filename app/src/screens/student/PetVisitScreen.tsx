import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { PetScene, type Stage } from '../../pet/PetScene';
import type { PetMode } from '../../pet/brain';
import type { PetResponse } from '../../pet/api';
import { isSpecies, lookTitle } from '../../pet/species';
import { openPetApp } from '../../lib/petLink';
import { colors, fontFamilies, fontSizes, radius } from '../../theme';

// 펫 구경 — 펫 앱과 같은 방과 움직임을 보여 준다. 돌보기(밥·청소·꾸미기)는 펫 앱에서만.
// 학생은 자기 펫(GET /pet), 엄마는 params.studentId 로 그 학생의 펫(GET /pet/student/:id)을 본다.

const STAGE_NAME: Record<Stage, string> = { egg: '알', baby: '유아', teen: '청소년', adult: '성인' };

/** 잠자는 시간 (한국 시각): 밤 0~7시, 낮 9~16시 — 펫 앱과 같다 */
function isSleepTime(now = Date.now()) {
  const h = new Date(now + 9 * 3600_000).getUTCHours();
  return h < 7 || (h >= 9 && h < 16);
}

const batchim = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
};
const withIGa = (w: string) => w + (batchim(w) > 0 ? '이' : '가');

function statusLine(r: PetResponse, sleeping: boolean): string {
  const p = r.pet;
  if (p.stage === 'egg') return '🥚 따뜻하게 품어 주면 깨어나요';
  if (p.mood === 'sick') return p.health?.severe ? '🚑 많이 아파요' : '🤒 아파요';
  if (sleeping) return '💤 쿨쿨 자고 있어요';
  switch (p.mood) {
    case 'hungry': return '😣 배고파해요';
    case 'angry': return '😠 밥을 걸러서 삐졌어요';
    case 'sad': return '😢 심심해해요';
    case 'happy': return '😊 기분이 좋아요';
    default: return '🙂 잘 지내고 있어요';
  }
}

/** 오늘 해 줄 일 — 서버 알림(notifyMessage)과 같은 기준 */
function todoList(r: PetResponse): string[] {
  const p = r.pet;
  if (p.stage === 'egg') return p.patted_today ? [] : ['🤲 품어 주기'];
  const list: string[] = [];
  if (p.health?.severe && !p.health.visited_today) list.push('🏥 병원');
  if (p.health && !p.health.severe && !p.health.med_given) list.push('💊 약');
  if (!p.fed_today && !p.auto_fed_today) list.push('🍚 밥');
  if (p.poops.length > 0) list.push(`💩 똥 ${p.poops.length}개`);
  if (!p.patted_today) list.push('🤚 쓰다듬기');
  if (r.room.can_upgrade) list.push('🏠 방 넓혀 주기');
  if (p.growth.ready) list.push('✨ 성장시키기');
  return list;
}

export function PetVisitScreen() {
  const navigation = useNavigation();
  const params = useRoute().params as { studentId?: string; studentName?: string } | undefined;
  const studentId = params?.studentId;
  const [data, setData] = useState<PetResponse | null>(null);
  const [noPet, setNoPet] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sleeping, setSleeping] = useState(isSleepTime());

  const load = useCallback(async () => {
    try {
      const res = await api<PetResponse | { pet: null }>(studentId ? `/pet/student/${studentId}` : '/pet');
      if (res.pet) { setData(res as PetResponse); setNoPet(false); } else setNoPet(true);
      setError(false);
    } catch { setError(true); }
  }, [studentId]);

  // 화면에 있는 동안 1분마다 다시 읽는다 (펫 앱에서 돌보고 돌아왔을 때도 맞도록)
  useFocusEffect(useCallback(() => {
    void load();
    const id = setInterval(() => { void load(); setSleeping(isSleepTime()); }, 60_000);
    return () => clearInterval(id);
  }, [load]));

  // 다음에 무언가 바뀌는 시각(똥·아픔)에 다시 읽는다
  const nextAt = data?.pet.next_change_at;
  useEffect(() => {
    if (!nextAt) return;
    const id = setTimeout(() => { void load(); }, Math.min(Math.max(nextAt - Date.now(), 0) + 1000, 6 * 3600_000));
    return () => clearTimeout(id);
  }, [nextAt, load]);

  const pull = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const pet = data?.pet;
  const egg = pet?.stage === 'egg';
  const gone = !!pet?.gone;
  const speciesName = pet && isSpecies(pet.species) ? lookTitle(pet.species, pet.variant) : '아기';
  const petName = pet?.name ?? speciesName;
  const mode: PetMode = !pet ? 'normal' : pet.mood === 'sick' ? 'sick' : sleeping ? 'sleep' : pet.mood;
  const todo = data && !gone ? todoList(data) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{studentId ? `🐾 ${params?.studentName ?? ''}의 펫` : '🐾 우리 펫'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}>
        {error && !data && <Text style={styles.note}>펫을 불러오지 못했어요. 아래로 당겨서 다시 해 보세요.</Text>}
        {noPet && <Text style={styles.note}>아직 펫을 키우기 시작하지 않았어요.</Text>}

        {pet && data && (
          <View style={styles.card}>
            <Text style={styles.petName}>{egg ? '🥚 알' : gone ? `✉️ ${petName}` : petName}</Text>
            {!egg && !gone && (
              <Text style={styles.petSub}>
                {STAGE_NAME[pet.stage]} {speciesName} · {'❤️'.repeat(pet.fullness)}{'🤍'.repeat(3 - pet.fullness)}
              </Text>
            )}
            <PetScene viewOnly mode={mode} stage={pet.stage} roomLevel={data.room.level}
              poops={pet.poops} gone={gone}
              decor={{ items: data.items.filter(i => i.placed).map(i => i.key), wallpaper: data.decor.wallpaper, cushion: data.decor.cushion }}
              robotCleaned={pet.robot_cleaned} outfit={pet.wear} species={pet.species} variant={pet.variant} build={pet.build}
              placement={data.layout ?? {}} />
          </View>
        )}

        {pet && data && (
          <View style={styles.box}>
            {gone ? (
              <Text style={styles.boxText}>
                {withIGa(petName)} 편지를 남기고 떠났어요.{'\n'}펫 앱에서 새 알을 받을 수 있어요.
              </Text>
            ) : (
              <>
                <Text style={styles.status}>{statusLine(data, sleeping)}</Text>
                <Text style={styles.boxText}>
                  {todo.length > 0 ? `오늘 해 줄 일: ${todo.join(' · ')}` : '오늘 할 일을 다 해 줬어요 💕'}
                </Text>
              </>
            )}
          </View>
        )}

        {!studentId && (
          <>
            <Button variant="coral" size="md" label="🐣 펫 앱에서 돌보기" onPress={() => { void openPetApp(); }} style={styles.btn} />
            <Text style={styles.note}>밥 주기, 청소, 방 꾸미기는 펫 앱에서 할 수 있어요.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  backBtn: { padding: 4, width: 36 },
  backText: { fontSize: 28, color: colors.ink[700], lineHeight: 32 },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes['2xl'],
    color: colors.ink[900],
    textAlign: 'center',
  },
  content: { padding: 16, gap: 12, alignSelf: 'center', width: '100%', maxWidth: 480 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 12, overflow: 'hidden' },
  petName: { fontFamily: fontFamilies.display, fontSize: fontSizes.xl, color: colors.ink[900] },
  petSub: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[700], marginTop: 2, marginBottom: 6 },
  box: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, gap: 6 },
  status: { fontFamily: fontFamilies.display, fontSize: fontSizes.md, color: colors.ink[900] },
  boxText: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[700], lineHeight: 20 },
  btn: { alignSelf: 'stretch' },
  note: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[500], textAlign: 'center' },
});
