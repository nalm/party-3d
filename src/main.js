import { UI, NORMS_BANDS, CAMERA } from './config.js';
import { createScene } from './scene.js';
import { buildSpace } from './axes.js';
import { loadParties } from './data.js';
import { buildPoints } from './points.js';
import { createPanel } from './panel.js';
import { createPicker } from './pick.js';
import { createFilters } from './filters.js';
import { createControlsUI } from './ui.js';
import { buildTrajectories } from './trajectory.js';

// 한국어 UI 문자열은 전부 config.js에서 가져온다 — CLAUDE.md「코드 컨벤션」.
function fillChrome() {
  const set = (sel, text) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  };
  set('#banner strong', UI.bannerTitle);
  set('#banner span', UI.bannerBody);
  set('#titlebar h1', UI.title);
  set('#titlebar p', UI.subtitle);
  set('#legend h2', UI.bandLegendTitle);
  set('#band-cut-caption', UI.bandCutCaption);
  set('#estimated-caption', UI.estimatedLegend);
  set('#grid-caption', UI.gridCaption);
  set('#independence-caption', UI.axisIndependenceNote);
  renderBandLegend();
}

// 절단점이 바뀌면 범례의 구간 범위도 따라가야 한다.
function renderBandLegend() {
  const host = document.querySelector('#band-rows');
  if (!host) return;
  host.textContent = '';

  const [lo, hi] = NORMS_BANDS.cut;
  const ranges = { pluralist: [0, lo], borderline: [lo, hi], anti_pluralist: [hi, 1] };

  for (const key of NORMS_BANDS.order) {
    const m = NORMS_BANDS.meta[key];
    const [a, b] = ranges[key];
    const row = document.createElement('div');
    row.className = 'band-row';

    const swatch = document.createElement('span');
    swatch.className = `band-swatch ${m.shape}`;
    swatch.style.background = m.color;
    row.appendChild(swatch);

    const text = document.createElement('span');
    text.textContent = `${m.label} ${a.toFixed(2)}–${b.toFixed(2)} · ${m.shapeLabel}`;
    row.appendChild(text);
    host.appendChild(row);
  }
}

function main() {
  fillChrome();

  const ctx = createScene(document.querySelector('#view'), document.querySelector('#labels'));
  const { scene, camera, renderer, flyTo, start, tick } = ctx;

  buildSpace(scene);

  const { parties } = loadParties();
  const points = buildPoints(scene, parties);
  console.info(`[렌더] 점 ${points.items.length}개`);

  const traj = buildTrajectories(scene, parties, points.items);
  console.info(`[렌더] 궤적 ${traj.count}개 — ${[...traj.keys].join(', ')}`);

  const panel = createPanel(document.querySelector('#panel'), {
    onClose: () => picker.clearSelection(),
    trajectoryOf: traj.recordsOf,
  });

  const picker = createPicker({
    camera,
    domElement: renderer.domElement,
    items: points.items,
    onSelect: (rec) => panel.show(rec),
    onDeselect: () => panel.clear(),
  });

  // ── 필터 ──
  // "궤적 있는 정당만"은 국가·가족·연도 필터와 AND로 합친다.
  let trajOnly = false;

  function applyFilters() {
    const match = (rec) =>
      filters.matches(rec) && (!trajOnly || traj.keys.has(rec.party_key));
    const shown = points.applyFilter(match, filters.isHiding());
    filters.setCount(shown, points.items.length);
    picker.syncFilter();
    traj.syncFilter();
  }

  const filters = createFilters(document.querySelector('#filters'), parties, {
    onChange: applyFilters,
  });

  // ── 시점 · 절단점 · 리셋 ──
  const controlsUI = createControlsUI(document.querySelector('#controls'), {
    flyTo,
    trajectory: traj,
    onTrajFilter: (on) => {
      trajOnly = on;
      applyFilters();
    },
    onCutChange: () => {
      points.applyBands();
      picker.refreshAll();
      renderBandLegend();
      // 패널이 열려 있으면 구간 라벨이 바뀌었을 수 있으므로 다시 그린다
      const sel = picker.getSelected();
      if (sel) panel.show(sel);
    },
    onReset: () => {
      NORMS_BANDS.cut[0] = 0.3;
      NORMS_BANDS.cut[1] = 0.5;
      controlsUI.syncReadouts();
      points.applyBands();
      renderBandLegend();
      picker.clearSelection();
      trajOnly = false;
      traj.setVisible(true);
      controlsUI.resetTrajectory();
      filters.reset(); // emit → applyFilters
      picker.refreshAll();
      flyTo(CAMERA.presets.iso.dir);
    },
  });

  applyFilters();

  // 개발·검증용 핸들. 탭이 백그라운드면 requestAnimationFrame이 멈춰 화면이
  // 갱신되지 않으므로 tick으로 한 프레임을 강제할 수 있게 해 둔다.
  window.__party3d = {
    ...ctx, points, panel, picker, filters, controlsUI, traj,
    applyFilters, renderBandLegend,
    drawOnce: tick,
  };

  start();
}

main();
