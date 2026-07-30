import sources from '../data/sources.json';
import { UI, AXES, NORMS_BANDS, bandOf, labelOf } from './config.js';

// 선택된 정당의 상세와 출처를 렌더링한다.
// 출처 표시는 선택 사항이 아니다. 데이터셋 · 판 · 변수명 · 연도 · 척도 범위가 모두 나와야 한다 — 명세 13.4절.

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

function kv(key, value, cls) {
  const row = el('div', `kv ${cls ?? ''}`);
  row.append(el('span', 'kv-k', key), el('span', 'kv-v', value));
  return row;
}

// "CHES2019.lrecon" 또는 "OhmyNews.estimate-2026-07 (명세 4.3절)" 형태를 분해한다.
function resolveSrc(raw) {
  const out = { raw, dsKey: null, ds: null, variable: null, varMeta: null, extra: null };
  const m = /^([^.]+)\.(.+)$/.exec(String(raw ?? '').trim());
  if (!m) return out;

  out.dsKey = m[1];
  let rest = m[2];
  const paren = /^(.*?)\s*\((.+)\)\s*$/.exec(rest);
  if (paren) {
    rest = paren[1].trim();
    out.extra = paren[2].trim();
  }
  out.variable = rest;
  out.ds = sources.datasets[out.dsKey] ?? null;
  out.varMeta = out.ds?.variables?.[rest] ?? null;
  return out;
}

function sourceBlock(axisData, year) {
  const s = resolveSrc(axisData.src);
  const box = el('div', 'src-box');

  if (!s.ds) {
    box.append(kv(UI.lblDataset, `${axisData.src} — ${UI.srcUnresolved}`, 'warn'));
    return box;
  }

  const selfEstimate = s.ds.kind === 'self_estimate';
  box.append(kv(UI.lblDataset, `${s.ds.name_ko} — ${s.ds.name_full}`, selfEstimate ? 'warn' : ''));
  box.append(kv(UI.lblEdition, s.ds.edition));

  const varText = s.varMeta ? `${s.variable} — ${s.varMeta.name_ko}` : s.variable;
  box.append(kv(UI.lblVariable, varText));
  box.append(kv(UI.lblYear, year));

  if (s.varMeta?.scale) box.append(kv(UI.lblScale, `${s.varMeta.scale[0]} – ${s.varMeta.scale[1]}`));
  if (s.varMeta?.note) box.append(kv(UI.lblNote, s.varMeta.note));
  if (s.extra) box.append(kv('부가', s.extra));
  if (s.ds.coverage) box.append(kv(UI.lblCoverage, s.ds.coverage));
  if (s.ds.citation) box.append(kv(UI.lblCitation, s.ds.citation));
  if (s.ds.caveat) box.append(kv(UI.lblCaveat, s.ds.caveat, 'warn'));

  return box;
}

function axisSection(rec) {
  const wrap = el('section');
  wrap.append(el('h3', null, UI.secAxes));

  for (const axis of AXES) {
    const d = rec[axis.key];
    const item = el('div', 'axis-item');
    item.style.borderLeftColor = axis.color;

    const head = el('div', 'axis-head');
    head.append(el('span', 'axis-name', axis.name));
    head.append(el('span', 'axis-val', d.v));
    head.append(el('span', 'axis-scale', `${UI.lblScale} ${d.scale[0]}–${d.scale[1]}`));
    head.append(
      el('span', `badge ${d.estimated ? 'badge-est' : 'badge-meas'}`,
        d.estimated ? UI.lblEstimated : UI.lblMeasured),
    );
    item.append(head);

    // 규범축은 구간 라벨을 함께 보여준다. 저장된 band와 현재 절단점 기준이 다르면 경고한다.
    if (axis.key === 'norms') {
      const live = bandOf(d.v);
      const liveMeta = NORMS_BANDS.meta[live];
      const row = kv(UI.lblBand, `${liveMeta.label} (${liveMeta.shapeLabel})`);
      row.querySelector('.kv-v').style.color = liveMeta.color;
      item.append(row);
      if (d.band && d.band !== live) {
        item.append(kv('⚠', `${UI.bandMismatch} — 저장 "${NORMS_BANDS.meta[d.band]?.label ?? d.band}"`, 'warn'));
      }
    }

    if (d.note) item.append(kv(UI.lblNote, d.note, 'note'));
    item.append(sourceBlock(d, rec.year));
    wrap.append(item);
  }
  return wrap;
}

// 한국 정당의 하위 3지표. 단일 값으로 뭉치면 직교성이 사라지므로 내역을 반드시 공개한다 — 명세 4.3절.
function subSection(rec) {
  const sub = rec.cultural.sub;
  if (!sub) return null;

  const wrap = el('section');
  wrap.append(el('h3', null, UI.secSub));

  const keys = ['north_korea_security', 'gender_minority', 'tradition_religion'];
  const w = sub.weights ?? [1 / 3, 1 / 3, 1 / 3];

  keys.forEach((k, i) => {
    wrap.append(kv(`${labelOf('sub', k)}  (×${w[i]})`, sub[k]));
  });

  const wsum = w.reduce((a, b) => a + b, 0);
  const calc = keys.reduce((acc, k, i) => acc + sub[k] * w[i], 0) / wsum;
  wrap.append(kv(UI.lblWeightedSum, `${calc.toFixed(3)}  →  기록값 ${rec.cultural.v}`));

  return wrap;
}

// 축별 자리수. 규범축은 0–1이라 소수 두 자리, X·Y는 0–10이라 한 자리.
function decimalsFor(axisData) {
  return axisData.scale[1] <= 1 ? 2 : 1;
}

