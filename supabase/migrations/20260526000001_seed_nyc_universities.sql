-- Pre-seed NYC universities so student clubs can link to a canonical parent
-- instead of typing "NYU"/"N.Y.U."/"New York University" three different ways.
-- All seeded as verified=TRUE; admins for these are provisioned manually.

INSERT INTO public.organizations (slug, name, type, verified, location) VALUES
  ('nyu',              'New York University',                'university', TRUE, 'New York, NY'),
  ('pace',             'Pace University',                    'university', TRUE, 'New York, NY'),
  ('columbia',         'Columbia University',                'university', TRUE, 'New York, NY'),
  ('fordham',          'Fordham University',                 'university', TRUE, 'New York, NY'),
  ('new-school',       'The New School',                     'university', TRUE, 'New York, NY'),
  ('cooper-union',     'The Cooper Union',                   'university', TRUE, 'New York, NY'),
  ('pratt',            'Pratt Institute',                    'university', TRUE, 'Brooklyn, NY'),
  ('baruch',           'Baruch College (CUNY)',              'university', TRUE, 'New York, NY'),
  ('hunter',           'Hunter College (CUNY)',              'university', TRUE, 'New York, NY'),
  ('ccny',             'The City College of New York (CUNY)','university', TRUE, 'New York, NY'),
  ('brooklyn-college', 'Brooklyn College (CUNY)',            'university', TRUE, 'Brooklyn, NY'),
  ('queens-college',   'Queens College (CUNY)',              'university', TRUE, 'Queens, NY'),
  ('st-johns',         'St. John''s University',             'university', TRUE, 'Queens, NY'),
  ('sva',              'School of Visual Arts',              'university', TRUE, 'New York, NY'),
  ('fit',              'Fashion Institute of Technology',    'university', TRUE, 'New York, NY'),
  ('juilliard',        'The Juilliard School',               'university', TRUE, 'New York, NY'),
  ('yeshiva',          'Yeshiva University',                 'university', TRUE, 'New York, NY'),
  ('manhattan-college','Manhattan College',                  'university', TRUE, 'Bronx, NY')
ON CONFLICT (slug) DO NOTHING;
