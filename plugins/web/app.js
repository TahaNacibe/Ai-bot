const STORAGE_KEY = "qwen-local-chats-v1";
const historyList = document.querySelector("#history-list");
const messagesEl = document.querySelector("#messages");
const welcomeEl = document.querySelector("#welcome");
const form = document.querySelector("#composer");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send-button");
const menuButton = document.querySelector("#menu-button");
const settingsButton = document.querySelector("#settings-button");
const settingsPage = document.querySelector("#settings-page");
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsPanels = document.querySelectorAll(".settings-panel");
const webSearchSetting = document.querySelector("#web-search-setting");
const imageSearchSetting = document.querySelector("#image-search-setting");
const darkModeSetting = document.querySelector("#dark-mode-setting");
const assistantNameSetting = document.querySelector("#assistant-name-setting");
const modelSelect = document.querySelector("#model-select");
const modelSwitchError = document.querySelector("#model-switch-error");
const personaSelect = document.querySelector("#persona-select");
const personaStatus = document.querySelector("#persona-status");
const personaCreateForm = document.querySelector("#persona-form");
const personaNameInput = document.querySelector("#persona-name");
const personaContentInput = document.querySelector("#persona-content");
const personaCreateButton = document.querySelector("#persona-create-button");
const personaUpdateButton = document.querySelector("#persona-update-button");
const personaDeleteButton = document.querySelector("#persona-delete-button");
const runningModelName = document.querySelector("#running-model-name");
const modelRuntimeState = document.querySelector("#model-runtime-state");
const modelIndicator = document.querySelector("#model-indicator");
const electronAPI = window.electronAPI;
let chats = loadChats();
let activeChatId = null;
let busy = false;
let queuedPrompt = null;
let currentRequestAbortController = null;
let preferences = loadPreferences();
let webSearchEnabled = preferences.webSearchEnabled;
let imageSearchEnabled = preferences.imageSearchEnabled;
let darkModeEnabled = preferences.darkModeEnabled;
let assistantName = preferences.assistantName;

function mountDesktopServerStatus() {
  if (!electronAPI) return;
  const actions = document.querySelector(".topbar-actions");
  const status = document.createElement("div");
  status.className = "desktop-server-status is-starting";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.innerHTML = '<span class="desktop-server-dot" aria-hidden="true"></span><span class="desktop-server-label">Starting server</span>';
  actions.insertBefore(status, settingsButton);

  const applyStatus = ({ state, detail }) => {
    const labels = {
      starting: "Starting server",
      running: "Server running",
      error: "Server error",
      stopped: "Server stopped",
    };
    status.className = `desktop-server-status is-${state}`;
    status.title = detail || labels[state] || "Server status";
    status.querySelector(".desktop-server-label").textContent = labels[state] || "Server status";
    let retry = status.querySelector("button");
    if (state === "error" && !retry) {
      retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        try {
          await electronAPI.restartServer();
        } catch (error) {
          applyStatus({ state: "error", detail: error.message });
        } finally {
          retry.disabled = false;
        }
      });
      status.append(retry);
    } else if (state !== "error") {
      retry?.remove();
    }
  };

  electronAPI.onServerStatus(applyStatus);
  electronAPI.getServerStatus().then(applyStatus).catch((error) => {
    applyStatus({ state: "error", detail: error.message });
  });
}

