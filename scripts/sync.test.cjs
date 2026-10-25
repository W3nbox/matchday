const {test}=require('node:test');
const assert=require('node:assert/strict');
const {football,lol,update:updateSources,seasonAt,upcoming}=require('./sync.cjs');
const {zonedTime}=require('./parse.cjs');
const now=new Date('2026-11-07T00:00:00Z');
const url='https://example.com/schedule';
const fm={round:'Matchday 12',date:'2026-11-08',time:'20:00',team1:'Arsenal',team2:'Chelsea'};
const dataset=matches=>({name:'English Premier League 2026/27',matches});
const lm={id:2,uid:'2@zlypher.github.io',leagueId:297,leagueName:'Worlds',summary:'Semifinals: A vs B',start:'2026-11-08T12:00:00Z',status:null,opponents:[{name:'A'},{name:'B'}]};
const calendar=records=>({version:1,generatedAt:now.toISOString(),matches:Object.fromEntries(records.map(m=>[String(m.id),m]))});
const bm={game_pk:'9001',game_date:'2027-04-03',game_datetime:'2027-04-03T23:05:00Z',season:'2027',game_type:'R',detailed_state:'Scheduled',abstract_state:'Preview',home_team_id:'147',home_team_name:'New York Yankees',away_team_id:'111',away_team_name:'Boston Red Sox'};
const mg={gamePk:9001,gameType:'R',season:'2027',gameDate:bm.game_datetime,officialDate:bm.game_date,status:{detailedState:'Scheduled',abstractGameState:'Preview',startTimeTBD:false},teams:{home:{team:{id:147,name:bm.home_team_name}},away:{team:{id:111,name:bm.away_team_name}}}};
const mlbPayload=games=>({totalGames:games.length,dates:games.length?[{date:'2027-04-03',games}]:[]});
const baseballResponse=u=>String(u).includes('statsapi.mlb.com')?{ok:true,json:async()=>String(u).includes('/seasons/all')?{seasons:[{seasonId:'2027'}]}:mlbPayload([mg])}:null;
const update=(previous,fetcher,at)=>updateSources(previous,async(u,o)=>baseballResponse(u)||fetcher(u,o),at);
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
 const response=data=>({ok:true,json:async()=>data,arrayBuffer:async()=>require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/calendars.zip'))});
 const fetcher=async(u,options)=>{
  if(options.headers)assert.deepEqual(options.headers,{});assert.ok(options.signal);assert.ok(!String(u).includes('token='));
  return response(String(u).includes('openfootball/')?dataset([fm]):calendar([lm]));
 };
 const success=await update(old,fetcher,now);assert.equal(success.failures,0);assert.equal(success.snapshot.sources.lol.matches.length,1);assert.equal(success.snapshot.sources.cs2.matches.length,1);assert.equal(success.snapshot.sources.valorant.matches.length,1);assert.equal(success.snapshot.sources.lol.upstreamGeneratedAt,now.toISOString());
 const failed=await update(old,async u=>{if(String(u).includes('zlypher'))throw Error('network');return response(dataset([fm]));},now);
 assert.equal(failed.failures,1);assert.deepEqual(failed.snapshot.sources.lol.matches,old.sources.lol.matches);assert.equal(failed.snapshot.sources.lol.updatedAt,old.sources.lol.updatedAt);assert.equal(failed.snapshot.sources.football.status,'ok');
 const empty=await update(old,async u=>response(String(u).includes('zlypher')?calendar([]):dataset([])),now);
 assert.equal(empty.failures,0);assert.deepEqual(empty.snapshot.sources.lol.matches,[]);assert.equal(empty.snapshot.sources.lol.availability,'empty');
 const structure=await update(old,async()=>response({wrong:[]}),now);assert.equal(structure.snapshot.sources.lol.error,'structure');assert.deepEqual(structure.snapshot.sources.lol.matches,old.sources.lol.matches);
});

test('all future fixtures retained, past/finished/cancelled excluded and TBD retained',()=>{
 const items=football(dataset([{...fm,date:'2026-11-21'},{...fm,team1:'Other',date:'2027-05-30'},{...fm,team1:'Past',date:'2026-11-01'},{...fm,team1:'Unknown',date:undefined,time:undefined},{...fm,team1:'Finished',date:'2026-11-21',score:{ft:[1,0]}}]),url);
 const selected=upcoming([...items,{...items[0],id:'cancelled',status:'取消'}],now);
 assert.deepEqual(selected.map(m=>m.home),['Arsenal','Other','Unknown']);
});

