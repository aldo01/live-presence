import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

console.log("Starting React app...");

try {
  const root = document.getElementById("root");
  console.log("Root element:", root);
  
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React app rendered successfully!");
} catch (error) {
  console.error("Error rendering app:", error);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">
    <h1>Error loading app</h1>
    <pre>${error.message}\n${error.stack}</pre>
  </div>`;
}