function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((chat) => chat && Array.isArray(chat.messages)) : [];
  } catch {
    return [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function loadPreferences() {
  const defaults = { webSearchEnabled: true, imageSearchEnabled: true, darkModeEnabled: false, assistantName: "Assistant" };
  try {
    const saved = JSON.parse(localStorage.getItem("qwen-local-search-preferences-v1") || "{}");
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

function savePreferences() {
  preferences = { webSearchEnabled, imageSearchEnabled, darkModeEnabled, assistantName };
  localStorage.setItem("qwen-local-search-preferences-v1", JSON.stringify(preferences));
}

function syncSettingsPage() {
  webSearchSetting.checked = webSearchEnabled;
  imageSearchSetting.checked = imageSearchEnabled;
  darkModeSetting.checked = darkModeEnabled;
  assistantNameSetting.value = assistantName;
}

function setSettingsTab(tabName) {
  settingsTabs.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  settingsPanels.forEach((panel) => {
    const active = panel.dataset.panel === tabName;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function isUserAtBottom() {
  const threshold = 120;
  return window.innerHeight + window.scrollY >= document.body.scrollHeight - threshold;
}

function maybeAutoScroll() {
  if (isUserAtBottom()) {
    scrollToLatest();
  }
}

function updateModelStatus(status) {
  const models = Array.isArray(status.models) ? status.models : [];
  const selected = status.selected || "";
  const running = Array.isArray(status.running) ? status.running : [];
  const selectedIsRunning = running.includes(selected);

  const options = models.map((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    return option;
  });
  if (selected && !models.includes(selected)) {
    const option = document.createElement("option");
    option.value = selected;
    option.textContent = `${selected} (not installed)`;
    option.disabled = true;
    options.unshift(option);
  }
  modelSelect.replaceChildren(...options);
  modelSelect.value = selected;

  const visibleModel = selectedIsRunning ? selected : (running[0] || selected || "No model selected");
  runningModelName.textContent = visibleModel;
  runningModelName.title = visibleModel;
  modelRuntimeState.textContent = selectedIsRunning
    ? "RUNNING"
    : running.length ? "OTHER MODEL RUNNING" : "NOT LOADED";
  modelIndicator.classList.toggle("is-running", selectedIsRunning);
  modelIndicator.classList.toggle("is-idle", !selectedIsRunning);
}

async function refreshModelStatus() {
  try {
    const response = await fetch("/api/models", { cache: "no-store" });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updateModelStatus(status);
    return status;
  } catch (error) {
    runningModelName.textContent = "Ollama unavailable";
    runningModelName.title = error.message;
    modelRuntimeState.textContent = "OFFLINE";
    modelIndicator.classList.add("is-idle");
    modelSwitchError.textContent = error.message;
    return null;
  }
}

async function switchModel() {
  const requested = modelSelect.value;
  if (!requested) return;
  modelSelect.disabled = true;
  modelSwitchError.textContent = "";
  modelRuntimeState.textContent = "SWITCHING";
  try {
    const response = await fetch("/api/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: requested }),
    });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updateModelStatus(status);
  } catch (error) {
    modelSwitchError.textContent = error.message;
    await refreshModelStatus();
  } finally {
    modelSelect.disabled = false;
  }
}

let selectedPersonaId = "";

function resetPersonaEditor() {
  selectedPersonaId = "";
  personaNameInput.value = "";
  personaContentInput.value = "";
  personaCreateButton.classList.remove("hidden");
  personaUpdateButton.classList.add("hidden");
  personaDeleteButton.classList.add("hidden");
}

function fillPersonaEditor(persona) {
  if (!persona) {
    resetPersonaEditor();
    return;
  }
  selectedPersonaId = persona.id;
  personaNameInput.value = persona.name;
  personaContentInput.value = persona.content.replace(/^#\s*.*?\n\n/, "").trim();
  personaCreateButton.classList.add("hidden");
  personaUpdateButton.classList.remove("hidden");
  personaDeleteButton.classList.remove("hidden");
}

function updatePersonaStatus(status) {
  const personas = Array.isArray(status.personas) ? status.personas : [];
  const selected = status.selected || "";
  const options = personas.map((persona) => {
    const option = document.createElement("option");
    option.value = persona.id;
    option.textContent = persona.name;
    return option;
  });
  if (!options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No personas available";
    options.push(option);
  }
  personaSelect.replaceChildren(...options);
  personaSelect.value = selected || "";
  if (!selected && personas.length) {
    personaSelect.value = personas[0].id;
  }
  if (selectedPersonaId && !personas.some((persona) => persona.id === selectedPersonaId)) {
    resetPersonaEditor();
  }
  personaStatus.textContent = `${personas.length} persona${personas.length === 1 ? "" : "s"} available`;
}

async function refreshPersonaStatus() {
  personaStatus.textContent = "Loading personas…";
  try {
    const response = await fetch("/api/personas", { cache: "no-store" });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updatePersonaStatus(status);
    if (!selectedPersonaId && status.selected) {
      const match = status.personas.find((persona) => persona.id === status.selected);
      if (match) fillPersonaEditor(match);
    }
  } catch (error) {
    personaStatus.textContent = error.message;
  }
}

async function switchPersona() {
  const requested = personaSelect.value;
  if (!requested) return;
  personaSelect.disabled = true;
  personaStatus.textContent = "Switching persona…";
  try {
    const response = await fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requested }),
    });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updatePersonaStatus(status);
    const match = status.personas.find((persona) => persona.id === requested);
    if (match) fillPersonaEditor(match);
  } catch (error) {
    personaStatus.textContent = error.message;
    await refreshPersonaStatus();
  } finally {
    personaSelect.disabled = false;
  }
}

async function createPersona(event) {
  event.preventDefault();
  personaCreateButton.disabled = true;
  personaStatus.textContent = "Creating persona…";
  try {
    const response = await fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: personaNameInput.value, content: personaContentInput.value }),
    });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updatePersonaStatus(status);
    resetPersonaEditor();
    if (status.created) {
      personaSelect.value = status.created;
      await switchPersona();
    }
  } catch (error) {
    personaStatus.textContent = error.message;
  } finally {
    personaCreateButton.disabled = false;
  }
}

