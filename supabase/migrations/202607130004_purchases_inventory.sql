begin;

create extension if not exists pgcrypto with schema extensions;

create type public.purchase_status as enum (
  'draft', 'confirmed', 'partially_received', 'received', 'cancelled'
);

create type public.transfer_status as enum (
  'draft', 'confirmed', 'in_transit', 'partially_received', 'received', 'cancelled'
);

create type public.movement_type as enum (
  'purchase_entry', 'supplier_return', 'transfer_out', 'transfer_in',
  'positive_adjustment', 'negative_adjustment', 'damaged', 'lost', 'initial_stock'
);

create sequence private.purchase_number_seq;
create sequence private.transfer_number_seq;
revoke all on sequence private.purchase_number_seq, private.transfer_number_seq from public, anon, authenticated;

alter table public.audit_logs
  drop constraint audit_logs_action_allowed,
  add constraint audit_logs_action_allowed check (
    action in (
      'bootstrap_administrator', 'invite_user', 'role_changed',
      'user_activated', 'user_deactivated', 'password_recovery_completed',
      'product_created', 'product_updated', 'product_activated', 'product_deactivated',
      'variant_created', 'variant_updated', 'variant_activated', 'variant_deactivated',
      'warehouse_created', 'warehouse_updated', 'warehouse_activated', 'warehouse_deactivated',
      'location_created', 'location_updated', 'location_activated', 'location_deactivated',
      'supplier_created', 'supplier_updated', 'supplier_activated', 'supplier_deactivated',
      'purchase_created', 'purchase_updated', 'purchase_item_added', 'purchase_item_updated',
      'purchase_item_removed', 'purchase_confirmed', 'purchase_cancelled', 'purchase_received',
      'transfer_created', 'transfer_updated', 'transfer_item_added', 'transfer_item_updated',
      'transfer_item_removed', 'transfer_confirmed', 'transfer_cancelled', 'transfer_dispatched',
      'transfer_partially_received', 'transfer_received', 'inventory_adjusted'
    )
  );

alter table public.warehouse_locations
  add constraint warehouse_locations_warehouse_id_id_unique unique (warehouse_id, id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  supplier_reference text,
  status public.purchase_status not null default 'draft',
  ordered_at timestamptz not null default now(),
  expected_at date,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete restrict,
  currency_code text not null default 'PEN',
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint purchases_number_not_blank check (btrim(purchase_number) <> ''),
  constraint purchases_currency_pen check (currency_code = 'PEN'),
  constraint purchases_amounts_nonnegative check (subtotal >= 0 and tax_amount >= 0 and total_amount >= 0),
  constraint purchases_total_consistent check (total_amount = subtotal + tax_amount),
  constraint purchases_confirmation_complete check (
    (status = 'draft' and confirmed_at is null and confirmed_by is null)
    or (status = 'cancelled')
    or (status in ('confirmed', 'partially_received', 'received') and confirmed_at is not null and confirmed_by is not null)
  )
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  line_number integer not null,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  ordered_quantity numeric(14,3) not null,
  received_quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null,
  tax_amount numeric(14,2) not null default 0,
  line_subtotal numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint purchase_items_line_positive check (line_number > 0),
  constraint purchase_items_ordered_positive check (ordered_quantity > 0),
  constraint purchase_items_received_range check (received_quantity >= 0 and received_quantity <= ordered_quantity),
  constraint purchase_items_cost_nonnegative check (unit_cost >= 0 and tax_amount >= 0),
  constraint purchase_items_totals_nonnegative check (line_subtotal >= 0 and line_total >= 0),
  constraint purchase_items_line_total_consistent check (line_total = line_subtotal + tax_amount),
  constraint purchase_items_line_unique unique (purchase_id, line_number),
  constraint purchase_items_purchase_id_id_unique unique (purchase_id, id)
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  location_id uuid not null,
  physical_stock numeric(14,3) not null default 0,
  reserved_stock numeric(14,3) not null default 0,
  available_stock numeric(14,3) generated always as (physical_stock - reserved_stock) stored,
  average_unit_cost numeric(14,4) not null default 0,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint inventory_balances_location_fkey foreign key (warehouse_id, location_id)
    references public.warehouse_locations (warehouse_id, id) on delete restrict,
  constraint inventory_balances_stocks_valid check (
    physical_stock >= 0 and reserved_stock >= 0 and reserved_stock <= physical_stock
  ),
  constraint inventory_balances_cost_nonnegative check (average_unit_cost >= 0),
  constraint inventory_balances_version_nonnegative check (version >= 0),
  constraint inventory_balances_granularity_unique unique (variant_id, warehouse_id, location_id),
  constraint inventory_balances_id_granularity_unique unique (id, variant_id, warehouse_id, location_id)
);

create table public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null,
  origin_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  destination_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  status public.transfer_status not null default 'draft',
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete restrict,
  dispatched_at timestamptz,
  dispatched_by uuid references public.profiles (id) on delete restrict,
  received_at timestamptz,
  received_by uuid references public.profiles (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint inventory_transfers_number_not_blank check (btrim(transfer_number) <> ''),
  constraint inventory_transfers_warehouses_different check (origin_warehouse_id <> destination_warehouse_id),
  constraint inventory_transfers_confirmed_fields check (
    (status = 'draft' and confirmed_at is null and confirmed_by is null)
    or status = 'cancelled'
    or (status in ('confirmed', 'in_transit', 'partially_received', 'received') and confirmed_at is not null and confirmed_by is not null)
  ),
  constraint inventory_transfers_dispatch_fields check (
    (status in ('draft', 'confirmed', 'cancelled') and dispatched_at is null and dispatched_by is null)
    or (status in ('in_transit', 'partially_received', 'received') and dispatched_at is not null and dispatched_by is not null)
  ),
  constraint inventory_transfers_received_fields check (
    (status <> 'received' and received_at is null and received_by is null)
    or (status = 'received' and received_at is not null and received_by is not null)
  )
);

