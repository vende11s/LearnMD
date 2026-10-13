import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const relativeOutput = 'skills/learnmd/references/format.md';
const output = resolve(root, relativeOutput);
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1) {
  console.error('Usage: node scripts/sync-skill.mjs [--check]');
  process.exitCode = 1;
} else {
  const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  });
  try {
    const { buildFormatReference } = await server.ssrLoadModule(
      '/src/format/prompt.ts',
    );
    const normalizeNewlines = (text) => text.replace(/\r\n?/g, '\n');
    const expected = normalizeNewlines(buildFormatReference());

    if (args.includes('--check')) {
      let actual;
      try {
        actual = await readFile(output, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (actual === undefined || normalizeNewlines(actual) !== expected) {
        console.error(
          `${relativeOutput} is missing or out of date. Run npm run skill:sync.`,
        );
        process.exitCode = 1;
      } else {
        console.log(`${relativeOutput} is up to date.`);
      }
    } else {
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, expected, 'utf8');
      console.log(`Updated ${relativeOutput}.`);
    }
  } finally {
    await server.close();
  }
}