async function updateSelectedPersona() {
  if (!selectedPersonaId) return;
  personaUpdateButton.disabled = true;
  personaStatus.textContent = "Saving persona…";
  try {
    const response = await fetch("/api/persona/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedPersonaId, name: personaNameInput.value, content: personaContentInput.value }),
    });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updatePersonaStatus(status);
    const match = status.personas.find((persona) => persona.id === selectedPersonaId);
    if (match) fillPersonaEditor(match);
    personaStatus.textContent = `Saved persona “${match?.name || personaNameInput.value.trim()}”.`;
  } catch (error) {
    personaStatus.textContent = error.message;
  } finally {
    personaUpdateButton.disabled = false;
  }
}

async function deleteSelectedPersona() {
  if (!selectedPersonaId) return;
  const confirmed = window.confirm(`Delete persona “${personaNameInput.value.trim() || selectedPersonaId}”? This cannot be undone.`);
  if (!confirmed) return;
  personaDeleteButton.disabled = true;
  personaStatus.textContent = "Deleting persona…";
  try {
    const response = await fetch("/api/persona/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedPersonaId }),
    });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Request failed (${response.status})`);
    updatePersonaStatus(status);
    resetPersonaEditor();
    if (status.selected) {
      const match = status.personas.find((persona) => persona.id === status.selected);
      if (match) fillPersonaEditor(match);
    }
  } catch (error) {
    personaStatus.textContent = error.message;
  } finally {
    personaDeleteButton.disabled = false;
  }
}

function applyAssistantName() {
  const monogram = assistantMonogram();
  document.querySelector("#assistant-brand-name").textContent = assistantName;
  document.querySelector("#brand-mark").textContent = monogram || "A";
  document.querySelector(".wordmark").setAttribute("aria-label", `${assistantName} home`);
  document.querySelector("#topbar-assistant-name").textContent = assistantName;
  document.querySelector("label[for='prompt']").textContent = `Message ${assistantName}`;
  promptInput.placeholder = `Message ${assistantName}…`;
  document.querySelectorAll(".message.assistant .message-label").forEach((label) => {
    label.textContent = assistantName.toUpperCase();
  });
  document.querySelectorAll(".message.assistant .message-avatar").forEach((avatar) => {
    avatar.textContent = monogram || "A";
  });
  document.title = `${assistantName} Chat`;
}

function assistantMonogram() {
  return assistantName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function applyTheme() {
  document.documentElement.dataset.theme = darkModeEnabled ? "dark" : "light";
}

function activeChat() {
  return chats.find((chat) => chat.id === activeChatId);
}

function newChat() {
  if (busy) return;
  activeChatId = null;
  render();
  promptInput.focus();
  closeSidebar();
}

function renderHistory() {
  historyList.replaceChildren();
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const chat of sorted) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-item${chat.id === activeChatId ? " active" : ""}`;
    button.textContent = chat.title || "New conversation";
    button.title = button.textContent;
    button.addEventListener("click", () => {
      if (busy) return;
      activeChatId = chat.id;
      render();
      closeSidebar();
    });
    historyList.append(button);
  }
}

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return value;
  }
}

