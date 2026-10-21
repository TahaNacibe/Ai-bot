import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import type { ModelStatus } from "../types/chat";

type ServerStatus = { state: string; detail: string };

export default function AppShell() {
  const location = useLocation();
  const [assistantName, setAssistantName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("qwen-local-search-preferences-v1") || "{}").assistantName || "Assistant";
    } catch {
      return "Assistant";
    }
  });
  const [server, setServer] = useState<ServerStatus>({ state: "starting", detail: "Starting local server…" });
  const [model, setModel] = useState("");
  const [modelError, setModelError] = useState("");

  useEffect(() => {
    const updateAssistantName = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setAssistantName(customEvent.detail || "Assistant");
    };
    window.addEventListener("assistant-name-change", updateAssistantName);
    try {
      const preferences = JSON.parse(localStorage.getItem("qwen-local-search-preferences-v1") || "{}");
      document.documentElement.classList.toggle("dark", preferences.darkModeEnabled === true);
    } catch {
      document.documentElement.classList.remove("dark");
    }
    return () => window.removeEventListener("assistant-name-change", updateAssistantName);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      setServer({ state: "running", detail: "Connected to local server" });
      return;
    }
    const unsubscribe = window.electronAPI.onServerStatus(setServer);
    window.electronAPI.getServerStatus().then(setServer).catch((error: Error) => {
      setServer({ state: "error", detail: error.message });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const status = await api<ModelStatus>("/api/models");
        if (alive) {
          setModel(status.running.includes(status.selected) ? status.selected : (status.running[0] || status.selected));
          setModelError("");
        }
      } catch (error) {
        if (alive) {
          setModelError(error instanceof Error ? error.message : String(error));
          setModel("");
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const isSettings = location.pathname === "/settings";

  return (
    <div className="desktop-app">
      <header className="app-topbar">
        <Link className="app-brand" to="/" aria-label="Local AI Chat home">
          <span className="brand-icon">A</span>
          <span>{assistantName} <span className="brand-muted">/ local</span></span>
        </Link>
        <div className="topbar-center">
          <span className={`status-dot ${server.state}`} />
          <span className="server-status" title={server.detail}>
            {server.state === "running" ? "Server running" : server.state === "starting" ? "Starting server" : "Server unavailable"}
          </span>
          <span className="topbar-separator">·</span>
          <span className="model-name" title={modelError || model}>{model || (modelError ? "Ollama offline" : "Checking model…")}</span>
        </div>
        <Link className={`icon-button ${isSettings ? "selected" : ""}`} to={isSettings ? "/" : "/settings"} aria-label={isSettings ? "Back to chat" : "Settings"} title={isSettings ? "Back to chat" : "Settings"}>
          {isSettings ? "×" : "⚙"}
        </Link>
      </header>
      {server.state === "error" && window.electronAPI && (
        <div className="server-error-banner" role="status">
          <span>{server.detail || "The local server could not start."}</span>
          <button
            className="button button-small"
            onClick={() => window.electronAPI?.restartServer().catch((error: Error) => setServer({ state: "error", detail: error.message }))}
          >
            Retry server
          </button>
        </div>
      )}
      <Outlet />
    </div>
  );
}
