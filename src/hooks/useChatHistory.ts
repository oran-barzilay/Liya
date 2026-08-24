import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "liya_chat_history";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const convs = loadConversations();
    return convs.length > 0 ? convs[0].id : null;
  });

  const createConversation = useCallback((): string => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newConv: Conversation = {
      id,
      title: "שיחה חדשה",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setConversations((prev) => {
      const updated = [newConv, ...prev];
      saveConversations(updated);
      return updated;
    });
    setActiveId(id);
    return id;
  }, []);

  const updateConversation = useCallback((id: string, messages: ChatMessage[]) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const firstUserMsg = messages.find((m) => m.role === "user");
        const title = firstUserMsg
          ? firstUserMsg.text.slice(0, 50) + (firstUserMsg.text.length > 50 ? "..." : "")
          : c.title;
        return { ...c, messages, title, updatedAt: new Date().toISOString() };
      });
      saveConversations(updated);
      return updated;
    });
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        saveConversations(updated);
        return updated;
      });
      setActiveId((prev) => {
        if (prev !== id) return prev;
        const remaining = loadConversations().filter((c) => c.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    },
    []
  );

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
  };
}

