import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Static callers are compared with an independently captured, read-only
 * production Supabase public API snapshot. This catches absent functions,
 * relations, buckets and RPC argument-name drift BEFORE releases.
 *
 * The snapshot is point-in-time: re-query production after migrations or
 * Edge deployments. This does not substitute for RLS or OAuth runtime tests.
 */
const root = process.cwd();
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "scripts/backend-live-contracts.snapshot.json"), "utf8"));
const strict = process.argv.includes("--strict");
const verbose = process.argv.includes("--verbose");
const repoFiles = new Set();
const sourceFiles = [];
const walk = dir => {
  if (!fs.existsSync(dir)) return;
  for (const node of fs.readdirSync(dir, { withFileTypes: true })) {
    const loc = path.join(dir, node.name);
    if (node.isDirectory()) walk(loc);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(node.name) && !/\.d\.ts$/.test(node.name) && !node.name.includes(".generated.")) {
      const relative = path.relative(root, loc).replaceAll(path.sep, "/");
      repoFiles.add(relative);
      sourceFiles.push({ relative, loc });
    }
  }
};
walk(path.join(root, "src"));
walk(path.join(root, "supabase/functions"));

const refs = { relations: new Map(), rpc: new Map(), edge: new Map(), buckets: new Map() };
const dynamic = [];
const store = (kind, name, file, line, args = null) => {
  const rec = refs[kind].get(name) || [];
  rec.push({ file, line, ...(args ? { args } : {}) });
  refs[kind].set(name, rec);
};
const literal = (node, constants) => {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return literal(node.expression, constants);
  if (ts.isIdentifier(node) && constants.has(node.text)) return constants.get(node.text);
  return null;
};
const captures = new Map();
const getLine = (source, node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
let codeFiles = 0;
for (const { relative, loc } of sourceFiles) {
  const content = fs.readFileSync(loc, "utf8");
  const script = ts.createSourceFile(relative, content, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(loc) ? ts.ScriptKind.TSX : /\.jsx$/.test(loc) ? ts.ScriptKind.JSX : ts.ScriptKind.TS);
  codeFiles++;
  const constants = new Map();
  const collect = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.initializer && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
        constants.set(node.name.text, node.initializer.text);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(script);
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const prop = ts.isPropertyAccessExpression(expr) ? expr.name.text : ts.isIdentifier(expr) ? expr.text : "";
      const receiver = ts.isPropertyAccessExpression(expr) ? expr.expression : null;
      const nested = receiver && ts.isPropertyAccessExpression(receiver) ? receiver.name.text : "";
      const name = literal(node.arguments[0], constants);
      const line = getLine(script, node);
      let kind = null;
      if (prop === "rpc" && receiver) kind = "rpc";
      else if (prop === "from" && receiver) kind = nested === "storage" ? "buckets" : "relations";
      else if (prop === "invoke" && nested === "functions") kind = "edge";
      else if (prop === "invokeEdgeFunction" || prop === "externalFunctionUrl") kind = "edge";
      else if (prop === "invoke" && typeof name === "string" && /^(adminos-|dimpho-|resmap-|luna-)/.test(name)) kind = "edge";
      if (kind) {
        if (typeof name === "string") {
          let args = null;
          if (kind === "rpc" && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
            args = node.arguments[1].properties.filter(ts.isPropertyAssignment)
              .map(p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null)
              .filter(Boolean);
          }
          store(kind, name, relative, line, args);
        } else {
          dynamic.push({ kind, file: relative, line, expression: node.arguments[0]?.getText(script)?.slice(0, 60) || "(none)" });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(script);
  // Literal URL paths are another direct Edge function dependency, including
  // social crawlers consuming /functions/v1/og-image outside the React client.
  for (const hit of content.matchAll(/\/functions\/v1\/([a-z][a-z0-9-]+)/g)) {
    store("edge", hit[1], relative, content.slice(0, hit.index).split("\n").length);
  }
}
const live = {
  relations: new Set(snapshot.public_relations),
  rpc: new Set(snapshot.callable_routines.map(x => x.name)),
  edge: new Set(snapshot.edge_functions.map(x => x.slug)),
  buckets: new Set(snapshot.storage_buckets),
};
const issues = [];
const warnings = [];
for (const [kind, names] of Object.entries(refs)) {
  for (const [name, locations] of names) {
    if (!live[kind].has(name)) {
      issues.push({ code: "MISSING_" + kind.toUpperCase(), name, locations: locations.slice(0, 4) });
      continue;
    }
    if (kind === "rpc") {
      const overloads = snapshot.callable_routines.filter(x => x.name === name);
      if (!overloads.some(x => x.authenticated || x.anon)) {
        issues.push({ code: "RPC_NOT_EXECUTABLE", name, locations: locations.slice(0, 3) });
      }
      for (const call of locations) {
        if (call.args?.length && !overloads.some(ov => call.args.every(a => ov.args.includes(a)))) {
          issues.push({ code: "RPC_PARAMETER_MISMATCH", name, supplied: call.args, serverArguments: overloads.map(x => x.args), locations: [call] });
        }
      }
    }
  }
}
const localEntrypoints = new Set(
  [...repoFiles].filter(x => /^supabase\/functions\/[^/]+\/index\.ts$/.test(x)).map(x => x.split("/")[2])
);
const sourceOnly = [...localEntrypoints].filter(x => !live.edge.has(x)).sort();
const productionOnly = [...live.edge].filter(x => !localEntrypoints.has(x)).sort();
const config = fs.readFileSync("supabase/config.toml", "utf8");
const configs = new Map([...config.matchAll(/\[functions\.([a-z][a-z0-9-]+)\]\s*verify_jwt\s*=\s*(true|false)/g)]
  .map(m => [m[1], m[2] === "true"]));
for (const [slug, setting] of configs) {
  const entry = snapshot.edge_functions.find(f => f.slug === slug);
  if (entry && Boolean(entry.verify_jwt) !== setting) {
    issues.push({ code: "EDGE_JWT_CONFIG_DRIFT", name: slug, local: setting, deployed: entry.verify_jwt });
  }
}
if (sourceOnly.length) warnings.push({ code: "SOURCE_ONLY_FUNCTIONS", names: sourceOnly });
if (productionOnly.length) warnings.push({ code: "UNTRACKED_PRODUCTION_FUNCTIONS", names: productionOnly });
if (dynamic.length) warnings.push({ code: "DYNAMIC_CALLS_REVIEW", count: dynamic.length, examples: dynamic.slice(0, 25) });

const summary = {
  project: snapshot.project_id,
  captured: snapshot.captured_date,
  checkedSourceFiles: codeFiles,
  uniqueReferences: Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, v.size])),
  totalCallSites: Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, [...v.values()].reduce((a, b) => a + b.length, 0)])),
  liveInventory: { relations: live.relations.size, rpc: live.rpc.size, edge: live.edge.size, buckets: live.buckets.size },
  failures: issues.length,
  warnings: warnings.length,
  sourceOnlyFunctions: sourceOnly,
  productionOnlyFunctions: productionOnly,
};
const report = { summary, issues, warnings };
fs.writeFileSync("backend-contract-audit.json", JSON.stringify(report, null, 2) + "\n", "utf8");
console.log("BACKEND_CONTRACT_AUDIT_SUMMARY=" + JSON.stringify(summary));
for (const finding of issues) console.error("CONTRACT_ERROR " + JSON.stringify(finding));
for (const finding of warnings) console.warn("CONTRACT_WARNING " + JSON.stringify(finding));
if (verbose) {
  for (const [k, v] of Object.entries(refs)) {
    console.log("REFERENCES " + k + " " + JSON.stringify([...v.keys()].sort()));
  }
}
if (strict && issues.length) {
  console.error("Backend contract audit failed: " + issues.length + " unresolved production reference or configuration mismatch(es).");
  process.exitCode = 1;
}