function createInlineImage(image, images) {
  const figure = document.createElement("span");
  figure.className = "inline-image";
  const imageUrl = image[2];
  const normalizedImageUrl = normalizedUrl(imageUrl);
  const result = images.find((candidate) => [candidate.image, candidate.thumbnail, candidate.url]
    .some((candidateUrl) => candidateUrl && normalizedUrl(candidateUrl) === normalizedImageUrl));
  const link = document.createElement("a");
  link.href = result?.url || imageUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const preview = document.createElement("img");
  preview.src = result?.thumbnail || result?.image || imageUrl;
  preview.alt = image[1] || result?.title || "Search result";
  preview.loading = "lazy";
  preview.referrerPolicy = "no-referrer";
  preview.addEventListener("error", () => { preview.hidden = true; });
  link.append(preview);
  figure.append(link);
  const captionText = result?.title || image[1];
  if (captionText) {
    const caption = document.createElement("span");
    caption.textContent = captionText;
    figure.append(caption);
  }
  return figure;
}

function createLinkPreview(url, label, sources, images) {
  const source = sources.find((candidate) => normalizedUrl(candidate.url) === normalizedUrl(url));
  const image = images.find((candidate) => normalizedUrl(candidate.url) === normalizedUrl(url));
  const preview = document.createElement("a");
  preview.className = "link-preview";
  preview.href = url;
  preview.target = "_blank";
  preview.rel = "noopener noreferrer";

  const thumbnail = source?.thumbnail || source?.image || image?.thumbnail;
  if (thumbnail && /^https:\/\//i.test(thumbnail)) {
    const imageEl = document.createElement("img");
    imageEl.src = thumbnail;
    imageEl.alt = "";
    imageEl.loading = "lazy";
    imageEl.referrerPolicy = "no-referrer";
    imageEl.addEventListener("error", () => { imageEl.hidden = true; });
    preview.append(imageEl);
  }

  const details = document.createElement("span");
  details.className = "link-preview-details";
  const title = document.createElement("strong");
  title.textContent = source?.title || label;
  const description = document.createElement("span");
  description.className = "link-preview-description";
  description.textContent = source?.snippet || new URL(url).hostname;
  details.append(title, description);
  preview.append(details);
  return preview;
}

