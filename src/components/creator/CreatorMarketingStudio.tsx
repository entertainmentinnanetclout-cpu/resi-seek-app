import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND } from "@/constants/brand";

const FORMATS = {
  square: { label: "Square 1:1", width: 1080, height: 1080 },
  portrait: { label: "Feed 4:5", width: 1080, height: 1350 },
  story: { label: "Story / TikTok 9:16", width: 1080, height: 1920 },
} as const;

const CAMPAIGNS = {
  reservations: { badge: "2027 RESERVATIONS OPEN", title: "Find your 2027 student accommodation", body: "Browse accommodation, compare private and NSFAS-funded rates, then reserve your interest on ResKonnect.", cta: "FIND ACCOMMODATION" },
  nearCampus: { badge: "FIND MY RES", title: "Looking for accommodation near campus?", body: "Search residences by campus, room type, budget, availability and 2027 reservation status.", cta: "SEARCH ON RESKONNECT" },
  applications: { badge: "APPLICATION SUPPORT", title: "Not sure what you qualify for?", body: "Use ResKonnect for APS, course guidance and document readiness, with assisted applications supported by Tech-Up.", cta: "START YOUR APPLICATION JOURNEY" },
  funding: { badge: "PRIVATE + NSFAS", title: "Accommodation for different funding journeys", body: "Private tenant rates and NSFAS-funded rates can differ. ResKonnect makes the distinction visible before you reserve.", cta: "EXPLORE 2027 OPTIONS" },
} as const;

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  words.forEach((word) => { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test; });
  if (line) lines.push(line); return lines;
};

const CreatorMarketingStudio = ({ creatorName, referralCode }: { creatorName: string; referralCode: string }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<keyof typeof FORMATS>("square");
  const [campaign, setCampaign] = useState<keyof typeof CAMPAIGNS>("reservations");
  const [partnerName, setPartnerName] = useState(creatorName || "Creator Partner");
  const spec = FORMATS[format]; const copy = CAMPAIGNS[campaign];
  const referralUrl = useMemo(() => `www.reskonnect.org/r/${referralCode || "YOURCODE"}`, [referralCode]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width = spec.width; canvas.height = spec.height;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const w = canvas.width, h = canvas.height, pad = Math.round(w * 0.075);
    const gradient = ctx.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, "#101828"); gradient.addColorStop(0.52, "#182c59"); gradient.addColorStop(1, "#5b2dbd"); ctx.fillStyle = gradient; ctx.fillRect(0,0,w,h);
    const glow = ctx.createRadialGradient(w*.78,h*.2,20,w*.78,h*.2,w*.7); glow.addColorStop(0,"rgba(255,144,47,.55)"); glow.addColorStop(.5,"rgba(238,74,138,.2)"); glow.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.beginPath(); ctx.arc(w*.88,h*.72,w*.34,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(w*.08,h*.84,w*.2,0,Math.PI*2); ctx.fill();

    ctx.fillStyle="#fff"; ctx.font=`900 ${Math.round(w*.055)}px Arial`; ctx.fillText("RESKONNECT",pad,pad*1.3);
    ctx.font=`600 ${Math.round(w*.018)}px Arial`; ctx.fillStyle="rgba(255,255,255,.72)"; ctx.fillText("LIVING • AI • OPPORTUNITY",pad,pad*1.7);

    const badgeY = h*.24; ctx.fillStyle="#ff9a3c"; const badgeW = Math.min(w-pad*2, ctx.measureText(copy.badge).width + pad*.8); ctx.beginPath(); ctx.roundRect(pad,badgeY,badgeW,w*.07,w*.035); ctx.fill(); ctx.fillStyle="#111827"; ctx.font=`800 ${Math.round(w*.026)}px Arial`; ctx.fillText(copy.badge,pad+pad*.3,badgeY+w*.045);

    ctx.fillStyle="#fff"; ctx.font=`900 ${Math.round(w*(format==="story"?.082:.072))}px Arial`; const titleLines=wrapText(ctx,copy.title,w-pad*2); let y=badgeY+w*.16; titleLines.forEach((line)=>{ctx.fillText(line,pad,y);y+=w*.09;});
    ctx.font=`500 ${Math.round(w*.032)}px Arial`; ctx.fillStyle="rgba(255,255,255,.84)"; const bodyLines=wrapText(ctx,copy.body,w-pad*2); y+=w*.035; bodyLines.forEach((line)=>{ctx.fillText(line,pad,y);y+=w*.048;});

    const footerY = h-pad*2.15; ctx.fillStyle="rgba(255,255,255,.12)"; ctx.beginPath(); ctx.roundRect(pad,footerY,w-pad*2,pad*1.15,pad*.25); ctx.fill(); ctx.fillStyle="#fff"; ctx.font=`800 ${Math.round(w*.026)}px Arial`; ctx.fillText(`${partnerName} × ResKonnect`,pad+pad*.25,footerY+pad*.45); ctx.font=`600 ${Math.round(w*.021)}px Arial`; ctx.fillStyle="rgba(255,255,255,.75)"; ctx.fillText(referralUrl,pad+pad*.25,footerY+pad*.82);

    ctx.fillStyle="#ff9a3c"; ctx.font=`900 ${Math.round(w*.028)}px Arial`; ctx.fillText(copy.cta,pad,h-pad*.55);
  }, [spec, copy, partnerName, referralUrl, format]);

  const download = () => {
    const canvas=canvasRef.current; if(!canvas) return; const link=document.createElement("a"); link.download=`reskonnect-${campaign}-${format}-${referralCode || "creator"}.png`; link.href=canvas.toDataURL("image/png",1); link.click();
  };

  return <Card className="overflow-hidden border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Co-branded Marketing Studio</CardTitle></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-3 md:grid-cols-3"><div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Campaign</p><Select value={campaign} onValueChange={(v) => setCampaign(v as keyof typeof CAMPAIGNS)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CAMPAIGNS).map(([key,v])=><SelectItem key={key} value={key}>{v.badge}</SelectItem>)}</SelectContent></Select></div><div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Format</p><Select value={format} onValueChange={(v) => setFormat(v as keyof typeof FORMATS)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FORMATS).map(([key,v])=><SelectItem key={key} value={key}>{v.label}</SelectItem>)}</SelectContent></Select></div><div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Partner name</p><Input value={partnerName} onChange={(e)=>setPartnerName(e.target.value)} /></div></div>
    <div className="overflow-hidden rounded-2xl border bg-muted/30 p-3"><canvas ref={canvasRef} className="mx-auto block h-auto max-h-[620px] w-full max-w-[520px] rounded-xl shadow-xl" /></div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground"><ImageIcon className="mr-1 inline h-3.5 w-3.5" />Generated locally in your browser. The asset uses your creator identity and ResKonnect referral route.</p><Button onClick={download}><Download className="mr-2 h-4 w-4" />Download PNG</Button></div>
  </CardContent></Card>;
};

export default CreatorMarketingStudio;
