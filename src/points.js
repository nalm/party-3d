import * as THREE from 'three';
import {
  NORMS_BANDS, POINT, ESTIMATED, DROPLINE, FILTER, COUNTRY_TAG,
  bandOf, countryColorHex,
} from './config.js';
import { makeLabel } from './labels.js';
import { positionOf, FLOOR_Y } from './axes.js';

// 정당 점 · 드롭라인 · 규범 구간 인코딩.
// 색만으로 범주를 구분하지 않는다. 구간마다 색과 도형을 함께 바꾼다 — CLAUDE.md 절대규칙 6.

const R = POINT.radius;

// 도형별 기하. 눈에 보이는 크기를 비슷하게 맞추려면 외접원 반지름을 보정해야 한다.
const GEO_CACHE = {};
function shapeGeometry(shape) {
  if (GEO_CACHE[shape]) return GEO_CACHE[shape];
  let g;
  if (shape === 'sphere') g = new THREE.SphereGeometry(R, POINT.sphereSegments, POINT.sphereSegments);
  else if (shape === 'octahedron') g = new THREE.OctahedronGeometry(R * 1.28);
  else g = new THREE.TetrahedronGeometry(R * 1.5);
  GEO_CACHE[shape] = g;
  return g;
}

// 추정치 표시용 케이지. 도형별로 같은 실루엣을 유지하되 성분을 적게 둔다.
const SHELL_CACHE = {};
function shellGeometry(shape) {
  if (SHELL_CACHE[shape]) return SHELL_CACHE[shape];
  const s = 1.18;
  let g;
  if (shape === 'sphere') g = new THREE.IcosahedronGeometry(R * s, 1);
  else if (shape === 'octahedron') g = new THREE.OctahedronGeometry(R * 1.28 * s);
  else g = new THREE.TetrahedronGeometry(R * 1.5 * s);
  SHELL_CACHE[shape] = g;
  return g;
}

function isEstimated(rec) {
  return rec.econ.estimated || rec.cultural.estimated || rec.norms.estimated;
}

// 드롭라인 색은 규범 구간을 나타낸다. 점 채움색이 국가로 넘어갔으므로 규범이
// 색 채널을 유지하는 자리다 — config.COUNTRY_COLORS 주석 참조.
function buildDropLine(pos, bandColorHex) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(pos.x, pos.y, pos.z),
    new THREE.Vector3(pos.x, FLOOR_Y, pos.z),
  ]);
  return new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({
      color: bandColorHex,
      transparent: true,
      opacity: DROPLINE.bandOpacity,
    }),
  );
}

