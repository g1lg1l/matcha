-- Who can do what. Run through run.sh; every line marked "expect" must hold.
\set ON_ERROR_STOP 0
\set owner '11111111-1111-1111-1111-111111111111'
\set fan '22222222-2222-2222-2222-222222222222'
\set ref '33333333-3333-3333-3333-333333333333'
set role authenticated;

set request.jwt.claim.sub = :'owner';
insert into matcha_tournaments (id, data) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"name":"Cup","results":{}}');
select 'expect 1', count(*) from matcha_tournaments;
select 'expect owner', role from matcha_follow((select share_code from matcha_tournaments));
\echo expect permission denied x2
insert into matcha_tournaments (id, data, share_code) values (gen_random_uuid(), '{}', 'weak');
update matcha_tournaments set owner_id = :'fan';
with u as (update matcha_tournaments set data = data || '{"name":"Cup 2"}' returning *) select 'expect Cup 2, t', data->>'name', updated_at > created_at from u;
select 'expect 16 chars', char_length(matcha_referee_code('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
select share_code as code from matcha_tournaments \gset
select matcha_referee_code('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as refcode \gset

set request.jwt.claim.sub = :'fan';
select 'expect 0', count(*) from matcha_tournaments;
\echo expect Unknown tournament
select * from matcha_follow('nope');
select 'expect viewer', role from matcha_follow(:'code');
select 'expect viewer (bad referee code)', role from matcha_follow(:'code', 'wrong');
select 'expect 1', count(*) from matcha_tournaments;
with u as (update matcha_tournaments set data = '{"hacked":true}' returning 1) select 'expect 0 rows updated', count(*) from u;
with u as (delete from matcha_tournaments returning 1) select 'expect 0 rows deleted', count(*) from u;
\echo expect Not allowed, Only the owner, permission denied x3
select matcha_set_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W1-0', '{"w":"a"}');
select matcha_referee_code('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select * from matcha_referee_codes;
insert into matcha_followers (tournament_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'editor');
update matcha_followers set role = 'editor';

set request.jwt.claim.sub = :'ref';
select 'expect editor', role from matcha_follow(:'code', :'refcode');
select 'expect viewer stays editor', role from matcha_follow(:'code');
select matcha_set_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W1-0', '{"w":"a","a":3,"b":1}');
select matcha_set_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W1-1', '{"w":"b"}');
select matcha_set_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W1-1', null);
select 'expect {"W1-0"...} only, name kept', data->'results', data->>'name', data ? 'updatedAt' from matcha_tournaments;
with u as (update matcha_tournaments set data = data || '{"emoji":"⚽"}' returning 1) select 'expect 1 row updated', count(*) from u;
with u as (delete from matcha_tournaments returning 1) select 'expect 0 rows deleted', count(*) from u;
\echo expect Bad result
select matcha_set_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', repeat('x', 30), '{}');

set request.jwt.claim.sub = :'owner';
select 'expect new code', matcha_reset_referee_code('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> :'refcode';
set request.jwt.claim.sub = :'ref';
\echo expect Not allowed (demoted)
select matcha_set_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W1-0', null);
select 'expect viewer (old link)', role from matcha_follow(:'code', :'refcode');

set request.jwt.claim.sub = :'fan';
delete from matcha_followers where tournament_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select 'expect 0 after unfollow', count(*) from matcha_tournaments;

set request.jwt.claim.sub = :'owner';
\echo expect check constraint
update matcha_tournaments set data = jsonb_build_object('x', (select string_agg(md5(i::text), '') from generate_series(1, 20000) i));
reset role; set role anon;
\echo expect permission denied x2
select count(*) from matcha_tournaments;
select * from matcha_follow('x');
reset role; set role authenticated; set request.jwt.claim.sub = :'owner';
with u as (delete from matcha_tournaments returning 1) select 'expect 1 deleted, codes gone', count(*) from u;
reset role;
select 'expect 0 codes', count(*) from matcha_referee_codes;