create table public.inventory_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.inventory_transfers (id) on delete restrict,
  line_number integer not null,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  origin_location_id uuid not null references public.warehouse_locations (id) on delete restrict,
  destination_location_id uuid not null references public.warehouse_locations (id) on delete restrict,
  requested_quantity numeric(14,3) not null,
  dispatched_quantity numeric(14,3) not null default 0,
  received_quantity numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint inventory_transfer_items_line_positive check (line_number > 0),
  constraint inventory_transfer_items_requested_positive check (requested_quantity > 0),
  constraint inventory_transfer_items_quantity_ranges check (
    dispatched_quantity >= 0 and dispatched_quantity <= requested_quantity
    and received_quantity >= 0 and received_quantity <= dispatched_quantity
  ),
  constraint inventory_transfer_items_locations_different check (origin_location_id <> destination_location_id),
  constraint inventory_transfer_items_line_unique unique (transfer_id, line_number),
  constraint inventory_transfer_items_transfer_id_id_unique unique (transfer_id, id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  balance_id uuid not null references public.inventory_balances (id) on delete restrict,
  movement_type public.movement_type not null,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  location_id uuid not null,
  previous_physical numeric(14,3) not null,
  physical_delta numeric(14,3) not null,
  resulting_physical numeric(14,3) not null,
  previous_reserved numeric(14,3) not null,
  reserved_delta numeric(14,3) not null default 0,
  resulting_reserved numeric(14,3) not null,
  unit_cost_snapshot numeric(14,4) not null,
  reason text,
  purchase_id uuid references public.purchases (id) on delete restrict,
  purchase_item_id uuid references public.purchase_items (id) on delete restrict,
  transfer_id uuid references public.inventory_transfers (id) on delete restrict,
  transfer_item_id uuid references public.inventory_transfer_items (id) on delete restrict,
  related_movement_id uuid references public.inventory_movements (id) on delete restrict,
  responsible_user_id uuid not null references public.profiles (id) on delete restrict,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  constraint inventory_movements_location_fkey foreign key (warehouse_id, location_id)
    references public.warehouse_locations (warehouse_id, id) on delete restrict,
  constraint inventory_movements_balance_identity_fkey
    foreign key (balance_id, variant_id, warehouse_id, location_id)
    references public.inventory_balances (id, variant_id, warehouse_id, location_id) on delete restrict,
  constraint inventory_movements_purchase_line_fkey
    foreign key (purchase_id, purchase_item_id)
    references public.purchase_items (purchase_id, id) on delete restrict,
  constraint inventory_movements_transfer_line_fkey
    foreign key (transfer_id, transfer_item_id)
    references public.inventory_transfer_items (transfer_id, id) on delete restrict,
  constraint inventory_movements_delta_nonzero check (physical_delta <> 0 or reserved_delta <> 0),
  constraint inventory_movements_physical_equation check (previous_physical + physical_delta = resulting_physical),
  constraint inventory_movements_reserved_equation check (previous_reserved + reserved_delta = resulting_reserved),
  constraint inventory_movements_results_valid check (
    resulting_physical >= 0 and resulting_reserved >= 0 and resulting_reserved <= resulting_physical
  ),
  constraint inventory_movements_previous_valid check (
    previous_physical >= 0 and previous_reserved >= 0 and previous_reserved <= previous_physical
  ),
  constraint inventory_movements_stage_three_reserved_unchanged check (reserved_delta = 0),
  constraint inventory_movements_cost_nonnegative check (unit_cost_snapshot >= 0),
  constraint inventory_movements_idempotency_not_blank check (btrim(idempotency_key) <> '' and length(idempotency_key) <= 240),
  constraint inventory_movements_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint inventory_movements_reason_required check (
    movement_type not in ('positive_adjustment', 'negative_adjustment', 'damaged', 'lost', 'initial_stock')
    or nullif(btrim(reason), '') is not null
  ),
  constraint inventory_movements_direction_valid check (
    (movement_type in ('purchase_entry', 'transfer_in', 'positive_adjustment', 'initial_stock') and physical_delta > 0)
    or (movement_type in ('supplier_return', 'transfer_out', 'negative_adjustment', 'damaged', 'lost') and physical_delta < 0)
  ),
  constraint inventory_movements_reference_valid check (
    (movement_type = 'purchase_entry' and purchase_id is not null and purchase_item_id is not null and transfer_id is null and transfer_item_id is null)
    or (movement_type = 'supplier_return' and purchase_id is not null and purchase_item_id is not null and transfer_id is null and transfer_item_id is null)
    or (movement_type in ('transfer_out', 'transfer_in') and transfer_id is not null and transfer_item_id is not null and purchase_id is null and purchase_item_id is null)
    or (movement_type in ('positive_adjustment', 'negative_adjustment', 'damaged', 'lost', 'initial_stock')
      and purchase_id is null and purchase_item_id is null and transfer_id is null and transfer_item_id is null)
  )
);

create table private.inventory_commands (
  idempotency_key text primary key,
  operation_type text not null,
  payload_hash text not null,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  result jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_commands_key_not_blank check (btrim(idempotency_key) <> ''),
  constraint inventory_commands_result_object check (result is null or jsonb_typeof(result) = 'object')
);
revoke all on table private.inventory_commands from public, anon, authenticated;

create or replace function private.normalize_product_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sku := upper(btrim(new.sku));
  new.name := btrim(new.name);
  new.color := nullif(btrim(new.color), '');
  new.barcode := nullif(btrim(new.barcode), '');

  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    raise exception 'No se puede cambiar el producto de una variante.' using errcode = '23514';
  end if;
  if new.is_active and not exists (
    select 1 from public.products p where p.id = new.product_id and p.is_active
  ) then
    raise exception 'No se puede activar una variante de un producto inactivo.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.is_active and not new.is_active then
    if exists (
      select 1 from public.inventory_balances b
      where b.variant_id = old.id and (b.physical_stock > 0 or b.reserved_stock > 0)
    ) then
      raise exception 'No se puede desactivar una variante con stock físico o reservado.' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.purchase_items i
      join public.purchases p on p.id = i.purchase_id
      where i.variant_id = old.id
        and p.status in ('confirmed', 'partially_received')
        and i.received_quantity < i.ordered_quantity
    ) then
      raise exception 'No se puede desactivar una variante con cantidades pendientes de recepción.' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.inventory_transfer_items i
      join public.inventory_transfers t on t.id = i.transfer_id
      where i.variant_id = old.id
        and t.status in ('confirmed', 'in_transit', 'partially_received')
    ) then
      raise exception 'No se puede desactivar una variante vinculada a una transferencia abierta.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_warehouse_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.name := btrim(new.name);

  if tg_op = 'UPDATE' and new.warehouse_id is distinct from old.warehouse_id then
    raise exception 'No se puede cambiar el almacén de una ubicación.' using errcode = '23514';
  end if;
  if new.is_active and not exists (
    select 1 from public.warehouses w where w.id = new.warehouse_id and w.is_active
  ) then
    raise exception 'No se puede activar una ubicación de un almacén inactivo.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.is_active and not new.is_active then
    if exists (
      select 1 from public.inventory_balances b
      where b.location_id = old.id and (b.physical_stock > 0 or b.reserved_stock > 0)
    ) then
      raise exception 'No se puede desactivar una ubicación con stock físico o reservado.' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.inventory_transfer_items i
      join public.inventory_transfers t on t.id = i.transfer_id
      where (i.origin_location_id = old.id or i.destination_location_id = old.id)
        and t.status in ('confirmed', 'in_transit', 'partially_received')
    ) then
      raise exception 'No se puede desactivar una ubicación vinculada a una transferencia abierta.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_warehouse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.address := nullif(btrim(new.address), '');

  if tg_op = 'UPDATE' and old.is_active and not new.is_active then
    if exists (
      select 1 from public.warehouse_locations l
      where l.warehouse_id = old.id and l.is_active
    ) then
      raise exception 'No se puede desactivar un almacén con ubicaciones activas.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.inventory_balances b
      where b.warehouse_id = old.id and (b.physical_stock > 0 or b.reserved_stock > 0)
    ) then
      raise exception 'No se puede desactivar un almacén con stock físico o reservado.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.inventory_transfers t
      where (t.origin_warehouse_id = old.id or t.destination_warehouse_id = old.id)
        and t.status in ('confirmed', 'in_transit', 'partially_received')
    ) then
      raise exception 'No se puede desactivar un almacén vinculado a una transferencia abierta.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create unique index purchases_number_unique_idx on public.purchases (purchase_number);
create unique index purchases_supplier_reference_unique_idx
  on public.purchases (supplier_id, supplier_reference) where supplier_reference is not null;
create index purchases_supplier_status_idx on public.purchases (supplier_id, status, ordered_at desc);
create index purchases_number_search_idx on public.purchases (lower(purchase_number) text_pattern_ops);
create index purchases_reference_search_idx on public.purchases (lower(supplier_reference) text_pattern_ops)
  where supplier_reference is not null;
create index purchase_items_purchase_idx on public.purchase_items (purchase_id, line_number);
create index purchase_items_variant_idx on public.purchase_items (variant_id);

create index inventory_balances_variant_idx on public.inventory_balances (variant_id);
create index inventory_balances_warehouse_location_idx on public.inventory_balances (warehouse_id, location_id);
create index inventory_balances_available_positive_idx on public.inventory_balances (warehouse_id, variant_id)
  where available_stock > 0;

create unique index inventory_transfers_number_unique_idx on public.inventory_transfers (transfer_number);
create index inventory_transfers_status_created_idx on public.inventory_transfers (status, created_at desc);
create index inventory_transfers_origin_idx on public.inventory_transfers (origin_warehouse_id, created_at desc);
create index inventory_transfers_destination_idx on public.inventory_transfers (destination_warehouse_id, created_at desc);
create index inventory_transfer_items_transfer_idx on public.inventory_transfer_items (transfer_id, line_number);
create index inventory_transfer_items_variant_idx on public.inventory_transfer_items (variant_id);

