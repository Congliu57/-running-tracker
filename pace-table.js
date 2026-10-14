'use strict';
const PLANS_KEY = 'running-tracker.pace-plans.v1';
const PLAN_SPLITS = [5, 10, 15, 20, 21.0975, 25, 30, 35, 40, 42.195];
let pacePlans = [], plansReadable = true;
function validPlan(p) {
  return p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 80 && STANDARD_DISTANCES.includes(p.distance) && validTime(p.duration);
}
try {
  const raw = localStorage.getItem(PLANS_KEY);
  if (raw !== null) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(validPlan) || new Set(data.map(p => p.id)).size !== data.length) throw Error('Invalid plans');
    pacePlans = data;
  }
} catch { plansReadable = false; $('plan-status').textContent = '目标数据无法读取，已阻止覆盖。原有训练、比赛和预测数据不受影响。请先导出备份。'; }
function planInput() {
  const value = $('plan-time').value.trim();
  const duration = /^\d{2,3}:[0-5]\d:[0-5]\d$/.test(value) ? timeSeconds(value) : null;
  return { distance: Number($('plan-distance').value), duration };
}
function renderPacePlan() {
  const { distance, duration } = planInput(), result = $('plan-result'); result.replaceChildren();
  const valid = STANDARD_DISTANCES.includes(distance) && validTime(duration);
  const message = !valid && $('plan-time').value ? '请输入 HH:MM:SS；分钟和秒必须为 00–59，时间须大于零。' : '';
  $('plan-time').setCustomValidity(message); $('plan-time').setAttribute('aria-invalid', message ? 'true' : 'false'); $('plan-error').textContent = message;
  if (!valid) return;
  result.append(textElement('div', `${distance} km · 目标 ${clockTime(duration)} · 平均配速 ${pace(distance, duration)} /km`, 'result-box plan-summary'));
  const table = document.createElement('table'); table.className = 'splits pace-plan-table';
  const caption = textElement('caption', '按匀速计算 · 起跑后的累计用时'); table.append(caption);
  const head = document.createElement('thead'), hr = document.createElement('tr');
  ['公里', '累计通过时间'].forEach(label => { const th = textElement('th', label); th.scope = 'col'; hr.append(th); }); head.append(hr); table.append(head);
  const body = document.createElement('tbody');
  // Calculate each split from unrounded total seconds; round only for display.
  PLAN_SPLITS.filter(km => km <= distance).forEach(km => {
    const row = document.createElement('tr');
    if (km === distance) row.className = 'finish-row';
    row.append(textElement('td', `${km} km${km === distance ? ' · 终点' : ''}`), textElement('td', clockTime(duration * km / distance))); body.append(row);
  }); table.append(body); result.append(table);
}
function savePacePlans(next) {
  if (!plansReadable) return false;
  try { localStorage.setItem(PLANS_KEY, JSON.stringify(next)); pacePlans = next; return true; }
  catch { $('plan-status').textContent = '保存失败：存储不可用或空间不足。已有数据未更改。'; return false; }
}
function renderSavedPlans() {
  const list = $('saved-plans'); list.replaceChildren();
  if (!pacePlans.length) list.append(textElement('p', '暂无已保存目标。填写时间后点击保存。', 'muted'));
  pacePlans.forEach(p => {
    const card = textElement('article', '', 'race-card'), info = document.createElement('div');
    info.append(textElement('h3', p.name || `${p.distance} km 目标`), textElement('p', `${p.distance} km · ${clockTime(p.duration)} · ${pace(p.distance, p.duration)} /km`));
    const actions = textElement('div', '', 'actions'), view = textElement('button', '查看'), remove = textElement('button', '删除', 'delete');
    view.type = remove.type = 'button'; view.setAttribute('aria-label', `查看目标 ${p.name || clockTime(p.duration)}`);
    view.onclick = () => { $('plan-distance').value = p.distance; $('plan-time').value = clockTime(p.duration); $('plan-name').value = p.name; renderPacePlan(); $('plan-result').scrollIntoView({block:'start'}); };
    remove.onclick = () => { if (confirm('确定删除这组配速目标？训练和比赛数据不会删除。') && savePacePlans(pacePlans.filter(x => x.id !== p.id))) { renderSavedPlans(); $('plan-status').textContent = '已删除这组目标。'; } };
    actions.append(view, remove); card.append(info, actions); list.append(card);
  });
}
$('pace-plan-form').addEventListener('input', renderPacePlan);
$('plan-distance').addEventListener('change', renderPacePlan);
$('pace-plan-form').addEventListener('submit', event => {
  event.preventDefault(); renderPacePlan(); const p = planInput();
  if (!STANDARD_DISTANCES.includes(p.distance) || !validTime(p.duration)) return;
  const next = { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: $('plan-name').value.trim() };
  if (next.name.length > 80) return;
  if (savePacePlans([...pacePlans, next])) { renderSavedPlans(); $('plan-status').textContent = '已保存目标。修改输入后可保存另一组，不会覆盖原目标。'; }
});
renderPacePlan(); renderSavedPlans();
