import * as THREE from 'three';
import { SPACE, AXES, GRID, TICK } from './config.js';
import { makeLabel } from './labels.js';

// 이 모듈이 좌표 공간의 정의를 소유한다. points.js는 여기서 매핑 함수를 가져다 쓴다.

const AXIS_BY_KEY = Object.fromEntries(AXES.map((a) => [a.key, a]));

// 값 → world 좌표. 각 축을 자기 척도 안에서 독립적으로 큐브 변장에 매핑한다.
// 세 축의 값을 하나의 스케일로 합치는 정규화가 아니다 — CLAUDE.md 절대규칙 3.
// invertScreen 축은 화면 방향만 뒤집는다(값 척도는 불변) — config.js AXES 주석 참조.
export function toWorld(v, axisKey) {
  const axis = AXIS_BY_KEY[axisKey];
  const [lo, hi] = axis.scale;
  let t = (v - lo) / (hi - lo);
  if (axis.invertScreen) t = 1 - t;
  return (t * 2 - 1) * SPACE.half;
}

// 레코드 → THREE.Vector3. 어느 축이 X·Y·Z인지는 config.AXES의 threeAxis가 정한다.
// 하드코딩하지 않는다 — 축 배치를 바꿀 때 이 함수를 고치지 않아도 되게.
export function positionOf(rec) {
  const p = new THREE.Vector3();
  for (const axis of AXES) {
    p[axis.threeAxis] = toWorld(rec[axis.key].v, axis.key);
  }
  return p;
}

// 드롭 라인이 닿는 바닥면의 world y.
// 세로축이 규범이 된 뒤로 바닥면은 경제 × 사회·문화 평면 — 즉 2D 산점도 평면이다.
// 따라서 드롭라인의 길이가 곧 규범 점수이고, 바닥의 그림자 위치가 2D 좌표다.
export const FLOOR_Y = -SPACE.half;

function unitVec(threeAxis) {
  return new THREE.Vector3(
    threeAxis === 'x' ? 1 : 0,
    threeAxis === 'y' ? 1 : 0,
    threeAxis === 'z' ? 1 : 0,
  );
}

// 눈금 라벨을 밀어낼 방향. 축마다 달리 두어 겹침을 줄인다.
function tickOffsetDir(threeAxis) {
  if (threeAxis === 'y') return new THREE.Vector3(-1, 0, 0);
  return new THREE.Vector3(0, -1, 0);
}

function buildCube() {
  const g = new THREE.BoxGeometry(SPACE.half * 2, SPACE.half * 2, SPACE.half * 2);
  const edges = new THREE.EdgesGeometry(g);
  g.dispose();
  return new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: SPACE.cubeColor,
      transparent: true,
      opacity: SPACE.cubeOpacity,
    }),
  );
}

function buildFloorGrid() {
  const grid = new THREE.GridHelper(SPACE.half * 2, GRID.divisions, GRID.color, GRID.color);
  grid.position.y = FLOOR_Y;
  grid.material.transparent = true;
  grid.material.opacity = GRID.opacity;
  return grid;
}

// 축 하나: 중심을 지나는 불투명 라인 + 눈금 표시 + 눈금 값 + 양극 라벨
function buildAxis(axis) {
  const group = new THREE.Group();
  const dir = unitVec(axis.threeAxis);
  const offDir = tickOffsetDir(axis.threeAxis);

  // 축 선. 점(광택 입체)과 구분되도록 조명에 반응하지 않는 불투명 라인으로 둔다.
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    dir.clone().multiplyScalar(-SPACE.half),
    dir.clone().multiplyScalar(SPACE.half),
  ]);
  group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: axis.colorHex })));

  // 눈금
  const [lo, hi] = axis.scale;
  const tickMat = new THREE.LineBasicMaterial({ color: TICK.color });
  const steps = Math.round((hi - lo) / axis.tickStep);

  for (let i = 0; i <= steps; i++) {
    const v = lo + i * axis.tickStep;
    const at = dir.clone().multiplyScalar(toWorld(v, axis.key));

    const markGeo = new THREE.BufferGeometry().setFromPoints([
      at.clone().addScaledVector(offDir, -TICK.size),
      at.clone().addScaledVector(offDir, TICK.size),
    ]);
    group.add(new THREE.LineSegments(markGeo, tickMat));

    // 중앙(세 축이 교차하는 지점)은 라벨을 생략한다. 세 축의 중앙값이 한자리에 겹친다.
    if (i === steps / 2) continue;

    const label = makeLabel(v.toFixed(axis.tickDecimals), 'axis-tick');
    label.position.copy(at.clone().addScaledVector(offDir, TICK.size * 2.6));
    group.add(label);
  }

  // 양극 라벨. 각 축은 스펙트럼이므로 단방향 화살표가 아니라 양쪽 모두 표기한다.
  // invertScreen 축은 극의 화면 위치가 뒤집히므로 라벨도 반대 끝에 놓는다.
  const pad = SPACE.half + 1.5;
  const lowEnd = axis.invertScreen ? pad : -pad;
  const low = makeLabel('', 'axis-pole', { color: axis.color });
  low.element.append(
    Object.assign(document.createElement('div'), { textContent: axis.poleLow }),
    Object.assign(document.createElement('div'), {
      textContent: `${axis.name} ${lo.toFixed(axis.tickDecimals)}`,
      style: 'font-size:10px;opacity:.7;font-weight:400',
    }),
  );
  low.position.copy(dir.clone().multiplyScalar(lowEnd));
  group.add(low);

  const high = makeLabel('', 'axis-pole', { color: axis.color });
  high.element.append(
    Object.assign(document.createElement('div'), { textContent: axis.poleHigh }),
    Object.assign(document.createElement('div'), {
      textContent: `${axis.name} ${hi.toFixed(axis.tickDecimals)}`,
      style: 'font-size:10px;opacity:.7;font-weight:400',
    }),
  );
  high.position.copy(dir.clone().multiplyScalar(-lowEnd));
  group.add(high);

  return group;
}

export function buildSpace(scene) {
  const group = new THREE.Group();
  group.add(buildCube());
  group.add(buildFloorGrid());
  for (const axis of AXES) group.add(buildAxis(axis));
  scene.add(group);
  return group;
}
