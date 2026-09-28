import React, { useState } from "react";
import { login } from "../api";

export default function Login({ onAuthed, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const a = await login(email, password);
      onAuthed(a);
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
  };

  return (
    <div className="ig-wrap">
      <div className="ig-grid">
        <div className="ig-phone">
          <div className="ig-phone-inner">Connect with live people 💬</div>
        </div>

        <div>
          <div className="card">
            <h1 className="brand">LiveGram</h1>
            <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
              <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="btn" type="submit">Log In</button>
              {err && <div className="error">{err}</div>}
            </form>
            <div style={{ marginTop: 14 }} className="muted">
              Tip: Open another browser / Incognito to test multiple users.
            </div>
          </div>

          <div className="card" style={{ marginTop: 14, textAlign: "center" }}>
            <span className="muted">Don’t have an account?</span>{" "}
            <button className="linkbtn" onClick={onGoRegister} style={{ marginTop: 10 }}>
              Create new account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
