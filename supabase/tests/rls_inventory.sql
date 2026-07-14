-- Verificación reproducible de Etapa 3 para una base local/de pruebas.
-- Requiere tres perfiles EXCLUSIVAMENTE FICTICIOS ya existentes y migración 004 aplicada.
-- No ejecutar contra producción ni con la cuenta administrativa real.
-- Todas las escrituras terminan con ROLLBACK.
--
-- psql "$SUPABASE_DB_URL" -v admin_id='<UUID_FICTICIO>' \
--   -v operator_id='<UUID_FICTICIO>' -v inactive_id='<UUID_FICTICIO>' \
--   -f supabase/tests/rls_inventory.sql
--
-- movement_deactivation_concurrency_two_connections (prueba manual local):
-- 1. Preparar estos mismos catálogos ficticios en dos conexiones de prueba.
-- 2. Conexión A: BEGIN; ejecutar adjust_inventory sobre la variante/ubicación y
--    mantener la transacción abierta después de que apply_inventory_movement tome
--    sus bloqueos FOR SHARE.
-- 3. Conexión B: intentar UPDATE product_variants o warehouse_locations SET
--    is_active = false sobre el mismo registro; debe esperar a la conexión A.
-- 4. COMMIT en A; B debe reanudar y rechazar la desactivación por stock.
-- Requiere dos conexiones reales. Este archivo no declara que esa carrera pasó.

\set ON_ERROR_STOP on
begin;
set local session authorization authenticator;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, true);

-- Catálogos completamente ficticios, revertidos al finalizar.
insert into public.products (name, unit_code)
values ('Producto ficticio inventario', 'UND') returning id as product_id \gset
insert into public.product_variants (product_id, sku, name, sale_price)
values (:'product_id', 'SKU-ETAPA3-FICTICIO-A', 'Variante ficticia A', 1) returning id as variant_id \gset
insert into public.product_variants (product_id, sku, name, sale_price)
values (:'product_id', 'SKU-ETAPA3-FICTICIO-B', 'Variante ficticia B', 1) returning id as initial_variant_id \gset
insert into public.suppliers (code, business_name)
values ('PROV-ETAPA3-FICTICIO', 'Proveedor ficticio de pruebas') returning id as supplier_id \gset
insert into public.warehouses (code, name)
values ('ALM-ETAPA3-A', 'Almacén ficticio origen') returning id as origin_warehouse_id \gset
insert into public.warehouses (code, name)
values ('ALM-ETAPA3-B', 'Almacén ficticio destino') returning id as destination_warehouse_id \gset
insert into public.warehouse_locations (warehouse_id, code, name, location_type)
values (:'origin_warehouse_id', 'UBI-ETAPA3-A', 'Ubicación ficticia origen', 'storage') returning id as origin_location_id \gset
insert into public.warehouse_locations (warehouse_id, code, name, location_type)
values (:'destination_warehouse_id', 'UBI-ETAPA3-B', 'Ubicación ficticia destino', 'storage') returning id as destination_location_id \gset

-- adjustment_without_reason_rejected: los ajustes continúan exigiendo un motivo no vacío.
\set ON_ERROR_STOP off
savepoint adjustment_without_reason_rejected;
select public.adjust_inventory(
  :'variant_id', :'origin_location_id', 'positive_adjustment', 1, 1,
  null, 'idem-adjustment-without-reason-ficticia-0001'
);
\if :ERROR
  rollback to savepoint adjustment_without_reason_rejected;
\else
  \echo 'FALLO: se permitió un ajuste sin motivo.'
  \quit 1
\endif
release savepoint adjustment_without_reason_rejected;
\set ON_ERROR_STOP on

-- Compra, congelamiento, recepciones parciales/completas e idempotencia.
insert into public.purchases (supplier_id, supplier_reference, ordered_at)
values (:'supplier_id', 'REF-FICTICIA-ETAPA3', now()) returning id as purchase_id \gset
insert into public.purchase_items (purchase_id, line_number, variant_id, ordered_quantity, unit_cost, tax_amount)
values (:'purchase_id', 1, :'variant_id', 2, 10, 0) returning id as purchase_item_a_id \gset
insert into public.purchase_items (purchase_id, line_number, variant_id, ordered_quantity, unit_cost, tax_amount)
values (:'purchase_id', 2, :'variant_id', 2, 14, 0) returning id as purchase_item_b_id \gset
select public.confirm_purchase(:'purchase_id') is not null as purchase_confirmed \gset
\if :purchase_confirmed
\else
  \echo 'FALLO: no se confirmó la compra ficticia.'
  \quit 1
