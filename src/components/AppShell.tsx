import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import type { ModelStatus } from "../types/chat";

type ServerStatus = { state: string; detail: string };
type ProfileSummary = { name: string; avatar: string };

function validProfileAvatar(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 700000
    && (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value)
      || /^https?:\/\/\S+$/i.test(value));
}

export default function AppShell() {
  const location = useLocation();
  const [assistantName, setAssistantName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("qwen-local-search-preferences-v1") || "{}").assistantName || "Assistant";
    } catch {
      return "Assistant";
    }
  });
  const [profile, setProfile] = useState<ProfileSummary>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("qwen-local-search-preferences-v1") || "{}");
      return {
        name: typeof saved.profileName === "string" ? saved.profileName : "",
        avatar: validProfileAvatar(saved.profileAvatar) ? saved.profileAvatar : "",
      };
    } catch {
      return { name: "", avatar: "" };
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
    const updateProfile = (event: Event) => {
      const detail = (event as CustomEvent<ProfileSummary>).detail;
      setProfile({
        name: typeof detail.name === "string" ? detail.name : "",
        avatar: validProfileAvatar(detail.avatar) ? detail.avatar : "",
      });
    };
    window.addEventListener("assistant-name-change", updateAssistantName);
    window.addEventListener("profile-change", updateProfile);
    try {
      const preferences = JSON.parse(localStorage.getItem("qwen-local-search-preferences-v1") || "{}");
      document.documentElement.classList.toggle("dark", preferences.darkModeEnabled === true);
    } catch {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      window.removeEventListener("assistant-name-change", updateAssistantName);
      window.removeEventListener("profile-change", updateProfile);
    };
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
  const profileDisplayName = profile.name.trim() || assistantName;

  return (
    <div className="desktop-app">
      <header className="app-topbar">
        <Link className="app-brand" to="/" aria-label={`${profileDisplayName} home`}>
          <span className={`brand-icon ${profile.avatar ? "has-profile-avatar" : ""}`}>
            {profile.avatar
              ? <img src={profile.avatar} alt="" />
              : profile.name.trim().slice(0, 1).toUpperCase() || "A"}
          </span>
          <span>{profileDisplayName} <span className="brand-muted">/ local</span></span>
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
