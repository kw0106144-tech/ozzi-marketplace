-- OZZI Marketplace - Orders schema
-- Run this file once in the Supabase SQL Editor.

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

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders"
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own orders" on public.orders;
create policy "Users can create their own orders"
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can view items of their own orders" on public.order_items;
create policy "Users can view items of their own orders"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists "Users can create items for their own orders" on public.order_items;
create policy "Users can create items for their own orders"
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

-- Prevent customers from changing order status or another user's order.
-- Admin/service-role workflows can update orders separately.