create unique index inventory_movements_idempotency_unique_idx on public.inventory_movements (idempotency_key);
create index inventory_movements_variant_occurred_idx on public.inventory_movements (variant_id, occurred_at desc);
create index inventory_movements_location_occurred_idx
  on public.inventory_movements (warehouse_id, location_id, occurred_at desc);
create index inventory_movements_type_occurred_idx on public.inventory_movements (movement_type, occurred_at desc);
create index inventory_movements_purchase_idx on public.inventory_movements (purchase_id) where purchase_id is not null;
create index inventory_movements_transfer_idx on public.inventory_movements (transfer_id) where transfer_id is not null;

create or replace function private.assert_inventory_operator(p_admin_only boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text := (select public.current_user_role());
begin
  if actor_id is null or actor_role not in ('administrator', 'operator') then
    raise exception 'Usuario no autorizado.' using errcode = '42501';
  end if;
  if p_admin_only and actor_role <> 'administrator' then
    raise exception 'Acción reservada para administradores activos.' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;

create or replace function private.prepare_operational_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := actor_id;
  else
    if new.id is distinct from old.id then
      raise exception 'No se puede cambiar el identificador del registro.' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := actor_id;
  return new;
end;
$$;

create or replace function private.prepare_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.supplier_reference := nullif(btrim(new.supplier_reference), '');
  new.notes := nullif(btrim(new.notes), '');
  if tg_op = 'INSERT' then
    new.purchase_number := 'CMP-' || to_char(now() at time zone 'America/Lima', 'YYYY') || '-' ||
      lpad(nextval('private.purchase_number_seq')::text, 6, '0');
    new.status := 'draft';
    new.currency_code := 'PEN';
    new.subtotal := 0;
    new.tax_amount := 0;
    new.total_amount := 0;
    new.confirmed_at := null;
    new.confirmed_by := null;
  else
    new.purchase_number := old.purchase_number;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    if old.status <> 'draft' and (
      new.supplier_id is distinct from old.supplier_id
      or new.supplier_reference is distinct from old.supplier_reference
      or new.ordered_at is distinct from old.ordered_at
      or new.expected_at is distinct from old.expected_at
      or new.currency_code is distinct from old.currency_code
      or new.notes is distinct from old.notes
    ) then
      raise exception 'Una compra confirmada no admite cambios comerciales.' using errcode = '23514';
    end if;
  end if;

  if new.currency_code <> 'PEN' then
    raise exception 'La moneda permitida es PEN.' using errcode = '22023';
  end if;
  if new.status = 'draft' and not exists (
    select 1 from public.suppliers s where s.id = new.supplier_id and s.is_active
  ) then
    raise exception 'Selecciona un proveedor activo.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prepare_purchase_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_status public.purchase_status;
begin
  select p.status into parent_status from public.purchases p where p.id = new.purchase_id;
  if parent_status is null then
    raise exception 'Compra no encontrada.' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT' then
    if parent_status <> 'draft' then
      raise exception 'Solo se pueden añadir líneas a una compra en borrador.' using errcode = '23514';
    end if;
    new.received_quantity := 0;
  else
    if new.purchase_id is distinct from old.purchase_id then
      raise exception 'No se puede cambiar la compra de una línea.' using errcode = '23514';
    end if;
    if parent_status <> 'draft' and (
      new.line_number is distinct from old.line_number
      or new.variant_id is distinct from old.variant_id
      or new.ordered_quantity is distinct from old.ordered_quantity
      or new.unit_cost is distinct from old.unit_cost
      or new.tax_amount is distinct from old.tax_amount
    ) then
      raise exception 'Las líneas de una compra confirmada están congeladas.' using errcode = '23514';
    end if;
  end if;

  if parent_status = 'draft' and not exists (
    select 1 from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = new.variant_id and v.is_active and p.is_active
  ) then
    raise exception 'Selecciona una variante activa.' using errcode = '23514';
  end if;

  new.line_subtotal := round(new.ordered_quantity * new.unit_cost, 2);
  new.line_total := new.line_subtotal + new.tax_amount;
  return new;
end;
$$;

create or replace function private.guard_purchase_item_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_inventory_operator(false);
  if not exists (select 1 from public.purchases p where p.id = old.purchase_id and p.status = 'draft') then
    raise exception 'Solo se pueden retirar líneas de una compra en borrador.' using errcode = '23514';
  end if;
  if old.received_quantity <> 0 or exists (
    select 1 from public.inventory_movements m where m.purchase_item_id = old.id
  ) then
    raise exception 'No se puede retirar una línea con historial.' using errcode = '23514';
  end if;
  return old;
end;
$$;

create or replace function private.recalculate_purchase_totals(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.purchases p
  set subtotal = totals.subtotal,
      tax_amount = totals.tax_amount,
      total_amount = totals.subtotal + totals.tax_amount
  from (
    select coalesce(sum(i.line_subtotal), 0)::numeric(14,2) as subtotal,
           coalesce(sum(i.tax_amount), 0)::numeric(14,2) as tax_amount
    from public.purchase_items i where i.purchase_id = p_purchase_id
  ) totals
  where p.id = p_purchase_id;
end;
$$;

create or replace function private.after_purchase_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_purchase_id uuid := case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end;
  audit_action text;
  target_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  should_audit boolean := true;
begin
  perform private.recalculate_purchase_totals(target_purchase_id);
  if tg_op = 'INSERT' then
    audit_action := 'purchase_item_added';
  elsif tg_op = 'DELETE' then
    audit_action := 'purchase_item_removed';
  else
    audit_action := 'purchase_item_updated';
    should_audit := new.line_number is distinct from old.line_number
      or new.variant_id is distinct from old.variant_id
      or new.ordered_quantity is distinct from old.ordered_quantity
      or new.unit_cost is distinct from old.unit_cost
      or new.tax_amount is distinct from old.tax_amount;
  end if;
  if should_audit then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), audit_action, 'purchase_item', target_id,
      jsonb_build_object('purchase_id', target_purchase_id, 'line_number', case when tg_op = 'DELETE' then old.line_number else new.line_number end));
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.audit_purchase_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'purchase_created', 'purchase', new.id, jsonb_build_object('status', new.status));
  elsif new.status = old.status and (
    new.supplier_id is distinct from old.supplier_id
    or new.supplier_reference is distinct from old.supplier_reference
    or new.ordered_at is distinct from old.ordered_at
    or new.expected_at is distinct from old.expected_at
    or new.notes is distinct from old.notes
  ) then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'purchase_updated', 'purchase', new.id, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

create or replace function private.prepare_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.notes := nullif(btrim(new.notes), '');
  if tg_op = 'INSERT' then
    new.transfer_number := 'TRF-' || to_char(now() at time zone 'America/Lima', 'YYYY') || '-' ||
      lpad(nextval('private.transfer_number_seq')::text, 6, '0');
    new.status := 'draft';
    new.confirmed_at := null; new.confirmed_by := null;
    new.dispatched_at := null; new.dispatched_by := null;
    new.received_at := null; new.received_by := null;
  else
    new.transfer_number := old.transfer_number;
    if old.status <> 'draft' and (
      new.origin_warehouse_id is distinct from old.origin_warehouse_id
      or new.destination_warehouse_id is distinct from old.destination_warehouse_id
      or new.notes is distinct from old.notes
    ) then
      raise exception 'Una transferencia confirmada no admite cambios comerciales.' using errcode = '23514';
    end if;
  end if;
  if new.status = 'draft' and not exists (
    select 1 from public.warehouses o, public.warehouses d
    where o.id = new.origin_warehouse_id and o.is_active
      and d.id = new.destination_warehouse_id and d.is_active
  ) then
    raise exception 'Selecciona almacenes activos.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.status = 'draft' and exists (
    select 1
    from public.inventory_transfer_items i
    join public.warehouse_locations origin on origin.id = i.origin_location_id
    join public.warehouse_locations destination on destination.id = i.destination_location_id
    where i.transfer_id = old.id
      and (origin.warehouse_id <> new.origin_warehouse_id
        or destination.warehouse_id <> new.destination_warehouse_id)
  ) then
    raise exception 'Retira o actualiza las líneas antes de cambiar los almacenes.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prepare_transfer_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_row public.inventory_transfers%rowtype;
