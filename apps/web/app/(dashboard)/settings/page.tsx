import { redirect } from "next/navigation";

// Settings lives on More now. The old address still works.
export default function SettingsPage() {
  redirect("/more");
}
