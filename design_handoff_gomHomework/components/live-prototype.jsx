// live-prototype.jsx — Tweaks 가능한 라이브 메인 화면

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "currentDay": 7,
  "status": "pending",
  "character": "bear",
  "points": 124,
  "variant": "horizontal",
  "usePhoto": false,
  "showMission": true,
  "screen": "main"
}/*EDITMODE-END*/;

// Demo "selfie" — a soft warm gradient with an emoji face as placeholder
const DEMO_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <defs><radialGradient id="g" cx="40%" cy="35%" r="80%">
       <stop offset="0%" stop-color="#ffe5d2"/>
       <stop offset="100%" stop-color="#d4a279"/>
     </radialGradient></defs>
     <rect width="100" height="100" fill="url(#g)"/>
     <text x="50%" y="58%" text-anchor="middle" font-size="34" fill="#3a2820" font-family="sans-serif" font-weight="600">😊</text>
   </svg>`
);

function LivePrototype() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const photoUrl = t.usePhoto ? DEMO_PHOTO : undefined;

  const renderScreen = () => {
    // Special screens
    if (t.screen === 'bonus') return <BonusScreen day={t.currentDay} character={t.character} photoUrl={photoUrl}/>;
    if (t.screen === 'achievements') return <AchievementsScreen/>;
    if (t.screen === 'customize') return <CustomizeScreen/>;
    if (t.screen === 'rules') return <AutoRewardsScreen/>;
    if (t.screen === 'grant-result') return <AutoGrantResultScreen/>;
    if (t.screen === 'catalog') return <RewardCatalogScreen/>;
    if (t.screen === 'spend') return <SpendScreen/>;
    if (t.screen === 'spend-pending') return <SpendPendingScreen/>;
    if (t.screen === 'spend-approval') return <SpendApprovalScreen/>;
    if (t.screen === 'spend-done') return <SpendDoneScreen/>;

    // Main variants
    const props = {
      currentDay: t.currentDay,
      character: t.character,
      points: t.points,
      status: t.status,
      photoUrl,
      showMission: t.showMission,
    };
    if (t.variant === 'vertical') return <MainVertical {...props}/>;
    if (t.variant === 'archipelago') return <MainArchipelago {...props}/>;
    if (t.variant === 'board') return <MainBoard {...props}/>;
    return <MainHorizontal {...props}/>;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#1a1820',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Subtle ambient bg dots */}
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(123,97,255,.15), transparent 40%), radial-gradient(circle at 80% 70%, rgba(45,212,164,.12), transparent 40%)',
        pointerEvents: 'none' }}/>

      <AndroidDevice width={412} height={892}>
        {renderScreen()}
      </AndroidDevice>

      <TweaksPanel title="Tweaks">
        <TweakSection label="화면"/>
        <TweakSelect label="보고 있는 화면" value={t.screen}
          options={[
            { label: '메인 (징검다리)', value: 'main' },
            { label: '🎁 보너스 섬', value: 'bonus' },
            { label: '🏆 업적 컬렉션', value: 'achievements' },
            { label: '🎨 캐릭터 꾸미기', value: 'customize' },
            { label: '⚙️ 자동 지급 규칙', value: 'rules' },
            { label: '💎 자동 지급 결과', value: 'grant-result' },
            { label: '🤝 보상 카탈로그', value: 'catalog' },
            { label: '🛍️ 보상 사용 선택', value: 'spend' },
            { label: '⏳ 사용 요청 대기', value: 'spend-pending' },
            { label: '✓ 사용 요청 승인', value: 'spend-approval' },
            { label: '🎉 사용 완료', value: 'spend-done' },
          ]}
          onChange={(v) => setTweak('screen', v)}/>

        {t.screen === 'main' && (<>
          <TweakSection label="현재 상태"/>
          <TweakSlider label="진행 일수" value={t.currentDay} min={1} max={30} unit="일"
            onChange={(v) => setTweak('currentDay', v)}/>
          <TweakSelect label="상태" value={t.status}
            options={[
              { label: '할일 등록 전', value: 'todo' },
              { label: '엄마 기다리는 중', value: 'pending' },
              { label: '모두 통과!', value: 'approved' },
              { label: '오늘 끝!', value: 'complete' },
            ]}
            onChange={(v) => setTweak('status', v)}/>
          <TweakSlider label="총 포인트" value={t.points} min={0} max={1500} step={5} unit="pt"
            onChange={(v) => setTweak('points', v)}/>
          <TweakToggle label="일일 미션 카드" value={t.showMission}
            onChange={(v) => setTweak('showMission', v)}/>

          <TweakSection label="메인 화면 디자인"/>
          <TweakSelect label="레이아웃" value={t.variant}
            options={[
              { label: 'A · 가로 바다 지도', value: 'horizontal' },
              { label: 'B · 세로 S-경로', value: 'vertical' },
              { label: 'C · 아키펠라고', value: 'archipelago' },
              { label: 'D · 보드 그리드', value: 'board' },
            ]}
            onChange={(v) => setTweak('variant', v)}/>
        </>)}

        {t.screen === 'bonus' && (
          <>
            <TweakSection label="보너스 섬"/>
            <TweakSlider label="도달 일수" value={t.currentDay} min={7} max={30} step={7} unit="일"
              onChange={(v) => setTweak('currentDay', v)}/>
          </>
        )}

        <TweakSection label="캐릭터"/>
        <TweakRadio label="종류" value={t.character}
          options={[
            { label: '곰', value: 'bear' },
            { label: '여우', value: 'fox' },
            { label: '고양이', value: 'cat' },
            { label: '부엉이', value: 'owl' },
          ]}
          onChange={(v) => setTweak('character', v)}/>
        <TweakToggle label="내 얼굴 사진 쓰기" value={t.usePhoto}
          onChange={(v) => setTweak('usePhoto', v)}/>
      </TweaksPanel>
    </div>
  );
}

window.LivePrototype = LivePrototype;
