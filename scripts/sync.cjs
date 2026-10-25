const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {SourceError,football,lol,teamLogo,mlb} = require('./parse.cjs');
function seasonAt(now) {
  const year=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);
  return `${year}-${String(year+1).slice(-2)}`;
}
async function request(url, headers, fetcher) {
  const response=await fetcher(url,{headers,signal:AbortSignal.timeout(url.startsWith('https://statsapi.mlb.com/')?60000:30000)});
  if(!response.ok) throw new SourceError('http',`HTTP ${response.status}`);
  return {data:await response.json(),lastModified:response.headers?.get('last-modified')||null};
}
function upcoming(items, now) {
  const londonToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  // Unknown MLB dates lack ballpark timezones; allow a conservative two-day expiry margin.
  return items.filter(m=>!['已结束','取消'].includes(m.status) && (m.start ? Date.parse(m.start)>=now.getTime() : !m.sourceDate || m.sourceDate>=(m.sport==='baseball'?new Date(now.getTime()-48*3600000).toISOString().slice(0,10):londonToday)));
}
async function update(previous, fetcher=fetch, now=new Date()) {
  const result=structuredClone(previous);
  let failures=0;
  let calendarPromise;
  const archiveUrl='https://codeload.github.com/snutij/esport_ics/zip/refs/heads/main';
  for(const sport of ['football','lol','cs2','valorant','baseball']) {
    const old=result.sources[sport]||{name:({cs2:'CS2',valorant:'VALORANT',baseball:'MLB'})[sport],sport,sourceUrl:sport==='baseball'?'https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/mlb_schedules':'https://github.com/snutij/esport_ics',status:'pending',updatedAt:null,matches:[]};
    try {
      let items,sourceUrl,lastModified=null,sourceName,coverageNote=null;
      if(sport==='football') {
        sourceUrl=`https://raw.githubusercontent.com/openfootball/football.json/master/${seasonAt(now)}/en.1.json`;
        const response=await request(sourceUrl,{},fetcher);
        items=football(response.data,sourceUrl);
        lastModified=response.lastModified;
        sourceName='openfootball · 英超（社区数据）';
      } else if(sport==='lol') {
        sourceUrl='https://raw.githubusercontent.com/zlypher/lol-events/main/data/matches.json';
        sourceName='zlypher/lol-events · LPL / Worlds';
        const response=await request(sourceUrl,{},fetcher);
        items=lol(response.data,sourceUrl);
        lastModified=response.data.generatedAt;
      } else if(sport==='baseball') {
        sourceUrl='https://www.mlb.com/schedule';
        sourceName='MLB · 官方赛程';
        const {data:catalog}=await request('https://statsapi.mlb.com/api/v1/seasons/all?sportId=1',{},fetcher);
        if(!Array.isArray(catalog.seasons) || !catalog.seasons.length || catalog.seasons.some(s=>!/^\d{4}$/.test(s.seasonId))) throw new SourceError('structure','Invalid MLB seasons');
        const seasons=[...new Set(catalog.seasons.filter(s=>!s.seasonEndDate || s.seasonEndDate>=now.toISOString().slice(0,10)).map(s=>+s.seasonId))].filter(year=>year>=now.getUTCFullYear()).sort((a,b)=>a-b);
        if(!seasons.length) throw new SourceError('structure','No current MLB season in catalog');
        const fields='totalGames,dates,date,games,gamePk,gameType,season,gameDate,officialDate,status,abstractGameState,detailedState,startTimeTBD,teams,home,away,team,id,name';
        items=[];
        for(const season of seasons) {
          const {data}=await request('https://statsapi.mlb.com/api/v1/schedule?sportId=1&season='+season+'&fields='+fields,{},fetcher);
          items.push(...mlb(data));
        }
        coverageNote='已读取官方已发布赛季：'+seasons.join('、')+'；开赛时间待定的场次不推测时间。';
      } else {
        sourceUrl='https://github.com/snutij/esport_ics';
        sourceName=`esport_ics · ${sport==='cs2'?'CS2':'VALORANT'}`;
        if(!calendarPromise) calendarPromise=(async()=>{
          const response=await fetcher(archiveUrl,{signal:AbortSignal.timeout(60000)});
          if(!response.ok) throw new SourceError('http',`HTTP ${response.status}`);
          const buffer=Buffer.from(await response.arrayBuffer());
          if(buffer.length>20*1024*1024) throw new SourceError('structure','Oversized archive');
          return JSON.parse(execFileSync('python',[path.join(__dirname,'calendars.py'),now.toISOString()],{input:buffer,maxBuffer:20*1024*1024,timeout:30000,windowsHide:true}).toString('utf8'));
        })();
        const calendars=await calendarPromise;
        if(calendars[sport]?.error || !Array.isArray(calendars[sport]?.matches)) throw new SourceError('structure','Calendar parsing failed');
        items=calendars[sport].matches.map(m=>({...m,homeLogo:teamLogo(sport,m.home),awayLogo:teamLogo(sport,m.away)}));
      }
      if(new Set(items.map(m=>m.id)).size!==items.length) throw new SourceError('structure','Duplicate match ID');
      const selected=upcoming(items,now);
      const finished=items.length>0 && items.every(m=>m.status==='已结束');
      result.sources[sport]={...old,name:sourceName,sport,sourceUrl,status:'ok',availability:finished?'offseason':selected.length?'scheduled':'empty',updatedAt:now.toISOString(),lastAttemptAt:now.toISOString(),upstreamLastModified:lastModified,upstreamGeneratedAt:['lol','baseball'].includes(sport)?lastModified:null,coverageNote,error:null,matches:selected};
    } catch(error) {
      failures++;
      result.sources[sport]={...old,sport,status:'error',lastAttemptAt:now.toISOString(),error:error.code||'fetch'};
      console.error(`${sport}: 同步失败（${error.code||'fetch'}），保留上次成功数据。`);
    }
  }
  return {snapshot:result,failures};
}
if(require.main===module) {
  (async()=>{
    const file=path.join(__dirname,'../data/schedule.json');
    const previous=JSON.parse(await fs.readFile(file,'utf8'));
    const {snapshot,failures}=await update(previous);
    const text=JSON.stringify(snapshot,null,2)+'\n';
    if(text!==await fs.readFile(file,'utf8')){await fs.writeFile(file+'.tmp',text);await fs.rename(file+'.tmp',file);}
    if(failures)process.exitCode=1;
  })().catch(()=>{console.error('无法更新赛程文件，未替换已有快照。');process.exitCode=1;});
}
module.exports={football,lol,update,seasonAt,upcoming};
