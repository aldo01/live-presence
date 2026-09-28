package com.example.presence.user;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.presence.auth.JwtAuthFilter.JwtPrincipal;
import com.example.presence.feed.PostRepository;

@RestController
@RequestMapping("/api")
public class ProfileController {

  private final UserRepository userRepo;
  private final PostRepository postRepo;

  @Autowired
  private UserFollowRepository userFollowRepo;

  public ProfileController(UserRepository userRepo, PostRepository postRepo) {
    this.userRepo = userRepo;
    this.postRepo = postRepo;
  }

  // ---------- DTOs ----------
  public record UpdateInterestRequest(String interest) {}
  public record UpdateLiveRequest(boolean live) {}
  public record UpdateProfileRequest(String displayName, String bio, String gender, String interest, Boolean profilePublic) {}
  public record UpdateAvatarRequest(String avatarUrl) {}
  public record ChangePasswordRequest(String currentPassword, String newPassword) {}
  public record MeResponse(String userId, String email, String displayName, String interest, boolean live, String avatarUrl, String bio, String gender, boolean profilePublic) {}
  public record UserProfileResponse(String userId, String displayName, String interest, String avatarUrl, String bio, String gender, boolean isLive, boolean profilePublic, java.util.List<PostSummary> posts) {}
  public record PostSummary(String id, String content, String interest, String imageUrl, java.time.LocalDateTime createdAt, int likesCount, int commentsCount) {}

  // ---------- GET /me ----------
  @GetMapping("/me")
  public ResponseEntity<?> me(@AuthenticationPrincipal JwtPrincipal p) {
    var u = userRepo.findById(UUID.fromString(p.subject())).orElseThrow();
    return ResponseEntity.ok(
        new MeResponse(
            u.getId().toString(),
            u.getEmail(),
            u.getDisplayName(),
            u.getInterest(),
            u.isLive(),
            u.getAvatarUrl(),
            u.getBio(),
            u.getGender(),
            u.isProfilePublic()
        )
    );
  }

  // ---------- PUT /me/interest ----------
  @PutMapping("/me/interest")
  public ResponseEntity<?> updateInterest(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestBody UpdateInterestRequest req
  ) {
    String interest = (req.interest() == null ? "" : req.interest().trim());
    if (interest.isBlank() || interest.length() > 120) {
      return ResponseEntity.badRequest().body("interest must be 1..120 chars");
    }

    var u = userRepo.findById(UUID.fromString(p.subject())).orElseThrow();
    u.setInterest(interest);
    userRepo.save(u);

    return ResponseEntity.noContent().build();
  }

  // ---------- PUT /me/live ----------
  @PutMapping("/me/live")
  public ResponseEntity<?> updateLiveStatus(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestBody UpdateLiveRequest req
  ) {
    var u = userRepo.findById(UUID.fromString(p.subject())).orElseThrow();

    boolean live = req.live();
    u.setLive(live);
    userRepo.save(u);

    // Redis presence is owned exclusively by the presence-service. The client
    // resumes/stops heartbeats based on this flag; TTL removes stale entries.
    return ResponseEntity.noContent().build();
  }

  // ---------- PUT /me/profile ----------
  @PutMapping("/me/profile")
  public ResponseEntity<?> updateProfile(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestBody UpdateProfileRequest req
  ) {
    var u = userRepo.findById(UUID.fromString(p.subject())).orElseThrow();

    if (req.displayName() != null && !req.displayName().isBlank()) {
      if (req.displayName().length() > 100) {
        return ResponseEntity.badRequest().body("Display name too long (max 100 chars)");
      }
      u.setDisplayName(req.displayName().trim());
    }

    if (req.bio() != null) {
      if (req.bio().length() > 500) {
        return ResponseEntity.badRequest().body("Bio too long (max 500 chars)");
      }
      u.setBio(req.bio().trim());
    }

    if (req.gender() != null) {
      u.setGender(req.gender().trim());
    }

    if (req.interest() != null && !req.interest().isBlank()) {
      if (req.interest().length() > 120) {
        return ResponseEntity.badRequest().body("Interest too long (max 120 chars)");
      }
      u.setInterest(req.interest().trim());
    }

    if (req.profilePublic() != null) {
      u.setProfilePublic(req.profilePublic());
    }

    userRepo.save(u);
    return ResponseEntity.ok("Profile updated successfully");
  }

  // ---------- PUT /me/avatar ----------
  @PutMapping("/me/avatar")
  public ResponseEntity<?> updateAvatar(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestBody UpdateAvatarRequest req
  ) {
    var u = userRepo.findById(UUID.fromString(p.subject())).orElseThrow();
    u.setAvatarUrl(req.avatarUrl());
    userRepo.save(u);
    return ResponseEntity.ok("Avatar updated successfully");
  }