begin
  select * into transfer_row from public.inventory_transfers t where t.id = new.transfer_id;
  if not found then raise exception 'Transferencia no encontrada.' using errcode = 'P0002'; end if;
  if tg_op = 'INSERT' then
    if transfer_row.status <> 'draft' then
      raise exception 'Solo se pueden añadir líneas a una transferencia en borrador.' using errcode = '23514';
    end if;
    new.dispatched_quantity := 0;
    new.received_quantity := 0;
  else
    if new.transfer_id is distinct from old.transfer_id then
      raise exception 'No se puede cambiar la transferencia de una línea.' using errcode = '23514';
    end if;
    if transfer_row.status <> 'draft' and (
      new.line_number is distinct from old.line_number
      or new.variant_id is distinct from old.variant_id
      or new.origin_location_id is distinct from old.origin_location_id
      or new.destination_location_id is distinct from old.destination_location_id
      or new.requested_quantity is distinct from old.requested_quantity
    ) then
      raise exception 'Las líneas de una transferencia confirmada están congeladas.' using errcode = '23514';
    end if;
  end if;
  if transfer_row.status = 'draft' and not exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.warehouse_locations origin on origin.id = new.origin_location_id
    join public.warehouse_locations destination on destination.id = new.destination_location_id
    where v.id = new.variant_id and v.is_active and p.is_active
      and origin.is_active and origin.warehouse_id = transfer_row.origin_warehouse_id
      and destination.is_active and destination.warehouse_id = transfer_row.destination_warehouse_id
  ) then
    raise exception 'La variante o las ubicaciones no son válidas para la transferencia.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_transfer_item_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_inventory_operator(false);
  if not exists (select 1 from public.inventory_transfers t where t.id = old.transfer_id and t.status = 'draft') then
    raise exception 'Solo se pueden retirar líneas de una transferencia en borrador.' using errcode = '23514';
  end if;
  if old.dispatched_quantity <> 0 or old.received_quantity <> 0 or exists (
    select 1 from public.inventory_movements m where m.transfer_item_id = old.id
  ) then
    raise exception 'No se puede retirar una línea con historial.' using errcode = '23514';
  end if;
  return old;
end;
$$;

create or replace function private.audit_transfer_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'transfer_created', 'inventory_transfer', new.id, jsonb_build_object('status', new.status));
  elsif new.status = old.status and (
    new.origin_warehouse_id is distinct from old.origin_warehouse_id
    or new.destination_warehouse_id is distinct from old.destination_warehouse_id
    or new.notes is distinct from old.notes
  ) then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'transfer_updated', 'inventory_transfer', new.id, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

create or replace function private.audit_transfer_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  target_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  target_transfer uuid := case when tg_op = 'DELETE' then old.transfer_id else new.transfer_id end;
  target_line integer := case when tg_op = 'DELETE' then old.line_number else new.line_number end;
  should_audit boolean := true;
begin
  if tg_op = 'INSERT' then audit_action := 'transfer_item_added';
  elsif tg_op = 'DELETE' then audit_action := 'transfer_item_removed';
  else
    audit_action := 'transfer_item_updated';
    should_audit := new.line_number is distinct from old.line_number
      or new.variant_id is distinct from old.variant_id
      or new.origin_location_id is distinct from old.origin_location_id
      or new.destination_location_id is distinct from old.destination_location_id
      or new.requested_quantity is distinct from old.requested_quantity;
  end if;
  if should_audit then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), audit_action, 'inventory_transfer_item', target_id,
      jsonb_build_object('transfer_id', target_transfer, 'line_number', target_line));
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.reject_inventory_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los movimientos de inventario son inmutables.' using errcode = '42501';
end;
$$;

