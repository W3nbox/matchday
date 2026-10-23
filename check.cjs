const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = __dirname;
const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
const definitions = source.slice(0,source.indexOf('const page = document'));
const context = vm.createContext({});
vm.runInContext(definitions,context);
function run(expression) { return vm.runInContext(expression,context); }
assert.equal(run("filterMatches(matches,{page:'sports'}).length"),4);
assert.equal(run("filterMatches(matches,{page:'esports'}).length"),5);
assert.equal(run("filterMatches(matches,{page:'sports',category:'lol'}).length"),0);
assert.equal(run("filterMatches(matches,{page:'index',search:' nova '}).length"),1);
assert.equal(run("filterMatches(matches,{page:'index',date:'2026-11-08'}).length"),3);
assert.equal(run("filterMatches(matches,{page:'favorites',favorites:['f1','c1']}).length"),2);
assert.equal(run("filterMatches(matches,{page:'favorites'}).length"),0);
assert.equal(run("filterMatches(matches,{page:'index',search:'不存在'}).length"),0);
assert.equal(run("new Set(matches.map(m=>m.id)).size === matches.length"),true);
assert.equal(run("matches.every(m=>Number.isFinite(Date.parse(m.start)))"),true);
for (const file of ['index.html','sports.html','esports.html','favorites.html']) {
  const html = fs.readFileSync(path.join(root,file),'utf8');
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.match(html,/<html lang="zh-CN">/);
  assert.match(html,/aria-current="page"/);
  for (const [,target] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (!target.startsWith('http')) assert.ok(fs.existsSync(path.join(root,target)),`${file}: ${target}`);
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
const nodes = Object.fromEntries(['categories','matches','search','date','feedback','result-count','filters'].map(id=>['#'+id,new Element()]));
const saved = new Map();
const browser = vm.createContext({Intl,Date,Map,Set,document:{body:{dataset:{page:'index'}},querySelector:s=>nodes[s],createElement:tag=>new Element(tag)},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},window:{addEventListener(){}}});
vm.runInContext(source,browser);
assert.equal(nodes['#matches'].children.length,6);
let star=nodes['#matches'].querySelector('button');
star.events.click();
assert.equal(star.attrs['aria-pressed'],'true');
assert.deepEqual(JSON.parse(saved.get('matchday.favorites.v1')),['l1']);
star.events.click();
assert.deepEqual(JSON.parse(saved.get('matchday.favorites.v1')),[]);
nodes['#search'].value='NOVA'; nodes['#search'].events.input();
assert.match(nodes['#result-count'].textContent,/1 场/);
nodes['#search'].value='不存在'; nodes['#search'].events.input();
assert.equal(nodes['#matches'].children[0].className,'empty');
nodes['#filters'].events.reset();
assert.match(nodes['#result-count'].textContent,/9 场/);
console.log('Passed: DOM rendering, favorite toggles and persistence, search events, empty state and reset.');
