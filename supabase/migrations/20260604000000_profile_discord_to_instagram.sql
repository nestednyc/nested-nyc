-- Retire the personal Discord handle on profiles in favour of an Instagram handle.
--
--   1) Fresh rows default to an empty `instagram` slot instead of `discord`.
--   2) Existing rows: drop the `discord` key entirely (deletes any saved handle)
--      and ensure an (empty) `instagram` key exists. An instagram value is
--      preserved if one was somehow already set. Idempotent and NULL-safe.

ALTER TABLE public.profiles
  ALTER COLUMN links SET DEFAULT '{"github": "", "portfolio": "", "linkedin": "", "instagram": ""}'::jsonb;

UPDATE public.profiles
SET links = (links - 'discord')
            || jsonb_build_object('instagram', COALESCE(links -> 'instagram', '""'::jsonb))
WHERE links IS NOT NULL
  AND (links ? 'discord' OR NOT (links ? 'instagram'));
