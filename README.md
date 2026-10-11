# LearnMD

A local-first reader for thoughtful, interactive educational notes. React, TypeScript, IndexedDB, and an extended Markdown format. No account, backend, AI API, or document editor.

## Run locally

Requires Node.js 22.12 or later (Node 22 LTS recommended).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`. Keep the same hostname and port to keep using the same browser library: IndexedDB belongs to an origin.

```sh
npm run build
npm run preview
```

The production build is static output in `dist/`. Serve it over localhost or HTTPS, not a `file://` URL. After the first complete visit, its service worker caches the application, fonts, and code for offline use. External resources remain optional and require connectivity. A new build's worker takes over after existing tabs close. The development server deliberately does not register a service worker.

## Use

- **Generate notes:** copy the complete format and teaching prompt into any LLM, along with your materials. LearnMD itself sends no AI requests.
- **Add note:** paste source or import `.learn.md` / `.md` files. An unambiguous enclosing Markdown fence is removed automatically. Inspect validation messages before importing.
- **Reader:** navigate a chapter, reveal proofs and derivations, explore diagrams, and choose Concise, Standard, or Detailed explanations. Reading position is saved. Responses, scratchpad work, and component interaction state are temporary; source remains read-only.
- **Library:** search titles and content, mark favorites, sort, and organize nested folders. Metadata dialogs rename/move local copies. Deleting a folder moves its contents into its parent.
- **Updates:** revise a source file externally. Paste its revised contents and explicitly choose **Replace an existing note** or **Create a new copy**. Replacement keeps favorites, resets reading position, and retains existing bundled assets unless new assets are supplied. File imports always create new copies.
- **Backup:** Settings → Export library creates a portable JSON backup containing notes, folders, favorites, and image assets. Restore validates the entire backup and adds new copies atomically, preserving existing data. An individual source export does not include image assets.

The library initializes with six substantial chapters: calculus, linear algebra, algorithms, networks, physics, and history. These are ordinary, removable library copies, not special renderer paths.

## Format and components

See [the complete format reference](docs/FORMAT.md). It documents all **65 public components** and their structural children, with validated working examples. The in-app Component guide renders those same examples, and the generation prompt derives from the same registry.

```md
---
title: "A first derivation"
subject: "Algebra"
version: "1.0"
---

# A first derivation

::::derivation{title="Solve for x"}
:::step{title="Start"}
$$
2x+4=10
$$
:::

:::step{title="Subtract four" explanation="Preserve equality on both sides."}
$$
2x=6
$$
:::

:::step{title="Divide by two"}
$$
x=3
$$
:::
::::
```

Outer directive fences contain more colons than inner fences. Each closing fence exactly matches its opening fence. Parsing uses the remark AST; a lexical fence check adds actionable diagnostics to Markdown's permissive recovery.

## Images and resource policy

Directory import resolves relative image paths from each note's directory. Select the directory that contains the note and its assets; use paths such as `assets/diagram.png`. Nested directories work. Parent traversal (`../`), absolute paths, SVG uploads, HTML, and script/data URLs are not supported. A plain pasted note can refer to existing images when replacing a copy, but cannot carry new image bytes.

PNG, JPEG, GIF, WebP, and AVIF images up to 10 MB are stored as IndexedDB blobs. Each source is limited to 2 MB of UTF-8 bytes and one million characters, with further nesting, line, and AST limits documented in the format reference. Batches are capped at 200 files. Backups are capped at 100 MB. Files with validation errors are reported and skipped; all valid files in a batch are saved atomically.

Remote images are blocked by default and require an explicit load action or the external-image setting. External audio/video resources require explicit activation. Links open safely in a separate tab. Raw HTML is discarded, diagrams are declarative, code is displayed rather than executed, and KaTeX uses untrusted mode with expansion/size limits.

## Checks

```sh
npm test
npm run build
npm audit
npx playwright install chromium firefox
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=offline-chromium
npm run test:e2e -- --project=firefox
```

Tests cover parser/nesting/schema errors, all component examples, state transitions, detail modes, cross-references, security, persistence, file/paste import, explicit replacement, folder operations, and backup validation. Browser tests exercise complete workflows and capture desktop, dark, and narrow-screen screenshots in `test-results/`. The Playwright HTML report is in `playwright-report/`.

The implementation uses standard browser APIs and does not depend on the File System Access API. On this development machine, the downloaded Playwright Firefox executable cannot launch because Windows reports a missing `mozglue` side-by-side assembly. Firefox verification therefore remains an environment limitation; its project is configured for a machine with a working runtime.

## Project map

- `src/format/` — AST, component registry, parsing, schemas, and generated prompt.
- `src/reader/` — Markdown, mathematics, semantic blocks, exercises, diagrams, scoped interaction state, and print fallbacks.
- `src/storage.ts` — transactional IndexedDB library, bounded imports, asset handling, and portable backup/restore.
- `src/components/` — accessible dialogs and import workflow.
- `src/App.tsx` — application shell, navigation, and initialization.
- `src/pages/` — library, document reader, component guide, and preferences.
- `src/content/` — six real sample chapters with parser/math integration tests.
- `tests/e2e/` — repeatable browser workflows.
- `scripts/offline.ts` — production static-asset service worker generation.

See [architecture decisions](docs/ARCHITECTURE.md) for the rationale and product boundaries. Browser storage may be cleared or evicted; request persistent storage in Settings where supported and export regular backups.
