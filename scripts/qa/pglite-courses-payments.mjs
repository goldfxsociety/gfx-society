import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
const R=new URL('../../supabase/',import.meta.url).pathname;
const db=new PGlite({extensions:{pgcrypto}});
let pass=0,fail=0;
const x=async s=>{await db.exec(s)};
const as=async(role,uid,s)=>{await x(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role}`);try{return (await db.query(s)).rows}finally{await x('reset role')}};
const expectOk=async(label,role,uid,s,check)=>{try{const r=await as(role,uid,s);const ok=check?check(r):true;ok?pass++:fail++;console.log(ok?'PASS':'FAIL',label,ok?'':JSON.stringify(r))}catch(e){fail++;console.log('FAIL',label,e.message)}};
const expectErr=async(label,role,uid,s,re)=>{try{const r=await as(role,uid,s);fail++;console.log('FAIL(no error)',label,JSON.stringify(r))}catch(e){const ok=!re||re.test(e.message);ok?pass++:fail++;console.log(ok?'PASS':'FAIL',label,'=>',e.message)}};
await x(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions; create schema storage;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'amr', '[{"method":"otp"}]'::jsonb) $$;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant select,insert,delete on storage.objects to anon, authenticated; grant execute on function storage.foldername(text) to anon, authenticated;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
await x(fs.readFileSync(R+'migrations/20261102120000_members_gate_allowlist.sql','utf8'));
await x(fs.readFileSync(R+'migrations/20261102130000_members_gate_email_otp.sql','utf8'));
const mig=fs.readFileSync(R+'migrations/20261102140000_courses_payments.sql','utf8');
await x(mig); await x(mig); console.log('applied twice OK');
for (const f of fs.readdirSync(R+'migrations').filter(f=>f>'20261102140000'&&f.includes('seed'))) {const s=fs.readFileSync(R+'migrations/'+f,'utf8'); await x(s); await x(s); console.log('seed applied twice',f);}
const vf=R+'verification/20261102140000_courses_payments_verify.sql';
if (fs.existsSync(vf)) console.log('VERIFY', JSON.stringify((await db.query(fs.readFileSync(vf,'utf8'))).rows));
const M='11111111-1111-1111-1111-111111111111',N='22222222-2222-2222-2222-222222222222',AD='33333333-3333-3333-3333-333333333333',M2='44444444-4444-4444-4444-444444444444';
await x(`insert into auth.users values ('${M}','m@example.test',now()),('${N}','n@example.test',now()),('${AD}','ad@example.test',now()),('${M2}','m2@example.test',now())`);
await x(`select private.import_allowlist('[{"email":"m@example.test","role":"client"},{"email":"ad@example.test","role":"ib"},{"email":"m2@example.test","role":"client"}]')`);
for (const u of [M,AD,M2]) await as('authenticated',u,`select public.record_member_consent('join-v2')`);
await x(`insert into public.admins values ('${AD}')`);
// test paid course (seed keeps paid courses draft; make a throwaway one)
await x(`insert into public.training_courses(slug,title,level,price_php,status,sales_open) values ('test-paid','Test','course',2000,'open',true)`);
await x(`insert into public.training_courses(slug,title,level,price_php,status,sales_open) values ('test-closed','Closed','course',2000,'open',false)`);
await x(`insert into public.training_modules(course_id,sort,slug,title) select id,1,'m1','M1' from public.training_courses where slug='test-paid';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,1,'l1','L1','published' from public.training_modules where slug='m1';`);
const P=n=>`${n}0000000-0000-0000-0000-00000000000${n}`;
const sub=(id,uid,amt,ref,sha,slug='test-paid',ext='png')=>`select public.submit_course_purchase('${slug}',${amt},'${ref}','${uid}/${id}.${ext}','${sha.repeat(64).slice(0,64)}')`;
const PID=u=>`(select id from public.course_purchases where user_id='${u}')`;
// RLS denials
await expectErr('anon cannot select purchases','anon','',`select * from public.course_purchases`,/permission/);
await expectErr('anon cannot submit','anon','',sub(P(1),M,2000,'1234 567 890123','a'),/permission/);
await expectErr('non-member cannot submit','authenticated',N,sub(P(1),N,2000,'1234 567 890123','a'),/not a member/);
await expectErr('member cannot insert purchase directly','authenticated',M,`insert into public.course_purchases(user_id,course_id,price_php,amount_entered,payment_code,gcash_ref,receipt_sha256) select '${M}',id,0,1,'x','1','${'a'.repeat(64)}' from public.training_courses limit 1`,/permission/);
await expectErr('closed sales -> no submit','authenticated',M,sub(P(1),M,2000,'1234567890123','a','test-closed'),/not for sale/);
await expectErr('path must be own folder','authenticated',M,`select public.submit_course_purchase('test-paid',2000,'1','${M2}/${P(1)}.png','${'a'.repeat(64)}')`,/bad receipt path/);
// flags
await expectOk('clean submit no flags','authenticated',M,sub(P(1),M,2000,'1234 567 890123','a'),r=>JSON.stringify(r[0].submit_course_purchase.flags)==='[]');
await expectOk('stored ref normalized','authenticated',M,`select gcash_ref from public.course_purchases`,r=>r.length===1&&r[0].gcash_ref==='1234567890123');
await expectErr('single pending per course','authenticated',M,sub(P(2),M,2000,'9999999999999','b'),/already pending/);
await expectOk('M2: member sees only amount_mismatch (dup flags admin-only)','authenticated',M2,sub(P(3),M2,1999,'1234-567-890123','a'),r=>JSON.stringify(r[0].submit_course_purchase.flags)==='["amount_mismatch"]');
await expectOk('M2: admin sees dup ref + dup image + amount mismatch','authenticated',AD,`select flags from public.course_purchases where user_id='${M2}'`,r=>{const f=r[0].flags;return f.includes('duplicate_ref')&&f.includes('duplicate_image')&&f.includes('amount_mismatch')&&!f.includes('check_format')});
await expectOk('normalize same value','authenticated',M,`select public.normalize_gcash_ref('1234 567 890123')=public.normalize_gcash_ref('1234-567-890123') as eq`,r=>r[0].eq===true);
await expectOk('M sees only own purchase','authenticated',M,`select user_id from public.course_purchases`,r=>r.length===1&&r[0].user_id===M);
await expectErr('member cannot update own purchase','authenticated',M,`update public.course_purchases set status='approved'`,/permission/);
await expectErr('member cannot decide','authenticated',M,`select public.decide_course_purchase(${PID(M)},'approved',null)`,/admin only/);
await expectErr('reject needs reason','authenticated',AD,`select public.decide_course_purchase(${PID(M2)},'rejected','')`,/reason required/);
await expectOk('admin sees all','authenticated',AD,`select count(*)::int n from public.course_purchases`,r=>r[0].n===2);
await expectOk('no access before approval','authenticated',M,`select public.has_course_access(id) a, public.has_paid_access() p from public.training_courses where slug='test-paid'`,r=>r[0].a===false&&r[0].p===false);
await expectOk('lesson hidden before approval','authenticated',M,`select * from public.training_lessons`,r=>r.length===0);
await expectOk('admin approve returns receipt path','authenticated',AD,`select public.decide_course_purchase(${PID(M)},'approved',null) d`,r=>r[0].d.receipt_path===`${M}/${P(1)}.png`);
await expectErr('decide twice','authenticated',AD,`select public.decide_course_purchase(${PID(M)},'rejected','dup')`,/already decided/);
await expectErr('approving same ref twice blocked','authenticated',AD,`select public.decide_course_purchase(${PID(M2)},'approved',null)`,/already approved/);
await expectOk('reject with reason','authenticated',AD,`select public.decide_course_purchase(${PID(M2)},'rejected','Duplicate receipt') d`,r=>r[0].d.status==='rejected');
// receipt deletion path (storage policies)
await x(`insert into storage.objects(bucket_id,name) values ('receipts','${M}/${P(1)}.png'),('receipts','${M2}/${P(3)}.png'),('receipts','${M}/orphan.png'),('payment-assets','gcash-qr.png')`);
await expectOk('member reads only own receipt objects','authenticated',M,`select name from storage.objects where bucket_id='receipts'`,r=>r.length===2&&r.every(x=>x.name.startsWith(M)));
await expectOk('M2 cannot read M receipts','authenticated',M2,`select name from storage.objects where name like '${M}%'`,r=>r.length===0);
await expectOk('member cannot delete referenced receipt','authenticated',M,`delete from storage.objects where name='${M}/${P(1)}.png' returning name`,r=>r.length===0);
await expectOk('member can delete own orphan upload','authenticated',M,`delete from storage.objects where name='${M}/orphan.png' returning name`,r=>r.length===1);
await expectOk('admin reads receipts','authenticated',AD,`select name from storage.objects where bucket_id='receipts'`,r=>r.length===2);
await expectOk('admin deletes receipt after decision','authenticated',AD,`delete from storage.objects where name='${M}/${P(1)}.png' returning name`,r=>r.length===1);
await expectOk('mark_receipt_deleted','authenticated',AD,`select public.mark_receipt_deleted(${PID(M)})`);
await expectOk('receipt_path null after','authenticated',M,`select receipt_path, receipt_deleted_at is not null d from public.course_purchases`,r=>r[0].receipt_path===null&&r[0].d===true);
await expectOk('member upload into own folder','authenticated',M,`insert into storage.objects(bucket_id,name) values ('receipts','${M}/x.png') returning name`,r=>r.length===1);
await expectErr('member upload into other folder','authenticated',M,`insert into storage.objects(bucket_id,name) values ('receipts','${M2}/x.png')`,/row-level security/);
await expectErr('non-member upload','authenticated',N,`insert into storage.objects(bucket_id,name) values ('receipts','${N}/x.png')`,/row-level security/);
await expectErr('member cannot upload QR','authenticated',M,`insert into storage.objects(bucket_id,name) values ('payment-assets','gcash-qr.png')`,/row-level security/);
await expectOk('member can see QR object','authenticated',M,`select name from storage.objects where bucket_id='payment-assets'`,r=>r.length===1);
await expectOk('non-member cannot see QR','authenticated',N,`select name from storage.objects where bucket_id='payment-assets'`,r=>r.length===0);
await expectOk('anon cannot see QR','anon','',`select name from storage.objects`,r=>r.length===0);
// access after approval
await expectOk('access after approval','authenticated',M,`select public.has_course_access(id) a, public.has_paid_access() p from public.training_courses where slug='test-paid'`,r=>r[0].a===true&&r[0].p===true);
// S8 = A (Ben, 2 Nov: "A for now, lets decide later on"): bought course stays open after delist; switch is private.keep_bought_courses_after_delist().
await x(`delete from private.member_allowlist where email_hash=private.email_hash('m@example.test'); update public.member_status set allowlist_status='grace', grace_until=now()-interval '1 day' where user_id='${M}'`);
await expectOk('S8 delisted: not a member, bought course still open','authenticated',M,`select public.has_course_access(id) a, public.is_member() m, public.my_payment_info('test-paid')->>'state' s from public.training_courses where slug='test-paid'`,r=>r[0].a===true&&r[0].m===false&&r[0].s==='approved');
await expectOk('S8 delisted: bought lessons readable','authenticated',M,`select count(*)::int c from public.training_lessons l join public.training_modules m on m.id=l.module_id join public.training_courses c on c.id=m.course_id where c.slug='test-paid'`,r=>r[0].c>0);
await expectOk('S8 delisted: quiz still usable','authenticated',M,`select public.get_lesson_quiz(l.id) q from public.training_lessons l where slug='l1'`,r=>r.length===1);
await expectOk('S8 delisted: free/unbought courses locked','authenticated',M,`select bool_or(public.has_course_access(id)) a from public.training_courses where slug<>'test-paid'`,r=>r[0].a!==true);
await expectOk('S8 delisted: other course pay state not_member','authenticated',M,`select public.my_payment_info(slug)->>'state' s from public.training_courses where slug<>'test-paid' and status='open' and price_php>0 limit 1`,r=>r.length===0||r[0].s==='not_member');
await expectErr('S8 delisted: cannot buy new course','authenticated',M,sub(P(8),M,2000,'1111111111111','f','gold-advanced-setups'),/not a member/);
await expectOk('S8 delisted: purchase record kept','authenticated',AD,`select count(*)::int c from public.course_purchases where user_id='${M}' and status='approved'`,r=>r[0].c===1);
await x(`select private.import_allowlist('[{"email":"m@example.test","role":"client"},{"email":"ad@example.test","role":"ib"},{"email":"m2@example.test","role":"client"}]')`);
await expectOk('S8 relisted: nothing changes for bought course, no re-payment','authenticated',M,`select public.has_course_access(id) a, (public.my_payment_info('test-paid'))->>'state' s, (select count(*)::int from public.course_purchases where user_id='${M}') n from public.training_courses where slug='test-paid'`,r=>r[0].a===true&&r[0].s==='approved'&&r[0].n===1);
await expectOk('published lesson visible after approval','authenticated',M,`select slug from public.training_lessons`,r=>r.some(x=>x.slug==='l1'));
await expectOk('M2 (rejected) still no access','authenticated',M2,`select public.has_paid_access() p`,r=>r[0].p===false);
const before=(await db.query(`select id,payment_code from public.course_purchases where user_id='${M2}'`)).rows[0];
await expectOk('B-AC3 re-upload: 12-digit gets check_format, returns old path','authenticated',M2,sub(P(4),M2,2000,'123456789012','c'),r=>r[0].submit_course_purchase.flags.includes('check_format')&&r[0].submit_course_purchase.old_receipt_path===`${M2}/${P(3)}.png`);
await expectOk('B-AC3 same row id + code, pending, reason cleared, history kept','authenticated',M2,`select id,payment_code,status,reject_reason,jsonb_array_length(history) h from public.course_purchases`,r=>r.length===1&&r[0].id===before.id&&r[0].payment_code===before.payment_code&&r[0].status==='pending'&&r[0].reject_reason===null&&r[0].h===1);
await expectOk('payment code GFX-XXXX no 0/O/1/I','authenticated',M2,`select payment_code c from public.course_purchases`,r=>/^GFX-[A-HJ-NP-Z2-9]{4}$/.test(r[0].c));
await expectOk('owner can delete replaced old receipt','authenticated',M2,`delete from storage.objects where name='${M2}/${P(3)}.png' returning name`,r=>r.length===1);
await expectOk('admin list masks email','authenticated',AD,`select email_masked from public.admin_list_purchases('pending')`,r=>r.length===1&&r[0].email_masked==='m2***@example.test');
await expectErr('member cannot admin list','authenticated',M2,`select * from public.admin_list_purchases('pending')`,/admin only/);
// B9 placement / prereq lock
await x(`insert into public.training_courses(slug,title,level,price_php,status,sales_open) values ('t-basics','B','course',0,'open',false);
insert into public.training_courses(slug,title,level,price_php,status,sales_open,prereq_course_id) select 't-adv','A','course',2000,'open',true,id from public.training_courses where slug='t-basics';
insert into public.training_modules(course_id,sort,slug,title) select id,1,'am','AM' from public.training_courses where slug='t-adv';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,1,'al','AL','published' from public.training_modules where slug='am';
insert into public.training_modules(course_id,sort,slug,title) select id,1,'bm','BM' from public.training_courses where slug='t-basics';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,1,'bl','BL','published' from public.training_modules where slug='bm';
insert into private.placement_quizzes select id,(select jsonb_agg(jsonb_build_object('q','q'||g,'options',jsonb_build_array('a','b'),'answer_index',1)) from generate_series(1,10) g) from public.training_courses where slug='t-adv';`);
await expectOk('B-AC2 locked state','authenticated',M2,`select public.my_payment_info('t-adv')->>'state' s`,r=>r[0].s==='locked');
await expectErr('B-AC2 pay blocked server-side when locked','authenticated',M2,sub(P(6),M2,2000,'1234567890123','f','t-adv'),/prerequisite/);
await expectOk('placement questions hide answers','authenticated',M2,`select public.get_placement_quiz('t-adv') q`,r=>!JSON.stringify(r[0].q).includes('answer_index')&&r[0].q.questions.length===10);
await expectOk('placement 70% fails + cooldown','authenticated',M2,`select public.submit_placement_quiz('t-adv',array[1,1,1,1,1,1,1,0,0,0]) s`,r=>r[0].s.passed===false&&r[0].s.cooldown_until);
await expectOk('retry within 24h refused','authenticated',M2,`select public.submit_placement_quiz('t-adv',array[1,1,1,1,1,1,1,1,1,1]) s`,r=>r[0].s.cooldown_until&&r[0].s.passed===undefined);
await x(`update public.placement_attempts set attempted_at=now()-interval '25 hours'`);
await expectOk('placement 80% passes after cooldown','authenticated',M2,`select public.submit_placement_quiz('t-adv',array[1,1,1,1,1,1,1,1,0,0]) s`,r=>r[0].s.passed===true);
await expectOk('unlocked -> open','authenticated',M2,`select public.my_payment_info('t-adv')->>'state' s`,r=>r[0].s==='open');
await expectOk('non-member cannot take placement','authenticated',N,`select public.get_placement_quiz('t-adv') q`,r=>r[0].q===null);
await expectOk('basics complete unlocks (M via progress)','authenticated',M,`select public.prereq_met(id) p from public.training_courses where slug='t-adv'`,r=>r[0].p===false);
await x(`update public.training_lessons set status='draft' where slug='al'`);
await expectOk('B11 draft lesson -> coming_soon','authenticated',M2,`select public.my_payment_info('t-adv')->>'state' s`,r=>r[0].s==='coming_soon');
await expectErr('B11 draft lesson -> submit blocked','authenticated',M2,sub(P(7),M2,2000,'1234567890123','g','t-adv'),/not for sale/);
await x(`update public.training_lessons set status='published' where slug='al'`);
// grace removal -> lose access
await x(`select private.import_allowlist('[{"email":"ad@example.test","role":"ib"},{"email":"m2@example.test","role":"client"}]')`);
await x(`update public.member_status set grace_until=now()-interval '1 minute' where user_id='${M}'`);
await expectOk('removed member loses access','authenticated',M,`select public.has_paid_access() p`,r=>r[0].p===false);
// summary
await expectOk('summary: no token configured -> unauthorized','anon','',`select public.pending_payments_summary('x') s`,r=>r[0].s.error==='unauthorized');
await x(`insert into private.app_settings values ('payments_summary_token_sha256', encode(extensions.digest('test-token','sha256'),'hex'))`);
await expectOk('summary: wrong token','anon','',`select public.pending_payments_summary('nope') s`,r=>r[0].s.error==='unauthorized');
await expectOk('summary: right token counts only','anon','',`select public.pending_payments_summary('test-token') s`,r=>{const k=Object.keys(r[0].s).sort().join();return k==='oldest_pending_at,pending_count'&&r[0].s.pending_count===1});
await expectErr('anon cannot read rate table','anon','',`select * from private.api_rate_limits`,/permission/);
await x(`delete from private.api_rate_limits`);
for(let i=0;i<61;i++) await as('anon','',`select public.pending_payments_summary('nope')`);
await expectOk('QA P2: 61 junk calls -> junk caller rate limited','anon','',`select public.pending_payments_summary('nope') s`,r=>r[0].s.error==='rate_limited');
await expectOk('QA P2: valid token still works after junk flood','anon','',`select public.pending_payments_summary('test-token') s`,r=>typeof r[0].s.pending_count==='number');
await expectOk('QA P3: anon-passed IP ignored (stays in shared bucket, still limited)','anon','',`select public.pending_payments_summary('nope','203.0.113.9') s`,r=>r[0].s.error==='rate_limited');
await expectOk('QA P3: rotating fake IPs add no rows','postgres','',`select count(*)::int n from private.api_rate_limits where bucket like 'pending_summary_fail:%'`,r=>r[0].n===1);
await x(`select set_config('request.headers','{"x-forwarded-for":"198.51.100.7, 10.0.0.1"}',false)`);
await expectOk('QA P3: IP from request headers gets its own bucket','anon','',`select public.pending_payments_summary('nope','203.0.113.9') s`,r=>r[0].s.error==='unauthorized');
await x(`select set_config('request.headers','',false)`);
await x(`select set_config('request.jwt.claim.role','service_role',false)`);
await expectOk('QA P3: service_role may pass the IP','anon','',`select public.pending_payments_summary('nope','192.0.2.44') s`,r=>r[0].s.error==='unauthorized');
await x(`select set_config('request.jwt.claim.role','',false)`);
await expectOk('QA P3: buckets = unknown, header IP, service_role IP','postgres','',`select array_agg(bucket order by bucket) b from private.api_rate_limits where bucket like 'pending_summary_fail:%'`,r=>JSON.stringify(r[0].b)===JSON.stringify(['pending_summary_fail:192.0.2.44','pending_summary_fail:198.51.100.7','pending_summary_fail:unknown']));

// quiz answers hidden
await x(`insert into private.training_quizzes select id,'[{"q":"1% of 10000?","options":["10","100"],"answer_index":1,"explain":"x"}]' from public.training_lessons where slug='l1'`);
await x(`insert into public.course_purchases(id,user_id,course_id,price_php,amount_entered,payment_code,gcash_ref,receipt_sha256,status,decided_at) select '${P(5)}','${AD}',id,2000,2000,'x','5555555555555','${'e'.repeat(64)}','approved',now() from public.training_courses where slug='test-paid'`);
await expectOk('quiz questions have no answers','authenticated',AD,`select public.get_lesson_quiz(id) q from public.training_lessons where slug='l1'`,r=>!JSON.stringify(r[0].q).includes('answer_index'));
await expectErr('member cannot read quiz table','authenticated',AD,`select * from private.training_quizzes`,/permission/);
await expectOk('submit quiz scores server-side','authenticated',AD,`select public.submit_lesson_quiz(id, array[1]) s from public.training_lessons where slug='l1'`,r=>r[0].s.score===1);
await expectOk('practice done -> completed','authenticated',AD,`select public.set_practice_done(id,true) from public.training_lessons where slug='l1'; `);
await expectOk('progress own row completed','authenticated',AD,`select completed_at is not null c from public.training_progress`,r=>r.length===1&&r[0].c);
await expectOk('N sees no progress','authenticated',N,`select * from public.training_progress`,r=>r.length===0);
const LID="'"+(await db.query(`select id from public.training_lessons where slug='l1'`)).rows[0].id+"'";
await expectErr('N cannot submit quiz','authenticated',N,`select public.submit_lesson_quiz(${LID}, array[1])`,/no access|permission/);
await expectOk('anon sees only open courses','anon','',`select slug from public.training_courses`,r=>!r.some(x=>x.slug.startsWith('gold-strategy')));
await expectErr('anon cannot read admins','anon','',`select * from public.admins`,/permission/);
await expectErr('member cannot add self as admin','authenticated',M2,`insert into public.admins values ('${M2}')`,/permission/);
await expectOk('seed: gold-reset open free, lessons draft','authenticated',M2,`select (select count(*)::int from public.training_courses where slug='gold-reset' and price_php=0 and status='open') c, (select count(*)::int from public.training_lessons l join public.training_modules m on m.id=l.module_id where m.slug='gold-reset') l`,r=>r[0].c===(fs.readdirSync(R+'migrations').some(f=>f.includes('seed_gold_reset'))?1:0)&&r[0].l===0);
// capstone self-check (B-AC5)
await x(`insert into public.training_capstones select id,'Cap','["a","b"]' from public.training_courses where slug='test-paid'`);
await expectOk('capstone partial','authenticated',AD,`select public.set_capstone_items(id,array[0]) s from public.training_courses where slug='test-paid'`,r=>r[0].s.done===false);
await expectOk('B-AC5 capstone done from rubric, no queue','authenticated',AD,`select public.set_capstone_items(id,array[0,1]) s, (select count(*)::int from public.course_purchases where status='pending') q from public.training_courses where slug='test-paid'`,r=>r[0].s.done===true&&r[0].q===1);
await expectOk('course_complete after lessons+capstone','authenticated',AD,`select public.course_complete(id) c from public.training_courses where slug='test-paid'`,r=>r[0].c===true);
// ---- QA #55 P1 repro (B-AC2): quiz lesson must not complete on practice alone
await x(`insert into public.training_courses(slug,title,level,price_php,status,sales_open) values ('q-basics','B','course',0,'open',false);
insert into public.training_courses(slug,title,level,price_php,status,sales_open,prereq_course_id) select 'q-adv','A','course',2000,'open',true,id from public.training_courses where slug='q-basics';
insert into public.training_modules(course_id,sort,slug,title) select id,1,'qbm','QBM' from public.training_courses where slug='q-basics';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,1,'qbl','QBL','published' from public.training_modules where slug='qbm';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,2,'qbn','QBN','published' from public.training_modules where slug='qbm';
insert into private.training_quizzes select id,'[{"q":"x","options":["a","b"],"answer_index":1,"explain":"e"}]' from public.training_lessons where slug='qbl';
insert into public.training_modules(course_id,sort,slug,title) select id,1,'qam','QAM' from public.training_courses where slug='q-adv';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,1,'qal','QAL','published' from public.training_modules where slug='qam';`);
const QS=`select (select completed_at is not null from public.training_progress p join public.training_lessons l on l.id=p.lesson_id where l.slug='qbl' and p.user_id=auth.uid()) d, public.course_complete((select id from public.training_courses where slug='q-basics')) b, public.prereq_met((select id from public.training_courses where slug='q-adv')) a, public.my_payment_info('q-adv')->>'state' s`;
for (const v of ['true','true','false','true']) await as('authenticated',M2,`select public.set_practice_done(id,${v}) from public.training_lessons where slug='qbl'`);
await as('authenticated',M2,`select public.set_practice_done(id,true) from public.training_lessons where slug='qbn'`);
await expectOk('QA P1: practice x2 + tick/untick/tick without quiz -> not complete, Advanced locked','authenticated',M2,QS,r=>r[0].d===false&&r[0].b===false&&r[0].a===false&&r[0].s==='locked');
await expectOk('QA P1: no-quiz lesson completes on first practice tick','authenticated',M2,`select completed_at is not null c from public.training_progress p join public.training_lessons l on l.id=p.lesson_id where l.slug='qbn' and p.user_id=auth.uid()`,r=>r[0].c===true);
await as('authenticated',M2,`select public.submit_lesson_quiz(id, array[0]) from public.training_lessons where slug='qbl'`);
await expectOk('QA P1: failing quiz + practice -> still not complete','authenticated',M2,QS,r=>r[0].d===false&&r[0].a===false);
await as('authenticated',M2,`select public.submit_lesson_quiz(id, array[1]) from public.training_lessons where slug='qbl'`);
await expectOk('QA P1: passing quiz + practice -> complete, Advanced unlocked','authenticated',M2,QS,r=>r[0].d===true&&r[0].b===true&&r[0].a===true&&r[0].s==='open');
// ---- QA P3: placement must have exactly 10 questions
await expectErr('QA P3: 2-question placement rejected by DB','postgres','',`insert into private.placement_quizzes select id,'[{"q":"1","options":["a","b"],"answer_index":1},{"q":"2","options":["a","b"],"answer_index":1}]' from public.training_courses where slug='q-adv'`,/placement_quizzes_ten/);
// ---- QA re-check: empty quiz fails closed; completion counts published lessons only
await x(`insert into public.training_lessons(module_id,sort,slug,title,status) select id,3,'qbe','QBE','published' from public.training_modules where slug='qbm';
insert into private.training_quizzes select id,'[]' from public.training_lessons where slug='qbe';`);
await expectErr('QA: zero-question quiz cannot be passed','authenticated',M2,`select public.submit_lesson_quiz(id, array[]::int[]) from public.training_lessons where slug='qbe'`,/no questions/);
await as('authenticated',M2,`select public.set_practice_done(id,true) from public.training_lessons where slug='qbe'`);
await expectOk('QA: empty-quiz lesson stays incomplete after practice','authenticated',M2,`select (select completed_at is null from public.training_progress p join public.training_lessons l on l.id=p.lesson_id where l.slug='qbe' and p.user_id=auth.uid()) i, public.course_complete((select id from public.training_courses where slug='q-basics')) b`,r=>r[0].i===true&&r[0].b===false);
await x(`update public.training_lessons set status='draft' where slug='qbe'; insert into public.training_lessons(module_id,sort,slug,title,status) select id,4,'qbd','QBD','draft' from public.training_modules where slug='qbm';`);
await expectOk('QA: unpublished lessons do not block completion','authenticated',M2,`select public.course_complete(id) b from public.training_courses where slug='q-basics'`,r=>r[0].b===true);
// ---- content 'disclaimer' (placement + capstone)
await x(`update public.training_capstones set disclaimer='Education lang, not financial advice.' where course_id=(select id from public.training_courses where slug='test-paid')`);
await expectOk('capstone disclaimer readable by owner','authenticated',AD,`select disclaimer d from public.training_capstones where course_id=(select id from public.training_courses where slug='test-paid')`,r=>r[0].d==='Education lang, not financial advice.');
await expectErr('disclaimer must be trimmed','postgres','',`update public.training_capstones set disclaimer=' x ' where course_id=(select id from public.training_courses where slug='test-paid')`,/check constraint/);
await x(`update private.placement_quizzes set disclaimer='Max 1% risk per trade.' where course_id=(select id from public.training_courses where slug='t-adv')`);
await expectOk('get_placement_quiz returns disclaimer','authenticated',M2,`select public.get_placement_quiz('t-adv')->>'disclaimer' d`,r=>r[0].d==='Max 1% risk per trade.');

// ---- loader BANNED list: 'lifetime' and 'live' (word-boundary) are rejected in disclaimers; 'delivery' is not
{
  const { spawnSync } = await import('child_process');
  const os = await import('os');
  const pth = await import('path');
  const qs = Array.from({ length: 10 }, (_, i) => ({ prompt: `Q${i}`, options: ['a', 'b'], correct: 0, explanation: 'e' }));
  const runLoader = (disclaimer) => {
    const d = fs.mkdtempSync(pth.join(os.tmpdir(), 'gfx-loader-'));
    fs.mkdirSync(pth.join(d, 'basics'));
    fs.writeFileSync(pth.join(d, 'basics', 'placement.json'), JSON.stringify({ questions: qs, disclaimer }));
    const r = spawnSync(process.execPath, ['scripts/build-course-content-sql.mjs', '--dry-run', d], { encoding: 'utf8' });
    fs.rmSync(d, { recursive: true, force: true });
    return r;
  };
  const chk = (name, ok) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };
  for (const bad of ['lifetime access + live sessions', 'Lifetime access', 'Join the LIVE room'])
    chk(`loader rejects "${bad}"`, runLoader(bad).status !== 0);
  chk('loader allows "Education lang, not financial advice. Max 1% risk per trade."', runLoader('Education lang, not financial advice. Max 1% risk per trade.').status === 0);
  chk('loader allows "delivery" (word boundary)', runLoader('Lesson delivery is self-paced.').status === 0);
}
console.log(`\n${pass} passed, ${fail} failed (incl. loader)`);
