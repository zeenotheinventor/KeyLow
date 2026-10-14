import { redirect } from "next/navigation";

// Weight is a coming soon row on More for now. The old address still works.
export default function WeightPage() {
  redirect("/more");
}
