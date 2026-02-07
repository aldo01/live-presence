import React, { useState, useEffect } from "react";
import { getMe, updateProfile, updateAvatar } from "../api";

export default function ProfileEdit({ auth, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [interest, setInterest] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profilePublic, setProfilePublic] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getMe();
      setProfile(data);
      setDisplayName(data.displayName || "");
      setBio(data.bio || "");
      setGender(data.gender || "");
      setInterest(data.interest || "");
      setAvatarUrl(data.avatarUrl || "");
      setProfilePublic(data.profilePublic !== false);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage("");
    try {
      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        gender: gender.trim(),
        interest: interest.trim(),
        profilePublic: profilePublic
      });
      
      if (avatarUrl !== (profile?.avatarUrl || "")) {
        await updateAvatar(avatarUrl);
      }

      setMessage("✅ Profile updated successfully!");
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setMessage("❌ " + (err.message || "Failed to update profile"));
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      }}>
        <div style={{ color: "white", fontSize: "20px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "40px 20px",
      overflow: "auto"
    }}>
      {/* Header */}
      <div style={{
        maxWidth: "600px",
        margin: "0 auto 30px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h1 style={{
          color: "white",
          fontSize: "28px",
          fontWeight: "700",
          margin: 0
        }}>
          Edit Profile
        </h1>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            color: "white",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ✕
        </button>
      </div>

      {/* Profile Card */}
      <div style={{
        maxWidth: "600px",
        margin: "0 auto",
        background: "white",
        borderRadius: "20px",
        padding: "40px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        {/* Avatar Section */}
        <div style={{
          textAlign: "center",
          marginBottom: "30px"
        }}>
          <div style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            margin: "0 auto 20px",
            background: avatarUrl 
              ? `url(${avatarUrl}) center/cover`
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "48px",
            fontWeight: "700",
            boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)"
          }}>
            {!avatarUrl && displayName.charAt(0).toUpperCase()}
          </div>
          
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Enter avatar URL"
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              textAlign: "center"
            }}
          />
          <div style={{
            fontSize: "12px",
            color: "#6b7280",
            marginTop: "8px"
          }}>
            Paste an image URL or upload to services like imgur.com
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Display Name */}
          <div>
            <label style={{
              display: "block",
              fontWeight: "600",
              fontSize: "14px",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "2px solid #e5e7eb",
                fontSize: "15px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
            />
            <div style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "4px",
              textAlign: "right"
            }}>
              {displayName.length}/100
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label style={{
              display: "block",
              fontWeight: "600",
              fontSize: "14px",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "2px solid #e5e7eb",
                fontSize: "15px",
                background: "#f9fafb",
                color: "#6b7280"
              }}
            />
          </div>

          {/* Bio */}
          <div>
            <label style={{
              display: "block",
              fontWeight: "600",
              fontSize: "14px",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell us about yourself..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "2px solid #e5e7eb",
                fontSize: "15px",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
            />
            <div style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "4px",
              textAlign: "right"
            }}>
              {bio.length}/500
            </div>
          </div>

          {/* Gender */}
          <div>
            <label style={{
              display: "block",
              fontWeight: "600",
              fontSize: "14px",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "2px solid #e5e7eb",
                fontSize: "15px",
                outline: "none",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="">Prefer not to say</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Interest */}
          <div>
            <label style={{
              display: "block",
              fontWeight: "600",
              fontSize: "14px",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Interest
            </label>
            <select
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "2px solid #e5e7eb",
                fontSize: "15px",
                outline: "none",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="General">General</option>
              <option value="Sports">Sports</option>
              <option value="Music">Music</option>
              <option value="Food">Food</option>
              <option value="Tech">Tech</option>
              <option value="Art">Art</option>
              <option value="Travel">Travel</option>
              <option value="Gaming">Gaming</option>
            </select>
          </div>

          {/* Profile Privacy */}
          <div>
            <label style={{
              display: "block",
              fontWeight: "600",
              fontSize: "14px",
              marginBottom: "8px",
              color: "#374151"
            }}>
              Profile Privacy
            </label>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "2px solid #e5e7eb",
              background: "#f9fafb"
            }}>
              <input
                type="checkbox"
                id="profilePublic"
                checked={profilePublic}
                onChange={(e) => setProfilePublic(e.target.checked)}
                style={{
                  width: "18px",
                  height: "18px",
                  cursor: "pointer"
                }}
              />
              <label htmlFor="profilePublic" style={{
                fontSize: "14px",
                color: "#374151",
                cursor: "pointer",
                userSelect: "none"
              }}>
                <strong>Public Profile</strong> - Allow others to view your posts and profile details
              </label>
            </div>
            <div style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "6px",
              paddingLeft: "4px"
            }}>
              {profilePublic 
                ? "✅ Your profile is public - others can see your posts, bio, and interests" 
                : "🔒 Your profile is private - others can only see your name and picture"}
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            marginTop: "20px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
            color: message.startsWith("✅") ? "#065f46" : "#991b1b",
            fontSize: "14px",
            fontWeight: "500",
            textAlign: "center"
          }}>
            {message}
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginTop: "30px"
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "2px solid #e5e7eb",
              background: "white",
              color: "#374151",
              fontWeight: "600",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: loading 
                ? "#9ca3af" 
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              fontWeight: "600",
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)"
            }}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