create or replace function private.start_inventory_command(
  p_idempotency_key text,
  p_operation_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  normalized_key text := btrim(p_idempotency_key);
  requested_hash text := encode(extensions.digest(p_payload::text, 'sha256'), 'hex');
  existing private.inventory_commands%rowtype;
begin
  if length(normalized_key) < 16 or length(normalized_key) > 160 then
    raise exception 'La clave de idempotencia no es válida.' using errcode = '22023';
  end if;
  insert into private.inventory_commands (idempotency_key, operation_type, payload_hash, actor_user_id)
  values (normalized_key, p_operation_type, requested_hash, actor_id)
  on conflict (idempotency_key) do nothing;
  if found then return null; end if;

  select * into existing from private.inventory_commands c
  where c.idempotency_key = normalized_key for update;
  if existing.operation_type <> p_operation_type
     or existing.payload_hash <> requested_hash
     or existing.actor_user_id <> actor_id then
    raise exception 'La clave de idempotencia ya fue utilizada con otros datos.' using errcode = '23505';
  end if;
  if existing.result is null then
    raise exception 'La operación idempotente no finalizó correctamente.' using errcode = '40001';
  end if;
  return existing.result;
end;
$$;

create or replace function private.finish_inventory_command(p_idempotency_key text, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.inventory_commands
  set result = p_result
  where idempotency_key = btrim(p_idempotency_key)
    and actor_user_id = (select auth.uid());
  if not found then raise exception 'No fue posible completar la operación idempotente.'; end if;
end;
$$;

create or replace function private.apply_inventory_movement(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_movement_type public.movement_type,
  p_physical_delta numeric,
  p_unit_cost numeric,
  p_reason text,
  p_purchase_id uuid,
  p_purchase_item_id uuid,
  p_transfer_id uuid,
  p_transfer_item_id uuid,
  p_related_movement_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  product_id_value uuid;
  catalog_is_active boolean;
  balance_row public.inventory_balances%rowtype;
  movement_id uuid;
  resulting_physical numeric(14,3);
  resulting_cost numeric(14,4);
  cost_snapshot numeric(14,4);
begin
  if p_physical_delta = 0 then raise exception 'El movimiento debe cambiar el stock.' using errcode = '22023'; end if;
  if jsonb_typeof(p_metadata) <> 'object' then raise exception 'Los metadatos no son válidos.' using errcode = '22023'; end if;

  -- Todas las operaciones bloquean catálogos en el mismo orden: producto,
  -- variante, almacén y ubicación. FOR SHARE impide una desactivación
  -- concurrente hasta que balance y movimiento queden confirmados o revertidos.
  select v.product_id into product_id_value
  from public.product_variants v where v.id = p_variant_id;
  if not found then raise exception 'Variante no encontrada.' using errcode = 'P0002'; end if;

  select p.is_active into catalog_is_active
  from public.products p where p.id = product_id_value for share;
  if not found or not catalog_is_active then
    raise exception 'El producto no está activo.' using errcode = '23514';
  end if;

  select v.is_active into catalog_is_active
  from public.product_variants v
  where v.id = p_variant_id and v.product_id = product_id_value
  for share;
  if not found or not catalog_is_active then
    raise exception 'La variante no está activa.' using errcode = '23514';
  end if;

  select w.is_active into catalog_is_active
  from public.warehouses w where w.id = p_warehouse_id for share;
  if not found or not catalog_is_active then
    raise exception 'El almacén no está activo.' using errcode = '23514';
  end if;

  select l.is_active into catalog_is_active
  from public.warehouse_locations l
  where l.id = p_location_id and l.warehouse_id = p_warehouse_id
  for share;
  if not found or not catalog_is_active then
    raise exception 'La ubicación no está activa o no pertenece al almacén.' using errcode = '23514';
  end if;

  insert into public.inventory_balances (
    variant_id, warehouse_id, location_id, created_by, updated_by
  ) values (p_variant_id, p_warehouse_id, p_location_id, actor_id, actor_id)
  on conflict (variant_id, warehouse_id, location_id) do nothing;

  select * into balance_row from public.inventory_balances b
  where b.variant_id = p_variant_id and b.warehouse_id = p_warehouse_id and b.location_id = p_location_id
  for update;
  if not found then raise exception 'No fue posible bloquear el balance.'; end if;

  if p_movement_type = 'initial_stock' and (
    balance_row.physical_stock <> 0
    or exists (
      select 1 from public.inventory_movements m
      where m.variant_id = p_variant_id and m.location_id = p_location_id
    )
  ) then
    raise exception 'El stock inicial solo se registra sin historial previo.' using errcode = '23514';
  end if;

  resulting_physical := balance_row.physical_stock + p_physical_delta;
  if resulting_physical < balance_row.reserved_stock then
    raise exception 'Stock disponible insuficiente para completar la operación.' using errcode = '23514';
  end if;

  if p_physical_delta > 0 then
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'La entrada requiere un costo unitario válido.' using errcode = '22023';
    end if;
    cost_snapshot := round(p_unit_cost, 4);
    if balance_row.physical_stock = 0 then
      resulting_cost := cost_snapshot;
    else
      resulting_cost := round(
        ((balance_row.physical_stock * balance_row.average_unit_cost) + (p_physical_delta * cost_snapshot))
        / resulting_physical,
        4
      );
    end if;
  else
    cost_snapshot := balance_row.average_unit_cost;
    resulting_cost := balance_row.average_unit_cost;
  end if;

  update public.inventory_balances
  set physical_stock = resulting_physical,
      average_unit_cost = resulting_cost,
      version = version + 1,
      updated_at = now(),
      updated_by = actor_id
  where id = balance_row.id;

  insert into public.inventory_movements (
    balance_id, movement_type, variant_id, warehouse_id, location_id,
    previous_physical, physical_delta, resulting_physical,
    previous_reserved, reserved_delta, resulting_reserved, unit_cost_snapshot,
    reason, purchase_id, purchase_item_id, transfer_id, transfer_item_id,
    related_movement_id, responsible_user_id, idempotency_key, metadata, created_by
  ) values (
    balance_row.id, p_movement_type, p_variant_id, p_warehouse_id, p_location_id,
    balance_row.physical_stock, p_physical_delta, resulting_physical,
    balance_row.reserved_stock, 0, balance_row.reserved_stock, cost_snapshot,
    nullif(btrim(p_reason), ''), p_purchase_id, p_purchase_item_id, p_transfer_id, p_transfer_item_id,
    p_related_movement_id, actor_id, btrim(p_idempotency_key), p_metadata, actor_id
  ) returning id into movement_id;

  return jsonb_build_object(
    'movement_id', movement_id,
    'balance_id', balance_row.id,
    'physical_stock', resulting_physical,
    'average_unit_cost', resulting_cost,
    'version', balance_row.version + 1,
    'unit_cost_snapshot', cost_snapshot
  );
end;
$$;

create or replace function public.remove_purchase_item(p_purchase_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  target public.purchase_items%rowtype;
begin
  select * into target from public.purchase_items i where i.id = p_purchase_item_id for update;
  if not found then raise exception 'Línea de compra no encontrada.' using errcode = 'P0002'; end if;
  delete from public.purchase_items where id = target.id;
  return target.purchase_id;
end;
$$;

create or replace function public.confirm_purchase(p_purchase_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  purchase_row public.purchases%rowtype;
begin
  select * into purchase_row from public.purchases p where p.id = p_purchase_id for update;
  if not found then raise exception 'Compra no encontrada.' using errcode = 'P0002'; end if;
  if purchase_row.status <> 'draft' then
    raise exception 'La compra ya no está disponible para confirmar.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.suppliers s where s.id = purchase_row.supplier_id and s.is_active) then
    raise exception 'El proveedor debe estar activo.' using errcode = '23514';
  end if;
  perform 1 from public.purchase_items i where i.purchase_id = p_purchase_id order by i.id for update;
  if not found then raise exception 'Agrega al menos una línea antes de confirmar.' using errcode = '23514'; end if;
  perform p.id
  from public.purchase_items i
  join public.product_variants v on v.id = i.variant_id
  join public.products p on p.id = v.product_id
  where i.purchase_id = p_purchase_id
  order by p.id, v.id
  for share of p, v;
  if exists (
    select 1 from public.purchase_items i
    left join public.product_variants v on v.id = i.variant_id
    left join public.products p on p.id = v.product_id
    where i.purchase_id = p_purchase_id and (not coalesce(v.is_active, false) or not coalesce(p.is_active, false))
  ) then
    raise exception 'Todas las variantes deben estar activas.' using errcode = '23514';
  end if;
  perform private.recalculate_purchase_totals(p_purchase_id);
  update public.purchases
  set status = 'confirmed', confirmed_at = now(), confirmed_by = actor_id
  where id = p_purchase_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'purchase_confirmed', 'purchase', p_purchase_id,
    jsonb_build_object('previous_status', 'draft', 'new_status', 'confirmed'));
  return p_purchase_id;
end;
$$;

create or replace function public.cancel_purchase(p_purchase_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  purchase_row public.purchases%rowtype;
begin
  select * into purchase_row from public.purchases p where p.id = p_purchase_id for update;
  if not found then raise exception 'Compra no encontrada.' using errcode = 'P0002'; end if;
  if purchase_row.status not in ('draft', 'confirmed') then
    raise exception 'La compra ya no se puede cancelar.' using errcode = '23514';
  end if;
  perform 1 from public.purchase_items i where i.purchase_id = p_purchase_id order by i.id for update;
  if exists (select 1 from public.purchase_items i where i.purchase_id = p_purchase_id and i.received_quantity > 0)
     or exists (select 1 from public.inventory_movements m where m.purchase_id = p_purchase_id) then
    raise exception 'No se puede cancelar una compra con recepciones.' using errcode = '23514';
  end if;
  update public.purchases set status = 'cancelled' where id = p_purchase_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'purchase_cancelled', 'purchase', p_purchase_id,
    jsonb_build_object('previous_status', purchase_row.status, 'new_status', 'cancelled'));
  return p_purchase_id;
end;
$$;

create or replace function public.receive_purchase_item(
  p_purchase_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  purchase_id_value uuid;
  purchase_row public.purchases%rowtype;
  item_row public.purchase_items%rowtype;
  location_row public.warehouse_locations%rowtype;
  movement_result jsonb;
  next_status public.purchase_status;
  actor_id uuid := private.assert_inventory_operator(false);
begin
  replay := private.start_inventory_command(
    p_idempotency_key,
    'receive_purchase_item',
    jsonb_build_object('purchase_item_id', p_purchase_item_id, 'location_id', p_location_id, 'quantity', p_quantity)
  );
  if replay is not null then return replay; end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad recibida debe ser mayor que cero.' using errcode = '22023';
  end if;

  select i.purchase_id into purchase_id_value from public.purchase_items i where i.id = p_purchase_item_id;
  if purchase_id_value is null then raise exception 'Línea de compra no encontrada.' using errcode = 'P0002'; end if;
  select * into purchase_row from public.purchases p where p.id = purchase_id_value for update;
  select * into item_row from public.purchase_items i where i.id = p_purchase_item_id for update;
  if not found then raise exception 'Línea de compra no encontrada.' using errcode = 'P0002'; end if;
  if purchase_row.status not in ('confirmed', 'partially_received') then
    raise exception 'La compra no está disponible para recepción.' using errcode = '23514';
  end if;
  if item_row.received_quantity + p_quantity > item_row.ordered_quantity then
    raise exception 'La cantidad supera el pendiente de la línea.' using errcode = '23514';
  end if;
  select * into location_row from public.warehouse_locations l where l.id = p_location_id and l.is_active;
  if not found or not exists (
    select 1 from public.warehouses w where w.id = location_row.warehouse_id and w.is_active
  ) then
    raise exception 'Selecciona una ubicación activa.' using errcode = '23514';
  end if;

  movement_result := private.apply_inventory_movement(
    item_row.variant_id, location_row.warehouse_id, location_row.id, 'purchase_entry',
    p_quantity, item_row.unit_cost, null, purchase_row.id, item_row.id,
    null, null, null, btrim(p_idempotency_key), '{}'::jsonb
  );
  update public.purchase_items
  set received_quantity = received_quantity + p_quantity
  where id = item_row.id;

  if not exists (
    select 1 from public.purchase_items i
    where i.purchase_id = purchase_row.id and i.received_quantity < i.ordered_quantity
  ) then next_status := 'received'; else next_status := 'partially_received'; end if;
  update public.purchases set status = next_status where id = purchase_row.id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'purchase_received', 'purchase', purchase_row.id,
    jsonb_build_object('previous_status', purchase_row.status, 'new_status', next_status, 'quantity', p_quantity));
  movement_result := movement_result || jsonb_build_object(
    'purchase_id', purchase_row.id,
    'purchase_item_id', item_row.id,
    'received_quantity', item_row.received_quantity + p_quantity,
    'purchase_status', next_status
  );
  perform private.finish_inventory_command(p_idempotency_key, movement_result);
  return movement_result;
end;
$$;

create or replace function public.remove_transfer_item(p_transfer_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  target public.inventory_transfer_items%rowtype;
begin
  select * into target from public.inventory_transfer_items i where i.id = p_transfer_item_id for update;
  if not found then raise exception 'Línea de transferencia no encontrada.' using errcode = 'P0002'; end if;
  delete from public.inventory_transfer_items where id = target.id;
  return target.transfer_id;
end;
$$;

create or replace function public.confirm_inventory_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  transfer_row public.inventory_transfers%rowtype;
begin
  select * into transfer_row from public.inventory_transfers t where t.id = p_transfer_id for update;
  if not found then raise exception 'Transferencia no encontrada.' using errcode = 'P0002'; end if;
  if transfer_row.status <> 'draft' then
    raise exception 'La transferencia ya no está disponible para confirmar.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.warehouses o, public.warehouses d
    where o.id = transfer_row.origin_warehouse_id and o.is_active
      and d.id = transfer_row.destination_warehouse_id and d.is_active
  ) then raise exception 'Los almacenes deben estar activos.' using errcode = '23514'; end if;
  perform 1 from public.inventory_transfer_items i where i.transfer_id = p_transfer_id order by i.id for update;
  if not found then raise exception 'Agrega al menos una línea antes de confirmar.' using errcode = '23514'; end if;
  perform p.id
  from public.inventory_transfer_items i
  join public.product_variants v on v.id = i.variant_id
  join public.products p on p.id = v.product_id
  where i.transfer_id = p_transfer_id
  order by p.id, v.id
  for share of p, v;
  perform w.id
  from public.warehouses w
  where w.id in (transfer_row.origin_warehouse_id, transfer_row.destination_warehouse_id)
  order by w.id
  for share of w;
  perform l.id
  from public.inventory_transfer_items i
  join public.warehouse_locations l
    on l.id in (i.origin_location_id, i.destination_location_id)
  where i.transfer_id = p_transfer_id
  order by l.id
  for share of l;
  if exists (
    select 1
    from public.inventory_transfer_items i
    left join public.product_variants v on v.id = i.variant_id
    left join public.products p on p.id = v.product_id
    left join public.warehouse_locations o on o.id = i.origin_location_id
    left join public.warehouse_locations d on d.id = i.destination_location_id
    where i.transfer_id = p_transfer_id and (
      not coalesce(v.is_active, false) or not coalesce(p.is_active, false)
      or not coalesce(o.is_active, false) or o.warehouse_id <> transfer_row.origin_warehouse_id
      or not coalesce(d.is_active, false) or d.warehouse_id <> transfer_row.destination_warehouse_id
    )
  ) then raise exception 'Las variantes y ubicaciones deben estar activas.' using errcode = '23514'; end if;
  update public.inventory_transfers
  set status = 'confirmed', confirmed_at = now(), confirmed_by = actor_id
  where id = p_transfer_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'transfer_confirmed', 'inventory_transfer', p_transfer_id,
    jsonb_build_object('previous_status', 'draft', 'new_status', 'confirmed'));
  return p_transfer_id;
end;
$$;

create or replace function public.cancel_inventory_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  transfer_row public.inventory_transfers%rowtype;
begin
  select * into transfer_row from public.inventory_transfers t where t.id = p_transfer_id for update;
  if not found then raise exception 'Transferencia no encontrada.' using errcode = 'P0002'; end if;
  if transfer_row.status not in ('draft', 'confirmed') then
    raise exception 'La transferencia ya no se puede cancelar.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.inventory_transfer_items i
    where i.transfer_id = p_transfer_id and (i.dispatched_quantity > 0 or i.received_quantity > 0)
  ) or exists (select 1 from public.inventory_movements m where m.transfer_id = p_transfer_id) then
    raise exception 'No se puede cancelar una transferencia despachada.' using errcode = '23514';
  end if;
  update public.inventory_transfers set status = 'cancelled' where id = p_transfer_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'transfer_cancelled', 'inventory_transfer', p_transfer_id,
    jsonb_build_object('previous_status', transfer_row.status, 'new_status', 'cancelled'));
  return p_transfer_id;
end;
$$;

create or replace function public.dispatch_inventory_transfer(
  p_transfer_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  replay jsonb;
  transfer_row public.inventory_transfers%rowtype;
  item_row public.inventory_transfer_items%rowtype;
  movement_result jsonb;
  final_result jsonb;
begin
  replay := private.start_inventory_command(
    p_idempotency_key, 'dispatch_inventory_transfer', jsonb_build_object('transfer_id', p_transfer_id)
  );
  if replay is not null then return replay; end if;
  select * into transfer_row from public.inventory_transfers t where t.id = p_transfer_id for update;
  if not found then raise exception 'Transferencia no encontrada.' using errcode = 'P0002'; end if;
  if transfer_row.status <> 'confirmed' then
    raise exception 'La transferencia no está disponible para despacho.' using errcode = '23514';
  end if;

  for item_row in
    select i.* from public.inventory_transfer_items i
    where i.transfer_id = p_transfer_id
    order by i.origin_location_id, i.variant_id, i.id
    for update
  loop
    if item_row.dispatched_quantity <> 0 then
      raise exception 'La transferencia contiene una línea ya despachada.' using errcode = '23514';
    end if;
    movement_result := private.apply_inventory_movement(
      item_row.variant_id, transfer_row.origin_warehouse_id, item_row.origin_location_id,
      'transfer_out', -item_row.requested_quantity, null, null,
      null, null, transfer_row.id, item_row.id, null,
      btrim(p_idempotency_key) || ':' || item_row.id::text, '{}'::jsonb
    );
    update public.inventory_transfer_items
    set dispatched_quantity = requested_quantity where id = item_row.id;
  end loop;
  if not found then raise exception 'La transferencia no tiene líneas.' using errcode = '23514'; end if;

  update public.inventory_transfers
  set status = 'in_transit', dispatched_at = now(), dispatched_by = actor_id
  where id = p_transfer_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'transfer_dispatched', 'inventory_transfer', p_transfer_id,
    jsonb_build_object('previous_status', 'confirmed', 'new_status', 'in_transit'));
  final_result := jsonb_build_object('transfer_id', p_transfer_id, 'transfer_status', 'in_transit');
  perform private.finish_inventory_command(p_idempotency_key, final_result);
  return final_result;
end;
$$;

create or replace function public.receive_inventory_transfer_item(
  p_transfer_item_id uuid,
  p_quantity numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(false);
  replay jsonb;
  transfer_id_value uuid;
  transfer_row public.inventory_transfers%rowtype;
  item_row public.inventory_transfer_items%rowtype;
  outgoing public.inventory_movements%rowtype;
  movement_result jsonb;
  next_status public.transfer_status;
begin
  replay := private.start_inventory_command(
    p_idempotency_key, 'receive_inventory_transfer_item',
    jsonb_build_object('transfer_item_id', p_transfer_item_id, 'quantity', p_quantity)
  );
  if replay is not null then return replay; end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad recibida debe ser mayor que cero.' using errcode = '22023';
  end if;
  select i.transfer_id into transfer_id_value from public.inventory_transfer_items i where i.id = p_transfer_item_id;
  if transfer_id_value is null then raise exception 'Línea de transferencia no encontrada.' using errcode = 'P0002'; end if;
  select * into transfer_row from public.inventory_transfers t where t.id = transfer_id_value for update;
  select * into item_row from public.inventory_transfer_items i where i.id = p_transfer_item_id for update;
  if not found then raise exception 'Línea de transferencia no encontrada.' using errcode = 'P0002'; end if;
  if transfer_row.status not in ('in_transit', 'partially_received') then
    raise exception 'La transferencia no está disponible para recepción.' using errcode = '23514';
  end if;
  if item_row.received_quantity + p_quantity > item_row.dispatched_quantity then
    raise exception 'La cantidad supera el pendiente despachado.' using errcode = '23514';
  end if;
  select * into outgoing from public.inventory_movements m
  where m.transfer_item_id = item_row.id and m.movement_type = 'transfer_out'
  order by m.occurred_at desc limit 1;
  if not found then raise exception 'No se encontró la salida vinculada.' using errcode = '23514'; end if;

  movement_result := private.apply_inventory_movement(
    item_row.variant_id, transfer_row.destination_warehouse_id, item_row.destination_location_id,
    'transfer_in', p_quantity, outgoing.unit_cost_snapshot, null,
    null, null, transfer_row.id, item_row.id, outgoing.id,
    btrim(p_idempotency_key), '{}'::jsonb
  );
  update public.inventory_transfer_items
  set received_quantity = received_quantity + p_quantity where id = item_row.id;

  if not exists (
    select 1 from public.inventory_transfer_items i
    where i.transfer_id = transfer_row.id and i.received_quantity < i.dispatched_quantity
  ) then next_status := 'received'; else next_status := 'partially_received'; end if;
  update public.inventory_transfers
  set status = next_status,
      received_at = case when next_status = 'received' then now() else null end,
      received_by = case when next_status = 'received' then actor_id else null end
  where id = transfer_row.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id,
    case when next_status = 'received' then 'transfer_received' else 'transfer_partially_received' end,
    'inventory_transfer', transfer_row.id,
    jsonb_build_object('previous_status', transfer_row.status, 'new_status', next_status, 'quantity', p_quantity));
  movement_result := movement_result || jsonb_build_object(
    'transfer_id', transfer_row.id, 'transfer_item_id', item_row.id,
    'received_quantity', item_row.received_quantity + p_quantity, 'transfer_status', next_status
  );
  perform private.finish_inventory_command(p_idempotency_key, movement_result);
  return movement_result;
end;
$$;

create or replace function public.adjust_inventory(
  p_variant_id uuid,
  p_location_id uuid,
  p_movement_type public.movement_type,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.assert_inventory_operator(true);
  replay jsonb;
  location_row public.warehouse_locations%rowtype;
  signed_quantity numeric;
  movement_result jsonb;
begin
  replay := private.start_inventory_command(
    p_idempotency_key, 'adjust_inventory',
    jsonb_build_object(
      'variant_id', p_variant_id, 'location_id', p_location_id, 'movement_type', p_movement_type,
      'quantity', p_quantity, 'unit_cost', p_unit_cost, 'reason', nullif(btrim(p_reason), '')
    )
  );
  if replay is not null then return replay; end if;
  if p_movement_type not in ('initial_stock', 'positive_adjustment', 'negative_adjustment', 'damaged', 'lost') then
    raise exception 'Tipo de ajuste no permitido.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'La razón es obligatoria.' using errcode = '22023';
  end if;
  if p_movement_type in ('initial_stock', 'positive_adjustment') and (p_unit_cost is null or p_unit_cost < 0) then
    raise exception 'Las entradas requieren costo unitario.' using errcode = '22023';
  end if;
  select * into location_row from public.warehouse_locations l where l.id = p_location_id and l.is_active;
  if not found then raise exception 'Ubicación no encontrada o inactiva.' using errcode = 'P0002'; end if;
  if p_movement_type = 'initial_stock' and (
    exists (select 1 from public.inventory_movements m where m.variant_id = p_variant_id and m.location_id = p_location_id)
    or exists (
      select 1 from public.inventory_balances b
      where b.variant_id = p_variant_id and b.location_id = p_location_id and b.physical_stock <> 0
    )
  ) then
    raise exception 'El stock inicial solo se registra sin historial previo.' using errcode = '23514';
  end if;
  signed_quantity := case
    when p_movement_type in ('initial_stock', 'positive_adjustment') then p_quantity
    else -p_quantity
  end;
  movement_result := private.apply_inventory_movement(
    p_variant_id, location_row.warehouse_id, location_row.id, p_movement_type,
    signed_quantity, p_unit_cost, p_reason,
    null, null, null, null, null, btrim(p_idempotency_key), '{}'::jsonb
  );
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, 'inventory_adjusted', 'inventory_balance', (movement_result ->> 'balance_id')::uuid,
    jsonb_build_object('movement_type', p_movement_type, 'quantity_delta', signed_quantity));
  perform private.finish_inventory_command(p_idempotency_key, movement_result);
  return movement_result;
end;
$$;

create or replace function public.admin_inventory_reconciliation()
returns table (
  issue_type text,
  balance_id uuid,
  expected_physical numeric,
  actual_physical numeric,
  expected_reserved numeric,
  actual_reserved numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_inventory_operator(true);
  return query
  with movement_totals as (
    select m.balance_id,
      coalesce(sum(m.physical_delta), 0)::numeric as physical,
      coalesce(sum(m.reserved_delta), 0)::numeric as reserved
    from public.inventory_movements m group by m.balance_id
  )
  select 'balance_mismatch'::text, b.id,
    coalesce(t.physical, 0), b.physical_stock,
    coalesce(t.reserved, 0), b.reserved_stock
  from public.inventory_balances b
  left join movement_totals t on t.balance_id = b.id
  where b.physical_stock <> coalesce(t.physical, 0)
     or b.reserved_stock <> coalesce(t.reserved, 0)
  union all
  select 'invalid_balance'::text, b.id,
    b.physical_stock, b.physical_stock, b.reserved_stock, b.reserved_stock
  from public.inventory_balances b
  where b.physical_stock < 0 or b.reserved_stock < 0 or b.reserved_stock > b.physical_stock
  union all
  select 'movement_without_balance'::text, m.balance_id,
    null::numeric, null::numeric, null::numeric, null::numeric
  from public.inventory_movements m
  left join public.inventory_balances b on b.id = m.balance_id
  where b.id is null;
end;
$$;

create trigger purchases_10_prepare_write
before insert or update on public.purchases
for each row execute function private.prepare_operational_write();
create trigger purchases_20_validate
before insert or update on public.purchases
for each row execute function private.prepare_purchase();
create trigger purchases_90_audit
after insert or update on public.purchases
for each row execute function private.audit_purchase_change();

create trigger purchase_items_10_prepare_write
before insert or update on public.purchase_items
for each row execute function private.prepare_operational_write();
create trigger purchase_items_20_validate
before insert or update on public.purchase_items
for each row execute function private.prepare_purchase_item();
create trigger purchase_items_20_guard_delete
before delete on public.purchase_items
for each row execute function private.guard_purchase_item_delete();
create trigger purchase_items_90_after_change
after insert or update or delete on public.purchase_items
for each row execute function private.after_purchase_item_change();

create trigger inventory_transfers_10_prepare_write
before insert or update on public.inventory_transfers
for each row execute function private.prepare_operational_write();
create trigger inventory_transfers_20_validate
before insert or update on public.inventory_transfers
for each row execute function private.prepare_transfer();
create trigger inventory_transfers_90_audit
after insert or update on public.inventory_transfers
for each row execute function private.audit_transfer_change();

create trigger inventory_transfer_items_10_prepare_write
before insert or update on public.inventory_transfer_items
for each row execute function private.prepare_operational_write();
create trigger inventory_transfer_items_20_validate
before insert or update on public.inventory_transfer_items
for each row execute function private.prepare_transfer_item();
create trigger inventory_transfer_items_20_guard_delete
before delete on public.inventory_transfer_items
for each row execute function private.guard_transfer_item_delete();
create trigger inventory_transfer_items_90_audit
after insert or update or delete on public.inventory_transfer_items
for each row execute function private.audit_transfer_item_change();

create trigger inventory_movements_reject_update
before update on public.inventory_movements
for each row execute function private.reject_inventory_movement_mutation();
create trigger inventory_movements_reject_delete
before delete on public.inventory_movements
for each row execute function private.reject_inventory_movement_mutation();

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_items enable row level security;

create policy purchases_select_active_staff on public.purchases
for select to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
);
create policy purchases_insert_active_staff on public.purchases
for insert to authenticated
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and status = 'draft'
);
create policy purchases_update_active_staff on public.purchases
for update to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and status = 'draft'
)
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and status = 'draft'
);

