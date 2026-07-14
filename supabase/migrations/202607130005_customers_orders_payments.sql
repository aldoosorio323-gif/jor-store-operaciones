-- Etapa 4: clientes, pedidos, reservas, despachos, devoluciones y pagos.
-- Los valores nuevos se confirman antes de utilizarlos en funciones o restricciones.
begin;
alter type public.movement_type add value if not exists 'sale_reservation';
alter type public.movement_type add value if not exists 'reservation_release';
alter type public.movement_type add value if not exists 'sale_dispatch';
alter type public.movement_type add value if not exists 'customer_return';
commit;

begin;

create type public.order_status as enum (
  'draft', 'new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'
);
create type public.order_payment_status as enum ('pending', 'partial', 'paid', 'refunded', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'refunded', 'cancelled');
create type public.payment_method as enum ('cash', 'bank_transfer', 'card', 'digital_wallet', 'other');

alter table public.audit_logs drop constraint audit_logs_action_allowed;
alter table public.audit_logs add constraint audit_logs_action_allowed check (action in (
  'bootstrap_administrator', 'invite_user', 'role_changed', 'user_activated', 'user_deactivated', 'password_recovery_completed',
  'product_created', 'product_updated', 'product_activated', 'product_deactivated',
  'variant_created', 'variant_updated', 'variant_activated', 'variant_deactivated',
  'warehouse_created', 'warehouse_updated', 'warehouse_activated', 'warehouse_deactivated',
  'location_created', 'location_updated', 'location_activated', 'location_deactivated',
  'supplier_created', 'supplier_updated', 'supplier_activated', 'supplier_deactivated',
  'purchase_created', 'purchase_updated', 'purchase_item_added', 'purchase_item_updated', 'purchase_item_removed',
  'purchase_confirmed', 'purchase_cancelled', 'purchase_partially_received', 'purchase_received',
  'transfer_created', 'transfer_updated', 'transfer_item_added', 'transfer_item_updated', 'transfer_item_removed',
  'transfer_confirmed', 'transfer_cancelled', 'transfer_dispatched', 'transfer_partially_received', 'transfer_received',
  'inventory_adjusted', 'customer_created', 'customer_updated', 'customer_activated', 'customer_deactivated',
  'order_created', 'order_updated', 'order_item_added', 'order_item_updated', 'order_item_removed',
  'order_submitted', 'order_returned_to_draft', 'order_confirmed', 'order_cancelled',
  'order_item_dispatched', 'order_dispatched', 'order_delivered', 'order_item_returned',
  'payment_created', 'payment_updated', 'payment_confirmed', 'payment_cancelled', 'payment_refunded',
  'financial_reconciliation_executed'
));

