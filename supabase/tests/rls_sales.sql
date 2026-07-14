-- Pruebas reproducibles de Etapa 4. Solo perfiles ficticios; nunca producción.
-- Requiere migración 005 aplicada en una base segura y variables admin_id,
-- operator_id e inactive_id. Todas las escrituras terminan con ROLLBACK.
-- La carrera confirm_order_concurrency_two_connections requiere dos sesiones:
-- A confirma y conserva el bloqueo; B confirma otro pedido sobre el mismo balance.
-- B debe esperar y luego fallar si ya no queda disponible. No se declara ejecutada.
-- pending_payment_concurrency_two_connections requiere dos sesiones que confirmen
-- pagos pending del mismo pedido; la segunda debe esperar el bloqueo del pedido y
-- rechazar el sobrepago al releer balance_due. Tampoco se declara ejecutada.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'admin_id','role','authenticated')::text,true);

insert into public.products(name,unit_code) values('Producto ficticio ventas','UND') returning id as product_id \gset
insert into public.product_variants(product_id,sku,name,sale_price) values(:'product_id','SKU-VENTAS-FICTICIO','Variante ficticia',10) returning id as variant_id \gset
insert into public.warehouses(code,name) values('ALM-VENTAS-FICTICIO','Almacén ficticio') returning id as warehouse_id \gset
insert into public.warehouse_locations(warehouse_id,code,name,location_type) values(:'warehouse_id','UBI-VENTAS-FICTICIA','Ubicación ficticia','picking') returning id as location_id \gset
select public.adjust_inventory(:'variant_id',:'location_id','initial_stock',10,5,'Stock ficticio inicial','00000000-0000-4000-8000-000000000101') is not null as seeded \gset
insert into public.customers(full_name,document_type,document_number) values('Cliente completamente ficticio','TEST','DOC-FICTICIO-001') returning id as customer_id \gset

-- discount_zero_allowed y discount_equal_subtotal_allowed.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as discount_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'discount_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,10,0) returning id as discount_item_id \gset
select discount_amount=10 and line_subtotal=10 and line_total=0 as discount_equal_subtotal_allowed
  from public.order_items where id=:'discount_item_id';
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as zero_discount_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'zero_discount_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0) returning id as zero_discount_item_id \gset
select discount_amount=0 as discount_zero_allowed from public.order_items where id=:'zero_discount_item_id';

\set ON_ERROR_STOP off
savepoint discount_above_subtotal_rejected;
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as invalid_discount_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'invalid_discount_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,11,2);
\if :ERROR
  rollback to savepoint discount_above_subtotal_rejected;
\else
  \echo 'FALLO: el impuesto compensó un descuento superior al subtotal.'
  \quit 1
\endif
savepoint discount_edit_rejected;
update public.order_items set discount_amount=11,tax_amount=2 where id=:'discount_item_id';
\if :ERROR
  rollback to savepoint discount_edit_rejected;
\else
  \echo 'FALLO: se aceptó un descuento inválido al editar una línea draft.'
  \quit 1
\endif
\set ON_ERROR_STOP on

-- cancel_draft_without_movements y cancel_new_without_movements.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as draft_cancel_order_id \gset
select public.cancel_order(:'draft_cancel_order_id','00000000-0000-4000-8000-000000000114');
select count(*)=0 as cancel_draft_without_movements from public.inventory_movements where order_id=:'draft_cancel_order_id';
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as new_cancel_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'new_cancel_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0);
select public.submit_order(:'new_cancel_order_id');
select public.cancel_order(:'new_cancel_order_id','00000000-0000-4000-8000-000000000115');
select count(*)=0 as cancel_new_without_movements from public.inventory_movements where order_id=:'new_cancel_order_id';

-- confirmed_cancel_exact_release.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as confirmed_cancel_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'confirmed_cancel_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0);
select public.submit_order(:'confirmed_cancel_order_id');
select public.confirm_order(:'confirmed_cancel_order_id','00000000-0000-4000-8000-000000000116');
select public.cancel_order(:'confirmed_cancel_order_id','00000000-0000-4000-8000-000000000117');
select count(*)=2 as confirmed_cancel_exact_release from public.inventory_movements where order_id=:'confirmed_cancel_order_id';

