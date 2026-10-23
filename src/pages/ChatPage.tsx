import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, Menu, Plus, Square, Trash2 } from "lucide-react";
import { API_BASE } from "../lib/api";
import MarkdownMessage from "../components/MarkdownMessage";
import { Button } from "../components/ui/button";
import type { Chat, ChatMessage } from "../types/chat";

const CHATS_KEY = "qwen-local-chats-v1";
const PREFS_KEY = "qwen-local-search-preferences-v1";

type QueuedPrompt = { id: string; chatId: string; text: string };
type StreamState = { chatId: string; content: string } | null;
type AssistantProfile = { name: string; persona: string; context: string; avatar: string };

function validProfileAvatar(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 700000
    && (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value)
      || /^https?:\/\/\S+$/i.test(value));
}

function readProfile(): AssistantProfile {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      name: typeof saved.profileName === "string" ? saved.profileName : "",
      persona: typeof saved.profilePersona === "string" ? saved.profilePersona : "",
      context: typeof saved.profileContext === "string" ? saved.profileContext : "",
      avatar: validProfileAvatar(saved.profileAvatar) ? saved.profileAvatar : "",
    };
  } catch {
    return { name: "", persona: "", context: "", avatar: "" };
  }
}

function readChats(): Chat[] {
  try {
    const chats = JSON.parse(localStorage.getItem(CHATS_KEY) || "[]");
    return Array.isArray(chats) ? chats.filter((chat) => chat && Array.isArray(chat.messages)) : [];
  } catch {
    return [];
  }
}

function readSearchPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      webSearch: typeof saved.webSearchEnabled === "boolean" ? saved.webSearchEnabled : true,
      imageSearch: typeof saved.imageSearchEnabled === "boolean" ? saved.imageSearchEnabled : true,
    };
  } catch {
    return { webSearch: true, imageSearch: true };
  }
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>(readChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(() => readChats()[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [queue, setQueue] = useState<QueuedPrompt[]>([]);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<StreamState>(null);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preferences] = useState(readSearchPreferences);
  const [assistantName, setAssistantName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}").assistantName || "Assistant";
    } catch {
      return "Assistant";
    }
  });
  const [profile, setProfile] = useState<AssistantProfile>(readProfile);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatsRef = useRef(chats);
  const activeIdRef = useRef(activeChatId);
  const queueRef = useRef(queue);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pinnedToBottom = useRef(true);

  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { activeIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { localStorage.setItem(CHATS_KEY, JSON.stringify(chats)); }, [chats]);
  useEffect(() => {
    const updateName = (event: Event) => setAssistantName((event as CustomEvent<string>).detail || "Assistant");
    window.addEventListener("assistant-name-change", updateName);
    return () => window.removeEventListener("assistant-name-change", updateName);
  }, []);
  useEffect(() => {
    const updateProfile = (event: Event) => {
      const detail = (event as CustomEvent<AssistantProfile>).detail;
      setProfile({
        name: typeof detail.name === "string" ? detail.name : "",
        persona: typeof detail.persona === "string" ? detail.persona : "",
        context: typeof detail.context === "string" ? detail.context : "",
        avatar: validProfileAvatar(detail.avatar) ? detail.avatar : "",
      });
    };
    window.addEventListener("profile-change", updateProfile);
    return () => window.removeEventListener("profile-change", updateProfile);
  }, []);

  const updateChats = useCallback((updater: (current: Chat[]) => Chat[]) => {
    setChats((current) => {
      const next = updater(current);
      chatsRef.current = next;
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const node = listRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const visibleStream = stream?.chatId === activeChatId ? stream.content : null;

  useEffect(() => {
    if (pinnedToBottom.current) scrollToBottom(false);
  }, [activeChat?.messages.length, visibleStream, scrollToBottom]);

  const startPrompt = useCallback(async (text: string, requestedChatId: string | null) => {
    if (busyRef.current) {
      const targetChatId = requestedChatId || activeIdRef.current || makeId();
      if (!activeIdRef.current) {
        activeIdRef.current = targetChatId;
        setActiveChatId(targetChatId);
      }
      setQueue((current) => {
        const next = [...current, { id: makeId(), chatId: targetChatId, text }];
        queueRef.current = next;
        return next;
      });
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    const currentChatId = requestedChatId || activeIdRef.current || makeId();
    activeIdRef.current = currentChatId;
    setActiveChatId(currentChatId);

    let chat = chatsRef.current.find((item) => item.id === currentChatId);
    if (!chat) {
      chat = { id: currentChatId, title: text.slice(0, 52), messages: [], updatedAt: Date.now() };
    }
    const userMessage: ChatMessage = { role: "user", content: text };
    const priorMessages = chat.messages;
    const messages = [...priorMessages, userMessage];
    updateChats((current) => {
      const found = current.some((item) => item.id === currentChatId);
      const nextChat = { ...chat!, messages, updatedAt: Date.now() };
      return found
        ? current.map((item) => item.id === currentChatId ? nextChat : item)
        : [nextChat, ...current];
    });
    setSidebarOpen(false);

    const controller = new AbortController();
    abortRef.current = controller;
    let responseText = "";
    let sources: ChatMessage["sources"] = [];
    let images: ChatMessage["images"] = [];
    setStream({ chatId: currentChatId, content: "" });
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          web_search: preferences.webSearch,
          image_search: preferences.imageSearch,
          memory_context: [
            profile.name.trim() ? `AI display name: ${profile.name.trim()}.` : "",
            profile.persona.trim() ? `Assistant persona: ${profile.persona.trim()}` : "",
            profile.context.trim() ? `Initial context for the assistant: ${profile.context.trim()}` : "",
          ].filter(Boolean),
          knowledge_pool_data: [],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error("Streaming is not available in this environment.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const eventText of events) {
          const data = eventText.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
          if (!data) continue;
          const event = JSON.parse(data);
          if (event.error) throw new Error(event.error);
          if (Array.isArray(event.sources)) sources = event.sources;
          if (Array.isArray(event.images)) images = event.images;
          if (event.token) {
            const node = listRef.current;
            pinnedToBottom.current = !node || node.scrollHeight - node.scrollTop - node.clientHeight < 120;
            responseText += event.token;
            setStream({ chatId: currentChatId, content: responseText });
          }
          if (event.done) finished = true;
        }
        if (done) break;
      }
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: responseText || "I couldn't generate a response. Please try again.",
        sources,
        images,
      };
      updateChats((current) => current.map((item) => item.id === currentChatId
        ? { ...item, messages: [...item.messages, assistantMessage], updatedAt: Date.now() }
        : item));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        const stoppedMessage: ChatMessage = {
          role: "assistant",
          content: responseText ? `${responseText}\n\n(Response stopped)` : "Response stopped.",
          sources,
          images,
        };
        updateChats((current) => current.map((item) => item.id === currentChatId
          ? { ...item, messages: [...item.messages, stoppedMessage], updatedAt: Date.now() }
          : item));
      } else {
        setError(reason instanceof Error ? reason.message : String(reason));
        updateChats((current) => current.map((item) => item.id === currentChatId
          ? { ...item, messages: [...item.messages, { role: "assistant", content: "The response failed. Please try again." }], updatedAt: Date.now() }
          : item));
      }
    } finally {
      abortRef.current = null;
      setStream(null);
      busyRef.current = false;
      setBusy(false);
      const [next, ...remaining] = queueRef.current;
      queueRef.current = remaining;
      setQueue(remaining);
      if (next) void startPrompt(next.text, next.chatId);
      else textareaRef.current?.focus();
    }
  }, [preferences.imageSearch, preferences.webSearch, updateChats]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void startPrompt(text, activeIdRef.current);
  };

  const newChat = () => {
    const nextId = makeId();
    activeIdRef.current = nextId;
    setActiveChatId(nextId);
    pinnedToBottom.current = true;
    setSidebarOpen(false);
    textareaRef.current?.focus();
  };

  const deleteChat = (id: string) => {
    updateChats((current) => current.filter((chat) => chat.id !== id));
    if (activeChatId === id) {
      const remaining = chats.filter((chat) => chat.id !== id);
      const next = remaining[0]?.id ?? null;
      activeIdRef.current = next;
      setActiveChatId(next);
      pinnedToBottom.current = true;
    }
  };

  return (
    <div className="chat-layout">
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <Button className="new-chat-button" onClick={newChat}><Plus size={16} /> New chat</Button>
        <div className="sidebar-heading">RECENT</div>
        <div className="chat-history">
          {[...chats].sort((a, b) => b.updatedAt - a.updatedAt).map((chat) => (
            <div className={`history-row ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}>
              <button className="history-select" title={chat.title} onClick={() => {
                activeIdRef.current = chat.id;
                setActiveChatId(chat.id);
                pinnedToBottom.current = true;
                setSidebarOpen(false);
              }}>
                <span>{chat.title || "New conversation"}</span>
              </button>
              <button className="history-delete" aria-label={`Delete ${chat.title}`} onClick={() => deleteChat(chat.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {!chats.length && <p className="empty-history">Conversations on this device will appear here.</p>}
        </div>
        <div className="sidebar-foot"><span className="status-dot running" /> Running locally</div>
      </aside>

      <section className="chat-main">
        <div className="chat-mobile-bar">
          <button className="icon-button" aria-label="Toggle chat history" onClick={() => setSidebarOpen((open) => !open)}><Menu size={18} /></button>
          <span>{profile.name.trim() || assistantName}</span>
          <Link className="mobile-settings" to="/settings">Settings</Link>
        </div>
        <div
          className="message-list"
          ref={listRef}
          onScroll={(event) => {
            const node = event.currentTarget;
            pinnedToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
          }}
        >
          {!activeChat?.messages.length && !visibleStream ? (
            <div className="welcome-card">
              <div className="eyebrow"><span /> YOUR LOCAL AI</div>
              <h1>A good place<br />to <em>think out loud.</em></h1>
              <p>Ask a question, untangle an idea, or make something new. Your conversation stays on this device.</p>
              <p>Public web and image search can be enabled in settings.</p>
              <div className="suggestion-grid">
                {["Explain a tricky idea in a simple way", "Help me brainstorm a fresh project idea", "Help me write a clear, friendly email"].map((suggestion) => (
                  <button key={suggestion} onClick={() => void startPrompt(suggestion, activeIdRef.current)}>{suggestion}<ArrowUp size={14} /></button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {activeChat?.messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${activeChat.id}-${index}`}>
                  {message.role === "assistant"
                    ? <span className="assistant-avatar" aria-label={profile.name.trim() || assistantName}>{profile.avatar
                      ? <img src={profile.avatar} alt="" />
                      : profile.name.trim().slice(0, 1).toUpperCase() || assistantName.trim().slice(0, 1).toUpperCase() || "A"}</span>
                    : null}
                  <div className="message-body">
                    <div className="message-label">{message.role === "user" ? "YOU" : (profile.name.trim() || assistantName).toUpperCase()}</div>
                    <div className="message-text"><MarkdownMessage content={message.content} /></div>
                    {message.images?.length ? <div className="image-gallery">{message.images.map((image) => (
                      <a href={image.url || image.image} target="_blank" rel="noreferrer" key={image.image}>
                        <img src={image.thumbnail || image.image} alt={image.title} loading="lazy" />
                        <span>{image.title}</span>
                      </a>
                    ))}</div> : null}
                    {message.sources?.length ? (
                      <div className="source-list"><strong>Sources</strong>{message.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                      ))}</div>
                    ) : null}
                  </div>
                </article>
              ))}
              {visibleStream !== null && (
                <article className="message assistant">
                  <span className="assistant-avatar" aria-label={profile.name.trim() || assistantName}>{profile.avatar
                    ? <img src={profile.avatar} alt="" />
                    : profile.name.trim().slice(0, 1).toUpperCase() || assistantName.trim().slice(0, 1).toUpperCase() || "A"}</span>
                  <div className="message-body">
                    <div className="message-label">{(profile.name.trim() || assistantName).toUpperCase()} · TYPING</div>
                    <div className="message-text">{visibleStream || <span className="typing-indicator">Thinking…</span>}</div>
                  </div>
                </article>
              )}
              {queue.length > 0 && (
                <div className="queue-card">
                  <div className="queue-title">Queued messages ({queue.length})</div>
                  {queue.map((item, index) => <div className="queue-item" key={item.id}><span>{index + 1}</span>{item.text}</div>)}
                  <button className="text-button" onClick={() => { queueRef.current = []; setQueue([]); }}>Clear queue</button>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="composer-area">
          {error && <div className="inline-error" role="status">{error}</div>}
          <form className="composer" onSubmit={submit}>
            <textarea
              ref={textareaRef}
              aria-label="Message Assistant"
              value={draft}
              maxLength={12000}
              placeholder="Message Assistant…"
              rows={1}
              onChange={(event) => {
                setDraft(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 170)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {busy ? (
              <button type="button" className="send-button stop-button" aria-label="Stop response" title="Stop response" onClick={() => abortRef.current?.abort()}><Square size={14} fill="currentColor" /></button>
            ) : (
              <button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim()}><ArrowUp size={18} /></button>
            )}
          </form>
          <div className="composer-caption">Enter to send <span>·</span> Shift + Enter for a new line{busy && <span> · Enter queues the next message</span>}</div>
        </footer>
      </section>
    </div>
  );
}
