#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

const MIN_ALIGNMENT = 0x4000n; // 16 KiB
const REQUIRED_64_BIT_ABIS = new Set(['arm64-v8a', 'x86_64', 'riscv64']);
const aab = process.argv[2] || 'android/app/build/outputs/bundle/release/app-release.aab';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function listNativeLibraries(bundlePath) {
  const entries = run('unzip', ['-Z1', bundlePath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return entries.filter((entry) => /^base\/lib\/.+\.so$/.test(entry));
}

function abiFor(entry) {
  const match = entry.match(/^base\/lib\/([^/]+)\//);
  return match?.[1] || 'unknown';
}

function parseLoadAlignments(readelfOutput, entry) {
  const loads = readelfOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('LOAD'));

  if (loads.length === 0) {
    throw new Error(`${entry}: readelf reported no ELF LOAD segments`);
  }

  return loads.map((line) => {
    const fields = line.split(/\s+/);
    const alignToken = fields.at(-1);
    if (!alignToken || !/^0x[0-9a-f]+$/i.test(alignToken)) {
      throw new Error(`${entry}: could not parse LOAD alignment from: ${line}`);
    }
    return { line, alignment: BigInt(alignToken) };
  });
}

let libraries;
try {
  run('readelf', ['--version'], { encoding: 'utf8' });
  libraries = listNativeLibraries(aab);
} catch (error) {
  console.error(`16 KB ELF verification setup failed: ${error.message}`);
  process.exit(1);
}

if (libraries.length === 0) {
  console.log('PASS: no packaged native ELF libraries; 16 KB ELF LOAD alignment is not applicable.');
  process.exit(0);
}

const workDir = mkdtempSync(join(tmpdir(), 'reskonnect-elf-'));
const failures = [];
const diagnostics = [];
let required64Count = 0;

try {
  console.log(`Checking ${libraries.length} packaged native ELF libraries.`);
  console.log('Google Play 16 KB compatibility is enforced for packaged 64-bit ABIs; 32-bit ABIs are reported diagnostically.');

  for (const [index, entry] of libraries.entries()) {
    const abi = abiFor(entry);
    const requires16K = REQUIRED_64_BIT_ABIS.has(abi);
    if (requires16K) required64Count += 1;

    const outputPath = join(workDir, `${index}-${basename(entry)}`);
    const bytes = run('unzip', ['-p', aab, entry]);
    writeFileSync(outputPath, bytes);

    let programHeaders;
    try {
      programHeaders = run('readelf', ['-lW', outputPath], { encoding: 'utf8' });
    } catch (error) {
      const message = `${entry}: readelf failed (${error.message})`;
      if (requires16K) failures.push(message);
      else diagnostics.push(message);
      continue;
    }

    let loads;
    try {
      loads = parseLoadAlignments(programHeaders, entry);
    } catch (error) {
      if (requires16K) failures.push(error.message);
      else diagnostics.push(error.message);
      continue;
    }

    const tooSmall = loads.filter(({ alignment }) => alignment < MIN_ALIGNMENT);
    const minimum = loads.reduce(
      (current, { alignment }) => (alignment < current ? alignment : current),
      loads[0].alignment,
    );

    if (requires16K && tooSmall.length > 0) {
      failures.push(`${entry}: minimum LOAD alignment is 0x${minimum.toString(16)}; required >= 0x${MIN_ALIGNMENT.toString(16)} for 64-bit ABI ${abi}`);
      for (const { line } of tooSmall) failures.push(`  ${line}`);
    } else if (requires16K) {
      console.log(`PASS ${entry} (${abi}, minimum LOAD alignment 0x${minimum.toString(16)})`);
    } else if (tooSmall.length > 0) {
      diagnostics.push(`${entry}: 32-bit ABI ${abi} minimum LOAD alignment is 0x${minimum.toString(16)} (diagnostic only; Play 16 KB requirement applies to 64-bit devices)`);
    } else {
      console.log(`INFO ${entry} (${abi}, minimum LOAD alignment 0x${minimum.toString(16)})`);
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

for (const diagnostic of diagnostics) console.warn(`INFO: ${diagnostic}`);

if (required64Count === 0) {
  console.error('FAIL: native code is packaged but no recognized 64-bit ABI libraries were found.');
  process.exit(1);
}

if (failures.length > 0) {
  console.error('\nFAIL: one or more required 64-bit native libraries are not 16 KB page-size compatible:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nPASS: all ${required64Count} packaged 64-bit native libraries have ELF LOAD alignment >= 16 KB (0x4000).`);
