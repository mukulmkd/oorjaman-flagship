-- Must be its own migration: PostgreSQL cannot use a new enum label in the same
-- transaction that adds it (SQLSTATE 55P04).

alter type public.user_role add value if not exists 'support';
