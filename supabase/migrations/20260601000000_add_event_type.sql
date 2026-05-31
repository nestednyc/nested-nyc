-- Cork-board UI distinguishes events by a typed taxonomy (colored stripe on the
-- card, type-filter chips above the feed). The base events schema had no such
-- column — events were just title/description/date — so the cork-board UI was
-- driving stripe color and filtering off a field that didn't exist.
--
-- Adds events.event_type as a constrained TEXT column. Keeps the values in lock-
-- step with EVENT_TYPES in src/design/data.jsx; if you add or rename a type
-- there, add or rename it here in a follow-up migration.
--
-- Default 'talk' keeps any pre-existing rows valid; new inserts from the Pin-an-
-- event form will always supply an explicit type.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'talk'
    CHECK (event_type IN (
      'hack', 'demo', 'mixer', 'workshop', 'talk',
      'networking', 'social', 'career', 'design'
    ));

CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);

NOTIFY pgrst, 'reload schema';