function appendInline(parent, text, { sources = [], images = [] } = {}) {
  const pattern = /(!\[[^\]]*\]\(https:\/\/[^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const token = match[0];
    let node;
    if (token.startsWith("![")) {
      node = createInlineImage(token.match(/^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)$/), images);
    } else if (token.startsWith("`")) {
      node = document.createElement("code");
      node.textContent = token.slice(1, -1);
    } else if (token.startsWith("**")) {
      node = document.createElement("strong");
      node.textContent = token.slice(2, -2);
    } else if (token.startsWith("*")) {
      node = document.createElement("em");
      node.textContent = token.slice(1, -1);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      node = createLinkPreview(link[2], link[1], sources, images);
    }
    parent.append(node);
    cursor = match.index + token.length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}

function filenameFromRequest(prompt) {
  if (!/\b(?:create|write|generate|make|save|export)\b/i.test(prompt) || !/\b(?:file|document|script|spreadsheet)\b/i.test(prompt)) return null;
  const match = prompt.match(/\b([\w][\w.-]*\.[a-z0-9]{1,12})\b/i);
  return match ? safeFilename(match[1]) : null;
}

function renderMarkdown(container, markdown, requestedFilename = null, { sources = [], images = [], imageRequested = false } = {}) {
  container.replaceChildren();
  const lines = markdown.split("\n");
  let index = 0;
  let filenameUsed = false;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s*```([^`]*)$/);
    if (fence) {
      const info = fence[1].trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) codeLines.push(lines[index++]);
      if (index < lines.length) index += 1;
      const fileMatch = info.match(/^file:(.+)$/i);
      const filename = fileMatch ? safeFilename(fileMatch[1]) : (!filenameUsed ? requestedFilename : null);
      if (filename) filenameUsed = true;
      const code = codeLines.join("\n");
      const block = document.createElement("section");
      block.className = "code-block";
      const header = document.createElement("div");
      header.className = "code-header";
      const type = document.createElement("span");
      type.className = "code-language";
      type.textContent = filename || (info || "CODE").toUpperCase();
      const actions = document.createElement("div");
      actions.className = "code-actions";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          const temporary = document.createElement("textarea");
          temporary.value = code;
          temporary.style.position = "fixed";
          temporary.style.opacity = "0";
          document.body.append(temporary);
          temporary.select();
          document.execCommand("copy");
          temporary.remove();
        }
        copy.textContent = "Copied";
        setTimeout(() => { copy.textContent = "Copy"; }, 1200);
      });
      actions.append(copy);
      if (filename) {
        const download = document.createElement("a");
        download.className = "download-file";
        download.textContent = "Download";
        download.download = filename;
        download.href = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
        download.addEventListener("click", () => setTimeout(() => URL.revokeObjectURL(download.href), 1000), { once: true });
        actions.append(download);
      }
      header.append(type, actions);
      const pre = document.createElement("pre");
      const codeEl = document.createElement("code");
      codeEl.textContent = code;
      pre.append(codeEl);
      block.append(header, pre);
      container.append(block);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    let block;
    if (heading) {
      block = document.createElement(`h${heading[1].length + 2}`);
      appendInline(block, heading[2], { sources, images });
      index += 1;
    } else if (bullet || numbered) {
      block = document.createElement("p");
      block.className = "list-item";
      block.textContent = "• ";
      appendInline(block, (bullet || numbered)[1], { sources, images });
      index += 1;
    } else {
      block = document.createElement("p");
      appendInline(block, line, { sources, images });
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^#{1,3}\s/.test(lines[index])) {
        block.append(document.createElement("br"));
        appendInline(block, lines[index++], { sources, images });
      }
    }
    container.append(block);
  }

  if (imageRequested && !container.querySelector(".inline-image")) {
    const image = images.find((result) => /^https:\/\//i.test(result.image || ""));
    const firstParagraph = container.querySelector("p");
    if (image) {
      const fallback = createInlineImage(["", image.title || "", image.image], images);
      if (firstParagraph) firstParagraph.after(fallback);
      else container.prepend(fallback);
    } else if (firstParagraph) {
      const note = document.createElement("span");
      note.className = "image-search-note";
      note.textContent = "No public images found.";
      firstParagraph.after(note);
    }
  }
}

function safeFilename(filename) {
  const basename = filename.split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f]/g, "_").trim();
  return basename && basename !== "." ? basename : "generated-file.txt";
}

function makeMessage(role, content, { pending = false, error = false, sources = [], images = [], imageRequested = false, requestedFilename = null } = {}) {
  const row = document.createElement("article");
  row.className = `message ${role}${error ? " error" : ""}`;
  const body = document.createElement("div");
  body.className = "message-content";
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : assistantName.toUpperCase();
  const text = document.createElement("div");
  text.className = `message-text${pending ? " pending" : ""}`;
  if (role === "assistant" && !pending) renderMarkdown(text, content, requestedFilename, { sources, images, imageRequested });
  else text.textContent = content;
  body.append(label, text);
  if (role === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = assistantMonogram() || "A";
    row.append(avatar, body);
  } else {
    row.append(body);
  }
  messagesEl.append(row);
  return text;
}

