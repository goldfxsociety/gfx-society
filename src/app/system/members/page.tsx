import { redirect } from "next/navigation";
import { MEMBERS_HOME } from "@/lib/members/routes";

// The members home moved to /training (Design Addendum C, F1). Kept as a redirect for old links.
export default function MembersPage() {
  redirect(MEMBERS_HOME);
}
