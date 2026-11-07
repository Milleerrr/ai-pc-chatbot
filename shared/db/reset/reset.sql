-- Wipe every table and drizzle's migration history, leaving an empty
-- `public` schema for `pnpm db:migrate` to rebuild.

\set ON_ERROR_STOP on

begin;
drop schema if exists drizzle cascade;
drop schema public cascade;
create schema public;
commit;
