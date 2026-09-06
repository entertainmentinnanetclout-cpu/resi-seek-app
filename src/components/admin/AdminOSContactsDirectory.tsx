import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserRound, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Contact = {
  id: string;
  profile_user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  student_number?: string | null;
  campus?: string | null;
  contact_type?: string | null;
  metadata?: any;
  profile_picture_url?: string | null;
};

const initials = (value?: string | null) => String(value || "RK").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "RK";

export default function AdminOSContactsDirectory() {
  const [, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await (supabase as any)
          .from("adminos_contacts")
          .select("id,profile_user_id,full_name,email,phone,student_number,campus,contact_type,metadata")
          .order("updated_at", { ascending: false })
          .limit(1000);
        if (result.error) throw result.error;
        const rows = (result.data || []) as Contact[];
        const profileIds = Array.from(new Set(rows.map((c) => c.profile_user_id).filter(Boolean))) as string[];
        const avatars = new Map<string, string | null>();
        if (profileIds.length) {
          const profileResult = await (supabase as any).from("profiles").select("id,profile_picture_url").in("id", profileIds);
          for (const profile of profileResult.data || []) avatars.set(profile.id, profile.profile_picture_url || null);
        }
        if (active) setContacts(rows.map((c) => ({ ...c, profile_picture_url: c.profile_user_id ? avatars.get(c.profile_user_id) || null : null })));
      } catch (error: any) {
        toast.error(error?.message || "Could not load contact directory");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => [c.full_name, c.email, c.phone, c.student_number, c.campus, c.contact_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q));
  }, [contacts, search]);

  const openCustomer = (id: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "communications");
      next.set("contact", id);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-[28px] border bg-background shadow-sm">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            <p className="font-black">Contact Directory</p>
            <Badge variant="secondary" className="rounded-full">{contacts.length}</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">CRM/database contacts live here. They are intentionally kept out of the WhatsApp enquiry inbox until they actually message ResKonnect.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, student no..." className="rounded-full pl-9" />
        </div>
      </div>
      <ScrollArea className="h-[430px]">
        <div className="divide-y">
          {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading contacts…</div> : visible.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No matching contacts.</div> : visible.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 p-4 transition hover:bg-muted/35">
              <Avatar className="h-11 w-11">
                <AvatarImage src={contact.profile_picture_url || undefined} className="object-cover" />
                <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{contact.full_name || contact.phone || "Unnamed contact"}</p>
                <p className="truncate text-xs text-muted-foreground">{[contact.phone, contact.student_number, contact.campus].filter(Boolean).join(" · ") || contact.email || "CRM contact"}</p>
              </div>
              {contact.contact_type && <Badge variant="outline" className="hidden rounded-full sm:inline-flex">{contact.contact_type}</Badge>}
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openCustomer(contact.id)}>Customer 360</Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