create sequence public.customer_code_seq start 1;
create sequence public.order_number_seq start 1;
create sequence public.payment_number_seq start 1;
revoke all on sequence public.customer_code_seq,public.order_number_seq,public.payment_number_seq from public,anon,authenticated;
grant usage on sequence public.customer_code_seq,public.order_number_seq,public.payment_number_seq to authenticated;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text not null default ('CLI-' || lpad(nextval('public.customer_code_seq')::text, 6, '0')),
  document_type text,
  document_number text,
  full_name text not null,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint customers_code_not_blank check (btrim(code) <> ''),
  constraint customers_name_not_blank check (btrim(full_name) <> ''),
  constraint customers_document_pair check ((document_type is null) = (document_number is null)),
  constraint customers_email_format check (email is null or email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$')
);
create unique index customers_code_unique_idx on public.customers (upper(code));
create unique index customers_document_unique_idx on public.customers (upper(document_type), upper(document_number)) where document_number is not null;
create index customers_name_search_idx on public.customers using gin (lower(full_name) extensions.gin_trgm_ops);
create index customers_status_name_idx on public.customers (is_active, full_name);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null default ('PED-' || lpad(nextval('public.order_number_seq')::text, 7, '0')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status public.order_status not null default 'draft',
  payment_status public.order_payment_status not null default 'pending',
  ordered_at timestamptz not null default now(),
  submitted_at timestamptz, confirmed_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete restrict,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  shipped_by uuid references public.profiles(id) on delete restrict,
  delivered_by uuid references public.profiles(id) on delete restrict,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  currency_code text not null default 'PEN',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint orders_number_not_blank check (btrim(order_number) <> ''),
  constraint orders_currency_pen check (currency_code = 'PEN'),
  constraint orders_totals_nonnegative check (subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_amount >= 0 and paid_amount >= 0),
  constraint orders_total_equation check (total_amount = subtotal - discount_amount + tax_amount),
  constraint orders_paid_range check (paid_amount <= total_amount),
  constraint orders_submitted_fields check ((status = 'draft' and submitted_at is null and submitted_by is null) or status = 'cancelled' or (submitted_at is not null and submitted_by is not null)),
  constraint orders_confirmed_fields check (status not in ('confirmed','preparing','shipped','delivered','returned') or (confirmed_at is not null and confirmed_by is not null)),
  constraint orders_shipped_fields check (status not in ('shipped','delivered','returned') or (shipped_at is not null and shipped_by is not null)),
  constraint orders_delivered_fields check (status <> 'delivered' or (delivered_at is not null and delivered_by is not null)),
  constraint orders_cancelled_fields check (status <> 'cancelled' or (cancelled_at is not null and cancelled_by is not null))
);
create unique index orders_number_unique_idx on public.orders (upper(order_number));
create index orders_customer_status_idx on public.orders(customer_id, status, ordered_at desc);
create index orders_status_payment_idx on public.orders(status, payment_status, ordered_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  line_number integer not null,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  location_id uuid not null,
  balance_id uuid not null,
  quantity numeric(14,3) not null,
  reserved_quantity numeric(14,3) not null default 0,
  dispatched_quantity numeric(14,3) not null default 0,
  returned_quantity numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_subtotal numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint order_items_line_positive check (line_number > 0),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_quantity_ranges check (reserved_quantity >= 0 and dispatched_quantity >= 0 and returned_quantity >= 0 and reserved_quantity + dispatched_quantity <= quantity and returned_quantity <= dispatched_quantity),
  constraint order_items_amounts_nonnegative check (unit_price >= 0 and discount_amount >= 0 and tax_amount >= 0 and line_subtotal >= 0 and line_total >= 0),
  constraint order_items_total_equation check (line_total = line_subtotal - discount_amount + tax_amount),
  constraint order_items_location_fkey foreign key (warehouse_id, location_id) references public.warehouse_locations(warehouse_id,id) on delete restrict,
  constraint order_items_balance_identity_fkey foreign key (balance_id,variant_id,warehouse_id,location_id) references public.inventory_balances(id,variant_id,warehouse_id,location_id) on delete restrict,
  constraint order_items_line_unique unique(order_id,line_number),
  constraint order_items_order_id_id_unique unique(order_id,id),
  constraint order_items_order_balance_unique unique(order_id,balance_id)
);
create index order_items_variant_idx on public.order_items(variant_id, order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null default ('PAG-' || lpad(nextval('public.payment_number_seq')::text, 7, '0')),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(14,2) not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  reference text,
  notes text,
  confirmed_at timestamptz, confirmed_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz, cancelled_by uuid references public.profiles(id) on delete restrict,
  refunded_at timestamptz, refunded_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint payments_number_not_blank check (btrim(payment_number) <> ''),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_state_fields check (
    (status='pending' and paid_at is null and confirmed_at is null and confirmed_by is null and cancelled_at is null and refunded_at is null)
    or (status='paid' and paid_at is not null and confirmed_at is not null and confirmed_by is not null and cancelled_at is null and refunded_at is null)
    or (status='cancelled' and confirmed_at is null and confirmed_by is null and cancelled_at is not null and cancelled_by is not null and refunded_at is null)
    or (status='refunded' and paid_at is not null and confirmed_at is not null and confirmed_by is not null and refunded_at is not null and refunded_by is not null and cancelled_at is null)
  )
);
create unique index payments_number_unique_idx on public.payments(upper(payment_number));
create index payments_order_status_idx on public.payments(order_id,status,created_at desc);

alter table public.inventory_movements
  add column order_id uuid references public.orders(id) on delete restrict,
  add column order_item_id uuid references public.order_items(id) on delete restrict,
  add constraint inventory_movements_order_line_fkey foreign key(order_id,order_item_id)
    references public.order_items(order_id,id) on delete restrict;
create index inventory_movements_order_idx on public.inventory_movements(order_id,order_item_id,occurred_at);

alter table public.inventory_movements drop constraint inventory_movements_stage_three_reserved_unchanged;
alter table public.inventory_movements drop constraint inventory_movements_direction_valid;
alter table public.inventory_movements drop constraint inventory_movements_reference_valid;
alter table public.inventory_movements add constraint inventory_movements_direction_valid check (
  (movement_type in ('purchase_entry','transfer_in','positive_adjustment','initial_stock','customer_return') and physical_delta > 0 and reserved_delta = 0)
  or (movement_type in ('supplier_return','transfer_out','negative_adjustment','damaged','lost') and physical_delta < 0 and reserved_delta = 0)
  or (movement_type = 'sale_reservation' and physical_delta = 0 and reserved_delta > 0)
  or (movement_type = 'reservation_release' and physical_delta = 0 and reserved_delta < 0)
  or (movement_type = 'sale_dispatch' and physical_delta < 0 and reserved_delta < 0 and physical_delta = reserved_delta)
);
alter table public.inventory_movements add constraint inventory_movements_reference_valid check (
  (movement_type in ('purchase_entry','supplier_return') and purchase_id is not null and purchase_item_id is not null and transfer_id is null and order_id is null)
  or (movement_type in ('transfer_out','transfer_in') and transfer_id is not null and transfer_item_id is not null and purchase_id is null and order_id is null)
  or (movement_type in ('positive_adjustment','negative_adjustment','damaged','lost','initial_stock') and purchase_id is null and transfer_id is null and order_id is null)
  or (movement_type in ('sale_reservation','reservation_release','sale_dispatch','customer_return') and order_id is not null and order_item_id is not null and purchase_id is null and transfer_id is null)
);

