# ResKonnect God Mode Visual Studio — preview repair and editor completion

**Release target:** `/admin/studio` on the production ResKonnect application.

## Root cause and resolution

Vercel previously emitted `X-Frame-Options: DENY` for every path. The Visual Studio preview loads the real public homepage or Find My Res page inside a same-origin iframe. The browser blocked both pages before the editor could establish its live-copy channel.

The global policy is now `X-Frame-Options: SAMEORIGIN` paired with `Content-Security-Policy: frame-ancestors 'self'`. This **does not allow external websites** to iframe ResKonnect. No bypass tokens, service-role keys, or cross-origin preview embeds were added.

## Reliable live canvas

- One public-page query and one preview receiver per page, not one of each for every section (22 homepage blocks + 10 Find My Res blocks).
- Same-origin parent and iframe communicate using an explicit `ready → preview → applied` handshake, with request IDs to avoid stale responses.
- The page verifies the signed-in God Mode state and JWT MFA AAL2 before accepting draft overlays. The database separately protects publishing with AAL2.
- Select any section using its in-canvas Edit button or by clicking anywhere on the block. Canvas clicks cannot submit student applications, follow links or submit a form.
- Selecting a block highlights and scrolls the iframe to the relevant component.
- Status shows Loading, Syncing, Connected or Unavailable; there is an explicit Reload Preview action, a retry notice after 12 seconds, and an Open Published Page shortcut.
- Desktop, tablet and phone widths retain the existing device-frame presentation.
- Find My Res's first-visit onboarding modal is disabled only inside the authorised editing iframe.
- When the user selects a different page or reloads the browser with uncommitted edits, unsaved data loss is explicitly guarded. Saved draft revisions remain private and can be resumed from revision history.

## Practical editing scope

- Homepage visibility and safe editorial ordering; critical sections (search, application and compliance) remain protected against hiding.
- Find My Res visibility and copy while retaining the search-to-booking sequence.
- Editable copy on homepage Spotlight, Top 3, Trusted Residences, Vision, City Introduction, Benefits and FAQ Introduction.
- Editable copy on Find My Res Spotlight, Top 3 and results introduction.
- Residence profiles, institution acceptance badges, display images, curated showcases, hero slides and category cards use the pre-existing production managers inside Studio.
- Changes are draft-only until Publish Live. Save Draft does not alter the public site, and restoring an earlier version loads a preview, not an automatic rollback.

## Operator acceptance checklist

1. Sign in with an authorised God Mode account and complete MFA; go to `/admin/studio`.
2. Confirm Homepage canvas reports **Canvas connected** and actually renders the public page.
3. Click a section in the navigator and confirm the corresponding area scrolls into view and highlights.
4. Change the vision or city-introduction text without publishing; confirm the iframe reflects it and a change counter appears.
5. Switch desktop/tablet/mobile preview widths. No page navigation or application action should occur from a canvas click.
6. Save Draft and refresh the editor. Use **Resume saved draft** to restore the unpublished revision.
7. Publish the draft only if approved, then verify the public page in a new tab.
8. Load a previous revision from History, preview the difference, and only publish if a rollback is approved.
9. Select Find My Res, verify the preview and ensure no first-visit modal overlays the page.
10. Verify a public anonymous visitor cannot access `/admin/studio` or see in-canvas edit controls.

## Verification

The backend registry contains 22 homepage and 10 Find My Res sections, with all required blocks still marked protected. The editor RPC is not executable by the anonymous role. The exact production header policy, shared hook, control wiring and content registry are enforced by `scripts/admin-visual-studio-regression.test.mjs`; Chromium and WebKit iframe rendering is exercised by the web-platform smoke suite.

**Limit:** The CI browser tests check iframe loading without private credentials. A full signed-in MFA editor action and real publish/rollback must be exercised in an authorised administrator session before treating it as an independent human acceptance test.
