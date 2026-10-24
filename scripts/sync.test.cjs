const {test}=require('node:test');
const assert=require('node:assert/strict');
const {football,lol,update,seasonAt,upcoming}=require('./sync.cjs');
const {zonedTime}=require('./parse.cjs');
const now=new Date('2026-11-07T00:00:00Z');
const url='https://example.com/schedule';
const fm={round:'Matchday 12',date:'2026-11-08',time:'20:00',team1:'Arsenal',team2:'Chelsea'};
const dataset=matches=>({name:'English Premier League 2026/27',matches});
const lm={id:2,uid:'2@zlypher.github.io',leagueId:297,leagueName:'Worlds',summary:'Semifinals: A vs B',start:'2026-11-08T12:00:00Z',status:null,opponents:[{name:'A'},{name:'B'}]};
const calendar=records=>({version:1,generatedAt:now.toISOString(),matches:Object.fromEntries(records.map(m=>[String(m.id),m]))});
const initial={sources:{football:{name:'openfootball',sport:'football',status:'pending',updatedAt:null,matches:[]},lol:{name:'zlypher/lol-events',sport:'lol',status:'pending',updatedAt:null,matches:[]}}};
test('London summer/winter, midnight and impossible DST times',()=>{
 assert.equal(zonedTime('2026-08-21 20:00','Europe/London'),'2026-08-21T19:00:00.000Z');
 assert.equal(zonedTime('2026-11-08 20:00','Europe/London'),'2026-11-08T20:00:00.000Z');
 assert.throws(()=>zonedTime('2026-03-29 01:30','Europe/London'));
 assert.throws(()=>zonedTime('2026-10-25 01:30','Europe/London'));
 assert.equal(seasonAt(new Date('2027-02-01Z')),'2026-27');
});
test('football rescheduling keeps identity; unknown time is not guessed',()=>{
 const a=football(dataset([fm]),url)[0];
 const b=football(dataset([{...fm,date:'2026-11-10',time:'19:00'}]),url)[0];
 assert.equal(a.id,b.id);
 assert.equal(football(dataset([{...fm,time:undefined}]),url)[0].start,null);
 assert.deepEqual(football(dataset([]),url),[]);
 assert.throws(()=>football(dataset([{...fm,time:'26:00'}]),url));
 assert.throws(()=>football(dataset([{...fm,date:'2026-02-30'}]),url));
 assert.throws(()=>football({name:'Championship',matches:[]},url));
});
test('public snapshot validates league IDs, stages, stable IDs and timezone',()=>{
 const other=['MSI','First Stand','LCK','LEC','LCP'].map((name,i)=>({...lm,id:20+i,uid:`${20+i}@zlypher.github.io`,leagueId:100+i,leagueName:name,summary:'BLG vs T1'}));
 const records=lol(calendar([lm,{...lm,id:3,uid:'3@zlypher.github.io',leagueId:294,leagueName:'LPL'},...other]),url);
 assert.deepEqual(records.map(m=>m.league),['Worlds','LPL']);assert.equal(records[0].stage,'Semifinals');
 const tbd=lol(calendar([{...lm,opponents:[],summary:'TBD vs TBD',start:null}]),url)[0];
 assert.equal(tbd.home,'TBD');assert.equal(tbd.start,null);assert.equal(tbd.stage,'阶段待定');
 assert.equal(lol(calendar([{...lm,start:'2026-11-09T10:00:00Z'}]),url)[0].id,'pandascore:2');
 assert.equal(lol(calendar([{...lm,status:'CANCELLED'}]),url)[0].status,'取消');
 assert.throws(()=>lol(calendar([{...lm,leagueName:'MSI'}]),url));
 assert.throws(()=>lol(calendar([{...lm,start:'2026-11-08 12:00'}]),url));
 assert.throws(()=>lol({wrong:[]},url));
 assert.deepEqual(lol(calendar([]),url),[]);
});
test('no credentials, independent failures, valid empty and structural failure preserve data',async()=>{
 const old=structuredClone(initial);old.sources.lol.matches=lol(calendar([lm]),url);old.sources.lol.updatedAt=now.toISOString();
 const response=data=>({ok:true,json:async()=>data});
 const fetcher=async(u,options)=>{
  assert.deepEqual(options.headers,{});assert.ok(options.signal);assert.ok(!String(u).includes('token='));
  return response(String(u).includes('openfootball/')?dataset([fm]):calendar([lm]));
 };
 const success=await update(old,fetcher,now);assert.equal(success.failures,0);assert.equal(success.snapshot.sources.lol.matches.length,1);assert.equal(success.snapshot.sources.lol.upstreamGeneratedAt,now.toISOString());
 const failed=await update(old,async u=>{if(String(u).includes('zlypher'))throw Error('network');return response(dataset([fm]));},now);
 assert.equal(failed.failures,1);assert.deepEqual(failed.snapshot.sources.lol.matches,old.sources.lol.matches);assert.equal(failed.snapshot.sources.lol.updatedAt,old.sources.lol.updatedAt);assert.equal(failed.snapshot.sources.football.status,'ok');
 const empty=await update(old,async u=>response(String(u).includes('zlypher')?calendar([]):dataset([])),now);
 assert.equal(empty.failures,0);assert.deepEqual(empty.snapshot.sources.lol.matches,[]);assert.equal(empty.snapshot.sources.lol.availability,'empty');
 const structure=await update(old,async()=>response({wrong:[]}),now);assert.equal(structure.snapshot.sources.lol.error,'structure');assert.deepEqual(structure.snapshot.sources.lol.matches,old.sources.lol.matches);
});

test('30-day window includes the next round and excludes later dates',()=>{
 const items=football(dataset([{...fm,date:'2026-11-21'},{...fm,team1:'Other',date:'2026-12-08'}]),url);
 const selected=upcoming(items,now,new Date(now.getTime()+30*86400000));
 assert.equal(selected.length,1);assert.equal(selected[0].sourceDate,'2026-11-21');
});