create or replace function private.prepare_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.code := upper(btrim(new.code));
  new.document_type := upper(nullif(btrim(new.document_type),''));
  new.document_number := upper(nullif(btrim(new.document_number),''));
  new.full_name := btrim(new.full_name);
  new.email := lower(nullif(btrim(new.email),''));
  new.phone := nullif(btrim(new.phone),''); new.address := nullif(btrim(new.address),''); new.notes := nullif(btrim(new.notes),'');
  if tg_op = 'UPDATE' and new.is_active is distinct from old.is_active then
    if not (select public.current_user_is_admin()) then raise exception 'Solo un administrador puede cambiar el estado del cliente.' using errcode='42501'; end if;
    if not new.is_active and exists(select 1 from public.orders o where o.customer_id=old.id and o.status not in ('delivered','cancelled','returned')) then
      raise exception 'No se puede desactivar un cliente con pedidos abiertos.' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;

create or replace function private.recalculate_order_payment(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare total_value numeric(14,2); paid_value numeric(14,2); refunded_value numeric(14,2); next_status public.order_payment_status;
begin
  select total_amount into total_value from public.orders where id=p_order_id for update;
  select coalesce(sum(amount) filter(where status='paid'),0),coalesce(sum(amount) filter(where status='refunded'),0) into paid_value,refunded_value from public.payments where order_id=p_order_id;
  paid_value:=paid_value;
  next_status:=case when refunded_value>0 and paid_value=0 then 'refunded'::public.order_payment_status when paid_value=0 then 'pending' when paid_value<total_value then 'partial' else 'paid' end;
  update public.orders set paid_amount=paid_value,payment_status=next_status,updated_at=now(),updated_by=(select auth.uid()) where id=p_order_id;
end; $$;

create or replace function public.remove_order_item(p_order_item_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin perform private.assert_inventory_operator(false); delete from public.order_items where id=p_order_item_id and exists(select 1 from public.orders o where o.id=order_id and o.status='draft') returning order_id into oid; if oid is null then raise exception 'Línea no encontrada o no autorizada.' using errcode='P0002'; end if; return oid; end; $$;

create or replace function public.submit_order(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); current_status public.order_status;
begin
  select status into current_status from public.orders where id=p_order_id for update;
  if current_status='new' then return p_order_id; end if;
  if current_status<>'draft' then raise exception 'Solo se envía un pedido en borrador.' using errcode='23514'; end if;
  if not exists(select 1 from public.order_items where order_id=p_order_id) then raise exception 'El pedido requiere al menos una línea.' using errcode='23514'; end if;
  if exists(select 1 from public.orders o join public.customers c on c.id=o.customer_id where o.id=p_order_id and not c.is_active) then raise exception 'El cliente no está activo.' using errcode='23514'; end if;
  update public.orders set status='new',submitted_at=now(),submitted_by=actor,updated_at=now(),updated_by=actor where id=p_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_submitted','order',p_order_id,jsonb_build_object('previous_status','draft','new_status','new'));
  return p_order_id;
end; $$;

create or replace function public.return_order_to_draft(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); current_status public.order_status;
begin select status into current_status from public.orders where id=p_order_id for update; if current_status='draft' then return p_order_id; end if; if current_status<>'new' then raise exception 'Solo un pedido nuevo vuelve a borrador.' using errcode='23514'; end if;
  update public.orders set status='draft',submitted_at=null,submitted_by=null,updated_at=now(),updated_by=actor where id=p_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_returned_to_draft','order',p_order_id,jsonb_build_object('previous_status','new','new_status','draft')); return p_order_id; end; $$;

create or replace function public.confirm_order(p_order_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); replay jsonb; current_status public.order_status; row_item public.order_items%rowtype; result jsonb; final_result jsonb;
begin
  replay:=private.start_inventory_command(p_idempotency_key,'confirm_order',jsonb_build_object('order_id',p_order_id)); if replay is not null then return replay; end if;
  select status into current_status from public.orders where id=p_order_id for update;
  if current_status<>'new' then raise exception 'Solo un pedido nuevo puede confirmarse.' using errcode='23514'; end if;
  for row_item in select * from public.order_items where order_id=p_order_id order by location_id,variant_id,id for update loop
    result:=private.apply_sales_inventory_movement(p_order_id,row_item.id,'sale_reservation',0,row_item.quantity,'Reserva de pedido',p_idempotency_key||':'||row_item.id::text);
    update public.order_items set reserved_quantity=quantity where id=row_item.id;
  end loop;
  update public.orders set status='confirmed',confirmed_at=now(),confirmed_by=actor,updated_at=now(),updated_by=actor where id=p_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_confirmed','order',p_order_id,jsonb_build_object('previous_status','new','new_status','confirmed'));
  final_result:=jsonb_build_object('order_id',p_order_id,'status','confirmed'); perform private.finish_inventory_command(p_idempotency_key,final_result); return final_result;
end; $$;

create or replace function public.cancel_order(p_order_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); replay jsonb; current_status public.order_status; row_item public.order_items%rowtype; final_result jsonb;
begin
  replay:=private.start_inventory_command(p_idempotency_key,'cancel_order',jsonb_build_object('order_id',p_order_id)); if replay is not null then return replay; end if;
  select status into current_status from public.orders where id=p_order_id for update;
  if current_status='cancelled' then raise exception 'El pedido ya está cancelado.' using errcode='23514'; end if;
  if current_status not in ('draft','new','confirmed','preparing') then raise exception 'El pedido ya no puede cancelarse.' using errcode='23514'; end if;
  for row_item in select * from public.order_items where order_id=p_order_id and reserved_quantity>0 order by location_id,variant_id,id for update loop
    perform private.apply_sales_inventory_movement(p_order_id,row_item.id,'reservation_release',0,-row_item.reserved_quantity,'Cancelación de pedido',p_idempotency_key||':'||row_item.id::text);
    update public.order_items set reserved_quantity=0 where id=row_item.id;
  end loop;
  with cancelled as (
    update public.payments set status='cancelled',cancelled_at=now(),cancelled_by=actor,updated_at=now(),updated_by=actor
    where order_id=p_order_id and status='pending' returning id
  )
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  select actor,'payment_cancelled','payment',id,jsonb_build_object('reason','order_cancelled') from cancelled;
  update public.orders set status='cancelled',payment_status=case when paid_amount=0 then 'cancelled' else payment_status end,cancelled_at=now(),cancelled_by=actor,updated_at=now(),updated_by=actor where id=p_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_cancelled','order',p_order_id,jsonb_build_object('previous_status',current_status,'new_status','cancelled'));
  final_result:=jsonb_build_object('order_id',p_order_id,'status','cancelled'); perform private.finish_inventory_command(p_idempotency_key,final_result); return final_result;
end; $$;

create or replace function public.dispatch_order_item(p_order_item_id uuid,p_quantity numeric,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); replay jsonb; item public.order_items%rowtype; current_status public.order_status; result jsonb; next_status public.order_status;
begin
  replay:=private.start_inventory_command(p_idempotency_key,'dispatch_order_item',jsonb_build_object('order_item_id',p_order_item_id,'quantity',p_quantity)); if replay is not null then return replay; end if;
  if p_quantity<=0 then raise exception 'La cantidad debe ser mayor que cero.' using errcode='22023'; end if;
  select * into item from public.order_items where id=p_order_item_id for update; if not found then raise exception 'Línea no encontrada.' using errcode='P0002'; end if;
  select status into current_status from public.orders where id=item.order_id for update; if current_status not in ('confirmed','preparing') then raise exception 'El pedido no está disponible para despacho.' using errcode='23514'; end if;
  if p_quantity>item.reserved_quantity then raise exception 'La cantidad supera la reserva disponible.' using errcode='23514'; end if;
  result:=private.apply_sales_inventory_movement(item.order_id,item.id,'sale_dispatch',-p_quantity,-p_quantity,'Despacho de pedido',p_idempotency_key);
  update public.order_items set reserved_quantity=reserved_quantity-p_quantity,dispatched_quantity=dispatched_quantity+p_quantity where id=item.id;
  if not exists(select 1 from public.order_items where order_id=item.order_id and dispatched_quantity+p_quantity<quantity and id=item.id union all select 1 from public.order_items where order_id=item.order_id and id<>item.id and dispatched_quantity<quantity) then next_status:='shipped'; else next_status:='preparing'; end if;
  update public.orders set status=next_status,shipped_at=case when next_status='shipped' then now() else shipped_at end,shipped_by=case when next_status='shipped' then actor else shipped_by end,updated_at=now(),updated_by=actor where id=item.order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_item_dispatched','order',item.order_id,jsonb_build_object('quantity',p_quantity,'new_status',next_status));
  result:=result||jsonb_build_object('order_id',item.order_id,'status',next_status); perform private.finish_inventory_command(p_idempotency_key,result); return result;
end; $$;

create or replace function public.dispatch_order(p_order_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); replay jsonb; current_status public.order_status; item public.order_items%rowtype; quantity_value numeric; final_result jsonb;
begin replay:=private.start_inventory_command(p_idempotency_key,'dispatch_order',jsonb_build_object('order_id',p_order_id)); if replay is not null then return replay; end if;
  select status into current_status from public.orders where id=p_order_id for update; if current_status not in ('confirmed','preparing') then raise exception 'El pedido no está disponible para despacho.' using errcode='23514'; end if;
  for item in select * from public.order_items where order_id=p_order_id order by location_id,variant_id,id for update loop quantity_value:=item.reserved_quantity; if quantity_value>0 then perform private.apply_sales_inventory_movement(p_order_id,item.id,'sale_dispatch',-quantity_value,-quantity_value,'Despacho completo',p_idempotency_key||':'||item.id::text); update public.order_items set reserved_quantity=0,dispatched_quantity=dispatched_quantity+quantity_value where id=item.id; end if; end loop;
  update public.orders set status='shipped',shipped_at=now(),shipped_by=actor,updated_at=now(),updated_by=actor where id=p_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_dispatched','order',p_order_id,jsonb_build_object('previous_status',current_status,'new_status','shipped'));
  final_result:=jsonb_build_object('order_id',p_order_id,'status','shipped'); perform private.finish_inventory_command(p_idempotency_key,final_result); return final_result; end; $$;

create or replace function public.deliver_order(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); current_status public.order_status;
begin select status into current_status from public.orders where id=p_order_id for update; if current_status='delivered' then return p_order_id; end if; if current_status<>'shipped' then raise exception 'Solo un pedido despachado puede entregarse.' using errcode='23514'; end if;
  update public.orders set status='delivered',delivered_at=now(),delivered_by=actor,updated_at=now(),updated_by=actor where id=p_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_delivered','order',p_order_id,jsonb_build_object('previous_status','shipped','new_status','delivered')); return p_order_id; end; $$;

create or replace function public.return_order_item(p_order_item_id uuid,p_quantity numeric,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); replay jsonb; item public.order_items%rowtype; current_status public.order_status; result jsonb;
begin replay:=private.start_inventory_command(p_idempotency_key,'return_order_item',jsonb_build_object('order_item_id',p_order_item_id,'quantity',p_quantity,'reason',nullif(btrim(p_reason),''))); if replay is not null then return replay; end if;
  if p_quantity<=0 or nullif(btrim(p_reason),'') is null then raise exception 'Cantidad y razón son obligatorias.' using errcode='22023'; end if;
  select * into item from public.order_items where id=p_order_item_id for update; select status into current_status from public.orders where id=item.order_id for update;
  if current_status not in ('preparing','shipped','delivered','returned') or item.returned_quantity+p_quantity>item.dispatched_quantity then raise exception 'La devolución supera lo despachado o no está permitida.' using errcode='23514'; end if;
  result:=private.apply_sales_inventory_movement(item.order_id,item.id,'customer_return',p_quantity,0,p_reason,p_idempotency_key);
  update public.order_items set returned_quantity=returned_quantity+p_quantity where id=item.id;
  if not exists(select 1 from public.order_items where order_id=item.order_id and (returned_quantity < dispatched_quantity or reserved_quantity > 0)) then update public.orders set status='returned',updated_at=now(),updated_by=actor where id=item.order_id; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'order_item_returned','order',item.order_id,jsonb_build_object('quantity',p_quantity)); perform private.finish_inventory_command(p_idempotency_key,result); return result; end; $$;

create or replace function public.confirm_payment(p_payment_id uuid,p_paid_at timestamptz,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); replay jsonb; payment public.payments%rowtype; result jsonb;
begin replay:=private.start_inventory_command(p_idempotency_key,'confirm_payment',jsonb_build_object('payment_id',p_payment_id,'paid_at',p_paid_at)); if replay is not null then return replay; end if;
  select * into payment from public.payments where id=p_payment_id for update; if not found then raise exception 'Pago no encontrado.' using errcode='P0002'; end if; if payment.status<>'pending' then raise exception 'Solo un pago pendiente puede confirmarse.' using errcode='23514'; end if;
  perform 1 from public.orders where id=payment.order_id and status not in ('cancelled','returned') for update;
  if not found then raise exception 'El estado del pedido no admite pagos.' using errcode='23514'; end if;
  if (select paid_amount from public.orders where id=payment.order_id)+payment.amount>(select total_amount from public.orders where id=payment.order_id) then raise exception 'El pago supera el saldo del pedido.' using errcode='23514'; end if;
  update public.payments set status='paid',paid_at=coalesce(p_paid_at,now()),confirmed_at=now(),confirmed_by=actor,updated_at=now(),updated_by=actor where id=p_payment_id;
  perform private.recalculate_order_payment(payment.order_id);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'payment_confirmed','payment',p_payment_id,jsonb_build_object('status','paid','amount',payment.amount)); result:=jsonb_build_object('payment_id',p_payment_id,'order_id',payment.order_id,'status','paid'); perform private.finish_inventory_command(p_idempotency_key,result); return result; end; $$;