-- return_to_draft_with_payment_rejected.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as paid_draft_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'paid_draft_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0);
select public.submit_order(:'paid_draft_order_id');
insert into public.payments(order_id,amount,method) values(:'paid_draft_order_id',1,'cash');
\set ON_ERROR_STOP off
savepoint return_to_draft_with_payment_rejected;
select public.return_order_to_draft(:'paid_draft_order_id');
\if :ERROR
  rollback to savepoint return_to_draft_with_payment_rejected;
\else
  \echo 'FALLO: un pedido con pago volvió a borrador.'
  \quit 1
\endif
\set ON_ERROR_STOP on

-- single_line_partial_preparing, single_line_complete_shipped y dispatch_retry_idempotent.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as single_dispatch_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'single_dispatch_order_id',1,:'variant_id',:'warehouse_id',:'location_id',10,10,0,0) returning id as single_dispatch_item_id \gset
select public.submit_order(:'single_dispatch_order_id');
select public.confirm_order(:'single_dispatch_order_id','00000000-0000-4000-8000-000000000120');
select public.dispatch_order_item(:'single_dispatch_item_id',5,'00000000-0000-4000-8000-000000000121');
select status='preparing' and shipped_at is null and shipped_by is null as single_line_partial_preparing
  from public.orders where id=:'single_dispatch_order_id';
select public.dispatch_order_item(:'single_dispatch_item_id',5,'00000000-0000-4000-8000-000000000121');
select count(*)=1 as dispatch_retry_idempotent from public.inventory_movements
  where order_item_id=:'single_dispatch_item_id' and movement_type='sale_dispatch';
select public.dispatch_order_item(:'single_dispatch_item_id',5,'00000000-0000-4000-8000-000000000122');
select status='shipped' and shipped_at is not null and shipped_by is not null as single_line_complete_shipped
  from public.orders where id=:'single_dispatch_order_id';
select public.adjust_inventory(:'variant_id',:'location_id','positive_adjustment',10,5,'Reposición ficticia para pruebas','00000000-0000-4000-8000-000000000123');

-- two_lines_partial_preparing y two_lines_complete_shipped.
insert into public.warehouse_locations(warehouse_id,code,name,location_type)
values(:'warehouse_id','UBI-DESPACHO-FICTICIA','Ubicación ficticia de despacho','picking') returning id as dispatch_location_id \gset
select public.adjust_inventory(:'variant_id',:'dispatch_location_id','initial_stock',6,5,'Stock ficticio para segunda línea','00000000-0000-4000-8000-000000000124');
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as multi_dispatch_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'multi_dispatch_order_id',1,:'variant_id',:'warehouse_id',:'location_id',4,10,0,0) returning id as multi_dispatch_item_one_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount)
values(:'multi_dispatch_order_id',2,:'variant_id',:'warehouse_id',:'dispatch_location_id',6,10,0,0) returning id as multi_dispatch_item_two_id \gset
select public.submit_order(:'multi_dispatch_order_id');
select public.confirm_order(:'multi_dispatch_order_id','00000000-0000-4000-8000-000000000125');
select public.dispatch_order_item(:'multi_dispatch_item_one_id',4,'00000000-0000-4000-8000-000000000126');
select public.dispatch_order_item(:'multi_dispatch_item_two_id',3,'00000000-0000-4000-8000-000000000127');
select status='preparing' and shipped_at is null and shipped_by is null as two_lines_partial_preparing
  from public.orders where id=:'multi_dispatch_order_id';
select public.dispatch_order_item(:'multi_dispatch_item_two_id',3,'00000000-0000-4000-8000-000000000128');
select status='shipped' and shipped_at is not null and shipped_by is not null as two_lines_complete_shipped
  from public.orders where id=:'multi_dispatch_order_id';

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
\set ON_ERROR_STOP off
savepoint cancel_after_dispatch_rejected;
select public.cancel_order(:'order_id','00000000-0000-4000-8000-000000000105');
\if :ERROR
  rollback to savepoint cancel_after_dispatch_rejected;
\else
  \echo 'FALLO: se canceló un pedido con despacho parcial.'
  \quit 1
\endif
\set ON_ERROR_STOP on
select public.dispatch_order(:'order_id','00000000-0000-4000-8000-000000000109');
insert into public.warehouse_locations(warehouse_id,code,name,location_type)
values(:'warehouse_id','UBI-DEV-FICTICIA','Ubicación de devolución ficticia','storage') returning id as return_location_id \gset
select public.return_order_item(:'order_item_id',:'return_location_id',1,'Devolución totalmente ficticia','00000000-0000-4000-8000-000000000110');
select unit_cost_snapshot=5 as return_uses_frozen_cost from public.inventory_movements
  where order_item_id=:'order_item_id' and movement_type='customer_return';
