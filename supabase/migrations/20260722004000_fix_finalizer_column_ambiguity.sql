-- Resolve PL/pgSQL output-column name collisions in the Elo finalizer.
-- The finalizer returns a column named profile_id, which must not shadow
-- the identically named temporary-table column while evaluating its queries.
alter function public.finalize_casual_elo_match(uuid, text, jsonb)
  set plpgsql.variable_conflict = 'use_column';