export function buildPoints(scene, parties) {
  const group = new THREE.Group();
  const items = [];

  for (const rec of parties) {
    const pos = positionOf(rec);
    const band = bandOf(rec.norms.v);
    const meta = NORMS_BANDS.meta[band];
    const estimated = isEstimated(rec);

    // 채움색 = 국가. 규범 구간은 도형 + 드롭라인 색이 담당한다.
    const material = new THREE.MeshStandardMaterial({
      color: countryColorHex(rec.country),
      roughness: POINT.roughness,
      metalness: POINT.metalness,
      transparent: estimated,
      opacity: estimated ? ESTIMATED.opacity : 1,
    });

    const mesh = new THREE.Mesh(shapeGeometry(meta.shape), material);
    mesh.position.copy(pos);
    // 레이캐스팅으로 되짚을 수 있게 원본 레코드를 붙여 둔다 (3단계 선택 기능).
    mesh.userData.record = rec;
    group.add(mesh);

    let shell = null;
    if (estimated) {
      shell = new THREE.Mesh(
        shellGeometry(meta.shape),
        new THREE.MeshBasicMaterial({
          color: ESTIMATED.outlineColor,
          wireframe: true,
          transparent: true,
          opacity: ESTIMATED.outlineOpacity * 0.6,
          depthWrite: false,
        }),
      );
      shell.position.copy(pos);
      shell.raycast = () => {}; // 케이지가 클릭을 가로채지 않게 한다
      group.add(shell);
    }

    const dropline = buildDropLine(pos, meta.colorHex);
    group.add(dropline);

    // 국가 코드 태그. 래퍼는 크기 0이고 안쪽 span만 화면 오른쪽으로 밀어낸다 —
    // CSS2DRenderer가 래퍼의 transform을 덮어쓰므로 래퍼 자체는 옮길 수 없다.
    // 카메라를 돌려도 항상 점의 화면 오른쪽에 붙는다.
    const tag = makeLabel('', 'country-tag');
    tag.element.append(
      Object.assign(document.createElement('span'), { textContent: rec.country }),
    );
    mesh.add(tag);

    // 상시 정당명. 같은 래퍼 기법이며 겹침은 프레임마다 컬링한다(cullPartyNames).
    const nameTag = makeLabel('', 'party-name');
    const nameSpan = Object.assign(document.createElement('span'), {
      textContent: rec.label_short,
    });
    nameTag.element.append(nameSpan);
    mesh.add(nameTag);

    items.push({
      rec, mesh, shell, dropline, band, tag, nameTag, nameSpan,
      baseOpacity: estimated ? ESTIMATED.opacity : 1,
      matched: true,
    });
  }

  scene.add(group);

  // 절단점이 바뀌면 색과 도형을 즉시 갱신한다 (4단계 슬라이더).
  function applyBands() {
    for (const item of items) {
      const band = bandOf(item.rec.norms.v);
      if (band === item.band) continue;
      const meta = NORMS_BANDS.meta[band];
      item.mesh.geometry = shapeGeometry(meta.shape);
      // 점 채움색은 국가라서 건드리지 않는다. 규범 색은 드롭라인이 담당한다.
      item.dropline.material.color.setHex(meta.colorHex);
      if (item.shell) item.shell.geometry = shellGeometry(meta.shape);
      item.band = band;
    }
  }

  // 필터 적용. hide=false면 걸러진 점을 흐리게 남긴다 (config.FILTER 주석 참조).
  // 드롭라인과 추정치 케이지는 어느 모드에서든 매칭된 점만 유지한다.
  function applyFilter(matchFn, hide) {
    let shown = 0;
    for (const item of items) {
      const on = !!matchFn(item.rec);
      item.matched = on;
      if (on) shown++;

      const mat = item.mesh.material;
      item.mesh.visible = hide ? on : true;
      mat.opacity = on ? item.baseOpacity : FILTER.dimOpacity;
      mat.transparent = mat.opacity < 1;
      // 반투명 점이 서로를 가리며 정렬 artifact를 만드는 것을 줄인다
      mat.depthWrite = on;

      item.dropline.visible = on;
      if (item.shell) item.shell.visible = on;
      // CSS2DRenderer가 부모의 visible을 항상 존중하지는 않으므로 직접 끈다
      item.tag.visible = on;
      item.nameTag.visible = on;
    }
    return shown;
  }

  // ── 상시 정당명 겹침 컬링 ──
  // 3D는 카메라가 돌면 라벨 위치가 매 프레임 바뀌므로 2D처럼 한 번 배치하고 끝낼 수
  // 없다. 프레임마다 화면 좌표를 구해 가까운 점부터 자리를 잡고, 이미 놓인 사각형과
  // 겹치는 이름은 숨긴다. 이것이 CLAUDE.md「상시 표시되는 전체 라벨」 금지의 근거였던
  // "겹쳐서 읽을 수 없다"를 해소하는 장치다.
  let showNames = true;
  let culledCount = 0;

  const _v = new THREE.Vector3();
  const _boxes = [];
  const _order = [];

  function cullPartyNames(camera, viewW, viewH) {
    if (!showNames) {
      for (const item of items) item.nameSpan.style.visibility = 'hidden';
      culledCount = 0;
      return;
    }

    _boxes.length = 0;
    _order.length = 0;

    for (const item of items) {
      if (!item.matched) {
        item.nameSpan.style.visibility = 'hidden';
        continue;
      }
      _v.copy(item.mesh.position).project(camera);
      // 절두체 밖이면 그릴 필요가 없다
      if (_v.z < -1 || _v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) {
        item.nameSpan.style.visibility = 'hidden';
        continue;
      }
      _order.push({
        item,
        depth: _v.z,
        x: (_v.x + 1) / 2 * viewW,
        y: (-_v.y + 1) / 2 * viewH,
      });
    }

    // 카메라에 가까운 점이 이름을 갖는다
    _order.sort((a, b) => a.depth - b.depth);

    let culled = 0;
    for (const o of _order) {
      // 실제 렌더 폭을 재면 레이아웃을 강제로 계산하게 되어 프레임마다 비싸다.
      // 글자당 근사 폭으로 충분하다 — 컬링이 조금 보수적으로 동작할 뿐이다.
      const w = o.item.rec.label_short.length * POINT.nameCharWidth + 6;
      const h = POINT.nameBoxH;
      // CSS의 .party-name span { left: 10px; top: 4px } 와 같은 상자여야 한다
      const x = o.x + POINT.nameOffsetX;
      const y = o.y + POINT.nameOffsetY;

      const clash = _boxes.some((b) =>
        x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);

      if (clash) {
        o.item.nameSpan.style.visibility = 'hidden';
        culled++;
      } else {
        o.item.nameSpan.style.visibility = 'visible';
        _boxes.push({ x, y, w, h });
      }
    }
    culledCount = culled;
  }

  return {
    group, items, applyBands, applyFilter, cullPartyNames,
    setShowNames(v) { showNames = v; },
    culledNames: () => culledCount,
  };
}
