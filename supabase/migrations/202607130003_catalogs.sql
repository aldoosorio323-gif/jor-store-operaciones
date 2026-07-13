begin;

create extension if not exists pg_trgm with schema extensions;

create type public.location_type as enum (
  'storage',
  'picking',
  'quarantine',
  'in_transit'
);

alter table public.audit_logs
  drop constraint audit_logs_action_allowed,
  add column entity_type text,
  add column entity_id uuid,
  add constraint audit_logs_action_allowed check (
    action in (
      'bootstrap_administrator', 'invite_user', 'role_changed',
      'user_activated', 'user_deactivated', 'password_recovery_completed',
      'product_created', 'product_updated', 'product_activated', 'product_deactivated',
      'variant_created', 'variant_updated', 'variant_activated', 'variant_deactivated',
      'warehouse_created', 'warehouse_updated', 'warehouse_activated', 'warehouse_deactivated',
      'location_created', 'location_updated', 'location_activated', 'location_deactivated',
      'supplier_created', 'supplier_updated', 'supplier_activated', 'supplier_deactivated'
    )
  ),
  add constraint audit_logs_entity_reference_complete check (
    (entity_type is null and entity_id is null)
    or (nullif(btrim(entity_type), '') is not null and entity_id is not null)
  );

create index audit_logs_entity_occurred_idx
  on public.audit_logs (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  brand text,
  category text,
  unit_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_unit_code_not_blank check (btrim(unit_code) <> '')
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  sku text not null,
  name text not null,
  color text,
  attributes jsonb not null default '{}'::jsonb,
  barcode text,
  sale_price numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint product_variants_sku_not_blank check (btrim(sku) <> ''),
  constraint product_variants_name_not_blank check (btrim(name) <> ''),
  constraint product_variants_sale_price_nonnegative check (sale_price >= 0),
  constraint product_variants_attributes_object check (jsonb_typeof(attributes) = 'object'),
  constraint product_variants_barcode_not_blank check (barcode is null or btrim(barcode) <> '')
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint warehouses_code_not_blank check (btrim(code) <> ''),
  constraint warehouses_name_not_blank check (btrim(name) <> '')
);

create table public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  code text not null,
  name text not null,
  location_type public.location_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint warehouse_locations_code_not_blank check (btrim(code) <> ''),
  constraint warehouse_locations_name_not_blank check (btrim(name) <> '')
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  business_name text not null,
  tax_id text,
  contact_name text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  constraint suppliers_code_not_blank check (btrim(code) <> ''),
  constraint suppliers_business_name_not_blank check (btrim(business_name) <> ''),
  constraint suppliers_tax_id_not_blank check (tax_id is null or btrim(tax_id) <> ''),
  constraint suppliers_email_format check (
    email is null or email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
  )
);

create unique index product_variants_sku_unique_idx on public.product_variants (upper(sku));
create unique index product_variants_barcode_unique_idx on public.product_variants (barcode) where barcode is not null;
create unique index warehouses_code_unique_idx on public.warehouses (upper(code));
create unique index warehouse_locations_code_unique_idx on public.warehouse_locations (warehouse_id, upper(code));
create unique index suppliers_code_unique_idx on public.suppliers (upper(code));
create unique index suppliers_tax_id_unique_idx on public.suppliers (tax_id) where tax_id is not null;

