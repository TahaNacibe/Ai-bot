import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ModelStatus, Persona, PersonaStatus } from "../types/chat";
import { Button } from "../components/ui/button";

const PREFERENCES_KEY = "qwen-local-search-preferences-v1";
type Tab = "general" | "personas";

type Preferences = {
  webSearchEnabled: boolean;
  imageSearchEnabled: boolean;
  darkModeEnabled: boolean;
  assistantName: string;
};

const defaults: Preferences = {
  webSearchEnabled: true,
  imageSearchEnabled: true,
  darkModeEnabled: false,
  assistantName: "Assistant",
};

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    return {
      webSearchEnabled: typeof saved.webSearchEnabled === "boolean" ? saved.webSearchEnabled : defaults.webSearchEnabled,
      imageSearchEnabled: typeof saved.imageSearchEnabled === "boolean" ? saved.imageSearchEnabled : defaults.imageSearchEnabled,
      darkModeEnabled: typeof saved.darkModeEnabled === "boolean" ? saved.darkModeEnabled : defaults.darkModeEnabled,
      assistantName: typeof saved.assistantName === "string" ? saved.assistantName.trim().slice(0, 32) || defaults.assistantName : defaults.assistantName,
    };
  } catch {
    return defaults;
  }
}

function idFromName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [preferences, setPreferences] = useState(readPreferences);
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
            <ToggleRow title="Web search" description="Include current web results and source links with messages." checked={preferences.webSearchEnabled} onChange={(checked) => setPreferences((current) => ({ ...current, webSearchEnabled: checked }))} />
            <ToggleRow title="Image search" description="Fetch public image results and show them in a gallery." checked={preferences.imageSearchEnabled} onChange={(checked) => setPreferences((current) => ({ ...current, imageSearchEnabled: checked }))} />
            <ToggleRow title="Dark mode" description="Use a deep gray and light gray color theme." checked={preferences.darkModeEnabled} onChange={(checked) => setPreferences((current) => ({ ...current, darkModeEnabled: checked }))} />
            <p className="settings-note">When enabled, search sends your message to external search providers. Preferences are saved on this device.</p>
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
