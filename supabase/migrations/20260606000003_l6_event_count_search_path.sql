-- L6: harden update_event_attendee_count() — add SET search_path so this
-- SECURITY DEFINER trigger function can't be hijacked via a manipulated
-- search_path. Body is identical to 001_schema.sql:205-216; only the
-- search_path lock is added. CREATE OR REPLACE preserves the function, so the
-- existing on_event_registration_change trigger keeps working unchanged.
CREATE OR REPLACE FUNCTION public.update_event_attendee_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET attendees = attendees + 1 WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET attendees = GREATEST(attendees - 1, 0) WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
