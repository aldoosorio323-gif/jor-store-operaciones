-- Verificación reproducible para una base local/de desarrollo ya preparada.
-- Requiere psql y UUID explícitos de cuatro usuarios ficticios de prueba.
-- No ejecutar contra producción.
--
-- psql "$SUPABASE_DB_URL" -v admin_id='<UUID>' -v operator_id='<UUID>' \
--   -v inactive_id='<UUID>' -v other_id='<UUID>' \
--   -f supabase/tests/rls_auth_roles.sql

\set ON_ERROR_STOP on
begin;

-- PostgREST abre la conexión como authenticator y luego asume anon/authenticated.
-- Esto evita confundir la conexión directa de psql con una petición de API.
set local session authorization authenticator;

set local role anon;
select (count(*) = 0) as anonymous_profiles_hidden from public.profiles \gset
\if :anonymous_profiles_hidden
\else
  \echo 'FALLO: el usuario anónimo pudo leer perfiles.'
  \quit 1
\endif
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'operator_id', 'role', 'authenticated')::text,
  true
);
select (count(*) = 1) as operator_sees_only_self from public.profiles \gset
\if :operator_sees_only_self
\else
  \echo 'FALLO: el operador no ve exactamente su propio perfil.'
  \quit 1
\endif
select (count(*) = 0) as operator_cannot_see_other
from public.profiles
where id = :'other_id'::uuid \gset
\if :operator_cannot_see_other
\else
  \echo 'FALLO: el operador pudo consultar otro perfil.'
  \quit 1
\endif

\set ON_ERROR_STOP off
update public.profiles
set role_id = (select id from public.roles where code = 'administrator')
where id = :'operator_id'::uuid;
\if :ERROR
\else
  \echo 'FALLO: el operador pudo cambiar su propio rol.'
  \quit 1
\endif
\set ON_ERROR_STOP on

\set ON_ERROR_STOP off
select public.admin_update_profile(
  :'other_id'::uuid,
  'operator',
  true,
  null
);
\if :ERROR
\else
  \echo 'FALLO: el operador pudo ejecutar admin_update_profile.'
  \quit 1
\endif
\set ON_ERROR_STOP on

-- La marca de último acceso del propio operador sí debe poder actualizarse.
select public.mark_current_user_login();
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'inactive_id', 'role', 'authenticated')::text,
  true
);
select (count(*) = 0) as inactive_profiles_hidden from public.profiles \gset
\if :inactive_profiles_hidden
\else
  \echo 'FALLO: el usuario inactivo pudo leer perfiles.'
  \quit 1
\endif

\set ON_ERROR_STOP off
select public.admin_update_profile(
  :'other_id'::uuid,
  'operator',
  true,
  null
);
\if :ERROR
\else
  \echo 'FALLO: el usuario inactivo pudo ejecutar admin_update_profile.'
  \quit 1
\endif
\set ON_ERROR_STOP on
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'admin_id', 'role', 'authenticated')::text,
  true
);
select (count(*) >= 2) as admin_can_see_profiles from public.profiles \gset
\if :admin_can_see_profiles
\else
  \echo 'FALLO: el administrador no pudo consultar perfiles.'
  \quit 1
\endif

select r.code as target_role, p.is_active::text as target_active
from public.profiles p
join public.roles r on r.id = p.role_id
where p.id = :'other_id'::uuid
\gset

select public.admin_update_profile(
  :'other_id'::uuid,
  :'target_role',
  :'target_active'::boolean,
  null
);
reset role;

rollback;
\echo 'RLS Etapa 1: verificaciones aprobadas.'
