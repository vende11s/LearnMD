import type { Plugin } from 'vite';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/** Cache only this build's static assets. Imported documents remain in IndexedDB. */
export function offlineBuild(): Plugin {
  return {
    name: 'learnmd-offline',
    apply: 'build',
    async closeBundle() {
      const files: string[] = [];
      async function collect(dir: string, prefix = '') {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const relative = `${prefix}${entry.name}`;
          if (entry.isDirectory())
            await collect(join(dir, entry.name), `${relative}/`);
          else if (entry.name !== 'sw.js') files.push(`./${relative}`);
        }
      }
      await collect('dist');
      const cache = `learnmd-${Date.now()}`;
      await writeFile(
        'dist/sw.js',
        `const CACHE=${JSON.stringify(cache)};const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('learnmd-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});`,
      );
    },
  };
}
