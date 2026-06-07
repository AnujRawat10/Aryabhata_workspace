import { redirect } from "next/navigation";

// Root simply forwards to the dashboard (which itself guards for auth).
export default function HomePage() {
  redirect("/dashboard");
}
