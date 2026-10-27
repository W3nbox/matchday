const {createHash} = require('node:crypto');
const footballLogos = require('../data/football-logos.json');
const esportsLogos = require('../data/esports-logos.json');
const baseballLogos = require('../data/baseball-logos.json');
// Exact game/name pairs avoid confusing academies or unrelated teams with the same initials.
function teamLogo(sport,name) {return esportsLogos.find(e=>e.sport===sport && e.name===name)?.file||null;}
class SourceError extends Error {constructor(code,message){super(message);this.code=code;}}
function zonedTime(local, zone) {
  const parts = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)(?::(\d\d))?$/.exec(local);
  if (!parts) throw new SourceError('time','Invalid absolute local time');
  const wanted = parts.slice(1).map(Number); wanted[5] ||= 0;
  const base = Date.UTC(wanted[0],wanted[1]-1,wanted[2],wanted[3],wanted[4],wanted[5]);
  const format = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const observed = value => {const p=Object.fromEntries(format.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);};
  const candidates = [-7200000,-3600000,0,3600000,7200000].map(offset => base + offset).filter(candidate=>observed(candidate)===base);
  // Only London uses this converter; reject ambiguous/nonexistent DST wall times.
  if (candidates.length !== 1) throw new SourceError('time','Ambiguous or nonexistent London time');
  return new Date(candidates[0]).toISOString();
}
function instant(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new SourceError('time','Absolute time with timezone required');
  return new Date(value).toISOString();
}
function football(payload, sourceUrl) {
  if (!/^English Premier League 20\d{2}\/\d{2}$/.test(payload?.name) || !Array.isArray(payload.matches)) throw new SourceError('structure','Invalid Premier League dataset');
  const season = payload.name.match(/20\d{2}\/\d{2}/)[0];
  const records = payload.matches.map(m => {
    if (![m.team1,m.team2,m.round].every(s=>typeof s==='string' && s.trim())) throw new SourceError('structure','Invalid football match');
    if (m.date != null && (!/^\d{4}-\d\d-\d\d$/.test(m.date) || !Number.isFinite(Date.parse(m.date)) || new Date(m.date).toISOString().slice(0,10)!==m.date)) throw new SourceError('structure','Invalid football date');
    if (m.time != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time)) throw new SourceError('structure','Invalid kickoff');
    const start = m.date && m.time ? zonedTime(`${m.date} ${m.time}`,'Europe/London') : null;
    const hash = createHash('sha256').update(`${season}|${m.team1}|${m.team2}`).digest('hex').slice(0,24);
    return {id:`openfootball:${m.id ?? hash}`,sport:'football',league:'Premier League',stage:m.round,season,home:m.team1,away:m.team2,homeLogo:footballLogos[m.team1]||null,awayLogo:footballLogos[m.team2]||null,start,sourceDate:m.date||null,status:Array.isArray(m.score?.ft)?'Final':start?'Scheduled':'Time TBD',sourceUrl,timeZone:'Europe/London'};
  });
  if (new Set(records.map(m=>m.id)).size!==records.length) throw new SourceError('structure','Duplicate football match');
  return records;
}
function lol(payload, sourceUrl) {
  if(payload?.version!==1 || !payload.matches || typeof payload.matches!=='object' || Array.isArray(payload.matches)) throw new SourceError('structure','Invalid public LoL snapshot');
  if(typeof payload.generatedAt!=='string') throw new SourceError('structure','Missing upstream generation time');
  instant(payload.generatedAt);
  const records=[];
  for(const [key,m] of Object.entries(payload.matches)) {
    if(!m || typeof m!=='object') throw new SourceError('structure','Invalid calendar record');
    const league=({294:'LPL',297:'Worlds'})[m.leagueId];
    if(!league) continue;
    if(!Number.isInteger(m.id) || String(m.id)!==key || m.uid!==`${m.id}@zlypher.github.io` || typeof m.summary!=='string') throw new SourceError('structure','Invalid public match identity');
    if(m.leagueName && !({LPL:['LPL'],Worlds:['Worlds','World Championship']})[league].includes(m.leagueName)) throw new SourceError('structure','League ID and name disagree');
    const description=/^(?:(.+): )?(.+?) vs (.+)$/.exec(m.summary);
    if(!description) throw new SourceError('structure','Unsupported match summary');
    if(m.status!=null && !['CONFIRMED','TENTATIVE','CANCELLED'].includes(m.status)) throw new SourceError('structure','Unknown calendar status');
    const start=instant(m.start);
    const home=m.opponents?.[0]?.name || description[2] || 'TBD';
    const away=m.opponents?.[1]?.name || description[3] || 'TBD';
    // Retain the underlying PandaScore match ID so existing saved matches survive the source change.
    records.push({id:`pandascore:${m.id}`,sport:'lol',league,stage:description[1]||'Stage TBD',home,away,homeLogo:m.opponents?.[0]?.imageUrl||null,awayLogo:m.opponents?.[1]?.imageUrl||null,start,status:m.status==='CANCELLED'?'Cancelled':start?'Scheduled':'Time TBD',sourceUrl,timeZone:'UTC'});
  }
  return records;
}
function baseball(rows, sourceUrl) {
  const required=['game_pk','game_date','game_datetime','season','game_type','detailed_state','abstract_state','home_team_id','home_team_name','away_team_id','away_team_name'];
  if(!Array.isArray(rows) || rows.some(r=>required.some(k=>typeof r[k]!=='string'))) throw new SourceError('structure','Invalid MLB records');
  const stages={S:'Spring Training',E:'Exhibition',R:'Regular Season',F:'Wild Card Series',D:'Division Series',L:'League Championship Series',W:'World Series'};
  const items=rows.flatMap(r=>{
    // MLB team IDs exclude college opponents, international clubs and All-Star teams.
    const pending=side=>!r[side+'_team_id'] && ['', 'TBD'].includes(r[side+'_team_name'].trim());
    if((!baseballLogos[r.home_team_id] && !pending('home')) || (!baseballLogos[r.away_team_id] && !pending('away'))) return [];
    if(!/^\d+$/.test(r.game_pk) || !/^20\d{2}$/.test(r.season) || !/^\d{4}-\d\d-\d\d$/.test(r.game_date) || !Number.isFinite(Date.parse(r.game_date)) || new Date(r.game_date).toISOString().slice(0,10)!==r.game_date || !['Preview','Live','Final'].includes(r.abstract_state) || !stages[r.game_type]) throw new SourceError('structure','Invalid MLB match');
    const finished=r.abstract_state==='Final' && !/Postponed|Suspended/i.test(r.detailed_state);
    const cancelled=r.detailed_state==='Cancelled';
    const postponed=/Postponed|Suspended/i.test(r.detailed_state);
    // Only explicit source confirmation permits displaying a preview kickoff time.
    const confirmed=r.start_time_tbd==='false' || ['Live','Final'].includes(r.abstract_state);
    const start=confirmed && !postponed && r.game_datetime ? instant(r.game_datetime) : null;
    return [{id:'mlb:'+r.game_pk,sport:'baseball',league:'MLB',stage:r.season+' Season · '+stages[r.game_type],season:r.season,home:r.home_team_name.trim()||'TBD',away:r.away_team_name.trim()||'TBD',homeLogo:baseballLogos[r.home_team_id]?.file||null,awayLogo:baseballLogos[r.away_team_id]?.file||null,start,sourceDate:r.game_date,status:cancelled?'Cancelled':finished?'Final':postponed?'Postponed':start?'Scheduled':'Time TBD',sourceUrl,timeZone:'UTC'}];
  });
  const unique=new Map();
  for(const m of items) {
    const prior=unique.get(m.id);
    if(prior && (prior.home!==m.home || prior.away!==m.away || prior.season!==m.season || prior.sourceDate===m.sourceDate && JSON.stringify(prior)!==JSON.stringify(m))) throw new SourceError('structure','Conflicting MLB match copies');
    // A postponed game can appear on its original and rescheduled date with the same ID.
    if(!prior || m.sourceDate>prior.sourceDate) unique.set(m.id,m);
  }
  return [...unique.values()];
}
function mlb(payload) {
  if(!Number.isInteger(payload?.totalGames) || payload.totalGames<0 || !Array.isArray(payload.dates) || payload.dates.some(d=>!Array.isArray(d.games)) || payload.dates.reduce((n,d)=>n+d.games.length,0)!==payload.totalGames) throw new SourceError('structure','Invalid MLB schedule');
  const games=payload.dates.flatMap(d=>d.games);
  const rows=games.map(g=>{
    if(!Number.isInteger(g.gamePk) || typeof g.season!=='string' || !g.status || !g.teams?.home?.team || !g.teams?.away?.team || typeof g.gameType!=='string' || typeof g.officialDate!=='string') throw new SourceError('structure','Invalid MLB game');
    if(g.status.startTimeTBD!=null && typeof g.status.startTimeTBD!=='boolean') throw new SourceError('structure','Invalid MLB TBD flag');
    return {game_pk:String(g.gamePk),game_date:g.officialDate,game_datetime:g.gameDate??'',season:g.season,game_type:g.gameType,detailed_state:g.status.detailedState,abstract_state:g.status.abstractGameState,start_time_tbd:String(g.status.startTimeTBD),home_team_id:g.teams.home.team.id==null?'':String(g.teams.home.team.id),home_team_name:g.teams.home.team.name||'TBD',away_team_id:g.teams.away.team.id==null?'':String(g.teams.away.team.id),away_team_name:g.teams.away.team.name||'TBD'};
  });
  return baseball(rows,'https://www.mlb.com/schedule').map(m=>({...m,sourceUrl:'https://www.mlb.com/gameday/'+m.id.slice(4)}));
}
module.exports={SourceError,zonedTime,instant,football,lol,teamLogo,baseball,mlb};
