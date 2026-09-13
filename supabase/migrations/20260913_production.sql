create extension if not exists pgcrypto;

-- Production schema for Surae Digital Shop.
-- Canonical money, order, catalog, customer and payment-proof data lives here.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_number text not null unique,
  name text not null,
  email text not null,
  mobile text not null default '',
  credits numeric(12,2) not null default 0 check (credits >= 0),
  status text not null default 'Active' check (status in ('Active','On Hold','Suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','staff','customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  game text not null check (game in ('MLBB','CODM','HOK','VALORANT','ROBLOX')),
  region text not null default 'GLOBAL',
  name text not null,
  category text not null default 'DIGITAL PRODUCT',
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  stock_status text not null default 'Available' check (stock_status in ('Available','Pre-order','Out of Stock')),
  catalog_type text not null default 'regular' check (catalog_type in ('regular','skin-gifting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mlbb_us_skin_gifting_block check (not (game='MLBB' and region='US' and catalog_type='skin-gifting'))
);

create table if not exists public.store_settings (
  singleton boolean primary key default true check (singleton),
  store_online boolean not null default true,
  announcement text not null default '',
  allow_wallet boolean not null default true,
  allow_bank boolean not null default true,
  allow_gcash boolean not null default true,
  allow_paymaya boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.piloting_rates (
  game text not null check (game in ('MLBB','CODM')),
  rank text not null,
  rate numeric(12,4) not null check (rate >= 0),
  unit text not null check (unit in ('star','point')),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(game,rank)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_type text not null check (customer_type in ('guest','registered')),
  customer_name text not null,
  customer_email text not null,
  customer_mobile text not null default '',
  account_number text,
  order_type text not null default 'store-purchase' check (order_type in ('store-purchase','skin-gifting','wallet-topup','piloting','manual')),
  game text not null default 'OTHER',
  region text not null default 'GLOBAL',
  user_info text not null default '',
  product_summary text not null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  payment_method text not null check (payment_method in ('Bank','GCash','PayMaya','Surae Credits','Manual')),
  payment_reference text,
  proof_path text,
  proof_verified boolean not null default false,
  proof_verified_at timestamptz,
  proof_verified_by uuid references auth.users(id) on delete set null,
  status text not null default 'New Order' check (status in ('Awaiting Payment','New Order','Processing','Completed','Cancelled','Rejected')),
  handler text not null default 'Unassigned',
  note text not null default '',
  catalog_type text not null default 'regular',
  client_request_hash text,
  tracking_token_hash text unique,
  tracking_enabled boolean not null default false,
  receipt_email_id text,
  last_status_email_id text,
  wallet_debit_applied boolean not null default false,
  wallet_refund_applied boolean not null default false,
  fulfillment_applied boolean not null default false,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade-safe column addition for installations that ran an earlier migration.
alter table public.orders add column if not exists client_request_hash text;

create unique index if not exists orders_payment_reference_unique
on public.orders (upper(regexp_replace(payment_reference, '[^[:alnum:]]+', '', 'g')))
where payment_reference is not null and btrim(payment_reference) <> '' and payment_method in ('Bank','GCash','PayMaya');

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  name text not null,
  game text not null,
  region text not null,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  catalog_type text not null default 'regular'
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  public_message text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null,
  amount numeric(12,2) not null,
  source text not null default 'System',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.piloting_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  game text not null check (game in ('MLBB','CODM')),
  quote_data jsonb not null,
  quoted_amount numeric(12,2) not null check (quoted_amount >= 0),
  account_payload jsonb not null default '{}'::jsonb,
  signature_path text,
  agreement_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.email_delivery_events (
  id bigint generated always as identity primary key,
  resend_email_id text,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_user_created on public.orders(user_id,created_at desc);
create index if not exists idx_orders_status_created on public.orders(status,created_at desc);
create unique index if not exists orders_client_request_hash_unique on public.orders(client_request_hash) where client_request_hash is not null;
create index if not exists idx_orders_tracking_hash on public.orders(tracking_token_hash);
create index if not exists idx_order_events_order on public.order_events(order_id,created_at);
create index if not exists idx_wallet_user_created on public.wallet_transactions(user_id,created_at desc);
create index if not exists idx_email_resend_id on public.email_delivery_events(resend_email_id);

-- Update timestamps.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- New Auth users automatically receive a customer profile and role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare acct text;
begin
  acct := 'SUR-' || to_char(now(),'YYMM') || '-' || upper(substr(replace(new.id::text,'-',''),1,8));
  insert into public.profiles(user_id,account_number,name,email,mobile)
  values(new.id,acct,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(coalesce(new.email,''),'@',1)),coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'mobile',''))
  on conflict(user_id) do nothing;
  insert into public.user_roles(user_id,role) values(new.id,'customer') on conflict(user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Atomic Surae Credits checkout. Only the service role should invoke this function.
-- Remove the pre-idempotency signature when upgrading an earlier build.
drop function if exists public.create_credit_order(uuid,text,text,text,text,text,text,text,text,text,text,numeric,text,jsonb);
create or replace function public.create_credit_order(
  p_user_id uuid,
  p_invoice_no text,
  p_customer_name text,
  p_customer_email text,
  p_customer_mobile text,
  p_account_number text,
  p_order_type text,
  p_game text,
  p_region text,
  p_user_info text,
  p_product_summary text,
  p_total numeric,
  p_catalog_type text,
  p_client_request_hash text,
  p_items jsonb
) returns public.orders
language plpgsql security definer set search_path=public as $$
declare p public.profiles; o public.orders; item jsonb;
begin
  if p_total <= 0 then raise exception 'INVALID_TOTAL'; end if;
  if coalesce(p_client_request_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST_HASH'; end if;
  select * into p from public.profiles where user_id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if p.status <> 'Active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  -- Re-check idempotency after acquiring the wallet row lock. This prevents two
  -- simultaneous retries from charging the same player twice or returning a
  -- false insufficient-balance error after the first retry committed.
  select * into o from public.orders where client_request_hash=p_client_request_hash and user_id=p_user_id;
  if found then return o; end if;
  if p.credits < p_total then raise exception 'INSUFFICIENT_CREDITS:%', p.credits; end if;

  insert into public.orders(invoice_no,user_id,customer_type,customer_name,customer_email,customer_mobile,account_number,order_type,game,region,user_info,product_summary,total_amount,payment_method,payment_reference,status,handler,note,catalog_type,client_request_hash,wallet_debit_applied)
  values(p_invoice_no,p_user_id,'registered',p_customer_name,p_customer_email,p_customer_mobile,p_account_number,p_order_type,p_game,p_region,p_user_info,p_product_summary,p_total,'Surae Credits','WALLET-'||p_invoice_no,'Processing','Unassigned','Paid in full using Surae Credits. Automatically moved to Processing.',p_catalog_type,p_client_request_hash,true)
  returning * into o;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items(order_id,product_id,name,game,region,quantity,unit_price,subtotal,catalog_type)
    values(o.id,item->>'productId',item->>'name',item->>'game',item->>'region',(item->>'qty')::int,(item->>'unitPrice')::numeric,(item->>'subtotal')::numeric,coalesce(item->>'catalogType','regular'));
  end loop;

  update public.profiles set credits=credits-p_total where user_id=p_user_id;
  insert into public.wallet_transactions(user_id,order_id,type,amount,source,note)
  values(p_user_id,o.id,'Surae Credits Purchase',-p_total,'Checkout',p_product_summary);
  insert into public.order_events(order_id,status,public_message) values(o.id,'Processing','Payment completed with Surae Credits. Your order is now processing.');
  return o;
end $$;

-- Atomic admin status transition / top-up fulfillment / wallet refund.
create or replace function public.admin_apply_order_update(
  p_order_id uuid,
  p_status text,
  p_handler text,
  p_note text,
  p_proof_verified boolean,
  p_actor uuid
) returns public.orders
language plpgsql security definer set search_path=public as $$
declare o public.orders; role_name text; old_status text; old_proof boolean;
begin
  select role into role_name from public.user_roles where user_id=p_actor;
  if role_name not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('Awaiting Payment','New Order','Processing','Completed','Cancelled','Rejected') then raise exception 'INVALID_STATUS'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  old_status := o.status; old_proof := o.proof_verified;

  if o.fulfillment_applied and p_status <> 'Completed' then raise exception 'FULFILLED_ORDER_LOCKED'; end if;
  if o.wallet_refund_applied and p_status not in ('Cancelled','Rejected') then raise exception 'REFUNDED_ORDER_LOCKED'; end if;
  if o.status in ('Cancelled','Rejected') and p_status <> o.status then raise exception 'TERMINAL_ORDER_LOCKED'; end if;
  if o.payment_method='Surae Credits' and p_status in ('Awaiting Payment','New Order') then raise exception 'INVALID_CREDIT_STATUS'; end if;
  if p_proof_verified and coalesce(btrim(o.proof_path),'')='' then raise exception 'PROOF_MISSING'; end if;
  if o.payment_method in ('Bank','GCash','PayMaya') and p_status in ('Processing','Completed') and not p_proof_verified then
    raise exception 'PAYMENT_NOT_VERIFIED';
  end if;

  if p_proof_verified and not o.proof_verified then
    update public.orders set proof_verified=true,proof_verified_at=now(),proof_verified_by=p_actor where id=o.id;
  elsif not p_proof_verified and o.proof_verified and not o.fulfillment_applied then
    update public.orders set proof_verified=false,proof_verified_at=null,proof_verified_by=null where id=o.id;
  end if;

  if p_status='Completed' and o.order_type='wallet-topup' and not o.fulfillment_applied then
    if o.user_id is null then raise exception 'TOPUP_ACCOUNT_MISSING'; end if;
    update public.profiles set credits=credits+o.total_amount where user_id=o.user_id;
    insert into public.wallet_transactions(user_id,order_id,type,amount,source,note)
    values(o.user_id,o.id,'Wallet Top-Up',o.total_amount,'Admin',o.invoice_no);
    update public.orders set fulfillment_applied=true,fulfilled_at=now() where id=o.id;
  elsif p_status in ('Cancelled','Rejected') and o.payment_method='Surae Credits' and o.wallet_debit_applied and not o.wallet_refund_applied then
    update public.profiles set credits=credits+o.total_amount where user_id=o.user_id;
    insert into public.wallet_transactions(user_id,order_id,type,amount,source,note)
    values(o.user_id,o.id,'Surae Credits Refund',o.total_amount,'System','Refund for '||o.invoice_no);
    update public.orders set wallet_refund_applied=true where id=o.id;
  elsif p_status='Completed' and o.order_type <> 'wallet-topup' and not o.fulfillment_applied then
    update public.orders set fulfillment_applied=true,fulfilled_at=now() where id=o.id;
  end if;

  update public.orders set status=p_status,handler=coalesce(nullif(p_handler,''),handler),note=coalesce(p_note,note) where id=o.id returning * into o;
  if p_proof_verified and not old_proof then
    insert into public.order_events(order_id,status,public_message,actor_user_id)
    values(o.id,'Payment Verified','Your payment has been verified.',p_actor);
  end if;
  if p_status <> old_status then
    insert into public.order_events(order_id,status,public_message,actor_user_id)
    values(o.id,p_status,
      case p_status when 'New Order' then 'Order received.' when 'Processing' then 'Your order is being processed.' when 'Completed' then 'Your order has been completed.' when 'Cancelled' then 'Your order was cancelled.' when 'Rejected' then 'Your order was rejected.' else 'Order status updated.' end,
      p_actor);
  end if;
  return o;
end $$;

-- RLS. All sensitive writes go through Edge Functions/service role.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.piloting_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.piloting_agreements enable row level security;
alter table public.email_delivery_events enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (user_id=auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists products_public_select on public.products;
create policy products_public_select on public.products for select to anon,authenticated using (active=true);
drop policy if exists settings_public_select on public.store_settings;
create policy settings_public_select on public.store_settings for select to anon,authenticated using (true);
drop policy if exists rates_public_select on public.piloting_rates;
create policy rates_public_select on public.piloting_rates for select to anon,authenticated using (true);

drop policy if exists orders_self_select on public.orders;
create policy orders_self_select on public.orders for select to authenticated using (user_id=auth.uid());
drop policy if exists items_self_select on public.order_items;
create policy items_self_select on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists events_self_select on public.order_events;
create policy events_self_select on public.order_events for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists wallet_self_select on public.wallet_transactions;
create policy wallet_self_select on public.wallet_transactions for select to authenticated using (user_id=auth.uid());

-- Prevent customers from changing money/status via the broad profile UPDATE policy.
-- Column privileges restrict them to profile contact fields only.
revoke update on public.profiles from authenticated;
grant update(name,mobile) on public.profiles to authenticated;
grant select on public.profiles,public.products,public.store_settings,public.piloting_rates,public.orders,public.order_items,public.order_events,public.wallet_transactions to authenticated;
grant select on public.products,public.store_settings,public.piloting_rates to anon;

-- Private proof bucket. Files are only written/read through Edge Functions.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('piloting-signatures','piloting-signatures',false,1048576,array['image/png'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/png'];

-- Seed piloting rates.
insert into public.piloting_rates(game,rank,rate,unit,sort_order) values
('MLBB','Warrior',8,'star',1),('MLBB','Elite',10,'star',2),('MLBB','Master',12,'star',3),('MLBB','Grandmaster',15,'star',4),('MLBB','Epic',20,'star',5),('MLBB','Legend',25,'star',6),('MLBB','Mythic',30,'star',7),('MLBB','Mythical Honor',35,'star',8),('MLBB','Mythical Glory',45,'star',9),('MLBB','Mythical Immortal',60,'star',10),
('CODM','Rookie',0.10,'point',1),('CODM','Veteran',0.12,'point',2),('CODM','Elite',0.15,'point',3),('CODM','Pro',0.18,'point',4),('CODM','Master',0.22,'point',5),('CODM','Grandmaster',0.28,'point',6),('CODM','Legendary',0.35,'point',7)
on conflict(game,rank) do nothing;


-- Seed the existing storefront catalog. Admin can set live prices after deployment.
insert into public.products(id,game,region,name,category,description,price,active,stock_status,catalog_type) values
('PRD-0001','MLBB','PH','Weekly Diamond Pass','PASS','Philippines server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0002','MLBB','PH','Twilight Pass','PASS','Philippines server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0003','MLBB','PH','56 Diamonds','DIAMONDS','Philippines server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0004','MLBB','PH','112 Diamonds','DIAMONDS','Philippines server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0005','MLBB','PH','257 Diamonds','DIAMONDS','Philippines server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0006','MLBB','PH','571 Diamonds','DIAMONDS','Philippines server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0007','MLBB','PH','1,192 Diamonds','DIAMONDS','Philippines server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0008','MLBB','PH','2,398 Diamonds','DIAMONDS','Philippines server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0009','MLBB','ID','Weekly Diamond Pass','PASS','Indonesia server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0010','MLBB','ID','Twilight Pass','PASS','Indonesia server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0011','MLBB','ID','56 Diamonds','DIAMONDS','Indonesia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0012','MLBB','ID','112 Diamonds','DIAMONDS','Indonesia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0013','MLBB','ID','257 Diamonds','DIAMONDS','Indonesia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0014','MLBB','ID','571 Diamonds','DIAMONDS','Indonesia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0015','MLBB','ID','1,192 Diamonds','DIAMONDS','Indonesia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0016','MLBB','ID','2,398 Diamonds','DIAMONDS','Indonesia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0017','MLBB','MY','Weekly Diamond Pass','PASS','Malaysia server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0018','MLBB','MY','Twilight Pass','PASS','Malaysia server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0019','MLBB','MY','56 Diamonds','DIAMONDS','Malaysia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0020','MLBB','MY','112 Diamonds','DIAMONDS','Malaysia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0021','MLBB','MY','257 Diamonds','DIAMONDS','Malaysia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0022','MLBB','MY','571 Diamonds','DIAMONDS','Malaysia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0023','MLBB','MY','1,192 Diamonds','DIAMONDS','Malaysia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0024','MLBB','MY','2,398 Diamonds','DIAMONDS','Malaysia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0025','MLBB','SG','Weekly Diamond Pass','PASS','Singapore server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0026','MLBB','SG','Twilight Pass','PASS','Singapore server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0027','MLBB','SG','56 Diamonds','DIAMONDS','Singapore server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0028','MLBB','SG','112 Diamonds','DIAMONDS','Singapore server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0029','MLBB','SG','257 Diamonds','DIAMONDS','Singapore server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0030','MLBB','SG','571 Diamonds','DIAMONDS','Singapore server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0031','MLBB','SG','1,192 Diamonds','DIAMONDS','Singapore server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0032','MLBB','SG','2,398 Diamonds','DIAMONDS','Singapore server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0033','MLBB','US','Weekly Diamond Pass','PASS','United States server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0034','MLBB','US','Twilight Pass','PASS','United States server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0035','MLBB','US','56 Diamonds','DIAMONDS','United States server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0036','MLBB','US','112 Diamonds','DIAMONDS','United States server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0037','MLBB','US','257 Diamonds','DIAMONDS','United States server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0038','MLBB','US','571 Diamonds','DIAMONDS','United States server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0039','MLBB','US','1,192 Diamonds','DIAMONDS','United States server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0040','MLBB','US','2,398 Diamonds','DIAMONDS','United States server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0041','MLBB','BR','Weekly Diamond Pass','PASS','Brazil server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0042','MLBB','BR','Twilight Pass','PASS','Brazil server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0043','MLBB','BR','56 Diamonds','DIAMONDS','Brazil server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0044','MLBB','BR','112 Diamonds','DIAMONDS','Brazil server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0045','MLBB','BR','257 Diamonds','DIAMONDS','Brazil server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0046','MLBB','BR','571 Diamonds','DIAMONDS','Brazil server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0047','MLBB','BR','1,192 Diamonds','DIAMONDS','Brazil server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0048','MLBB','BR','2,398 Diamonds','DIAMONDS','Brazil server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0049','MLBB','RU','Weekly Diamond Pass','PASS','Russia server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0050','MLBB','RU','Twilight Pass','PASS','Russia server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0051','MLBB','RU','56 Diamonds','DIAMONDS','Russia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0052','MLBB','RU','112 Diamonds','DIAMONDS','Russia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0053','MLBB','RU','257 Diamonds','DIAMONDS','Russia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0054','MLBB','RU','571 Diamonds','DIAMONDS','Russia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0055','MLBB','RU','1,192 Diamonds','DIAMONDS','Russia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0056','MLBB','RU','2,398 Diamonds','DIAMONDS','Russia server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0057','MLBB','TR','Weekly Diamond Pass','PASS','Turkey server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0058','MLBB','TR','Twilight Pass','PASS','Turkey server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0059','MLBB','TR','56 Diamonds','DIAMONDS','Turkey server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0060','MLBB','TR','112 Diamonds','DIAMONDS','Turkey server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0061','MLBB','TR','257 Diamonds','DIAMONDS','Turkey server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0062','MLBB','TR','571 Diamonds','DIAMONDS','Turkey server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0063','MLBB','TR','1,192 Diamonds','DIAMONDS','Turkey server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0064','MLBB','TR','2,398 Diamonds','DIAMONDS','Turkey server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0065','MLBB','GLOBAL','Weekly Diamond Pass','PASS','Global server. Weekly Diamond Pass.',0.0,true,'Available','regular'),
('PRD-0066','MLBB','GLOBAL','Twilight Pass','PASS','Global server. Twilight Pass.',0.0,true,'Available','regular'),
('PRD-0067','MLBB','GLOBAL','56 Diamonds','DIAMONDS','Global server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0068','MLBB','GLOBAL','112 Diamonds','DIAMONDS','Global server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0069','MLBB','GLOBAL','257 Diamonds','DIAMONDS','Global server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0070','MLBB','GLOBAL','571 Diamonds','DIAMONDS','Global server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0071','MLBB','GLOBAL','1,192 Diamonds','DIAMONDS','Global server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0072','MLBB','GLOBAL','2,398 Diamonds','DIAMONDS','Global server. Mobile Legends diamond package.',0.0,true,'Available','regular'),
('PRD-0073','CODM','GLOBAL','80 CP','CP','Call of Duty Mobile CP package.',0.0,true,'Available','regular'),
('PRD-0074','CODM','GLOBAL','420 CP','CP','Call of Duty Mobile CP package.',0.0,true,'Available','regular'),
('PRD-0075','CODM','GLOBAL','880 CP','CP','Call of Duty Mobile CP package.',0.0,true,'Available','regular'),
('PRD-0076','CODM','GLOBAL','2400 CP','CP','Call of Duty Mobile CP package.',0.0,true,'Available','regular'),
('PRD-0077','CODM','GLOBAL','5000 CP','CP','Call of Duty Mobile CP package.',0.0,true,'Available','regular'),
('PRD-0078','CODM','GLOBAL','Account Piloting','SERVICE','CODM account piloting service.',0.0,true,'Available','regular'),
('PRD-0079','VALORANT','GLOBAL','475 VP','VP','Valorant Points package.',0.0,true,'Available','regular'),
('PRD-0080','VALORANT','GLOBAL','1,000 VP','VP','Valorant Points package.',0.0,true,'Available','regular'),
('PRD-0081','VALORANT','GLOBAL','2,050 VP','VP','Valorant Points package.',0.0,true,'Available','regular'),
('PRD-0082','VALORANT','GLOBAL','3,650 VP','VP','Valorant Points package.',0.0,true,'Available','regular'),
('PRD-0083','VALORANT','GLOBAL','5,350 VP','VP','Valorant Points package.',0.0,true,'Available','regular'),
('PRD-0084','VALORANT','GLOBAL','Custom VP Order','CUSTOM','Custom Valorant Points order.',0.0,true,'Available','regular'),
('PRD-0085','ROBLOX','GLOBAL','80 Robux','ROBUX','Robux top-up package.',0.0,true,'Available','regular'),
('PRD-0086','ROBLOX','GLOBAL','400 Robux','ROBUX','Robux top-up package.',0.0,true,'Available','regular'),
('PRD-0087','ROBLOX','GLOBAL','800 Robux','ROBUX','Robux top-up package.',0.0,true,'Available','regular'),
('PRD-0088','ROBLOX','GLOBAL','1,700 Robux','ROBUX','Robux top-up package.',0.0,true,'Available','regular'),
('PRD-0089','ROBLOX','GLOBAL','4,500 Robux','ROBUX','Robux top-up package.',0.0,true,'Available','regular'),
('PRD-0090','ROBLOX','GLOBAL','Custom Order','CUSTOM','Custom Roblox digital product.',0.0,true,'Available','regular'),
('PRD-0091','HOK','GLOBAL','80 Tokens','TOKENS','Honor of Kings token package.',0.0,true,'Available','regular'),
('PRD-0092','HOK','GLOBAL','240 Tokens','TOKENS','Honor of Kings token package.',0.0,true,'Available','regular'),
('PRD-0093','HOK','GLOBAL','400 Tokens','TOKENS','Honor of Kings token package.',0.0,true,'Available','regular'),
('PRD-0094','HOK','GLOBAL','800 Tokens','TOKENS','Honor of Kings token package.',0.0,true,'Available','regular'),
('PRD-0096','HOK','GLOBAL','Custom Order','CUSTOM','Custom Honor of Kings order.',0.0,true,'Available','regular')
on conflict(id) do nothing;

create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount numeric,
  p_reason text,
  p_actor uuid
) returns public.profiles
language plpgsql security definer set search_path=public as $$
declare p public.profiles; role_name text; next_balance numeric;
begin
  select role into role_name from public.user_roles where user_id=p_actor;
  if role_name not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  if p_amount=0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into p from public.profiles where user_id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  next_balance := p.credits + p_amount;
  if next_balance < 0 then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.profiles set credits=next_balance where user_id=p_user_id returning * into p;
  insert into public.wallet_transactions(user_id,type,amount,source,note) values(p_user_id,'Admin Adjustment',p_amount,'Admin',coalesce(p_reason,'Manual adjustment'));
  return p;
end $$;

-- Atomic external-payment order creation. Proof is uploaded first; order + items + event
-- are committed in one database transaction. If this RPC fails, the Edge Function
-- deletes the uploaded proof file.
-- Remove the pre-idempotency signature when upgrading an earlier build.
drop function if exists public.create_external_order(text,uuid,text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,text,boolean,jsonb);
create or replace function public.create_external_order(
  p_invoice_no text,
  p_user_id uuid,
  p_customer_type text,
  p_customer_name text,
  p_customer_email text,
  p_customer_mobile text,
  p_account_number text,
  p_order_type text,
  p_game text,
  p_region text,
  p_user_info text,
  p_product_summary text,
  p_total numeric,
  p_payment_method text,
  p_payment_reference text,
  p_proof_path text,
  p_catalog_type text,
  p_client_request_hash text,
  p_tracking_token_hash text,
  p_tracking_enabled boolean,
  p_items jsonb
) returns public.orders
language plpgsql security definer set search_path=public as $$
declare o public.orders; item jsonb;
begin
  if p_total <= 0 then raise exception 'INVALID_TOTAL'; end if;
  if coalesce(p_client_request_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST_HASH'; end if;
  if p_customer_type not in ('guest','registered') then raise exception 'INVALID_CUSTOMER_TYPE'; end if;
  if p_order_type not in ('store-purchase','skin-gifting','wallet-topup') then raise exception 'INVALID_ORDER_TYPE'; end if;
  if p_payment_method not in ('Bank','GCash','PayMaya') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if coalesce(btrim(p_payment_reference),'')='' then raise exception 'REFERENCE_REQUIRED'; end if;
  if coalesce(btrim(p_proof_path),'')='' then raise exception 'PROOF_REQUIRED'; end if;

  insert into public.orders(
    invoice_no,user_id,customer_type,customer_name,customer_email,customer_mobile,account_number,
    order_type,game,region,user_info,product_summary,total_amount,payment_method,payment_reference,
    proof_path,proof_verified,status,handler,note,catalog_type,client_request_hash,tracking_token_hash,tracking_enabled
  ) values(
    p_invoice_no,p_user_id,p_customer_type,p_customer_name,p_customer_email,p_customer_mobile,nullif(p_account_number,''),
    p_order_type,p_game,p_region,p_user_info,p_product_summary,p_total,p_payment_method,p_payment_reference,
    p_proof_path,false,'New Order','Unassigned',p_payment_method||' payment submitted; awaiting Admin verification.',
    p_catalog_type,p_client_request_hash,p_tracking_token_hash,p_tracking_enabled
  ) returning * into o;

  for item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.order_items(order_id,product_id,name,game,region,quantity,unit_price,subtotal,catalog_type)
    values(o.id,nullif(item->>'productId',''),item->>'name',item->>'game',item->>'region',(item->>'qty')::int,(item->>'unitPrice')::numeric,(item->>'subtotal')::numeric,coalesce(item->>'catalogType','regular'));
  end loop;

  insert into public.order_events(order_id,status,public_message)
  values(o.id,'New Order','Order received and awaiting payment verification.');
  return o;
end $$;


-- SECURITY: these SECURITY DEFINER RPCs are backend-internal. PostgreSQL grants
-- EXECUTE to PUBLIC by default, so explicitly remove browser roles and grant
-- only the Supabase service role used by trusted Edge Functions.
revoke all on function public.create_credit_order(uuid,text,text,text,text,text,text,text,text,text,text,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_credit_order(uuid,text,text,text,text,text,text,text,text,text,text,numeric,text,text,jsonb) to service_role;
revoke all on function public.create_external_order(text,uuid,text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.create_external_order(text,uuid,text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,text,text,boolean,jsonb) to service_role;
revoke all on function public.admin_apply_order_update(uuid,text,text,text,boolean,uuid) from public, anon, authenticated;
grant execute on function public.admin_apply_order_update(uuid,text,text,text,boolean,uuid) to service_role;
revoke all on function public.admin_adjust_credits(uuid,numeric,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_credits(uuid,numeric,text,uuid) to service_role;

-- Trigger helpers are not API endpoints.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
