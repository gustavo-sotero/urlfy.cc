// src/components/ui/announcer.tsx
"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface AnnouncerContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      if (priority === "assertive") {
        setAssertiveMessage(message);
        setTimeout(() => setAssertiveMessage(""), 100);
      } else {
        setPoliteMessage(message);
        setTimeout(() => setPoliteMessage(""), 100);
      }
    },
    [],
  );

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Screen reader only announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {politeMessage}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error("useAnnouncer must be used within AnnouncerProvider");
  }
  return context;
}
