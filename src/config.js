// 모든 수치·색·한국어 문자열의 단일 출처.
// 코드에 매직 넘버나 UI 문자열을 하드코딩하지 말 것 — CLAUDE.md「코드 컨벤션」.

// ─────────────────────────────────────────────────────────────
// 축 ↔ Three.js 좌표 대응
//
// 왜 이 대응인가: 프리셋 "경제 × 문화 정면"이 2D 산점도와 같은 구도여야 한다.
// 2D 산점도는 경제가 가로, 문화가 세로다. 따라서 경제→X, 문화→Y(화면 세로),
// 규범→Z(화면 깊이)로 고정한다. 이 대응을 바꾸면 프리셋과 2D 뷰가 어긋난다.
// ─────────────────────────────────────────────────────────────

// 큐브 반변장(world unit). 세 축 모두 같은 시각적 길이를 갖는 정육면체.
// 척도가 다른 세 축(0–10, 0–10, 0–1)을 "같은 화면 길이"에 각각 독립으로
// 매핑하는 것이며, 값을 하나의 스케일로 합치는 정규화가 아니다 — CLAUDE.md 절대규칙 3.
export const SPACE = {
  half: 9,
  cubeColor: 0x3a4250,
  cubeOpacity: 0.55,
  bgColor: 0x0e1116,
};

export const AXES = [
  {
    key: 'econ',
    threeAxis: 'x',
    name: '경제',
    color: '#2a78d6',
    colorHex: 0x2a78d6,
    scale: [0, 10],
    tickStep: 2,
    tickDecimals: 0,
    poleLow: '재분배 · 국가 개입',
    poleHigh: '시장 · 민영화',
  },
  {
    key: 'cultural',
    threeAxis: 'y',
    name: '사회·문화',
    color: '#1baf7a',
    colorHex: 0x1baf7a,
    scale: [0, 10],
    tickStep: 2,
    tickDecimals: 0,
    poleLow: 'GAL 자유 · 개방',
    poleHigh: 'TAN 권위 · 전통',
  },
  {
    key: 'norms',
    threeAxis: 'z',
    name: '민주주의 규범',
    color: '#eb6834',
    colorHex: 0xeb6834,
    scale: [0, 1],
    tickStep: 0.2,
    tickDecimals: 1,
    poleLow: '다원주의',
    poleHigh: '반다원주의',
  },
];

// 규범 구간. 절단점은 명세 5.5절의 제안값이며 문헌 근거가 없다.
// 런타임에 조절 가능해야 하므로 cut 배열을 변경 가능한 상태로 노출한다 — CLAUDE.md「구간 절단점은 하드코딩 금지」.
export const NORMS_BANDS = {
  cut: [0.3, 0.5],
  order: ['pluralist', 'borderline', 'anti_pluralist'],
  meta: {
    pluralist: { label: '다원주의', color: '#2a78d6', colorHex: 0x2a78d6, shape: 'sphere', shapeLabel: '구' },
    borderline: { label: '경계', color: '#eda100', colorHex: 0xeda100, shape: 'octahedron', shapeLabel: '8면체' },
    anti_pluralist: { label: '반다원주의', color: '#d03b3b', colorHex: 0xd03b3b, shape: 'tetrahedron', shapeLabel: '4면체' },
  },
};

// v를 현재 절단점으로 구간에 배정. band 문자열을 신뢰하지 않고 항상 v에서 재계산한다.
export function bandOf(v, cut = NORMS_BANDS.cut) {
  if (v < cut[0]) return 'pluralist';
  if (v < cut[1]) return 'borderline';
  return 'anti_pluralist';
}

export const POINT = {
  radius: 0.34,
  sphereSegments: 24,
  // 축(불투명 라인)과 재질을 분명히 구분한다. 규범 구간 파랑과 경제축 파랑이
  // 같은 값이라 재질 차이가 유일한 변별 수단이다 — CLAUDE.md「인코딩」.
  roughness: 0.28,
  metalness: 0.35,
  hoverScale: 1.35,
  selectScale: 1.55,
};

// estimated: true인 좌표의 시각 구분 — CLAUDE.md 절대규칙 5.
// 현재 시드는 전 좌표가 추정치라 비교 대비가 드러나지 않는다. 상시 배너가 그 역할을 대신한다.
export const ESTIMATED = {
  opacity: 0.72,
  outlineColor: 0xffffff,
  outlineOpacity: 0.45,
  dashSize: 0.09,
  gapSize: 0.06,
};

export const DROPLINE = {
  color: 0x7d8798,
  opacity: 0.5,
  // 점에서 큐브 바닥면(경제 × 규범 평면)까지 문화축 방향으로 내린다.
  // 명세는 "X-Z 평면"이라 쓰지만 문자 그대로 문화=5 중앙면에 두면 점의 절반이
  // 위로, 절반이 아래로 뻗어 깊이 단서가 되지 못한다. 바닥면도 X-Z에 평행하며
  // 이쪽이 판독에 유리하므로 바닥면을 채택했다.
  target: 'floor',
};

export const GRID = {
  color: 0x2b3340,
  divisions: 10,
  opacity: 0.5,
};

export const CAMERA = {
  fov: 45,
  near: 0.1,
  far: 500,
  initial: [22, 16, 26],
  presets: {
    econ_cultural: { label: '경제 × 문화 정면', pos: [0, 0, 38], up: [0, 1, 0] },
    norms: { label: '규범 정면', pos: [38, 0, 0], up: [0, 1, 0] },
    iso: { label: '등축', pos: [22, 16, 26], up: [0, 1, 0] },
  },
  tweenMs: 900,
};

export const CONTROLS = {
  damping: 0.08,
  minDistance: 12,
  maxDistance: 90,
};

export const TICK = {
  size: 0.28,
  color: 0x8b95a6,
};

// 한국어 UI 문자열. 코드에 하드코딩 금지.
export const UI = {
  title: '정당 3축 탐색기',
  subtitle: '경제 × 사회·문화 × 민주주의 규범',

  bannerTitle: '⚠ 전 좌표 추정치 — 인용 금지',
  bannerBody:
    'data/parties.json의 좌표 60개(20레코드 × 3축) 전부가 추정치다. CHES 2019 · V-Party 원본에서 추출한 실측값으로 교체하기 전이다. 한국 정당의 규범축은 코딩 루브릭 Z-1~Z-4 판정을 아직 거치지 않은 잠정값이며 증거 로그가 없다.',

  gridCaption: '바닥 격자는 깊이 참조용이며 아무 의미도 없다.',

  axisIndependenceNote:
    '세 축은 독립이다. 중심에서의 거리는 극단성을 뜻하지 않는다. 척도는 경제·사회문화 0–10, 규범 0–1로 서로 다르며 정규화하지 않았다.',

  bandLegendTitle: '민주주의 규범 구간',
  bandCutCaption: '절단점 0.30 / 0.50은 명세 5.5절의 제안값이며 문헌 근거가 없다.',

  estimatedLegend: '점선 윤곽 · 반투명 = 추정치',

  loadError: 'parties.json을 읽지 못했다.',
  validationPrefix: '[검증]',
};
