import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { adminBulkUpdateAudience } from "@/lib/referrals/referralApi";
import { ChevronDown, Users2 } from "lucide-react";

type Audience = "university" | "tvet_college" | "private";

interface Props {
  selectedIds: string[];
  onDone: () => void;
  onClear: () => void;
}

export function BulkAudienceActions({ selectedIds, onDone, onClear }: Props) {
  const [busy, setBusy] = useState(false);
  if (selectedIds.length === 0) return null;

  const run = async (mode: "add" | "remove" | "set", audiences: Audience[], label: string) => {
    if (!window.confirm(`Apply "${label}" to ${selectedIds.length} residence(s)?`)) return;
    setBusy(true);
    const { error } = await adminBulkUpdateAudience(selectedIds, mode, audiences);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${label} applied to ${selectedIds.length} residence(s)`);
    onDone();
  };

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 backdrop-blur px-3 py-2 shadow">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={busy}><Users2 className="w-4 h-4 mr-1" /> Bulk set audience <ChevronDown className="w-4 h-4 ml-1" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Add</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run("add", ["university"], "Add University Students")}>Add University Students</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("add", ["tvet_college"], "Add TVET / College Students")}>Add TVET / College Students</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("add", ["private"], "Add Private Tenants")}>Add Private Tenants</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Remove</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run("remove", ["university"], "Remove University Students")}>Remove University Students</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("remove", ["tvet_college"], "Remove TVET / College Students")}>Remove TVET / College Students</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("remove", ["private"], "Remove Private Tenants")}>Remove Private Tenants</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Set only</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run("set", ["university"], "Set only University")}>Set only University</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("set", ["tvet_college"], "Set only TVET / College")}>Set only TVET / College</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("set", ["private"], "Set only Private")}>Set only Private</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("set", ["university","tvet_college"], "Set University + TVET")}>Set University + TVET</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("set", ["university","private"], "Set University + Private")}>Set University + Private</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("set", ["tvet_college","private"], "Set TVET + Private")}>Set TVET + Private</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("set", ["university","tvet_college","private"], "Set All Audiences")}>Set All Audiences</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>Clear</Button>
    </div>
  );
}