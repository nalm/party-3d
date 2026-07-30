import { UI, CAMERA, NORMS_BANDS } from './config.js';

// 카메라 프리셋 · 규범 구간 절단점 슬라이더 · 리셋.
// 절단점은 명세의 제안값일 뿐이므로 UI에서 조절 가능해야 한다 — CLAUDE.md「구간 절단점은 하드코딩 금지」.

const MIN_GAP = 0.02; // 두 절단점이 겹치면 '경계' 구간이 사라진다

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
}

export function createControlsUI(host, { flyTo, onCutChange, onReset }) {
  const sliders = {};
  const readouts = {};

  function cameraSection() {
    const sec = el('section', 'ctl-sec');
    sec.append(el('h2', null, UI.secCamera));

    const row = el('div', 'btn-row');
    for (const [key, preset] of Object.entries(CAMERA.presets)) {
      const b = el('button', 'preset', preset.label);
      b.dataset.preset = key;
      b.addEventListener('click', () => flyTo(preset.dir));
      row.append(b);
    }
    sec.append(row);
    sec.append(el('p', 'hint', UI.cameraNote));
    return sec;
  }

  function cutRow(idx, labelText) {
    const wrap = el('div', 'cut-row');

    const head = el('div', 'cut-head');
    head.append(el('span', 'cut-label', labelText));
    const out = el('span', 'cut-val', NORMS_BANDS.cut[idx].toFixed(2));
    head.append(out);
    readouts[idx] = out;
    wrap.append(head);

    const input = el('input');
    input.type = 'range';
    input.min = '0.01';
    input.max = '0.99';
    input.step = '0.01';
    input.value = String(NORMS_BANDS.cut[idx]);
    input.addEventListener('input', () => {
      let v = Number(input.value);
      // 순서를 강제한다. 아래 절단점이 위를 넘으면 구간 정의가 무너진다.
      const other = NORMS_BANDS.cut[idx === 0 ? 1 : 0];
      if (idx === 0) v = Math.min(v, other - MIN_GAP);
      else v = Math.max(v, other + MIN_GAP);
      v = Math.round(v * 100) / 100;

      NORMS_BANDS.cut[idx] = v;
      input.value = String(v);
      syncReadouts();
      onCutChange?.();
    });
    sliders[idx] = input;
    wrap.append(input);
    return wrap;
  }

  function syncReadouts() {
    for (const i of [0, 1]) {
      readouts[i].textContent = NORMS_BANDS.cut[i].toFixed(2);
      sliders[i].value = String(NORMS_BANDS.cut[i]);
    }
  }

  function cutSection() {
    const sec = el('section', 'ctl-sec');
    sec.append(el('h2', null, UI.secCut));
    sec.append(cutRow(0, UI.cutLower));
    sec.append(cutRow(1, UI.cutUpper));
    sec.append(el('p', 'hint warn-hint', UI.cutProposalNote));
    sec.append(el('p', 'hint', UI.cutExample));
    return sec;
  }

  function resetSection() {
    const sec = el('section', 'ctl-sec');
    const b = el('button', 'reset-btn', UI.reset);
    b.addEventListener('click', () => onReset?.());
    sec.append(b);
    return sec;
  }

  host.append(cameraSection(), cutSection(), resetSection());

  // 리셋 시 슬라이더 표시를 되돌리기 위해 노출한다
  return { syncReadouts };
}
