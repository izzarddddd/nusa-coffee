-- Nusa Coffee v1: green coffee catalog (Arabica / Robusta) + sample & RFQ requests (single seller)
-- Run in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- Fixes carried over from the Nusa Vanilla review:
--   * idempotency replay is bound to the same email (no cross-buyer leak)
--   * lookup rate limit is per (RFQ number + email), so a stranger cannot lock the real owner out
--   * attempts table is pruned on every call
--   * no pg_sleep (it held a DB connection per call)
--   * per-email and global throttles on create_inquiry (Turnstile/Edge Function is still a TODO)

-- ───────── Admin ─────────
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

drop policy if exists "admin read admins" on admins;
create policy "admin read admins" on admins for select using (user_id = auth.uid());

-- ───────── Products (soft-delete), one row per lot ─────────
create table if not exists coffee_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  lot_code text,
  species text not null check (species in ('ARABICA','ROBUSTA')),
  process text check (process in ('WASHED','NATURAL','HONEY','SEMI_WASHED','OTHER')),
  variety text,
  grade text,
  cupping_score numeric(4,1) check (cupping_score is null or (cupping_score >= 0 and cupping_score <= 100)),
  moisture_percentage numeric(4,1) check (moisture_percentage is null or (moisture_percentage >= 0 and moisture_percentage <= 100)),
  screen_size text,
  origin text,
  eudr_ready boolean not null default false,
  name_en text not null,
  name_id text,
  description_en text,
  description_id text,
  price_per_kg numeric(12,2) not null check (price_per_kg > 0),
  moq_kg numeric(12,2) not null default 1 check (moq_kg >= 1),
  stock_kg numeric(12,2) not null default 0 check (stock_kg >= 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','OUT_OF_STOCK','ARCHIVED')),
  image_url text,
  is_sample_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists coffee_products_slug_active on coffee_products (slug) where deleted_at is null;
create index if not exists coffee_products_status on coffee_products (status);

-- ───────── Requests: sample or RFQ ─────────
create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_number text not null unique,
  kind text not null check (kind in ('SAMPLE','RFQ')),
  product_id uuid not null references coffee_products(id) on delete restrict on update cascade,
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  country text not null,
  quantity_kg numeric(12,2) not null check (quantity_kg > 0),
  incoterm text check (incoterm in ('EXW','FOB','CFR','CIF')),
  destination_port text,
  price_snapshot_at_inquiry numeric(12,2) not null,
  notes text,
  lang text not null default 'en' check (lang in ('en','id')),
  status text not null default 'PENDING' check (status in ('PENDING','SAMPLE_SENT','QUOTED','CONFIRMED','CANCELLED')),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_product_id on inquiries (product_id);
create index if not exists inquiries_status on inquiries (status);
create index if not exists inquiries_email_created on inquiries (lower(email), created_at);

create table if not exists rfq_lookup_attempts (
  inquiry_number text not null,
  email text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists rfq_lookup_attempts_idx on rfq_lookup_attempts (inquiry_number, email, attempted_at);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists coffee_products_touch on coffee_products;
create trigger coffee_products_touch before update on coffee_products for each row execute function touch_updated_at();
drop trigger if exists inquiries_touch on inquiries;
create trigger inquiries_touch before update on inquiries for each row execute function touch_updated_at();

-- Status flow:
--   PENDING     -> SAMPLE_SENT | QUOTED | CANCELLED
--   SAMPLE_SENT -> QUOTED | CANCELLED
--   QUOTED      -> CONFIRMED | CANCELLED
--   CONFIRMED   -> CANCELLED
create or replace function inquiry_status_guard() returns trigger language plpgsql as $$
begin
  if new.status <> old.status and not (
    (old.status = 'PENDING'     and new.status in ('SAMPLE_SENT','QUOTED','CANCELLED')) or
    (old.status = 'SAMPLE_SENT' and new.status in ('QUOTED','CANCELLED')) or
    (old.status = 'QUOTED'      and new.status in ('CONFIRMED','CANCELLED')) or
    (old.status = 'CONFIRMED'   and new.status = 'CANCELLED')
  ) then
    raise exception 'Status transition % -> % is not allowed', old.status, new.status using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists inquiries_status_guard on inquiries;
create trigger inquiries_status_guard before update on inquiries for each row execute function inquiry_status_guard();

-- ───────── RLS (policies are dropped and recreated so re-runs apply changes) ─────────
alter table coffee_products    enable row level security;
alter table inquiries          enable row level security;
alter table rfq_lookup_attempts enable row level security;

drop policy if exists "public read active products" on coffee_products;
create policy "public read active products" on coffee_products for select
  using ((deleted_at is null and status <> 'ARCHIVED') or is_admin());
drop policy if exists "admin write products" on coffee_products;
create policy "admin write products" on coffee_products for all using (is_admin()) with check (is_admin());
drop policy if exists "admin all inquiries" on inquiries;
create policy "admin all inquiries" on inquiries for all using (is_admin()) with check (is_admin());
-- No anon policy on inquiries / rfq_lookup_attempts: buyers only go through the functions below.

-- ───────── Public RPC: create a request ─────────
create or replace function create_inquiry(
  p_kind text, p_product_id uuid, p_company_name text, p_contact_name text, p_email text, p_phone text,
  p_country text, p_quantity_kg numeric, p_incoterm text default null, p_destination_port text default null,
  p_notes text default null, p_idempotency_key text default null, p_website text default null, p_lang text default 'en'
) returns json language plpgsql security definer set search_path = public as $$
declare
  prod coffee_products%rowtype;
  ex inquiries%rowtype;
  errs jsonb := '{}'::jsonb;
  num text;
  tries int := 0;
  recent_email int;
  recent_all int;
  kind_u text := upper(btrim(coalesce(p_kind, '')));
begin
  if coalesce(p_website, '') <> '' then  -- honeypot filled: bot
    return json_build_object('ok', false, 'code', 'REJECTED', 'message', 'Request rejected.');
  end if;

  p_email := lower(btrim(coalesce(p_email, '')));

  -- Idempotent replay: only for the SAME email, so a guessed key reveals nothing to someone else.
  if p_idempotency_key is not null then
    select * into ex from inquiries where idempotency_key = p_idempotency_key and lower(email) = p_email;
    if found then
      return json_build_object('ok', true, 'data', json_build_object('inquiry_number', ex.inquiry_number, 'status', ex.status,
        'kind', ex.kind, 'total_estimate', case when ex.kind = 'RFQ' then round(ex.quantity_kg * ex.price_snapshot_at_inquiry, 2) end));
    end if;
  end if;

  p_company_name := btrim(coalesce(p_company_name, ''));
  p_contact_name := btrim(coalesce(p_contact_name, ''));
  p_phone        := btrim(coalesce(p_phone, ''));
  p_country      := btrim(coalesce(p_country, ''));
  p_destination_port := nullif(btrim(coalesce(p_destination_port, '')), '');
  p_incoterm     := nullif(upper(btrim(coalesce(p_incoterm, ''))), '');
  p_notes        := nullif(btrim(coalesce(p_notes, '')), '');
  p_lang         := case when p_lang = 'id' then 'id' else 'en' end;

  if kind_u not in ('SAMPLE','RFQ') then errs := errs || '{"kind":"invalid"}'; end if;
  if char_length(p_company_name) < 2 or char_length(p_company_name) > 120 then errs := errs || '{"company_name":"company_name"}'; end if;
  if char_length(p_contact_name) < 2 or char_length(p_contact_name) > 120 then errs := errs || '{"contact_name":"contact_name"}'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_email) > 254 then errs := errs || '{"email":"email"}'; end if;
  if p_phone !~ '^[+0-9 ()-]{6,30}$' then errs := errs || '{"phone":"phone"}'; end if;
  if char_length(p_country) < 2 or char_length(p_country) > 80 then errs := errs || '{"country":"country"}'; end if;
  if p_destination_port is not null and char_length(p_destination_port) > 120 then errs := errs || '{"destination_port":"destination_port"}'; end if;
  if kind_u = 'RFQ' and p_incoterm is null then errs := errs || '{"incoterm":"incoterm"}'; end if;
  if p_incoterm is not null and p_incoterm not in ('EXW','FOB','CFR','CIF') then errs := errs || '{"incoterm":"incoterm"}'; end if;
  if p_notes is not null and (char_length(p_notes) > 1000 or p_notes ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]') then
    errs := errs || '{"notes":"notes"}';
  end if;

  select * into prod from coffee_products where id = p_product_id and deleted_at is null and status <> 'ARCHIVED';
  if not found then
    return json_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE', 'message', 'This lot is no longer available.');
  end if;

  -- Quantity rules: sample 0.1-5 kg; RFQ from the lot MOQ up to 100,000 kg; max 2 decimals.
  if p_quantity_kg is null then errs := errs || '{"quantity_kg":"quantity_required"}';
  elsif round(p_quantity_kg, 2) <> p_quantity_kg then errs := errs || '{"quantity_kg":"quantity_decimals"}';
  elsif kind_u = 'SAMPLE' and (p_quantity_kg < 0.1 or p_quantity_kg > 5) then errs := errs || '{"quantity_kg":"sample_range"}';
  elsif kind_u = 'RFQ' and p_quantity_kg < prod.moq_kg then errs := errs || '{"quantity_kg":"below_moq"}';
  elsif kind_u = 'RFQ' and p_quantity_kg > 100000 then errs := errs || '{"quantity_kg":"too_large"}'; end if;

  if errs <> '{}'::jsonb then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'message', 'Please check the form.', 'errors', errs);
  end if;

  -- Throttles (stop-gap until Turnstile + Edge Function): 5 per email per hour, 300 total per hour.
  select count(*) into recent_email from inquiries where lower(email) = p_email and created_at > now() - interval '1 hour';
  if recent_email >= 5 then
    return json_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many requests from this email. Try again later.');
  end if;
  select count(*) into recent_all from inquiries where created_at > now() - interval '1 hour';
  if recent_all >= 300 then
    return json_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'The system is busy. Try again later.');
  end if;

  loop
    num := 'RFQ-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into inquiries (inquiry_number, kind, product_id, company_name, contact_name, email, phone, country, quantity_kg,
                             incoterm, destination_port, price_snapshot_at_inquiry, notes, lang, idempotency_key)
      values (num, kind_u, prod.id, p_company_name, p_contact_name, p_email, p_phone, p_country, p_quantity_kg,
              p_incoterm, p_destination_port, prod.price_per_kg, p_notes, p_lang, p_idempotency_key);
      exit;
    exception when unique_violation then
      if p_idempotency_key is not null then
        select * into ex from inquiries where idempotency_key = p_idempotency_key and lower(email) = p_email;
        if found then
          return json_build_object('ok', true, 'data', json_build_object('inquiry_number', ex.inquiry_number, 'status', ex.status,
            'kind', ex.kind, 'total_estimate', case when ex.kind = 'RFQ' then round(ex.quantity_kg * ex.price_snapshot_at_inquiry, 2) end));
        end if;
      end if;
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;

  return json_build_object('ok', true, 'data', json_build_object('inquiry_number', num, 'status', 'PENDING', 'kind', kind_u,
    'total_estimate', case when kind_u = 'RFQ' then round(p_quantity_kg * prod.price_per_kg, 2) end));
