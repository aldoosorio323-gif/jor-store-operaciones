begin;

create schema if not exists private;
revoke all on schema private from public;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint roles_code_allowed check (code in ('administrator', 'operator')),
  constraint roles_code_not_blank check (btrim(code) <> ''),
  constraint roles_name_not_blank check (btrim(name) <> ''),
  constraint roles_code_unique unique (code)
);

insert into public.roles (code, name, description)
values
  ('administrator', 'Administrador', 'Administra usuarios, roles y configuración sensible.'),
  ('operator', 'Operador', 'Accede únicamente a funciones operativas autorizadas.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  role_id uuid not null references public.roles (id) on delete restrict,
  display_name text not null,
  is_active boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null deferrable initially deferred,
  updated_by uuid references public.profiles (id) on delete set null deferrable initially deferred,
  constraint profiles_display_name_not_blank check (btrim(display_name) <> '')
);

alter table public.roles
  add constraint roles_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null
  deferrable initially deferred,
  add constraint roles_updated_by_fkey
  foreign key (updated_by) references public.profiles (id) on delete set null
  deferrable initially deferred;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_profile_id uuid references public.profiles (id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_logs_action_allowed check (
    action in (
      'bootstrap_administrator',
      'invite_user',
      'role_changed',
      'user_activated',
      'user_deactivated',
      'password_recovery_completed'
    )
  ),
  constraint audit_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index profiles_role_id_idx on public.profiles (role_id);
create index profiles_active_idx on public.profiles (is_active) where is_active;
create index audit_logs_actor_occurred_idx
  on public.audit_logs (actor_user_id, occurred_at desc);
create index audit_logs_target_occurred_idx
  on public.audit_logs (target_profile_id, occurred_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
  );
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.code
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = (select auth.uid())
    and p.is_active
    and r.is_active;
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.current_user_role()) = 'administrator', false);
$$;

create or replace function private.protect_profile_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- session_user conserva quien abrió la conexión; current_user sería el dueño
  -- de esta función SECURITY DEFINER y daría un bypass a llamadas PostgREST.
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if (select auth.uid()) is null or not (select public.current_user_is_active()) then
    raise exception 'El usuario responsable no está activo.' using errcode = '42501';
  end if;

  if not (select public.current_user_is_admin()) and (
    new.role_id is distinct from old.role_id
    or new.is_active is distinct from old.is_active
    or new.created_by is distinct from old.created_by
    or new.updated_by is distinct from old.updated_by
    or new.id is distinct from old.id
  ) then
    raise exception 'No se permite modificar campos protegidos del perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator_role_id uuid;
  requested_display_name text;
begin
  select id into operator_role_id
  from public.roles
  where code = 'operator' and is_active;

  if operator_role_id is null then
    raise exception 'No existe el rol operator activo.';
  end if;

  requested_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  insert into public.profiles (
    id,
    role_id,
    display_name,
    is_active,
    created_by,
    updated_by
  )
  values (
    new.id,
    operator_role_id,
    coalesce(requested_display_name, 'Usuario'),
    false,
    null,
    null
  );

  return new;
end;
$$;

create or replace function public.mark_current_user_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select public.current_user_is_active()) then
    raise exception 'Usuario no autorizado.' using errcode = '42501';
  end if;

  update public.profiles
  set last_login_at = now(),
      updated_by = actor_id
  where id = actor_id;
end;
$$;

create or replace function public.admin_update_profile(
  p_profile_id uuid,
  p_role_code text,
  p_is_active boolean,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_profile public.profiles%rowtype;
  old_role_code text;
  new_role_id uuid;
  active_admin_count integer;
begin
  if actor_id is null or not (select public.current_user_is_admin()) then
    raise exception 'Acción reservada para administradores activos.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('jor_store_active_administrator'));

  select * into target_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'Perfil no encontrado.' using errcode = 'P0002';
  end if;

  select code into old_role_code
  from public.roles
  where id = target_profile.role_id;

  select id into new_role_id
  from public.roles
  where code = p_role_code
    and is_active;

  if new_role_id is null then
    raise exception 'Rol no permitido.' using errcode = '22023';
  end if;

  if old_role_code = 'administrator'
     and target_profile.is_active
     and (not p_is_active or p_role_code <> 'administrator') then
    select count(*) into active_admin_count
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.is_active and r.code = 'administrator';

    if active_admin_count <= 1 then
      raise exception 'No se puede desactivar ni degradar al último administrador activo.';
    end if;
  end if;

  if p_display_name is not null and btrim(p_display_name) = '' then
    raise exception 'El nombre no puede estar vacío.' using errcode = '22023';
  end if;

  update public.profiles
  set role_id = new_role_id,
      is_active = p_is_active,
      display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
      updated_by = actor_id
  where id = p_profile_id;

  if old_role_code is distinct from p_role_code then
    insert into public.audit_logs (
      actor_user_id, action, target_profile_id, metadata
    ) values (
      actor_id,
      'role_changed',
      p_profile_id,
      jsonb_build_object('previous_role', old_role_code, 'new_role', p_role_code)
    );
  end if;

  if target_profile.is_active is distinct from p_is_active then
    insert into public.audit_logs (
      actor_user_id, action, target_profile_id, metadata
    ) values (
      actor_id,
      case when p_is_active then 'user_activated' else 'user_deactivated' end,
      p_profile_id,
      jsonb_build_object('previous_active', target_profile.is_active, 'new_active', p_is_active)
    );
  end if;
end;
$$;

create or replace function public.admin_record_invitation(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select public.current_user_is_admin()) then
    raise exception 'Acción reservada para administradores activos.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Perfil no encontrado.' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_user_id, action, target_profile_id)
  values (actor_id, 'invite_user', p_profile_id);
end;
$$;

create or replace function public.record_security_event(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Usuario no autenticado.' using errcode = '42501';
  end if;

  if p_action <> 'password_recovery_completed' then
    raise exception 'Evento no permitido.' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_user_id, action, target_profile_id)
  values (actor_id, p_action, actor_id);
end;
$$;

create trigger roles_set_updated_at
before update on public.roles
for each row execute function private.set_updated_at();

create trigger profiles_guard_protected_fields
before update on public.profiles
for each row execute function private.protect_profile_write();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create policy roles_select_active_authenticated
on public.roles
for select
to authenticated
using (
  (select public.current_user_is_active())
  and (is_active or (select public.current_user_is_admin()))
);

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  (select public.current_user_is_active())
  and (
    id = (select auth.uid())
    or (select public.current_user_is_admin())
  )
);

create policy audit_logs_select_admin
on public.audit_logs
for select
to authenticated
using ((select public.current_user_is_admin()));

revoke all on table public.roles from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.roles to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.audit_logs to authenticated;

revoke all on function public.current_user_is_active() from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_is_admin() from public, anon;
revoke all on function public.mark_current_user_login() from public, anon;
revoke all on function public.admin_update_profile(uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_record_invitation(uuid) from public, anon;
revoke all on function public.record_security_event(text) from public, anon;

grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.mark_current_user_login() to authenticated;
grant execute on function public.admin_update_profile(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_record_invitation(uuid) to authenticated;
grant execute on function public.record_security_event(text) to authenticated;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.protect_profile_write() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

commit;
