# Feature Enhancement Roadmap

## Overview
Transform Live Presence into a location-based social platform with map interface, posts/feeds, and enhanced messaging.

## Phase 1: Backend - Posts System (Days 1-2)

### 1.1 Database Schema
```sql
-- Posts table
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    interest VARCHAR(50),
    location_lat DOUBLE PRECISION NOT NULL,
    location_lon DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326), -- PostGIS for proximity queries
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0
);

CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_interest ON posts(interest);

-- Post likes
CREATE TABLE post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Post comments
CREATE TABLE post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Backend Files to Create
- `PostEntity.java` - Post model
- `PostRepository.java` - JPA repository with proximity queries
- `PostController.java` - REST endpoints
- `PostService.java` - Business logic
- Similar for Likes and Comments

### 1.3 API Endpoints
```
POST   /api/posts              - Create post
GET    /api/posts/feed         - Get feed (proximity-based)
GET    /api/posts/:id          - Get single post
DELETE /api/posts/:id          - Delete post
POST   /api/posts/:id/like     - Like/unlike post
POST   /api/posts/:id/comment  - Add comment
GET    /api/posts/:id/comments - Get comments
```

## Phase 2: Enhanced Chat System (Days 3-4)

### 2.1 Database Optimization
```sql
-- Add indexes for chat performance
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX idx_conversations_participants ON conversations(user1_id, user2_id);

-- Add unread count
ALTER TABLE conversations ADD COLUMN user1_unread INT DEFAULT 0;
ALTER TABLE conversations ADD COLUMN user2_unread INT DEFAULT 0;
ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMP;
```

### 2.2 Message Pagination
- Load last 50 messages initially
- Implement infinite scroll loading
- Archive messages older than 90 days to cold storage

### 2.3 Real-time Features
- Typing indicators via WebSocket
- Online/offline status
- Message read receipts
- Push notifications (browser notifications)

## Phase 3: Map Interface (Days 5-6)

### 3.1 Technology
- **Leaflet.js** (lightweight, free) or **Mapbox GL JS** (better performance)
- OpenStreetMap tiles (free) or Mapbox tiles
- Custom marker icons with user avatars

### 3.2 Features
- Show logged-in users within radius
- Green dot overlay for "live" users
- Click marker to see profile & start chat
- Radius slider (1-20km)
- Interest filter buttons
- Current location tracking
- Smooth marker animations

### 3.3 Frontend Components
```
src/
  components/
    Map/
      MapView.jsx          - Main map component
      UserMarker.jsx       - Custom marker with avatar
      RadiusControl.jsx    - Radius slider
      InterestFilter.jsx   - Interest buttons
```

## Phase 4: Feed System (Days 7-8)

### 4.1 Feed Page Layout
```
┌─────────────────────────────────────┐
│  VibeMap Header                     │
├─────────────────────────────────────┤
│  [All] [Travelling] [Clubbing] ... │ <- Interest filters
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ What's on your mind?          │  │ <- Post composer
│  │ [Image] [Location] [Interest] │  │
│  │           [Post Button]       │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ 👤 User Name · 2h · 🎵 Music │  │
│  │ "Great concert tonight at..." │  │ <- Post
│  │ [❤️ 12] [💬 5] [Share]         │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 👤 Another User · 5h          │  │
│  │ "Looking for gym buddy..."    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 4.2 Components
- PostComposer.jsx
- PostCard.jsx
- PostFeed.jsx
- CommentSection.jsx
- LikeButton.jsx

## Phase 5: Live Status System (Days 9-10)

### 5.1 Backend Changes
```java
// Add to UserEntity
@Column(name = "is_live")
private Boolean isLive = false;

// Update PresenceController
@PostMapping("/heartbeat")
public void heartbeat(@RequestBody HeartbeatRequest req) {
    // Update location + live status
    userService.updateLiveStatus(userId, req.isLive());
}
```

### 5.2 Frontend
- "Go Live" toggle button
- Green dot indicator on map markers
- Live users filter
- Auto-update live status every 30s

## Phase 6: Performance & Scalability (Days 11-12)

### 6.1 Caching Strategy
```java
@Cacheable(value = "feed", key = "#userId + '-' + #radius")
public List<Post> getFeed(Long userId, double lat, double lon, int radius);

@CacheEvict(value = "feed", allEntries = true)
public void createPost(Post post);
```

### 6.2 Database Optimization
- Connection pooling (HikariCP already configured)
- Read replicas for feed queries
- Partitioning messages table by month
- Archive old messages to S3

### 6.3 Message Storage Scalability
```
Strategy:
1. Hot storage (PostgreSQL): Last 90 days, full-text search
2. Warm storage (PostgreSQL archive): 90-365 days
3. Cold storage (S3): 1+ years, compressed JSON
4. Implement background job to move messages
```

## Phase 7: UI Polish & Testing (Days 13-14)

### 7.1 UI Enhancements
- Loading skeletons
- Empty states
- Error boundaries
- Toast notifications
- Smooth animations
- Responsive design (mobile-first)

### 7.2 Testing
- Unit tests for services
- Integration tests for APIs
- E2E tests with Playwright
- Load testing (JMeter) for 1000+ concurrent users

## Implementation Priority

### Must Have (MVP)
1. ✅ Map interface with user markers
2. ✅ Radius control (1-20km)
3. ✅ Posts creation & feed
4. ✅ Proximity-based feed filtering
5. ✅ Live status toggle & indicator
6. ✅ Enhanced chat window

### Should Have
1. Post likes & comments
2. Image uploads for posts
3. Typing indicators
4. Message pagination
5. Profile avatars

### Nice to Have
1. Push notifications
2. Read receipts
3. Message search
4. Post sharing
5. User blocking/reporting

## Technology Stack

### Frontend
- React 18
- Leaflet.js / Mapbox GL JS
- Socket.IO / STOMP WebSocket
- React Query (for caching)
- Tailwind CSS (optional, for faster styling)

### Backend
- Spring Boot 3.3.5
- PostgreSQL 16 with PostGIS
- Redis (caching & real-time)
- WebSocket (STOMP)
- AWS S3 (file storage)

### Infrastructure
- Docker Compose (local)
- AWS ECS Fargate (production)
- CloudFront CDN
- ElastiCache Redis

## Estimated Timeline
- Total: 14 days for full implementation
- MVP (Phase 1-3): 6 days
- Complete: 14 days

## Next Steps
1. Install required npm packages (leaflet, etc.)
2. Create backend entities and repositories
3. Build map interface
4. Implement posts system
5. Enhance chat UI
6. Test and iterate

---

Ready to start implementation! Let me know which phase to begin with or if you want to proceed in order.