end $$;

-- ───────── Public RPC: check status (number + email) ─────────
create or replace function lookup_inquiry(p_inquiry_number text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare
  num text := upper(btrim(coalesce(p_inquiry_number, '')));
  em  text := lower(btrim(coalesce(p_email, '')));
  r record;
  fails int;
begin
  delete from rfq_lookup_attempts where attempted_at < now() - interval '1 day';

  -- Limit is per (number + email): guessing with a wrong email never blocks the real owner.
  select count(*) into fails from rfq_lookup_attempts
   where inquiry_number = num and email = em and attempted_at > now() - interval '15 minutes';
  if fails >= 5 then
    return json_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many attempts. Try again in 15 minutes.');
  end if;

  select i.inquiry_number, i.kind, i.status, p.name_en, p.name_id, i.quantity_kg, i.created_at, i.updated_at
    into r
    from inquiries i join coffee_products p on p.id = i.product_id
   where i.inquiry_number = num and lower(i.email) = em;

  if not found then
    insert into rfq_lookup_attempts (inquiry_number, email) values (num, em);
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'RFQ number or email not found.');
  end if;
  return json_build_object('ok', true, 'data', json_build_object('inquiry_number', r.inquiry_number, 'kind', r.kind, 'status', r.status,
    'product_name_en', r.name_en, 'product_name_id', r.name_id, 'quantity_kg', r.quantity_kg,
    'created_at', r.created_at, 'updated_at', r.updated_at));
