import fs from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const sourcePath = path.join(DIST, "index.html");
const source = await fs.readFile(sourcePath, "utf8");

const replaceOrInsert = (html, regex, tag) => regex.test(html)
  ? html.replace(regex, tag)
  : html.replace("</head>", `  ${tag}\n  </head>`);

let studio = source.replace(/<title>[\s\S]*?<\/title>/i, "<title>360 Studio | ResKonnect</title>");
studio = replaceOrInsert(
  studio,
  /<meta name="description" content="[^"]*"\s*\/?\s*>/i,
  '<meta name="description" content="Create, edit and publish standalone or residence-linked 360 virtual views with ResKonnect 360 Studio." />',
);
studio = replaceOrInsert(
  studio,
  /<meta name="robots" content="[^"]*"\s*\/?\s*>/i,
  '<meta name="robots" content="noindex, nofollow" />',
);
studio = replaceOrInsert(
  studio,
  /<link rel="canonical" href="[^"]*"\s*\/?\s*>/i,
  '<link rel="canonical" href="https://www.reskonnect.org/360-studio" />',
);
studio = replaceOrInsert(
  studio,
  /<meta property="og:url" content="[^"]*"\s*\/?\s*>/i,
  '<meta property="og:url" content="https://www.reskonnect.org/360-studio" />',
);

await fs.writeFile(path.join(DIST, "360-studio.html"), studio);

console.log("Emitted deterministic SPA entry: /360-studio -> dist/360-studio.html");
