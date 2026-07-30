// CHES 트렌드 파일에서 lrecon·galtan을 추출해 parties.json의 econ·cultural을 교체한다.
//
// 사용:  node scripts/apply-ches.mjs           (드라이런 — 차이표만 출력)
//        node scripts/apply-ches.mjs --write   (parties.json 갱신)
//
// 규범축(norms)은 건드리지 않는다 — V-Party 확보 전까지 추정치로 남는다.
// 한국 레코드도 건드리지 않는다 — CHES에 없다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = path.join(root, 'data/raw/1999-2024_CHES_dataset_meansV2.csv');
const CROSSWALK = path.join(root, 'data/crosswalk.json');
const PARTIES = path.join(root, 'data/parties.json');

const WRITE = process.argv.includes('--write');

// 반올림 자리수. 원값은 전문가 평균이라 소수 7자리까지 나오지만 0–10 척도에서
// 두 자리면 충분하고, 원값은 src의 (year, party_id)로 재확인 가능하다.
const DECIMALS = 2;

function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const csv = parseCSV(fs.readFileSync(CSV, 'utf8'));
const h = Object.fromEntries(csv[0].map((c, i) => [c, i]));
for (const col of ['year', 'party_id', 'party', 'lrecon', 'galtan']) {
  if (!(col in h)) throw new Error(`CSV에 ${col} 열이 없다`);
}

// (year, party_id) → 행
const byKey = new Map();
for (const r of csv.slice(1)) {
  byKey.set(`${r[h.year]}:${r[h.party_id]}`, r);
}

const crosswalk = JSON.parse(fs.readFileSync(CROSSWALK, 'utf8'));
const doc = JSON.parse(fs.readFileSync(PARTIES, 'utf8'));
const byId = new Map(doc.parties.map((p) => [p.id, p]));

const round = (s) => Math.round(parseFloat(s) * 10 ** DECIMALS) / 10 ** DECIMALS;

const report = [];
let problems = 0;

for (const entry of crosswalk.records) {
  const rec = byId.get(entry.id);
  if (!rec) { console.error(`✗ parties.json에 ${entry.id}가 없다`); problems++; continue; }

  const row = byKey.get(`${entry.ches.year}:${entry.ches.party_id}`);
  if (!row) { console.error(`✗ CHES에 (${entry.ches.year}, ${entry.ches.party_id}) 행이 없다 — ${entry.id}`); problems++; continue; }

  // 이름 대조 — party_id 오타를 잡는 안전망
  if (row[h.party] !== entry.ches.party) {
    console.error(`✗ ${entry.id}: CHES 행 이름 "${row[h.party]}" ≠ 크로스워크 "${entry.ches.party}"`);
    problems++; continue;
  }

  const lrecon = round(row[h.lrecon]);
  const galtan = round(row[h.galtan]);
  if (!Number.isFinite(lrecon) || !Number.isFinite(galtan)) {
    console.error(`✗ ${entry.id}: 값이 숫자가 아니다 lrecon=${row[h.lrecon]} galtan=${row[h.galtan]}`);
    problems++; continue;
  }

  const wave = entry.ches.year;
  const srcKey = wave === 2019 ? 'CHES2019' : 'CHES2010';
  const rowRef = `${wave} 웨이브, party_id ${entry.ches.party_id} ${entry.ches.party}`;

  report.push({
    id: entry.id,
    econ_seed: rec.econ.v, econ_ches: lrecon, econ_diff: round(String(lrecon - rec.econ.v)),
    cult_seed: rec.cultural.v, cult_ches: galtan, cult_diff: round(String(galtan - rec.cultural.v)),
  });

  if (WRITE) {
    rec.econ.v = lrecon;
    rec.econ.src = `${srcKey}.lrecon (${rowRef})`;
    rec.econ.estimated = false;

    rec.cultural.v = galtan;
    rec.cultural.src = `${srcKey}.galtan (${rowRef})`;
    rec.cultural.estimated = false;
  }
}

// ── 차이표 ──
console.log('\nid                | econ 시드→실측 (차이)      | cultural 시드→실측 (차이)');
console.log('------------------|----------------------------|--------------------------');
for (const r of report) {
  const f = (n) => n.toFixed(2).padStart(6);
  const sign = (n) => (n > 0 ? '+' : '') + n.toFixed(2);
  console.log(
    `${r.id.padEnd(17)} | ${f(r.econ_seed)} → ${f(r.econ_ches)} (${sign(r.econ_diff).padStart(6)}) | ${f(r.cult_seed)} → ${f(r.cult_ches)} (${sign(r.cult_diff).padStart(6)})`,
  );
}
const big = report.filter((r) => Math.abs(r.econ_diff) >= 1.5 || Math.abs(r.cult_diff) >= 1.5);
if (big.length) {
  console.log(`\n⚠ 시드와 1.5 이상 어긋난 레코드 ${big.length}건: ${big.map((r) => r.id).join(', ')}`);
  console.log('  이 레코드들을 근거로 한 문서 서술(검증 사례·note)을 재검토할 것.');
}

if (problems) {
  console.error(`\n✗ 문제 ${problems}건 — 기록하지 않음`);
  process.exit(1);
}

if (WRITE) {
  fs.writeFileSync(PARTIES, JSON.stringify(doc, null, 2) + '\n');
  console.log(`\n✓ parties.json 갱신 완료 — ${report.length}개 레코드의 econ·cultural, estimated:false`);
} else {
  console.log('\n(드라이런 — --write를 붙이면 기록한다)');
}
