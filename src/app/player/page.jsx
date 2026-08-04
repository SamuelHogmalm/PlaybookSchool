import { redirect } from "next/navigation";

export default function PlayerIndex() {
  redirect("/player/today");
}
