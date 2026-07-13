-- PLANTILLA MANUAL. No es una migración y no debe ejecutarse automáticamente.
-- 1. Cree primero el usuario en Supabase Auth.
-- 2. Sustituya NULL por el UUID explícito del usuario: '<UUID>'::uuid.
-- 3. Revise el resultado y cambie ROLLBACK por COMMIT solo si es correcto.

begin;

do $$
declare
  target_user_id uuid := null;
  administrator_role_id uuid;
begin
  if target_user_id is null then
    raise exception 'Debe proporcionar explícitamente el UUID del usuario.';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'El UUID no pertenece a un usuario de Supabase Auth.';
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.is_active and r.code = 'administrator'
  ) then
    raise exception 'Ya existe un administrador activo; use la aplicación.';
  end if;

  select id into administrator_role_id
  from public.roles
  where code = 'administrator' and is_active;

  if administrator_role_id is null then
    raise exception 'No existe el rol administrator activo.';
  end if;

  update public.profiles
  set role_id = administrator_role_id,
      is_active = true,
      updated_by = target_user_id
  where id = target_user_id;

  if not found then
    raise exception 'El usuario aún no tiene perfil; revise el trigger de creación.';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    target_profile_id,
    metadata
  ) values (
    null,
    'bootstrap_administrator',
    target_user_id,
    jsonb_build_object('procedure', 'manual_bootstrap')
  );
end;
$$;

select p.id, p.display_name, p.is_active, r.code as role
from public.profiles p
join public.roles r on r.id = p.role_id
where r.code = 'administrator' and p.is_active;

rollback;
