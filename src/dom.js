// 패널·조작부가 공유하는 DOM 조립 헬퍼.
// innerHTML을 쓰지 않는 이유: 데이터 문자열에 인용부호·괄호가 섞여 있어 이스케이프
// 실수가 나기 쉽다. textContent만 쓰면 그 문제가 원천적으로 없다.

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

export function kv(key, value, cls) {
  const row = el('div', `kv ${cls ?? ''}`);
  row.append(el('span', 'kv-k', key), el('span', 'kv-v', value));
  return row;
}