create policy purchase_items_select_active_staff on public.purchase_items
for select to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
);
create policy purchase_items_insert_active_staff on public.purchase_items
for insert to authenticated
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and exists (select 1 from public.purchases p where p.id = purchase_id and p.status = 'draft')
);
create policy purchase_items_update_active_staff on public.purchase_items
for update to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and exists (select 1 from public.purchases p where p.id = purchase_id and p.status = 'draft')
)
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and exists (select 1 from public.purchases p where p.id = purchase_id and p.status = 'draft')
);

create policy inventory_balances_select_active_staff on public.inventory_balances
for select to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
);
create policy inventory_movements_select_active_staff on public.inventory_movements
for select to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
);

create policy inventory_transfers_select_active_staff on public.inventory_transfers
for select to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
);
create policy inventory_transfers_insert_active_staff on public.inventory_transfers
for insert to authenticated
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and status = 'draft'
);
create policy inventory_transfers_update_active_staff on public.inventory_transfers
for update to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and status = 'draft'
)
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and status = 'draft'
);

create policy inventory_transfer_items_select_active_staff on public.inventory_transfer_items
for select to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
);
create policy inventory_transfer_items_insert_active_staff on public.inventory_transfer_items
for insert to authenticated
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and exists (select 1 from public.inventory_transfers t where t.id = transfer_id and t.status = 'draft')
);
create policy inventory_transfer_items_update_active_staff on public.inventory_transfer_items
for update to authenticated
using (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and exists (select 1 from public.inventory_transfers t where t.id = transfer_id and t.status = 'draft')
)
with check (
  (select public.current_user_is_active())
  and (select public.current_user_role()) in ('administrator', 'operator')
  and exists (select 1 from public.inventory_transfers t where t.id = transfer_id and t.status = 'draft')
);