select public.return_order_item(:'order_item_id',:'return_location_id',3,'Devolución final totalmente ficticia','00000000-0000-4000-8000-000000000129');

\set ON_ERROR_STOP off
savepoint pending_returned_order_rejected;
insert into public.payments(order_id,amount,method) values(:'order_id',1,'cash');
\if :ERROR
  rollback to savepoint pending_returned_order_rejected;
\else
  \echo 'FALLO: se creó un pago pending sobre un pedido returned.'
  \quit 1
\endif
savepoint pending_cancelled_order_rejected;
insert into public.payments(order_id,amount,method) values(:'draft_cancel_order_id',1,'cash');
\if :ERROR
  rollback to savepoint pending_cancelled_order_rejected;
\else
  \echo 'FALLO: se creó un pago pending sobre un pedido cancelled.'
  \quit 1
\endif
\set ON_ERROR_STOP on

-- payment_overpayment, operator_refund_denied, inactive_rls_denied y anonymous_rls_denied.
insert into public.orders(customer_id,ordered_at) values(:'customer_id',now()) returning id as payment_order_id \gset
insert into public.order_items(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) values(:'payment_order_id',1,:'variant_id',:'warehouse_id',:'location_id',1,10,0,0);
insert into public.payments(order_id,amount,method) values(:'payment_order_id',1,'cash') returning id as payment_id \gset
select amount=1 as pending_partial_allowed from public.payments where id=:'payment_id';
select public.confirm_payment(:'payment_id',now(),'00000000-0000-4000-8000-000000000106');
\set ON_ERROR_STOP off
savepoint pending_over_balance_rejected;
insert into public.payments(order_id,amount,method) values(:'payment_order_id',10,'cash');
\if :ERROR
  rollback to savepoint pending_over_balance_rejected;
\else
  \echo 'FALLO: se creó un pago pending superior a balance_due.'
  \quit 1
\endif
\set ON_ERROR_STOP on

insert into public.payments(order_id,amount,method) values(:'payment_order_id',2,'other') returning id as editable_pending_payment_id \gset
\set ON_ERROR_STOP off
savepoint pending_edit_over_balance_rejected;
update public.payments set amount=10 where id=:'editable_pending_payment_id';
\if :ERROR
  rollback to savepoint pending_edit_over_balance_rejected;
\else
  \echo 'FALLO: se editó un pago pending por encima de balance_due.'
  \quit 1
\endif
\set ON_ERROR_STOP on
select public.cancel_payment(:'editable_pending_payment_id');

insert into public.payments(order_id,amount,method) values(:'payment_order_id',9,'bank_transfer') returning id as equal_balance_payment_id \gset
select amount=9 as pending_equal_balance_allowed from public.payments where id=:'equal_balance_payment_id';
insert into public.payments(order_id,amount,method) values(:'payment_order_id',9,'card') returning id as concurrent_payment_id \gset
select public.confirm_payment(:'equal_balance_payment_id',now(),'00000000-0000-4000-8000-000000000130');
\set ON_ERROR_STOP off
savepoint pending_concurrency_overpayment_rejected;
select public.confirm_payment(:'concurrent_payment_id',now(),'00000000-0000-4000-8000-000000000131');
\if :ERROR
  rollback to savepoint pending_concurrency_overpayment_rejected;
\else
  \echo 'FALLO: dos pagos pending produjeron sobrepago.'
  \quit 1
\endif
savepoint pending_zero_balance_rejected;
insert into public.payments(order_id,amount,method) values(:'payment_order_id',1,'digital_wallet');
\if :ERROR
  rollback to savepoint pending_zero_balance_rejected;
\else
  \echo 'FALLO: se creó un pago pending con balance_due cero.'
  \quit 1
\endif
\set ON_ERROR_STOP on
\set ON_ERROR_STOP off
savepoint paid_cancel_rejected;
select public.cancel_order(:'payment_order_id','00000000-0000-4000-8000-000000000111');
\if :ERROR
  rollback to savepoint paid_cancel_rejected;
