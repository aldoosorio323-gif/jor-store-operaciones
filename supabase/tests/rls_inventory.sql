-- VerificaciÃ³n reproducible de Etapa 3 para una base local/de pruebas.
-- Requiere tres perfiles EXCLUSIVAMENTE FICTICIOS ya existentes y migraciÃ³n 004 aplicada.
-- No ejecutar contra producciÃ³n ni con la cuenta administrativa real.
-- Todas las escrituras terminan con ROLLBACK.
--
-- psql "$SUPABASE_DB_URL" -v admin_id='<UUID_FICTICIO>' \
--   -v operator_id='<UUID_FICTICIO>' -v inactive_id='<UUID_FICTICIO>' \
--   -f supabase/tests/rls_inventory.sql

\set ON_ERROR_STOP on
begin;
set local session authorization authenticator;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, true);

-- CatÃ¡logos completamente ficticios, revertidos al finalizar.
insert into public.products (name, unit_code)
values ('Producto ficticio inventario', 'UND') returning id as product_id \gset
insert into public.product_variants (product_id, sku, name, sale_price)
values (:'product_id', 'SKU-ETAPA3-FICTICIO-A', 'Variante ficticia A', 1) returning id as variant_id \gset
insert into public.product_variants (product_id, sku, name, sale_price)
values (:'product_id', 'SKU-ETAPA3-FICTICIO-B', 'Variante ficticia B', 1) returning id as initial_variant_id \gset
insert into public.suppliers (code, business_name)
values ('PROV-ETAPA3-FICTICIO', 'Proveedor ficticio de pruebas') returning id as supplier_id \gset
insert into public.warehouses (code, name)
values ('ALM-ETAPA3-A', 'AlmacÃ©n ficticio origen') returning id as origin_warehouse_id \gset
insert into public.warehouses (code, name)
values ('ALM-ETAPA3-B', 'AlmacÃ©n ficticio destino') returning id as destination_warehouse_id \gset
insert into public.warehouse_locations (warehouse_id, code, name, location_type)
values (:'origin_warehouse_id', 'UBI-ETAPA3-A', 'UbicaciÃ³n ficticia origen', 'storage') returning id as origin_location_id \gset
insert into public.warehouse_locations (warehouse_id, code, name, location_type)
values (:'destination_warehouse_id', 'UBI-ETAPA3-B', 'UbicaciÃ³n ficticia destino', 'storage') returning id as destination_location_id \gset

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
  \echo 'FALLO: no se confirmÃ³ la compra ficticia.'
  \quit 1
\endif

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
  \echo 'FALLO: una lÃ­nea confirmada fue editable.'
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
  \echo 'FALLO: el reintento duplicÃ³ el movimiento.'
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
  \echo 'FALLO: una clave idempotente aceptÃ³ otro payload.'
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
  \echo 'FALLO: balance, versiÃ³n o promedio ponderado incorrecto.'
  \quit 1
\endif

\set ON_ERROR_STOP off
savepoint over_receive;
select public.receive_purchase_item(
  :'purchase_item_b_id', :'origin_location_id', 1, 'idem-purchase-ficticia-0003'
);
\if :ERROR
  rollback to savepoint over_receive;
\else
  \echo 'FALLO: se permitiÃ³ recibir por encima de lo pedido.'
  \quit 1
\endif
release savepoint over_receive;

-- No hay escritura directa de balances ni mutaciÃ³n del libro mayor.
savepoint direct_balance_update;
update public.inventory_balances set physical_stock = 99
where variant_id = :'variant_id'::uuid and location_id = :'origin_location_id'::uuid;
\if :ERROR
  rollback to savepoint direct_balance_update;
\else
  \echo 'FALLO: se permitiÃ³ actualizar un balance directamente.'
  \quit 1
\endif
release savepoint direct_balance_update;
savepoint direct_balance_insert;
insert into public.inventory_balances (variant_id, warehouse_id, location_id)
values (:'variant_id', :'destination_warehouse_id', :'destination_location_id');
\if :ERROR
  rollback to savepoint direct_balance_insert;
