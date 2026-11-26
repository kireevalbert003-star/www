begin;

create table if not exists public.ideas (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id),
  generation integer not null default 0,
  body jsonb not null
);
alter table public.ideas enable row level security;
revoke all on public.ideas from anon, authenticated;
grant select on public.ideas to anon, authenticated;
grant insert (id, body), update (body) on public.ideas to authenticated;
drop policy if exists "Public ideas" on public.ideas;
create policy "Public ideas" on public.ideas for select to anon, authenticated using (true);
drop policy if exists "Create own idea" on public.ideas;
create policy "Create own idea" on public.ideas for insert to authenticated with check (owner = (select auth.uid()));
drop policy if exists "Edit own idea" on public.ideas;
create policy "Edit own idea" on public.ideas for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

create or replace function public.check_idea()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source jsonb;
  source_owner uuid;
  parent_id text := new.body #>> '{parent,id}';
  version_id text := new.body #>> '{parent,versionId}';
  attribution jsonb;
begin
  if jsonb_typeof(new.body) is distinct from 'object'
    or new.id !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or new.body ->> 'category' is null
    or new.body ->> 'category' not in ('ai-generated','photo','site-inspirations','design-sketches','experiments','notes')
    or jsonb_typeof(new.body -> 'images') is distinct from 'array'
    or jsonb_typeof(coalesce(new.body -> 'revisions', '[]')) is distinct from 'array'
    or jsonb_typeof(new.body -> 'title') is distinct from 'string'
    or jsonb_typeof(new.body -> 'author') is distinct from 'string'
    or jsonb_typeof(new.body -> 'tags') is distinct from 'array'
    or new.body ->> 'date' is null
  then raise exception 'Invalid publication'; end if;
  perform (new.body ->> 'date')::timestamptz;
  if jsonb_array_length(new.body -> 'images') = 0 then raise exception 'An image is required'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(new.body -> 'revisions','[]')) as v
    where jsonb_typeof(v -> 'images') is distinct from 'array' or v ->> 'id' is null
      or v ->> 'id' = new.id || ':original'
  ) then raise exception 'Invalid version'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(new.body -> 'revisions','[]')) as v
    group by v ->> 'id' having count(*) > 1
  ) then raise exception 'Duplicate version'; end if;
  new.body := jsonb_set(new.body, '{id}', to_jsonb(new.id));
  new.body := jsonb_set(new.body, '{creatorId}', to_jsonb(new.owner::text));
  if tg_op = 'UPDATE' then
    if (new.body - array['revisions','allowContinuation']) is distinct from
       (old.body - array['revisions','allowContinuation']) then
      raise exception 'The original publication and its lineage are immutable';
    end if;
    if exists (
      select 1 from jsonb_array_elements(coalesce(old.body -> 'revisions','[]')) with ordinality as r(value, n)
      where new.body -> 'revisions' -> ((r.n - 1)::int) is distinct from r.value
    ) then raise exception 'Existing versions are immutable'; end if;
    new.generation := old.generation + 1;
    return new;
  end if;
  new.body := new.body - array['root','parent'];
  if parent_id is null then return new; end if;
  if parent_id = new.id then raise exception 'An idea cannot be its own parent'; end if;
  if parent_id = 'alpine-hour' and version_id = 'alpine-hour:original' then
    attribution := jsonb_build_object('id',parent_id,'versionId',version_id,'category','photo',
      'title','Last light on the ridge','author','In Progress Studio','creatorId','in-progress-studio');
  else
    select body, owner into source, source_owner from public.ideas where id = parent_id for share;
    if source is null or source -> 'allowContinuation' is distinct from 'true'::jsonb then
      raise exception 'The source idea is unavailable or closed to continuations';
    end if;
    if version_id is null or (version_id <> parent_id || ':original' and not exists (
      select 1 from jsonb_array_elements(coalesce(source -> 'revisions','[]')) as v
      where v ->> 'id' = version_id
    )) then raise exception 'The source version is unavailable'; end if;
    attribution := jsonb_build_object('id',parent_id,'versionId',version_id,'category',source ->> 'category',
      'title',source ->> 'title','author',source ->> 'author','creatorId',source_owner::text);
  end if;
  new.body := jsonb_set(jsonb_set(new.body,'{parent}',attribution),'{root}',coalesce(source -> 'root',attribution));
  return new;
end;
$$;
revoke all on function public.check_idea() from public, anon, authenticated;
drop trigger if exists check_idea on public.ideas;
create trigger check_idea before insert or update on public.ideas for each row execute function public.check_idea();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('idea-images','idea-images',true,10485760,array['image/jpeg','image/webp','image/png','image/gif','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Upload own idea images" on storage.objects;
create policy "Upload own idea images" on storage.objects for insert to authenticated with check (
  bucket_id = 'idea-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
commit;
