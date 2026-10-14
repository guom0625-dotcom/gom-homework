// 미니룸 가구 데이터 생성기
//   node scripts/gen-furniture.cjs <kenney_furniture-kit 압축 푼 폴더>
// Kenney Furniture Kit (CC0, https://kenney.nl/assets/furniture-kit) 의 3D 모델(OBJ)로
// 4방향 아이소메트릭 그림이 방 격자의 어디에 놓여야 하는지 계산해서
//   app/assets/furniture/*.png        (쓰는 가구의 그림만 복사)
//   app/src/lib/furnitureData.ts      (이름·가격·크기·그림 위치)
//   server/src/lib/furniture.ts       (서버가 쓰는 가격표)
// 를 만든다. 가구를 추가하거나 가격을 바꾸려면 아래 ITEMS 를 고치고 다시 실행.
const fs = require('fs');
const path = require('path');

const KIT = process.argv[2];
if (!KIT) { console.error('usage: node scripts/gen-furniture.cjs <kit dir>'); process.exit(1); }
const APP = path.resolve(__dirname, '..');
const SERVER = path.resolve(APP, '../server');

const CELL = 0.25; // 격자 한 칸 = 모델 단위 0.25

// type: floor = 바닥에 놓고 서로 겹칠 수 없음 / rug = 바닥에 깔림(겹침 허용, 맨 아래)
//       small = 작은 소품(겹침 허용, 탁자·선반 위에 올리면 그 위에 놓임)
// surface: 위에 소품을 올릴 수 있는 가구
// [key, 이름, 분류, 다이아, 루비, type, surface?]
const ITEMS = [
    // 가구
    ['bedSingle', '싱글 침대', 'furniture', 6, 0, 'floor'],
    ['bedDouble', '더블 침대', 'furniture', 8, 0, 'floor'],
    ['bedBunk', '2층 침대', 'furniture', 10, 0, 'floor'],
    ['loungeSofa', '소파', 'furniture', 5, 0, 'floor'],
    ['loungeSofaLong', '긴 소파', 'furniture', 7, 0, 'floor'],
    ['loungeSofaCorner', '코너 소파', 'furniture', 8, 0, 'floor'],
    ['loungeSofaOttoman', '발받침 소파', 'furniture', 2, 0, 'floor'],
    ['loungeDesignSofa', '디자인 소파', 'furniture', 6, 0, 'floor'],
    ['loungeDesignSofaCorner', '디자인 코너 소파', 'furniture', 9, 0, 'floor'],
    ['loungeChair', '라운지 의자', 'furniture', 3, 0, 'floor'],
    ['loungeChairRelax', '안락의자', 'furniture', 4, 0, 'floor'],
    ['loungeDesignChair', '디자인 1인 소파', 'furniture', 4, 0, 'floor'],
    ['chair', '나무 의자', 'furniture', 1, 0, 'floor'],
    ['chairCushion', '쿠션 의자', 'furniture', 2, 0, 'floor'],
    ['chairRounded', '둥근 의자', 'furniture', 2, 0, 'floor'],
    ['chairModernCushion', '모던 의자', 'furniture', 2, 0, 'floor'],
    ['chairModernFrameCushion', '프레임 의자', 'furniture', 2, 0, 'floor'],
    ['chairDesk', '책상 의자', 'furniture', 3, 0, 'floor'],
    ['stoolBar', '바 의자', 'furniture', 1, 0, 'floor'],
    ['stoolBarSquare', '사각 바 의자', 'furniture', 1, 0, 'floor'],
    ['bench', '벤치', 'furniture', 2, 0, 'floor'],
    ['benchCushion', '쿠션 벤치', 'furniture', 3, 0, 'floor'],
    ['benchCushionLow', '낮은 쿠션 벤치', 'furniture', 3, 0, 'floor'],
    ['desk', '책상', 'furniture', 4, 0, 'floor', true],
    ['deskCorner', '코너 책상', 'furniture', 6, 0, 'floor', true],
    ['table', '식탁', 'furniture', 4, 0, 'floor', true],
    ['tableCloth', '식탁보 식탁', 'furniture', 5, 0, 'floor', true],
    ['tableCross', '십자 다리 식탁', 'furniture', 4, 0, 'floor', true],
    ['tableCrossCloth', '식탁보 십자 식탁', 'furniture', 5, 0, 'floor', true],
    ['tableGlass', '유리 식탁', 'furniture', 5, 0, 'floor', true],
    ['tableRound', '원형 식탁', 'furniture', 4, 0, 'floor', true],
    ['tableCoffee', '커피 테이블', 'furniture', 3, 0, 'floor', true],
    ['tableCoffeeSquare', '사각 커피 테이블', 'furniture', 2, 0, 'floor', true],
    ['tableCoffeeGlass', '유리 커피 테이블', 'furniture', 3, 0, 'floor', true],
    ['tableCoffeeGlassSquare', '사각 유리 테이블', 'furniture', 2, 0, 'floor', true],
    ['sideTable', '사이드 테이블', 'furniture', 2, 0, 'floor', true],
    ['sideTableDrawers', '서랍 사이드 테이블', 'furniture', 3, 0, 'floor', true],
    ['cabinetBed', '협탁', 'furniture', 2, 0, 'floor', true],
    ['cabinetBedDrawer', '서랍 협탁', 'furniture', 2, 0, 'floor', true],
    ['cabinetBedDrawerTable', '테이블 협탁', 'furniture', 2, 0, 'floor', true],
    ['cabinetTelevision', 'TV 장', 'furniture', 3, 0, 'floor', true],
    ['cabinetTelevisionDoors', '문 달린 TV 장', 'furniture', 4, 0, 'floor', true],
    ['coatRackStanding', '스탠드 옷걸이', 'furniture', 2, 0, 'floor'],
    // 책장은 책을 읽어 모은 루비로
    ['bookcaseOpenLow', '낮은 책장', 'furniture', 0, 1, 'floor', true],
    ['bookcaseOpen', '오픈 책장', 'furniture', 0, 2, 'floor'],
    ['bookcaseClosed', '책장', 'furniture', 0, 2, 'floor'],
    ['bookcaseClosedDoors', '문 달린 책장', 'furniture', 0, 2, 'floor'],
    ['bookcaseClosedWide', '넓은 책장', 'furniture', 0, 3, 'floor'],
    // 가전
    ['televisionModern', '평면 TV', 'appliance', 6, 0, 'small'],
    ['televisionVintage', '옛날 TV', 'appliance', 4, 0, 'floor', true],
    ['televisionAntenna', '안테나 TV', 'appliance', 3, 0, 'small'],
    ['computerScreen', '모니터', 'appliance', 4, 0, 'small'],
    ['computerKeyboard', '키보드', 'appliance', 1, 0, 'small'],
    ['computerMouse', '마우스', 'appliance', 1, 0, 'small'],
    ['laptop', '노트북', 'appliance', 5, 0, 'small'],
    ['radio', '라디오', 'appliance', 2, 0, 'small'],
    ['speaker', '큰 스피커', 'appliance', 3, 0, 'floor'],
    ['speakerSmall', '작은 스피커', 'appliance', 2, 0, 'small'],
    ['lampRoundFloor', '둥근 스탠드', 'appliance', 2, 0, 'floor'],
    ['lampSquareFloor', '사각 스탠드', 'appliance', 2, 0, 'floor'],
    ['lampRoundTable', '둥근 탁상 조명', 'appliance', 0, 1, 'small'],
    ['lampSquareTable', '사각 탁상 조명', 'appliance', 0, 1, 'small'],
    ['washer', '세탁기', 'appliance', 5, 0, 'floor', true],
    ['dryer', '건조기', 'appliance', 5, 0, 'floor', true],
    ['washerDryerStacked', '세탁기+건조기', 'appliance', 8, 0, 'floor'],
    // 소품
    ['pottedPlant', '큰 화분', 'deco', 2, 0, 'floor'],
    ['plantSmall1', '작은 화분 1', 'deco', 1, 0, 'small'],
    ['plantSmall2', '작은 화분 2', 'deco', 1, 0, 'small'],
    ['plantSmall3', '작은 화분 3', 'deco', 1, 0, 'small'],
    ['bear', '곰인형', 'deco', 0, 1, 'small'],
    ['books', '책 더미', 'deco', 0, 1, 'small'],
    ['pillow', '쿠션', 'deco', 1, 0, 'small'],
    ['pillowLong', '긴 쿠션', 'deco', 1, 0, 'small'],
    ['pillowBlue', '파란 쿠션', 'deco', 1, 0, 'small'],
    ['pillowBlueLong', '긴 파란 쿠션', 'deco', 1, 0, 'small'],
    ['rugDoormat', '발매트', 'deco', 1, 0, 'rug'],
    ['rugSquare', '사각 러그', 'deco', 3, 0, 'rug'],
    ['rugRound', '원형 러그', 'deco', 3, 0, 'rug'],
    ['rugRectangle', '직사각 러그', 'deco', 4, 0, 'rug'],
    ['rugRounded', '둥근 모서리 러그', 'deco', 4, 0, 'rug'],
    ['cardboardBoxClosed', '상자', 'deco', 1, 0, 'floor', true],
    ['cardboardBoxOpen', '열린 상자', 'deco', 1, 0, 'floor'],
    ['trashcan', '휴지통', 'deco', 1, 0, 'floor'],
    // 주방·욕실
    ['kitchenFridge', '냉장고', 'kitchen', 6, 0, 'floor'],
    ['kitchenFridgeLarge', '양문 냉장고', 'kitchen', 8, 0, 'floor'],
    ['kitchenFridgeSmall', '작은 냉장고', 'kitchen', 4, 0, 'floor', true],
    ['kitchenCabinet', '주방 수납장', 'kitchen', 3, 0, 'floor', true],
    ['kitchenCabinetDrawer', '주방 서랍장', 'kitchen', 3, 0, 'floor', true],
    ['kitchenCabinetCornerInner', '코너 수납장', 'kitchen', 3, 0, 'floor', true],
    ['kitchenCabinetCornerRound', '둥근 코너 수납장', 'kitchen', 3, 0, 'floor', true],
    ['kitchenSink', '싱크대', 'kitchen', 4, 0, 'floor', true],
    ['kitchenStove', '가스레인지', 'kitchen', 4, 0, 'floor', true],
    ['kitchenStoveElectric', '전기레인지', 'kitchen', 4, 0, 'floor', true],
    ['kitchenBar', '아일랜드 식탁', 'kitchen', 3, 0, 'floor', true],
    ['kitchenBarEnd', '아일랜드 끝판', 'kitchen', 1, 0, 'floor'],
    ['kitchenMicrowave', '전자레인지', 'kitchen', 3, 0, 'small'],
    ['kitchenCoffeeMachine', '커피 머신', 'kitchen', 3, 0, 'small'],
    ['kitchenBlender', '믹서기', 'kitchen', 2, 0, 'small'],
    ['toaster', '토스터', 'kitchen', 2, 0, 'small'],
    ['bathtub', '욕조', 'kitchen', 6, 0, 'floor'],
    ['shower', '샤워 부스', 'kitchen', 5, 0, 'floor'],
    ['showerRound', '둥근 샤워 부스', 'kitchen', 5, 0, 'floor'],
    ['toilet', '변기', 'kitchen', 3, 0, 'floor'],
    ['toiletSquare', '사각 변기', 'kitchen', 3, 0, 'floor'],
    ['bathroomSinkSquare', '세면대', 'kitchen', 3, 0, 'floor'],
    ['bathroomCabinetDrawer', '욕실 수납장', 'kitchen', 2, 0, 'floor', true],
];

