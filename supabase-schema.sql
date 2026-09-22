-- OZZI Marketplace - Orders, admin roles, shipping and products
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  country_code text not null default 'EG',
  address text not null,
  notes text,
  payment_method text not null default 'cod',
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  total numeric(12,2) not null default 0 check (total >= 0),
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists order_number bigint generated always as identity;
alter table public.orders add column if not exists country_code text default 'EG';
update public.orders set country_code='EG' where country_code is null;
alter table public.orders alter column country_code set default 'EG', alter column country_code set not null;
create unique index if not exists orders_order_number_uidx on public.orders(order_number);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

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
create index if not exists order_items_order_id_idx on public.order_items(order_id);

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','manager')),
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_settings (
  country_code text primary key check (country_code in ('EG','SA','AE','IQ','OM')),
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  free_shipping boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.shipping_settings(country_code,shipping_cost,free_shipping) values
('EG',0,true),('SA',0,true),('AE',0,true),('IQ',0,true),('OM',0,true)
on conflict (country_code) do nothing;

-- Product catalog.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'عام',
  sku text unique,
  image_url text,
  price numeric(12,2) not null default 0 check (price >= 0),
  country_code text not null default 'EG' check (country_code in ('EG','SA','AE','IQ','OM')),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility with older OZZI product tables.
alter table public.products add column if not exists seller_name text;
alter table public.products add column if not exists original_price numeric(12,2);
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists ozzi_special_offer boolean not null default false;
create index if not exists products_featured_idx on public.products(country_code, featured, active);
create index if not exists products_special_offer_idx on public.products(country_code, ozzi_special_offer, active);
update public.products set original_price = null where original_price is not null and original_price <= price;
alter table public.products add constraint products_original_price_check check (original_price is null or original_price >= price);
alter table public.products add column if not exists name_ar text;
update public.products set name_ar = name where name_ar is null;
alter table public.products alter column name_ar set not null;
alter table public.products add column if not exists price numeric(12,2) default 0;
alter table public.products add column if not exists country_code text default 'EG';
alter table public.products alter column price set default 0;
alter table public.products alter column country_code set default 'EG';
alter table public.products alter column country_code set not null;
alter table public.products alter column price set not null;
-- Legacy marketplace columns are no longer required for OZZI single-store products.
alter table public.products alter column seller_id drop not null;
alter table public.products alter column country_id drop not null;


-- Legacy product_prices table is kept for backward compatibility; new products use products.price + products.country_code.
-- Country-specific product prices and availability.
create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  country_code text not null check (country_code in ('EG','SA','AE','IQ','OM')),
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  unique(product_id,country_code)
);
create index if not exists product_prices_product_id_idx on public.product_prices(product_id);
create index if not exists product_prices_country_idx on public.product_prices(country_code);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_roles enable row level security;
alter table public.shipping_settings enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;

drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders" on public.orders for select to authenticated using (
  auth.uid()=user_id or exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Users can create their own orders" on public.orders;
create policy "Users can create their own orders" on public.orders for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
) with check (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);

drop policy if exists "Users can view items of their own orders" on public.order_items;
create policy "Users can view items of their own orders" on public.order_items for select to authenticated using (
  exists(select 1 from public.orders o where o.id=order_items.order_id and
    (o.user_id=auth.uid() or exists(select 1 from public.admin_roles a where a.user_id=auth.uid())))
);
drop policy if exists "Users can create items for their own orders" on public.order_items;
create policy "Users can create items for their own orders" on public.order_items for insert to authenticated with check (
  exists(select 1 from public.orders o where o.id=order_items.order_id and o.user_id=auth.uid())
);

drop policy if exists "Admins can view shipping settings" on public.shipping_settings;
create policy "Admins can view shipping settings" on public.shipping_settings for select to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Admins can update shipping settings" on public.shipping_settings;
create policy "Admins can update shipping settings" on public.shipping_settings for update to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
) with check (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Customers can view shipping settings" on public.shipping_settings;
create policy "Customers can view shipping settings" on public.shipping_settings for select to authenticated using (true);

-- Public storefront can read active products/prices; only admins can write.
drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products" on public.products for select to authenticated using (active=true or exists(
  select 1 from public.admin_roles a where a.user_id=auth.uid()
));
drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated with check (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products for update to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
) with check (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products for delete to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);

drop policy if exists "Anyone can view active product prices" on public.product_prices;
create policy "Anyone can view active product prices" on public.product_prices for select to authenticated using (
  active=true or exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Admins can insert product prices" on public.product_prices;
create policy "Admins can insert product prices" on public.product_prices for insert to authenticated with check (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Admins can update product prices" on public.product_prices;
create policy "Admins can update product prices" on public.product_prices for update to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
) with check (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);
drop policy if exists "Admins can delete product prices" on public.product_prices;
create policy "Admins can delete product prices" on public.product_prices for delete to authenticated using (
  exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);

drop policy if exists "Admins can view their own role" on public.admin_roles;
create policy "Admins can view their own role" on public.admin_roles for select to authenticated using (user_id=auth.uid());

-- Add your admin user if needed:
-- insert into public.admin_roles(user_id,role) select id,'admin' from auth.users where email='YOUR-EMAIL'
-- on conflict(user_id) do update set role='admin';


-- Seller / supplier management.
create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sellers_name_idx on public.sellers(name);
alter table public.products add column if not exists seller_id uuid;
alter table public.products drop constraint if exists products_seller_id_fkey;
alter table public.products add constraint products_seller_id_fkey foreign key (seller_id) references public.sellers(id) on delete set null;
alter table public.sellers enable row level security;
drop policy if exists "Admins can view sellers" on public.sellers;
create policy "Admins can view sellers" on public.sellers for select to authenticated using (exists(select 1 from public.admin_roles a where a.user_id=auth.uid() and a.role in ('admin','manager')));
drop policy if exists "Admins can insert sellers" on public.sellers;
create policy "Admins can insert sellers" on public.sellers for insert to authenticated with check (exists(select 1 from public.admin_roles a where a.user_id=auth.uid() and a.role in ('admin','manager')));
drop policy if exists "Admins can update sellers" on public.sellers;
create policy "Admins can update sellers" on public.sellers for update to authenticated using (exists(select 1 from public.admin_roles a where a.user_id=auth.uid() and a.role in ('admin','manager'))) with check (exists(select 1 from public.admin_roles a where a.user_id=auth.uid() and a.role in ('admin','manager')));
drop policy if exists "Admins can delete sellers" on public.sellers;
create policy "Admins can delete sellers" on public.sellers for delete to authenticated using (exists(select 1 from public.admin_roles a where a.user_id=auth.uid() and a.role in ('admin','manager')));


-- Public storefront read access for guests.
-- Products and product images are public catalog data; only admins can write.
drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products"
on public.products for select
to anon, authenticated
using (
  active = true
  or exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);

drop policy if exists "Anyone can view active product prices" on public.product_prices;
create policy "Anyone can view active product prices"
on public.product_prices for select
to anon, authenticated
using (
  active = true
  or exists(select 1 from public.admin_roles a where a.user_id=auth.uid())
);

drop policy if exists "Anyone can view product images" on public.product_images;
create policy "Anyone can view product images"
on public.product_images for select
to anon, authenticated
using (true);
