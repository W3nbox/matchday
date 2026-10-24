const {createHash} = require('node:crypto');
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
    return {id:`openfootball:${m.id ?? hash}`,sport:'football',league:'Premier League',stage:m.round,season,home:m.team1,away:m.team2,start,sourceDate:m.date||null,status:Array.isArray(m.score?.ft)?'已结束':start?'未开赛':'时间待定',sourceUrl,timeZone:'Europe/London'};
  });
  if (new Set(records.map(m=>m.id)).size!==records.length) throw new SourceError('structure','Duplicate football match');
  return records;
}
function lol(payload, sourceUrl) {
  if (!Array.isArray(payload)) throw new SourceError('structure','Invalid LoL response');
  const records=[];
  for(const m of payload) {
    if (!m.league || typeof m.league.name!=='string') throw new SourceError('structure','Missing competition label');
    let league;
    if(m.league.name === 'LPL') league='LPL';
    else if(m.league.name === 'World Championship' && m.league.slug === 'league-of-legends-world-championship') league='Worlds';
    else continue;
    if(!Number.isInteger(m.id) || !Number.isInteger(m.league.id) || (m.league_id!=null && m.league_id!==m.league.id) || (m.videogame?.slug && m.videogame.slug!=='league-of-legends')) throw new SourceError('structure','Invalid LoL match identity');
    const status = {not_started:'未开赛',running:'进行中',finished:'已结束',postponed:'延期',canceled:'取消'}[m.status];
    if(!status) throw new SourceError('structure','Unknown LoL match status');
    records.push({id:`pandascore:${m.id}`,sport:'lol',league,stage:m.tournament?.name||'阶段待定',season:m.serie?.full_name||'',home:m.opponents?.[0]?.opponent?.name||'TBD',away:m.opponents?.[1]?.opponent?.name||'TBD',start:instant(m.scheduled_at),status:m.scheduled_at?status:'时间待定',sourceUrl,timeZone:'UTC'});
  }
  return records;
}
module.exports={SourceError,zonedTime,instant,football,lol};
