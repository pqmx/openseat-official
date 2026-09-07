import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const database = process.env.DATABASE_URL;
if (!database || !['127.0.0.1', 'localhost'].includes(new URL(database).hostname)) {
  throw new Error('Use DATABASE_URL for an isolated localhost test database.');
}
const run = promisify(execFile);
const query = async (sql) => (await run('psql', [database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql])).stdout.trim();
const who = randomUUID();
try {
  await query(`insert into auth.users(id,email) values ('${who}','concurrency-${who}@ucla.edu')`);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => query(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"${who}"}',true);
    select public.create_room('Concurrency test','Powell',now(),4,'open',null,34.07,-118.44);
    select pg_sleep(0.05);
    commit;
  `)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  for (const result of results) {
    if (result.status === 'rejected') assert.match(result.reason.stderr, /too many rooms/);
  }
  assert.equal(await query(`select count(*) from public.rooms where host_id='${who}'`), '5');
  console.log('concurrent room creation: 5 accepted, 3 rate-limited');
} finally {
  await query(`delete from public.profiles where id='${who}'; delete from auth.users where id='${who}';`);
}
