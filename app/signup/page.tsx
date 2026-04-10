import { redirect } from "next/navigation";

export default function Page() {
  // Signup via public route is disabled. Redirect to home.
  redirect("/");
}
