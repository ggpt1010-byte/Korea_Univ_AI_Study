-- 같이 개선하기(오픈소스 협업) 기능. schema.sql 다음에 SQL Editor에 통째로 붙여 넣고 실행한다.
-- 여러 번 실행해도 된다. schema.sql 을 다시 실행했다면 이 파일도 다시 실행할 것(submit_project 를 이 파일이 바꾼다).
--
-- 흐름
-- 1) 올릴 때 원하면 "오픈소스로 공개"(GitHub 저장소 주소, 라이선스)와 "같이 할 사람 구해요"를 켠다.
-- 2) 매니저가 AI 평가를 돌리면 AI가 개선 아이디어 2~4개를 뽑아 ideas 에 넣는다(상태 '열림').
--    다른 사람은 아이디어를 "제안"하고(상태 '제안'), 결과물 주인이 승인하면 '열림'이 된다. 주인이 직접 적으면 바로 '열림'.
-- 3) 로그인한 사람은 열린 아이디어에 "나도 해볼래요"(idea_joins)를 누르고 한 줄 메모를 남긴다. 메모는 주인과 본인만 본다.
-- 4) 주인이 새 버전을 올릴 때 반영한 아이디어(상태 '반영')와 도와준 사람(contributors)을 고른다.
--
-- 보안: 표를 직접 고칠 수 없고 아래 함수로만 쓴다. 비공개 결과물의 아이디어와 기여 기록은 그 결과물을 볼 수 있는 사람만 읽는다.

