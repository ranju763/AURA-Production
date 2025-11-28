alter database postgres
set timezone to 'Asia/Kolkata';

INSERT INTO
  players (
    "user_id",
    "username",
    "dob",
    "gender",
    "photo_url",
    "created_at"
  )
VALUES
  (
    'f2c6833f-d6db-4bf2-b82c-60b880a74f70',
    'ranjeev',
    '2001-05-21',
    'male',
    'https://img/p1.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '960bbd2e-ee09-4c87-85d0-71f8e304ea7b',
    'arun',
    '2020-04-11',
    'male',
    'https://img/p2.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '110a63c2-a59d-498f-a4fb-c70adc2ab0f9',
    'priya',
    '1999-08-18',
    'female',
    'https://img/p3.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    'e66f7395-5e7c-4866-b334-0dbab355f605',
    'kavin',
    '1998-12-10',
    'male',
    'https://img/p4.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    'af213a3f-248f-4a8d-b947-00b40a2dc4cc',
    'sneha',
    '2002-03-19',
    'female',
    'https://img/p5.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '9237c87e-55b4-40a2-9e93-2c922f680623',
    'rahul',
    '1997-07-23',
    'male',
    'https://img/p6.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '0ef4785f-10a1-4098-b04a-37d320cc6687',
    'meera',
    '2001-11-05',
    'female',
    'https://img/p7.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    'd2a89a60-7838-4816-ba5a-4aacba07848f',
    'vignesh',
    '1999-01-29',
    'male',
    'https://img/p8.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '8b209b81-a95c-433d-91d0-96c0148717a4',
    'ananya',
    '2000-06-10',
    'female',
    'https://img/p9.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '542da33a-48f0-4b37-b1f3-35d1e9817e33',
    'yuvan',
    '2003-02-14',
    'male',
    'https://img/p10.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    'ecd88eea-c1db-46be-958c-0a37d5cb0844',
    'divya',
    '1998-09-17',
    'female',
    'https://img/p11.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '90adb223-0712-49d7-9dcb-71caa002cf14',
    'sanjay',
    '2001-04-20',
    'male',
    'https://img/p12.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '32ab250c-8971-4daa-ade9-cdc815c4d6dd',
    'harini',
    '1997-12-01',
    'female',
    'https://img/p13.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    'bc119a20-0509-4c3c-8665-2157698002a7',
    'gokul',
    '1999-05-07',
    'male',
    'https://img/p14.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    '8447d272-b9af-4f70-8e52-a301eec03aac',
    'isha',
    '2002-08-30',
    'female',
    'https://img/p15.jpg',
    '2025-11-17 21:08:35.837246+00'
  ),
  (
    'cecd8cbb-41a1-4244-92b7-433597dfb44e',
    'tarun',
    '2000-10-02',
    'male',
    'https://img/p16.jpg',
    '2025-11-17 21:08:35.837246+00'
  );

INSERT INTO
  venue (name, address, created_at, updated_at)
VALUES
  (
    'SmashHub Arena',
    'OMR, Chennai, Tamil Nadu',
    NOW(),
    NOW()
  ),
  (
    'ProServe Courts',
    'Indiranagar, Bangalore, Karnataka',
    NOW(),
    NOW()
  ),
  (
    'AceZone Sports Complex',
    'Gachibowli, Hyderabad, Telangana',
    NOW(),
    NOW()
  ),
  (
    'RallyUp Indoor Center',
    'Viman Nagar, Pune, Maharashtra',
    NOW(),
    NOW()
  ),
  (
    'Baseline Sports Arena',
    'Kakkanad, Kochi, Kerala',
    NOW(),
    NOW()
  );

INSERT INTO
  match_format (
    type,
    min_age,
    max_age,
    eligible_gender,
    metadata
  )
VALUES
  (
    'mens_doubles',
    0,
    11,
    'M',
    '{
    "set_rules": {
      "final": { "best_of": 7 },
      "semi_final": { "best_of": 5 },
      "league": { "best_of": 3, "_rounds": 4 }
    }
  }'
  ),
  (
    'mens_doubles',
    0,
    17,
    'M',
    '{
    "set_rules": {
      "final": { "best_of": 7 },
      "semi_final": { "best_of": 5 },
      "league": { "best_of": 3, "_rounds": 4 }
    }
  }'
  ),
  (
    'mens_doubles',
    0,
    25,
    'M',
    '{
    "set_rules": {
      "final": { "best_of": 7 },
      "semi_final": { "best_of": 5 },
      "league": { "best_of": 3, "_rounds": 4 }
    }
  }'
  ),
  (
    'mixed_doubles',
    NULL,
    NULL,
    'MW',
    '{
    "set_rules": {
      "final": { "best_of": 7 },
      "semi_final": { "best_of": 5 },
      "league": { "best_of": 3, "_rounds": 4 }
    }
  }'
  ),
  (
    'womens_doubles',
    NULL,
    NULL,
    'W',
    '{
    "set_rules": {
      "final": { "best_of": 7 },
      "semi_final": { "best_of": 5 },
      "league": { "best_of": 3, "_rounds": 4 }
    }
  }'
  );