test('real logo mappings and LoL source images follow their teams',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const logos=require('../data/football-logos.json');assert.equal(Object.keys(logos).length,20);
 for(const file of Object.values(logos))assert.equal(fs.readFileSync(path.join(__dirname,'..',file)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const m=football(dataset([{...fm,team1:'Arsenal FC',team2:'Chelsea FC'}]),url)[0];assert.ok(m.homeLogo);assert.ok(m.awayLogo);
 const e={...lm,opponents:[{name:'A',imageUrl:'https://cdn-api.pandascore.co/images/team/image/1/a.png'},{name:'B',imageUrl:'https://cdn-api.pandascore.co/images/team/image/2/b.png'}]};
 const item=lol(calendar([e]),url)[0];assert.equal(item.homeLogo,e.opponents[0].imageUrl);assert.equal(item.awayLogo,e.opponents[1].imageUrl);
});

test('official esports crests use exact sport and name, valid local assets and documented sources',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const {teamLogo}=require('./parse.cjs'),logos=require('../data/esports-logos.json');
 assert.equal(new Set(logos.map(e=>e.sport+':'+e.name)).size,logos.length);
 for(const e of logos){
  assert.match(e.page,/^https:\/\//);assert.match(e.url,/^https:\/\//);
  assert.match(e.file,/^assets\/team-logos\/[a-z0-9-]+\.(png|svg|webp)$/);
  const b=fs.readFileSync(path.join(__dirname,'..',e.file));
  if(e.file.endsWith('.png'))assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  if(e.file.endsWith('.webp')){assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');}
  if(e.file.endsWith('.svg')){assert.match(b.toString(),/<svg\b/);assert.doesNotMatch(b.toString(),/<script|on\w+\s*=|(?:href|src)\s*=/i);}
  assert.equal(teamLogo(e.sport,e.name),e.file);
 }
 assert.ok(teamLogo('cs2','G2'));assert.ok(teamLogo('valorant','CGN'));
 assert.equal(teamLogo('cs2','G2.A'),null);assert.equal(teamLogo('valorant','G2'),null);assert.equal(teamLogo('cs2','TBD'),null);
});

test('MLB stages, UTC boundary, exact logos, postponement identity and unknown time',()=>{
 const {baseball}=require('./parse.cjs');
 const a=baseball([{...bm,start_time_tbd:'false'}],url)[0];
 assert.equal(a.start,'2027-04-03T23:05:00.000Z');assert.equal(a.homeLogo,'assets/team-logos/mlb-147.png');
 assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(a.start)),'2027-04-04');
 assert.equal(baseball([bm],url)[0].start,null);
 assert.equal(baseball([{...bm,game_date:'2027-04-04',game_datetime:'2027-04-04T23:05:00Z'}],url)[0].id,a.id);
 const tbd=baseball([{...bm,away_team_id:'',away_team_name:'TBD',game_type:'W'}],url)[0];assert.equal(tbd.away,'TBD');assert.equal(tbd.awayLogo,null);
 assert.deepEqual(baseball([],url),[]);assert.deepEqual(baseball([{...bm,away_team_id:'999999'}],url),[]);
 const moved=baseball([{...bm,detailed_state:'Postponed',abstract_state:'Final'},{...bm,game_date:'2027-04-04',start_time_tbd:'false'}],url);
 assert.equal(moved.length,1);assert.equal(moved[0].sourceDate,'2027-04-04');assert.equal(moved[0].status,'未开赛');
 assert.throws(()=>baseball([{...bm,start_time_tbd:'false',game_datetime:'2027-04-03 23:05'}],url));
 assert.throws(()=>baseball([bm,{...bm,home_team_name:'Other'}],url));
 for(const [type,stage] of Object.entries({S:'春训赛',R:'常规赛',W:'世界大赛'}))assert.ok(baseball([{...bm,game_type:type}],url)[0].stage.includes(stage));
 const logos=require('../data/baseball-logos.json');assert.equal(Object.keys(logos).length,30);
 for(const e of Object.values(logos))assert.equal(require('node:fs').readFileSync(require('node:path').join(__dirname,'..',e.file)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});

test('official MLB adapter confirms times, preserves identity, rejects broken payloads and accepts empty',()=>{
 const {mlb}=require('./parse.cjs');
 const a=mlb(mlbPayload([mg]))[0];assert.equal(a.id,'mlb:9001');assert.equal(a.start,'2027-04-03T23:05:00.000Z');assert.equal(a.sourceUrl,'https://www.mlb.com/gameday/9001');
 assert.equal(mlb(mlbPayload([{...mg,status:{...mg.status,startTimeTBD:true}}]))[0].start,null);
 assert.equal(mlb(mlbPayload([{...mg,status:{...mg.status,startTimeTBD:undefined}}]))[0].start,null);
 assert.equal(mlb(mlbPayload([{...mg,gameDate:'2027-04-05T20:00:00Z',officialDate:'2027-04-05'}]))[0].id,a.id);
 assert.deepEqual(mlb(mlbPayload([])),[]);assert.throws(()=>mlb({totalGames:1,dates:[]}));assert.throws(()=>mlb(mlbPayload([{...mg,teams:null}])));
});
test('MLB failure retains snapshot, normal empty succeeds and all published future seasons load',async()=>{
 const old=structuredClone(initial);old.sources.baseball={name:'MLB',status:'ok',updatedAt:now.toISOString(),matches:require('./parse.cjs').baseball([bm],url)};
 const other=async u=>({ok:true,json:async()=>String(u).includes('openfootball/')?dataset([]):calendar([]),arrayBuffer:async()=>require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/calendars.zip'))});
 const fail=await updateSources(old,async u=>{if(String(u).includes('statsapi.mlb.com'))throw Error('offline');return other(u);},now);
 assert.equal(fail.snapshot.sources.baseball.status,'error');assert.deepEqual(fail.snapshot.sources.baseball.matches,old.sources.baseball.matches);
 const visited=[];
 const result=await updateSources(old,async u=>{visited.push(String(u));if(String(u).includes('statsapi.mlb.com'))return {ok:true,json:async()=>String(u).includes('/seasons/all')?{seasons:[{seasonId:'2027'},{seasonId:'2029'}]}:mlbPayload([])};return other(u);},now);
 assert.equal(result.snapshot.sources.baseball.status,'ok');assert.equal(result.snapshot.sources.baseball.availability,'empty');assert.deepEqual(result.snapshot.sources.baseball.matches,[]);assert.ok(visited.some(u=>u.includes('season=2029')));
 const broken=await updateSources(old,async u=>String(u).includes('statsapi.mlb.com')?{ok:true,json:async()=>({seasons:[]})}:other(u),now);
 assert.equal(broken.snapshot.sources.baseball.status,'error');assert.deepEqual(broken.snapshot.sources.baseball.matches,old.sources.baseball.matches);
});
