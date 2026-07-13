-- Verificación reproducible de Etapa 2 para una base local/de desarrollo.
-- Requiere tres perfiles ficticios ya existentes y la migración 003 aplicada.
-- No ejecutar contra producción. Todas las escrituras terminan con ROLLBACK.
--
-- psql "$SUPABASE_DB_URL" -v admin_id='<UUID>' -v operator_id='<UUID>' \
--   -v inactive_id='<UUID>' -f supabase/tests/rls_catalogs.sql

\set ON_ERROR_STOP on
begin;
set local session authorization authenticator;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'admin_id', 'role', 'authenticated')::text,
  true
);

insert into public.products (name, unit_code, created_by, updated_by)
values ('Producto ficticio etapa dos', 'und', :'operator_id', :'operator_id')
returning id as product_id \gset

insert into public.product_variants (
  product_id, sku, name, barcode, sale_price, created_by, updated_by
) values (
  :'product_id', ' sku-ficticio-001 ', 'Variante ficticia', 'BAR-FICTICIO-001', 10,
  :'operator_id', :'operator_id'
) returning id as variant_id \gset

insert into public.warehouses (code, name, created_by, updated_by)
values (' alm-fic-a ', 'Almacén ficticio A', :'operator_id', :'operator_id')
returning id as warehouse_a_id \gset

insert into public.warehouses (code, name, created_by, updated_by)
values ('ALM-FIC-B', 'Almacén ficticio B', :'operator_id', :'operator_id')
returning id as warehouse_b_id \gset

insert into public.warehouse_locations (
  warehouse_id, code, name, location_type, created_by, updated_by
) values (
  :'warehouse_a_id', ' ubic-01 ', 'Ubicación ficticia A', 'storage',
  :'operator_id', :'operator_id'
) returning id as location_a_id \gset

insert into public.warehouse_locations (
  warehouse_id, code, name, location_type, created_by, updated_by
) values (
  :'warehouse_b_id', 'UBIC-01', 'Ubicación ficticia B', 'picking',
  :'operator_id', :'operator_id'
) returning id as location_b_id \gset

insert into public.suppliers (
  code, business_name, tax_id, email, created_by, updated_by
) values (
  ' prov-fic-001 ', 'Proveedor completamente ficticio', 'TAX-FICTICIO-001',
  'catalogo@example.invalid', :'operator_id', :'operator_id'
) returning id as supplier_id \gset

-- Actualizaciones y cambios de estado generan auditoría dentro de la transacción.
update public.products set brand = 'Marca ficticia' where id = :'product_id'::uuid;
update public.product_variants set is_active = false where id = :'variant_id'::uuid;
update public.product_variants set is_active = true where id = :'variant_id'::uuid;
update public.warehouses set description = 'Descripción ficticia' where id = :'warehouse_a_id'::uuid;
update public.warehouse_locations set is_active = false where id = :'location_a_id'::uuid;
update public.warehouse_locations set is_active = true where id = :'location_a_id'::uuid;
update public.suppliers set notes = 'Nota completamente ficticia' where id = :'supplier_id'::uuid;

select (created_by = :'admin_id'::uuid and updated_by = :'admin_id'::uuid) as audit_actor_protected
from public.products where id = :'product_id'::uuid \gset
\if :audit_actor_protected
\else
  \echo 'FALLO: fue posible suplantar los campos de auditoría.'
  \quit 1
\endif

select (sku = 'SKU-FICTICIO-001') as sku_normalized
from public.product_variants where id = :'variant_id'::uuid \gset
\if :sku_normalized
\else
  \echo 'FALLO: el SKU no fue normalizado.'
  \quit 1
\endif

-- Unicidad e invariantes de relaciones y desactivación.
\set ON_ERROR_STOP off
savepoint duplicate_sku;
insert into public.product_variants (product_id, sku, name, sale_price)
values (:'product_id', 'sku-ficticio-001', 'Duplicada', 1);
\if :ERROR
  rollback to savepoint duplicate_sku;
\else
  \echo 'FALLO: se permitió un SKU duplicado.'
  \quit 1
\endif
release savepoint duplicate_sku;

savepoint duplicate_barcode;
insert into public.product_variants (product_id, sku, name, barcode, sale_price)
values (:'product_id', 'SKU-FICTICIO-002', 'Barcode duplicado', 'BAR-FICTICIO-001', 1);
\if :ERROR
  rollback to savepoint duplicate_barcode;
\else
  \echo 'FALLO: se permitió un barcode duplicado.'
  \quit 1
\endif
release savepoint duplicate_barcode;

savepoint duplicate_warehouse;
insert into public.warehouses (code, name)
values ('alm-fic-a', 'Código duplicado');
\if :ERROR
  rollback to savepoint duplicate_warehouse;
\else
  \echo 'FALLO: se permitió un código de almacén duplicado.'
  \quit 1
\endif
release savepoint duplicate_warehouse;

savepoint duplicate_location;
insert into public.warehouse_locations (warehouse_id, code, name, location_type)
values (:'warehouse_a_id', 'ubic-01', 'Código duplicado', 'storage');
\if :ERROR
  rollback to savepoint duplicate_location;
\else
  \echo 'FALLO: se permitió un código de ubicación duplicado dentro del almacén.'
  \quit 1
\endif
release savepoint duplicate_location;

