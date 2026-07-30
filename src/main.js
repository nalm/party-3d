import { UI, NORMS_BANDS } from './config.js';
import { createScene } from './scene.js';
import { buildSpace } from './axes.js';
import { loadParties } from './data.js';
import { buildPoints } from './points.js';
import { createPanel } from './panel.js';
import { createPicker } from './pick.js';

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

function renderBandLegend() {
  const host = document.querySelector('#band-rows');
  if (!host) return;
  host.textContent = '';

  const [lo, hi] = NORMS_BANDS.cut;
  const ranges = {
    pluralist: [0, lo],
    borderline: [lo, hi],
    anti_pluralist: [hi, 1],
  };

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

  const view = document.querySelector('#view');
  const labels = document.querySelector('#labels');
  const ctx = createScene(view, labels);
  const { scene, camera, renderer, labelRenderer, start } = ctx;

  buildSpace(scene);

  const { parties } = loadParties();
  const points = buildPoints(scene, parties);
  console.info(`[렌더] 점 ${points.items.length}개`);

  const panel = createPanel(document.querySelector('#panel'), {
    onClose: () => picker.clearSelection(),
  });

  const picker = createPicker({
    camera,
    domElement: renderer.domElement,
    items: points.items,
    onSelect: (rec) => panel.show(rec),
    onDeselect: () => panel.clear(),
  });

  // 개발·검증용 핸들. 탭이 백그라운드면 requestAnimationFrame이 멈춰 화면이
  // 갱신되지 않으므로 drawOnce로 한 프레임을 강제할 수 있게 해 둔다.
  window.__party3d = {
    ...ctx,
    points,
    panel,
    picker,
    renderBandLegend,
    drawOnce() {
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    },
  };

  start();
}

main();
