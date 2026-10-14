'use strict';
const COURSES_KEY='running-tracker.courses.v1';
let courseCache={},coursesReadable=true,courseRegistry=null,courseBusy=false;
const courseFingerprint=r=>`${r.name}|${r.date.slice(0,4)}|${r.distance}`;
function validCachedCourse(c){return c && typeof c.fingerprint==='string' && typeof c.source==='string' && typeof c.updatedAt==='string' && (c.sourceUrl===undefined || typeof c.sourceUrl==='string' && /^https:\/\//.test(c.sourceUrl)) && Array.isArray(c.points) && c.points.length>=2 && c.points.length<=20000 && c.points.every(p=>Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180&&(p.ele===null||Number.isFinite(p.ele)&&p.ele>=-500&&p.ele<=10000));}
try{const raw=localStorage.getItem(COURSES_KEY);if(raw!==null){const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Object.values(parsed).every(validCachedCourse))throw Error('Invalid cache');courseCache=parsed;}}
catch{coursesReadable=false;$('course-status').textContent='赛道缓存无法读取，已阻止覆盖。请先导出 JSON 备份。';}
function selectedCourseRace(){return races.find(r=>r.id===$('course-race').value);}
function cachedFor(r){if(!r)return null;const c=courseCache[r.id];return c?.fingerprint===courseFingerprint(r)?c:null;}
function saveCourse(r,c){if(!coursesReadable)throw Error('缓存不可读取，禁止覆盖。');const next={...courseCache,[r.id]:c};localStorage.setItem(COURSES_KEY,JSON.stringify(next));courseCache=next;}
function courseOptions(){const old=$('course-race').value;$('course-race').replaceChildren();races.forEach(r=>{const o=textElement('option',`${r.name} · ${r.date.slice(0,4)} · ${r.distance} km`);o.value=r.id;$('course-race').append(o);});if(races.some(r=>r.id===old))$('course-race').value=old;renderCourse();loadOfficialCourse();}
function courseAnalysis(r=selectedCourseRace()){const c=cachedFor(r);return c?CourseCore.analyse(c.points):null;}
function courseMessage(text){$('course-status').textContent=text;}
function table(headers,rows){const t=document.createElement('table');t.className='splits';const head=document.createElement('thead'),hr=document.createElement('tr');headers.forEach(x=>{const th=textElement('th',x);th.scope='col';hr.append(th);});head.append(hr);t.append(head);const body=document.createElement('tbody');rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(x=>tr.append(textElement('td',x)));body.append(tr);});t.append(body);return t;}
function renderCourse(){
 const r=selectedCourseRace(),c=cachedFor(r);$('course-source').replaceChildren();$('course-stats').replaceChildren();$('course-profile').replaceChildren();$('course-km').replaceChildren();$('course-point').textContent='';$('course-cursor').disabled=true;
 const unavailable=r&&courseRegistry?.unavailable?.find(e=>CourseCore.matches(e,r));
 $('course-official').textContent=c?.verifiedOfficial?'已匹配官方赛道':`暂无赛道数据${c?'（官方未核实；可使用已上传赛道）':''}${!courseRegistry?' · 官方索引暂不可用':''}`;
 if(unavailable){$('course-source').append(textElement('p',`${unavailable.reason} 核实尝试日期：${courseRegistry.checkedAt}`));const a=textElement('a','赛事官网（不是已核实路线文件）');a.href=unavailable.eventWebsite;a.target='_blank';a.rel='noopener';$('course-source').append(a);}
 if(!r){$('course-plan').textContent='请先添加比赛。';return;}
 if(!c){renderCoursePlan();return;}
 $('course-source').append(textElement('p',`数据来源：${c.source} · 更新时间：${c.updatedAt} · ${c.verifiedOfficial?'官方文件':'用户提供，年份/方向/真实性未核实'}`,'muted'));
 if(c.source.includes('Open Topo Data')){const api=textElement('a','Open Topo Data 数据与限制说明');api.href='https://www.opentopodata.org/';api.target='_blank';api.rel='noopener';$('course-source').append(api);}
 if(c.sourceUrl){const a=textElement('a','路线数据来源');a.href=c.sourceUrl;a.target='_blank';a.rel='noopener';$('course-source').append(a);}
 let analysis;try{analysis=courseAnalysis(r);}catch(e){courseMessage(e.message);return;}
 $('course-stats').append(textElement('p',`轨迹长度 ${analysis.total.toFixed(3)} km · 比赛标称 ${r.distance} km${Math.abs(analysis.total-r.distance)/r.distance>.1?' · 距离差异超过 10%，坡度策略已禁用':''}`));
 if(!analysis.complete){$('course-stats').append(textElement('p','文件高程缺失或不完整，不能计算完整爬升、坡度或剖面。可主动请求公开 API 补充。'));renderCoursePlan();return;}
 const s=analysis.stats;$('course-stats').append(textElement('p',`估算爬升 ${Math.round(s.up)} m · 下降 ${Math.round(s.down)} m · 最高 ${Math.round(s.max)} m · 最低 ${Math.round(s.min)} m`));
 $('course-stats').append(textElement('p','按 100 m 重采样、三点中值平滑、3 m 转折阈值过滤噪声。小坡可能被忽略；GPS、高程基准及 DEM 精度会影响结果。最高/最低为平滑后估算值。','muted'));
 const width=600,height=200,pad=24,range=Math.max(1,s.max-s.min),pts=analysis.samples.map(p=>`${pad+p.km/analysis.total*(width-pad*2)},${height-pad-(p.ele-s.min)/range*(height-pad*2)}`).join(' ');
 $('course-profile').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="按距离绘制的估算海拔剖面"><polyline points="${pts}" fill="none" stroke="#38542c" stroke-width="3"/><text x="24" y="18" font-size="12">${Math.round(s.max)} m</text><text x="24" y="195" font-size="12">0 km → ${analysis.total.toFixed(2)} km · 最低 ${Math.round(s.min)} m</text></svg>`;
 const slider=$('course-cursor');slider.disabled=false;slider.max=analysis.total;slider.value=Math.min(Number(slider.value),analysis.total);showCoursePoint();
 $('course-profile').onpointerdown=e=>{const box=$('course-profile').getBoundingClientRect();slider.value=Math.max(0,Math.min(analysis.total,(e.clientX-box.left)/box.width*analysis.total));showCoursePoint();};
 $('course-km').append(table(['距离（轨迹 km）','海拔变化 / 坡度'],analysis.segments.map(x=>[`${x.start.toFixed(2)}–${x.end.toFixed(2)}`,`${x.delta.toFixed(1)} m / ${x.grade.toFixed(2)}%`])));
 renderCoursePlan();
}
function showCoursePoint(){const a=courseAnalysis();if(!a?.complete)return;const p=CourseCore.at(a.samples,Number($('course-cursor').value));$('course-point').textContent=`轨迹 ${p.km.toFixed(2)} km · 估算海拔 ${p.ele.toFixed(1)} m`;}
function courseParams(){const coefficient=Number($('course-coefficient').value),amplitude=Number($('course-negative').value);if($('course-coefficient').value===''||$('course-negative').value==='')throw Error('请填写策略参数。');return {coefficient,amplitude};}
function renderCoursePlan(){const out=$('course-plan');out.replaceChildren();const r=selectedCourseRace();if(!r)return;if(!validTime(r.goal)){out.append(textElement('p','请先在比赛管理中设置目标成绩。'));return;}try{const {coefficient,amplitude}=courseParams(),plan=CourseCore.schedule(courseAnalysis(r),r.distance,r.goal,$('course-mode').value,coefficient,amplitude),positions=[];for(let km=1;km<r.distance;km++)positions.push(km);positions.push(r.distance/2,r.distance);out.append(textElement('p',`目标 ${clockTime(r.goal)} · 平均 ${pace(r.distance,r.goal)} /km · 每公里/每5公里/半程/终点（估算）`));let previous=0;out.append(table(['位置','目标累计','区间配速'],[...new Set(positions)].sort((a,b)=>a-b).map(km=>{const row=[`${km} km${km===r.distance?' · 终点':km===r.distance/2?' · 半程':km%5===0?' · 5公里分段':''}`,clockTime(plan.cumulative(km)),`${pace(km-previous,plan.cumulative(km)-plan.cumulative(previous))} /km`];previous=km;return row;})));}catch(e){out.append(textElement('p',e.message,'error'));}}
$('course-file').onchange=async()=>{const file=$('course-file').files[0],r=selectedCourseRace();if(!file)return;if(!r){courseMessage('请先选择比赛。');return;}try{if(file.size>10*1024*1024)throw Error('文件超过 10 MB。');const points=CourseCore.parse(await file.text(),file.name.split('.').at(-1).toLowerCase());CourseCore.analyse(points);saveCourse(r,{fingerprint:courseFingerprint(r),points,source:`用户上传 ${file.name}`,updatedAt:new Date().toISOString(),verifiedOfficial:false});courseMessage('已解析并缓存用户赛道，可离线读取。请核对年份、方向和长度。');renderCourse();}catch(e){courseMessage(`导入失败：${e.message}。已有缓存未更改。`);}finally{$('course-file').value='';}};
$('course-enrich').onclick=async()=>{
 if(courseBusy)return;const r=selectedCourseRace(),c=cachedFor(r);if(!c){courseMessage('请先上传路线坐标。');return;}
 let a;try{a=courseAnalysis(r);}catch(e){courseMessage(e.message);return;}if(a.complete){courseMessage('高程已完整，不需要补充。');return;}
 courseBusy=true;$('course-enrich').disabled=true;
 try{const raw=CourseCore.profile(c.points),total=a.total,n=Math.min(499,Math.max(1,Math.ceil(total/.1))),sample=Array.from({length:n+1},(_,i)=>CourseCore.at(raw,total*i/n));
  for(let start=0;start<sample.length;start+=100){if(start)await new Promise(resolve=>setTimeout(resolve,1100));const batch=sample.slice(start,start+100);courseMessage(`正在获取高程 ${start+1}–${start+batch.length} / ${sample.length}…`);const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${encodeURIComponent(batch.map(p=>`${p.lat},${p.lon}`).join('|'))}`,{signal:controller.signal,mode:'cors',credentials:'omit'});}finally{clearTimeout(timeout);}if(!response.ok)throw Error(`API HTTP ${response.status}`);const data=await response.json();if(data.status!=='OK'||!Array.isArray(data.results)||data.results.length!==batch.length)throw Error('API 返回不完整');data.results.forEach((x,i)=>{if(!Number.isFinite(x.elevation)||x.elevation< -500||x.elevation>10000)throw Error('API 高程不可用');if(batch[i].ele===null)batch[i].ele=x.elevation;});}
  const points=sample.map(({lat,lon,ele})=>({lat,lon,ele}));if(courseCache[r.id]!==c)throw Error('请求期间已导入新的赛道，取消覆盖');saveCourse(r,{...c,points,source:`${c.source} + Open Topo Data SRTM90m（约90m DEM，缺失点补充估算）`,updatedAt:new Date().toISOString()});courseMessage('高程已补充并缓存。API 高程属于估算，不是赛事官方实测。');renderCourse();
 }catch(e){courseMessage(`高程补充失败（网络、CORS、限额或数据覆盖）：${e.message}。保留原缓存，不生成替代高程。`);}finally{courseBusy=false;$('course-enrich').disabled=false;}
};
$('course-race').onchange=()=>{renderCourse();loadOfficialCourse();};$('course-cursor').oninput=showCoursePoint;['course-mode','course-coefficient','course-negative'].forEach(id=>$(id).addEventListener('input',renderCoursePlan));
function prepareCourseSession(r){const a=courseAnalysis(r),{coefficient}=courseParams();const plan=CourseCore.schedule(a,r.distance,r.goal,'grade',coefficient);return {coursePlan:plan.sections,courseContext:{source:cachedFor(r).source,segments:a.segments.map(s=>({start:s.start/a.total*r.distance,end:s.end/a.total*r.distance,grade:s.grade})),distanceScaled:true}};}
function renderRMTerrain(){const s=raceSession,out=$('rm-terrain');out.replaceChildren();$('rm-actual').disabled=$('rm-actual-form').querySelector('button').disabled=!s || s.status==='ended'||!rmReadable;$('rm-variance').textContent='';if(!s)return;
 const segments=s.courseContext?.segments || (()=>{const a=courseAnalysis(s.race);return a?.complete && Math.abs(a.total-s.race.distance)/s.race.distance<=.1?a.segments.map(x=>({...x,start:x.start/a.total*s.race.distance,end:x.end/a.total*s.race.distance})):[];})();
 const current=segments.find(x=>s.progress>=x.start&&s.progress<x.end),next=segments.find(x=>x.start>s.progress&&Math.abs(x.grade)>=.5);
 out.append(textElement('p',current?`手动位置对应坡段 ${current.start.toFixed(2)}–${current.end.toFixed(2)} km · ${current.grade.toFixed(2)}%（估算）`:'当前坡段：暂无可靠高程数据或已到终点。'));out.append(textElement('p',next?`下一段${next.grade>0?'上坡':'下坡'}：${next.start.toFixed(2)} km · ${next.grade.toFixed(2)}%`:'暂无下一段明显上/下坡。'));
 if(s.actualSeconds!==undefined){const difference=Math.round(s.actualSeconds-rmTargetTime(s.progress));$('rm-variance').textContent=`手动实际 ${clockTime(s.actualSeconds)} · 计划 ${clockTime(rmTargetTime(s.progress))} · ${difference>=0?'落后':'领先'} ${clockTime(Math.abs(difference))}`;$('rm-actual').value=clockTime(s.actualSeconds);}
}
$('rm-actual-form').onsubmit=e=>{e.preventDefault();if(!raceSession||raceSession.status==='ended')return;const value=$('rm-actual').value.trim(),t=/^\d{2,3}:[0-5]\d:[0-5]\d$/.test(value)?(/^0{2,3}:00:00$/.test(value)?0:timeSeconds(value)):null;if(t===null || !Number.isInteger(t) || t<0 || t>3599999){$('rm-error').textContent='实际累计时间请输入有效 HH:MM:SS，分钟和秒为 00–59。';return;}saveSession({...raceSession,actualSeconds:t});};
document.addEventListener('race-mode-updated',renderRMTerrain);document.addEventListener('races-updated',courseOptions);courseOptions();renderRMTerrain();
(async()=>{try{const response=await fetch('data/courses.json');if(!response.ok)throw Error('index');courseRegistry=await response.json();if(!Array.isArray(courseRegistry.courses))throw Error('index');renderCourse();loadOfficialCourse();}catch{courseRegistry=null;renderCourse();}})();

