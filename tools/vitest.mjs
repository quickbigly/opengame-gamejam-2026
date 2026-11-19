// Runs Vitest from a working directory with an uppercase drive letter.
// On Windows, VS Code starts terminals in `c:\...`; with a lowercase drive letter Vitest loads its runner
// twice and every suite fails with "Cannot read properties of undefined (reading 'config')".
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const cli = join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const { status } = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(status ?? 1);