end $$;

revoke all on function create_inquiry(text, uuid, text, text, text, text, text, numeric, text, text, text, text, text, text) from public;
revoke all on function lookup_inquiry(text, text) from public;
grant execute on function create_inquiry(text, uuid, text, text, text, text, text, numeric, text, text, text, text, text, text) to anon, authenticated;
grant execute on function lookup_inquiry(text, text) to anon, authenticated;

-- ───────── Sample catalog (clearly marked is_sample_data; replace with real lots from /admin/) ─────────
insert into coffee_products (slug, lot_code, species, process, variety, grade, cupping_score, moisture_percentage, screen_size, origin,
  eudr_ready, name_en, name_id, description_en, description_id, price_per_kg, moq_kg, stock_kg, is_sample_data)
select * from (values
  ('sample-arabica-washed', 'SAMPLE-A1', 'ARABICA', 'WASHED', 'To be confirmed', 'Specialty', 83.0, 11.5, '16-18', 'To be confirmed',
   false, 'Sample Arabica, Washed', 'Contoh Arabika, Washed',
   'Sample entry. Replace with a real lot: origin, variety, process and cupping score must come from the producer.',
   'Data contoh. Ganti dengan lot asli: asal, varietas, proses, dan skor cupping harus dari produsen.',
   8.50, 60, 600, true),
  ('sample-robusta-natural', 'SAMPLE-R1', 'ROBUSTA', 'NATURAL', 'To be confirmed', 'Grade 1', null, 12.0, '15-17', 'To be confirmed',
   false, 'Sample Robusta, Natural', 'Contoh Robusta, Natural',
   'Sample entry. Replace with a real lot before publishing.',
   'Data contoh. Ganti dengan lot asli sebelum dipublikasikan.',
   4.20, 300, 3000, true)
) as v(slug, lot_code, species, process, variety, grade, cupping_score, moisture_percentage, screen_size, origin,
       eudr_ready, name_en, name_id, description_en, description_id, price_per_kg, moq_kg, stock_kg, is_sample_data)
where not exists (select 1 from coffee_products where coffee_products.slug = v.slug);

-- After creating the admin user in Authentication -> Users:
-- insert into admins (user_id) select id from auth.users where email = 'ADMIN_EMAIL';
