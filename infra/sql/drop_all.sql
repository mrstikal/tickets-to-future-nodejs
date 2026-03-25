-- Drop all tables and extensions in correct order
-- This script safely removes all database objects

-- Drop tables in reverse dependency order
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists ticket_holds cascade;
drop table if exists ticket_events cascade;
drop table if exists ticket_types cascade;
drop table if exists image_assets cascade;
drop table if exists users cascade;

-- Drop functions
drop function if exists set_updated_at() cascade;

-- Drop extensions
drop extension if exists pgcrypto cascade;

-- Confirmation message
select 'Database cleaned successfully' as status;
