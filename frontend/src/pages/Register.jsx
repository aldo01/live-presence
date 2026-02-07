import React, { useState } from "react";
import { register } from "../api";

export default function Register({ onAuthed, onGoLogin }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const a = await register(email, password, displayName);
      onAuthed(a);
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
  };

  return (
    <div className="ig-wrap">
      <div className="ig-grid">
        <div className="ig-phone">
          <div className="ig-phone-inner">Join & chat instantly ⚡</div>
        </div>

        <div>
          <div className="card">
            <h1 className="brand">LiveGram</h1>
            <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
              <input className="input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input" placeholder="Password (min 6)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="btn" type="submit">Sign Up</button>
              {err && <div className="error">{err}</div>}
            </form>
          </div>

          <div className="card" style={{ marginTop: 14, textAlign: "center" }}>
            <span className="muted">Already have an account?</span>{" "}
            <button className="linkbtn" onClick={onGoLogin} style={{ marginTop: 10 }}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
