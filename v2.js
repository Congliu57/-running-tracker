'use strict';
// V1 training storage is deliberately unchanged. New features have independent keys.
const RACES_KEY = 'running-tracker.races.v2';
const REFERENCE_KEY = 'running-tracker.reference.v2';
const STANDARD_DISTANCES = [5, 10, 21.0975, 42.195];
let races = [], reference = null, raceEditing = null;
let racesReadable = true, referenceReadable = true;

function timeSeconds(value) {
  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const result = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return result > 0 ? result : null;
}
function clockTime(seconds) {
  const t = Math.round(seconds);
  return [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function validDistance(d) { return Number.isFinite(d) && d >= 0.001 && d <= 1000; }
function validTime(t) { return Number.isInteger(t) && t > 0 && t <= 3599999; }
function validRace(r) {
  return r && typeof r.id === 'string' && typeof r.name === 'string' && r.name.trim().length > 0 && r.name.length <= 100 && typeof r.city === 'string' && r.city.trim().length > 0 && r.city.length <= 100 && parseDate(r.date) && validDistance(r.distance) && (r.goal === null || validTime(r.goal));
}
function validReference(r) { return r && STANDARD_DISTANCES.includes(r.distance) && validTime(r.duration); }
// Convert local calendar components to day numbers; never subtract local timestamps
// (a day spanning daylight-saving time can have 23 or 25 hours).
function calendarDay(value) {
  const [y, m, d] = value.split('-').map(Number);
  const utc = new Date(0);
  utc.setUTCFullYear(y, m - 1, d);
  utc.setUTCHours(0, 0, 0, 0);
  return utc.getTime() / 86400000;
}
function daysUntil(value) { return calendarDay(value) - calendarDay(today()); }
function raceState(r) { const days = daysUntil(r.date); return days < 0 ? '已结束' : days === 0 ? '今天比赛' : `剩余 ${days} 天`; }
function predictionFor(distance) { return reference ? reference.duration * Math.pow(distance / reference.distance, 1.06) : null; }
function textElement(tag, text, className) {
  const el = document.createElement(tag); el.textContent = text;
  if (className) el.className = className;
  return el;
}
function readV2() {
  try {
    const raw = localStorage.getItem(RACES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(validRace) || new Set(parsed.map(r => r.id)).size !== parsed.length) throw Error('Invalid races');
      races = parsed;
    }
  } catch { racesReadable = false; $('race-error').textContent = '无法读取比赛数据，已阻止覆盖。请先导出备份并检查浏览器存储。训练记录不受影响。'; }
  try {
    const raw = localStorage.getItem(REFERENCE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (!validReference(parsed)) throw Error('Invalid reference');
      reference = parsed;
    }
  } catch { referenceReadable = false; $('prediction-error').textContent = '无法读取参考成绩，已阻止覆盖。请先导出备份。'; }
}
function saveRaces(next) {
  if (!racesReadable) return false;
  try { localStorage.setItem(RACES_KEY, JSON.stringify(next)); races = next; $('race-error').textContent = ''; return true; }
  catch { $('race-error').textContent = '比赛保存失败：存储不可用或空间不足，原数据未更改。'; return false; }
}
function raceDetails(r, container) {
  container.append(textElement('p', `${r.date} · ${r.city} · ${r.distance} km`));
  container.append(textElement('p', `自己设定的目标成绩：${r.goal === null ? '未设置' : clockTime(r.goal)}`));
  const predicted = predictionFor(r.distance);
  container.append(textElement('p', predicted === null ? '公式预测参考：请先输入已有比赛成绩' : `公式预测参考：${clockTime(predicted)} · ${pace(r.distance, predicted)} /km（仅供参考）`, 'muted'));
}
function renderRaces() {
  const upcoming = races.filter(r => daysUntil(r.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const next = $('next-race'); next.replaceChildren();
  if (!upcoming.length) next.append(textElement('p', racesReadable ? '还没有待举行的比赛。添加一场比赛，为下一次出发做好准备。' : '比赛数据暂时无法读取，请先检查下方提示。', 'muted'));
  else {
    const r = upcoming[0], wrap = textElement('div', '', 'race-summary'), info = document.createElement('div');
    info.append(textElement('h3', r.name)); raceDetails(r, info);
    wrap.append(info, textElement('span', raceState(r), 'countdown')); next.append(wrap);
  }
  const list = $('race-list'); list.replaceChildren();
  const mode = $('race-filter').value;
  const visible = races.filter(r => mode === 'all' || (mode === 'past' ? daysUntil(r.date) < 0 : daysUntil(r.date) >= 0)).sort((a,b) => mode === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  if (!visible.length) list.append(textElement('p', racesReadable ? '暂无此类比赛。' : '无法读取比赛数据。', 'empty'));
  visible.forEach(r => {
    const card = textElement('article', '', 'race-card'), info = document.createElement('div');
    info.append(textElement('h3', r.name), textElement('span', raceState(r), 'race-state')); raceDetails(r, info);
    const actions = textElement('div', '', 'actions');
    const edit = textElement('button', '编辑'); edit.type = 'button'; edit.setAttribute('aria-label', `编辑比赛 ${r.name}`); edit.onclick = () => editRace(r);
    const remove = textElement('button', '删除', 'delete'); remove.type = 'button'; remove.setAttribute('aria-label', `删除比赛 ${r.name}`);
    remove.onclick = () => { if (confirm(`确定删除比赛“${r.name}”？此操作无法撤销。`) && saveRaces(races.filter(x => x.id !== r.id))) { if (raceEditing === r.id) resetRaceForm(); renderRaces(); } };
    actions.append(edit, remove); card.append(info, actions); list.append(card);
  });
}
function resetRaceForm() { raceEditing = null; $('race-form').reset(); $('race-save').textContent = '添加比赛'; $('race-cancel').hidden = true; }
function editRace(r) {
  raceEditing = r.id; $('race-name').value = r.name; $('race-date').value = r.date; $('race-city').value = r.city; $('race-distance').value = r.distance; $('race-goal').value = r.goal === null ? '' : clockTime(r.goal);
  $('race-save').textContent = '保存比赛修改'; $('race-cancel').hidden = false;
  $('race-form').scrollIntoView({ block: 'start' }); $('race-name').focus({ preventScroll: true });
}
$('race-form').addEventListener('submit', event => {
  event.preventDefault();
  const goalText = $('race-goal').value.trim();
  const r = { id: raceEditing || `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: $('race-name').value.trim(), date: $('race-date').value, city: $('race-city').value.trim(), distance: Number($('race-distance').value), goal: goalText ? timeSeconds(goalText) : null };
  if (!validRace(r) || goalText && r.goal === null) { $('race-error').textContent = '请检查名称、日期、城市、距离和目标成绩格式；时间必须大于 0。'; return; }
  if (saveRaces(raceEditing ? races.map(x => x.id === raceEditing ? r : x) : [...races, r])) { resetRaceForm(); renderRaces(); }
});
$('race-cancel').onclick = resetRaceForm; $('race-filter').onchange = renderRaces;
function renderPrediction() {
  const d = Number($('prediction-distance').value), result = $('prediction-result'); result.replaceChildren();
  if (!reference || !validDistance(d)) return;
  const predicted = predictionFor(d);
  result.append(textElement('div', `公式预测 ${d} km：${clockTime(predicted)} · ${pace(d, predicted)} /km。参考成绩：${reference.distance} km / ${clockTime(reference.duration)}。这不是你设定的目标成绩。`, 'result-box'));
}
function validateReferenceInput() {
  const input = $('reference-time');
  const value = input.value.trim();
  const valid = /^\d{2,3}:[0-5]\d:[0-5]\d$/.test(value) && validTime(timeSeconds(value));
  const message = value && !valid ? '请输入 HH:MM:SS 格式，例如 01:45:30；分钟和秒须为 00–59，成绩须大于 0。' : '';
  input.setCustomValidity(message);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (referenceReadable) $('prediction-error').textContent = message;
  return valid;
}
$('reference-time').addEventListener('input', validateReferenceInput);
$('reference-time').addEventListener('blur', validateReferenceInput);
$('prediction-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!validateReferenceInput()) return;
  const next = { distance: Number($('reference-distance').value), duration: timeSeconds($('reference-time').value) };
  if (!validReference(next) || !validDistance(Number($('prediction-distance').value))) { $('prediction-error').textContent = '请填写有效距离和大于 0 的成绩，格式为 时:分:秒。'; return; }
  if (!referenceReadable) return;
  try { localStorage.setItem(REFERENCE_KEY, JSON.stringify(next)); reference = next; $('prediction-error').textContent = ''; renderPrediction(); renderRaces(); }
  catch { $('prediction-error').textContent = '参考成绩保存失败，原数据未更改。'; }
});
$('prediction-distance').addEventListener('input', renderPrediction);
function renderCalculator() {
  const result = $('calculator-result'); result.replaceChildren();
  const d = Number($('target-distance').value), t = timeSeconds($('target-time').value);
  if (!validDistance(d) || !validTime(t)) { $('calculator-error').textContent = '请输入有效距离和大于 0 的时间，格式为 时:分:秒。'; return; }
  $('calculator-error').textContent = '';
  result.append(textElement('div', `平均目标配速：${pace(d, t)} /km · 目标完赛时间：${clockTime(t)}`, 'result-box'));
  const table = document.createElement('table'); table.className = 'splits';
  const head = document.createElement('thead'), header = document.createElement('tr'); header.append(textElement('th', '通过位置'), textElement('th', '起跑后累计用时')); head.append(header); table.append(head);
  const body = document.createElement('tbody');
  const splits = [{distance:5,label:'5K'}, {distance:10,label:'10K'}, {distance:21.0975,label:'半马'}].filter(s => s.distance < d);
  splits.push({distance:d,label:`终点 · ${d} km`});
  splits.forEach(s => { const row = document.createElement('tr'); row.append(textElement('td', s.label), textElement('td', clockTime(t * s.distance / d))); body.append(row); }); table.append(body); result.append(table);
}
$('calculator-form').addEventListener('submit', event => { event.preventDefault(); renderCalculator(); });
$('calculator-form').addEventListener('input', () => { if ($('calculator-result').childElementCount) renderCalculator(); });
$('export-data').onclick = () => {
  try {
    // Read raw persisted strings so even unreadable JSON can be backed up without loss.
    const rawStorage = Object.fromEntries([STORAGE_KEY, RACES_KEY, REFERENCE_KEY].map(key => [key, localStorage.getItem(key)]));
    const backup = { version: '2.0', exportedAt: new Date().toISOString(), records: storageProblem ? null : records, races: racesReadable ? races : null, reference: referenceReadable ? reference : null, rawStorage };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `running-tracker-${today()}.json`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('export-status').textContent = '已请求下载备份。请确认 JSON 文件已保存在“文件”App 或下载列表中。';
  } catch { $('export-status').textContent = '导出失败，无法访问浏览器存储。请检查浏览器设置，原数据未更改。'; }
};
readV2();
if (reference) { $('reference-distance').value = reference.distance; $('reference-time').value = clockTime(reference.duration); }
renderRaces(); renderPrediction();
let lastLocalDay = today();
function refreshLocalDay() {
  if (lastLocalDay !== today()) { lastLocalDay = today(); $('date').max = today(); if (!editing) $('date').value = today(); render(); }
  renderRaces();
}
setInterval(refreshLocalDay, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshLocalDay(); });
window.addEventListener('pageshow', refreshLocalDay);
