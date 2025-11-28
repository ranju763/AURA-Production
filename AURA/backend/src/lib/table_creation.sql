create table public.players (
  id serial not null,
  user_id uuid not null,
  username character varying null,
  dob date null,
  gender character varying null,
  photo_url text null,
  created_at timestamp with time zone null default now(),
  constraint players_pkey primary key (id),
  constraint players_user_id_fkey foreign KEY (user_id) references auth.users (id) on update CASCADE
) TABLESPACE pg_default;

CREATE TABLE venue (
  id SERIAL PRIMARY KEY,
  name VARCHAR,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE TABLE match_format (
  id SERIAL PRIMARY KEY,
  type VARCHAR NOT NULL CHECK (type IN ('mens_doubles', 'womens_doubles', 'mixed_doubles', 'singles')),
  min_age INT,
  max_age INT,
  eligible_gender VARCHAR NOT NULL CHECK (eligible_gender IN ('M', 'W', 'MW')),
  total_rounds INT DEFAULT 0 CHECK (total_rounds >= 0),
  metadata JSONB,
  CHECK ((min_age IS NULL AND max_age IS NULL) OR (max_age >= min_age))
);

CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  host_id INTEGER NOT NULL REFERENCES players(id),
  name VARCHAR NOT NULL,
  description TEXT NOT NULL,
  sport_id TEXT, -- Kept TEXT if this refers to a generic system ID, otherwise change to INT
  venue_id INTEGER NOT NULL REFERENCES venue(id),
  match_format_id INTEGER NOT NULL REFERENCES match_format(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  registration_fee NUMERIC(10, 2) DEFAULT 0.00, -- ADDED: Fee with 2 decimal precision
  image_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  round TEXT,
  CHECK (end_time > start_time)
);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Changed to UUID with auto-generated default
  amount NUMERIC(10, 2),
  type VARCHAR,
  status VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  player_id INTEGER REFERENCES players(id),
  txn_id UUID REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE courts (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER REFERENCES venue(id),
  court_number INT
);

-- RATINGS
CREATE TABLE ratings (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) UNIQUE,
  aura_mu FLOAT,
  aura_sigma FLOAT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- TOURNAMENT REFEREE
CREATE TABLE tournaments_referee (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  tournament_id INTEGER REFERENCES tournaments(id)
);



-- TEAM PLAYERS (Junction Table)
CREATE TABLE teams (
  team_id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(team_id),
  player_id INTEGER REFERENCES players(id),
  created_at TIMESTAMPTZ
);

-- MATCHES
-- This now represents the "Encounter" (e.g., The Quarter Final Match)
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  refree_id INTEGER REFERENCES players(id),
  court_id INTEGER REFERENCES courts(id),
  winner_team_id INTEGER REFERENCES teams(team_id), -- The overall winner of the match
  round TEXT,
  status VARCHAR, -- e.g., 'scheduled', 'in_progress', 'completed'
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
);


-- PAIRING
-- Links specific teams to the match
CREATE TABLE pairings (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  match_id INTEGER REFERENCES matches(id)
);

CREATE TABLE pairing_teams (
  id SERIAL PRIMARY KEY,
  pairing_id INTEGER REFERENCES pairings(id),
  team_id INTEGER REFERENCES teams(team_id)
);


-- RATING HISTORY
CREATE TABLE rating_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  match_id INTEGER REFERENCES matches(id),
  old_mu FLOAT,
  old_sigma FLOAT,
  new_mu FLOAT,
  new_sigma FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCORES (Optimized for Pickleball)
-- Pickleball is usually Best of 3. This table records each game individually.
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),

  -- The Raw Scores
  team_a_score INT NOT NULL DEFAULT 0,
  team_b_score INT NOT NULL DEFAULT 0,

  -- Pickleball Specific State (The "3rd Number")
  serving_team_id INTEGER REFERENCES teams(team_id),   -- Which team currently has the serve?
  server_sequence INT CHECK (server_sequence IN (1, 2)), -- Is this Server #1 or Server #2?


  -- Detailed logs (e.g., fault types, timeouts, side-out history)
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.

-- Drop existing trigger and function to ensure clean recreation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the function
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_player_id INTEGER;
BEGIN
  -- Insert into players table and get the player_id
  INSERT INTO public.players (user_id, username, dob, gender, photo_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    CASE 
      WHEN NEW.raw_user_meta_data->>'dob' IS NOT NULL AND NEW.raw_user_meta_data->>'dob' != '' 
      THEN (NEW.raw_user_meta_data->>'dob')::date 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'photo_url'
  )
  RETURNING id INTO new_player_id;

  -- Insert initial rating record with default values
  INSERT INTO public.ratings (player_id)
  VALUES (new_player_id);

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