savepoint duplicate_tax_id;
insert into public.suppliers (code, business_name, tax_id)
values ('PROV-FIC-002', 'Proveedor duplicado ficticio', 'TAX-FICTICIO-001');
\if :ERROR
  rollback to savepoint duplicate_tax_id;
\else
  \echo 'FALLO: se permitió un tax_id duplicado.'
  \quit 1
\endif
release savepoint duplicate_tax_id;

savepoint immutable_product;
update public.product_variants set product_id = gen_random_uuid() where id = :'variant_id'::uuid;
\if :ERROR
  rollback to savepoint immutable_product;
\else
  \echo 'FALLO: se permitió cambiar product_id.'
  \quit 1
\endif
release savepoint immutable_product;

savepoint immutable_warehouse;
update public.warehouse_locations set warehouse_id = :'warehouse_b_id' where id = :'location_a_id'::uuid;
\if :ERROR
  rollback to savepoint immutable_warehouse;
\else
  \echo 'FALLO: se permitió cambiar warehouse_id.'
  \quit 1
\endif
release savepoint immutable_warehouse;

savepoint active_product_children;
update public.products set is_active = false where id = :'product_id'::uuid;
\if :ERROR
  rollback to savepoint active_product_children;
\else
  \echo 'FALLO: se desactivó un producto con variante activa.'
  \quit 1
\endif
release savepoint active_product_children;

savepoint active_warehouse_children;
update public.warehouses set is_active = false where id = :'warehouse_a_id'::uuid;
\if :ERROR
  rollback to savepoint active_warehouse_children;
\else
  \echo 'FALLO: se desactivó un almacén con ubicación activa.'
  \quit 1
\endif
release savepoint active_warehouse_children;

savepoint forbidden_delete;
delete from public.products where id = :'product_id'::uuid;
\if :ERROR
  rollback to savepoint forbidden_delete;
\else
  \echo 'FALLO: se permitió borrar un producto.'
  \quit 1
\endif
release savepoint forbidden_delete;
\set ON_ERROR_STOP on

select (
  count(*) >= 14
  and bool_or(action = 'product_updated')
  and bool_or(action = 'variant_deactivated')
  and bool_or(action = 'variant_activated')
  and bool_or(action = 'warehouse_updated')
  and bool_or(action = 'location_deactivated')
  and bool_or(action = 'location_activated')
  and bool_or(action = 'supplier_updated')
) as catalog_audit_created
from public.audit_logs
where actor_user_id = :'admin_id'::uuid
  and entity_id in (
    :'product_id'::uuid, :'variant_id'::uuid, :'warehouse_a_id'::uuid,
    :'warehouse_b_id'::uuid, :'location_a_id'::uuid, :'location_b_id'::uuid,
    :'supplier_id'::uuid
  )
\gset
\if :catalog_audit_created
\else
  \echo 'FALLO: faltan registros de auditoría de catálogos.'
  \quit 1
\endif
reset role;

-- Anónimo: ninguna lectura.
set local role anon;
savepoint anonymous_read;
\set ON_ERROR_STOP off
select count(*) from public.products;
\if :ERROR
  rollback to savepoint anonymous_read;
\else
  \echo 'FALLO: el usuario anónimo pudo leer catálogos.'
  \quit 1
\endif
\set ON_ERROR_STOP on
release savepoint anonymous_read;
reset role;

-- Operador activo: solo activos y sin escrituras.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'operator_id', 'role', 'authenticated')::text,
  true
);
select (
  (select count(*) from public.products where id = :'product_id'::uuid) = 1
  and (select count(*) from public.warehouse_locations where id in (:'location_a_id'::uuid, :'location_b_id'::uuid)) = 2
) as operator_reads_active_catalogs \gset
\if :operator_reads_active_catalogs
\else
  \echo 'FALLO: el operador no pudo leer catálogos activos.'
  \quit 1
\endif

\set ON_ERROR_STOP off
savepoint operator_insert;
insert into public.products (name, unit_code) values ('Intento operador', 'UND');
\if :ERROR
  rollback to savepoint operator_insert;
\else
  \echo 'FALLO: el operador pudo crear un producto.'
  \quit 1
\endif
release savepoint operator_insert;
savepoint operator_update;
update public.products set name = 'Intento operador' where id = :'product_id'::uuid;
\if :ERROR
  rollback to savepoint operator_update;
\else
  \echo 'FALLO: el operador pudo modificar un producto.'
  \quit 1
\endif
release savepoint operator_update;
\set ON_ERROR_STOP on
reset role;

-- Usuario inactivo: ninguna lectura ni escritura.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'inactive_id', 'role', 'authenticated')::text,
  true
);
select (count(*) = 0) as inactive_catalogs_hidden from public.products \gset
\if :inactive_catalogs_hidden
\else
  \echo 'FALLO: el usuario inactivo pudo leer catálogos.'
  \quit 1
\endif
\set ON_ERROR_STOP off
savepoint inactive_insert;
insert into public.products (name, unit_code) values ('Intento inactivo', 'UND');
\if :ERROR
  rollback to savepoint inactive_insert;
\else
  \echo 'FALLO: el usuario inactivo pudo crear un producto.'
  \quit 1
\endif
release savepoint inactive_insert;
\set ON_ERROR_STOP on
reset role;

rollback;
\echo 'RLS Etapa 2: verificaciones preparadas y transacción revertida.'
