import sources from '../data/sources.json';
import { UI } from './config.js';
import { el, kv } from './dom.js';

// 출처 블록 렌더링.
// 출처 표시는 선택 사항이 아니다. 데이터셋 · 판 · 변수명 · 연도 · 척도 범위가
// 모두 나와야 한다 — 명세 13.4절.

// "CHES2019.lrecon" 또는 "OhmyNews.estimate-2026-07 (명세 4.3절)" 형태를 분해한다.
export function resolveSrc(raw) {
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

export function sourceBlock(axisData, year) {
  const s = resolveSrc(axisData.src);
  const box = el('div', 'src-box');

  if (!s.ds) {
    box.append(kv(UI.lblDataset, `${axisData.src} — ${UI.srcUnresolved}`, 'warn'));
    return box;
  }

  // 자체 추정값은 공표된 데이터셋이 아니므로 경고색으로 구분한다
  const selfEstimate = s.ds.kind === 'self_estimate';
  box.append(kv(UI.lblDataset, `${s.ds.name_ko} — ${s.ds.name_full}`, selfEstimate ? 'warn' : ''));
  box.append(kv(UI.lblEdition, s.ds.edition));

  box.append(kv(UI.lblVariable, s.varMeta ? `${s.variable} — ${s.varMeta.name_ko}` : s.variable));
  box.append(kv(UI.lblYear, year));

  if (s.varMeta?.scale) box.append(kv(UI.lblScale, `${s.varMeta.scale[0]} – ${s.varMeta.scale[1]}`));
  if (s.varMeta?.note) box.append(kv(UI.lblNote, s.varMeta.note));
  if (s.extra) box.append(kv('부가', s.extra));
  if (s.ds.coverage) box.append(kv(UI.lblCoverage, s.ds.coverage));
  if (s.ds.citation) box.append(kv(UI.lblCitation, s.ds.citation));
  if (s.ds.caveat) box.append(kv(UI.lblCaveat, s.ds.caveat, 'warn'));

  return box;
}

// PNG 캡션에 넣을 짧은 출처 문자열. 화면 패널과 달리 한 줄로 압축해야 한다.
export function shortSourceList(recs) {
  const keys = new Set();
  for (const rec of recs) {
    for (const ax of ['econ', 'cultural', 'norms']) {
      const s = resolveSrc(rec[ax].src);
      if (s.ds) keys.add(`${s.ds.name_ko} ${s.ds.edition}`);
      else if (s.dsKey) keys.add(s.dsKey);
    }
  }
  return [...keys].sort().join(' · ');
}