revoke all on table public.purchases, public.purchase_items, public.inventory_balances,
  public.inventory_movements, public.inventory_transfers, public.inventory_transfer_items
  from anon, authenticated;
grant select on table public.purchases, public.purchase_items, public.inventory_balances,
  public.inventory_movements, public.inventory_transfers, public.inventory_transfer_items
  to authenticated;

grant insert (supplier_id, supplier_reference, ordered_at, expected_at, notes)
  on public.purchases to authenticated;
grant update (supplier_id, supplier_reference, ordered_at, expected_at, notes)
  on public.purchases to authenticated;
grant insert (purchase_id, line_number, variant_id, ordered_quantity, unit_cost, tax_amount)
  on public.purchase_items to authenticated;
grant update (line_number, variant_id, ordered_quantity, unit_cost, tax_amount)
  on public.purchase_items to authenticated;

grant insert (origin_warehouse_id, destination_warehouse_id, notes)
  on public.inventory_transfers to authenticated;
grant update (origin_warehouse_id, destination_warehouse_id, notes)
  on public.inventory_transfers to authenticated;
grant insert (transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity)
  on public.inventory_transfer_items to authenticated;
grant update (line_number, variant_id, origin_location_id, destination_location_id, requested_quantity)
  on public.inventory_transfer_items to authenticated;

