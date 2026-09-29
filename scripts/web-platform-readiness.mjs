import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const vite = read("vite.config.ts");
const index = read("index.html");
const css = read("src/styles/mobile-foundation.css");
const install = read("src/components/InstallAppPrompt.tsx");
const app = read("src/App.tsx");
const manifest = read("public/manifest.json");

const checks = [
  [vite.includes('orientation: "any"'), "PWA manifest permits phone, tablet and desktop orientations"],
  [vite.includes("shortcuts:"), "PWA manifest exposes useful app shortcuts"],
  [index.includes('/manifest.webmanifest?v=5'), "HTML uses the generated production manifest"],
  [index.includes('apple-mobile-web-app-capable'), "iOS standalone metadata remains enabled"],
  [css.includes("100svh") && css.includes("100dvh"), "viewport CSS has Safari-safe and dynamic-height fallbacks"],
  [css.includes("-webkit-font-smoothing"), "macOS/iOS font rendering is hardened"],
  [install.includes("beforeinstallprompt"), "Chromium desktop install prompt is supported"],
  [install.includes("Add to Home Screen"), "iPhone/iPad installation guidance is present"],
  [install.includes("Add to Dock"), "macOS Safari installation guidance is present"],
  [install.includes("display-mode: standalone"), "installed-mode detection is present"],
  [app.includes("InstallAppPrompt"), "install UX is mounted in the web application"],
  [app.includes('path="/install"'), "permanent install guide is routable"],
  [manifest.includes('"orientation": "any"'), "static manifest stays compatible with desktop installs"],
];

let failed = 0;
for (const [ok, label] of checks) {
  if (ok) console.log("PASS", label);
  else { console.error("FAIL", label); failed += 1; }
}
if (failed) process.exit(1);
console.log(`Cross-platform web/PWA readiness passed (${checks.length} checks).`);
