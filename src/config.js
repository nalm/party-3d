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
    // 원래 #2a78d6이었으나 경제축 색과 같은 값이라 축 라인과 점이 구분되지 않았다.
    // 픽셀 검사에서도 둘이 분리되지 않아 더 밝은 파랑으로 옮겼다 (2026-07-30).
    pluralist: { label: '다원주의', color: '#4a9eff', colorHex: 0x4a9eff, shape: 'sphere', shapeLabel: '구' },
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
  far: 2000,

  // 절대 위치가 아니라 방향이다. 거리는 종횡비에서 계산한다 — 아래 fitMargin 참조.
  // fov는 수직 기준이므로 창이 좁으면 수평으로 잘린다. 거리를 고정하면
  // 세로로 긴 창에서 큐브가 화면 밖으로 나간다.
  // 기본값이 [22,16,26]이었으나 그 방향에서 es-vox-2019가 it-fdi-2019를 거의 완전히
  // 가렸다. FdI는 "이념축 극단 ≠ 규범축 극단"을 보여주는 검증 사례라 가려지면 안 된다.
  // 20개 점의 최소 화면 간격을 재서 0.0104 → 0.0266으로 개선되는 방향으로 옮겼다.
  initialDir: [26, 16, 22],

  // 큐브 외접구를 화면에 담을 때 남길 여백. 축 양극 라벨이 큐브 밖으로
  // 1.5 world unit 나가므로 그만큼을 포함한다.
  fitMargin: 1.18,

  presets: {
    econ_cultural: { label: '경제 × 문화 정면', dir: [0, 0, 1] },
    norms: { label: '규범 정면', dir: [1, 0, 0] },
    iso: { label: '등축', dir: [26, 16, 22] },
  },
  tweenMs: 900,
};

export const CONTROLS = {
  damping: 0.08,
  // 최소 거리는 큐브 안으로 파고들지 않을 정도. 최대 거리는 프레이밍 거리에서
  // 파생시키므로(종횡비 의존) 상수로 두지 않는다.
  minDistance: 10,
  maxDistanceFactor: 2.2,
};

export const TICK = {
  size: 0.28,
  color: 0x8b95a6,
};

// 필터에 걸러진 점의 처리.
// 기본을 '숨기기'가 아니라 '흐리게'로 둔 이유: 이 앱의 목적은 비교다. 걸러진 점을
// 완전히 없애면 남은 점이 전체 분포에서 어디쯤인지 알 수 없다. 다만 드롭라인과
// 라벨은 걷어낸다 — 20개가 다 남으면 어지러워 판독이 안 된다.
export const FILTER = {
  dimOpacity: 0.11,
  defaultHide: false,
};

// 궤적. 같은 party_key의 연도별 이동을 화살표로 잇는다 — 이 앱의 최대 강점.
// 색을 중립으로 둔 이유: 구간 색은 점이 이미 담고 있다. 화살표에 다시 색을 실으면
// 이중 인코딩이 되어 무엇이 범주 정보인지 흐려진다. 방향은 화살촉이 알려 준다.
export const TRAJECTORY = {
  color: 0xd8dfe9,
  opacity: 0.92,
  shaftRadius: 0.055,
  headRadius: 0.17,
  headLength: 0.5,
  roughness: 0.5,
  metalness: 0.1,
  defaultVisible: true,
  // 화살표를 점 표면에서 시작·종료시켜 점 안에 묻히지 않게 한다
  endGap: POINT.radius * 1.15,
};

// 2D 대체 뷰 (X-Y 산점도 + 규범을 색·도형으로 이중 인코딩).
// 정적 등축 투영에 점을 찍으면 독자가 깊이를 판독할 수 없으므로 보도·인쇄에는 2D가 정본이다 — 명세 13.2절.
export const VIEW2D = {
  margin: { top: 30, right: 26, bottom: 56, left: 68 },
  bg: '#0e1116',
  grid: '#212936',
  frame: '#3a4250',
  tickText: '#9aa4b3',
  pointRadius: 7,
  hoverRadius: 9,
  selectRadius: 11,
  strokeWidth: 1.4,
  estimatedDash: [3, 2],
  labelColor: '#e0e6ef',
  labelFont: '600 11px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif',
  tickFont: '10px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif',
  poleFont: '600 11.5px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif',
  trajColor: '#c8d0dc',
  trajWidth: 1.8,
  trajHeadLen: 10,
  trajHeadHalfWidth: 4.5,
  dimAlpha: 0.13,
  // PNG 내보내기 배율. 2배면 인쇄에서 뭉개지지 않는다.
  exportScale: 2,
};

