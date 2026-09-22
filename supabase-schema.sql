-- OZZI Marketplace - Orders, admin roles and shipping settings
-- Run this file in the Supabase SQL Editor.
-- If the orders schema already exists, the statements below are safe to run.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  country_code text not null,
  address text not null,
  notes text,
  payment_method text not null default 'cod',
  status text not null default 'pending'
    check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  total numeric(12,2) not null default 0
    check (total >= 0),
  shipping_cost numeric(12,2) not null default 0
    check (shipping_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  product_image text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);

-- Backward-compatible migration for projects where orders was created before country_code was added.
alter table public.orders
  add column if not exists country_code text default 'EG';

update public.orders
set country_code = 'EG'
where country_code is null;

alter table public.orders
  alter column country_code set default 'EG',
  alter column country_code set not null;

-- Backward-compatible migration for projects where orders was created before order_number was added.
alter table public.orders
  add column if not exists order_number bigint generated always as identity;

create unique index if not exists orders_order_number_uidx
  on public.orders(order_number);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
before update on public.orders
for each row
execute function public.set_orders_updated_at();

-- Admin roles
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('admin','manager')),
  created_at timestamptz not null default now()
);

-- Shipping settings, one row per country.
create table if not exists public.shipping_settings (
  country_code text primary key check (country_code in ('EG','SA','AE','IQ','OM')),
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  free_shipping boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.shipping_settings(country_code, shipping_cost, free_shipping)
values
  ('EG', 0, true),
  ('SA', 0, true),
  ('AE', 0, true),
  ('IQ', 0, true),
  ('OM', 0, true)
on conflict (country_code) do nothing;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_roles enable row level security;
alter table public.shipping_settings enable row level security;

drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders"
on public.orders for select to authenticated
using (auth.uid() = user_id or exists (
  select 1 from public.admin_roles a where a.user_id = auth.uid()
));

drop policy if exists "Users can create their own orders" on public.orders;
create policy "Users can create their own orders"
on public.orders for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders for update to authenticated
using (exists (
  select 1 from public.admin_roles a where a.user_id = auth.uid()
))
with check (exists (
  select 1 from public.admin_roles a where a.user_id = auth.uid()
));

drop policy if exists "Users can view items of their own orders" on public.order_items;
create policy "Users can view items of their own orders"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or exists (
        select 1 from public.admin_roles a where a.user_id = auth.uid()
      ))
  )
);

drop policy if exists "Users can create items for their own orders" on public.order_items;
create policy "Users can create items for their own orders"
on public.order_items for insert to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

-- Admins can manage shipping settings.
drop policy if exists "Admins can view shipping settings" on public.shipping_settings;
create policy "Admins can view shipping settings"
on public.shipping_settings for select to authenticated
using (exists (
  select 1 from public.admin_roles a where a.user_id = auth.uid()
));

drop policy if exists "Admins can update shipping settings" on public.shipping_settings;
create policy "Admins can update shipping settings"
on public.shipping_settings for update to authenticated
using (exists (
  select 1 from public.admin_roles a where a.user_id = auth.uid()
))
with check (exists (
  select 1 from public.admin_roles a where a.user_id = auth.uid()
));

-- Customers may read shipping settings so checkout can calculate shipping.
drop policy if exists "Customers can view shipping settings" on public.shipping_settings;
create policy "Customers can view shipping settings"
on public.shipping_settings for select to authenticated
using (true);

-- Important:
-- Add your own authenticated user to admin_roles from the Supabase SQL Editor:
-- insert into public.admin_roles(user_id, role)
-- select id, 'admin' from auth.users where email = 'YOUR-EMAIL';
