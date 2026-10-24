'use strict';
let matches = [];
let snapshot = null;
let loadState = 'loading';
const sports = [['football','足球','⚽','sports'], ['lol','英雄联盟','L','esports'], ['cs2','CS2','⌖','esports'], ['valorant','瓦洛兰特','V','esports']];
function beijingDate(value) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function safeSource(value) {
  try {const url=new URL(value);return url.protocol==='https:' && ['raw.githubusercontent.com','github.com'].includes(url.hostname);} catch {return false;}
}
function safeLogo(value) {
  if(typeof value!=='string') return false;
  if(/^assets\/team-logos\/[a-z0-9-]+\.png$/.test(value)) return true;
  try {const url=new URL(value);return url.protocol==='https:' && url.hostname==='cdn-api.pandascore.co' && url.pathname.startsWith('/images/team/');}catch{return false;}
}
function validateSnapshot(data) {
  if (!data || !data.sources) throw Error('Invalid snapshot');
  const ids = new Set();
  for (const sport of ['football','lol','cs2','valorant']) {
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
  navigationToggle.setAttribute('aria-label', open ? '收起侧边导航' : '展开侧边导航');
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
  feedback.textContent = '无法读取本地收藏。你仍可浏览赛事并在本次会话中关注。';
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
const categoryItems = [['all','全部项目','↗'], ...sports.filter(s => page !== 'sports' && page !== 'esports' || s[3] === page)];
for (const [id, name, icon] of categoryItems) {
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
  const filtered = filterMatches(matches, {page, category, search:search.value, date:date.value, favorites});
  container.replaceChildren();
  document.querySelector('#result-count').textContent = loadState === 'loading' ? '正在加载赛程…' : loadState === 'error' ? '赛程加载失败，请稍后重试。' : `找到 ${filtered.length} 场比赛`;
  if (loadState !== 'ready') return;
  if (!filtered.length) {
    const empty = element('div','empty');
    empty.append(element('p','',page === 'favorites' ? '还没有符合条件的关注赛事，或当前筛选没有结果。' : '没有符合条件的赛程；尚未同步的数据源不代表没有比赛。'));
    const link = element('a','','浏览全部赛事 →');
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
      heading.append(element('span','','北京时间'));
      group.append(heading);
      groups.set(groupName,group);
      container.append(group);
    }
    const row = element('article','match');
    row.setAttribute('aria-label', `${match.home} 对阵 ${match.away}`);
    const teams = element('div','teams');
    for(const [name,logo] of [[match.home,match.homeLogo],[match.away,match.awayLogo]]) {
      const row=element('div','team-row');
      row.append(teamBadge(name,logo),element('span','team-name',name));
      teams.append(row);
    }
    const time = element(match.start ? 'time' : 'div','match-time', match.start && match.status !== '时间待定' ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(match.start)) : '待定');
    if (match.start) {
      time.dateTime = match.start;
      time.append(element('small','',new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date(match.start))));
    }
    time.append(element('small','',match.status));
    const star = element('button','star');
    star.type = 'button';
    const updateStar = () => {
      const selected = favorites.includes(match.id);
      star.textContent = selected ? '★' : '☆';
      star.setAttribute('aria-pressed',String(selected));
      star.setAttribute('aria-label',`${selected ? '取消关注' : '关注'} ${match.home} 对阵 ${match.away}`);
    };
    updateStar();
    star.addEventListener('click', () => {
      favorites = favorites.includes(match.id) ? favorites.filter(id => id !== match.id) : [...favorites,match.id];
      let saved = true;
      try { localStorage.setItem(storageKey,JSON.stringify(favorites)); }
      catch { saved = false; }
      updateStar();
      feedback.textContent = saved ? '关注清单已更新，仅保存在当前浏览器。' : '本地存储不可用，关注仅保留至本页面关闭。';
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
search.addEventListener('input',render);
date.addEventListener('change',render);
document.querySelector('#filters').addEventListener('submit',event => event.preventDefault());
document.querySelector('#filters').addEventListener('reset', () => {
  search.value = '';
  date.value = '';
  category = 'all';
  for (const button of categories.children) button.setAttribute('aria-pressed',String(button.dataset.category === 'all'));
  render();
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  try {
    const stored = JSON.parse(event.newValue || '[]');
    favorites = Array.isArray(stored) ? stored.filter(id => typeof id === 'string') : [];
    render();
  } catch { feedback.textContent = '其他页面的收藏数据无法读取，请刷新后重试。'; }
});
render();

async function loadSchedule() {
  loadState = 'loading';
  render();
  const status = document.querySelector('#sync-status');
  status.textContent = '正在读取赛程数据…';
  try {
    const response = await fetch('data/schedule.json', {cache:'no-cache', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('Request failed');
    const next = validateSnapshot(await response.json());
    snapshot = next;
    matches = Object.values(next.sources).flatMap(s => s.matches);
    loadState = 'ready';
    const relevant = Object.entries(next.sources).filter(([sport]) => page !== 'sports' && page !== 'esports' || sports.find(s => s[0] === sport)[3] === page);
    status.replaceChildren();
    for (const [,s] of relevant) {
      const line=element('p');
      const source=element(safeSource(s.sourceUrl)?'a':'span','',s.name);
      if (safeSource(s.sourceUrl)) {source.href=s.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';}
      const checked=s.updatedAt?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(s.updatedAt)):'尚未成功同步';
      const stale=s.updatedAt && Date.now()-Date.parse(s.updatedAt)>6*3600000;
      const upstreamStale=s.upstreamGeneratedAt && Date.now()-Date.parse(s.upstreamGeneratedAt)>36*3600000;
      const generated=s.upstreamGeneratedAt?' · 上游生成 '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(s.upstreamGeneratedAt)):'';
      const state=s.status==='error' ? s.error==='configuration'?' · 数据源尚未接通':' · 同步失败，旧数据可能过期' : stale||upstreamStale?' · 数据可能过期' : s.availability==='offseason'?' · 收录赛季已结束' : s.availability==='empty'?' · 查询窗口内暂无赛程':'';
      line.append(source,element('span','',`：最近成功检查 ${checked}${generated}${state}`));
      status.append(line);
    }
  } catch {
    loadState = snapshot ? 'ready' : 'error';
    status.textContent = snapshot ? '刷新失败，继续显示本页面上次加载的数据。' : '无法读取赛程。请检查网络后点击「重新加载」。';
  }
  render();
}
document.querySelector('#reload-schedule').addEventListener('click', loadSchedule);
loadSchedule();
