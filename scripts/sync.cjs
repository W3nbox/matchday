const fs = require('node:fs/promises');
const path = require('node:path');
const {SourceError,football,lol} = require('./parse.cjs');
function seasonAt(now) {
  const year=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);
  return `${year}-${String(year+1).slice(-2)}`;
}
async function request(url, headers, fetcher) {
  const response=await fetcher(url,{headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new SourceError('http',`HTTP ${response.status}`);
  return {data:await response.json(),lastModified:response.headers?.get('last-modified')||null};
}
function upcoming(items, now, end) {
  return items.filter(m=>!['已结束','取消'].includes(m.status) && (m.start ? Date.parse(m.start)>=now.getTime() && Date.parse(m.start)<end.getTime() : !m.sourceDate || m.sourceDate>=now.toISOString().slice(0,10) && m.sourceDate<end.toISOString().slice(0,10)));
}
async function update(previous, fetcher=fetch, now=new Date()) {
  const result=structuredClone(previous),end=new Date(now.getTime()+7*86400000);
  let failures=0;
  for(const sport of ['football','lol']) {
    const old=result.sources[sport];
    try {
      let items,sourceUrl,lastModified=null,sourceName;
      if(sport==='football') {
        sourceUrl=`https://raw.githubusercontent.com/openfootball/football.json/master/${seasonAt(now)}/en.1.json`;
        const response=await request(sourceUrl,{},fetcher);
        items=football(response.data,sourceUrl);
        lastModified=response.lastModified;
        sourceName='openfootball · 英超（社区数据）';
      } else {
        sourceUrl='https://raw.githubusercontent.com/zlypher/lol-events/main/data/matches.json';
        sourceName='zlypher/lol-events · LPL / Worlds';
        const response=await request(sourceUrl,{},fetcher);
        items=lol(response.data,sourceUrl);
        lastModified=response.data.generatedAt;

      }
      if(new Set(items.map(m=>m.id)).size!==items.length) throw new SourceError('structure','Duplicate match ID');
      const selected=upcoming(items,now,end);
      const finished=items.length>0 && items.every(m=>m.status==='已结束');
      result.sources[sport]={...old,name:sourceName,sport,sourceUrl,status:'ok',availability:finished?'offseason':selected.length?'scheduled':'empty',updatedAt:now.toISOString(),lastAttemptAt:now.toISOString(),upstreamLastModified:lastModified,upstreamGeneratedAt:sport==='lol'?lastModified:null,error:null,matches:selected};
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
