-- Etapa 5A: envíos, transportistas y seguimiento logístico.
begin;

create type public.shipment_status as enum (
  'draft','ready','handed_to_carrier','in_transit','delivered',
  'delivery_failed','returning','returned','cancelled'
);
create type public.shipment_event_type as enum (
  'shipment_created','shipment_ready','handed_to_carrier','transit_update',
  'delivery_attempt','delivered','delivery_failed','return_started','returned',
  'cancelled','note_added'
);

alter table public.audit_logs drop constraint audit_logs_action_allowed;
alter table public.audit_logs add constraint audit_logs_action_allowed check (action in (
  'bootstrap_administrator','invite_user','role_changed','user_activated','user_deactivated','password_recovery_completed',
  'product_created','product_updated','product_activated','product_deactivated','variant_created','variant_updated','variant_activated','variant_deactivated',
  'warehouse_created','warehouse_updated','warehouse_activated','warehouse_deactivated','location_created','location_updated','location_activated','location_deactivated',
  'supplier_created','supplier_updated','supplier_activated','supplier_deactivated','purchase_created','purchase_updated','purchase_item_added','purchase_item_updated','purchase_item_removed',
  'purchase_confirmed','purchase_cancelled','purchase_partially_received','purchase_received','transfer_created','transfer_updated','transfer_item_added','transfer_item_updated','transfer_item_removed',
  'transfer_confirmed','transfer_cancelled','transfer_dispatched','transfer_partially_received','transfer_received','inventory_adjusted','customer_created','customer_updated','customer_activated','customer_deactivated',
  'order_created','order_updated','order_item_added','order_item_updated','order_item_removed','order_submitted','order_returned_to_draft','order_confirmed','order_cancelled',
  'order_item_dispatched','order_dispatched','order_delivered','order_item_returned','payment_created','payment_updated','payment_confirmed','payment_cancelled','payment_refunded','financial_reconciliation_executed',
  'carrier_created','carrier_updated','carrier_activated','carrier_deactivated','shipment_created','shipment_item_added','shipment_item_removed','shipment_ready',
  'shipment_handed_to_carrier','shipment_transit_updated','shipment_delivery_attempted','shipment_delivered','shipment_delivery_failed','shipment_return_started','shipment_returned','shipment_cancelled','shipping_reconciliation_executed'
));

create sequence private.shipment_number_seq start 1;
revoke all on sequence private.shipment_number_seq from public,anon,authenticated;

create table public.carriers (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null,
  contact_name text, email text, phone text, tracking_url_template text, notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint carriers_code_not_blank check (btrim(code)<>''),
  constraint carriers_name_not_blank check (btrim(name)<>''),
  constraint carriers_email_format check (email is null or email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$'),
  constraint carriers_tracking_template_valid check (tracking_url_template is null or tracking_url_template like 'https://%' and position('{tracking}' in tracking_url_template)>0)
);
create unique index carriers_code_unique_idx on public.carriers(upper(code));
create index carriers_status_name_idx on public.carriers(is_active,name);

create table public.shipments (
  id uuid primary key default gen_random_uuid(), shipment_number text not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  carrier_id uuid references public.carriers(id) on delete restrict,
  status public.shipment_status not null default 'draft', tracking_number text,
  recipient_name text not null, recipient_phone text, address_line text not null,
  district text, province text, department text, address_reference text,
  shipping_cost numeric(14,2) not null default 0, currency_code text not null default 'PEN',
  ready_at timestamptz, handed_to_carrier_at timestamptz, delivered_at timestamptz,
  returned_at timestamptz, cancelled_at timestamptz, cancelled_by uuid references public.profiles(id) on delete restrict,
  version bigint not null default 0, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint shipments_number_not_blank check (btrim(shipment_number)<>''),
  constraint shipments_recipient_not_blank check (btrim(recipient_name)<>'' and btrim(address_line)<>''),
  constraint shipments_cost_nonnegative check (shipping_cost>=0),
  constraint shipments_currency_pen check (currency_code='PEN'),
  constraint shipments_version_nonnegative check (version>=0),
  constraint shipments_id_order_unique unique(id,order_id)
);
create unique index shipments_number_unique_idx on public.shipments(upper(shipment_number));
create unique index shipments_tracking_carrier_unique_idx on public.shipments(carrier_id,upper(tracking_number)) where tracking_number is not null;
create index shipments_order_status_idx on public.shipments(order_id,status,created_at desc);
create index shipments_status_date_idx on public.shipments(status,updated_at desc);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null, order_id uuid not null,
  order_item_id uuid not null, quantity numeric(14,3) not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  constraint shipment_items_quantity_positive check(quantity>0),
  constraint shipment_items_shipment_order_fkey foreign key(shipment_id,order_id) references public.shipments(id,order_id) on delete restrict,
  constraint shipment_items_order_line_fkey foreign key(order_id,order_item_id) references public.order_items(order_id,id) on delete restrict,
  constraint shipment_items_line_unique unique(shipment_id,order_item_id)
);
create index shipment_items_order_line_idx on public.shipment_items(order_id,order_item_id);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete restrict,
  event_type public.shipment_event_type not null, occurred_at timestamptz not null default now(),
  location text, description text, responsible_user_id uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  constraint shipment_events_metadata_object check(jsonb_typeof(metadata)='object')
);
create index shipment_events_timeline_idx on public.shipment_events(shipment_id,occurred_at,id);

