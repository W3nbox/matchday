'use strict';
// shortcut: 仅使用虚构赛程，确定合法数据源后替换本地数据。
const matches = [
  {id:'f1',sport:'football',league:'城市足球邀请赛',home:'北岸竞技',away:'南城联队',start:'2026-11-07T19:30:00+08:00'},
  {id:'f2',sport:'football',league:'城市足球邀请赛',home:'海港之星',away:'山城青年',start:'2026-11-07T21:00:00+08:00'},
  {id:'b1',sport:'basketball',league:'周末篮球挑战赛',home:'东城飞鹰',away:'西岸雷霆',start:'2026-11-08T09:00:00+08:00'},
  {id:'b2',sport:'basketball',league:'周末篮球挑战赛',home:'极光篮球队',away:'烈焰篮球队',start:'2026-11-09T10:30:00+08:00'},
  {id:'l1',sport:'lol',league:'英雄联盟 · 星河邀请赛',home:'NOVA 星辰',away:'ECHO 回响',start:'2026-11-07T18:00:00+08:00'},
  {id:'l2',sport:'lol',league:'英雄联盟 · 星河邀请赛',home:'MIST 迷雾',away:'DAWN 黎明',start:'2026-11-08T19:00:00+08:00'},
  {id:'c1',sport:'cs2',league:'CS2 · 巅峰挑战赛',home:'VECTOR 向量',away:'PULSE 脉冲',start:'2026-11-08T20:00:00+08:00'},
  {id:'v1',sport:'valorant',league:'VALORANT · 新锐杯',home:'ORBIT 轨道',away:'SPARK 火花',start:'2026-11-09T17:00:00+08:00'},
  {id:'d1',sport:'dota2',league:'DOTA 2 · 远征邀请赛',home:'TIDAL 潮汐',away:'SUMMIT 山巅',start:'2026-11-10T18:30:00+08:00'}
];
const sports = [
  ['football','足球','⚽','sports'], ['basketball','篮球','◉','sports'],
  ['lol','英雄联盟','L','esports'], ['cs2','CS2','⌖','esports'],
  ['valorant','VALORANT','V','esports'], ['dota2','DOTA 2','D','esports']
];
function filterMatches(items, {page, category='all', search='', date='', favorites=[]}) {
  const allowed = sports.filter(s => page !== 'sports' && page !== 'esports' || s[3] === page).map(s => s[0]);
  const query = search.trim().toLocaleLowerCase();
  return items.filter(m => allowed.includes(m.sport)
    && (page !== 'favorites' || favorites.includes(m.id))
    && (category === 'all' || m.sport === category)
    && (!date || m.start.slice(0,10) === date)
    && `${m.home} ${m.away} ${m.league}`.toLocaleLowerCase().includes(query))
    .sort((a,b) => Date.parse(a.start) - Date.parse(b.start));
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
  if (Array.isArray(stored)) favorites = stored.filter(id => matches.some(m => m.id === id));
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
  document.querySelector('#result-count').textContent = `找到 ${filtered.length} 场演示比赛 · 演示日期：2026.11.07—11.10`;
  if (!filtered.length) {
    const empty = element('div','empty');
    empty.append(element('p','',page === 'favorites' ? '还没有符合条件的关注赛事，或当前筛选没有结果。' : '没有符合条件的演示比赛，试试其他项目或日期。'));
    const link = element('a','','浏览全部赛事 →');
    link.href = 'index.html';
    empty.append(link);
    container.append(empty);
  }
  const groups = new Map();
  for (const match of filtered) {
    let group = groups.get(match.league);
    if (!group) {
      group = element('section','league');
      const heading = element('h3','',match.league);
      heading.append(element('span','','演示 · 未开赛'));
      group.append(heading);
      groups.set(match.league,group);
      container.append(group);
    }
    const row = element('article','match');
    row.setAttribute('aria-label', `${match.home} 对阵 ${match.away}`);
    const teams = element('div','teams');
    const homeBadge = element('span','badge',match.home.slice(0,2).toUpperCase());
    const awayBadge = element('span','badge away',match.away.slice(0,2).toUpperCase());
    homeBadge.setAttribute('aria-hidden','true');
    awayBadge.setAttribute('aria-hidden','true');
    const names = element('div','team-names');
    names.append(element('span','',match.home), element('span','versus','VS'), element('span','',match.away));
    teams.append(homeBadge,awayBadge,names);
    const time = element('time','',new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(match.start)));
    time.dateTime = match.start;
    time.append(element('small','',new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date(match.start))));
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
    favorites = Array.isArray(stored) ? stored.filter(id => matches.some(m => m.id === id)) : [];
    render();
  } catch { feedback.textContent = '其他页面的收藏数据无法读取，请刷新后重试。'; }
});
render();