create or replace function public.cancel_payment(p_payment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(false); payment public.payments%rowtype;
begin select * into payment from public.payments where id=p_payment_id for update; if payment.status='cancelled' then return p_payment_id; end if; if payment.status<>'pending' then raise exception 'Solo un pago pendiente puede cancelarse.' using errcode='23514'; end if;
  update public.payments set status='cancelled',cancelled_at=now(),cancelled_by=actor,updated_at=now(),updated_by=actor where id=p_payment_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'payment_cancelled','payment',p_payment_id,jsonb_build_object('status','cancelled')); return p_payment_id; end; $$;

create or replace function public.refund_payment(p_payment_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.assert_inventory_operator(true); replay jsonb; payment public.payments%rowtype; result jsonb;
begin replay:=private.start_inventory_command(p_idempotency_key,'refund_payment',jsonb_build_object('payment_id',p_payment_id)); if replay is not null then return replay; end if;
  select * into payment from public.payments where id=p_payment_id for update; if payment.status<>'paid' then raise exception 'Solo un pago confirmado puede reembolsarse.' using errcode='23514'; end if;
  perform 1 from public.orders where id=payment.order_id for update;
  update public.payments set status='refunded',refunded_at=now(),refunded_by=actor,updated_at=now(),updated_by=actor where id=p_payment_id; perform private.recalculate_order_payment(payment.order_id);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'payment_refunded','payment',p_payment_id,jsonb_build_object('status','refunded','amount',payment.amount)); result:=jsonb_build_object('payment_id',p_payment_id,'order_id',payment.order_id,'status','refunded'); perform private.finish_inventory_command(p_idempotency_key,result); return result; end; $$;

