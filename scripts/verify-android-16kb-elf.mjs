#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

const MIN_ALIGNMENT = 0x4000n; // 16 KiB
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

try {
  console.log(`Checking ${libraries.length} packaged native ELF libraries for >= 16 KB LOAD alignment...`);

  for (const [index, entry] of libraries.entries()) {
    const outputPath = join(workDir, `${index}-${basename(entry)}`);
    const bytes = run('unzip', ['-p', aab, entry]);
    writeFileSync(outputPath, bytes);

    let programHeaders;
    try {
      programHeaders = run('readelf', ['-lW', outputPath], { encoding: 'utf8' });
    } catch (error) {
      failures.push(`${entry}: readelf failed (${error.message})`);
      continue;
    }

    let loads;
    try {
      loads = parseLoadAlignments(programHeaders, entry);
    } catch (error) {
      failures.push(error.message);
      continue;
    }

    const tooSmall = loads.filter(({ alignment }) => alignment < MIN_ALIGNMENT);
    const minimum = loads.reduce(
      (current, { alignment }) => (alignment < current ? alignment : current),
      loads[0].alignment,
    );

    if (tooSmall.length > 0) {
      failures.push(
        `${entry}: minimum LOAD alignment is 0x${minimum.toString(16)}; required >= 0x${MIN_ALIGNMENT.toString(16)}`,
      );
      for (const { line } of tooSmall) failures.push(`  ${line}`);
    } else {
      console.log(`PASS ${entry} (minimum LOAD alignment 0x${minimum.toString(16)})`);
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('\nFAIL: one or more native libraries are not 16 KB page-size compatible:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nPASS: all ${libraries.length} packaged native libraries have ELF LOAD alignment >= 16 KB (0x4000).`);
