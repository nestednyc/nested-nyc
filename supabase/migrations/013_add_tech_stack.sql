-- Add tech_stack column to profiles and split existing skills data.
--
-- Rationale: the Edit Profile form was attempting to write a `tech_stack` field
-- that didn't exist, producing "Could not find the 'tech_stack' column" errors.
-- We now keep skills (roles/disciplines like Frontend, Marketing, Product) and
-- tech_stack (tools/frameworks like React, Postgres, AWS) as separate arrays.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tech_stack text[] DEFAULT '{}'::text[];

-- Move tech values out of skills into tech_stack for existing rows.
-- Safe to re-run: the WHERE clause filters to rows that still have tech values
-- in their skills array, and rows without overlap are skipped.
UPDATE public.profiles
SET
  tech_stack = ARRAY(
    SELECT s FROM unnest(skills) s
    WHERE s = ANY(ARRAY[
      'React','Python','JavaScript','TypeScript','Node.js','Next.js','Vue','Swift',
      'Kotlin','Go','Rust','Figma','Supabase','Vercel','GitHub','VS Code',
      'Docker','AWS','Firebase','PostgreSQL','MongoDB','Web3'
    ]::text[])
  ),
  skills = ARRAY(
    SELECT s FROM unnest(skills) s
    WHERE s <> ALL(ARRAY[
      'React','Python','JavaScript','TypeScript','Node.js','Next.js','Vue','Swift',
      'Kotlin','Go','Rust','Figma','Supabase','Vercel','GitHub','VS Code',
      'Docker','AWS','Firebase','PostgreSQL','MongoDB','Web3'
    ]::text[])
  )
WHERE skills && ARRAY[
  'React','Python','JavaScript','TypeScript','Node.js','Next.js','Vue','Swift',
  'Kotlin','Go','Rust','Figma','Supabase','Vercel','GitHub','VS Code',
  'Docker','AWS','Firebase','PostgreSQL','MongoDB','Web3'
]::text[];

-- Refresh PostgREST schema cache so the new column is immediately visible.
NOTIFY pgrst, 'reload schema';
