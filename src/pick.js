import * as THREE from 'three';
import { POINT, NORMS_BANDS, bandOf } from './config.js';
import { makeLabel } from './labels.js';

// 호버·선택 레이캐스팅.
// 라벨은 호버·선택 시에만 띄운다. 상시 전체 표시는 겹쳐서 읽을 수 없다 — CLAUDE.md 절대규칙 「상시 표시되는 전체 라벨」 금지.

const CLICK_SLOP = 5; // 이 이상 움직이면 OrbitControls 드래그로 보고 클릭으로 세지 않는다

export function createPicker({ camera, domElement, items, onSelect, onDeselect }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const meshes = items.map((i) => i.mesh);
  const byMesh = new Map(items.map((i) => [i.mesh, i]));

  let hovered = null;
  let selected = null;
  let down = null;

  const hoverLabel = makeLabel('', 'point-label');
  const selectLabel = makeLabel('', 'point-label selected');

  function labelOffset() {
    return POINT.radius * 2.4;
  }

  // 선택 > 호버 > 기본. 상태가 겹칠 때 크기가 튀지 않게 한 곳에서 결정한다.
  function refresh(item) {
    if (!item) return;
    const isSel = item === selected;
    const isHov = item === hovered;
    const s = isSel ? POINT.selectScale : isHov ? POINT.hoverScale : 1;
    item.mesh.scale.setScalar(s);
    if (item.shell) item.shell.scale.setScalar(s);

    const mat = item.mesh.material;
    if (isSel) {
      mat.emissive.setHex(NORMS_BANDS.meta[bandOf(item.rec.norms.v)].colorHex);
      mat.emissiveIntensity = 0.55;
    } else {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
  }

  function setHovered(item) {
    if (item === hovered) return;
    const prev = hovered;
    hovered = item;

    hoverLabel.removeFromParent();
    if (prev) refresh(prev);

    if (item) {
      refresh(item);
      // 선택된 점은 이미 자기 라벨을 달고 있으므로 호버 라벨을 겹치지 않는다.
      if (item !== selected) {
        hoverLabel.element.textContent = item.rec.label_short;
        hoverLabel.position.set(0, labelOffset(), 0);
        item.mesh.add(hoverLabel);
      }
    }
    domElement.style.cursor = item ? 'pointer' : '';
  }

  function setSelected(item) {
    if (item === selected) return;
    const prev = selected;
    selected = item;

    selectLabel.removeFromParent();
    if (prev) refresh(prev);

    if (item) {
      // 선택되면 호버 라벨을 걷고 선택 라벨로 대체한다
      if (hovered === item) hoverLabel.removeFromParent();
      selectLabel.element.textContent = `${item.rec.label_short} · ${item.rec.year}`;
      selectLabel.position.set(0, labelOffset(), 0);
      item.mesh.add(selectLabel);
      refresh(item);
      onSelect?.(item.rec);
    } else {
      onDeselect?.();
    }
  }

  function hitAt(clientX, clientY) {
    const r = domElement.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    // Raycaster는 mesh.visible을 보지 않는다. 필터에 걸러진 점이 잡히지 않도록
    // matched를 직접 확인해야 한다.
    const hits = raycaster.intersectObjects(meshes, false);
    for (const hit of hits) {
      const item = byMesh.get(hit.object);
      if (item?.matched) return item;
    }
    return null;
  }

  domElement.addEventListener('pointermove', (e) => {
    // 드래그 중에는 호버를 갱신하지 않는다. 회전하면서 라벨이 깜빡이는 것을 막는다.
    if (down) return;
    setHovered(hitAt(e.clientX, e.clientY));
  });

  domElement.addEventListener('pointerleave', () => setHovered(null));

  domElement.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });

  domElement.addEventListener('pointerup', (e) => {
    const start = down;
    down = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > CLICK_SLOP) return; // 회전 드래그였다

    const item = hitAt(e.clientX, e.clientY);
    setSelected(item); // 빈 곳이면 null → 선택 해제
    setHovered(item);
  });

  return {
    clearSelection: () => setSelected(null),
    getSelected: () => selected?.rec ?? null,
    // 절단점이 바뀌면 선택 강조 색도 따라가야 한다
    refreshAll: () => items.forEach(refresh),
    // 필터 적용 후 호출. 걸러진 점이 선택·호버 상태로 남아 있으면 해제한다.
    syncFilter() {
      if (hovered && !hovered.matched) setHovered(null);
      if (selected && !selected.matched) setSelected(null);
    },
  };
}
