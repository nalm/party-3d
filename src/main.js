import { UI, NORMS_BANDS, CAMERA } from './config.js';
import { createScene } from './scene.js';
import { buildSpace } from './axes.js';
import { loadParties } from './data.js';
import { buildPoints } from './points.js';
import { createPanel } from './panel.js';
import { createPicker } from './pick.js';
import { createFilters } from './filters.js';
import { createControlsUI, createViewUI } from './ui.js';
import { buildTrajectories } from './trajectory.js';
import { createView2D } from './view2d.js';
import { downloadPNG, renderExportCanvas } from './export-png.js';

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

  // 선택 경로를 하나로 유지한다. 2D 클릭도 picker.selectById를 거쳐 여기로 들어온다.
  let selectedId = null;

  const picker = createPicker({
    camera,
    domElement: renderer.domElement,
    items: points.items,
    onSelect: (rec) => {
      selectedId = rec.id;
      panel.show(rec);
      draw2D();
    },
    onDeselect: () => {
      selectedId = null;
      panel.clear();
      draw2D();
    },
  });

  // ── 2D 산점도 ──
  const view2dEl = document.querySelector('#view2d');
  const view2d = createView2D(view2dEl.querySelector('canvas'), {
    items: points.items,
    trajectories: traj.trajectories,
  });
  let hovered2dId = null;

  function draw2D() {
    if (document.body.classList.contains('mode-2d') === false) return;
    view2d.draw({
      selectedId,
      hoveredId: hovered2dId,
      cssW: view2dEl.clientWidth,
      cssH: view2dEl.clientHeight,
      dpr: Math.min(window.devicePixelRatio, 2),
    });
  }

  const canvas2d = view2dEl.querySelector('canvas');
  canvas2d.addEventListener('pointermove', (e) => {
    const r = canvas2d.getBoundingClientRect();
    const hit = view2d.hitTest(e.clientX - r.left, e.clientY - r.top);
    const id = hit?.rec.id ?? null;
    canvas2d.style.cursor = id ? 'pointer' : '';
    if (id !== hovered2dId) {
      hovered2dId = id;
      draw2D();
    }
  });
  canvas2d.addEventListener('pointerleave', () => {
    hovered2dId = null;
    draw2D();
  });
  canvas2d.addEventListener('click', (e) => {
    const r = canvas2d.getBoundingClientRect();
    const hit = view2d.hitTest(e.clientX - r.left, e.clientY - r.top);
    picker.selectById(hit?.rec.id ?? null); // 빈 곳이면 해제
  });
  new ResizeObserver(draw2D).observe(view2dEl);

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
    draw2D();
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
      draw2D();
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

  // ── 2D/3D 전환 · PNG 내보내기 ──
  // 첫 진입은 3D다. 2D는 보도·인쇄용 정본이지만(명세 13.2절) 그건 산출물 기준이고,
  // 웹에서 이 앱의 고유 가치는 세 축을 함께 돌려 보는 데 있다. PNG는 항상 2D로 나간다.
  const viewUI = createViewUI(document.querySelector('#viewtoggle'), {
    initialMode: '3d',
    onMode: (mode) => {
      document.body.classList.toggle('mode-2d', mode === '2d');
      if (mode === '2d') draw2D();
      else ctx.resize();
    },
    onLabels: (on) => {
      view2d.setShowLabels(on);
      draw2D();
    },
    onExport: () => {
      const canvas = downloadPNG({ items: points.items, trajectories: traj.trajectories });
      console.info(`[내보내기] PNG ${canvas.width}×${canvas.height}`);
    },
  });

  // 좁은 화면에서 사이드바·패널을 시트로 여닫는다
  for (const b of document.querySelectorAll('#sheet-tabs button')) {
    b.addEventListener('click', () => {
      const cls = b.dataset.sheet === 'left' ? 'sheet-left' : 'sheet-right';
      const other = b.dataset.sheet === 'left' ? 'sheet-right' : 'sheet-left';
      document.body.classList.remove(other);
      document.body.classList.toggle(cls);
    });
  }

  applyFilters();

  // 개발·검증용 핸들. 탭이 백그라운드면 requestAnimationFrame이 멈춰 화면이
  // 갱신되지 않으므로 tick으로 한 프레임을 강제할 수 있게 해 둔다.
  window.__party3d = {
    ...ctx, points, panel, picker, filters, controlsUI, traj, view2d, viewUI,
    applyFilters, renderBandLegend, draw2D,
    drawOnce: tick,
    // 내보내기 결과를 다운로드 없이 검사할 수 있게 노출한다
    renderExportCanvas: (dateText = '검증') =>
      renderExportCanvas({ items: points.items, trajectories: traj.trajectories, dateText }),
  };

  start();
}

main();
