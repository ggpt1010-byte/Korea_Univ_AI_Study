-- AI개발모임 데이터베이스 (Supabase).
-- Supabase 화면의 SQL Editor에 통째로 붙여 넣고 실행한다. 여러 번 실행해도 된다.
--
-- 보안 원칙
-- - 사이트(브라우저)는 공개 키(publishable/anon)만 쓴다. 표를 직접 고칠 수 없고, 아래 함수(rpc)로만 쓴다.
-- - 함수가 서버에서 로그인한 계정, 그룹 멤버 여부, 방장/매니저 여부를 확인한다.
-- - 그룹 비밀번호는 bcrypt 값으로 group_secrets 에만 있고, 누구도 읽을 수 없다(읽기 규칙이 없음).
-- - 비공개 결과물은 그 그룹 멤버와 올린 사람만 읽을 수 있다(RLS).
-- - 계정 번호(owner)는 예전과 같은 값: 'g' + sha256('korai-account:' + 구글 계정 번호) 앞 16자리.
--   서버가 auth.identities 에서 직접 계산하므로 남의 번호를 흉내 낼 수 없다.

create extension if not exists pgcrypto with schema extensions;

-- ---------- 표 ----------
create table if not exists public.projects (
  id text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  title text not null check (char_length(title) between 1 and 80),
  summary text not null default '' check (char_length(summary) <= 160),
  author text not null default '이름 없음' check (char_length(author) <= 40),
  category text not null default '기타' check (category in ('사이트', '게임', '기타')),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  description text not null default '' check (char_length(description) <= 3000),
  owner text check (owner ~ '^g[0-9a-f]{16}$'),
  group_id text,
  is_private boolean not null default false,
  images text[] not null default '{}',
  parent text references public.projects(id) on delete cascade,
  changes text not null default '' check (char_length(changes) <= 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id text primary key check (id ~ '^k[0-9a-f]{8}$'),
  name text not null check (char_length(name) between 1 and 40),
  intro text not null default '' check (char_length(intro) <= 200),
  owner text check (owner ~ '^g[0-9a-f]{16}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists groups_name_key on public.groups (lower(name));

do $$ begin
  alter table public.projects add constraint projects_group_fk foreign key (group_id) references public.groups(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.group_secrets (
  group_id text primary key references public.groups(id) on delete cascade,
  pass_hash text not null
);

create table if not exists public.group_members (
  group_id text references public.groups(id) on delete cascade,
  owner text check (owner ~ '^g[0-9a-f]{16}$'),
  joined_at timestamptz not null default now(),
  primary key (group_id, owner)
);

create table if not exists public.join_attempts (
  owner text not null,
  at timestamptz not null default now()
);
create index if not exists join_attempts_owner_at on public.join_attempts (owner, at);

create table if not exists public.votes (
  group_id text references public.groups(id) on delete cascade,
  target text not null check (target ~ '^[a-z0-9-]{1,60}$'),
  voter text not null check (voter ~ '^[gd][0-9a-f]{16}$'),
  created_at timestamptz not null default now(),
  primary key (group_id, target, voter)
);

create table if not exists public.likes (
  target text not null check (target ~ '^[a-z0-9-]{1,60}$'),
  voter text not null check (voter ~ '^[gd][0-9a-f]{16}$'),
  created_at timestamptz not null default now(),
  primary key (target, voter)
);

create table if not exists public.views (
  target text not null check (target ~ '^[a-z0-9-]{1,60}$'),
  voter text not null check (voter ~ '^[gd][0-9a-f]{16}$'),
  day date not null,
  primary key (target, voter, day)
);

create table if not exists public.value_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('분석 시작', '분석 취소', '가치 평가')),
  target text not null check (target ~ '^[a-z0-9-]{1,60}$'),
  by_owner text not null check (by_owner ~ '^g[0-9a-f]{16}$'),
  value bigint check (value between 0 and 1000000000000000),
  improved bigint check (improved between 0 and 1000000000000000),
  memo text not null default '' check (char_length(memo) <= 2000),
  at timestamptz not null default now()
);

create table if not exists public.managers (
  owner text primary key check (owner ~ '^g[0-9a-f]{16}$')
);

-- ---------- 도우미 함수 ----------
create or replace function public.my_owner() returns text
language sql stable security definer set search_path = '' as $$
  select 'g' || left(encode(extensions.digest('korai-account:' || i.provider_id, 'sha256'), 'hex'), 16)
  from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'google'
  limit 1
$$;

create or replace function public.is_member(gid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members m where m.group_id = gid and m.owner = public.my_owner())
$$;

-- ---------- 읽기 규칙 (RLS) ----------
alter table public.projects enable row level security;
alter table public.groups enable row level security;
alter table public.group_secrets enable row level security;
alter table public.group_members enable row level security;
alter table public.join_attempts enable row level security;
alter table public.votes enable row level security;
alter table public.likes enable row level security;
alter table public.views enable row level security;
alter table public.value_events enable row level security;
alter table public.managers enable row level security;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select using (
  not hidden and (not is_private or public.is_member(group_id) or owner = public.my_owner())
);
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select using (true);
drop policy if exists members_read on public.group_members;
create policy members_read on public.group_members for select using (owner = public.my_owner());
drop policy if exists votes_read on public.votes;
create policy votes_read on public.votes for select using (public.is_member(group_id));
drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select using (true);
-- 평가 기록은 그 결과물을 볼 수 있는 사람만 읽는다(projects 규칙을 그대로 따른다).
drop policy if exists values_read on public.value_events;
create policy values_read on public.value_events for select using (
  exists (select 1 from public.projects p where p.id = target)
);
drop policy if exists managers_read on public.managers;
create policy managers_read on public.managers for select using (true);
-- group_secrets, join_attempts, views 는 읽기 규칙이 없다 = 아무도 직접 못 읽는다.

-- 표를 직접 고치는 권한은 주지 않는다. 쓰기는 아래 함수로만.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

-- ---------- 쓰기 함수 ----------
create or replace function public.view_counts() returns table (target text, n bigint)
language sql stable security definer set search_path = '' as $$
  select v.target, count(*) from public.views v group by v.target
$$;

create or replace function public.submit_project(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.my_owner();
  new_id text := 's' || encode(extensions.gen_random_bytes(4), 'hex');
  gid text := nullif(p->>'group', '');
  priv boolean := coalesce((p->>'private')::boolean, false);
  par text := nullif(p->>'parent', '');
  root public.projects;
  imgs text[] := '{}';
begin
  if par is not null then
    select * into root from public.projects where id = par;
    if root.id is null then raise exception 'parent_not_found'; end if;
    while root.parent is not null loop
      select * into root from public.projects where id = root.parent;
    end loop;
    if me is null or root.owner is distinct from me then raise exception 'not_owner'; end if;
    par := root.id; gid := root.group_id; priv := root.is_private;
  elsif gid is not null then
    if me is null or not public.is_member(gid) then raise exception 'not_member'; end if;
  else
    priv := false;
  end if;
  select coalesce(array_agg(x), '{}') into imgs
    from (select x from jsonb_array_elements_text(coalesce(p->'images', '[]')) x where x ~ '^https://' limit 5) t;
  insert into public.projects (id, title, summary, author, category, url, description, owner, group_id, is_private, images, parent, changes)
  values (new_id, left(trim(p->>'title'), 80), left(trim(coalesce(p->>'summary', '')), 160),
          coalesce(nullif(left(trim(p->>'author'), 40), ''), '이름 없음'),
          case when p->>'category' in ('사이트', '게임', '기타') then p->>'category' else '기타' end,
          trim(p->>'url'), left(coalesce(p->>'description', ''), 3000), me, gid, priv, imgs, par,
          case when par is null then '' else left(coalesce(p->>'changes', ''), 1000) end);
  return new_id;
end $$;

create or replace function public.create_group(p_id text, p_name text, p_intro text, p_pass text) returns text
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner();
begin
  if me is null then raise exception 'login_required'; end if;
  if char_length(coalesce(p_pass, '')) < 6 then raise exception 'short_password'; end if;
  if exists (select 1 from public.groups where id = p_id or lower(name) = lower(trim(p_name))) then raise exception 'name_taken'; end if;
  insert into public.groups (id, name, intro, owner) values (p_id, trim(p_name), left(coalesce(trim(p_intro), ''), 200), me);
  insert into public.group_secrets values (p_id, extensions.crypt(p_pass, extensions.gen_salt('bf', 10)));
  insert into public.group_members (group_id, owner) values (p_id, me);
  return p_id;
end $$;

-- 비밀번호가 맞으면 이 계정을 멤버로 등록한다. 10분에 10번까지 틀릴 수 있다.
create or replace function public.join_group(gid text, pass text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); h text;
begin
  if me is null then raise exception 'login_required'; end if;
  if public.is_member(gid) then return true; end if;
  if (select count(*) from public.join_attempts where owner = me and at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many_attempts';
  end if;
  select pass_hash into h from public.group_secrets where group_id = gid;
  if h is null or extensions.crypt(coalesce(pass, ''), h) <> h then
    insert into public.join_attempts (owner) values (me);
    return false;
  end if;
  insert into public.group_members (group_id, owner) values (gid, me) on conflict do nothing;
  return true;
end $$;

create or replace function public.leave_group(gid text) returns void
language sql security definer set search_path = '' as $$
  delete from public.group_members where group_id = gid and owner = public.my_owner()
    and owner is distinct from (select g.owner from public.groups g where g.id = gid)
$$;

-- 방장만 비밀번호를 (새로) 정할 수 있다. 옮겨 온 방은 비밀번호가 없어서 방장이 정해야 열린다.
create or replace function public.set_group_password(gid text, pass text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner();
begin
  if me is null or not exists (select 1 from public.groups where id = gid and owner = me) then raise exception 'not_owner'; end if;
  if char_length(coalesce(pass, '')) < 6 then raise exception 'short_password'; end if;
  insert into public.group_secrets values (gid, extensions.crypt(pass, extensions.gen_salt('bf', 10)))
    on conflict (group_id) do update set pass_hash = excluded.pass_hash;
  insert into public.group_members (group_id, owner) values (gid, me) on conflict do nothing;
end $$;

create or replace function public.has_password(gid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_secrets where group_id = gid)
$$;

create or replace function public.vote(gid text, p_target text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner();
begin
  if me is null or not public.is_member(gid) then raise exception 'not_member'; end if;
  if p_on then insert into public.votes (group_id, target, voter) values (gid, p_target, me) on conflict do nothing;
  else delete from public.votes where group_id = gid and target = p_target and voter = me; end if;
end $$;

-- 좋아요와 조회: 로그인했으면 계정 번호, 아니면 브라우저의 무작위 번호(d...)로 센다.
create or replace function public.like_project(p_target text, p_on boolean, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare who text := coalesce(public.my_owner(), p_device);
begin
  if who !~ '^[gd][0-9a-f]{16}$' then raise exception 'bad_voter'; end if;
  if p_on then insert into public.likes (target, voter) values (p_target, who) on conflict do nothing;
  else delete from public.likes where target = p_target and voter = who; end if;
end $$;

create or replace function public.record_view(p_target text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare who text := coalesce(public.my_owner(), p_device);
begin
  if who !~ '^[gd][0-9a-f]{16}$' then raise exception 'bad_voter'; end if;
  insert into public.views (target, voter, day) values (p_target, who, (now() at time zone 'Asia/Seoul')::date) on conflict do nothing;
end $$;

-- 평가 기록: 사이트 매니저는 모든 결과물에, 방장은 자기 방 결과물에만.
create or replace function public.record_value(p_kind text, p_target text, p_value bigint, p_improved bigint, p_memo text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); gid text;
begin
  if me is null then raise exception 'login_required'; end if;
  select group_id into gid from public.projects where id = p_target;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from public.managers where owner = me)
     and not exists (select 1 from public.groups where id = gid and owner = me) then
    raise exception 'not_manager';
  end if;
  if p_kind = '가치 평가' and (p_value is null or p_improved is null) then raise exception 'missing_value'; end if;
  insert into public.value_events (kind, target, by_owner, value, improved, memo)
  values (p_kind, p_target, me, case when p_kind = '가치 평가' then p_value end,
          case when p_kind = '가치 평가' then p_improved end, left(coalesce(p_memo, ''), 2000));
end $$;

-- 함수는 로그인 여부와 상관없이 부를 수 있게 하고, 확인은 함수 안에서 한다.
revoke execute on all functions in schema public from public;
grant execute on function public.my_owner(), public.is_member(text), public.view_counts(), public.submit_project(jsonb),
  public.create_group(text, text, text, text), public.join_group(text, text), public.leave_group(text),
  public.set_group_password(text, text), public.has_password(text), public.vote(text, text, boolean),
  public.like_project(text, boolean, text), public.record_view(text, text),
  public.record_value(text, text, bigint, bigint, text)
  to anon, authenticated;
grant select on public.projects, public.groups, public.group_members, public.votes, public.likes,
  public.value_events, public.managers to anon, authenticated;