create or replace function public.admin_financial_reconciliation()
returns table(issue_type text,order_id uuid,expected_paid numeric,actual_paid numeric)
language plpgsql security definer set search_path = '' as $$
begin perform private.assert_inventory_operator(true);
  insert into public.audit_logs(actor_user_id,action,metadata) values((select auth.uid()),'financial_reconciliation_executed',jsonb_build_object('executed',true));
  return query select 'payment_mismatch'::text,o.id,coalesce(sum(p.amount) filter(where p.status='paid'),0)-coalesce(sum(p.amount) filter(where p.status='refunded'),0),o.paid_amount from public.orders o left join public.payments p on p.order_id=o.id group by o.id having o.paid_amount<>coalesce(sum(p.amount) filter(where p.status='paid'),0)-coalesce(sum(p.amount) filter(where p.status='refunded'),0);
end; $$;

-- Declaraciones anticipadas requeridas por CREATE TRIGGER; se reemplazan abajo
-- por sus implementaciones completas dentro de la misma migración.
create function private.prepare_order() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end; $$;
create function private.prepare_order_item() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end; $$;
create function private.guard_order_item_delete() returns trigger language plpgsql security definer set search_path='' as $$ begin return old; end; $$;
create function private.after_order_item_change() returns trigger language plpgsql security definer set search_path='' as $$ begin if tg_op='DELETE' then return old; end if; return new; end; $$;
create function private.prepare_payment() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end; $$;
create function private.audit_sales_change() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end; $$;
create function private.apply_sales_inventory_movement(uuid,uuid,public.movement_type,numeric,numeric,text,text,uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'Función no inicializada.'; end; $$;
create function private.audit_order_item_change() returns trigger language plpgsql security definer set search_path='' as $$
declare action_name text; oid uuid; quantity_value numeric;
begin
  oid:=case when tg_op='DELETE' then old.order_id else new.order_id end;
  quantity_value:=case when tg_op='DELETE' then old.quantity else new.quantity end;
  action_name:=case when tg_op='INSERT' then 'order_item_added' when tg_op='DELETE' then 'order_item_removed' else 'order_item_updated' end;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),action_name,'order',oid,jsonb_build_object('line_number',case when tg_op='DELETE' then old.line_number else new.line_number end,'quantity',quantity_value));
  if tg_op='DELETE' then return old; end if; return new;