create table private.shipping_commands (
  idempotency_key text primary key, operation_type text not null, payload_hash text not null,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  result jsonb, created_at timestamptz not null default now(),
  constraint shipping_commands_result_object check(result is null or jsonb_typeof(result)='object')
);
revoke all on table private.shipping_commands from public,anon,authenticated;

create or replace function private.assert_shipping_staff(p_admin boolean default false)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); role_code text;
begin
  if actor is null or not public.current_user_is_active() then raise exception 'Acción no autorizada.' using errcode='42501'; end if;
  role_code:=public.current_user_role();
  if role_code not in ('administrator','operator') or (p_admin and role_code<>'administrator') then raise exception 'Acción no autorizada.' using errcode='42501'; end if;
  return actor;
end;$$;

create or replace function private.prepare_carrier()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.code:=upper(btrim(new.code)); new.name:=btrim(new.name); new.contact_name:=nullif(btrim(new.contact_name),'');
  new.email:=lower(nullif(btrim(new.email),'')); new.phone:=nullif(btrim(new.phone),'');
  new.tracking_url_template:=nullif(btrim(new.tracking_url_template),''); new.notes:=nullif(btrim(new.notes),'');
  if tg_op='UPDATE' and old.is_active and not new.is_active and exists(
    select 1 from public.shipments s where s.carrier_id=old.id and s.status in ('ready','handed_to_carrier','in_transit','delivery_failed','returning')
  ) then raise exception 'No se puede desactivar un transportista con envíos abiertos.' using errcode='23514'; end if;
  return new;
end;$$;

create or replace function private.audit_carrier()
returns trigger language plpgsql security definer set search_path='' as $$
declare action_name text;
begin
  action_name:=case when tg_op='INSERT' then 'carrier_created' when old.is_active<>new.is_active and new.is_active then 'carrier_activated' when old.is_active<>new.is_active then 'carrier_deactivated' else 'carrier_updated' end;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),action_name,'carrier',new.id,jsonb_build_object('code',new.code,'is_active',new.is_active)); return new;
end;$$;

create or replace function private.reject_shipment_event_mutation()
returns trigger language plpgsql security definer set search_path='' as $$ begin raise exception 'Los eventos logísticos son inmutables.' using errcode='42501'; end;$$;

