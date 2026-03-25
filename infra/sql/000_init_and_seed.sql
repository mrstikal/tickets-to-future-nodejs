-- Master init and seed file - kompletní inicializace DB
-- Nahrazuje soubory 001-006

-- 1. Extension a utility funkce
create extension if not exists "pgcrypto";

create or replace function set_updated_at()
    returns trigger
    language plpgsql
as $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

-- 2. Tabulky v pořadí závislostí

-- image_assets
create table if not exists image_assets (
    id uuid primary key default gen_random_uuid(),
    external_id varchar(128) not null,
    name varchar(255) not null,
    image_url text not null,
    local_image_path text not null,
    source varchar(100) not null default 'rick-and-morty-api',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_image_assets_external_id unique (external_id)
);

-- Trigger pro image_assets
drop trigger if exists trg_image_assets_set_updated_at on image_assets;
create trigger trg_image_assets_set_updated_at
    before update on image_assets
    for each row
    execute function set_updated_at();

-- ticket_types
create table if not exists ticket_types (
    id uuid primary key default gen_random_uuid(),
    title varchar(255) not null,
    description text not null,
    currency varchar(3) not null default 'CZK',
    total_quantity integer not null check (total_quantity >= 0),
    sold_quantity integer not null default 0 check (sold_quantity >= 0),
    is_active boolean not null default true,
    image_asset_id uuid not null references image_assets(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_ticket_types_sold_not_greater_than_total check (sold_quantity <= total_quantity)
);

-- Indexy pro ticket_types
create index if not exists idx_ticket_types_image_asset_id on ticket_types (image_asset_id);
create index if not exists idx_ticket_types_is_active on ticket_types (is_active);

-- Trigger pro ticket_types
drop trigger if exists trg_ticket_types_set_updated_at on ticket_types;
create trigger trg_ticket_types_set_updated_at
    before update on ticket_types
    for each row
    execute function set_updated_at();

-- ticket_events
create table if not exists ticket_events (
    id uuid primary key default gen_random_uuid(),
    ticket_type_id uuid not null references ticket_types(id) on delete restrict,
    slug varchar(255) not null,
    title varchar(255) not null,
    description text not null,
    event_at timestamptz not null,
    price numeric(10,2) not null check (price >= 0),
    currency varchar(3) not null default 'CZK',
    total_quantity integer not null check (total_quantity >= 0),
    sold_quantity integer not null default 0 check (sold_quantity >= 0),
    is_active boolean not null default true,
    image_asset_id uuid not null references image_assets(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_ticket_events_slug unique (slug),
    constraint chk_ticket_events_sold_not_greater_than_total check (sold_quantity <= total_quantity)
);

-- Indexy pro ticket_events
create index if not exists idx_ticket_events_ticket_type_id on ticket_events (ticket_type_id);
create index if not exists idx_ticket_events_event_at on ticket_events (event_at);
create index if not exists idx_ticket_events_is_active on ticket_events (is_active);

-- Trigger pro ticket_events
drop trigger if exists trg_ticket_events_set_updated_at on ticket_events;
create trigger trg_ticket_events_set_updated_at
    before update on ticket_events
    for each row
    execute function set_updated_at();

-- ticket_holds
create table if not exists ticket_holds (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references ticket_events(id) on delete restrict,
    session_id varchar(255) not null,
    status varchar(20) not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_ticket_holds_status check (status in ('active', 'confirmed', 'expired', 'cancelled'))
);

-- Indexy pro ticket_holds
create index if not exists idx_ticket_holds_ticket_id on ticket_holds (ticket_id);
create index if not exists idx_ticket_holds_session_id on ticket_holds (session_id);
create index if not exists idx_ticket_holds_status on ticket_holds (status);
create index if not exists idx_ticket_holds_expires_at on ticket_holds (expires_at);

-- Trigger pro ticket_holds
drop trigger if exists trg_ticket_holds_set_updated_at on ticket_holds;
create trigger trg_ticket_holds_set_updated_at
    before update on ticket_holds
    for each row
    execute function set_updated_at();

-- orders (s extra sloupci z 004)
create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    order_number varchar(50) not null,
    name varchar(255),
    reference_number varchar(255),
    email varchar(320) not null,
    status varchar(20) not null,
    total_price numeric(10,2) not null check (total_price >= 0),
    currency varchar(3) not null default 'CZK',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_orders_order_number unique (order_number),
    constraint chk_orders_status check (status in ('created', 'confirmed', 'failed', 'expired', 'cancelled'))
);

-- Indexy pro orders
create index if not exists idx_orders_status on orders (status);
create index if not exists idx_orders_email on orders (email);

-- Trigger pro orders
drop trigger if exists trg_orders_set_updated_at on orders;
create trigger trg_orders_set_updated_at
    before update on orders
    for each row
    execute function set_updated_at();

-- order_items
create table if not exists order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    ticket_id uuid not null references ticket_events(id) on delete restrict,
    quantity integer not null check (quantity > 0),
    unit_price numeric(10,2) not null check (unit_price >= 0),
    total_price numeric(10,2) not null check (total_price >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexy pro order_items
create index if not exists idx_order_items_order_id on order_items (order_id);
create index if not exists idx_order_items_ticket_id on order_items (ticket_id);

-- Trigger pro order_items
drop trigger if exists trg_order_items_set_updated_at on order_items;
create trigger trg_order_items_set_updated_at
    before update on order_items
    for each row
    execute function set_updated_at();

-- users (z 005)
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email varchar(320) not null,
    password_hash varchar(255) not null,
    name varchar(255),
    role varchar(20) not null default 'admin',
    is_active boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_users_email unique (email),
    constraint chk_users_role check (role in ('admin', 'user')),
    constraint chk_users_email_format check (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexy pro users
create index if not exists idx_users_email on users (email);
create index if not exists idx_users_role on users (role);
create index if not exists idx_users_is_active on users (is_active);

-- Trigger pro users
drop trigger if exists trg_users_set_updated_at on users;
create trigger trg_users_set_updated_at
    before update on users
    for each row
    execute function set_updated_at();

-- Default admin user (password: Admin123!)
insert into users (email, password_hash, name, role)
values (
    'admin@tickets.local',
    '$2b$10$eHaiwxhPAJF7D889sOoJzOmOq.YMurTs2NvXjPowhIiX0LCs.b7ku',
    'System Administrator',
    'admin'
)
on conflict (email) do nothing;