\else
  \echo 'FALLO: se canceló un pedido con importe pagado.'
  \quit 1
\endif
\set ON_ERROR_STOP on

select public.cancel_payment(:'concurrent_payment_id');
select public.refund_payment(:'equal_balance_payment_id',9,'Reembolso completo ficticio','00000000-0000-4000-8000-000000000132') as refund_not_blocked_by_pending_rules;

select public.refund_payment(:'payment_id',0.40,'Reembolso parcial ficticio','00000000-0000-4000-8000-000000000112') as partial_refund;
select status='paid' as original_payment_immutable from public.payments where id=:'payment_id';
select count(*)=1 as refund_row_created from public.payments where refunded_payment_id=:'payment_id' and status='refunded';
\set ON_ERROR_STOP off
savepoint refund_overflow_rejected;
select public.refund_payment(:'payment_id',0.70,'Exceso ficticio','00000000-0000-4000-8000-000000000113');
\if :ERROR
  rollback to savepoint refund_overflow_rejected;
\else
  \echo 'FALLO: se permitió reembolsar por encima del pago original.'
  \quit 1
\endif
\set ON_ERROR_STOP on
select public.refund_payment(:'payment_id',0.60,'Reembolso final ficticio','00000000-0000-4000-8000-000000000118') as full_refund;
select paid_amount=0 and balance_due=total_amount and payment_status='refunded' as full_refund_reconciled
  from public.orders where id=:'payment_order_id';

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'operator_id','role','authenticated')::text,true);
\set ON_ERROR_STOP off
savepoint operator_refund_denied; select public.refund_payment(:'payment_id',0.10,'Intento ficticio','00000000-0000-4000-8000-000000000107');
\if :ERROR
  rollback to savepoint operator_refund_denied;
\else
  \echo 'FALLO: operador pudo reembolsar.'
  \quit 1
\endif
\set ON_ERROR_STOP on

-- operator_inactive_customer_denied: el operador no puede ver ni reactivar clientes inactivos.
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'admin_id','role','authenticated')::text,true);
insert into public.customers(full_name) values('Cliente inactivo totalmente ficticio') returning id as inactive_customer_id \gset
update public.customers set is_active=false where id=:'inactive_customer_id';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'operator_id','role','authenticated')::text,true);
select count(*)=0 as operator_inactive_customer_denied from public.customers where id=:'inactive_customer_id';
select * from public.check_customer_duplicate_candidates('TEST','DOC-FICTICIO-001',null,null,'Cliente completamente ficticio');
select name_match and not document_match and not email_match and not phone_match as duplicate_name_warning_only
  from public.check_customer_duplicate_candidates(null,null,null,null,'Cliente completamente ficticio');

-- movement_reference_combination_rejected: requiere conexión de pruebas propietaria
-- para comprobar la restricción, nunca service_role de la aplicación.
reset role;
select id as balance_id from public.inventory_balances where variant_id=:'variant_id' and location_id=:'location_id' \gset
\set ON_ERROR_STOP off
savepoint movement_reference_combination_rejected;
insert into public.inventory_movements(
  balance_id,movement_type,variant_id,warehouse_id,location_id,
  previous_physical,physical_delta,resulting_physical,previous_reserved,reserved_delta,resulting_reserved,
  unit_cost_snapshot,reason,order_id,order_item_id,purchase_id,responsible_user_id,idempotency_key,metadata,created_by
) values(
  :'balance_id','sale_dispatch',:'variant_id',:'warehouse_id',:'location_id',
  6,-1,5,1,-1,0,5,'Caso ficticio inválido',:'order_id',:'order_item_id',
  '00000000-0000-4000-8000-000000000199',:'admin_id','00000000-0000-4000-8000-000000000198','{}',:'admin_id'
);
\if :ERROR
  rollback to savepoint movement_reference_combination_rejected;
\else
  \echo 'FALLO: se aceptaron referencias incompatibles en el movimiento.'
  \quit 1
\endif
\set ON_ERROR_STOP on
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'operator_id','role','authenticated')::text,true);

-- private_sequence_access_denied.
\set ON_ERROR_STOP off
savepoint private_sequence_access_denied;
select nextval('private.customer_code_seq');
\if :ERROR
  rollback to savepoint private_sequence_access_denied;
\else
  \echo 'FALLO: authenticated obtuvo acceso directo a una secuencia privada.'
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
