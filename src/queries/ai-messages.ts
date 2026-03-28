"use server";

export type AIMessage = {
  id: string;
  projectId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  status: "PENDING" | "DONE" | "ERROR";
  createdAt: string;
};

// 🔥 global store
const g = global as typeof global & {
  _aiMessages?: Map<string, AIMessage[]>;
};

if (!g._aiMessages) {
  g._aiMessages = new Map();
}

const store = g._aiMessages;

// =========================
// ➕ ADD MESSAGE
// =========================
export const addMessage = async (message: AIMessage) => {
  const existing = store.get(message.projectId) || [];
  store.set(message.projectId, [...existing, message]);
};

// =========================
// 📥 GET MESSAGES
// =========================
export const getMessages = async (projectId: string) => {
  return store.get(projectId) || [];
};