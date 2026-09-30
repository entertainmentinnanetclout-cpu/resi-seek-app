import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const assetsDir = path.join(root, "dist", "assets");
const indexPath = path.join(root, "dist", "index.html");
const fail = [];
const pass = (label, detail) => console.log("PASS", label, detail || "");
const check = (condition, label, detail) => condition ? pass(label, detail) : fail.push({ label, detail });
const kb = bytes => Math.round(bytes / 1024 * 10) / 10;

if (!fs.existsSync(assetsDir) || !fs.existsSync(indexPath)) {
  console.error("FAIL production dist is missing; run after vite build");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).filter(name => name.endsWith(".js")).map(name => {
  const full = path.join(assetsDir, name);
  const bytes = fs.statSync(full).size;
  const gzip = zlib.gzipSync(fs.readFileSync(full), { level: 9 }).length;
  return { name, bytes, gzip };
}).sort((a,b)=>b.bytes-a.bytes);

const html = fs.readFileSync(indexPath, "utf8");
const entryName = html.match(/<script[^>]+src=["']\/assets\/([^"']+\.js)/)?.[1];
const entry = files.find(file => file.name === entryName);
const largest = files[0];
const heavy3d = files.filter(file => /OrbitControls|three|fiber|drei/i.test(file.name));
const over500 = files.filter(file => file.bytes > 500 * 1024);

check(Boolean(entry), "entry bundle located", entryName || "missing");
if (entry) {
  check(entry.bytes <= 380 * 1024, "entry raw size <= 380 KiB", `${entry.name} ${kb(entry.bytes)} KiB`);
  check(entry.gzip <= 125 * 1024, "entry gzip size <= 125 KiB", `${kb(entry.gzip)} KiB`);
}
check(Boolean(largest) && largest.bytes <= 950 * 1024, "no JS chunk exceeds 950 KiB", largest ? `${largest.name} ${kb(largest.bytes)} KiB` : "none");
check(over500.length <= 2, "at most two exceptional chunks exceed 500 KiB", over500.map(file=>`${file.name}:${kb(file.bytes)}`).join(", ") || "none");
for (const file of heavy3d) check(file.bytes <= 900 * 1024, "3D runtime chunk <= 900 KiB", `${file.name} ${kb(file.bytes)} KiB`);

const performance = fs.readFileSync(path.join(root,"src/lib/devicePerformance.ts"),"utf8");
const panorama = fs.readFileSync(path.join(root,"src/components/virtualTours/VirtualTourPanorama.tsx"),"utf8");
const legacy360 = fs.readFileSync(path.join(root,"src/components/resmap/Residence360Viewer.tsx"),"utf8");
const twin = fs.readFileSync(path.join(root,"src/components/resmap/ResidenceDigitalTwin.tsx"),"utf8");
const capture = fs.readFileSync(path.join(root,"src/lib/virtualTours/capture.ts"),"utf8");
const immersive = fs.readFileSync(path.join(root,"src/pages/ImmersiveResidence.tsx"),"utf8");
const slideshow = fs.readFileSync(path.join(root,"src/components/ResidenceImageSlideshow.tsx"),"utf8");
const residenceLayout = fs.readFileSync(path.join(root,"src/pages/residence/ResidenceLayout.tsx"),"utf8");

check(performance.includes("deviceMemory") && performance.includes("hardwareConcurrency") && performance.includes("saveData"), "runtime device budget covers memory CPU and data saver");
check(panorama.includes("graphicsBudget") && panorama.includes("texture.dispose"), "Gold 360 applies budget and disposes textures");
check(legacy360.includes("Static 360 preview") && legacy360.includes("texture.dispose"), "legacy 360 has low-memory fallback and disposal");
check(twin.includes("useGLTF.clear") && twin.includes("geometry?.dispose"), "digital twin releases GLTF geometry/material resources");
check(capture.includes("canvas.width = 1") && capture.includes("bmp.close()"), "360 capture releases bitmap/canvas memory");
check(immersive.includes("lazy(() => import") && immersive.includes("budget.allowHeavy3d"), "immersive 3D/360 code is deferred and constrained-device aware");
check(slideshow.includes("activeWindow") && slideshow.includes('decoding="async"'), "residence slideshow decodes only active image window");
check(residenceLayout.includes("120_000") && residenceLayout.includes('document.visibilityState === "visible"'), "realtime residence portal avoids aggressive hidden polling");

console.log("\nLargest production chunks:");
files.slice(0,8).forEach(file => console.log(`  ${file.name.padEnd(55)} ${String(kb(file.bytes)).padStart(8)} KiB raw  ${String(kb(file.gzip)).padStart(8)} KiB gzip`));

if (fail.length) {
  for (const row of fail) console.error("FAIL", row.label, row.detail || "");
  console.error(`\nP9 performance budget failed with ${fail.length} issue(s).`);
  process.exit(1);
}
console.log("\nP9 performance and memory budget passed.");
