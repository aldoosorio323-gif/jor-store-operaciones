begin;

create or replace function private.protect_profile_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  -- session_user distingue una conexión SQL administrativa directa de una
  -- petición PostgREST, donde current_user sería el dueño SECURITY DEFINER.
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if actor_id is null or not (select public.current_user_is_active()) then
    raise exception 'El usuario responsable no está activo.' using errcode = '42501';
  end if;

  if not (select public.current_user_is_admin()) and (
    new.role_id is distinct from old.role_id
    or new.is_active is distinct from old.is_active
    or new.created_by is distinct from old.created_by
    or new.updated_by is distinct from old.updated_by
    or new.id is distinct from old.id
  ) then
    -- mark_current_user_login actualiza únicamente la marca de acceso del actor.
    if new.id = actor_id
       and new.id = old.id
       and new.role_id is not distinct from old.role_id
       and new.is_active is not distinct from old.is_active
       and new.display_name is not distinct from old.display_name
       and new.last_login_at is distinct from old.last_login_at
       and new.created_at is not distinct from old.created_at
       and new.updated_at is not distinct from old.updated_at
       and new.created_by is not distinct from old.created_by
       and new.updated_by is not distinct from actor_id then
      return new;
    end if;

    raise exception 'No se permite modificar campos protegidos del perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_write() from public, anon, authenticated;

commit;
