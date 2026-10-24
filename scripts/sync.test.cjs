const {test} = require('node:test');
const assert = require('node:assert/strict');
const {football, lol, update} = require('./sync.cjs');
const initial = require('../data/schedule.json');
const now = new Date('2026-11-07T00:00:00Z');
const fm = {id:1, status:'TIMED', competition:{name:'Premier League'}, homeTeam:{name:'Arsenal'}, awayTeam:{name:'Chelsea'}, utcDate:'2026-11-08T20:00:00Z'};
const lm = {id:2, status:'not_started', league:{name:'Worlds'}, opponents:[{opponent:{name:'A'}},{opponent:{name:'B'}}], scheduled_at:'2026-11-08T12:00:00Z'};
test('normalizes source IDs, missing opponents and unknown times', () => {
  assert.equal(football({matches:[fm]})[0].id,'football-data:1');
  assert.equal(football({matches:[{...fm,status:'FINISHED'}]}).length,0);
  const item = lol([{...lm,scheduled_at:null,opponents:[]}])[0];
  assert.equal(item.start,null);
  assert.equal(item.home,'待定');
  assert.equal(item.status,'时间待定');
  assert.throws(()=>football({matches:[{...fm,utcDate:'bad'}]}));
  assert.throws(()=>lol({error:'invalid'}));
});
test('uses authenticated headers, paginates and filters the seven-day window', async () => {
  let calls = 0;
  const fake = async (url, options) => {
    calls++;
    assert.ok(options.signal);
    if (url.hostname.includes('football-data')) {
      assert.equal(options.headers['X-Auth-Token'],'test-football');
      return {ok:true,json:async()=>({matches:[fm,{...fm,id:4,utcDate:'2026-11-06T12:00:00Z'}]})};
    }
    assert.equal(options.headers.Authorization,'Bearer test-lol');
    return {ok:true,json:async()=>url.searchParams.get('page') === '1' ? Array.from({length:100},(_,i)=>({...lm,id:i+100})) : [lm]};
  };
  const result = await update(initial,{FOOTBALL_DATA_TOKEN:'test-football',PANDASCORE_TOKEN:'test-lol'},fake,now);
  assert.equal(calls,3);
  assert.equal(result.failures,0);
  assert.equal(result.snapshot.sources.football.matches.length,1);
  assert.equal(result.snapshot.sources.lol.matches.length,101);
});
test('keeps the last successful source on failure; valid empty results replace it', async () => {
  const old = structuredClone(initial);
  old.sources.football = {...old.sources.football,updatedAt:now.toISOString(),matches:football({matches:[fm]})};
  const result = await update(old,{FOOTBALL_DATA_TOKEN:'test',PANDASCORE_TOKEN:'test'},async url=> {
    if (url.hostname.includes('football-data')) throw Error('network');
    return {ok:true,json:async()=>[]};
  },now);
  assert.equal(result.failures,1);
  assert.deepEqual(result.snapshot.sources.football.matches,old.sources.football.matches);
  assert.equal(result.snapshot.sources.football.updatedAt,old.sources.football.updatedAt);
  assert.equal(result.snapshot.sources.football.status,'error');
  assert.equal(result.snapshot.sources.lol.status,'ok');
  assert.deepEqual(result.snapshot.sources.lol.matches,[]);
});
