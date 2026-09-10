import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.platform !== 'darwin') throw new Error('This check requires macOS and Xcode.');
const output = join(mkdtempSync(join(tmpdir(), 'openseat-bridge-check-')), 'scheduler');
execFileSync('xcrun', ['swiftc', '-cxx-interoperability-mode=default', '-Xcc', '-std=c++20',
  '-Xcc', '-fblocks', '-I', 'scripts/native-bridge', 'scripts/native-bridge/RuntimeScheduler.check.swift',
  '-o', output], { stdio: 'inherit', timeout: 60_000 });
execFileSync(output, [], { stdio: 'inherit', timeout: 10_000 });
