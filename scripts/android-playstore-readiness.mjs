import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const findings = [];

const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => exists(relative) ? fs.readFileSync(path.join(root, relative), "utf8") : "";
const add = (level, check, message) => findings.push({ level, check, message });

const capacitorConfig = ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"].find(exists);
if (!capacitorConfig) add("BLOCKER", "Capacitor config", "No capacitor.config.* file is committed.");
else add("PASS", "Capacitor config", capacitorConfig);

if (!exists("android")) add("BLOCKER", "Android project", "No android/ native project is committed.");
else add("PASS", "Android project", "android/ exists");

const gradleCandidates = ["android/app/build.gradle", "android/app/build.gradle.kts"];
const appGradle = gradleCandidates.find(exists);
if (!appGradle) {
  add("BLOCKER", "App Gradle", "No Android app build.gradle/build.gradle.kts was found.");
} else {
  const gradle = read(appGradle);
  const targetMatch = gradle.match(/targetSdk(?:Version)?\s*[= ]\s*(\d+)/) || gradle.match(/targetSdk\s*=\s*(\d+)/);
  const compileMatch = gradle.match(/compileSdk(?:Version)?\s*[= ]\s*(\d+)/) || gradle.match(/compileSdk\s*=\s*(\d+)/);
  const target = targetMatch ? Number(targetMatch[1]) : null;
  const compile = compileMatch ? Number(compileMatch[1]) : null;

  if (target == null) add("WARN", "targetSdk", "Could not statically resolve targetSdk. It may be inherited from variables.gradle.");
  else if (target < 36) add("BLOCKER", "targetSdk", `targetSdk ${target} is below Google Play's current new-app requirement of API 36.`);
  else add("PASS", "targetSdk", `API ${target}`);

  if (compile == null) add("WARN", "compileSdk", "Could not statically resolve compileSdk. It may be inherited from variables.gradle.");
  else if (compile < 36) add("BLOCKER", "compileSdk", `compileSdk ${compile} should be upgraded to at least API 36.`);
  else add("PASS", "compileSdk", `API ${compile}`);
}

const manifest = "android/app/src/main/AndroidManifest.xml";
if (!exists(manifest)) add("BLOCKER", "AndroidManifest", "android/app/src/main/AndroidManifest.xml is missing.");
else {
  const xml = read(manifest);
  add("PASS", "AndroidManifest", manifest);
  if (!/android\.permission\.INTERNET/.test(xml)) add("WARN", "Internet permission", "INTERNET permission is not explicit in the manifest.");
  if (/ACCESS_FINE_LOCATION/.test(xml)) add("PASS", "Location permission", "Fine location declared.");
  else add("WARN", "Location permission", "Find My Res live navigation needs a deliberate Android location permission strategy.");
}

const pkg = JSON.parse(read("package.json") || "{}");
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
for (const dependency of ["@capacitor/core", "@capacitor/android", "@capacitor/cli"]) {
  if (deps[dependency]) add("PASS", dependency, deps[dependency]);
  else add("BLOCKER", dependency, "Not declared in package.json.");
}

if (exists("android/app/google-services.json")) add("PASS", "Firebase config", "google-services.json present (ensure it is the production project and safe to commit).");
else add("WARN", "Firebase config", "No google-services.json committed; required only if the Android build uses Firebase/FCM.");

const privacyCandidates = ["src/pages/Privacy.tsx", "public/privacy.html"];
if (privacyCandidates.some(exists)) add("PASS", "Privacy policy UI", privacyCandidates.find(exists));
else add("BLOCKER", "Privacy policy UI", "Google Play requires an in-app and public privacy policy.");

const deletionEvidence = ["account deletion", "delete account", "account_deletion"].some((needle) => {
  const candidates = ["src", "supabase", "docs"];
  return candidates.some((dir) => {
    if (!exists(dir)) return false;
    const stack = [path.join(root, dir)];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.(tsx?|sql|md)$/i.test(entry.name)) {
          try { if (fs.readFileSync(full, "utf8").toLowerCase().includes(needle)) return true; } catch { /* ignore */ }
        }
      }
    }
    return false;
  });
});
if (deletionEvidence) add("PASS", "Account deletion evidence", "Deletion-related implementation text exists; verify the user-facing path end-to-end.");
else add("BLOCKER", "Account deletion", "Apps that create accounts need an in-app deletion request path and an external web deletion resource.");

const blockers = findings.filter((row) => row.level === "BLOCKER");
const warnings = findings.filter((row) => row.level === "WARN");

console.log("\nResKonnect Android / Google Play readiness audit\n");
for (const row of findings) console.log(`${row.level.padEnd(7)} ${row.check}: ${row.message}`);
console.log(`\nSummary: ${blockers.length} blocker(s), ${warnings.length} warning(s), ${findings.filter((row) => row.level === "PASS").length} pass(es).`);

if (strict && blockers.length) process.exit(1);