\endif

\set ON_ERROR_STOP off
savepoint variant_pending_purchase_deactivation;
update public.product_variants set is_active = false where id = :'variant_id'::uuid;
\if :ERROR
  rollback to savepoint variant_pending_purchase_deactivation;
\else
  \echo 'FALLO: se desactivó una variante con una compra pendiente.'
  \quit 1
\endif
release savepoint variant_pending_purchase_deactivation;
\set ON_ERROR_STOP on

\set ON_ERROR_STOP off
savepoint frozen_purchase;
update public.purchases set notes = 'Intento posterior' where id = :'purchase_id'::uuid;
\if :ERROR
  rollback to savepoint frozen_purchase;
\else
  \echo 'FALLO: una compra confirmada fue editable.'
  \quit 1
\endif
release savepoint frozen_purchase;
savepoint frozen_item;
update public.purchase_items set ordered_quantity = 9 where id = :'purchase_item_a_id'::uuid;
\if :ERROR
  rollback to savepoint frozen_item;
\else
  \echo 'FALLO: una línea confirmada fue editable.'
  \quit 1
\endif
release savepoint frozen_item;
\set ON_ERROR_STOP on

select (public.receive_purchase_item(
  :'purchase_item_a_id', :'origin_location_id', 2, 'idem-purchase-ficticia-0001'
)->>'purchase_status' = 'partially_received') as partial_purchase \gset
select (public.receive_purchase_item(
  :'purchase_item_a_id', :'origin_location_id', 2, 'idem-purchase-ficticia-0001'
)->>'received_quantity' = '2.000') as idempotent_replay \gset
select (count(*) = 1) as one_purchase_movement from public.inventory_movements
where idempotency_key = 'idem-purchase-ficticia-0001' \gset
\if :one_purchase_movement
\else
  \echo 'FALLO: el reintento duplicó el movimiento.'
  \quit 1
\endif

\set ON_ERROR_STOP off
savepoint reused_key;
select public.receive_purchase_item(
  :'purchase_item_b_id', :'origin_location_id', 1, 'idem-purchase-ficticia-0001'
);
\if :ERROR
  rollback to savepoint reused_key;
\else
  \echo 'FALLO: una clave idempotente aceptó otro payload.'
  \quit 1
\endif
release savepoint reused_key;
\set ON_ERROR_STOP on

select (public.receive_purchase_item(
  :'purchase_item_b_id', :'origin_location_id', 2, 'idem-purchase-ficticia-0002'
)->>'purchase_status' = 'received') as complete_purchase \gset
select (
  physical_stock = 4 and reserved_stock = 0 and available_stock = 4
  and average_unit_cost = 12.0000 and version = 2
) as weighted_average_exact
from public.inventory_balances
where variant_id = :'variant_id'::uuid and location_id = :'origin_location_id'::uuid \gset
\if :weighted_average_exact
\else
  \echo 'FALLO: balance, versión o promedio ponderado incorrecto.'
  \quit 1
\endif

\set ON_ERROR_STOP off
savepoint variant_with_stock_deactivation;
update public.product_variants set is_active = false where id = :'variant_id'::uuid;
\if :ERROR
  rollback to savepoint variant_with_stock_deactivation;
\else
  \echo 'FALLO: se desactivó una variante con stock.'
  \quit 1
\endif
release savepoint variant_with_stock_deactivation;
savepoint location_with_stock_deactivation;
update public.warehouse_locations set is_active = false where id = :'origin_location_id'::uuid;
\if :ERROR
  rollback to savepoint location_with_stock_deactivation;
\else
  \echo 'FALLO: se desactivó una ubicación con stock.'
  \quit 1
\endif
release savepoint location_with_stock_deactivation;
\set ON_ERROR_STOP on

\set ON_ERROR_STOP off
savepoint over_receive;
select public.receive_purchase_item(
  :'purchase_item_b_id', :'origin_location_id', 1, 'idem-purchase-ficticia-0003'
);
\if :ERROR
  rollback to savepoint over_receive;
\else
  \echo 'FALLO: se permitió recibir por encima de lo pedido.'
  \quit 1
\endif
release savepoint over_receive;

-- No hay escritura directa de balances ni mutación del libro mayor.
savepoint direct_balance_update;
update public.inventory_balances set physical_stock = 99
where variant_id = :'variant_id'::uuid and location_id = :'origin_location_id'::uuid;
\if :ERROR
  rollback to savepoint direct_balance_update;