create index products_name_search_idx on public.products (lower(name) text_pattern_ops);
create index products_name_trgm_idx on public.products using gin (lower(name) extensions.gin_trgm_ops);
create index products_brand_trgm_idx on public.products using gin (lower(brand) extensions.gin_trgm_ops) where brand is not null;
create index products_category_idx on public.products (lower(category)) where category is not null;
create index products_category_trgm_idx on public.products using gin (lower(category) extensions.gin_trgm_ops) where category is not null;
create index products_status_idx on public.products (is_active, name);
create index product_variants_product_status_idx on public.product_variants (product_id, is_active, name);
create index product_variants_name_search_idx on public.product_variants (lower(name) text_pattern_ops);
create index product_variants_name_trgm_idx on public.product_variants using gin (lower(name) extensions.gin_trgm_ops);
create index product_variants_sku_trgm_idx on public.product_variants using gin (lower(sku) extensions.gin_trgm_ops);
create index product_variants_color_idx on public.product_variants (lower(color)) where color is not null;
create index product_variants_color_trgm_idx on public.product_variants using gin (lower(color) extensions.gin_trgm_ops) where color is not null;
create index warehouses_name_search_idx on public.warehouses (lower(name) text_pattern_ops);
create index warehouses_name_trgm_idx on public.warehouses using gin (lower(name) extensions.gin_trgm_ops);
create index warehouses_code_trgm_idx on public.warehouses using gin (lower(code) extensions.gin_trgm_ops);
create index warehouses_status_idx on public.warehouses (is_active, name);
create index warehouse_locations_warehouse_status_idx on public.warehouse_locations (warehouse_id, is_active, name);
create index suppliers_business_name_search_idx on public.suppliers (lower(business_name) text_pattern_ops);
create index suppliers_business_name_trgm_idx on public.suppliers using gin (lower(business_name) extensions.gin_trgm_ops);
create index suppliers_code_trgm_idx on public.suppliers using gin (lower(code) extensions.gin_trgm_ops);
create index suppliers_status_idx on public.suppliers (is_active, business_name);

create or replace function private.prepare_catalog_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select public.current_user_is_admin()) then
    raise exception 'Acción reservada para administradores activos.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := actor_id;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  new.updated_at := now();
  new.updated_by := actor_id;
  return new;
end;
$$;

create or replace function private.normalize_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.brand := nullif(btrim(new.brand), '');
  new.category := nullif(btrim(new.category), '');
  new.unit_code := upper(btrim(new.unit_code));

  if tg_op = 'UPDATE' and old.is_active and not new.is_active and exists (
    select 1 from public.product_variants v
    where v.product_id = old.id and v.is_active
  ) then
    raise exception 'No se puede desactivar un producto con variantes activas.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.normalize_product_variant()
returns trigger
language plpgsql
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
  return new;
end;
$$;

create or replace function private.normalize_warehouse()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.address := nullif(btrim(new.address), '');

  if tg_op = 'UPDATE' and old.is_active and not new.is_active and exists (
    select 1 from public.warehouse_locations l
    where l.warehouse_id = old.id and l.is_active
  ) then
    raise exception 'No se puede desactivar un almacén con ubicaciones activas.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.normalize_warehouse_location()
returns trigger
language plpgsql
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
  return new;
end;
$$;

create or replace function private.normalize_supplier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.business_name := btrim(new.business_name);
  new.tax_id := nullif(btrim(new.tax_id), '');
  new.contact_name := nullif(btrim(new.contact_name), '');
  new.email := lower(nullif(btrim(new.email), ''));
  new.phone := nullif(btrim(new.phone), '');
  new.notes := nullif(btrim(new.notes), '');
  return new;
end;
$$;

create or replace function private.audit_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_label text := tg_argv[0];
  action_prefix text := tg_argv[1];
  audit_action text;
  target_id uuid;
  safe_metadata jsonb;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;

  if tg_op = 'INSERT' then
    audit_action := action_prefix || '_created';
    safe_metadata := jsonb_build_object('active', new.is_active);
  elsif new.is_active is distinct from old.is_active then
    audit_action := action_prefix || case when new.is_active then '_activated' else '_deactivated' end;
    safe_metadata := jsonb_build_object('previous_active', old.is_active, 'new_active', new.is_active);
  else
    audit_action := action_prefix || '_updated';
    safe_metadata := jsonb_build_object('changed', true);
  end if;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()), audit_action, entity_label, target_id, safe_metadata
  );
  return new;
end;
$$;

create trigger products_prepare_write before insert or update on public.products
for each row execute function private.prepare_catalog_write();
create trigger products_normalize before insert or update on public.products
for each row execute function private.normalize_product();
create trigger products_audit after insert or update on public.products
for each row execute function private.audit_catalog_change('product', 'product');

