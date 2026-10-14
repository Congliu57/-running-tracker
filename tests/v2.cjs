const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const URL=(process.env.TEST_URL || 'http://127.0.0.1:8001/-running-tracker/');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Hong_Kong',acceptDownloads:true});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-14T15:59:00Z')});
 await page.goto(URL);
 const legacy=JSON.stringify([{id:'old',date:'2026-10-13',distance:5,duration:1800,heart:145}]);
 await page.evaluate(raw=>localStorage.setItem('running-tracker.records.v1',raw),legacy);await page.reload();
 assert.equal(await page.locator('#total').innerText(),'5 km');
 async function addRace(name,date,goal='04:00:00'){
  await page.fill('#race-name',name);await page.fill('#race-date',date);await page.fill('#race-city','香港');await page.fill('#race-distance','42.195');await page.fill('#race-goal',goal);await page.click('#race-save');
 }
 await addRace('未来比赛','2026-11-01');await addRace('明天比赛','2026-10-15');await addRace('历史比赛','2026-10-12','');
 assert.match(await page.locator('#next-race').innerText(),/明天比赛/);assert.match(await page.locator('#next-race').innerText(),/剩余 1 天/);
 await page.selectOption('#race-filter','past');assert.match(await page.locator('#race-list').innerText(),/已结束/);
 await page.selectOption('#race-filter','all');await page.locator('.race-card').filter({hasText:'未来比赛'}).getByRole('button',{name:'编辑比赛 未来比赛',exact:true}).click();await page.fill('#race-name','新版比赛');await page.click('#race-save');assert.match(await page.locator('#race-list').innerText(),/新版比赛/);
 await page.locator('.race-card').filter({hasText:'新版比赛'}).getByRole('button',{name:'编辑比赛 新版比赛',exact:true}).click();await page.fill('#race-name','不保存');await page.click('#race-cancel');assert.doesNotMatch(await page.locator('#race-list').innerText(),/不保存/);
 page.once('dialog',d=>d.dismiss());await page.locator('.race-card').filter({hasText:'新版比赛'}).locator('.delete').click();assert.equal(await page.locator('.race-card').count(),3);
 page.once('dialog',d=>d.accept());await page.locator('.race-card').filter({hasText:'新版比赛'}).locator('.delete').click();assert.equal(await page.locator('.race-card').count(),2);
 assert.equal(await page.locator('#reference-time').getAttribute('inputmode'),'text');
 await page.fill('#reference-time','01:45:30');await page.locator('#prediction-form button').click();assert.equal(await page.evaluate(()=>reference.duration),6330);
 for (const bad of ['01:60:00','01:00:60','01:5:30','00:00:00','abc']) {await page.fill('#reference-time',bad);assert.equal(await page.locator('#reference-time').evaluate(el=>el.checkValidity()),false);assert.equal(await page.evaluate(()=>reference.duration),6330);}
 await page.fill('#reference-time','00:25:00');await page.fill('#prediction-distance','10');await page.locator('#prediction-form button').click();
 const expected=Math.round(1500*Math.pow(2,1.06));assert.equal(await page.evaluate(()=>Math.round(predictionFor(10))),expected);assert.match(await page.locator('#prediction-result').innerText(),/00:52:07/);assert.match(await page.locator('#next-race').innerText(),/自己设定的目标成绩：04:00:00/);assert.match(await page.locator('#next-race').innerText(),/公式预测参考/);
 for(const d of ['5','10','21.0975','42.195']){await page.selectOption('#reference-distance',d);await page.locator('#prediction-form button').click();assert.equal(await page.evaluate(()=>reference.distance),Number(d));}
 await page.fill('#target-time','04:00:00');await page.locator('#calculator-form button').click();assert.equal(await page.locator('.splits tbody tr').count(),4);assert.match(await page.locator('.splits').innerText(),/00:28:26/);assert.match(await page.locator('.splits').innerText(),/04:00:00/);
 await page.fill('#target-distance','5');assert.equal(await page.locator('.splits tbody tr').count(),1);await page.fill('#target-distance','10');assert.equal(await page.locator('.splits tbody tr').count(),2);await page.fill('#target-distance','21.0975');assert.equal(await page.locator('.splits tbody tr').count(),3);
 await page.fill('#target-time','00:00:00');await page.locator('#calculator-form button').click();assert.match(await page.locator('#calculator-error').innerText(),/大于 0/);
 await page.fill('#reference-time','00:60:00');await page.locator('#prediction-form button').click();assert.match(await page.locator('#prediction-error').innerText(),/格式/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('running-tracker.records.v1')),legacy);
 const downloadPromise=page.waitForEvent('download');await page.click('#export-data');const download=await downloadPromise;const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(backup.version,'2.0');assert.equal(backup.rawStorage['running-tracker.records.v1'],legacy);assert.equal(backup.races.length,2);assert.equal(backup.records[0].id,'old');
 await page.clock.runFor(120000);assert.match(await page.locator('#next-race').innerText(),/今天比赛/);
 await page.clock.runFor(86400000);assert.doesNotMatch(await page.locator('#next-race').innerText(),/明天比赛/);await page.selectOption('#race-filter','past');assert.equal(await page.locator('.race-card').count(),2);
 await page.reload();assert.equal(await page.evaluate(()=>races.length),2);assert.equal(await page.evaluate(()=>reference.distance),42.195);assert.equal(await page.evaluate(()=>localStorage.getItem('running-tracker.records.v1')),legacy);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>localStorage.setItem('running-tracker.races.v2','broken'));await page.reload();assert.match(await page.locator('#race-error').innerText(),/阻止覆盖/);await addRace('测试','2026-12-01');assert.equal(await page.evaluate(()=>localStorage.getItem('running-tracker.races.v2')),'broken');assert.equal(await page.locator('#total').innerText(),'5 km');
 await page.evaluate(()=>localStorage.removeItem('running-tracker.races.v2'));await page.reload();await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');}});await addRace('失败','2026-12-01');assert.match(await page.locator('#race-error').innerText(),/保存失败/);assert.equal(await page.evaluate(()=>races.length),0);
 assert.deepEqual(errors,[]);
 for(const timezoneId of ['America/Los_Angeles','Pacific/Kiritimati','Asia/Hong_Kong']){
  const c=await browser.newContext({timezoneId});const p=await c.newPage();await p.goto(URL);const result=await p.evaluate(()=>({date:today(),days:daysUntil(today()),dst:calendarDay('2026-03-09')-calendarDay('2026-03-08'),leap:calendarDay('2024-03-01')-calendarDay('2024-02-28')}));assert.equal(result.days,0);assert.equal(result.dst,1);assert.equal(result.leap,2);await c.close();
 }
 console.log('PASS V2: old data byte-preserved, races CRUD/history/countdown/midnight, all reference distances/Riegel, pace/splits, JSON download, reload, 320/390px layout, validation, corrupt storage, quota errors, 3 time zones/DST/leap year, subdirectory assets, no JS errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