INSERT INTO
  tournaments (
    host_id,
    name,
    description,
    sport_id,
    venue_id,
    start_time,
    end_time,
    capacity,
    image_url,
    match_format_id,
    metadata
  )
VALUES
  (
    1,
    -- Host player ID from players table
    'U-11 Men''s Doubles Championship',
    'Tournament for boys under 11 in doubles format',
    'sport1',
    1,
    -- Venue ID
    '2025-12-01 09:00:00+05:30',
    '2025-12-01 17:00:00+05:30',
    16,
    'https://img/t1.jpg',
    1,
    -- Match format ID (U-11 men doubles)
    '{"level":"U-11","type":"mens_doubles"}'
  ),
  (
    2,
    'Mixed Doubles Open Tournament',
    'Open tournament for mixed doubles',
    'sport1',
    1,
    -- Same venue
    '2025-12-01 09:00:00+05:30',
    '2025-12-01 19:00:00+05:30',
    24,
    'https://img/t2.jpg',
    4,
    -- Match format ID (mixed doubles)
    '{"level":"open","type":"mixed_doubles"}'
  ),
  (
    3,
    'Women''s Doubles Open Championship',
    'Open tournament for women''s doubles',
    'sport1',
    1,
    -- Same venue
    '2025-12-01 09:00:00+05:30',
    '2025-12-01 18:00:00+05:30',
    20,
    'https://img/t3.jpg',
    5,
    -- Match format ID (women doubles)
    '{"level":"open","type":"womens_doubles"}'
  );

-- INSERT TRANSACTIONS (one per registration)
INSERT INTO
  transactions (amount, type, status, created_at)
VALUES
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW()),
  (500, 'registration', 'completed', NOW());

-- REGISTRATIONS FOR U-11 MEN'S DOUBLES (t1)
INSERT INTO
  registrations (tournament_id, player_id, txn_id, created_at)
VALUES
  (1, 10, NULL, NOW());

-- REGISTRATIONS FOR MIXED DOUBLES (t2) - ALL PLAYERS
INSERT INTO
  registrations (tournament_id, player_id, created_at)
VALUES
  (2, 1, NOW()),
  (2, 2, NULL, NOW()),
  (2, 3, NOW()),
  (2, 4, NOW()),
  (2, 5, NOW()),
  (2, 6, NOW()),
  (2, 7, NOW()),
  (2, 8, NOW()),
  (2, 9, NOW()),
  (2, 10, NOW()),
  (2, 11, NOW()),
  (2, 12, NOW()),
  (2, 13, NOW()),
  (2, 14, NOW()),
  (2, 15, NOW()),
  (2, 16, NOW());

-- REGISTRATIONS FOR WOMEN'S DOUBLES (t3)
INSERT INTO
  registrations (tournament_id, player_id, created_at)
VALUES
  (2, 3, NOW()),
  (2, 4, NOW()),
  (2, 5, NOW()),
  (2, 6, NOW()),
  (2, 7, NOW()),
  (2, 8, NOW()),
  (2, 9, NOW()),
  (2, 10, NOW()),
  (2, 11, NOW()),
  (2, 12, NOW()),
  (2, 13, NOW()),
  (2, 14, NOW()),
  (2, 15, NOW()),
  (2, 16, NOW());

-- CREATE COURTS FOR VENUE v1 (SmashHub Arena)
INSERT INTO
  courts (id, venue_id, court_number)
VALUES
  (1, 1, 1),
  (2, 1, 2);

-- INSERT INITIAL RATINGS FOR ALL PLAYERS
INSERT INTO
  ratings (id, player_id, aura_mu, aura_sigma, last_updated)
VALUES
  (1, 1, 100, 8, NOW()),
  -- 1 * 100
  (2, 2, 200, 8, NOW()),
  -- 2 * 100
  (3, 3, 300, 8, NOW()),
  -- 3 * 100
  (4, 4, 400, 8, NOW()),
  -- 4 * 100
  (5, 5, 500, 8, NOW()),
  -- 5 * 100
  (6, 6, 600, 8, NOW()),
  -- 6 * 100
  (7, 7, 700, 8, NOW()),
  -- 7 * 100
  (8, 8, 800, 8, NOW()),
  -- 8 * 100
  (9, 9, 900, 8, NOW()),
  -- 9 * 100
  (10, 10, 1000, 8, NOW()),
  -- 10 * 100
  (11, 11, 1100, 8, NOW()),
  -- 11 * 100
  (12, 12, 1200, 8, NOW()),
  -- 12 * 100
  (13, 13, 1300, 8, NOW()),
  -- 13 * 100
  (14, 14, 1400, 8, NOW()),
  -- 14 * 100
  (15, 15, 1500, 8, NOW()),
  -- 15 * 100
  (16, 16, 1600, 8, NOW());

-- 16 * 100