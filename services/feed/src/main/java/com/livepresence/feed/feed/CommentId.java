package com.livepresence.feed.feed;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class CommentId implements Serializable {
  @Column(name = "post_id", length = 36)
  private String postId;

  @Column(name = "id", length = 36)
  private String id;

  public CommentId() {}

  public CommentId(String postId, String id) {
    this.postId = postId;
    this.id = id;
  }

  public String getPostId() { return postId; }
  public String getId() { return id; }

  @Override public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof CommentId other)) return false;
    return Objects.equals(postId, other.postId) && Objects.equals(id, other.id);
  }

  @Override public int hashCode() { return Objects.hash(postId, id); }
}
