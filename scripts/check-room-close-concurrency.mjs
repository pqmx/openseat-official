import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const database = process.env.DATABASE_URL;
if (!database || !['localhost', '127.0.0.1'].includes(new URL(database).hostname))
  throw new Error('Use an isolated localhost test database.');
const run = promisify(execFile);
const query = async (sql) => (await run('psql', [database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql])).stdout.trim();
const host = randomUUID(), guest = randomUUID();
const rooms = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const auth = (id) => `set local role authenticated; select set_config('request.jwt.claims','{"sub":"${id}"}',true);`;
try {
  await query(`insert into auth.users(id,email) values ('${host}','${host}@ucla.edu'),('${guest}','${guest}@ucla.edu');
    update public.profiles set year='Grad' where id in ('${host}','${guest}');`);
  for (const [i, room] of rooms.entries()) {
    await query(`insert into public.rooms(id,title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
      values('${room}','Close race','Campus','${host}',now(),5,'${i === 1 || i === 3 ? 'approve' : 'open'}',34,-118);
      insert into public.room_members(room_id,profile_id,state) values('${room}','${host}','member');`);
    if (i === 3) await query(`begin; ${auth(guest)} insert into public.room_members(room_id,profile_id,state) values('${room}','${guest}','requested'); commit;`);
    const marker = 'close-' + room;
    const closing = query(`begin; ${auth(host)} set local application_name='${marker}';
      update public.rooms set ended_at=now() where id='${room}'; select pg_sleep(0.4); commit;`);
    // Wait for the closer to own the row lock. No timing assumption about process startup.
    const deadline = Date.now() + 5000;
    while (await query(`select count(*) from pg_stat_activity where application_name='${marker}' and wait_event='PgSleep'`) !== '1') {
      if (Date.now() > deadline) throw Error('Closer never acquired its lock');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const statement = i === 2
      ? `insert into public.room_updates(room_id,author_id,body) values('${room}','${host}','Too late')`
      : i === 3 ? `update public.room_members set state='member' where room_id='${room}' and profile_id='${guest}'`
      : `insert into public.room_members(room_id,profile_id,state) values('${room}','${guest}','${i === 1 ? 'requested' : 'member'}')`;
    await assert.rejects(query(`begin; ${auth(i >= 2 ? host : guest)} ${statement}; commit;`),
      (error) => /This room is closed/.test(error.stderr));
    await closing;
    assert.equal(await query(`select count(*) from public.room_members where room_id='${room}' and profile_id='${guest}' and state='member'`), '0');
  }
  console.log('room-close concurrency passed: join, request, update, approval');
} finally {
  await query(`delete from public.profiles where id in ('${host}','${guest}'); delete from auth.users where id in ('${host}','${guest}');`);
}