// 한국어 UI 문자열. 코드에 하드코딩 금지.
export const UI = {
  title: '정당 3축 탐색기',
  subtitle: '경제 × 사회·문화 × 민주주의 규범',

  bannerTitle: '⚠ 규범축·한국 좌표는 추정치 — 인용 주의',
  bannerBody:
    '유럽 18개 레코드의 경제·사회문화 축은 CHES 실측값이다(1999–2024 트렌드 파일 V2). 그러나 민주주의 규범축 전체와 한국 정당의 모든 좌표는 여전히 추정치다 — 규범축은 V-Party 원본이 아닌 2차 문헌 인용값이며, 한국 규범축은 코딩 루브릭 판정을 거치지 않은 잠정값이다. 규범축 수치와 한국 좌표를 인용하면 안 된다.',

  gridCaption: '바닥 격자는 깊이 참조용이며 아무 의미도 없다.',

  axisIndependenceNote:
    '세 축은 독립이다. 중심에서의 거리는 극단성을 뜻하지 않는다. 척도는 경제·사회문화 0–10, 규범 0–1로 서로 다르며 정규화하지 않았다.',

  bandLegendTitle: '민주주의 규범 구간',
  bandCutCaption: '절단점 0.30 / 0.50은 명세 5.5절의 제안값이며 문헌 근거가 없다.',

  estimatedLegend: '점선 윤곽 · 반투명 = 추정치',

  loadError: 'parties.json을 읽지 못했다.',
  validationPrefix: '[검증]',

  // 상세 패널
  panelEmpty: '점을 클릭하면 상세와 출처가 표시된다.',
  panelHint: '빈 곳을 클릭하면 선택이 해제된다.',
  panelClose: '닫기',
  secAxes: '세 축',
  secSub: '사회·문화 하위 지표',
  secTags: '태그',
  secOrg: '조직 형태',
  secSource: '출처',
  lblScale: '척도',
  lblVariable: '변수',
  lblEdition: '판',
  lblYear: '연도',
  lblDataset: '데이터셋',
  lblCoverage: '범위',
  lblCitation: '인용',
  lblCaveat: '캐비엇',
  lblWeights: '가중치',
  lblBand: '구간',
  lblEstimated: '추정치',
  lblMeasured: '실측',
  lblNote: '주',
  lblWeightedSum: '가중합',
  lblPopulism: '포퓰리즘 수사',
  lblForeign: '대외·주권',
  lblFamily: '정당 가족',
  lblAffiliation: '국제 소속',
  lblInstitutionalization: '제도화',
  lblPersonalization: '개인화',
  lblOrgType: '유형',

  // 필터 · 시점 · 절단점 조작부
  secFilter: '필터',
  filterCountry: '국가',
  filterFamily: '정당 가족',
  filterYear: '연도',
  filterAll: '전체',
  filterNone: '해제',
  filterHideLabel: '걸러진 점 숨기기',
  filterHideHint: '기본은 흐리게다. 걸러진 점을 남겨 두면 남은 점이 전체 분포에서 어디쯤인지 읽을 수 있다.',
  filterCount: (shown, total) => `${shown} / ${total} 표시`,

  secCamera: '시점',
  cameraNote: '"경제 × 문화 정면"이 2D 산점도와 같은 구도다. 규범축이 화면 깊이 방향으로 눕는다.',

  secCut: '규범 구간 절단점',
  cutLower: '다원주의 ↔ 경계',
  cutUpper: '경계 ↔ 반다원주의',
  cutProposalNote: '절단점 0.30 / 0.50은 명세 5.5절의 제안값이며 문헌 근거가 없다. 값을 바꾸면 점의 색과 도형이 즉시 바뀐다.',
  cutExample: '스페인 복스(0.55)와 이탈리아의 형제들(0.45)은 규범축 차이가 0.10뿐인데 절단점 0.50을 사이에 두고 구간이 갈린다. 슬라이더를 조금만 움직이면 두 정당이 같은 구간으로 합쳐진다.',

  secView: '뷰',
  view3d: '3D 공간',
  view2d: '2D 산점도',
  viewNote3d: '회전·확대로 세 축을 함께 본다. 깊이는 드롭라인으로 읽는다.',
  viewNote2d: '경제 × 사회·문화 산점도. 규범축은 색과 도형으로 이중 인코딩된다. 보도·인쇄용 정본이다.',
  view2dLabels: '전체 라벨 표시',
  view2dLabelsNote: '인쇄용이므로 2D에서는 기본으로 켠다. 겹치는 라벨은 자동으로 생략된다.',
  exportPng: 'PNG 내보내기',
  exportNote: '2D 산점도 기준으로 저장한다. 경고와 출처가 이미지 안에 함께 들어간다.',
  exportFilename: 'party-3d_2D산점도',

  // PNG 이미지 안에 새길 문구
  pngTitle: '정당 3축 프레임워크 — 경제 × 사회·문화 (규범은 색·도형)',
  pngWarning: '⚠ 경제·사회문화 축은 CHES 실측, 규범축(색·도형)과 한국 좌표는 추정치 — 인용 주의',
  pngSourcePrefix: '출처',
  pngScaleNote: '척도: 경제 0–10 · 사회·문화 0–10 · 민주주의 규범 0–1 (정규화하지 않음)',
  pngCutNote: (lo, hi) => `규범 구간 절단점 ${lo.toFixed(2)} / ${hi.toFixed(2)} — 명세 제안값이며 문헌 근거 없음`,
  pngGenerated: (d) => `생성 ${d}`,

  secTrajectory: '궤적',
  trajShow: '궤적 표시',
  trajOnly: '궤적 있는 정당만',
  trajNote: '같은 정당의 연도별 이동이다. 화살표는 과거 → 최근 방향이며, 양 끝점은 라벨을 유지한다.',
  trajCount: (n) => `궤적 ${n}개`,

  secDelta: '궤적 — 축별 변화량',
  deltaFixed: '거의 고정',
  deltaBandMove: '구간 이동',
  deltaOfScale: '척도 대비',
  deltaScaleCaveat:
    '척도 대비 비율은 읽기 보조일 뿐이다. 규범축은 0–1 임계선이고 X·Y는 0–10 스펙트럼이라 같은 비율이 같은 의미가 아니다 — 명세 5.2절.',

  reset: '초기화',

  srcUnresolved: '출처 메타를 찾지 못했다',
  bandMismatch: '저장된 구간과 현재 절단점 기준 구간이 다르다',
  orgLayerNote: '조직 형태는 축이 아니라 유형이다. 위치로 읽지 말 것 — 명세 6절.',
  populismLayerNote: '포퓰리즘은 규범축과 별개다. 수사가 있다는 사실이 규범 훼손을 함의하지 않는다 — 명세 7.1절.',
};

