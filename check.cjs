const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = __dirname;
const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
const definitions = source.slice(0,source.indexOf('const page = document'));
const fixture = {sources:{
  football:{name:'football-data.org',status:'ok',updatedAt:'2026-11-07T00:00:00Z',matches:[{id:'football-data:1',sport:'football',league:'Premier League',home:'Arsenal',away:'Chelsea',start:'2026-11-07T20:00:00Z',status:'未开赛'}]},
  lol:{name:'PandaScore',status:'ok',updatedAt:'2026-11-07T00:00:00Z',matches:[{id:'pandascore:2',sport:'lol',league:'Worlds',home:'NOVA',away:'ECHO',start:'2026-11-07T12:00:00Z',status:'未开赛'},{id:'pandascore:3',sport:'lol',league:'Worlds',home:'待定',away:'ECHO',start:null,status:'时间待定'}]}
}};
for(const sport of ['cs2','valorant'])fixture.sources[sport]={name:sport,status:'ok',updatedAt:null,matches:[]};
for(const [sport,source] of Object.entries(fixture.sources)) {source.sourceUrl=sport==='football'?'https://github.com/openfootball/football.json':'https://github.com/zlypher/lol-events';for(const match of source.matches){match.stage='Stage 1';match.sourceUrl=source.sourceUrl;}}
const context = vm.createContext({fixture,Intl,URL});
vm.runInContext(definitions + '; matches = Object.values(validateSnapshot(fixture).sources).flatMap(s=>s.matches);',context);
function run(expression) { return vm.runInContext(expression,context); }
assert.equal(run("filterMatches(matches,{page:'sports'}).length"),1);
assert.equal(run("filterMatches(matches,{page:'esports'}).length"),2);
assert.equal(run("filterMatches(matches,{page:'sports',category:'lol'}).length"),0);
assert.equal(run("sports.filter(s=>s[3]==='esports').length"),3);
assert.equal(run("filterMatches([{...matches[0],sport:'cs2'}],{page:'esports',category:'cs2'}).length"),1);
assert.equal(run("filterMatches(matches,{page:'index',search:' nova '}).length"),1);
assert.equal(run("filterMatches(matches,{page:'index',date:'2026-11-08'}).length"),1);
assert.equal(run("filterMatches(matches,{page:'index',date:'2026-11-07'}).length"),1);
assert.equal(run("filterMatches(matches,{page:'favorites',favorites:['football-data:1']}).length"),1);
assert.equal(run("filterMatches(matches,{page:'favorites'}).length"),0);
assert.equal(run("filterMatches(matches,{page:'index'})[2].start"),null);
assert.throws(()=>run("validateSnapshot({sources:{}})"));
for (const file of ['index.html','sports.html','esports.html','favorites.html']) {
  const html = fs.readFileSync(path.join(root,file),'utf8');
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.match(html,/<html lang="zh-CN">/);
  assert.match(html,/aria-current="page"/);
  assert.match(html,/id="navigation-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="navigation-panel"/);
  assert.match(html,/<nav id="navigation-panel"[^>]* hidden><\/nav>/);
  assert.doesNotMatch(html,/class="(?:hero|pitch|manifesto|tagline)"/);
  for (const [,target] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (!target.startsWith('http')) assert.ok(fs.existsSync(path.join(root,target.split('?')[0])),`${file}: ${target}`);
  }
}
console.log('Passed: filtering, empty results, date ordering inputs, unique IDs, four-page links and semantic landmarks.');

// Minimal DOM harness checks real event handlers without third-party dependencies.
class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.attrs={}; this.events={}; this.dataset={}; this.value=''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=[...nodes]; }
  setAttribute(key,value) { this.attrs[key]=value; }
  addEventListener(key,handler) { this.events[key]=handler; }
  querySelector(tag) { for(const child of this.children) { if(child.tag===tag) return child; const found=child.querySelector(tag); if(found) return found; } return null; }
  focus() { this.focused=true; }
}
const nodes = Object.fromEntries(['categories','matches','search','date','feedback','result-count','filters','navigation-toggle','navigation-panel','sync-status','reload-schedule'].map(id=>['#'+id,new Element()]));
nodes['#navigation-panel'].hidden = true;
const documentEvents = {};
const body = {dataset:{page:'index'}};
const saved = new Map();
let failFetch = false;
const browser = vm.createContext({Intl,Date,Map,Set,URL,AbortSignal,fetch:async()=>{if(failFetch) throw Error('network'); return {ok:true,json:async()=>fixture};},document:{body,addEventListener:(key,handler)=>documentEvents[key]=handler,querySelector:s=>nodes[s],createElement:tag=>new Element(tag)},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},window:{addEventListener(){}}});
async function checkBrowser() {
vm.runInContext(source,browser);
assert.match(nodes['#result-count'].textContent,/正在加载/);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(nodes['#matches'].children.length,2);
let star=nodes['#matches'].querySelector('button');
star.events.click();
assert.equal(star.attrs['aria-pressed'],'true');
assert.deepEqual(JSON.parse(saved.get('matchday.favorites.v1')),['pandascore:2']);
star.events.click();
assert.deepEqual(JSON.parse(saved.get('matchday.favorites.v1')),[]);
nodes['#search'].value='NOVA'; nodes['#search'].events.input();
assert.match(nodes['#result-count'].textContent,/1 场/);
nodes['#search'].value='不存在'; nodes['#search'].events.input();
assert.equal(nodes['#matches'].children[0].className,'empty');
nodes['#filters'].events.reset();
assert.match(nodes['#result-count'].textContent,/3 场/);
const crest=vm.runInContext("teamBadge('Arsenal FC','assets/team-logos/arsenal.png')",browser);
const img=crest.querySelector('img');assert.ok(img);assert.equal(img.alt,'');
img.events.load();assert.equal(img.hidden,false);assert.equal(crest.children[0].hidden,true);
img.events.error();assert.equal(img.hidden,true);assert.equal(crest.children[0].hidden,false);
assert.equal(vm.runInContext("teamBadge('TBD','javascript:alert(1)').children.length",browser),1);
assert.equal(vm.runInContext("safeLogo('https://untrusted.example/logo.png')",browser),false);
console.log('Passed: crest loading, failed-image fallback and URL validation.');
console.log('Passed: DOM rendering, favorite toggles and persistence, search events, empty state and reset.');

const toggle = nodes['#navigation-toggle'];
const panel = nodes['#navigation-panel'];
toggle.events.click();
assert.equal(panel.hidden,false);
assert.equal(toggle.attrs['aria-expanded'],'true');
assert.equal(toggle.attrs['aria-label'],'收起侧边导航');
assert.equal(body.dataset.navigationOpen,'true');
assert.equal(panel.children.length,0);
documentEvents.keydown({key:'Enter'});
assert.equal(panel.hidden,false);
documentEvents.keydown({key:'Escape'});
assert.equal(panel.hidden,true);
assert.equal(toggle.attrs['aria-expanded'],'false');
assert.equal(toggle.attrs['aria-label'],'展开侧边导航');
assert.equal(body.dataset.navigationOpen,'false');
assert.equal(toggle.focused,true);
toggle.events.click();
toggle.events.click();
assert.equal(panel.hidden,true);
assert.equal(toggle.attrs['aria-expanded'],'false');
console.log('Passed: empty side navigation, button open/close, aria state, Escape close and returned focus.');

failFetch = true;
await vm.runInContext('loadSchedule()',browser);
assert.match(nodes['#sync-status'].textContent,/刷新失败/);
assert.match(nodes['#result-count'].textContent,/3 场/);
vm.runInContext('snapshot=null',browser);
await vm.runInContext('loadSchedule()',browser);
assert.match(nodes['#result-count'].textContent,/赛程加载失败/);
console.log('Passed: async loading, refresh fallback, initial load failure, Beijing date boundary and undated matches.');
}
checkBrowser().catch(error=>{console.error(error);process.exitCode=1;});
