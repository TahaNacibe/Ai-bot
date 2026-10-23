import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import type { ModelStatus, Persona, PersonaStatus } from "../types/chat";
import { Button } from "../components/ui/button";

const PREFERENCES_KEY = "qwen-local-search-preferences-v1";
type Tab = "general" | "profile" | "personas";

type Preferences = {
  webSearchEnabled: boolean;
  imageSearchEnabled: boolean;
  darkModeEnabled: boolean;
  assistantName: string;
  profileName: string;
  profilePersona: string;
  profileContext: string;
  profileAvatar: string;
};

const defaults: Preferences = {
  webSearchEnabled: true,
  imageSearchEnabled: true,
  darkModeEnabled: false,
  assistantName: "Assistant",
  profileName: "",
  profilePersona: "",
  profileContext: "",
  profileAvatar: "",
};

function validProfileAvatar(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 700000
    && (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value)
      || /^https?:\/\/\S+$/i.test(value));
}

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    return {
      webSearchEnabled: typeof saved.webSearchEnabled === "boolean" ? saved.webSearchEnabled : defaults.webSearchEnabled,
      imageSearchEnabled: typeof saved.imageSearchEnabled === "boolean" ? saved.imageSearchEnabled : defaults.imageSearchEnabled,
      darkModeEnabled: typeof saved.darkModeEnabled === "boolean" ? saved.darkModeEnabled : defaults.darkModeEnabled,
      assistantName: typeof saved.assistantName === "string" ? saved.assistantName.trim().slice(0, 32) || defaults.assistantName : defaults.assistantName,
      profileName: typeof saved.profileName === "string" ? saved.profileName.slice(0, 48) : defaults.profileName,
      profilePersona: typeof saved.profilePersona === "string" ? saved.profilePersona.slice(0, 1000) : defaults.profilePersona,
      profileContext: typeof saved.profileContext === "string" ? saved.profileContext.slice(0, 4000) : defaults.profileContext,
      profileAvatar: validProfileAvatar(saved.profileAvatar) ? saved.profileAvatar : defaults.profileAvatar,
    };
  } catch {
    return defaults;
  }
}