\else
  \echo 'FALLO: se permitió actualizar un balance directamente.'
  \quit 1
\endif
release savepoint direct_balance_update;
savepoint direct_balance_insert;
insert into public.inventory_balances (variant_id, warehouse_id, location_id)
values (:'variant_id', :'destination_warehouse_id', :'destination_location_id');
\if :ERROR
  rollback to savepoint direct_balance_insert;
\else
  \echo 'FALLO: se permitió insertar un balance directamente.'
  \quit 1
\endif
release savepoint direct_balance_insert;
savepoint movement_update;
update public.inventory_movements set reason = 'Intento' where purchase_id = :'purchase_id'::uuid;
\if :ERROR
  rollback to savepoint movement_update;
\else
  \echo 'FALLO: se permitió editar un movimiento.'
  \quit 1
\endif
release savepoint movement_update;
savepoint movement_delete;
delete from public.inventory_movements where purchase_id = :'purchase_id'::uuid;
\if :ERROR
  rollback to savepoint movement_delete;
\else
  \echo 'FALLO: se permitió eliminar un movimiento.'
  \quit 1
\endif
release savepoint movement_delete;
\set ON_ERROR_STOP on

-- Transferencia: salida completa, tránsito y recepción parcial/completa.
insert into public.inventory_transfers (origin_warehouse_id, destination_warehouse_id, notes)
values (:'origin_warehouse_id', :'destination_warehouse_id', 'Transferencia ficticia') returning id as transfer_id \gset
insert into public.inventory_transfer_items (
  transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity
) values (
  :'transfer_id', 1, :'variant_id', :'origin_location_id', :'destination_location_id', 2
) returning id as transfer_item_id \gset
select public.confirm_inventory_transfer(:'transfer_id') is not null as transfer_confirmed \gset
\set ON_ERROR_STOP off
savepoint variant_open_transfer_deactivation;
update public.product_variants set is_active = false where id = :'variant_id'::uuid;
\if :ERROR
  rollback to savepoint variant_open_transfer_deactivation;
\else
  \echo 'FALLO: se desactivó una variante vinculada a una transferencia abierta.'
  \quit 1
\endif
release savepoint variant_open_transfer_deactivation;
savepoint location_open_transfer_deactivation;
update public.warehouse_locations set is_active = false where id = :'destination_location_id'::uuid;
\if :ERROR
  rollback to savepoint location_open_transfer_deactivation;
\else
  \echo 'FALLO: se desactivó una ubicación vinculada a una transferencia abierta.'
  \quit 1
\endif
release savepoint location_open_transfer_deactivation;
\set ON_ERROR_STOP on
select (public.dispatch_inventory_transfer(
  :'transfer_id', 'idem-transfer-dispatch-0001'
)->>'transfer_status' = 'in_transit') as transfer_dispatched \gset
select (public.dispatch_inventory_transfer(
  :'transfer_id', 'idem-transfer-dispatch-0001'
)->>'transfer_status' = 'in_transit') as transfer_dispatch_replay \gset
select (count(*) = 1) as one_transfer_out from public.inventory_movements
where transfer_id = :'transfer_id'::uuid and movement_type = 'transfer_out' \gset
\if :one_transfer_out
\else
  \echo 'FALLO: el reintento duplicó la salida de transferencia.'
  \quit 1
\endif
select (count(*) = 0) as destination_still_empty from public.inventory_balances
where variant_id = :'variant_id'::uuid and location_id = :'destination_location_id'::uuid \gset
\if :destination_still_empty
\else
  \echo 'FALLO: el stock apareció en destino antes de recibir.'
  \quit 1
\endif
select (public.receive_inventory_transfer_item(
  :'transfer_item_id', 1, 'idem-transfer-receive-0001'
)->>'transfer_status' = 'partially_received') as transfer_partial \gset
select (public.receive_inventory_transfer_item(
  :'transfer_item_id', 1, 'idem-transfer-receive-0002'
)->>'transfer_status' = 'received') as transfer_received \gset
select (
  physical_stock = 2 and average_unit_cost = 12.0000 and version = 2
) as destination_received
from public.inventory_balances
where variant_id = :'variant_id'::uuid and location_id = :'destination_location_id'::uuid \gset
\if :destination_received
\else
  \echo 'FALLO: la recepción de transferencia no concilió.'
  \quit 1
\endif

\set ON_ERROR_STOP off
savepoint transfer_over_receive;
select public.receive_inventory_transfer_item(
  :'transfer_item_id', 1, 'idem-transfer-receive-0003'
);
\if :ERROR
  rollback to savepoint transfer_over_receive;
