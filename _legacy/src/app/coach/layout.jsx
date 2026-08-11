import CoachShell from "@/components/shell/CoachShell";
import CoachGuard from "@/components/auth/CoachGuard";

export default function CoachLayout({ children }) {
  return (
    <CoachGuard>
      <CoachShell>{children}</CoachShell>
    </CoachGuard>
  );
}
