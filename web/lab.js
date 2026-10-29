'use strict';
// All node data is synthetic. There is no network/proxy/subscription work here.
const groups = [
  { name: '英国', flag: '🇬🇧' }, { name: '其他', flag: '🌐' },
  { name: '日本', flag: '🇯🇵' }, { name: '香港', flag: '🇭🇰' },
  { name: '新加坡', flag: '🇸🇬' }, { name: '美国', flag: '🇺🇸' },
  { name: '台湾', flag: '🇹🇼' },
];
const $ = id => document.getElementById(id);
const samples = [];
const visits = new Map();
let busy = false;
let touring = false;
function lockControls(locked) {
  document.querySelectorAll('select,input,#reload,#tour,#regions button').forEach(e => { e.disabled = locked; });
}
let active = -1;
let serial = 0;
const boot = { date: new Date().toISOString(), userAgent: navigator.userAgent, url: location.protocol, viewport: [innerWidth, innerHeight] };
const params = new URLSearchParams(location.search);
for (const id of ['mode', 'count', 'font']) {
  if ([...$(id).options].some(o => o.value === params.get(id))) $(id).value = params.get(id);
}
function guardedEmojiText(text) { return text ? `\u2060${text}\u2060` : ''; }
function emojiText(text, mode) {
  if (mode === 'guard') return guardedEmojiText(text);
  if (mode === 'ascii') return '[*]';
  return text;
}
function span(className, text) {
  const element = document.createElement('span');
  element.className = className;
  // One complete string in one text node; do not split the boundary guards.
  element.textContent = text;
  return element;
}
function applySettings() {
  document.body.dataset.mode = $('mode').value;
  document.body.dataset.font = $('font').value;
  for (const [i, button] of [...$('regions').children].entries()) {
    button.firstChild.textContent = emojiText(groups[i].flag, $('mode').value);
  }
}
for (const [index, group] of groups.entries()) {
  const button = document.createElement('button');
  button.className = 'region';
  button.append(span('emoji', group.flag), span('', group.name));
  button.firstChild.setAttribute('aria-hidden', 'true');
  button.addEventListener('click', () => { void switchGroup(index); });
  $('regions').append(button);
}
function renderGroup(index, count, mode) {
  const group = groups[index];
  const icon = span('emoji', emojiText(group.flag, mode));
  icon.setAttribute('aria-hidden', 'true');
  $('heading').replaceChildren(icon, document.createTextNode(`${group.name} · ${count} 个合成节点`));
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = document.createElement('article');
    card.className = 'card';
    card.title = `${group.name}合成节点-${i + 1}`;
    const top = document.createElement('div');
    top.className = 'card-top';
    const badge = span('badge', '');
    const emoji = span('emoji', emojiText(group.flag, mode));
    emoji.setAttribute('aria-hidden', 'true');
    badge.append(emoji);
    top.append(span('protocol', ['HY2', 'VLESS', 'SS'][i % 3]), badge);
    const footer = document.createElement('small');
    footer.textContent = `TEST NODE ${String(i + 1).padStart(3, '0')}`;
    card.append(top, span('latency', '—'), footer);
    fragment.append(card);
  }
  $('cards').replaceChildren(fragment);
  [...$('regions').children].forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
  active = index;
}
async function switchGroup(index) {
  if (busy) return null;
  busy = true;
  lockControls(true);
  const mode = $('mode').value;
  const font = $('font').value;
  const count = Number($('count').value);
  const key = `${mode}/${font}/${count}/${index}`;
  const visit = (visits.get(key) ?? 0) + 1;
  visits.set(key, visit);
  const id = `emoji-lab:${++serial}`;
  const start = performance.now();
  performance.mark(`${id}:click`);
  renderGroup(index, count, mode);
  const domMs = performance.now() - start;
  performance.mark(`${id}:dom`);
  let geometryMs = null;
  if ($('force').checked) {
    const before = performance.now();
    // Optional diagnostic: this read can force pending style/layout work.
    $('cards').getBoundingClientRect();
    geometryMs = performance.now() - before;
  }
  return new Promise(resolve => requestAnimationFrame(() => {
    const firstRAF = performance.now() - start;
    performance.mark(`${id}:raf1`);
    requestAnimationFrame(() => {
      const secondRAF = performance.now() - start;
      performance.mark(`${id}:raf2`);
      performance.measure(`${id}:click-to-raf2`, `${id}:click`, `${id}:raf2`);
      const sample = { id, index, region: groups[index].name, visit, mode, font, count, domMs, geometryMs, firstRAF, secondRAF, visible: document.visibilityState, focus: document.hasFocus(), fontsStatus: document.fonts.status, viewport: [innerWidth, innerHeight] };
      samples.push(sample);
      console.info('[emoji-lab]', sample);
      const tr = document.createElement('tr');
      const ms = value => value === null ? '未读取' : `${value.toFixed(1)}ms`;
      for (const text of [`${sample.region} / ${visit === 1 ? '首访' : `第${visit}次`}`, mode, ms(domMs), ms(geometryMs), ms(firstRAF), ms(secondRAF)]) {
        const td = document.createElement('td'); td.textContent = text; tr.append(td);
      }
      $('results').prepend(tr);
      $('status').textContent = `${sample.region} · ${visit === 1 ? '首访' : '重复访问'} · 首个 rAF ${ms(firstRAF)} · 第二个 rAF ${ms(secondRAF)}`;
      busy = false;
      lockControls(touring);
      resolve(sample);
    });
  }));
}
for (const id of ['mode', 'count', 'font']) $(id).addEventListener('change', () => {
  if (busy) return;
  applySettings();
  // This is a warm-session change, not a fresh-process comparison.
  if (active >= 0) renderGroup(active, Number($('count').value), $('mode').value);
});
$('tour').addEventListener('click', async () => {
  if (busy || touring) return;
  touring = true;
  lockControls(true);
  try { for (let index = 0; index < groups.length; index++) {
    await switchGroup(index);
    // Between samples only; not included in any timing measurement.
    await new Promise(resolve => setTimeout(resolve, 400));
  } } finally { touring = false; lockControls(false); }
});
$('reload').addEventListener('click', () => {
  const query = new URLSearchParams({ mode: $('mode').value, count: $('count').value, font: $('font').value });
  location.search = query.toString();
});
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ boot, samples }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'emoji-layout-lab.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
applySettings();
// Console entry points for inspection and deterministic, user-triggered experiments.
window.emojiLab = { groups, samples, guardedEmojiText, switchGroup, boot };
console.info('[emoji-lab] ready', boot);
