import { createContext, useContext } from "react";

interface ShellContextValue {
  /** Open the "New enquiry" dialog from anywhere in the app. */
  openIntake: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <AppShell>");
  return ctx;
}