-- ---------- 결과물에 붙는 협업 정보 ----------
alter table public.projects add column if not exists open_source boolean not null default false;
alter table public.projects add column if not exists repo_url text;
alter table public.projects add column if not exists license text not null default '모름';
alter table public.projects add column if not exists seeking boolean not null default false;
do $$ begin
  alter table public.projects add constraint projects_repo_url_check
    check (repo_url is null or (repo_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' and char_length(repo_url) <= 200));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_license_check
    check (license in ('MIT', 'Apache-2.0', 'GPL-3.0', '기타', '모름'));
exception when duplicate_object then null; end $$;

-- ---------- 표 ----------
create table if not exists public.ideas (
  id bigint generated always as identity primary key,
  target text not null references public.projects(id) on delete cascade,   -- 처음 버전(v1) 번호
  from_version text references public.projects(id) on delete set null,      -- AI 평가를 받은 버전
  body text not null check (char_length(body) between 1 and 200),
  gain bigint check (gain between 0 and 1000000000000000),                  -- 이걸 하면 오를 금액(원), 모르면 비움
  source text not null check (source in ('AI', '주인', '제안')),
  status text not null default '열림' check (status in ('제안', '열림', '반영', '닫힘')),
  done_version text references public.projects(id) on delete set null,      -- 반영된 버전
  by_owner text check (by_owner ~ '^g[0-9a-f]{16}$'),
  created_at timestamptz not null default now()
);
create index if not exists ideas_target on public.ideas (target);

create table if not exists public.idea_joins (
  idea_id bigint references public.ideas(id) on delete cascade,
  owner text check (owner ~ '^g[0-9a-f]{16}$'),
  name text not null default '이름 없음' check (char_length(name) <= 40),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (idea_id, owner)
);

create table if not exists public.contributors (
  version_id text references public.projects(id) on delete cascade,        -- 도움을 받아 올린 버전
  owner text check (owner ~ '^g[0-9a-f]{16}$'),
  name text not null default '이름 없음' check (char_length(name) <= 40),
  idea_id bigint references public.ideas(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (version_id, owner)
);

-- ---------- 도우미 ----------
-- 지금 로그인한 사람이 이 결과물을 볼 수 있는지(projects 읽기 규칙과 같은 조건).
create or replace function public.can_see(pid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = pid and not p.hidden
    and (not p.is_private or public.is_member(p.group_id) or p.owner = public.my_owner()))
$$;

create or replace function public.root_of(pid text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare cur text := pid; par text;
begin
  loop
    select parent into par from public.projects where id = cur;
    exit when par is null;
    cur := par;
  end loop;
  return cur;
end $$;

create or replace function public.project_owner(pid text) returns text
language sql stable security definer set search_path = '' as $$
  select owner from public.projects where id = public.root_of(pid)
$$;

-- 사이트 매니저이거나 그 결과물이 올라온 방의 방장인지(record_value 와 같은 조건).
create or replace function public.can_value(pid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_owner() is not null and (
    exists (select 1 from public.managers where owner = public.my_owner())
    or exists (select 1 from public.projects p join public.groups g on g.id = p.group_id
               where p.id = pid and g.owner = public.my_owner()))
$$;

-- ---------- 읽기 규칙 ----------
alter table public.ideas enable row level security;
alter table public.idea_joins enable row level security;
alter table public.contributors enable row level security;

-- 열린/반영된 아이디어는 결과물을 볼 수 있는 사람 모두, 제안/닫힘은 제안한 사람과 주인만.
drop policy if exists ideas_read on public.ideas;
create policy ideas_read on public.ideas for select using (
  public.can_see(target) and (status in ('열림', '반영') or by_owner = public.my_owner() or public.project_owner(target) = public.my_owner())
);
-- 참여 기록(이름, 메모)은 본인과 결과물 주인만. 다른 사람에게는 idea_join_counts() 의 숫자만 보인다.
drop policy if exists joins_read on public.idea_joins;
create policy joins_read on public.idea_joins for select using (
  owner = public.my_owner()
  or exists (select 1 from public.ideas i where i.id = idea_id and public.project_owner(i.target) = public.my_owner())
);
drop policy if exists contributors_read on public.contributors;
create policy contributors_read on public.contributors for select using (public.can_see(version_id));

revoke insert, update, delete on public.ideas, public.idea_joins, public.contributors from anon, authenticated;
grant select on public.ideas, public.idea_joins, public.contributors to anon, authenticated;

-- ---------- 함수 ----------
create or replace function public.idea_join_counts() returns table (idea_id bigint, n bigint)
language sql stable security definer set search_path = '' as $$
  select j.idea_id, count(*) from public.idea_joins j join public.ideas i on i.id = j.idea_id
  where public.can_see(i.target) and i.status in ('열림', '반영')
  group by j.idea_id
$$;

-- 결과물 올리기(schema.sql 의 것을 바꾼다): 협업 정보, 새 버전이면 반영한 아이디어와 도와준 사람도 받는다.
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
  os boolean := coalesce((p->>'open_source')::boolean, false);
  repo text := nullif(trim(coalesce(p->>'repo_url', '')), '');
  lic text := coalesce(nullif(p->>'license', ''), '모름');
  c text;
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
  if not os then repo := null; end if;
  if repo is not null and repo !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' then raise exception 'bad_repo'; end if;
  if lic not in ('MIT', 'Apache-2.0', 'GPL-3.0', '기타', '모름') then lic := '모름'; end if;
  select coalesce(array_agg(x), '{}') into imgs
    from (select x from jsonb_array_elements_text(coalesce(p->'images', '[]')) x where x ~ '^https://' limit 5) t;
  insert into public.projects (id, title, summary, author, category, url, description, owner, group_id, is_private, images, parent, changes,
                               open_source, repo_url, license, seeking)
  values (new_id, left(trim(p->>'title'), 80), left(trim(coalesce(p->>'summary', '')), 160),
          coalesce(nullif(left(trim(p->>'author'), 40), ''), '이름 없음'),
          case when p->>'category' in ('사이트', '게임', '기타') then p->>'category' else '기타' end,
          trim(p->>'url'), left(coalesce(p->>'description', ''), 3000), me, gid, priv, imgs, par,
          case when par is null then '' else left(coalesce(p->>'changes', ''), 1000) end,
          os, repo, lic, coalesce((p->>'seeking')::boolean, false));
  if par is not null then
    -- 반영한 아이디어: 이 결과물의 열린 아이디어만.
    update public.ideas set status = '반영', done_version = new_id
      where target = par and status = '열림'
        and id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'done_ideas', '[]')) x where x ~ '^[0-9]{1,18}$');
    -- 도와준 사람: 이 결과물의 아이디어에 "나도 해볼래요"를 누른 사람만.
    for c in select x from jsonb_array_elements_text(coalesce(p->'contributors', '[]')) x where x ~ '^g[0-9a-f]{16}$' limit 30 loop
      insert into public.contributors (version_id, owner, name, idea_id)
      select new_id, j.owner, j.name, j.idea_id from public.idea_joins j join public.ideas i on i.id = j.idea_id
      where i.target = par and j.owner = c
      order by (i.done_version = new_id) desc nulls last, j.created_at
      limit 1
      on conflict do nothing;
    end loop;
  end if;
  return new_id;
end $$;

-- 주인이 협업 정보를 고친다(모든 버전에 같이 적용).
create or replace function public.set_collab(p_target text, p_open boolean, p_repo text, p_license text, p_seeking boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); r text := public.root_of(p_target); repo text := nullif(trim(coalesce(p_repo, '')), '');
begin
  if me is null or public.project_owner(r) is distinct from me then raise exception 'not_owner'; end if;
  if not coalesce(p_open, false) then repo := null; end if;
  if repo is not null and repo !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' then raise exception 'bad_repo'; end if;
  update public.projects set open_source = coalesce(p_open, false), repo_url = repo,
    license = case when p_license in ('MIT', 'Apache-2.0', 'GPL-3.0', '기타', '모름') then p_license else '모름' end,
    seeking = coalesce(p_seeking, false)
  where public.root_of(id) = r;
end $$;

-- AI 평가에서 뽑은 아이디어 넣기(매니저/방장). 같은 버전의 예전 AI 아이디어 중 아무도 참여하지 않은 열린 것은 바꿔 넣는다.
create or replace function public.add_ai_ideas(p_version text, p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); r text := public.root_of(p_version); it jsonb;
begin
  if not public.can_value(r) then raise exception 'not_manager'; end if;
  delete from public.ideas i where i.target = r and i.from_version = p_version and i.source = 'AI' and i.status = '열림'
    and not exists (select 1 from public.idea_joins j where j.idea_id = i.id);
  for it in select x from jsonb_array_elements(coalesce(p_items, '[]')) x limit 4 loop
    if char_length(trim(coalesce(it->>'text', ''))) between 1 and 200 then
      insert into public.ideas (target, from_version, body, gain, source, status, by_owner)
      values (r, p_version, trim(it->>'text'),
              case when (it->>'gain') ~ '^[0-9]{1,15}$' then (it->>'gain')::bigint end, 'AI', '열림', me);
    end if;
  end loop;
end $$;

-- 아이디어 적기: 주인이면 바로 '열림', 다른 사람은 '제안'(주인이 승인해야 보임). 하루 20개까지.
create or replace function public.propose_idea(p_target text, p_body text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); r text := public.root_of(p_target); mine boolean; new_id bigint;
begin
  if me is null then raise exception 'login_required'; end if;
  if not public.can_see(r) then raise exception 'not_found'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 200 then raise exception 'bad_text'; end if;
  if (select count(*) from public.ideas where by_owner = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_attempts';
  end if;
  mine := public.project_owner(r) = me;
  insert into public.ideas (target, body, source, status, by_owner)
  values (r, trim(p_body), case when mine then '주인' else '제안' end, case when mine then '열림' else '제안' end, me)
  returning id into new_id;
  return new_id;
end $$;

-- 주인(또는 매니저)이 아이디어 상태를 바꾼다: 제안 승인('열림'), 닫기('닫힘'), 다시 열기('열림').
create or replace function public.set_idea_status(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); t text;
begin
  select target into t from public.ideas where id = p_id;
  if t is null then raise exception 'not_found'; end if;
  if me is null or (public.project_owner(t) is distinct from me and not public.can_value(t)) then raise exception 'not_owner'; end if;
  if p_status not in ('열림', '닫힘') then raise exception 'bad_status'; end if;
  update public.ideas set status = p_status where id = p_id and status <> '반영';
end $$;

-- 나도 해볼래요 / 취소. 열린 아이디어에만, 결과물 주인 본인은 누를 수 없다.
create or replace function public.join_idea(p_id bigint, p_on boolean, p_name text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_owner(); t text; st text;
begin
  if me is null then raise exception 'login_required'; end if;
  select target, status into t, st from public.ideas where id = p_id;
  if t is null or not public.can_see(t) then raise exception 'not_found'; end if;
  if not p_on then delete from public.idea_joins where idea_id = p_id and owner = me; return; end if;
  if st <> '열림' then raise exception 'idea_closed'; end if;
  if public.project_owner(t) = me then raise exception 'own_project'; end if;
  insert into public.idea_joins (idea_id, owner, name, note)
  values (p_id, me, coalesce(nullif(left(trim(coalesce(p_name, '')), 40), ''), '이름 없음'), left(trim(coalesce(p_note, '')), 200))
  on conflict (idea_id, owner) do update set note = excluded.note, name = excluded.name;
end $$;

revoke execute on function public.can_see(text), public.root_of(text), public.project_owner(text), public.can_value(text),
  public.idea_join_counts(), public.submit_project(jsonb), public.set_collab(text, boolean, text, text, boolean),
  public.add_ai_ideas(text, jsonb), public.propose_idea(text, text), public.set_idea_status(bigint, text),
  public.join_idea(bigint, boolean, text, text) from public;
grant execute on function public.can_see(text), public.root_of(text), public.project_owner(text), public.can_value(text),
  public.idea_join_counts(), public.submit_project(jsonb), public.set_collab(text, boolean, text, text, boolean),
  public.add_ai_ideas(text, jsonb), public.propose_idea(text, text), public.set_idea_status(bigint, text),
  public.join_idea(bigint, boolean, text, text) to anon, authenticated;