create or replace function private.start_shipping_command(p_key text,p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_shipping_staff(false); hash text; existing private.shipping_commands%rowtype;
begin
  if p_key is null or btrim(p_key)='' then raise exception 'La clave idempotente es obligatoria.' using errcode='22023'; end if;
  hash:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
  insert into private.shipping_commands(idempotency_key,operation_type,payload_hash,actor_user_id) values(btrim(p_key),p_operation,hash,actor)
  on conflict(idempotency_key) do nothing;
  select * into existing from private.shipping_commands where idempotency_key=btrim(p_key) for update;
  if existing.operation_type<>p_operation or existing.payload_hash<>hash or existing.actor_user_id<>actor then raise exception 'La clave idempotente ya fue utilizada con otra operación.' using errcode='23505'; end if;
  return existing.result;
end;$$;
create or replace function private.finish_shipping_command(p_key text,p_result jsonb)
returns void language sql security definer set search_path='' as $$ update private.shipping_commands set result=p_result where idempotency_key=btrim(p_key); $$;

create or replace function private.add_shipment_event(p_shipment uuid,p_type public.shipment_event_type,p_location text,p_description text,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid; actor uuid:=private.assert_shipping_staff(false);
begin insert into public.shipment_events(shipment_id,event_type,location,description,responsible_user_id,metadata,created_by)
values(p_shipment,p_type,nullif(btrim(p_location),''),nullif(btrim(p_description),''),actor,coalesce(p_metadata,'{}'::jsonb),actor) returning id into event_id; return event_id; end;$$;

create or replace function public.create_shipment(
  p_order_id uuid,p_carrier_id uuid,p_recipient_name text,p_recipient_phone text,p_address_line text,
  p_district text,p_province text,p_department text,p_address_reference text,p_shipping_cost numeric,p_tracking_number text,p_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_shipping_staff(false); shipment_id uuid; order_state public.order_status;
begin
  select status into order_state from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido no encontrado o no autorizado.' using errcode='P0002'; end if;
  if order_state not in ('preparing','shipped','delivered') then raise exception 'El pedido no tiene cantidades despachadas disponibles para envío.' using errcode='23514'; end if;
  if nullif(btrim(p_recipient_name),'') is null or nullif(btrim(p_address_line),'') is null then raise exception 'Destinatario y dirección son obligatorios.' using errcode='22023'; end if;
  if p_shipping_cost is null or p_shipping_cost<0 then raise exception 'El costo de envío no puede ser negativo.' using errcode='22023'; end if;
  if p_carrier_id is not null and not exists(select 1 from public.carriers where id=p_carrier_id and is_active) then raise exception 'Transportista no encontrado o inactivo.' using errcode='23514'; end if;
  insert into public.shipments(shipment_number,order_id,carrier_id,tracking_number,recipient_name,recipient_phone,address_line,district,province,department,address_reference,shipping_cost,notes,created_by,updated_by)
  values('ENV-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('private.shipment_number_seq')::text,6,'0'),p_order_id,p_carrier_id,nullif(btrim(p_tracking_number),''),btrim(p_recipient_name),nullif(btrim(p_recipient_phone),''),btrim(p_address_line),nullif(btrim(p_district),''),nullif(btrim(p_province),''),nullif(btrim(p_department),''),nullif(btrim(p_address_reference),''),p_shipping_cost,nullif(btrim(p_notes),''),actor,actor) returning id into shipment_id;
  perform private.add_shipment_event(shipment_id,'shipment_created',null,'Envío creado.','{}'::jsonb);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'shipment_created','shipment',shipment_id,jsonb_build_object('order_id',p_order_id,'status','draft'));
  return shipment_id;
end;$$;

create or replace function public.add_shipment_item(p_shipment_id uuid,p_order_item_id uuid,p_quantity numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_shipping_staff(false); shipment public.shipments%rowtype; item public.order_items%rowtype; assigned numeric; result_id uuid;
begin
  select * into shipment from public.shipments where id=p_shipment_id for update;
  if not found then raise exception 'Envío no encontrado o no autorizado.' using errcode='P0002'; end if;
  if shipment.status<>'draft' then raise exception 'Solo se modifican líneas de envíos en borrador.' using errcode='23514'; end if;
  select * into item from public.order_items where id=p_order_item_id and order_id=shipment.order_id for update;
  if not found then raise exception 'La línea no pertenece al pedido del envío.' using errcode='23514'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'La cantidad debe ser mayor que cero.' using errcode='22023'; end if;
  select coalesce(sum(si.quantity),0) into assigned from public.shipment_items si join public.shipments s on s.id=si.shipment_id where si.order_item_id=item.id and s.status<>'cancelled';
  if assigned+p_quantity>item.dispatched_quantity-item.returned_quantity then raise exception 'La cantidad supera lo despachado pendiente de asignar.' using errcode='23514'; end if;
  insert into public.shipment_items(shipment_id,order_id,order_item_id,quantity,created_by,updated_by) values(shipment.id,shipment.order_id,item.id,p_quantity,actor,actor) returning id into result_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'shipment_item_added','shipment',shipment.id,jsonb_build_object('order_item_id',item.id,'quantity',p_quantity)); return result_id;
end;$$;

create or replace function public.remove_shipment_item(p_shipment_item_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_shipping_staff(false); row_item public.shipment_items%rowtype;
begin
  select si.* into row_item from public.shipment_items si join public.shipments s on s.id=si.shipment_id where si.id=p_shipment_item_id and s.status='draft' for update of si;
  if not found then raise exception 'Línea no encontrada o envío no editable.' using errcode='P0002'; end if;
  delete from public.shipment_items where id=row_item.id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'shipment_item_removed','shipment',row_item.shipment_id,jsonb_build_object('order_item_id',row_item.order_item_id,'quantity',row_item.quantity)); return row_item.shipment_id;
end;$$;

create or replace function private.transition_shipment(p_id uuid,p_from public.shipment_status[],p_to public.shipment_status,p_event public.shipment_event_type,p_action text,p_location text,p_description text,p_key text,p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_shipping_staff(p_admin); shipment public.shipments%rowtype; replay jsonb; result jsonb;
begin
  replay:=private.start_shipping_command(p_key,p_action,jsonb_build_object('shipment_id',p_id,'to',p_to,'location',nullif(btrim(p_location),''),'description',nullif(btrim(p_description),'')));
  if replay is not null then return replay; end if;
  select * into shipment from public.shipments where id=p_id for update;
  if not found then raise exception 'Envío no encontrado o no autorizado.' using errcode='P0002'; end if;
  if not shipment.status=any(p_from) then raise exception 'El estado actual no permite esta operación.' using errcode='23514'; end if;
  if p_to='ready' then
    if not exists(select 1 from public.shipment_items where shipment_id=p_id) then raise exception 'El envío debe tener al menos una línea.' using errcode='23514'; end if;
    if shipment.carrier_id is null then raise exception 'Selecciona un transportista antes de preparar el envío.' using errcode='23514'; end if;
    perform 1 from public.carriers where id=shipment.carrier_id and is_active for key share;
    if not found then raise exception 'El transportista está inactivo.' using errcode='23514'; end if;
  end if;
  update public.shipments set status=p_to,version=version+1,updated_at=now(),updated_by=actor,
    ready_at=case when p_to='ready' then now() else ready_at end,
    handed_to_carrier_at=case when p_to='handed_to_carrier' then now() else handed_to_carrier_at end,
    delivered_at=case when p_to='delivered' then now() else delivered_at end,
    returned_at=case when p_to='returned' then now() else returned_at end,
    cancelled_at=case when p_to='cancelled' then now() else cancelled_at end,
    cancelled_by=case when p_to='cancelled' then actor else cancelled_by end where id=p_id;
  perform private.add_shipment_event(p_id,p_event,p_location,p_description,jsonb_build_object('previous_status',shipment.status,'new_status',p_to));
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,p_action,'shipment',p_id,jsonb_build_object('previous_status',shipment.status,'new_status',p_to));
  result:=jsonb_build_object('shipment_id',p_id,'status',p_to,'version',shipment.version+1); perform private.finish_shipping_command(p_key,result); return result;
end;$$;

create or replace function public.mark_shipment_ready(p_shipment_id uuid,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['draft']::public.shipment_status[],'ready','shipment_ready','shipment_ready',null,'Envío preparado.',p_idempotency_key,false); $$;
create or replace function public.hand_shipment_to_carrier(p_shipment_id uuid,p_location text,p_description text,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['ready']::public.shipment_status[],'handed_to_carrier','handed_to_carrier','shipment_handed_to_carrier',p_location,p_description,p_idempotency_key,false); $$;
create or replace function public.add_shipment_transit_event(p_shipment_id uuid,p_location text,p_description text,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['handed_to_carrier','in_transit']::public.shipment_status[],'in_transit','transit_update','shipment_transit_updated',p_location,p_description,p_idempotency_key,false); $$;
create or replace function public.register_delivery_attempt(p_shipment_id uuid,p_delivered boolean,p_location text,p_description text,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$ begin return private.transition_shipment(p_shipment_id,array['handed_to_carrier','in_transit','delivery_failed']::public.shipment_status[],case when p_delivered then 'delivered'::public.shipment_status else 'delivery_failed'::public.shipment_status end,case when p_delivered then 'delivered'::public.shipment_event_type else 'delivery_failed'::public.shipment_event_type end,case when p_delivered then 'shipment_delivered' else 'shipment_delivery_failed' end,p_location,p_description,p_idempotency_key,false); end;$$;
create or replace function public.deliver_shipment(p_shipment_id uuid,p_location text,p_description text,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['handed_to_carrier','in_transit','delivery_failed']::public.shipment_status[],'delivered','delivered','shipment_delivered',p_location,p_description,p_idempotency_key,false); $$;
create or replace function public.start_shipment_return(p_shipment_id uuid,p_location text,p_description text,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['handed_to_carrier','in_transit','delivery_failed','delivered']::public.shipment_status[],'returning','return_started','shipment_return_started',p_location,p_description,p_idempotency_key,false); $$;
create or replace function public.complete_shipment_return(p_shipment_id uuid,p_location text,p_description text,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['returning']::public.shipment_status[],'returned','returned','shipment_returned',p_location,p_description,p_idempotency_key,false); $$;
create or replace function public.cancel_shipment(p_shipment_id uuid,p_description text,p_idempotency_key text) returns jsonb language sql security definer set search_path='' as $$ select private.transition_shipment(p_shipment_id,array['draft','ready']::public.shipment_status[],'cancelled','cancelled','shipment_cancelled',null,p_description,p_idempotency_key,true); $$;

create or replace function public.admin_shipping_reconciliation()
returns table(issue_type text,shipment_id uuid,order_id uuid,shipment_item_id uuid,details jsonb)
language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_shipping_staff(true);
  insert into public.audit_logs(actor_user_id,action,entity_type,metadata) values(auth.uid(),'shipping_reconciliation_executed','shipment',jsonb_build_object('scope','all'));
  return query
  select 'shipment_without_items',s.id,s.order_id,null::uuid,'{}'::jsonb from public.shipments s where s.status<>'draft' and not exists(select 1 from public.shipment_items i where i.shipment_id=s.id)
  union all select 'quantity_exceeds_dispatched',s.id,s.order_id,si.id,jsonb_build_object('assigned',si.quantity,'dispatched',oi.dispatched_quantity)
    from public.shipment_items si join public.shipments s on s.id=si.shipment_id join public.order_items oi on oi.id=si.order_item_id where si.quantity>oi.dispatched_quantity-oi.returned_quantity
  union all select 'missing_final_event',s.id,s.order_id,null::uuid,jsonb_build_object('status',s.status)
    from public.shipments s where s.status in ('delivered','returned','cancelled') and not exists(select 1 from public.shipment_events e where e.shipment_id=s.id and e.event_type::text=s.status::text)
  union all select 'incompatible_order',s.id,s.order_id,null::uuid,jsonb_build_object('order_status',o.status)
    from public.shipments s join public.orders o on o.id=s.order_id where o.status in ('draft','new','confirmed','cancelled','returned');
end;$$;

create trigger carriers_10_prepare_write before insert or update on public.carriers for each row execute function private.prepare_operational_write();
create trigger carriers_20_normalize before insert or update on public.carriers for each row execute function private.prepare_carrier();
create trigger carriers_90_audit after insert or update on public.carriers for each row execute function private.audit_carrier();
create trigger shipment_events_reject_update before update on public.shipment_events for each row execute function private.reject_shipment_event_mutation();
create trigger shipment_events_reject_delete before delete on public.shipment_events for each row execute function private.reject_shipment_event_mutation();

alter table public.carriers enable row level security; alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security; alter table public.shipment_events enable row level security;
create policy carriers_select_staff on public.carriers for select to authenticated using(public.current_user_is_active() and public.current_user_role() in ('administrator','operator') and (public.current_user_role()='administrator' or is_active));
create policy carriers_insert_admin on public.carriers for insert to authenticated with check(public.current_user_is_active() and public.current_user_role()='administrator');
create policy carriers_update_admin on public.carriers for update to authenticated using(public.current_user_is_active() and public.current_user_role()='administrator') with check(public.current_user_is_active() and public.current_user_role()='administrator');
create policy shipments_select_staff on public.shipments for select to authenticated using(public.current_user_is_active() and public.current_user_role() in ('administrator','operator'));
create policy shipment_items_select_staff on public.shipment_items for select to authenticated using(public.current_user_is_active() and public.current_user_role() in ('administrator','operator'));
create policy shipment_events_select_staff on public.shipment_events for select to authenticated using(public.current_user_is_active() and public.current_user_role() in ('administrator','operator'));

revoke all on table public.carriers,public.shipments,public.shipment_items,public.shipment_events from public,anon,authenticated;
grant select on table public.carriers,public.shipments,public.shipment_items,public.shipment_events to authenticated;
grant insert(code,name,contact_name,email,phone,tracking_url_template,notes) on public.carriers to authenticated;
grant update(code,name,contact_name,email,phone,tracking_url_template,notes,is_active) on public.carriers to authenticated;

revoke all on function public.create_shipment(uuid,uuid,text,text,text,text,text,text,text,numeric,text,text),public.add_shipment_item(uuid,uuid,numeric),public.remove_shipment_item(uuid),public.mark_shipment_ready(uuid,text),public.hand_shipment_to_carrier(uuid,text,text,text),public.add_shipment_transit_event(uuid,text,text,text),public.register_delivery_attempt(uuid,boolean,text,text,text),public.deliver_shipment(uuid,text,text,text),public.start_shipment_return(uuid,text,text,text),public.complete_shipment_return(uuid,text,text,text),public.cancel_shipment(uuid,text,text),public.admin_shipping_reconciliation() from public,anon;
grant execute on function public.create_shipment(uuid,uuid,text,text,text,text,text,text,text,numeric,text,text),public.add_shipment_item(uuid,uuid,numeric),public.remove_shipment_item(uuid),public.mark_shipment_ready(uuid,text),public.hand_shipment_to_carrier(uuid,text,text,text),public.add_shipment_transit_event(uuid,text,text,text),public.register_delivery_attempt(uuid,boolean,text,text,text),public.deliver_shipment(uuid,text,text,text),public.start_shipment_return(uuid,text,text,text),public.complete_shipment_return(uuid,text,text,text),public.cancel_shipment(uuid,text,text),public.admin_shipping_reconciliation() to authenticated;
revoke all on function private.assert_shipping_staff(boolean),private.prepare_carrier(),private.audit_carrier(),private.reject_shipment_event_mutation(),private.start_shipping_command(text,text,jsonb),private.finish_shipping_command(text,jsonb),private.add_shipment_event(uuid,public.shipment_event_type,text,text,jsonb),private.transition_shipment(uuid,public.shipment_status[],public.shipment_status,public.shipment_event_type,text,text,text,text,boolean) from public,anon,authenticated;

commit;