const FIXED_RATIO = 0.05; // 척도의 5% 미만 이동은 '거의 고정'으로 본다

// 궤적의 축별 변화량. "어느 축이 움직였고 어느 축이 고정인가"가 핵심 정보다 — 명세 13.3절.
function deltaSection(recs) {
  if (!recs || recs.length < 2) return null;

  const first = recs[0];
  const last = recs[recs.length - 1];

  const wrap = el('section');
  wrap.append(el('h3', null, UI.secDelta));
  wrap.append(kv('연도', `${first.year} → ${last.year}`));

  for (const axis of AXES) {
    const a = first[axis.key];
    const b = last[axis.key];
    const d = decimalsFor(a);
    const diff = b.v - a.v;
    const span = a.scale[1] - a.scale[0];
    const ratio = diff / span;

    const item = el('div', 'delta-item');
    item.style.borderLeftColor = axis.color;

    const head = el('div', 'delta-head');
    head.append(el('span', 'delta-name', axis.name));
    head.append(el('span', 'delta-move', `${a.v.toFixed(d)} → ${b.v.toFixed(d)}`));

    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
    const amount = el('span', 'delta-amount', `${sign}${Math.abs(diff).toFixed(d)}`);
    if (Math.abs(ratio) < FIXED_RATIO) amount.classList.add('delta-flat');
    head.append(amount);

    if (Math.abs(ratio) < FIXED_RATIO) head.append(el('span', 'delta-tag', UI.deltaFixed));
    item.append(head);

    item.append(el('p', 'delta-ratio',
      `${UI.deltaOfScale} ${sign}${(Math.abs(ratio) * 100).toFixed(0)}%`));

    // 규범축은 구간이 갈리는지가 raw 변화량보다 중요하다
    if (axis.key === 'norms') {
      const from = bandOf(a.v);
      const to = bandOf(b.v);
      if (from !== to) {
        const row = kv(UI.deltaBandMove,
          `${NORMS_BANDS.meta[from].label} → ${NORMS_BANDS.meta[to].label}`);
        row.querySelector('.kv-v').style.color = NORMS_BANDS.meta[to].color;
        row.querySelector('.kv-v').style.fontWeight = '700';
        item.append(row);
      }
    }
    wrap.append(item);
  }

  // 중간 연도가 있으면 구간별로도 보여 준다
  if (recs.length > 2) {
    const segs = el('div', 'delta-segs');
    for (let i = 0; i < recs.length - 1; i++) {
      const p = recs[i];
      const q = recs[i + 1];
      segs.append(kv(`${p.year} → ${q.year}`,
        AXES.map((ax) => {
          const dd = decimalsFor(p[ax.key]);
          const v = q[ax.key].v - p[ax.key].v;
          return `${ax.name} ${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dd)}`;
        }).join(' · ')));
    }
    wrap.append(segs);
  }

  wrap.append(el('p', 'layer-note', UI.deltaScaleCaveat));
  return wrap;
}

function tagSection(rec) {
  const wrap = el('section');
  wrap.append(el('h3', null, UI.secTags));
  wrap.append(kv(UI.lblFamily, labelOf('family', rec.family)));
  wrap.append(kv(UI.lblAffiliation, rec.intl_affiliation ?? '—'));
  wrap.append(kv(UI.lblPopulism, labelOf('populism_tag', rec.populism_tag)));
  wrap.append(kv(UI.lblForeign, labelOf('foreign_tag', rec.foreign_tag)));
  wrap.append(el('p', 'layer-note', UI.populismLayerNote));
  return wrap;
}

function orgSection(rec) {
  const o = rec.org;
  if (!o) return null;
  const wrap = el('section');
  wrap.append(el('h3', null, UI.secOrg));
  wrap.append(kv(UI.lblInstitutionalization, labelOf('level', o.institutionalization)));
  wrap.append(kv(UI.lblPersonalization, labelOf('level', o.personalization)));
  wrap.append(kv(UI.lblOrgType, labelOf('org_type', o.type)));
  if (o.note) wrap.append(kv(UI.lblNote, o.note, 'note'));
  wrap.append(el('p', 'layer-note', UI.orgLayerNote));
  return wrap;
}

export function createPanel(host, { onClose, trajectoryOf } = {}) {
  function clear() {
    host.textContent = '';
    host.classList.remove('open');
    const empty = el('p', 'panel-empty', UI.panelEmpty);
    const hint = el('p', 'panel-empty', UI.panelHint);
    host.append(empty, hint);
  }

  function show(rec) {
    host.textContent = '';
    host.classList.add('open');

    const close = el('button', 'panel-close', '×');
    close.title = UI.panelClose;
    close.addEventListener('click', () => onClose?.());
    host.append(close);

    const head = el('header', 'panel-head');
    head.append(el('h2', null, rec.name_ko));
    head.append(el('p', 'name-local', rec.name_local));
    head.append(el('p', 'meta-line', `${labelOf('country', rec.country)} · ${rec.year} · ${rec.id}`));
    host.append(head);

    // 궤적 변화량을 축 상세보다 먼저 둔다. 궤적이 있는 정당에서는 이것이
    // 가장 중요한 정보이고, 패널이 길어 아래로 밀리면 읽히지 않는다.
    const delta = deltaSection(trajectoryOf?.(rec.party_key));
    if (delta) host.append(delta);

    host.append(axisSection(rec));
    const sub = subSection(rec);
    if (sub) host.append(sub);
    host.append(tagSection(rec));
    const org = orgSection(rec);
    if (org) host.append(org);

    host.scrollTop = 0;
  }

  clear();
  return { show, clear };
}