function render() {
  renderHistory();
  messagesEl.replaceChildren();
  const chat = activeChat();
  welcomeEl.hidden = Boolean(chat?.messages.length);
  if (chat) {
    chat.messages.forEach((message, index) => {
      const previous = chat.messages[index - 1];
      const requestedFilename = message.role === "assistant" && previous?.role === "user"
        ? (message.filename || filenameFromRequest(previous.content))
        : null;
      makeMessage(message.role, message.content, {
        sources: message.sources,
        images: message.images,
        imageRequested: message.imageRequested,
        requestedFilename,
      });
    });
  }
  if (isUserAtBottom()) {
    scrollToLatest();
  }
}

function scrollToLatest() {
  requestAnimationFrame(() => {
    if (isUserAtBottom() || !messagesEl.children.length) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  });
}

function closeSidebar() {
  setSidebarOpen(false);
}

function openSettings() {
  syncSettingsPage();
  modelSwitchError.textContent = "";
  refreshModelStatus();
  refreshPersonaStatus();
  settingsPage.classList.remove("hidden");
  document.body.classList.add("settings-open");
  setSettingsTab("general");
}

function closeSettings() {
  settingsPage.classList.add("hidden");
  document.body.classList.remove("settings-open");
}

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close chat history" : "Open chat history");
  menuButton.textContent = open ? "×" : "☰";
}

function resizePrompt() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 170)}px`;
}

function updateComposerState() {
  const shouldDisable = busy || !promptInput.value.trim();
  sendButton.disabled = busy ? false : shouldDisable;
  promptInput.disabled = busy;
  sendButton.textContent = busy ? "■" : "↑";
  sendButton.title = busy ? "Stop generating response" : "Send message";
  sendButton.setAttribute("aria-label", busy ? "Stop generating response" : "Send message");
}

function queueOrSendPrompt(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (busy) {
    queuedPrompt = trimmed;
    return;
  }
  promptInput.value = "";
  resizePrompt();
  sendMessage(trimmed);
}

async function stopCurrentResponse() {
  if (!busy) return;
  currentRequestAbortController?.abort();
  currentRequestAbortController = null;
  busy = false;
  updateComposerState();
  promptInput.focus();
}

async function sendMessage(text) {
  if (busy || !text.trim()) {
    if (busy && text.trim()) {
      queuedPrompt = text.trim();
    }
    return;
  }

  let chat = activeChat();
  if (!chat) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    chat = { id, title: text.trim().slice(0, 52), messages: [], updatedAt: Date.now() };
    chats.push(chat);
    activeChatId = chat.id;
  }

  chat.messages.push({ role: "user", content: text.trim() });
  chat.updatedAt = Date.now();
  saveChats();
  welcomeEl.hidden = true;
  makeMessage("user", text.trim());
  renderHistory();

  busy = true;
  sendButton.disabled = true;
  promptInput.disabled = true;
  const replyEl = makeMessage("assistant", "", { pending: true });
  let reply = "";
  const controller = new AbortController();
  currentRequestAbortController = controller;
  scrollToLatest();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chat.messages, web_search: webSearchEnabled, image_search: imageSearchEnabled }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Request failed (${response.status})`);
    }
    if (!response.body) throw new Error("Streaming is not available in this browser.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    let sources = [];
    let images = [];
    let imageRequested = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (controller.signal.aborted) throw new DOMException("Request cancelled.", "AbortError");
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const eventText of events) {
        const data = eventText.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.error) throw new Error(event.error);
        if (Array.isArray(event.sources)) sources = event.sources;
        if (Array.isArray(event.images)) {
          images = event.images;
          imageRequested = event.image_requested === true;
        }
        if (event.token) {
          reply += event.token;
          replyEl.textContent = reply;
          maybeAutoScroll();
        }
        if (event.done) finished = true;
      }
      if (done) break;
    }
    if (!reply) reply = "I couldn't generate a response. Please try again.";
    const requestedFilename = filenameFromRequest(text);
    renderMarkdown(replyEl, reply, requestedFilename, { sources, images, imageRequested });
    chat.messages.push({ role: "assistant", content: reply, sources, images, imageRequested, filename: requestedFilename });
    chat.updatedAt = Date.now();
    saveChats();
  } catch (error) {
    if (error?.name === "AbortError") {
      replyEl.textContent = "Response stopped.";
      replyEl.classList.remove("pending");
      replyEl.closest(".message").classList.add("error");
      return;
    }
    replyEl.classList.remove("pending");
    replyEl.closest(".message").classList.add("error");
    replyEl.textContent = `Couldn't reach the assistant: ${error.message}`;
  } finally {
    currentRequestAbortController = null;
    replyEl.classList.remove("pending");
    busy = false;
    sendButton.disabled = false;
    promptInput.disabled = false;
    renderHistory();
    if (queuedPrompt) {
      const nextPrompt = queuedPrompt;
      queuedPrompt = null;
      promptInput.value = nextPrompt;
      sendMessage(nextPrompt);
      return;
    }
    promptInput.focus();
    maybeAutoScroll();
  }
}

