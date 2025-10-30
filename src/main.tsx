import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    // sagt der App: es gibt ein Update
    window.dispatchEvent(new CustomEvent("kw_sw_update_available"));
  },
  onOfflineReady() {
    // könnte Toast senden
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);