// 렌더 파일 이름 ↔ 모델을 Y축으로 90°씩 돌린 횟수 (실루엣 대조로 확인함)
const DIRS = ['NW', 'NE', 'SW', 'SE'];
const C = Math.SQRT1_2; // 카메라: 45° 돌리고 45° 내려다봄

function readObj(key) {
    const v = [];
    for (const line of fs.readFileSync(path.join(KIT, 'Models/OBJ format', `${key}.obj`), 'utf8').split('\n')) {
        const a = line.trim().split(/\s+/);
        if (a[0] === 'v') v.push(a.slice(1, 4).map(Number));
    }
    return v;
}
const pngSize = (file) => {
    const b = fs.readFileSync(file);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const r3 = (n) => Math.round(n * 1000) / 1000;

const outImg = path.join(APP, 'assets/furniture');
fs.rmSync(outImg, { recursive: true, force: true });
fs.mkdirSync(outImg, { recursive: true });
fs.copyFileSync(path.join(KIT, 'License.txt'), path.join(outImg, 'License.txt'));

const defs = [];
const scales = [];
for (const [key, name, cat, cost, ruby, type, surface] of ITEMS) {
    const verts = readObj(key);
    const minY = Math.min(...verts.map(p => p[1]));
    const height = Math.max(...verts.map(p => p[1])) - minY;
    const dirs = [];
    for (let r = 0; r < 4; r++) {
        // r 번 90° 회전
        const pts = verts.map(([x, y, z]) => {
            for (let i = 0; i < r; i++) [x, z] = [z, -x];
            return [x, y - minY, z];
        });
        const xs = pts.map(p => p[0]), zs = pts.map(p => p[2]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
        const ex = Math.max(...xs) - Math.min(...xs), ez = Math.max(...zs) - Math.min(...zs);
        // 칸 수: 양쪽으로 칸의 20% 까지 넘치는 건 봐준다 (탁자 0.84 → 3칸)
        const w = Math.max(1, Math.ceil(ex / CELL - 0.4)), d = Math.max(1, Math.ceil(ez / CELL - 0.4));
        // 바닥 가운데를 원점으로 놓고 화면에 투영한 범위 = 그림이 차지하는 사각형
        const sx = pts.map(([x, , z]) => ((x - cx) - (z - cz)) * C);
        const sy = pts.map(([x, y, z]) => ((x - cx) + (z - cz)) * 0.5 - y * C);
        const ox = Math.min(...sx), oy = Math.min(...sy);
        const iw = Math.max(...sx) - ox, ih = Math.max(...sy) - oy;
        const file = path.join(KIT, 'Isometric', `${key}_${DIRS[r]}.png`);
        const [pw, ph] = pngSize(file);
        scales.push([key, DIRS[r], pw / iw, ph / ih]);
        fs.copyFileSync(file, path.join(outImg, `${key}_${DIRS[r]}.png`));
        dirs.push([w, d, r3(ox), r3(oy), r3(iw), r3(ih)]);
    }
    defs.push({ key, name, cat, cost, ruby, type, h: r3(height), surface: surface ? r3(height) : 0, dirs });
}

// 그림 크기와 투영 크기의 비율이 일정해야 위치가 맞는다 — 벗어나는 게 있으면 알려준다
const sAvg = scales.reduce((s, x) => s + x[2], 0) / scales.length;
for (const [key, dir, sx, sy] of scales) {
    if (Math.abs(sx / sAvg - 1) > 0.06 || Math.abs(sy / sAvg - 1) > 0.06) {
        console.warn(`scale off: ${key}_${dir} ${sx.toFixed(1)} ${sy.toFixed(1)} (avg ${sAvg.toFixed(1)})`);
    }
}

const header = '// 자동 생성 — app/scripts/gen-furniture.cjs 를 고치고 다시 실행하세요\n';
const app = [
    header,
    "export type FurnitureCat = 'furniture' | 'appliance' | 'deco' | 'kitchen';",
    "export type FurnitureType = 'floor' | 'rug' | 'small';",
    '// 방향별 [가로 칸, 세로 칸, 그림 왼쪽, 그림 위, 그림 너비, 그림 높이] — 그림 값은 바닥 가운데 기준 모델 단위',
    'export type FurnitureDir = [number, number, number, number, number, number];',
    'export interface FurnitureDef {',
    '    key: string; name: string; cat: FurnitureCat; cost: number; ruby: number;',
    '    // h = 높이(모델 단위), surface = 위에 소품을 올릴 수 있으면 그 높이 (없으면 0)',
    '    type: FurnitureType; h: number; surface: number; dirs: FurnitureDir[];',
    '}',
    `export const FURNITURE_CELL = ${CELL};`,
    'export const FURNITURE: FurnitureDef[] = [',
    ...defs.map(d => `    ${JSON.stringify(d)},`),
    '];',
    'export const FURNITURE_BY_KEY: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map(f => [f.key, f]));',
    '/* eslint-disable @typescript-eslint/no-require-imports */',
    'export const FURNITURE_IMAGES: Record<string, number[]> = {',
    ...defs.map(d => `    ${d.key}: [${DIRS.map(dir => `require('../../assets/furniture/${d.key}_${dir}.png')`).join(', ')}],`),
    '};',
    '',
].join('\n');
fs.writeFileSync(path.join(APP, 'src/lib/furnitureData.ts'), app);

const server = [
    header,
    '// 미니룸 가구 가격표 (다이아, 루비) — 앱의 src/lib/furnitureData.ts 와 같은 목록',
    'export const FURNITURE_PRICES: Record<string, { cost: number; ruby: number }> = {',
    ...defs.map(d => `    ${d.key}: { cost: ${d.cost}, ruby: ${d.ruby} },`),
    '};',
    '',
].join('\n');
fs.writeFileSync(path.join(SERVER, 'src/lib/furniture.ts'), server);

console.log(`${defs.length} items, scale avg ${sAvg.toFixed(2)} px/unit`);