create trigger product_variants_prepare_write before insert or update on public.product_variants
for each row execute function private.prepare_catalog_write();
create trigger product_variants_normalize before insert or update on public.product_variants
for each row execute function private.normalize_product_variant();
create trigger product_variants_audit after insert or update on public.product_variants
for each row execute function private.audit_catalog_change('product_variant', 'variant');

create trigger warehouses_prepare_write before insert or update on public.warehouses
for each row execute function private.prepare_catalog_write();
create trigger warehouses_normalize before insert or update on public.warehouses
for each row execute function private.normalize_warehouse();
create trigger warehouses_audit after insert or update on public.warehouses
for each row execute function private.audit_catalog_change('warehouse', 'warehouse');

create trigger warehouse_locations_prepare_write before insert or update on public.warehouse_locations
for each row execute function private.prepare_catalog_write();
create trigger warehouse_locations_normalize before insert or update on public.warehouse_locations
for each row execute function private.normalize_warehouse_location();
create trigger warehouse_locations_audit after insert or update on public.warehouse_locations
for each row execute function private.audit_catalog_change('warehouse_location', 'location');

create trigger suppliers_prepare_write before insert or update on public.suppliers
for each row execute function private.prepare_catalog_write();
create trigger suppliers_normalize before insert or update on public.suppliers
for each row execute function private.normalize_supplier();
create trigger suppliers_audit after insert or update on public.suppliers
for each row execute function private.audit_catalog_change('supplier', 'supplier');

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_locations enable row level security;
alter table public.suppliers enable row level security;

create policy products_select_active_or_admin on public.products
for select to authenticated
using ((select public.current_user_is_active()) and (is_active or (select public.current_user_is_admin())));
create policy products_insert_admin on public.products
for insert to authenticated
with check ((select public.current_user_is_admin()));
create policy products_update_admin on public.products
for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy product_variants_select_active_or_admin on public.product_variants
for select to authenticated
using (
  (select public.current_user_is_active()) and (
    (select public.current_user_is_admin())
    or (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active
    ))
  )
);
create policy product_variants_insert_admin on public.product_variants
for insert to authenticated with check ((select public.current_user_is_admin()));
create policy product_variants_update_admin on public.product_variants
for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy warehouses_select_active_or_admin on public.warehouses
for select to authenticated
using ((select public.current_user_is_active()) and (is_active or (select public.current_user_is_admin())));
create policy warehouses_insert_admin on public.warehouses
for insert to authenticated with check ((select public.current_user_is_admin()));
create policy warehouses_update_admin on public.warehouses
for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy warehouse_locations_select_active_or_admin on public.warehouse_locations
for select to authenticated
using (
  (select public.current_user_is_active()) and (
    (select public.current_user_is_admin())
    or (is_active and exists (
      select 1 from public.warehouses w where w.id = warehouse_id and w.is_active
    ))
  )
);
create policy warehouse_locations_insert_admin on public.warehouse_locations
for insert to authenticated with check ((select public.current_user_is_admin()));
create policy warehouse_locations_update_admin on public.warehouse_locations
for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy suppliers_select_active_or_admin on public.suppliers
for select to authenticated
using ((select public.current_user_is_active()) and (is_active or (select public.current_user_is_admin())));
create policy suppliers_insert_admin on public.suppliers
for insert to authenticated with check ((select public.current_user_is_admin()));
create policy suppliers_update_admin on public.suppliers
for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

revoke all on table public.products, public.product_variants, public.warehouses,
  public.warehouse_locations, public.suppliers from anon, authenticated;
grant select, insert, update on table public.products, public.product_variants,
  public.warehouses, public.warehouse_locations, public.suppliers to authenticated;

revoke all on function private.prepare_catalog_write() from public, anon, authenticated;
revoke all on function private.normalize_product() from public, anon, authenticated;
revoke all on function private.normalize_product_variant() from public, anon, authenticated;
revoke all on function private.normalize_warehouse() from public, anon, authenticated;
revoke all on function private.normalize_warehouse_location() from public, anon, authenticated;
revoke all on function private.normalize_supplier() from public, anon, authenticated;
revoke all on function private.audit_catalog_change() from public, anon, authenticated;

commit;