end; $$;

create trigger customers_10_prepare_write before insert or update on public.customers for each row execute function private.prepare_operational_write();
create trigger customers_20_normalize before insert or update on public.customers for each row execute function private.prepare_customer();
create trigger customers_90_audit after insert or update on public.customers for each row execute function private.audit_sales_change('customer','customer');
create trigger orders_10_prepare_write before insert or update on public.orders for each row execute function private.prepare_operational_write();
create trigger orders_20_prepare before insert or update on public.orders for each row execute function private.prepare_order();
create trigger orders_90_audit after insert or update on public.orders for each row execute function private.audit_sales_change('order','order');
create trigger order_items_10_prepare_write before insert or update on public.order_items for each row execute function private.prepare_operational_write();
create trigger order_items_20_prepare before insert or update on public.order_items for each row execute function private.prepare_order_item();
create trigger order_items_30_guard_delete before delete on public.order_items for each row execute function private.guard_order_item_delete();
create trigger order_items_80_totals after insert or update or delete on public.order_items for each row execute function private.after_order_item_change();
create trigger order_items_90_audit after insert or update or delete on public.order_items for each row execute function private.audit_order_item_change();
create trigger payments_10_prepare_write before insert or update on public.payments for each row execute function private.prepare_operational_write();
create trigger payments_20_prepare before insert or update on public.payments for each row execute function private.prepare_payment();
create trigger payments_90_audit after insert or update on public.payments for each row execute function private.audit_sales_change('payment','payment');

alter table public.customers enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.payments enable row level security;
create policy customers_select_active_staff on public.customers for select to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator'));
create policy customers_insert_active_staff on public.customers for insert to authenticated with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and is_active);
create policy customers_update_active_staff on public.customers for update to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator')) with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator'));
create policy orders_select_active_staff on public.orders for select to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator'));
create policy orders_insert_active_staff on public.orders for insert to authenticated with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and status='draft');
create policy orders_update_draft_staff on public.orders for update to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and status='draft') with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and status='draft');
create policy order_items_select_active_staff on public.order_items for select to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator'));
create policy order_items_insert_draft_staff on public.order_items for insert to authenticated with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and exists(select 1 from public.orders where id=order_id and status='draft'));
create policy order_items_update_draft_staff on public.order_items for update to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and exists(select 1 from public.orders where id=order_id and status='draft')) with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and exists(select 1 from public.orders where id=order_id and status='draft'));
create policy payments_select_active_staff on public.payments for select to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator'));
create policy payments_insert_active_staff on public.payments for insert to authenticated with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and status='pending');
create policy payments_update_pending_staff on public.payments for update to authenticated using ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and status='pending') with check ((select public.current_user_is_active()) and (select public.current_user_role()) in ('administrator','operator') and status='pending');

