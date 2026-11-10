import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
serve(() => new Response(JSON.stringify({ disabled: true }), { status: 410, headers: { "Content-Type": "application/json" } }));