revoke all on function public.remove_purchase_item(uuid) from public, anon;
revoke all on function public.confirm_purchase(uuid) from public, anon;
revoke all on function public.cancel_purchase(uuid) from public, anon;
revoke all on function public.receive_purchase_item(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.remove_transfer_item(uuid) from public, anon;
revoke all on function public.confirm_inventory_transfer(uuid) from public, anon;
revoke all on function public.cancel_inventory_transfer(uuid) from public, anon;
revoke all on function public.dispatch_inventory_transfer(uuid, text) from public, anon;
revoke all on function public.receive_inventory_transfer_item(uuid, numeric, text) from public, anon;
revoke all on function public.adjust_inventory(uuid, uuid, public.movement_type, numeric, numeric, text, text) from public, anon;
revoke all on function public.admin_inventory_reconciliation() from public, anon;

grant execute on function public.remove_purchase_item(uuid) to authenticated;
grant execute on function public.confirm_purchase(uuid) to authenticated;
grant execute on function public.cancel_purchase(uuid) to authenticated;
grant execute on function public.receive_purchase_item(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.remove_transfer_item(uuid) to authenticated;
grant execute on function public.confirm_inventory_transfer(uuid) to authenticated;
grant execute on function public.cancel_inventory_transfer(uuid) to authenticated;
grant execute on function public.dispatch_inventory_transfer(uuid, text) to authenticated;
grant execute on function public.receive_inventory_transfer_item(uuid, numeric, text) to authenticated;
grant execute on function public.adjust_inventory(uuid, uuid, public.movement_type, numeric, numeric, text, text) to authenticated;
grant execute on function public.admin_inventory_reconciliation() to authenticated;

revoke all on function private.assert_inventory_operator(boolean) from public, anon, authenticated;
revoke all on function private.prepare_operational_write() from public, anon, authenticated;
revoke all on function private.prepare_purchase() from public, anon, authenticated;
revoke all on function private.prepare_purchase_item() from public, anon, authenticated;
revoke all on function private.guard_purchase_item_delete() from public, anon, authenticated;
revoke all on function private.recalculate_purchase_totals(uuid) from public, anon, authenticated;
revoke all on function private.after_purchase_item_change() from public, anon, authenticated;
revoke all on function private.audit_purchase_change() from public, anon, authenticated;
revoke all on function private.prepare_transfer() from public, anon, authenticated;
revoke all on function private.prepare_transfer_item() from public, anon, authenticated;
revoke all on function private.guard_transfer_item_delete() from public, anon, authenticated;
revoke all on function private.audit_transfer_change() from public, anon, authenticated;
revoke all on function private.audit_transfer_item_change() from public, anon, authenticated;
revoke all on function private.reject_inventory_movement_mutation() from public, anon, authenticated;
revoke all on function private.start_inventory_command(text, text, jsonb) from public, anon, authenticated;
revoke all on function private.finish_inventory_command(text, jsonb) from public, anon, authenticated;
revoke all on function private.apply_inventory_movement(
  uuid, uuid, uuid, public.movement_type, numeric, numeric, text,
  uuid, uuid, uuid, uuid, uuid, text, jsonb
) from public, anon, authenticated;
revoke all on function private.normalize_product_variant() from public, anon, authenticated;
revoke all on function private.normalize_warehouse_location() from public, anon, authenticated;
revoke all on function private.normalize_warehouse() from public, anon, authenticated;

commit;
