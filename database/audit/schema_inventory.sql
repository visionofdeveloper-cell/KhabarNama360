-- =============================================================================
-- 360Khabarnama — Read-Only PostgreSQL / Supabase Live Schema Inventory
-- Purpose: Inspect live tables, columns, constraints, indexes, triggers, views,
--          sequences, RLS flags, policies, role grants, and storage buckets.
-- Safety:  100% READ-ONLY. Executes zero DDL or DML mutations.
-- =============================================================================

-- 1. Public Tables, RLS Flags & Approximate Row Counts
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pg_stat_get_live_tuples(c.oid) AS approx_live_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 2. Complete Column Inventory (Types, Nullability, Defaults, Identity)
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;

-- 3. Primary Keys, Foreign Keys, Unique & CHECK Constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM information_schema.table_constraints tc
JOIN pg_namespace n ON n.nspname = tc.table_schema
JOIN pg_class cl ON cl.relnamespace = n.oid AND cl.relname = tc.table_name
JOIN pg_constraint con ON con.conrelid = cl.oid AND con.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4. Indexes on Public Tables
SELECT
  tablename AS table_name,
  indexname AS index_name,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. Triggers & Functions in Public Schema
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_timing AS timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 6. Views & Security Invoker Settings
SELECT
  c.relname AS view_name,
  c.reloptions AS view_options,
  pg_get_viewdef(c.oid, true) AS definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
ORDER BY c.relname;

-- 7. Sequences & Identity Ownership
SELECT
  s.sequence_name,
  s.data_type,
  s.start_value,
  s.increment
FROM information_schema.sequences s
WHERE s.sequence_schema = 'public'
ORDER BY s.sequence_name;

-- 8. Row-Level Security (RLS) Policies on Public & Storage Schemas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 9. Explicit Role Privileges on Tables & Views
SELECT
  table_schema,
  table_name,
  grantee,
  STRING_AGG(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;

-- 10. Supabase Storage Buckets
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY id;