revoke all on table public.customers,public.orders,public.order_items,public.payments from anon,authenticated;
grant select on table public.customers,public.orders,public.order_items,public.payments to authenticated;
grant insert(full_name,document_type,document_number,email,phone,address,notes) on public.customers to authenticated;
grant update(full_name,document_type,document_number,email,phone,address,notes,is_active) on public.customers to authenticated;
grant insert(customer_id,ordered_at,notes) on public.orders to authenticated; grant update(customer_id,ordered_at,notes) on public.orders to authenticated;
grant insert(order_id,line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) on public.order_items to authenticated;
grant update(line_number,variant_id,warehouse_id,location_id,quantity,unit_price,discount_amount,tax_amount) on public.order_items to authenticated;
grant insert(order_id,amount,method,reference,notes) on public.payments to authenticated; grant update(amount,method,reference,notes) on public.payments to authenticated;

revoke all on function public.remove_order_item(uuid),public.submit_order(uuid),public.return_order_to_draft(uuid),public.confirm_order(uuid,text),public.cancel_order(uuid,text),public.dispatch_order_item(uuid,numeric,text),public.dispatch_order(uuid,text),public.deliver_order(uuid),public.return_order_item(uuid,numeric,text,text),public.confirm_payment(uuid,timestamptz,text),public.cancel_payment(uuid),public.refund_payment(uuid,text),public.admin_financial_reconciliation() from public,anon;
grant execute on function public.remove_order_item(uuid),public.submit_order(uuid),public.return_order_to_draft(uuid),public.confirm_order(uuid,text),public.cancel_order(uuid,text),public.dispatch_order_item(uuid,numeric,text),public.dispatch_order(uuid,text),public.deliver_order(uuid),public.return_order_item(uuid,numeric,text,text),public.confirm_payment(uuid,timestamptz,text),public.cancel_payment(uuid),public.refund_payment(uuid,text),public.admin_financial_reconciliation() to authenticated;
revoke all on function private.prepare_customer(),private.prepare_order(),private.prepare_order_item(),private.guard_order_item_delete(),private.recalculate_order_totals(uuid),private.after_order_item_change(),private.prepare_payment(),private.audit_sales_change(),private.audit_order_item_change(),private.apply_sales_inventory_movement(uuid,uuid,public.movement_type,numeric,numeric,text,text,uuid),private.recalculate_order_payment(uuid) from public,anon,authenticated;

create or replace function private.prepare_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.notes := nullif(btrim(new.notes),'');
  if tg_op='INSERT' then
    new.status := 'draft'; new.payment_status := 'pending';
    new.subtotal:=0; new.discount_amount:=0; new.tax_amount:=0; new.total_amount:=0; new.paid_amount:=0;
  elsif old.status <> 'draft' and (new.customer_id is distinct from old.customer_id or new.ordered_at is distinct from old.ordered_at or new.notes is distinct from old.notes) then
    raise exception 'Un pedido enviado no admite cambios comerciales.' using errcode='23514';
  end if;
  return new;
end; $$;

create or replace function private.prepare_order_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_status public.order_status; expected_subtotal numeric(14,2);
begin
  select status into parent_status from public.orders where id=new.order_id for share;
  if parent_status is null then raise exception 'Pedido no encontrado.' using errcode='P0002'; end if;
  if tg_op='UPDATE' and new.order_id is distinct from old.order_id then raise exception 'No se puede cambiar el pedido de la línea.' using errcode='23514'; end if;
  if parent_status <> 'draft' then
    if tg_op='INSERT' or new.line_number is distinct from old.line_number or new.variant_id is distinct from old.variant_id
      or new.warehouse_id is distinct from old.warehouse_id or new.location_id is distinct from old.location_id
      or new.balance_id is distinct from old.balance_id or new.quantity is distinct from old.quantity
      or new.unit_price is distinct from old.unit_price or new.discount_amount is distinct from old.discount_amount
      or new.tax_amount is distinct from old.tax_amount then
      raise exception 'Las líneas de un pedido enviado están congeladas.' using errcode='23514';
    end if;
    return new;
  end if;
  select id into new.balance_id from public.inventory_balances
    where variant_id=new.variant_id and warehouse_id=new.warehouse_id and location_id=new.location_id;
  if new.balance_id is null then raise exception 'No existe un balance para la ubicación seleccionada.' using errcode='23514'; end if;
  new.reserved_quantity:=0; new.dispatched_quantity:=0; new.returned_quantity:=0;
  expected_subtotal:=round(new.quantity*new.unit_price,2); new.line_subtotal:=expected_subtotal;
  new.line_total:=round(expected_subtotal-new.discount_amount+new.tax_amount,2);
  return new;
end; $$;

create or replace function private.guard_order_item_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.orders where id=old.order_id and status='draft') then
    raise exception 'Solo se retiran líneas de pedidos en borrador.' using errcode='23514';
  end if; return old;
end; $$;