// 범주형 필드의 한국어 표시. 코드에 하드코딩 금지.
export const LABELS = {
  country: {
    DE: '독일', FR: '프랑스', GB: '영국', IT: '이탈리아',
    ES: '스페인', HU: '헝가리', PL: '폴란드', KR: '한국',
  },
  family: {
    christian_democracy: '기독교민주주의',
    social_democracy: '사회민주주의',
    green: '녹색',
    radical_left: '급진좌파',
    radical_right: '급진우파',
    liberal: '자유주의',
    conservative: '보수주의',
  },
  populism_tag: { right: '우파 포퓰리즘', left: '좌파 포퓰리즘', none: '해당 없음' },
  foreign_tag: {
    pro_eu: '친EU',
    eurosceptic: '반EU',
    soft_eurosceptic: '연성 반EU',
    alliance_first: '한미일 동맹 우선',
    strategic_autonomy: '전략적 자율성',
  },
  level: { high: '높음', mid: '중간', low: '낮음' },
  org_type: {
    mass_program: '대중·프로그램 정당',
    cartel_dominant: '카르텔·지배 정당',
    movement: '운동 정당',
    personalist: '인물 정당',
  },
  sub: {
    north_korea_security: '대북 · 안보',
    gender_minority: '젠더 · 소수자',
    tradition_religion: '전통가치 · 종교',
  },
};

// 사전에 없는 값은 원문을 그대로 노출한다. 조용히 빈칸으로 만들면 데이터 누락이 숨는다.
export function labelOf(dict, key) {
  if (key === null || key === undefined) return '—';
  return LABELS[dict]?.[key] ?? String(key);
}
