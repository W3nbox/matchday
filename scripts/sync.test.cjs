const {test}=require('node:test');
const assert=require('node:assert/strict');
const {football,lol,update,seasonAt}=require('./sync.cjs');
const {zonedTime}=require('./parse.cjs');
const now=new Date('2026-11-07T00:00:00Z');
const url='https://example.com/schedule';
const fm={round:'Matchday 12',date:'2026-11-08',time:'20:00',team1:'Arsenal',team2:'Chelsea'};
const dataset=matches=>({name:'English Premier League 2026/27',matches});
const lm={id:2,league:{id:297,name:'World Championship',slug:'league-of-legends-world-championship'},status:'not_started',tournament:{name:'Semifinals'},opponents:[{opponent:{name:'A'}},{opponent:{name:'B'}}],scheduled_at:'2026-11-08T12:00:00Z'};
const initial={sources:{football:{name:'openfootball',sport:'football',status:'pending',updatedAt:null,matches:[]},lol:{name:'PandaScore',sport:'lol',status:'pending',updatedAt:null,matches:[]}}};
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
test('strict league membership excludes other tournaments even with LPL teams',()=>{
 const other=['MSI','First Stand','LCK','LEC','LCP'].map((name,i)=>({...lm,id:20+i,league:{id:10+i,name,slug:name},opponents:[{opponent:{name:'BLG'}}]}));
 const records=lol([lm,{...lm,id:3,league:{id:294,name:'LPL',slug:'league-of-legends-lpl'}},...other],url);
 assert.deepEqual(records.map(m=>m.league),['Worlds','LPL']);
 assert.equal(records[0].stage,'Semifinals');
 assert.equal(lol([{...lm,opponents:[],scheduled_at:null}],url)[0].home,'TBD');
 assert.equal(lol([{...lm,scheduled_at:null}],url)[0].start,null);
 assert.equal(lol([{...lm,scheduled_at:'2026-11-09T10:00:00Z'}],url)[0].id,records[0].id);
 assert.throws(()=>lol([{...lm,scheduled_at:'2026-11-09 10:00'}],url));
});
test('pagination, source isolation, valid empty and failure preserves old data',async()=>{
 const old=structuredClone(initial);old.sources.lol.matches=lol([lm],url);old.sources.lol.updatedAt=now.toISOString();
 const result=await update(old,{},async()=>({ok:true,json:async()=>dataset([fm])}),now);
 assert.equal(result.failures,1);
 assert.deepEqual(result.snapshot.sources.lol.matches,old.sources.lol.matches);
 assert.equal(result.snapshot.sources.lol.updatedAt,old.sources.lol.updatedAt);
 assert.equal(result.snapshot.sources.football.status,'ok');
 const empty=await update(old,{PANDASCORE_TOKEN:'test'},async(u,options)=>{
  assert.ok(options.signal);
  if(String(u).includes('raw.githubusercontent'))return {ok:true,json:async()=>dataset([])};
  assert.equal(options.headers.Authorization,'Bearer test');
  assert.ok(!String(u).includes('token='));
  return {ok:true,json:async()=>[]};
 },now);
 assert.equal(empty.failures,0);assert.deepEqual(empty.snapshot.sources.lol.matches,[]);assert.equal(empty.snapshot.sources.football.availability,'empty');
 let pages=0;
 const paged=await update(initial,{PANDASCORE_TOKEN:'test'},async(u)=>{
  if(String(u).includes('raw.githubusercontent'))return {ok:true,json:async()=>dataset([])};
  pages++;return {ok:true,json:async()=>pages===1?Array.from({length:100},(_,i)=>({...lm,id:100+i})):[]};
 },now);
 assert.equal(pages,2);assert.equal(paged.snapshot.sources.lol.matches.length,100);
 const failed=await update(old,{PANDASCORE_TOKEN:'test'},async()=>{throw Error('network');},now);
 assert.equal(failed.failures,2);assert.deepEqual(failed.snapshot.sources.lol.matches,old.sources.lol.matches);
 const changed=await update(old,{},async()=>({ok:true,json:async()=>({wrong:[]})}),now);
 assert.equal(changed.snapshot.sources.football.error,'structure');
});
