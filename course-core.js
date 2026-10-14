'use strict';
// Geographic distances in km, elevations in metres. No external dependencies.
const CourseCore = (() => {
  const fail = message => { throw Error(message); };
  const finite = Number.isFinite;
  function point(lat, lon, ele) {
    if (!finite(lat) || !finite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) fail('坐标无效。');
    if (ele !== null && (!finite(ele) || ele < -500 || ele > 10000)) fail('高程无效。');
    return {lat,lon,ele};
  }
  function distance(a,b) {
    const rad=Math.PI/180, x=(b.lat-a.lat)*rad,y=(b.lon-a.lon)*rad;
    const h=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;
    return 6371.0088*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }
  const children = (node,name) => [...node.getElementsByTagName('*')].filter(x=>x.localName===name);
  const first = (node,name) => children(node,name)[0];
  function numeric(text, missing=false) { if (text===undefined || text===null || text.trim()==='') { if(missing)return null;fail('文件缺少必要数值。'); } const value=Number(text);if(!finite(value))fail('文件包含非数字数值。');return value; }
  function parse(xml,extension) {
    if (xml.length>10*1024*1024) fail('文件超过 10 MB。');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('不支持包含外部实体或 DTD 的文件。');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if (doc.getElementsByTagName('parsererror').length) fail('XML 文件损坏。');
    const root=doc.documentElement;let points=[];
    if (extension==='gpx' && root.localName==='gpx') {
      const groups=children(root,'trkseg');
      if(groups.length>1)fail('存在多段轨迹，请先导出单条连续赛道，避免连接不连续路线。');
      let nodes=children(root,'trkpt');if(!nodes.length)nodes=children(root,'rtept');
      if(children(root,'rte').length>1 || children(root,'trk').length>1)fail('存在多条路线，请选择单条赛道文件。');
      points=nodes.map(n=>point(numeric(n.getAttribute('lat')),numeric(n.getAttribute('lon')),numeric(first(n,'ele')?.textContent,true)));
    } else if(extension==='kml' && root.localName==='kml') {
      const lines=children(root,'LineString');if(lines.length!==1)fail('KML 必须包含一条 LineString 赛道。');
      const mode=first(lines[0],'altitudeMode')?.textContent;
      points=(first(lines[0],'coordinates')?.textContent||'').trim().split(/\s+/).filter(Boolean).map(t=>{const p=t.split(',');return point(numeric(p[1]),numeric(p[0]),mode==='absolute'?numeric(p[2],true):null);});
    } else if(extension==='tcx' && root.localName==='TrainingCenterDatabase') {
      const tracks=children(root,'Track');if(tracks.length!==1)fail('TCX 必须包含一条连续 Track。');
      points=children(tracks[0],'Trackpoint').filter(n=>first(n,'Position')).map(n=>point(numeric(first(n,'LatitudeDegrees')?.textContent),numeric(first(n,'LongitudeDegrees')?.textContent),numeric(first(n,'AltitudeMeters')?.textContent,true)));
    } else fail('文件类型与内容不匹配，仅支持 GPX、KML、TCX。');
    if(points.length<2 || points.length>20000)fail('需要 2–20000 个有效路线点。');
    const clean=[points[0]];for(let i=1;i<points.length;i++){const gap=distance(clean.at(-1),points[i]);if(gap>2)fail('相邻点间隔超过 2 km，请检查轨迹断点或坐标。');if(gap>.000001)clean.push(points[i]);}
    if(clean.length<2)fail('路线没有有效距离。');return clean;
  }
  function profile(points) {
    let km=0;return points.map((p,i)=>{if(i)km+=distance(points[i-1],p);return {...p,km};});
  }
  function at(raw,km) {
    let lo=0,hi=raw.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(raw[mid].km<km)lo=mid+1;else hi=mid;}
    const b=raw[lo],a=raw[Math.max(0,lo-1)],f=b.km===a.km?0:(km-a.km)/(b.km-a.km);
    return {km,lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f,ele:a.ele===null || b.ele===null ? (km===b.km?b.ele:null) : a.ele+(b.ele-a.ele)*f};
  }
  function analyse(points) {
    const raw=profile(points),total=raw.at(-1).km;if(total<.01 || total>150)fail('路线长度须在 0.01–150 km 之间。');
    const samples=[];for(let km=0;km<total;km+=.1)samples.push(at(raw,km));samples.push(at(raw,total));
    const complete=points.every(p=>p.ele!==null) && samples.every(p=>p.ele!==null);
    if(!complete)return {total,samples,complete:false,segments:[],stats:null};
    // Equal-distance sampling avoids point density bias; 3-point median suppresses spikes.
    const smooth=samples.map((p,i)=>({...p,ele:i===0 || i===samples.length-1?p.ele:[samples[i-1].ele,p.ele,samples[i+1].ele].sort((a,b)=>a-b)[1]}));
    // 3 m turning-point hysteresis: sub-threshold fluctuations are not accumulated.
    let anchor=smooth[0].ele,extreme=anchor,direction=0,up=0,down=0;
    for(const p of smooth.slice(1)) {const z=p.ele;
      if(direction===0){if(Math.abs(z-anchor)>=3){direction=z>anchor?1:-1;extreme=z;}}
      else if(direction===1){if(z>extreme)extreme=z;else if(extreme-z>=3){up+=extreme-anchor;anchor=extreme;extreme=z;direction=-1;}}
      else {if(z<extreme)extreme=z;else if(z-extreme>=3){down+=anchor-extreme;anchor=extreme;extreme=z;direction=1;}}
    }
    if(direction===1)up+=extreme-anchor;else if(direction===-1)down+=anchor-extreme;
    const segments=[];for(let start=0;start<total;start+=1){const end=Math.min(total,start+1),delta=at(smooth,end).ele-at(smooth,start).ele;segments.push({start,end,delta,grade:delta/((end-start)*1000)*100});}
    return {total,samples:smooth,complete:true,segments,stats:{up,down,min:Math.min(...smooth.map(p=>p.ele)),max:Math.max(...smooth.map(p=>p.ele))}};
  }
  function schedule(analysis,distanceKm,goal,mode,coefficient,amplitude=3) {
    if(!finite(goal)||goal<=0||!finite(distanceKm)||distanceKm<=0)fail('目标成绩无效。');
    if(!['even','negative','grade'].includes(mode)||!finite(coefficient)||coefficient<0||coefficient>20||!finite(amplitude)||amplitude<0||amplitude>20)fail('策略参数无效。');
    if(mode==='grade' && (!analysis?.complete || Math.abs(analysis.total-distanceKm)/distanceKm>.1))fail('需要完整高程且路线长度与比赛距离相差不超过 10%。');
    let sections=[];
    if(mode==='grade')sections=analysis.segments.map(s=>({start:s.start/analysis.total*distanceKm,end:s.end/analysis.total*distanceKm,weight:Math.max(.5,Math.min(3,1+coefficient*s.grade/100))}));
    else if(mode==='negative')sections=[{start:0,end:distanceKm/2,weight:1+amplitude/100},{start:distanceKm/2,end:distanceKm,weight:1-amplitude/100}];
    else sections=[{start:0,end:distanceKm,weight:1}];
    const weighted=sections.reduce((t,s)=>t+(s.end-s.start)*s.weight,0);let seconds=0;
    sections=sections.map(s=>{const duration=goal*(s.end-s.start)*s.weight/weighted;const out={...s,seconds,duration};seconds+=duration;return out;});
    const cumulative=km=>{if(km>=distanceKm)return goal;if(km<=0)return 0;const s=sections.find(s=>km<=s.end);return s.seconds+s.duration*(km-s.start)/(s.end-s.start);};
    return {sections,cumulative};
  }
  function matches(entry,race) {
    const year=Number(race.date.slice(0,4)), namedYears=race.name.match(/20\d{2}/g)||[];
    if(namedYears.some(y=>Number(y)!==year))return false;
    const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/20\d{2}/g,'').replace(/[^\p{L}\p{N}]/gu,'');
    return entry.year===year && entry.distance===race.distance && entry.aliases.some(n=>normalize(n)===normalize(race.name));
  }

  return {parse,profile,at,analyse,schedule,matches,distance};
})();
