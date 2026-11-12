-- TravelTrack Plaksha: PostgreSQL schema (Supabase / Neon).
-- Mirrors backend/app/models.py. Run once in the SQL editor, then set AUTO_CREATE_TABLES=false.
--
-- This is a fresh-install script. A database created before rides could go from any place to
-- any place (it has pools.origin_hub / luggage columns) must be recreated: the ride tables
-- changed shape and there is no in-place upgrade. Uncomment and run these first:
-- drop table if exists pool_members;
-- drop table if exists pools;
-- drop type if exists hub;
-- drop type if exists luggage_load;
-- drop type if exists vehicle;

create extension if not exists "pgcrypto";

do $$ begin
  create type pool_status as enum ('open','full','booked','departed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type vehicle as enum ('auto','sedan','suv','muv');   -- 3 / 4 / 6 / 7 passenger seats
exception when duplicate_object then null; end $$;
do $$ begin
  create type transit_mode as enum ('none','train','flight');
exception when duplicate_object then null; end $$;
do $$ begin
  create type booked_via as enum ('uber','ola','indrive','rapido','other');
exception when duplicate_object then null; end $$;

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(120) not null,
  email       varchar(254) not null unique check (lower(email) like '%@plaksha.edu.in'),
  phone       varchar(20),                         -- E.164 digits without '+', used for wa.me links
  batch       varchar(8),                          -- graduating year, e.g. '2029'
  upi_id      varchar(120),
  avatar_url  text,
  created_at  timestamptz not null default now()
);
create index if not exists ix_users_phone on users (phone);

create table if not exists pools (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references users(id) on delete cascade,
  -- Free-form places: any name plus coordinates. Presets live in backend/app/geo.py.
  origin_name         varchar(80) not null,
  origin_lat          double precision not null,
  origin_lng          double precision not null,
  dest_name           varchar(80) not null,
  dest_lat            double precision not null,
  dest_lng            double precision not null,
  custom_route_note   text,                         -- e.g. '3:15 PM Vande Bharat to NDLS'
  meeting_point       varchar(80) not null default 'Main Gate',
  window_start        timestamptz not null,
  window_end          timestamptz not null,
  max_seats           int not null default 4,       -- seats the pool fills (never more than the car has)
  vehicle             vehicle not null default 'sedan',
  status              pool_status not null default 'open',
  total_fare          int,
  booked_via          booked_via,
  booked_at           timestamptz,
  whatsapp_group_url  text,
  transit_mode        transit_mode not null default 'none',
  transit_code        varchar(40),                  -- '12046 SHATABDI', '6E 2134'
  transit_time        timestamptz,
  reminder_sent_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pool_window_order  check (window_end > window_start),
  constraint pool_seat_range    check (max_seats between 2 and 7)
);
create index if not exists ix_pools_window_start on pools (window_start);
create index if not exists ix_pools_status_window_end on pools (status, window_end);
create index if not exists ix_pools_transit_code on pools (transit_code);

create table if not exists pool_members (
  pool_id        uuid not null references pools(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  seats          int not null default 1 check (seats between 1 and 6),  -- seats this rider's group takes
  is_booker      boolean not null default false,
  has_paid       boolean not null default false,
  joined_at      timestamptz not null default now(),
  primary key (pool_id, user_id)
);
create index if not exists ix_pool_members_user on pool_members (user_id);
-- At most one booker per pool.
create unique index if not exists ux_pool_one_booker on pool_members (pool_id) where is_booker;

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ix_push_user on push_subscriptions (user_id);

-- Optional: run the archive step in-database with Supabase pg_cron instead of APScheduler.
-- (Push reminders still need the API process, so keep SCHEDULER_ENABLED=true for those.)
-- select cron.schedule('traveltrack-archive', '*/10 * * * *', $$
--   update pools set status = 'departed', updated_at = now()
--   where status in ('open','full','booked') and window_end < now() - interval '30 minutes';
-- $$);
