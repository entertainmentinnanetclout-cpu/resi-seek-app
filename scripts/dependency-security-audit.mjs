import { spawnSync } from "node:child_process";

const TEMPORARY_DEV_ADVISORIES = new Set([
  "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  "https://github.com/advisories/GHSA-rj75-hqrm-r3gf",
]);

// The braces advisory currently has no patched npm release. Keep this exception
// deliberately short-lived so upstream status must be reviewed rather than
// becoming a permanent blanket waiver.
const EXCEPTION_REVIEW_BEFORE = new Date("2026-11-21T00:00:00Z");

function runAudit(args) {
  const result = spawnSync("npm", ["audit", ...args, "--json"], {
    encoding: "utf8",
    shell: false,
  });

  let report;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch (error) {
    console.error("Unable to parse npm audit JSON output.");
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    throw error;
  }

  return { result, report };
}

function vulnerabilityCount(report) {
  return Object.keys(report?.vulnerabilities ?? {}).length;
}

// Production/runtime dependencies are never allowlisted. Any known issue at
// low severity or above blocks the release.
const { result: productionResult, report: productionReport } = runAudit([
  "--omit=dev",
  "--audit-level=low",
]);
if (productionResult.status !== 0 || vulnerabilityCount(productionReport) > 0) {
  console.error(
    "Production dependency audit failed. Runtime dependencies must have zero known vulnerabilities.",
  );
  console.error(JSON.stringify(productionReport, null, 2));
  process.exit(1);
}
console.log("PASS production dependencies: zero known vulnerabilities.");

const full = runAudit(["--audit-level=low"]);
const vulnerabilities = full.report?.vulnerabilities ?? {};

if (Object.keys(vulnerabilities).length === 0) {
  console.log("PASS full dependency tree: zero known vulnerabilities.");
  process.exit(0);
}

if (new Date() >= EXCEPTION_REVIEW_BEFORE) {
  console.error(
    `Temporary build-tool advisory exception expired on ${EXCEPTION_REVIEW_BEFORE.toISOString().slice(0, 10)}. Review upstream fixes before releasing.`,
  );
  process.exit(1);
}

const memo = new Map();
function isAllowedVulnerability(name, stack = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (stack.has(name)) return false;

  const vulnerability = vulnerabilities[name];
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
    memo.set(name, false);
    return false;
  }

  const nextStack = new Set(stack);
  nextStack.add(name);

  const allowed = vulnerability.via.every((via) => {
    if (typeof via === "string") {
      return isAllowedVulnerability(via, nextStack);
    }

    return Boolean(via?.url && TEMPORARY_DEV_ADVISORIES.has(via.url));
  });

  memo.set(name, allowed);
  return allowed;
}

const blocked = Object.keys(vulnerabilities).filter((name) => !isAllowedVulnerability(name));

if (blocked.length > 0) {
  console.error(`Dependency audit found non-allowlisted vulnerabilities: ${blocked.join(", ")}`);
  console.error(JSON.stringify(full.report, null, 2));
  process.exit(1);
}

const advisoryUrls = new Set();
for (const vulnerability of Object.values(vulnerabilities)) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via === "object" && via?.url) advisoryUrls.add(via.url);
  }
}

for (const url of advisoryUrls) {
  if (!TEMPORARY_DEV_ADVISORIES.has(url)) {
    console.error(`Unexpected advisory escaped package-chain validation: ${url}`);
    process.exit(1);
  }
}

console.log(
  `PASS full dependency audit with temporary build-only exceptions limited to ${[...advisoryUrls].join(", ")}.`,
);
console.log(
  `Exception review deadline: ${EXCEPTION_REVIEW_BEFORE.toISOString().slice(0, 10)}. Any new advisory still fails this gate.`,
);
