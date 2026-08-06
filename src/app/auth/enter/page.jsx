import { redirect } from "next/navigation";

/** Legacy path — redirect to server-side enter route. */
export default function AuthEnterPage({ searchParams }) {
  const q = searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : "";
  redirect(`/api/auth/enter${q}`);
}