function idFromName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SettingsPage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(location.search).get("tab") === "profile" ? "profile" : "general");
  const [preferences, setPreferences] = useState(readPreferences);
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(() => {
    const avatar = readPreferences().profileAvatar;
    return avatar.startsWith("data:") ? "" : avatar;
  });
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", preferences.darkModeEnabled);
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent("assistant-name-change", { detail: preferences.assistantName }));
    window.dispatchEvent(new CustomEvent("profile-change", {
      detail: {
        name: preferences.profileName,
        persona: preferences.profilePersona,
        context: preferences.profileContext,
        avatar: preferences.profileAvatar,
      },
    }));
  }, [preferences]);

  useEffect(() => {
    void refreshModels();
    void refreshPersonas();
  }, []);

  async function refreshModels() {
    try {
      const result = await api<ModelStatus>("/api/models");
      setModels(result.models);
      setSelectedModel(result.selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function refreshPersonas(selectId?: string) {
    try {
      const result = await api<PersonaStatus>("/api/personas");
      setPersonas(result.personas);
      const nextSelected = selectId || result.selected || result.personas[0]?.id || "";
      setSelectedPersona(nextSelected);
      const chosen = result.personas.find((persona) => persona.id === nextSelected);
      if (!editingId && chosen) selectPersonaForEdit(chosen);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function selectPersonaForEdit(persona: Persona) {
    setEditingId(persona.id);
    setName(persona.name);
    setContent(persona.content.replace(/^#\s*.*?\n\n/, "").trim());
  }

  function newPersona() {
    setEditingId(null);
    setName("");
    setContent("");
    setStatus("Creating a new persona.");
  }

  async function setProfilePhoto(file?: File) {
    if (!file) return;
    if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type) || file.size > 500_000) {
      setError("Choose a PNG, JPEG, WebP, or GIF image up to 500 KB.");
      return;
    }
    try {
      const reader = new FileReader();
      const result = await new Promise<string>((resolve, reject) => {
        reader.addEventListener("load", () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Could not read that profile photo."));
        }, { once: true });
        reader.addEventListener("error", () => reject(new Error("Could not read that profile photo.")), { once: true });
        reader.readAsDataURL(file);
      });
      if (!validProfileAvatar(result)) {
        throw new Error("Could not read that profile photo.");
      }
      setPreferences((current) => ({ ...current, profileAvatar: result }));
      setProfileAvatarDraft("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function switchPersona(id: string) {
    setSelectedPersona(id);
    if (!id) return;
    setSaving(true);
    try {
      const result = await api<PersonaStatus>("/api/persona", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      setPersonas(result.personas);
      const chosen = result.personas.find((persona) => persona.id === id);
      if (chosen) selectPersonaForEdit(chosen);
      setStatus("Active persona updated.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  async function savePersona(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const result = await api<PersonaStatus>("/api/persona/edit", {
          method: "POST",
          body: JSON.stringify({ id: editingId, name, content }),
        });
        setPersonas(result.personas);
        setStatus("Persona changes saved.");
      } else {
        const result = await api<PersonaStatus>("/api/personas", {
          method: "POST",
          body: JSON.stringify({ name, content }),
        });
        const createdId = result.created || idFromName(name);
        setPersonas(result.personas);
        setEditingId(createdId);
        setSelectedPersona(createdId);
        setStatus("Persona created and selected.");
        await api<PersonaStatus>("/api/persona", {
          method: "POST",
          body: JSON.stringify({ id: createdId }),
        });
      }
      await refreshPersonas(editingId || idFromName(name));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  async function deletePersona() {
    if (!editingId || !window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const result = await api<PersonaStatus>("/api/persona/delete", {
        method: "POST",
        body: JSON.stringify({ id: editingId }),
      });
      setPersonas(result.personas);
      setSelectedPersona(result.selected || "");
      const next = result.personas.find((persona) => persona.id === result.selected);
      if (next) selectPersonaForEdit(next);
      else newPersona();
      setStatus("Persona deleted.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  async function changeModel(model: string) {
    setSelectedModel(model);
    if (!model) return;
    setSaving(true);
    try {
      const result = await api<ModelStatus>("/api/model", {
        method: "POST",
        body: JSON.stringify({ model }),
      });
      setModels(result.models);
      setSelectedModel(result.selected);
      setStatus(`Model switched to ${result.selected}.`);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      void refreshModels();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="settings-layout">
      <aside className="settings-sidebar">
        <div className="eyebrow">PREFERENCES</div>
        <h1>Settings</h1>
        <nav className="settings-nav" aria-label="Settings sections">
          <button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}>General</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Profile</button>
          <button className={tab === "personas" ? "active" : ""} onClick={() => setTab("personas")}>Personas</button>
        </nav>
        <Link className="inline-flex h-9 items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-xs font-semibold shadow-sm hover:bg-muted back-button" to="/"><ArrowLeft size={16} /> Back to chat</Link>
      </aside>

      <section className="settings-content">
        {error && <div className="inline-error" role="alert">{error}</div>}
        {status && <div className="inline-status" role="status">{status}</div>}

        {tab === "general" ? (
          <div className="settings-panel">
            <div className="eyebrow">GENERAL</div>
            <h2>Preferences</h2>
            <label className="settings-row">
              <span><strong>Assistant name</strong><small>Choose the name shown in chats.</small></span>
              <input className="text-input name-input" maxLength={32} value={preferences.assistantName} onChange={(event) => setPreferences((current) => ({ ...current, assistantName: event.target.value }))} />
            </label>
            <label className="settings-row">
              <span><strong>Ollama model</strong><small>Switching loads this model and unloads the previous one.</small></span>
              <select className="select-input" value={selectedModel} disabled={saving} onChange={(event) => void changeModel(event.target.value)}>
                {!models.length && <option value="">No models available</option>}
                {models.map((model) => <option value={model} key={model}>{model}</option>)}
                {selectedModel && !models.includes(selectedModel) && <option value={selectedModel}>{selectedModel} (not installed)</option>}
              </select>
            </label>
            <ToggleRow title="Web search" description="Allow web search for explicit requests and questions needing current information." checked={preferences.webSearchEnabled} onChange={(checked) => setPreferences((current) => ({ ...current, webSearchEnabled: checked }))} />
            <ToggleRow title="Image search" description="Allow image search when you ask for pictures or visual examples are needed." checked={preferences.imageSearchEnabled} onChange={(checked) => setPreferences((current) => ({ ...current, imageSearchEnabled: checked }))} />
            <ToggleRow title="Dark mode" description="Use a deep gray and light gray color theme." checked={preferences.darkModeEnabled} onChange={(checked) => setPreferences((current) => ({ ...current, darkModeEnabled: checked }))} />
            <p className="settings-note">When enabled, search sends your message to external search providers. Preferences are saved on this device.</p>
          </div>
        ) : tab === "profile" ? (
          <div className="settings-panel profile-settings">
            <div className="eyebrow">AI PROFILE</div>
            <h2>Personalize your assistant</h2>
            <div className="profile-photo-editor">
              <div className="profile-photo-preview">
                {preferences.profileAvatar
                  ? <img src={preferences.profileAvatar} alt="" />
                  : <span>{preferences.profileName.trim().slice(0, 1).toUpperCase() || "A"}</span>}
              </div>
              <div className="profile-photo-actions">
                <label className="button profile-photo-picker">
                  Choose an AI profile photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => void setProfilePhoto(event.target.files?.[0])}
                  />
                </label>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => {
                    setPreferences((current) => ({ ...current, profileAvatar: "" }));
                    setProfileAvatarDraft("");
                    setError("");
                  }}
                >
                  Remove photo
                </button>
                <small>AI profile photo. PNG, JPEG, WebP, or GIF; up to 500 KB. Stored on this device.</small>
              </div>
            </div>
            <label className="field-label">Photo URL (optional)
              <input
                className="text-input"
                type="url"
                maxLength={2048}
                value={profileAvatarDraft}
                placeholder="https://example.com/photo.png"
                onChange={(event) => setProfileAvatarDraft(event.target.value)}
                onBlur={() => {
                  const value = profileAvatarDraft.trim();
                  if (!value || validProfileAvatar(value)) {
                    setPreferences((current) => ({ ...current, profileAvatar: value }));
                    setError("");
                  } else {
                    setError("Enter a valid HTTP(S) image URL.");
                  }
                }}
              />
            </label>
            <label className="field-label">AI display name
              <input className="text-input" maxLength={48} value={preferences.profileName} placeholder="Name shown for the assistant" onChange={(event) => setPreferences((current) => ({ ...current, profileName: event.target.value }))} />
            </label>
            <label className="field-label">Assistant persona
              <textarea className="text-input" maxLength={1000} rows={3} value={preferences.profilePersona} placeholder="Describe the assistant's personality and style." onChange={(event) => setPreferences((current) => ({ ...current, profilePersona: event.target.value }))} />
            </label>
            <label className="field-label">Initial context for the assistant
              <textarea className="text-input profile-context-input" maxLength={4000} rows={6} value={preferences.profileContext} placeholder="Add background context that should guide the assistant between chats." onChange={(event) => setPreferences((current) => ({ ...current, profileContext: event.target.value }))} />
            </label>
            <p className="settings-note">The AI profile is stored locally. Its name, persona, and context are sent with chat requests; the photo is not.</p>
          </div>
        ) : (
          <div className="settings-panel persona-settings">
            <div className="persona-heading">
              <div><div className="eyebrow">PERSONAS</div><h2>Manage personas</h2></div>
              <Button variant="default" onClick={newPersona}><Plus size={16} /> New persona</Button>
            </div>
            <label className="settings-row active-persona-row">
              <span><strong>Active persona</strong><small>Choose the personality used for future messages.</small></span>
              <select className="select-input" value={selectedPersona} disabled={saving} onChange={(event) => void switchPersona(event.target.value)}>
                {!personas.length && <option value="">No personas available</option>}
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.name}</option>)}
              </select>
            </label>
            <div className="persona-editor-layout">
              <div className="persona-list" aria-label="Persona list">
                {personas.map((persona) => (
                  <button key={persona.id} className={editingId === persona.id ? "selected" : ""} onClick={() => selectPersonaForEdit(persona)}>
                    <span className="persona-initial">{persona.name.slice(0, 1).toUpperCase()}</span>
                    <span>{persona.name}</span>
                    {persona.id === selectedPersona && <span className="active-mark">Active</span>}
                  </button>
                ))}
              </div>
              <form className="persona-form" onSubmit={(event) => void savePersona(event)}>
                <label className="field-label">Persona name
                  <input className="text-input" maxLength={48} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Analyst" required />
                </label>
                <label className="field-label">System instructions
                  <textarea className="text-input persona-textarea" maxLength={8000} rows={9} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Describe how this persona should answer" required />
                </label>
                <div className="persona-actions">
                  <Button variant="default" type="submit" disabled={saving}><Save size={15} /> {editingId ? "Save changes" : "Create persona"}</Button>
                  {editingId && <Button variant="destructive" type="button" disabled={saving} onClick={() => void deletePersona()}><Trash2 size={15} /> Delete</Button>}
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ToggleRow({ title, description, checked, onChange }: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <span><strong>{title}</strong><small>{description}</small></span>
      <input className="toggle-input" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
