-- Quick Insert Dummy Data Script
-- Run this manually if Flyway migration doesn't work

-- First, verify current users
SELECT COUNT(*) as current_user_count FROM users;

-- Insert 50 dummy users (spreading around a central location)
DO $$
DECLARE
    base_lat FLOAT := 40.7128;
    base_lon FLOAT := -74.0060;
    interests TEXT[] := ARRAY['Sports', 'Music', 'Tech', 'Food', 'Art', 'Travel', 'Gaming', 'General'];
    first_names TEXT[] := ARRAY['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank', 'Grace', 'Henry', 'Isabel', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rachel', 'Sam', 'Tara', 'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zack', 'Amy', 'Brian', 'Clara', 'David', 'Eva', 'Felix', 'Gina', 'Hugo', 'Iris', 'James', 'Kelly', 'Leo', 'Maya', 'Nick', 'Oscar', 'Paula', 'Quincy', 'Ruby', 'Steve', 'Tina', 'Ulysses', 'Vera', 'Wade', 'Xena'];
    last_names TEXT[] := ARRAY['Johnson', 'Smith', 'Davis', 'Wilson', 'Brown', 'Taylor', 'Moore', 'Anderson', 'Thomas', 'Martin', 'Lee', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson'];
    user_id UUID;
    i INT;
BEGIN
    FOR i IN 1..50 LOOP
        user_id := gen_random_uuid();
        
        INSERT INTO users (id, email, password_hash, display_name, interest, live, last_location_lat, last_location_lon, created_at)
        VALUES (
            user_id,
            LOWER(first_names[i]) || '.' || LOWER(last_names[i]) || '@example.com',
            '$2a$10$dummyhash' || i,
            first_names[i] || ' ' || last_names[i],
            interests[(i % 8) + 1],
            (RANDOM() > 0.2)::BOOLEAN, -- 80% live
            base_lat + (RANDOM() * 0.06 - 0.03), -- +/- ~3km
            base_lon + (RANDOM() * 0.08 - 0.04), -- +/- ~3km
            NOW() - (RANDOM() * INTERVAL '1 day')
        );
        
        -- Insert 1-2 posts for each user
        IF RANDOM() > 0.3 THEN
            INSERT INTO posts (id, user_id, content, interest, created_at, location_lat, location_lon)
            SELECT 
                gen_random_uuid(),
                user_id,
                CASE (RANDOM() * 5)::INT
                    WHEN 0 THEN 'Just had an amazing experience with ' || interests[(i % 8) + 1] || '! Anyone else interested?'
                    WHEN 1 THEN 'Looking for people nearby who are into ' || interests[(i % 8) + 1] || '. Let''s connect!'
                    WHEN 2 THEN 'Beautiful day today! Perfect for ' || interests[(i % 8) + 1] || ' activities 🌟'
                    WHEN 3 THEN 'Who wants to meet up? I''m into ' || interests[(i % 8) + 1] || ' and always looking for new friends!'
                    ELSE 'Great vibes today! Anyone nearby want to chat about ' || interests[(i % 8) + 1] || '?'
                END,
                interests[(i % 8) + 1],
                NOW() - (RANDOM() * INTERVAL '3 hours'),
                base_lat + (RANDOM() * 0.06 - 0.03),
                base_lon + (RANDOM() * 0.08 - 0.04);
        END IF;
    END LOOP;
    
    RAISE NOTICE '50 users inserted successfully!';
END $$;

-- Add some likes (users liking random posts)
INSERT INTO post_likes (id, post_id, user_id, created_at)
SELECT 
    gen_random_uuid(),
    p.id,
    u.id,
    NOW() - (RANDOM() * INTERVAL '2 hours')
FROM posts p
CROSS JOIN LATERAL (
    SELECT id FROM users WHERE email LIKE '%@example.com' ORDER BY RANDOM() LIMIT 3
) u
WHERE NOT EXISTS (
    SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = u.id
)
LIMIT 100;

-- Add some comments
INSERT INTO post_comments (id, post_id, user_id, content, created_at)
SELECT 
    gen_random_uuid(),
    p.id,
    u.id,
    CASE (RANDOM() * 5)::INT
        WHEN 0 THEN 'Great post! Love this!'
        WHEN 1 THEN 'Totally agree! Let''s connect.'
        WHEN 2 THEN 'This is amazing! Thanks for sharing.'
        WHEN 3 THEN 'Count me in! I''m nearby too.'
        ELSE 'Awesome! 👍'
    END,
    NOW() - (RANDOM() * INTERVAL '1 hour')
FROM posts p
CROSS JOIN LATERAL (
    SELECT id FROM users WHERE email LIKE '%@example.com' ORDER BY RANDOM() LIMIT 2
) u
LIMIT 50;

-- Create some conversations
INSERT INTO conversations (id, user1_id, user2_id, last_message_at, created_at)
SELECT DISTINCT ON (LEAST(u1.id, u2.id), GREATEST(u1.id, u2.id))
    gen_random_uuid(),
    u1.id,
    u2.id,
    NOW() - (RANDOM() * INTERVAL '2 hours'),
    NOW() - (RANDOM() * INTERVAL '4 hours')
FROM (SELECT id FROM users WHERE email LIKE '%@example.com' ORDER BY RANDOM() LIMIT 15) u1
CROSS JOIN (SELECT id FROM users WHERE email LIKE '%@example.com' ORDER BY RANDOM() LIMIT 15) u2
WHERE u1.id < u2.id
LIMIT 10;

-- Add messages to conversations
INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
SELECT 
    gen_random_uuid(),
    c.id,
    CASE WHEN RANDOM() < 0.5 THEN c.user1_id ELSE c.user2_id END,
    CASE (RANDOM() * 8)::INT
        WHEN 0 THEN 'Hey! How are you?'
        WHEN 1 THEN 'I saw your post, very cool!'
        WHEN 2 THEN 'Want to meet up sometime?'
        WHEN 3 THEN 'Great to connect with you!'
        WHEN 4 THEN 'I''m nearby too! Small world.'
        WHEN 5 THEN 'That sounds amazing!'
        WHEN 6 THEN 'Absolutely! Let''s do it.'
        ELSE 'Thanks for connecting!'
    END,
    NOW() - (RANDOM() * INTERVAL '3 hours')
FROM conversations c
CROSS JOIN generate_series(1, 3)
LIMIT 40;

-- Show summary
SELECT 
    'Users' as table_name, COUNT(*) as count FROM users WHERE email LIKE '%@example.com'
UNION ALL
SELECT 'Posts', COUNT(*) FROM posts
UNION ALL
SELECT 'Post Likes', COUNT(*) FROM post_likes
UNION ALL
SELECT 'Post Comments', COUNT(*) FROM post_comments
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM messages;