\else
  \echo 'FALLO: se permitió recibir por encima de lo despachado.'
  \quit 1
\endif
release savepoint transfer_over_receive;

-- Una operación multilínea revierte por completo si una línea no tiene stock.
\set ON_ERROR_STOP on
insert into public.inventory_transfers (origin_warehouse_id, destination_warehouse_id, notes)
values (:'origin_warehouse_id', :'destination_warehouse_id', 'Transferencia ficticia fallida')
returning id as failing_transfer_id \gset
insert into public.inventory_transfer_items (
  transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity
) values (
  :'failing_transfer_id', 1, :'variant_id', :'origin_location_id', :'destination_location_id', 1
) returning id as failing_transfer_item_id \gset
insert into public.inventory_transfer_items (
  transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity
) values (
  :'failing_transfer_id', 2, :'variant_id', :'origin_location_id', :'destination_location_id', 99
);
select public.confirm_inventory_transfer(:'failing_transfer_id') is not null as failing_transfer_confirmed \gset
\set ON_ERROR_STOP off
savepoint atomic_dispatch;
select public.dispatch_inventory_transfer(:'failing_transfer_id', 'idem-transfer-atomic-0001');
\if :ERROR
  rollback to savepoint atomic_dispatch;
\else
  \echo 'FALLO: se permitió una transferencia sin stock suficiente.'
  \quit 1
\endif
release savepoint atomic_dispatch;
\set ON_ERROR_STOP on
select (
  (select count(*) from public.inventory_movements where transfer_id = :'failing_transfer_id'::uuid) = 0
  and (select status from public.inventory_transfers where id = :'failing_transfer_id'::uuid) = 'confirmed'
) as multiline_rollback_complete \gset
\if :multiline_rollback_complete
\else
  \echo 'FALLO: el error multilínea dejó efectos parciales.'
  \quit 1
\endif

-- Ajustes administrativos e initial_stock una sola vez.
select public.adjust_inventory(
  :'initial_variant_id', :'origin_location_id', 'initial_stock', 5, 3,
  'Carga inicial completamente ficticia', 'idem-adjust-initial-0001'
) is not null as initial_stock_created \gset
\set ON_ERROR_STOP off
savepoint duplicate_initial_stock;
select public.adjust_inventory(
  :'initial_variant_id', :'origin_location_id', 'initial_stock', 1, 3,
  'Segundo intento ficticio', 'idem-adjust-initial-0002'
);
\if :ERROR
  rollback to savepoint duplicate_initial_stock;
\else
  \echo 'FALLO: se permitió repetir stock inicial.'
  \quit 1
\endif
release savepoint duplicate_initial_stock;
\set ON_ERROR_STOP on
select public.adjust_inventory(
  :'initial_variant_id', :'origin_location_id', 'negative_adjustment', 1, null,
  'Ajuste negativo ficticio', 'idem-adjust-negative-0001'
) is not null as negative_adjustment_created \gset

-- Referencias auxiliares ficticias para probar claves compuestas del libro mayor.
insert into public.purchases (supplier_id, supplier_reference, ordered_at)
values (:'supplier_id', 'REF-FICTICIA-COMPUESTA', now()) returning id as other_purchase_id \gset
insert into public.purchase_items (purchase_id, line_number, variant_id, ordered_quantity, unit_cost, tax_amount)
values (:'other_purchase_id', 1, :'variant_id', 1, 5, 0) returning id as other_purchase_item_id \gset

select (count(*) = 0) as reconciliation_clean from public.admin_inventory_reconciliation() \gset
\if :reconciliation_clean
\else
  \echo 'FALLO: la conciliación detectó diferencias.'
  \quit 1
\endif

reset role;

-- Operador activo: lee/opera, pero no ajusta.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'operator_id', 'role', 'authenticated')::text, true);
select (count(*) > 0) as operator_reads_balances from public.inventory_balances \gset
\set ON_ERROR_STOP off
savepoint operator_adjustment;
select public.adjust_inventory(
  :'variant_id', :'origin_location_id', 'positive_adjustment', 1, 1,
  'Intento operador ficticio', 'idem-operator-adjust-0001'
);
\if :ERROR
  rollback to savepoint operator_adjustment;
\else
  \echo 'FALLO: el operador pudo crear un ajuste.'
  \quit 1
\endif
release savepoint operator_adjustment;
\set ON_ERROR_STOP on
reset role;

