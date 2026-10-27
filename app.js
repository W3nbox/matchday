'use strict';
let matches = [];
let snapshot = null;
let loadState = 'loading';
const sports = [['football','Football','⚽','sports'], ['baseball','Baseball · MLB','⚾','sports'], ['lol','League of Legends','L','esports'], ['cs2','CS2','⌖','esports'], ['valorant','VALORANT','V','esports']];
function beijingDate(value) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function safeSource(value) {
  try {const url=new URL(value);return url.protocol==='https:' && ['raw.githubusercontent.com','github.com','www.mlb.com'].includes(url.hostname);} catch {return false;}
}
function safeLogo(value) {
  if(typeof value!=='string') return false;
  if(/^assets\/team-logos\/[a-z0-9-]+\.(?:png|svg|webp)$/.test(value)) return true;
  try {const url=new URL(value);return url.protocol==='https:' && url.hostname==='cdn-api.pandascore.co' && url.pathname.startsWith('/images/team/');}catch{return false;}
}
function validateSnapshot(data) {
  if (!data || !data.sources) throw Error('Invalid snapshot');
  const ids = new Set();
  for (const sport of ['football','lol','cs2','valorant','baseball']) {
    const source = data.sources[sport];
    if (!source || typeof source.name !== 'string' || !['pending','ok','error'].includes(source.status)
      || !(source.updatedAt === null || typeof source.updatedAt === 'string' && Number.isFinite(Date.parse(source.updatedAt)))
      || !Array.isArray(source.matches)) throw Error('Invalid source');
    for (const m of source.matches) {
      if (m.sport !== sport || ![m.id,m.league,m.home,m.away,m.status,m.stage].every(v => typeof v === 'string' && v.trim())
        || !(m.start === null || typeof m.start === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(m.start) && Number.isFinite(Date.parse(m.start)))
        || !safeSource(m.sourceUrl) || ids.has(m.id)) throw Error('Invalid match');
      ids.add(m.id);
    }
  }
  return data;
}
function filterMatches(items, {page, category='all', search='', date='', favorites=[]}) {
  const allowed = sports.filter(s => page !== 'sports' && page !== 'esports' || s[3] === page).map(s => s[0]);
  const query = search.trim().toLocaleLowerCase();
  return items.filter(m => allowed.includes(m.sport)
    && (page !== 'favorites' || favorites.includes(m.id))
    && (category === 'all' || m.sport === category)
    && (!date || m.start && beijingDate(m.start) === date)
    && `${m.home} ${m.away} ${m.league}`.toLocaleLowerCase().includes(query))
    .sort((a,b) => (a.start ? Date.parse(a.start) : Infinity) - (b.start ? Date.parse(b.start) : Infinity));
}
const page = document.body.dataset.page;
const navigationToggle = document.querySelector('#navigation-toggle');
const navigationPanel = document.querySelector('#navigation-panel');
function setNavigationOpen(open) {
  document.body.dataset.navigationOpen = String(open);
  navigationToggle.setAttribute('aria-expanded', String(open));
  navigationToggle.setAttribute('aria-label', open ? 'Close sidebar' : 'Open sidebar');
  navigationToggle.textContent = open ? '‹' : '☰';
  navigationPanel.hidden = !open;
}
navigationToggle.addEventListener('click', () => setNavigationOpen(navigationPanel.hidden));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !navigationPanel.hidden) {
    setNavigationOpen(false);
    navigationToggle.focus();
  }
});
const categories = document.querySelector('#categories');
const container = document.querySelector('#matches');
const search = document.querySelector('#search');
const date = document.querySelector('#date');
const feedback = document.querySelector('#feedback');
const storageKey = 'matchday.favorites.v1';
let favorites = [];
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) favorites = stored.filter(id => typeof id === 'string');
} catch {
  if (feedback) feedback.textContent = 'Could not read saved favorites. You can still save matches for this session.';
}
let category = 'all';
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function teamBadge(name, logo) {
  const badge=element('span','badge');
  badge.setAttribute('aria-hidden','true');
  const fallback=element('span','badge-fallback',name==='TBD'?'?':name.slice(0,2).toUpperCase());
  badge.append(fallback);
  if(safeLogo(logo)) {
    const img=element('img','team-logo');
    img.alt='';img.width=32;img.height=32;img.loading='lazy';img.decoding='async';
    img.addEventListener('load',()=>{img.hidden=false;img.className='team-logo is-loaded';fallback.hidden=true;});
    img.addEventListener('error',()=>{img.hidden=true;fallback.hidden=false;});
    img.src=logo;badge.append(img);
  }
  return badge;
}
const categoryItems = [['all','All Categories','↗'], ...sports.filter(s => page !== 'sports' && page !== 'esports' || s[3] === page)];
for (const [id, name, icon] of categories ? categoryItems : []) {
  const button = element('button','category');
  button.type = 'button';
  button.dataset.category = id;
  button.setAttribute('aria-pressed',String(id === category));
  const symbol = element('span','',icon);
  symbol.setAttribute('aria-hidden','true');
  button.append(symbol, element('span','',name), element('span','','→'));
  button.addEventListener('click', () => {
    category = id;
    for (const sibling of categories.children) sibling.setAttribute('aria-pressed', String(sibling === button));
    render();
  });
  categories.append(button);
}
function render() {
  if (!container) return;
  const filtered = filterMatches(matches, {page, category, search:search.value, date:date.value, favorites});
  container.replaceChildren();
  document.querySelector('#result-count').textContent = loadState === 'loading' ? 'Loading matches…' : loadState === 'error' ? 'Could not load matches. Please try again later.' : `${filtered.length} ${filtered.length === 1 ? "match" : "matches"} found`;
  if (loadState !== 'ready') return;
  if (!filtered.length) {
    const empty = element('div','empty');
    empty.append(element('p','',page === 'favorites' ? 'No saved matches fit these filters.' : 'No matches fit these filters. Check Information for data source status.'));
    const link = element('a','','Browse all matches →');
    link.href = 'index.html';
    empty.append(link);
    container.append(empty);
  }
  const groups = new Map();
  for (const match of filtered) {
    const groupName = `${match.league} · ${match.stage}`;
    let group = groups.get(groupName);
    if (!group) {
      group = element('section','league');
      const heading = element('h3','',groupName);
      heading.append(element('span','','Beijing Time'));
      group.append(heading);
      groups.set(groupName,group);
      container.append(group);
    }
    const row = element('article','match');
    row.setAttribute('aria-label', `${match.home} vs. ${match.away}`);
    const teams = element('div','teams');
    for(const [name,logo] of [[match.home,match.homeLogo],[match.away,match.awayLogo]]) {
      const row=element('div','team-row');
      row.append(teamBadge(name,logo),element('span','team-name',name));
      teams.append(row);
    }
    const time = element(match.start ? 'time' : 'div','match-time', match.start && match.status !== 'Time TBD' ? new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(match.start)) : 'TBD');
    if (match.start) {
      time.dateTime = match.start;
      time.append(element('small','',new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date(match.start))));
    }
    if(!match.start && match.sport==='baseball' && match.sourceDate) time.append(element('small','','Official game date: '+match.sourceDate));
    time.append(element('small','',match.status));
    const star = element('button','star');
    star.type = 'button';
    const updateStar = () => {
      const selected = favorites.includes(match.id);
      star.textContent = selected ? '★' : '☆';
      star.setAttribute('aria-pressed',String(selected));
      star.setAttribute('aria-label',`${selected ? 'Remove from favorites:' : 'Add to favorites:'} ${match.home} vs. ${match.away}`);
    };
    updateStar();
    star.addEventListener('click', () => {
      favorites = favorites.includes(match.id) ? favorites.filter(id => id !== match.id) : [...favorites,match.id];
      let saved = true;
      try { localStorage.setItem(storageKey,JSON.stringify(favorites)); }
      catch { saved = false; }
      updateStar();
      feedback.textContent = saved ? 'Favorites saved in this browser.' : 'Local storage is unavailable. Favorites are saved for this session.';
      if (page === 'favorites') {
        render();
        const next = container.querySelector('button') || search;
        next.focus();
      }
    });
    row.append(teams,time,star);
    group.append(row);
  }
}
search?.addEventListener('input',render);
date?.addEventListener('change',render);
document.querySelector('#filters')?.addEventListener('submit',event => event.preventDefault());
document.querySelector('#filters')?.addEventListener('reset', () => {
  search.value = '';
  date.value = '';
  category = 'all';
  for (const button of categories.children) button.setAttribute('aria-pressed',String(button.dataset.category === 'all'));
  render();
});
window.addEventListener('storage', event => {
  if (!feedback || (event.key !== storageKey && event.key !== null)) return;
  try {
    const stored = JSON.parse(event.newValue || '[]');
    favorites = Array.isArray(stored) ? stored.filter(id => typeof id === 'string') : [];
    render();
  } catch { feedback.textContent = 'Could not read favorites from another tab. Reload to try again.'; }
});
render();

