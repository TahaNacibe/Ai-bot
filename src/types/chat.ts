export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  images?: Array<{ title: string; image: string; thumbnail?: string; url?: string }>;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type Persona = {
  id: string;
  name: string;
  content: string;
};

export type PersonaStatus = {
  personas: Persona[];
  selected: string;
  created?: string;
};

export type ModelStatus = {
  models: string[];
  selected: string;
  running: string[];
};