let officialLoading = new Set();
async function loadOfficialCourse() {
  const r=selectedCourseRace();if(!r||!courseRegistry||cachedFor(r))return;
  const entry=courseRegistry.courses.find(e=>CourseCore.matches(e,r));if(!entry)return;
  const fingerprint=courseFingerprint(r);if(officialLoading.has(fingerprint))return;
  officialLoading.add(fingerprint);
  try {
    if(!/^data\/[a-zA-Z0-9_-]+\.json$/.test(entry.file)||!/^https:\/\//.test(entry.sourceUrl)||!/^[a-f0-9]{64}$/i.test(entry.sha256))throw Error('官方文件元数据不完整');
    const response=await fetch(entry.file);if(!response.ok)throw Error('官方静态文件不可用');
    const text=await response.text(),bytes=new TextEncoder().encode(text);
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==entry.sha256.toLowerCase())throw Error('官方静态文件校验失败');
    const payload=JSON.parse(text),c={fingerprint,points:payload.points,source:'已核实官方静态赛道',sourceUrl:entry.sourceUrl,updatedAt:entry.updatedAt,verifiedOfficial:true};
    if(!validCachedCourse(c))throw Error('官方文件格式无效');CourseCore.analyse(c.points);if(cachedFor(r))return;saveCourse(r,c);renderCourse();
  }catch(e){courseMessage(`官方赛道加载失败：${e.message}。仍可上传文件或读取已有缓存。`);}
  finally{officialLoading.delete(fingerprint);}
}
