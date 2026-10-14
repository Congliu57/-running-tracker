'use strict';
const RM_KEY = 'running-tracker.race-mode.v1';
let raceSession = null, rmReadable = true, rmTick = null;
function validSession(s) {
  return s && validRace(s.race) && STANDARD_DISTANCES.includes(s.race.distance) && validTime(s.race.goal) && ['running','paused','ended'].includes(s.status) && ['even','negative'].includes(s.strategy) && Number.isFinite(s.amplitude) && s.amplitude >= 0 && s.amplitude <= 20 && Number.isFinite(s.progress) && s.progress >= 0 && s.progress <= s.race.distance && Number.isFinite(s.elapsedMs) && s.elapsedMs >= 0 && (s.status === 'running' ? Number.isFinite(s.startedAt) && s.startedAt > 0 : s.startedAt === null) && Array.isArray(s.supplies) && s.supplies.every(x => x && typeof x.id === 'string' && ['饮水','能量胶','其他'].includes(x.type) && typeof x.note === 'string' && x.note.length <= 80 && Number.isFinite(x.distance) && x.distance > 0 && x.distance <= s.race.distance) && new Set(s.supplies.map(x=>x.id)).size === s.supplies.length;
}
try { const raw = localStorage.getItem(RM_KEY); if (raw !== null) { const s = JSON.parse(raw); if (!validSession(s)) throw Error('Invalid session'); raceSession = s; } }
catch { rmReadable = false; $('rm-error').textContent = '比赛模式数据无法读取，已阻止覆盖。请先导出备份；其他数据不受影响。'; }
function saveSession(next) {
  if (!rmReadable) return false;
  if (!validSession(next)) { $('rm-error').textContent = '比赛状态无效，未保存。'; return false; }
  try { localStorage.setItem(RM_KEY, JSON.stringify(next)); raceSession = next; $('rm-error').textContent = ''; renderRaceMode(); return true; }
  catch { $('rm-error').textContent = '保存失败，原状态未更改。请检查浏览器存储或可用空间。'; return false; }
}
function raceModeLocks(id) { return raceSession && raceSession.status !== 'ended' && raceSession.race.id === id; }
function rmElapsed(s = raceSession) { return s ? s.elapsedMs + (s.status === 'running' ? Math.max(0, Date.now() - s.startedAt) : 0) : 0; }
function rmTargetTime(km, s = raceSession) {
  const {distance, goal} = s.race, a = s.strategy === 'negative' ? s.amplitude / 100 : 0;
  const half = distance / 2, base = goal / distance;
  return km >= distance ? goal : Math.min(km, half) * base * (1 + a) + Math.max(0, km - half) * base * (1 - a);
}
function rmRaceOptions() {
  const select = $('rm-race'), chosen = select.value; select.replaceChildren();
  const supported = races.filter(r=>STANDARD_DISTANCES.includes(r.distance));
  supported.forEach(r=>{const opt = textElement('option', `${r.name} · ${r.date}${r.goal === null ? ' · 未设置目标成绩' : ''}`);opt.value=r.id;select.append(opt);});
  if (!supported.length) { const opt = textElement('option','请先添加 5K / 10K / 半马 / 全马比赛'); opt.value='';select.append(opt); }
  if (supported.some(r=>r.id===chosen)) select.value=chosen;
  rmRaceInfo();
}
function rmRaceInfo() {
  const r = races.find(r=>r.id===$('rm-race').value);
  $('rm-race-info').textContent = r ? `${r.date} · ${r.distance} km · 目标 ${r.goal === null ? '未设置（请在比赛管理中编辑）' : clockTime(r.goal)}` : '暂无可选择的比赛。';
}
function rmTimerDisplay() { if (raceSession && $('rm-elapsed')) $('rm-elapsed').textContent = clockTime(Math.floor(rmElapsed() / 1000)); }
function renderRaceMode() {
  if (rmTick !== null) { clearInterval(rmTick); rmTick = null; }
  if (raceSession?.status === 'running') rmTick = setInterval(rmTimerDisplay, 1000);
  const s=raceSession, active=s && s.status!=='ended';
  $('rm-setup').hidden=!!active; $('rm-start').textContent=s?.status==='paused'?'继续比赛':s?.status==='ended'?'重新开始比赛模式':'开始比赛模式';
  $('rm-start').disabled=!rmReadable || s?.status==='running'; $('rm-pause').disabled=!rmReadable || s?.status!=='running'; $('rm-end').disabled=!rmReadable || !active;
  $('rm-progress').disabled=$('rm-progress-form').querySelector('button').disabled=!rmReadable || !active;
  $('rm-supply-form').querySelectorAll('input,select,button').forEach(el=>el.disabled=!rmReadable || !active);
  const display=$('rm-display');display.replaceChildren();$('rm-splits').replaceChildren();$('rm-supplies').replaceChildren();$('rm-next-supply').textContent='';
  if (!s) { display.append(textElement('p','选择比赛后开始。所有进度均由你手动输入。','muted')); return; }
  display.append(textElement('h3',s.race.name),textElement('p',`${s.race.date} · ${s.race.distance} km · ${s.status==='running'?'进行中':s.status==='paused'?'已暂停':'已结束'}`));
  display.append(textElement('p',`目标 ${clockTime(s.race.goal)} · 平均 ${pace(s.race.distance,s.race.goal)} /km`));
  display.append(textElement('p',s.strategy==='even'?'匀速策略':`负分段 ${s.amplitude}% · 前半 ${pace(s.race.distance,s.race.goal*(1+s.amplitude/100))} /km · 后半 ${pace(s.race.distance,s.race.goal*(1-s.amplitude/100))} /km`));
  const elapsed=textElement('strong','');elapsed.id='rm-elapsed';display.append(textElement('p','参考经过时间（不含暂停）'),elapsed);
  display.append(textElement('p',`${s.progress} km · 已完成 ${(s.progress/s.race.distance*100).toFixed(1)}%`,'rm-progress-value'),textElement('p',`目标累计 ${clockTime(rmTargetTime(s.progress))} · 剩余 ${Number((s.race.distance-s.progress).toFixed(4))} km`));
  const bar=document.createElement('progress');bar.max=s.race.distance;bar.value=s.progress;bar.setAttribute('aria-label','已完成比例');display.append(bar);
  $('rm-progress').value=s.progress;$('rm-progress').max=$('rm-supply-distance').max=s.race.distance;
  const next=[...s.supplies].sort((a,b)=>a.distance-b.distance).find(x=>x.distance>=s.progress);
  $('rm-next-supply').textContent=next?`${next.distance===s.progress?'到达补给位置':'下一次补给'}：${next.distance} km · ${next.type}${next.note?' · '+next.note:''}`:'暂无后续补给提醒。';
  [...s.supplies].sort((a,b)=>a.distance-b.distance).forEach(x=>{const row=textElement('div','', 'race-card');row.append(textElement('p',`${x.distance} km · ${x.type} ${x.note}${x.distance<s.progress?' · 已经过':''}`));const remove=textElement('button','移除提醒');remove.disabled=!active;remove.onclick=()=>saveSession({...s,supplies:s.supplies.filter(y=>y.id!==x.id)});row.append(remove);$('rm-supplies').append(row);});
  const points=[];for(let km=5;km<s.race.distance;km+=5)points.push(km);points.push(s.race.distance/2,s.race.distance);
  const table=document.createElement('table');table.className='splits';const head=document.createElement('thead'),tr=document.createElement('tr');tr.append(textElement('th','公里 / 分段'),textElement('th','目标累计用时'));head.append(tr);table.append(head);const body=document.createElement('tbody');
  [...new Set(points)].sort((a,b)=>a-b).forEach(km=>{const row=document.createElement('tr');row.append(textElement('td',`${km} km${km===s.race.distance?' · 终点':km===s.race.distance/2?' · 半程':''}`),textElement('td',clockTime(rmTargetTime(km))));body.append(row);});table.append(body);$('rm-splits').append(table);rmTimerDisplay();
}
$('rm-race').onchange=rmRaceInfo;
$('rm-start').onclick=()=>{
  if (raceSession?.status==='paused') { saveSession({...raceSession,status:'running',startedAt:Date.now()});return; }
  const race=races.find(r=>r.id===$('rm-race').value),a=Number($('rm-amplitude').value);
  if (!race || !STANDARD_DISTANCES.includes(race.distance) || !validTime(race.goal)) { $('rm-error').textContent='请选择支持的比赛，并先在比赛管理中设置有效目标成绩。';return; }
  if ($('rm-amplitude').value==='' || !Number.isFinite(a) || a<0 || a>20) { $('rm-error').textContent='负分段幅度须为 0–20%。';return; }
  if (raceSession && !confirm('重新开始将替换上一次比赛模式状态；原比赛和跑步记录不会改变。继续？'))return;
  saveSession({race:{...race},status:'running',strategy:$('rm-strategy').value,amplitude:a,progress:0,elapsedMs:0,startedAt:Date.now(),supplies:[]});
};
$('rm-pause').onclick=()=>{if(raceSession?.status==='running')saveSession({...raceSession,status:'paused',elapsedMs:rmElapsed(),startedAt:null});};
$('rm-end').onclick=()=>{if(raceSession && raceSession.status!=='ended' && confirm('确定结束比赛模式？当前进度会保留，训练和比赛数据不会删除。'))saveSession({...raceSession,status:'ended',elapsedMs:rmElapsed(),startedAt:null});};
$('rm-progress-form').onsubmit=e=>{e.preventDefault();const km=Number($('rm-progress').value);if(!raceSession || raceSession.status==='ended')return;if($('rm-progress').value===''||!Number.isFinite(km)||km<0||km>raceSession.race.distance){$('rm-error').textContent='进度须在 0 到终点距离之间。';return;}saveSession({...raceSession,progress:km});};
$('rm-supply-form').onsubmit=e=>{e.preventDefault();if(!raceSession || raceSession.status==='ended')return;const km=Number($('rm-supply-distance').value),note=$('rm-supply-note').value.trim();if(!Number.isFinite(km)||km<=0||km>raceSession.race.distance||note.length>80){$('rm-error').textContent='请填写终点以内的有效补给距离。';return;}if(saveSession({...raceSession,supplies:[...raceSession.supplies,{id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,type:$('rm-supply-type').value,distance:km,note}]})){$('rm-supply-form').reset();}};
$('rm-big').onclick=()=>{const big=$('race-mode').classList.toggle('rm-big');$('rm-big').setAttribute('aria-pressed',String(big));$('rm-big').textContent=big?'退出大字显示':'大字显示';};
document.addEventListener('races-updated',rmRaceOptions);
window.addEventListener('pageshow',rmTimerDisplay);document.addEventListener('visibilitychange',rmTimerDisplay);
rmRaceOptions();renderRaceMode();