  // ---------- PUT /me/password ----------
  @PutMapping("/me/password")
  public ResponseEntity<?> changePassword(
      @AuthenticationPrincipal JwtPrincipal p,
      @RequestBody ChangePasswordRequest req
  ) {
    // This will be implemented with password encoder
    return ResponseEntity.status(501).body("Password change not yet implemented");
  }

  // ---------- GET /users/:userId/profile ----------
  @GetMapping("/users/{userId}/profile")
  public ResponseEntity<?> getUserProfile(
      @PathVariable String userId,
      @AuthenticationPrincipal JwtPrincipal p
  ) {
    try {
      UUID targetUserId = UUID.fromString(userId);
      var targetUser = userRepo.findById(targetUserId)
          .orElseThrow(() -> new RuntimeException("User not found"));

      // If profile is private and not own profile, return limited info
      boolean isOwnProfile = p != null && p.subject().equals(userId);
      if (!targetUser.isProfilePublic() && !isOwnProfile) {
        return ResponseEntity.ok(new UserProfileResponse(
            targetUser.getId().toString(),
            targetUser.getDisplayName(),
            null, // Hide interest
            targetUser.getAvatarUrl(),
            null, // Hide bio
            null, // Hide gender
            targetUser.isLive(),
            false, // Profile is private
            java.util.Collections.emptyList() // No posts
        ));
      }

      // Get user's posts (last 20)
      var posts = postRepo.findByUser_IdOrderByCreatedAtDesc(
          targetUserId,
          PageRequest.of(0, 20)
      );

      var postSummaries = posts.stream()
          .map(post -> new PostSummary(
              post.getId().toString(),
              post.getContent(),
              post.getInterest(),
              post.getImageUrl(),
              post.getCreatedAt(),
              post.getLikesCount(),
              post.getCommentsCount()
          ))
          .toList();

      return ResponseEntity.ok(new UserProfileResponse(
          targetUser.getId().toString(),
          targetUser.getDisplayName(),
          targetUser.getInterest(),
          targetUser.getAvatarUrl(),
          targetUser.getBio(),
          targetUser.getGender(),
          targetUser.isLive(),
          targetUser.isProfilePublic(),
          postSummaries
      ));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body("Failed to fetch user profile: " + e.getMessage());
    }
  }

  // ---------- POST /users/{id}/follow ----------
  @PostMapping("/users/{id}/follow")
  public ResponseEntity<?> followUser(
      @AuthenticationPrincipal JwtPrincipal p,
      @PathVariable String id
  ) {
    try {
      UUID followerId = UUID.fromString(p.subject());
      UUID followingId = UUID.fromString(id);

      if (followerId.equals(followingId)) {
        return ResponseEntity.badRequest().body("Cannot follow yourself");
      }

      // Check if already following
      if (userFollowRepo.findByFollowerIdAndFollowingId(followerId, followingId).isPresent()) {
        return ResponseEntity.ok().body("Already following");
      }

      // Create follow relationship
      UserFollowEntity follow = new UserFollowEntity();
      follow.setFollowerId(followerId);
      follow.setFollowingId(followingId);
      userFollowRepo.save(follow);

      return ResponseEntity.ok().body("Followed successfully");
    } catch (Exception e) {
      return ResponseEntity.badRequest().body("Failed to follow user: " + e.getMessage());
    }
  }

  // ---------- DELETE /users/{id}/follow ----------
  @DeleteMapping("/users/{id}/follow")
  public ResponseEntity<?> unfollowUser(
      @AuthenticationPrincipal JwtPrincipal p,
      @PathVariable String id
  ) {
    try {
      UUID followerId = UUID.fromString(p.subject());
      UUID followingId = UUID.fromString(id);

      userFollowRepo.deleteByFollowerIdAndFollowingId(followerId, followingId);
      return ResponseEntity.ok().body("Unfollowed successfully");
    } catch (Exception e) {
      return ResponseEntity.badRequest().body("Failed to unfollow user: " + e.getMessage());
    }
  }

  // ---------- GET /users/{id}/follow-status ----------
  @GetMapping("/users/{id}/follow-status")
  public ResponseEntity<?> getFollowStatus(
      @AuthenticationPrincipal JwtPrincipal p,
      @PathVariable String id
  ) {
    try {
      UUID followerId = UUID.fromString(p.subject());
      UUID followingId = UUID.fromString(id);

      boolean isFollowing = userFollowRepo.findByFollowerIdAndFollowingId(followerId, followingId).isPresent();
      return ResponseEntity.ok(new FollowStatusResponse(isFollowing));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body("Failed to check follow status: " + e.getMessage());
    }
  }

  // ---------- DTO for Follow Status ----------
  public record FollowStatusResponse(boolean isFollowing) {}
}
