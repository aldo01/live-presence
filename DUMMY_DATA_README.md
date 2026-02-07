# Inserting Dummy Data

Due to Docker I/O issues, here are alternative methods to insert the 50 dummy users and test data:

## Method 1: Using Docker Exec (if Docker is working)

```bash
# Copy the SQL file to container
docker cp insert_dummy_data.sql live-presence-postgres:/tmp/dummy_data.sql

# Execute the SQL
docker exec live-presence-postgres psql -U postgres -d livepresence -f /tmp/dummy_data.sql
```

## Method 2: Using psql Client Directly (if installed locally)

```bash
psql -h localhost -p 5432 -U postgres -d livepresence -f insert_dummy_data.sql
# Password: postgres
```

## Method 3: Manual Copy-Paste (Failsafe)

1. Open a PostgreSQL client (TablePlus, pgAdmin, DBeaver, etc.)
2. Connect to: `postgresql://postgres:postgres@localhost:5432/livepresence`
3. Open `insert_dummy_data.sql`
4. Execute the entire script

## Method 4: Using the Batch Script (Windows)

```cmd
insert_dummy_data.bat
```

## What Gets Inserted

- **50 dummy users** with varied interests (Sports, Music, Tech, Food, Art, Travel, Gaming)
- **~40-50 posts** from various users within 20km radius
- **~100 post likes** (users liking each other's posts)
- **~50 comments** on posts
- **~10 conversations** between random users
- **~40 messages** in those conversations

## Testing the Application

After inserting data:

1. Open http://localhost:3000
2. Register a new user OR login with existing: `user09@gmail.com` / `123456`
3. Click **"Go Live"** button (top right)
4. You should see ~40-50 users on the **Map view** (with green dots for live users)
5. Switch to **Feed view** to see posts
6. Click on user markers on the map to open chat
7. Adjust radius slider (1-20km) to filter nearby users
8. Filter by interests using the interest buttons

## Verifying Data

```sql
-- Check inserted data
SELECT 'Users' as table_name, COUNT(*) FROM users WHERE email LIKE '%@example.com'
UNION ALL
SELECT 'Posts', COUNT(*) FROM posts
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM messages;
```

Expected output:
- Users: 50
- Posts: 40-50
- Conversations: 10
- Messages: 40+