document.querySelector("#new-chat").addEventListener("click", newChat);
settingsButton.addEventListener("click", openSettings);
document.querySelector("#close-settings").addEventListener("click", closeSettings);
settingsTabs.forEach((button) => {
  button.addEventListener("click", () => setSettingsTab(button.dataset.tab));
});
modelSelect.addEventListener("change", switchModel);
personaSelect.addEventListener("change", switchPersona);
personaCreateForm.addEventListener("submit", createPersona);
personaUpdateButton.addEventListener("click", updateSelectedPersona);
personaDeleteButton.addEventListener("click", deleteSelectedPersona);
webSearchSetting.addEventListener("change", () => {
  webSearchEnabled = webSearchSetting.checked;
  savePreferences();
});
imageSearchSetting.addEventListener("change", () => {
  imageSearchEnabled = imageSearchSetting.checked;
  savePreferences();
});
darkModeSetting.addEventListener("change", () => {
  darkModeEnabled = darkModeSetting.checked;
  applyTheme();
  savePreferences();
});
assistantNameSetting.addEventListener("change", () => {
  assistantName = assistantNameSetting.value.trim().replace(/\s+/g, " ").slice(0, 32) || "Assistant";
  assistantNameSetting.value = assistantName;
  applyAssistantName();
  savePreferences();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = promptInput.value;
  if (!text.trim()) return;
  if (busy) {
    queuedPrompt = text.trim();
    return;
  }
  queueOrSendPrompt(text);
});
promptInput.addEventListener("input", () => {
  resizePrompt();
  updateComposerState();
});
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", async () => {
    const suggestion = button.dataset.prompt;
    if (busy) {
      queuedPrompt = suggestion;
      return;
    }
    queueOrSendPrompt(suggestion);
  });
});
sendButton.addEventListener("click", () => {
  if (busy) {
    stopCurrentResponse();
    return;
  }
  form.requestSubmit();
});
menuButton.addEventListener("click", () => {
  setSidebarOpen(menuButton.getAttribute("aria-expanded") !== "true");
});
document.querySelector("#sidebar-scrim").addEventListener("click", closeSidebar);
window.addEventListener("scroll", () => {
  if (!busy) return;
  if (!isUserAtBottom()) {
    return;
  }
  maybeAutoScroll();
}, { passive: true });

personaSelect.addEventListener("dblclick", async () => {
  const match = (window.__personaCatalog || []).find((persona) => persona.id === personaSelect.value);
  if (match) fillPersonaEditor(match);
});

applyTheme();
applyAssistantName();
mountDesktopServerStatus();
render();
refreshModelStatus();
refreshPersonaStatus();
setSettingsTab("general");
setInterval(refreshModelStatus, 10000);