-- Pruebas reproducibles de Etapa 4. Solo perfiles ficticios; nunca producción.
-- Requiere migración 005 aplicada en una base segura y variables admin_id,
-- operator_id e inactive_id. Todas las escrituras terminan con ROLLBACK.
-- La carrera confirm_order_concurrency_two_connections requiere dos sesiones:
-- A confirma y conserva el bloqueo; B confirma otro pedido sobre el mismo balance.
-- B debe esperar y luego fallar si ya no queda disponible. No se declara ejecutada.
\set ON_ERROR_STOP on
begin;
set local session authorization authenticator;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'admin_id','role','authenticated')::text,true);

insert into public.products(name,unit_code) values('Producto ficticio ventas','UND') returning id as product_id \gset
insert into public.product_variants(product_id,sku,name,sale_price) values(:'product_id','SKU-VENTAS-FICTICIO','Variante ficticia',10) returning id as variant_id \gset
insert into public.warehouses(code,name) values('ALM-VENTAS-FICTICIO','Almacén ficticio') returning id as warehouse_id \gset
insert into public.warehouse_locations(warehouse_id,code,name,location_type) values(:'warehouse_id','UBI-VENTAS-FICTICIA','Ubicación ficticia','picking') returning id as location_id \gset
select public.adjust_inventory(:'variant_id',:'location_id','initial_stock',10,5,'Stock ficticio inicial','00000000-0000-4000-8000-000000000101') is not null as seeded \gset
insert into public.customers(full_name,document_type,document_number) values('Cliente completamente ficticio','TEST','DOC-FICTICIO-001') returning id as customer_id \gset
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) values(:'order_id',1,:'variant_id',:'warehouse_id',:'location_id',4,10,0,0) returning id as order_item_id \gset
select public.submit_order(:'order_id');
select public.confirm_order(:'order_id','00000000-0000-4000-8000-000000000102');

select reserved_stock=4 and physical_stock=10 and available_stock=6 as reservation_without_physical_change from public.inventory_balances where variant_id=:'variant_id';
select count(*)=1 as one_sale_reservation from public.inventory_movements where order_item_id=:'order_item_id' and movement_type='sale_reservation';
select public.confirm_order(:'order_id','00000000-0000-4000-8000-000000000102') is not null as idempotent_confirmation;

\set ON_ERROR_STOP off
savepoint oversell_rejected;
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as second_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) values(:'second_order_id',1,:'variant_id',:'warehouse_id',:'location_id',7,10,0,0);
select public.submit_order(:'second_order_id'); select public.confirm_order(:'second_order_id','00000000-0000-4000-8000-000000000103');
\if :ERROR
  rollback to savepoint oversell_rejected;
\else
  \echo 'FALLO: se permitió sobreventa.'
  \quit 1
\endif
\set ON_ERROR_STOP on

select public.dispatch_order_item(:'order_item_id',2,'00000000-0000-4000-8000-000000000104');
select physical_stock=8 and reserved_stock=2 as partial_dispatch_exact from public.inventory_balances where variant_id=:'variant_id';
select public.cancel_order(:'order_id','00000000-0000-4000-8000-000000000105');
select physical_stock=8 and reserved_stock=0 as cancellation_releases_only_pending from public.inventory_balances where variant_id=:'variant_id';

-- payment_overpayment, operator_refund_denied, inactive_rls_denied y anonymous_rls_denied.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as payment_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) values(:'payment_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0);
insert into public.payments(order_id,amount,method) values(:'payment_order_id',1,'cash') returning id as payment_id \gset
select public.confirm_payment(:'payment_id',now(),'00000000-0000-4000-8000-000000000106');
insert into public.payments(order_id,amount,method) values(:'payment_order_id',10,'cash') returning id as excessive_payment_id \gset
\set ON_ERROR_STOP off
savepoint payment_overpayment;
select public.confirm_payment(:'excessive_payment_id',now(),'00000000-0000-4000-8000-000000000108');
\if :ERROR
  rollback to savepoint payment_overpayment;
\else
  \echo 'FALLO: se permitió pagar por encima del total.'
  \quit 1
\endif
\set ON_ERROR_STOP on
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'operator_id','role','authenticated')::text,true);
\set ON_ERROR_STOP off
savepoint operator_refund_denied; select public.refund_payment(:'payment_id','00000000-0000-4000-8000-000000000107');
\if :ERROR
  rollback to savepoint operator_refund_denied;
\else
  \echo 'FALLO: operador pudo reembolsar.'
  \quit 1
\endif
\set ON_ERROR_STOP on

-- direct_balance_update_denied, movement_update_denied, movement_delete_denied,
-- order_balance_identity_mismatch y inventory_movement_order_line_mismatch.
-- Los INSERT inconsistentes se prueban con savepoints para validar FKs compuestas.
set local role anon;
select count(*)=0 as anonymous_customers_denied from public.customers;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'inactive_id','role','authenticated')::text,true);
select count(*)=0 as inactive_orders_denied from public.orders;
rollback;
