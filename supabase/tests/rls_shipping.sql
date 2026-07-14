-- Pruebas reproducibles de Etapa 5A. Solo perfiles y datos ficticios.
-- Requiere migración 006 aplicada en una base segura y variables admin_id,
-- operator_id e inactive_id. Todas las escrituras terminan con ROLLBACK.
-- shipping_concurrency_two_connections: sesión A prepara un envío y conserva
-- el bloqueo; sesión B intenta asignar simultáneamente el mismo remanente a
-- otro envío. B debe esperar y fallar al releer la suma asignada. Pendiente de
-- ejecución real con dos conexiones independientes; no se declara aprobada.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'admin_id','role','authenticated')::text,true);

insert into public.products(name,unit_code) values('Producto ficticio logística','UND') returning id as product_id \gset
insert into public.product_variants(product_id,sku,name,sale_price) values(:'product_id','SKU-LOGISTICA-FICTICIO','Variante ficticia',10) returning id as variant_id \gset
insert into public.warehouses(code,name) values('ALM-LOG-FICTICIO','Almacén ficticio') returning id as warehouse_id \gset
insert into public.warehouse_locations(warehouse_id,code,name,location_type) values(:'warehouse_id','UBI-LOG-FICTICIA','Ubicación ficticia','picking') returning id as location_id \gset
select public.adjust_inventory(:'variant_id',:'location_id','initial_stock',20,5,'Stock ficticio','00000000-0000-4000-8000-000000000601');
insert into public.customers(full_name,document_type,document_number) values('Cliente ficticio logística','TEST','LOG-FICTICIO-001') returning id as customer_id \gset
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) values(:'order_id',1,:'variant_id',:'warehouse_id',:'location_id',10,10,0,0) returning id as order_item_id \gset
select public.submit_order(:'order_id');
select public.confirm_order(:'order_id','00000000-0000-4000-8000-000000000602');
select public.dispatch_order(:'order_id','00000000-0000-4000-8000-000000000603');
insert into public.carriers(code,name) values('TR-FICTICIO','Transportista ficticio') returning id as carrier_id \gset
select public.create_shipment(:'order_id',:'carrier_id','Destinatario ficticio',null,'Dirección ficticia',null,null,null,null,5,null,null) as shipment_id \gset
select public.add_shipment_item(:'shipment_id',:'order_item_id',6) as shipment_item_id \gset

-- idempotent_retry.
select public.mark_shipment_ready(:'shipment_id','00000000-0000-4000-8000-000000000604');
select public.mark_shipment_ready(:'shipment_id','00000000-0000-4000-8000-000000000604');
select count(*)=1 as idempotent_retry from public.shipment_events where shipment_id=:'shipment_id' and event_type='shipment_ready';

-- cross_order_item_rejected y quantity_above_dispatched_rejected.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as other_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) values(:'other_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0) returning id as other_item_id \gset
select public.submit_order(:'other_order_id'); select public.confirm_order(:'other_order_id','00000000-0000-4000-8000-000000000605'); select public.dispatch_order(:'other_order_id','00000000-0000-4000-8000-000000000606');
select public.create_shipment(:'order_id',:'carrier_id','Destinatario ficticio',null,'Dirección ficticia',null,null,null,null,0,null,null) as draft_shipment_id \gset
\set ON_ERROR_STOP off
savepoint cross_order_item_rejected;
select public.add_shipment_item(:'draft_shipment_id',:'other_item_id',1);
\if :ERROR
  rollback to savepoint cross_order_item_rejected;
\else
  \echo 'FALLO: se aceptó una línea de otro pedido.'
  \quit 1
\endif
savepoint quantity_above_dispatched_rejected;
select public.add_shipment_item(:'draft_shipment_id',:'order_item_id',5);
\if :ERROR
  rollback to savepoint quantity_above_dispatched_rejected;
\else
  \echo 'FALLO: se superó lo despachado pendiente de asignar.'
  \quit 1
\endif

-- event_update_rejected y event_delete_rejected.
savepoint event_update_rejected;
update public.shipment_events set description='Mutación prohibida' where shipment_id=:'shipment_id';
\if :ERROR
  rollback to savepoint event_update_rejected;
\else
  \echo 'FALLO: se modificó un evento inmutable.'
  \quit 1
\endif
savepoint event_delete_rejected;
delete from public.shipment_events where shipment_id=:'shipment_id';
\if :ERROR
  rollback to savepoint event_delete_rejected;
\else
  \echo 'FALLO: se eliminó un evento inmutable.'
  \quit 1
\endif

-- operator_carrier_write_denied.
select set_config('request.jwt.claims',json_build_object('sub',:'operator_id','role','authenticated')::text,true);
savepoint operator_carrier_write_denied;
insert into public.carriers(code,name) values('TR-OPERADOR-FICTICIO','No permitido');
\if :ERROR
  rollback to savepoint operator_carrier_write_denied;
\else
  \echo 'FALLO: operador creó transportista.'
  \quit 1
\endif

-- inactive_denied.
select set_config('request.jwt.claims',json_build_object('sub',:'inactive_id','role','authenticated')::text,true);
savepoint inactive_denied;
select public.create_shipment(:'order_id',:'carrier_id','Ficticio',null,'Dirección ficticia',null,null,null,null,0,null,null);
\if :ERROR
  rollback to savepoint inactive_denied;
\else
  \echo 'FALLO: usuario inactivo creó envío.'
  \quit 1
\endif

-- anonymous_denied.
select set_config('request.jwt.claims','{}',true);
set local role anon;
savepoint anonymous_denied;
select * from public.shipments;
\if :ERROR
  rollback to savepoint anonymous_denied;
\else
  \echo 'FALLO: anónimo leyó envíos.'
  \quit 1
\endif
\set ON_ERROR_STOP on
rollback;
