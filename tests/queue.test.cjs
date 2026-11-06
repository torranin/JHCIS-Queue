const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { allocateQueue, resetQueue, setNextQueue, getQueueStatus } = require('../lib/queue.ts');

const beforeMidnight = () => new Date('2026-10-23T16:59:59Z');
const afterMidnight = () => new Date('2026-10-23T17:00:00Z');
async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jhcis-queue-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('resets at Thai midnight, including an old request ID', async t => {
  const dir = await directory(t);
  const id = randomUUID();
  assert.equal(await allocateQueue(id, dir, beforeMidnight), 1);
  assert.equal(await allocateQueue(randomUUID(), dir, beforeMidnight), 2);
  assert.equal(await allocateQueue(id, dir, afterMidnight), 1);
  const state = JSON.parse(await fs.readFile(path.join(dir, 'queue.json'), 'utf8'));
  assert.equal(state.date, '2026-10-24');
  assert.equal(Object.keys(state.requests).length, 1);
});

test('preserves same-day counter and deduplicates retries after reloading state', async t => {
  const dir = await directory(t);
  const first = randomUUID();
  assert.equal(await allocateQueue(first, dir, beforeMidnight), 1);
  assert.equal(await allocateQueue(randomUUID(), dir, beforeMidnight), 2);
  assert.equal(await allocateQueue(first, dir, beforeMidnight), 1);
  assert.equal(await allocateQueue(randomUUID(), dir, beforeMidnight), 3);
});

test('migrates an undated file without reissuing today\'s numbers', async t => {
  const dir = await directory(t);
  const id = randomUUID();
  await fs.writeFile(path.join(dir, 'queue.json'), JSON.stringify({last:4, requests:{[id]:4}}));
  assert.equal(await allocateQueue(id, dir, beforeMidnight), 4);
  assert.equal(await allocateQueue(randomUUID(), dir, beforeMidnight), 5);
  assert.equal(await allocateQueue(randomUUID(), dir, afterMidnight), 1);
});

test('concurrent requests on a new day receive unique consecutive numbers', async t => {
  const dir = await directory(t);
  await allocateQueue(randomUUID(), dir, beforeMidnight);
  const numbers = await Promise.all(Array.from({length:8}, () => allocateQueue(randomUUID(), dir, afterMidnight)));
  assert.deepEqual(numbers.sort((a,b) => a-b), [1,2,3,4,5,6,7,8]);
});

test('manual reset restarts today at 1 and keeps subsequent allocations unique', async t => {
  const dir = await directory(t);
  await allocateQueue(randomUUID(), dir, beforeMidnight);
  await allocateQueue(randomUUID(), dir, beforeMidnight);
  await resetQueue(dir, beforeMidnight);
  const state = JSON.parse(await fs.readFile(path.join(dir, 'queue.json'), 'utf8'));
  assert.deepEqual(state, {date:'2026-10-23',last:0,requests:{}});
  const numbers = await Promise.all(Array.from({length:4}, () => allocateQueue(randomUUID(), dir, beforeMidnight)));
  assert.deepEqual(numbers.sort((a,b) => a-b), [1,2,3,4]);
});

test('editing the next queue continues from the selected value and resets next day', async t => {
 const dir=await directory(t);
 await allocateQueue(randomUUID(),dir,beforeMidnight);
 await setNextQueue(25,dir,beforeMidnight);
 assert.deepEqual(await getQueueStatus(dir,beforeMidnight),{date:'2026-10-23',last:24,nextNumber:25});
 const values=await Promise.all(Array.from({length:4},()=>allocateQueue(randomUUID(),dir,beforeMidnight)));
 assert.deepEqual(values.sort((a,b)=>a-b),[25,26,27,28]);
 assert.deepEqual(await getQueueStatus(dir,afterMidnight),{date:'2026-10-24',last:0,nextNumber:1});
 assert.equal(await allocateQueue(randomUUID(),dir,afterMidnight),1);
});

test('invalid queue edits leave the counter unchanged', async t => {
 const dir=await directory(t);
 await setNextQueue(12,dir,beforeMidnight);
 for(const invalid of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,'25'])await assert.rejects(()=>setNextQueue(invalid,dir,beforeMidnight));
 assert.equal((await getQueueStatus(dir,beforeMidnight)).nextNumber,12);
 assert.equal(await allocateQueue(randomUUID(),dir,beforeMidnight),12);
});