-- Usuario inactivo: RLS no devuelve filas.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'inactive_id', 'role', 'authenticated')::text, true);
select (count(*) = 0) as inactive_cannot_read from public.inventory_balances \gset
\if :inactive_cannot_read
\else
  \echo 'FALLO: el usuario inactivo pudo leer inventario.'
  \quit 1
\endif
reset role;

-- Anónimo: sin privilegios de lectura.
set local role anon;
\set ON_ERROR_STOP off
savepoint anonymous_read;
select count(*) from public.inventory_balances;
\if :ERROR
  rollback to savepoint anonymous_read;
\else
  \echo 'FALLO: el usuario anónimo pudo leer inventario.'
  \quit 1
\endif
release savepoint anonymous_read;
\set ON_ERROR_STOP on
reset role;

-- Integridad compuesta. Requiere que la conexión local de pruebas pueda volver
-- a su rol original privilegiado; cada rechazo debe ser específicamente 23503.
reset session authorization;
select id as origin_balance_id from public.inventory_balances
where variant_id = :'variant_id'::uuid and location_id = :'origin_location_id'::uuid \gset

\set ON_ERROR_STOP off
savepoint balance_identity_mismatch;
insert into public.inventory_movements (
  balance_id, movement_type, variant_id, warehouse_id, location_id,
  previous_physical, physical_delta, resulting_physical,
  previous_reserved, reserved_delta, resulting_reserved, unit_cost_snapshot,
  reason, responsible_user_id, idempotency_key, created_by
) values (
  :'origin_balance_id', 'positive_adjustment', :'variant_id',
  :'destination_warehouse_id', :'destination_location_id',
  0, 1, 1, 0, 0, 0, 1,
  'Prueba ficticia de identidad de balance', :'admin_id', 'idem-fk-balance-ficticia-0001', :'admin_id'
);
\set balance_identity_sqlstate :SQLSTATE
rollback to savepoint balance_identity_mismatch;
select :'balance_identity_sqlstate' = '23503' as balance_identity_rejected \gset
\if :balance_identity_rejected
\else
  \echo 'FALLO: no se rechazó la identidad compuesta inconsistente del balance.'
  \quit 1
\endif
release savepoint balance_identity_mismatch;

savepoint purchase_line_identity_mismatch;
insert into public.inventory_movements (
  balance_id, movement_type, variant_id, warehouse_id, location_id,
  previous_physical, physical_delta, resulting_physical,
  previous_reserved, reserved_delta, resulting_reserved, unit_cost_snapshot,
  purchase_id, purchase_item_id, responsible_user_id, idempotency_key, created_by
) values (
  :'origin_balance_id', 'purchase_entry', :'variant_id',
  :'origin_warehouse_id', :'origin_location_id',
  0, 1, 1, 0, 0, 0, 1,
  :'purchase_id', :'other_purchase_item_id', :'admin_id', 'idem-fk-purchase-ficticia-0001', :'admin_id'
);
\set purchase_line_sqlstate :SQLSTATE
rollback to savepoint purchase_line_identity_mismatch;
select :'purchase_line_sqlstate' = '23503' as purchase_line_identity_rejected \gset
\if :purchase_line_identity_rejected
\else
  \echo 'FALLO: no se rechazó una línea asociada a otra compra.'
  \quit 1
\endif
release savepoint purchase_line_identity_mismatch;

savepoint transfer_line_identity_mismatch;
insert into public.inventory_movements (
  balance_id, movement_type, variant_id, warehouse_id, location_id,
  previous_physical, physical_delta, resulting_physical,
  previous_reserved, reserved_delta, resulting_reserved, unit_cost_snapshot,
  transfer_id, transfer_item_id, responsible_user_id, idempotency_key, created_by
) values (
  :'origin_balance_id', 'transfer_out', :'variant_id',
  :'origin_warehouse_id', :'origin_location_id',
  1, -1, 0, 0, 0, 0, 1,
  :'transfer_id', :'failing_transfer_item_id', :'admin_id', 'idem-fk-transfer-ficticia-0001', :'admin_id'
);
\set transfer_line_sqlstate :SQLSTATE
rollback to savepoint transfer_line_identity_mismatch;
select :'transfer_line_sqlstate' = '23503' as transfer_line_identity_rejected \gset
\if :transfer_line_identity_rejected
\else
  \echo 'FALLO: no se rechazó una línea asociada a otra transferencia.'
  \quit 1
\endif
release savepoint transfer_line_identity_mismatch;
\set ON_ERROR_STOP on

\echo 'RLS Etapa 3: verificaciones preparadas y transacción revertida.'
rollback;
