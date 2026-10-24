const fs = require('node:fs/promises');
const path = require('node:path');

function timestamp(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Invalid match time');
  return new Date(value).toISOString();
}
function match(id, sport, league, home, away, start, status) {
  if (![id, league, home, away].every(v => typeof v === 'string' && v.trim())) throw Error('Invalid match fields');
  return {id, sport, league, home, away, start:timestamp(start), status};
}
function football(payload) {
  if (!Array.isArray(payload.matches)) throw Error('Invalid football response');
  return payload.matches.filter(m => ['SCHEDULED','TIMED','POSTPONED','SUSPENDED'].includes(m.status)).map(m => {
    if (!Number.isInteger(m.id)) throw Error('Invalid football ID');
    return match(`football-data:${m.id}`, 'football', m.competition?.name, m.homeTeam?.name || '待定', m.awayTeam?.name || '待定', m.utcDate,
      m.status === 'POSTPONED' ? '延期' : m.status === 'SUSPENDED' ? '暂停' : m.status === 'SCHEDULED' ? '时间待定' : '未开赛');
  });
}
function lol(payload) {
  if (!Array.isArray(payload)) throw Error('Invalid LoL response');
  return payload.filter(m => m.status === 'not_started').map(m => {
    if (!Number.isInteger(m.id)) throw Error('Invalid LoL ID');
    return match(`pandascore:${m.id}`, 'lol', [m.league?.name, m.serie?.full_name, m.tournament?.name].filter(Boolean).join(' · '),
      m.opponents?.[0]?.opponent?.name || '待定', m.opponents?.[1]?.opponent?.name || '待定', m.scheduled_at,
      m.scheduled_at ? '未开赛' : '时间待定');
  });
}
async function request(url, headers, fetcher) {
  const response = await fetcher(url, {headers, signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.json();
}
async function update(previous, env, fetcher = fetch, now = new Date()) {
  const result = structuredClone(previous);
  const end = new Date(now.getTime() + 7 * 86400000);
  let failures = 0;
  for (const sport of ['football','lol']) {
    const old = result.sources[sport];
    try {
      const token = env[sport === 'football' ? 'FOOTBALL_DATA_TOKEN' : 'PANDASCORE_TOKEN'];
      if (!token) throw Error('Missing token');
      let items;
      if (sport === 'football') {
        const url = new URL('https://api.football-data.org/v4/competitions/PL/matches');
        url.searchParams.set('dateFrom', now.toISOString().slice(0,10));
        url.searchParams.set('dateTo', end.toISOString().slice(0,10));
        items = football(await request(url, {'X-Auth-Token':token}, fetcher));
      } else {
        items = [];
        // shortcut: 最多读取 100 页，超过时保留旧快照并报错，不静默截断。
        for (let page = 1; ; page++) {
          if (page > 100) throw Error('Pagination limit');
          const url = new URL('https://api.pandascore.co/lol/matches/upcoming');
          url.searchParams.set('range[scheduled_at]', `${now.toISOString()},${end.toISOString()}`);
          url.searchParams.set('per_page', '100');
          url.searchParams.set('page', String(page));
          const payload = await request(url, {Authorization:`Bearer ${token}`}, fetcher);
          items.push(...lol(payload));
          if (payload.length < 100) break;
        }
      }
      items = items.filter(m => !m.start || (Date.parse(m.start) >= now.getTime() && Date.parse(m.start) < end.getTime()));
      if (new Set(items.map(m => m.id)).size !== items.length) throw Error('Duplicate match ID');
      result.sources[sport] = {...old, status:'ok', updatedAt:now.toISOString(), matches:items};
    } catch {
      failures++;
      result.sources[sport] = {...old, status:'error'};
      // Never print credentials, upstream bodies or authenticated request objects.
      console.error(`${sport}: 同步失败，保留上一次数据；检查密钥、额度和数据源。`);
    }
  }
  return {snapshot:result, failures};
}
if (require.main === module) {
  (async () => {
    const file = path.join(__dirname, '../data/schedule.json');
    const previous = JSON.parse(await fs.readFile(file, 'utf8'));
    const {snapshot, failures} = await update(previous, process.env);
    const text = JSON.stringify(snapshot, null, 2) + '\n';
    if (text !== await fs.readFile(file, 'utf8')) {
      await fs.writeFile(file + '.tmp', text);
      await fs.rename(file + '.tmp', file);
    }
    if (failures) process.exitCode = 1;
  })().catch(() => {console.error('无法更新赛程文件，未替换已有快照。'); process.exitCode = 1;});
}
module.exports = {football, lol, update};