create or replace function private.recalculate_order_totals(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s numeric(14,2); d numeric(14,2); t numeric(14,2);
begin
  select coalesce(sum(line_subtotal),0),coalesce(sum(discount_amount),0),coalesce(sum(tax_amount),0) into s,d,t from public.order_items where order_id=p_order_id;
  update public.orders set subtotal=s,discount_amount=d,tax_amount=t,total_amount=s-d+t,updated_at=now(),updated_by=(select auth.uid()) where id=p_order_id;
end; $$;

create or replace function private.after_order_item_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.recalculate_order_totals(case when tg_op='DELETE' then old.order_id else new.order_id end); if tg_op='DELETE' then return old; end if; return new; end; $$;

create or replace function private.prepare_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare order_total numeric(14,2);
begin
  new.reference:=nullif(btrim(new.reference),''); new.notes:=nullif(btrim(new.notes),'');
  select total_amount into order_total from public.orders where id=new.order_id for share;
  if order_total is null then raise exception 'Pedido no encontrado.' using errcode='P0002'; end if;
  if tg_op='INSERT' then new.status:='pending'; new.paid_at:=null; end if;
  if tg_op='UPDATE' and old.status<>'pending' and (new.amount is distinct from old.amount or new.method is distinct from old.method or new.order_id is distinct from old.order_id) then
    raise exception 'Un pago procesado no admite cambios comerciales.' using errcode='23514';
  end if; return new;
end; $$;

create or replace function private.audit_sales_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prefix text:=tg_argv[0]; entity text:=tg_argv[1]; action_name text; target uuid; safe jsonb;
begin
  target:=case when tg_op='DELETE' then old.id else new.id end;
  if tg_op='INSERT' then action_name:=prefix||'_created'; safe:=jsonb_build_object('status',coalesce(to_jsonb(new)->>'status','active'));
  elsif entity='customer' and new.is_active is distinct from old.is_active then action_name:=prefix||case when new.is_active then '_activated' else '_deactivated' end; safe:=jsonb_build_object('active',new.is_active);
  else action_name:=prefix||'_updated'; safe:=jsonb_build_object('changed',true); end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values((select auth.uid()),action_name,entity,target,safe);
  if tg_op='DELETE' then return old; end if; return new;
end; $$;

create or replace function private.apply_sales_inventory_movement(
  p_order_id uuid,p_order_item_id uuid,p_movement_type public.movement_type,
  p_physical_delta numeric,p_reserved_delta numeric,p_reason text,p_idempotency_key text,p_related_movement_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid:=private.assert_inventory_operator(false); item public.order_items%rowtype; bal public.inventory_balances%rowtype; movement_id uuid; new_physical numeric(14,3); new_reserved numeric(14,3);
begin
  if p_movement_type not in ('sale_reservation','reservation_release','sale_dispatch','customer_return') then raise exception 'Tipo de movimiento de venta no permitido.' using errcode='22023'; end if;
  select * into item from public.order_items where order_id=p_order_id and id=p_order_item_id for update;
  if not found then raise exception 'Línea de pedido no encontrada.' using errcode='P0002'; end if;
  -- La identidad compuesta de la línea evita reservar otro balance.
  perform 1 from public.products p join public.product_variants v on v.product_id=p.id where v.id=item.variant_id and p.is_active and v.is_active for share of p,v;
  if not found then raise exception 'El producto o la variante no está activo.' using errcode='23514'; end if;
  perform 1 from public.warehouses w join public.warehouse_locations l on l.warehouse_id=w.id where w.id=item.warehouse_id and l.id=item.location_id and w.is_active and l.is_active for share of w,l;
  if not found then raise exception 'El almacén o la ubicación no está activo.' using errcode='23514'; end if;
  select * into bal from public.inventory_balances where id=item.balance_id and variant_id=item.variant_id and warehouse_id=item.warehouse_id and location_id=item.location_id for update;
  if not found then raise exception 'Balance no encontrado.' using errcode='P0002'; end if;
  new_physical:=bal.physical_stock+p_physical_delta; new_reserved:=bal.reserved_stock+p_reserved_delta;
  if new_physical<0 or new_reserved<0 or new_reserved>new_physical then raise exception 'Stock disponible insuficiente para completar la operación.' using errcode='23514'; end if;
  update public.inventory_balances set physical_stock=new_physical,reserved_stock=new_reserved,version=version+1,updated_at=now(),updated_by=actor_id where id=bal.id;
  insert into public.inventory_movements(balance_id,movement_type,variant_id,warehouse_id,location_id,previous_physical,physical_delta,resulting_physical,previous_reserved,reserved_delta,resulting_reserved,unit_cost_snapshot,reason,order_id,order_item_id,related_movement_id,responsible_user_id,idempotency_key,metadata,created_by)
  values(bal.id,p_movement_type,item.variant_id,item.warehouse_id,item.location_id,bal.physical_stock,p_physical_delta,new_physical,bal.reserved_stock,p_reserved_delta,new_reserved,bal.average_unit_cost,nullif(btrim(p_reason),''),p_order_id,p_order_item_id,p_related_movement_id,actor_id,btrim(p_idempotency_key),'{}',actor_id) returning id into movement_id;
  return jsonb_build_object('movement_id',movement_id,'balance_id',bal.id,'physical_stock',new_physical,'reserved_stock',new_reserved,'available_stock',new_physical-new_reserved,'version',bal.version+1);
end; $$;

commit;
