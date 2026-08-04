import CoachShell from "@/components/shell/CoachShell";
import { ImportProvider } from "./ImportContext";

export default function ImportLayout({ children }) {
  return (
    <ImportProvider>
      <CoachShell>{children}</CoachShell>
    </ImportProvider>
  );
}