\else
  \echo 'FALLO: se permitiÃ³ insertar un balance directamente.'
  \quit 1
\endif
release savepoint direct_balance_insert;
savepoint movement_update;
update public.inventory_movements set reason = 'Intento' where purchase_id = :'purchase_id'::uuid;
\if :ERROR
  rollback to savepoint movement_update;
\else
  \echo 'FALLO: se permitiÃ³ editar un movimiento.'
  \quit 1
\endif
release savepoint movement_update;
savepoint movement_delete;
delete from public.inventory_movements where purchase_id = :'purchase_id'::uuid;
\if :ERROR
  rollback to savepoint movement_delete;
\else
  \echo 'FALLO: se permitiÃ³ eliminar un movimiento.'
  \quit 1
\endif
release savepoint movement_delete;
\set ON_ERROR_STOP on

-- Transferencia: salida completa, trÃ¡nsito y recepciÃ³n parcial/completa.
insert into public.inventory_transfers (origin_warehouse_id, destination_warehouse_id, notes)
values (:'origin_warehouse_id', :'destination_warehouse_id', 'Transferencia ficticia') returning id as transfer_id \gset
insert into public.inventory_transfer_items (
  transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity
) values (
  :'transfer_id', 1, :'variant_id', :'origin_location_id', :'destination_location_id', 2
) returning id as transfer_item_id \gset
select public.confirm_inventory_transfer(:'transfer_id') is not null as transfer_confirmed \gset
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
  \echo 'FALLO: el reintento duplicÃ³ la salida de transferencia.'
  \quit 1
\endif
select (count(*) = 0) as destination_still_empty from public.inventory_balances
where variant_id = :'variant_id'::uuid and location_id = :'destination_location_id'::uuid \gset
\if :destination_still_empty
\else
  \echo 'FALLO: el stock apareciÃ³ en destino antes de recibir.'
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
  \echo 'FALLO: la recepciÃ³n de transferencia no conciliÃ³.'
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
  \echo 'FALLO: se permitiÃ³ recibir por encima de lo despachado.'
  \quit 1
\endif
release savepoint transfer_over_receive;

-- Una operaciÃ³n multilÃ­nea revierte por completo si una lÃ­nea no tiene stock.
\set ON_ERROR_STOP on
insert into public.inventory_transfers (origin_warehouse_id, destination_warehouse_id, notes)
values (:'origin_warehouse_id', :'destination_warehouse_id', 'Transferencia ficticia fallida')
returning id as failing_transfer_id \gset
insert into public.inventory_transfer_items (
  transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity
) values (
  :'failing_transfer_id', 1, :'variant_id', :'origin_location_id', :'destination_location_id', 1
);
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
  \echo 'FALLO: se permitiÃ³ una transferencia sin stock suficiente.'
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
  \echo 'FALLO: el error multilÃ­nea dejÃ³ efectos parciales.'
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
  \echo 'FALLO: se permitiÃ³ repetir stock inicial.'
  \quit 1
\endif
release savepoint duplicate_initial_stock;
\set ON_ERROR_STOP on
select public.adjust_inventory(
  :'initial_variant_id', :'origin_location_id', 'negative_adjustment', 1, null,
  'Ajuste negativo ficticio', 'idem-adjust-negative-0001'
) is not null as negative_adjustment_created \gset

select (count(*) = 0) as reconciliation_clean from public.admin_inventory_reconciliation() \gset
\if :reconciliation_clean
\else
  \echo 'FALLO: la conciliaciÃ³n detectÃ³ diferencias.'
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

-- AnÃ³nimo: sin privilegios de lectura.
set local role anon;
\set ON_ERROR_STOP off
savepoint anonymous_read;
select count(*) from public.inventory_balances;
\if :ERROR
  rollback to savepoint anonymous_read;
\else
  \echo 'FALLO: el usuario anÃ³nimo pudo leer inventario.'
  \quit 1
\endif
release savepoint anonymous_read;
\set ON_ERROR_STOP on
reset role;

\echo 'RLS Etapa 3: verificaciones preparadas y transacciÃ³n revertida.'
rollback;
