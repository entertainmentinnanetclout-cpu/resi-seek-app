import { Download, Laptop, MonitorDown, Share2, Smartphone } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InstallResKonnect() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Install ResKonnect | iPhone, iPad, Mac & PC" description="Install ResKonnect as a web app on iPhone, iPad, Mac, Windows and supported desktop browsers." />
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10"><Download className="h-7 w-7 text-primary" /></div>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Install ResKonnect</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">Use ResKonnect from your Home Screen, Dock or desktop like an app. Your normal ResKonnect account and Supabase-backed data remain the same.</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />iPhone & iPad</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>Open <strong className="text-foreground">www.reskonnect.org</strong> in Safari.</p>
              <p>Tap <strong className="text-foreground">Share</strong> <Share2 className="mx-1 inline h-4 w-4" />, choose <strong className="text-foreground">Add to Home Screen</strong>, then confirm.</p>
              <p>ResKonnect will launch in its own app window and use the Home Screen icon.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><MonitorDown className="h-5 w-5 text-primary" />Mac with Safari</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>Open ResKonnect in Safari on a supported macOS version.</p>
              <p>Choose <strong className="text-foreground">File → Add to Dock</strong> and confirm the ResKonnect name and icon.</p>
              <p>The installed site opens independently from the main Safari window.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Laptop className="h-5 w-5 text-primary" />Windows PC</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>Open ResKonnect in Chrome or Microsoft Edge.</p>
              <p>Use the browser's <strong className="text-foreground">Install app</strong> option in the address bar or browser menu.</p>
              <p>After installation, ResKonnect can be pinned to Start or the taskbar like other apps.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Chrome on Mac or PC</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>Chrome can show an installation button automatically when the site is eligible.</p>
              <p>If it does not appear, open Chrome's menu and choose the available install option for this site.</p>
              <p>The same responsive ResKonnect interface is used in the installed window.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 rounded-2xl border-primary/20 bg-primary/[0.035]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-black">No separate account is required</p><p className="mt-1 text-sm text-muted-foreground">Signing in on the installed web app connects to the same ResKonnect account and backend.</p></div>
            <Button asChild className="shrink-0"><a href="/">Open ResKonnect</a></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
