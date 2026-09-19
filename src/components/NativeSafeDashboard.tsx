import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const destinations = [
  { path: "/findmyres", title: "Find My Res", description: "Search student accommodation and available rooms" },
  { path: "/my-applications", title: "My applications", description: "Track residence applications and next steps" },
  { path: "/student-care", title: "Student care", description: "Residence feedback and single-room waiting list" },
  { path: "/application-assistance", title: "Application assistance", description: "Get help with university and TVET applications" },
  { path: "/opportunities", title: "Opportunities", description: "Discover WIL, internships and other opportunities" },
  { path: "/profile", title: "My profile", description: "Manage your details and documents" },
] as const;

/** The Play Store WebView boots here before any data-heavy dashboard widgets mount. */
export default function NativeSafeDashboard() {
  const { user, signOut } = useAuth();
  return (
    <main className="min-h-[80dvh] bg-background px-4 pb-12 pt-6 text-foreground">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Living • AI • Opportunity</p>
        <h1 className="mt-2 text-2xl font-black">My ResKonnect</h1>
        <p className="mt-2 text-sm text-muted-foreground">Signed in{user?.email ? ` as ${user.email}` : ""}. Choose what you want to do.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {destinations.map(item => (
            <Link key={item.path} to={item.path} className="block rounded-2xl border bg-card p-4 shadow-sm active:bg-muted">
              <span className="block font-semibold">{item.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/dashboard?full=1" className="rounded-xl border px-4 py-3 text-sm font-semibold">Open full dashboard</Link>
          <button type="button" onClick={() => void signOut().catch(error => console.warn("[NativeSafeDashboard] Sign-out unavailable", error))} className="rounded-xl border px-4 py-3 text-sm font-semibold">Sign out</button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">The app opens a lightweight home after sign-in. Your full dashboard and all existing pages remain available.</p>
      </div>
    </main>
  );
}
