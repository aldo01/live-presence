import React, { useMemo, useState } from "react";
import { getAuth, setAuth, clearAuth } from "./authStore";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Live from "./pages/Live.jsx";

console.log("App component loaded");

export default function App() {
  console.log("App rendering...");
  
  const [route, setRoute] = useState(() => {
    const auth = getAuth();
    console.log("Initial auth:", auth);
    return auth ? "live" : "login";
  });
  const [auth, setAuthState] = useState(getAuth());

  const go = (r) => setRoute(r);

  const onAuthed = (a) => {
    setAuth(a);
    setAuthState(a);
    setRoute("live");
  };

  const logout = () => {
    clearAuth();
    setAuthState(null);
    setRoute("login");
  };

  const topBar = useMemo(() => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: 16, borderBottom: "1px solid #eee" }}>
      <div style={{ fontWeight: 700 }}>Live Presence</div>
      <div>
        {auth ? (
          <>
            <span style={{ marginRight: 12, color: "#555" }}>{auth.displayName}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <button onClick={() => go("login")} style={{ marginRight: 8 }}>Login</button>
            <button onClick={() => go("register")}>Register</button>
          </>
        )}
      </div>
    </div>
  ), [auth]);

  return (
    <div style={{ fontFamily: "system-ui, Arial", minHeight: "100vh" }}>
      {topBar}

      {route === "register" && <Register onAuthed={onAuthed} onGoLogin={() => go("login")} />}
      {route === "login" && <Login onAuthed={onAuthed} onGoRegister={() => go("register")} />}

      {route === "live" && (
        auth ? <Live auth={auth} /> : <Login onAuthed={onAuthed} onGoRegister={() => go("register")} />
      )}
    </div>
  );
}
