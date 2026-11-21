# ResKonnect AI — public voice chat and private Qwen integration plan

## Implemented in this branch

- On \`/ai\`, **ResKonnect Voice Chat** lets users intentionally start a voice session.
- Supported browsers transcribe speech, submit the same authenticated/public API request used by typed messages, speak the verified answer aloud, and resume listening where browser policy allows.
- Users can stop, interrupt a spoken answer to talk, or say a safe page-navigation command, e.g. **open living**, **open accommodation**, **open applications**, **open opportunities**.
- No microphone access until the visitor presses the button. The voice feature closes mic recognition and speech output when stopped or unmounted.
- Browser speech recognition is not guaranteed to process speech on-device; some browsers use external speech services. The page discloses this. Text chat continues to work if voice support is unavailable.
- No new Supabase function, service key, database grant, PII transfer, third-party account or paid speech provider.
- The existing \`/ai\` page continues to use \`luna-agent\` for anonymous visitors and \`adminos-enquiry\` with a validated signed-in session. Those route through ResKonnect Brain, which preserves existing controls and live data tools.

## Already-existing search technology

- \`SmartSearchBar\` provides structured filtering and voice-search-friendly search text.
- \`src/lib/resmap/housingSearchIntent.ts\` interprets natural phrases for budget, NSFAS/private funding, room types, WiFi, parking and furnished preferences. It then matches listings against actual residence data.
- \`luna-agent\` / \`reskonnect-brain\` and \`dimpho-tool-engine\` already include controlled residence discovery and customer enquiry workflows.

The inference model should generate **interpretations and explanations**, not invent live accommodations. Matching/eligibility must remain verifiable through ResKonnect's published residence records and account-scoped, allowlisted tools.

## Future connection to your own local Qwen model

The public site **must not** make requests to \`127.0.0.1:8765\`: that points at the visitor's machine, not the owner's Mac. It must also never expose the owner's personal Local AI OS or its local file/folder/automation APIs.

Proposed secure flow:

\`\`\`text
www.reskonnect.org
  → existing Luna / ResKonnect Brain backend (server-side validation)
  → AI provider adapter (feature-flagged, safe public data only)
  → authenticated HTTPS tunnel / relay
  → separate inference-only Qwen gateway on owner Mac
  → local Ollama over 127.0.0.1
  ← JSON-only result (no actions)
  → ResKonnect Brain validates/grounds/matches live published residences
  → answer & cards to the website
\`\`\`

### Mandatory gates before enabling the local Qwen provider

1. Separate inference-only process with no shared authentication, browsing, file, or command privileges from Local AI OS. Never publish Local AI OS port 8765 or Ollama port 11434.
2. Server-to-server authorisation such as an access-controlled tunnel with short-lived tokens. The token stays in Supabase/website server secrets, never the frontend. TLS and secret rotation required. No public unauthenticated endpoint.
3. Strict allowlist of inference operations. Start with **public accommodation intent extraction** only. Input must be data-minimised: city/campus, budget, NSFAS/private, room type, amenities and generic public question. Never include contact details, student IDs, document images, saved conversation or sensitive private context by default.
4. Deterministic post-validation of model output; only controlled live residence data and pricing can be returned to customers.
5. Timeouts, rate limiting, safe failure/fallback to the existing ResKonnect Brain or deterministic search. Mac may sleep or be offline. No silent loss of basic accommodation search.
6. Tests for missing tunnel, 401/403, malformed JSON, prompt injection, fabricated listings, unauthorized account records and latency/availability.
7. No production activation until the Mac gateway, deployed backend secrets, consent/privacy notices, uptime requirements and release approvals have been tested.

**The gateway is intentionally not connected by this PR.** The public voice feature can operate using ResKonnect's existing AI provider today. Later we can make public inference use Qwen without compromising private data or website uptime.

## Voice enhancement roadmap

- Current branch: opt-in browser speech recognition + spoken replies and safe voice navigation, on the existing public AI chat.
- Next: voice-assisted filter selection directly in Find My Res and native residence cards in chat.
- Later: neural voices with user consent, clearer SA-language pronunciation, live streaming/interruptions, conversation memory across devices, and accessible audio settings.
- Personal Mac version separately gains a locally transcribed, two-way Whisper/Qwen voice session.

## Manual validation

On a Vercel preview of this branch, use iPhone Safari, Android Chrome and desktop:
- Text-only questions still work anonymously.
- Authenticated route still uses a validated session.
- Press Start voice, grant mic permission, ask for a campus-specific accommodation recommendation, hear an answer.
- Interrupt playback, speak again and confirm no overlapping audio.
- Say "open living" and verify correct navigation.
- Stop and verify no more mic capture, speech or calls.
- Deny mic permission: visible error and text chat usable.
- Browser without SpeechRecognition: button disabled and explanation shown.
- Timeout or backend failure: existing safe fallback message remains.