async function loadSchedule() {
  loadState = 'loading';
  render();
  const status = document.querySelector('#sync-status');
  if (status) status.textContent = 'Loading schedule data…';
  try {
    const response = await fetch('data/schedule.json', {cache:'no-cache', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('Request failed');
    const next = validateSnapshot(await response.json());
    snapshot = next;
    matches = Object.values(next.sources).flatMap(s => s.matches);
    loadState = 'ready';
    status?.replaceChildren();
    for (const s of status ? Object.values(next.sources) : []) {
      const line=element('p');
      const source=element(safeSource(s.sourceUrl)?'a':'span','',s.name);
      if (safeSource(s.sourceUrl)) {source.href=s.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';}
      const checked=s.updatedAt?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(s.updatedAt)):'No successful sync yet';
      const stale=s.updatedAt && Date.now()-Date.parse(s.updatedAt)>6*3600000;
      const upstreamStale=s.upstreamGeneratedAt && Date.now()-Date.parse(s.upstreamGeneratedAt)>36*3600000;
      const generated=s.upstreamGeneratedAt?' · Source updated '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(s.upstreamGeneratedAt)):'';
      const state=s.status==='error' ? s.error==='configuration'?' · Source not configured':' · Sync failed. Data may be stale.' : stale||upstreamStale?' · Data may be stale' : s.availability==='offseason'?' · Season ended' : s.availability==='empty'?' · No upcoming matches from this source':'';
      line.append(source,element('span','',`: Last successful check ${checked}${generated}${state}${s.coverageNote?' · '+s.coverageNote:''}`));
      status.append(line);
    }
  } catch {
    loadState = snapshot ? 'ready' : 'error';
    if (status) status.textContent = snapshot ? 'Reload failed. Showing the last loaded data.' : 'Could not load the schedule. Check your connection and select Reload.';
  }
  render();
}
document.querySelector('#reload-schedule')?.addEventListener('click', loadSchedule);
loadSchedule();
