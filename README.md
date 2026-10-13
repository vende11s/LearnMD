# LearnMD

A local-first reader for thoughtful, interactive educational notes. React, TypeScript, IndexedDB, and an extended Markdown format. No account, backend, AI API, or document editor.

Open [LearnMD on GitHub Pages](https://vende11s.github.io/LearnMD/).

## Agent skill

Install the **learnmd** skill to create, convert, or repair `.learn.md` study notes with a compatible AI agent:

```sh
npx skills add vende11s/LearnMD
```

The installer discovers [skills/learnmd](skills/learnmd/SKILL.md) and lets you choose your agent. For a non-interactive, project-local Codex installation:

```sh
npx skills add vende11s/LearnMD --skill learnmd --agent codex -y
```

Ask, for example: “Use the learnmd skill to turn these lecture notes into a Polish `.learn.md` lesson with worked examples and a short quiz.” The skill includes its own complete format reference, so the application repository is not needed after installation. Import the resulting note in the [LearnMD reader](https://vende11s.github.io/LearnMD/).

The [skills CLI](https://skills.sh/docs) installs from a repository or URL; `npx skills add learnmd` is not a supported global package alias. Publishing this skill means pushing its folder to this public repository's default branch, with no npm package release required.

Maintainers: after changing the format registry or reference generator, run `npm run skill:sync` and commit the updated bundled reference. `npm run skill:check` checks that it is current and runs in CI.

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

## Deployment

GitHub Actions validates changes pushed to `main`, builds the static application, and deploys `dist/` to GitHub Pages at `/LearnMD/`. The workflow can also be started manually. Relative build asset paths keep scripts, styles, fonts, and the service worker inside the project path. The production browser test exercises that same path and checks the worker scope, local notes, bundled images, and the component guide with the network offline.

Each browser and origin has its own local library. To move notes from a local development URL to the published site, export a library backup in Settings and restore it on the published site.

## Use

- **Generate notes:** copy the compact format and teaching prompt into ChatGPT, Claude, Gemini, or another LLM, along with slides, PDFs, exercise sets, notes, or a topic you want to learn. It asks for concise explanations that retain necessary reasoning, returned as one code block for easy copying. The import dialog links directly to this screen. LearnMD itself sends no AI requests.
- **Add note:** paste source or import `.learn.md` / `.md` files. An unambiguous enclosing Markdown fence is removed automatically. Inspect validation messages before importing.
- **Reader:** navigate a chapter, reveal proofs and derivations, and explore diagrams. Sections display their complete authored text; layered explanations use manually selected tabs. Reading position is saved. Responses, scratchpad work, and component interaction state are temporary; source remains read-only.
- **Ask your LLM:** use **Copy source** above a document to copy its full LearnMD source. Selecting text reveals a floating source button that copies the original selected blocks, including Markdown, formulas, and complete component fences. Paste this context into your preferred LLM and ask follow-up questions.
- **Long quizzes and mixed content:** a `carousel` presents any number of `slide` blocks within the document limits. Slides accept ordinary prose and nested components. Navigation preserves answers and scratchpad content while the document remains open; printing includes every slide.
- **Language:** Settings offers English and Polish. The initial interface language follows the browser/system preference, with English as fallback; an explicit selection is saved on the device. The generation prompt stays in English and requests notes in the language of the supplied materials unless instructed otherwise.
- **Library:** search titles and content, mark favorites, sort, and organize your own nested folders. Folders start empty; create them yourself and choose one of 16 icons, editable later. Metadata dialogs rename/move local copies. Hover or focus a note to reveal its trash action; deletion requires confirmation. Deleting a folder moves its contents into its parent. Folder icons are included in library backups.
- **Updates:** revise a source file externally. Paste its revised contents and choose **New note** or **Replace existing note**. Replacement requires selecting the target note, keeps favorites, resets reading position, and retains existing bundled assets unless new assets are supplied. A duplicate title requires an explicit import choice. File imports always create new notes.
- **Backup:** Settings → Export library creates a portable JSON backup containing notes, folders, favorites, and image assets. Restore validates the entire backup and adds new copies atomically, preserving existing data. An individual source export does not include image assets.

The library initializes with one root-level guide: **Your first steps with LearnMD** / **Pierwsze kroki z LearnMD**. It explains the workflow and demonstrates interactive components, including a carousel with different question types. Its authored text follows the selected interface language while it remains an unmodified built-in note. It can be organized or deleted normally; deleting it permanently opts out of automatic initialization, including after changing language. Imported or replaced notes are never translated automatically.

No folders are created automatically. A one-time upgrade removes the six legacy built-in chapters while preserving imported replacements, personal notes, and user folders. The earlier starter-folder migration also preserves renamed or customized folders and reparents their contents safely.

## Format and components

See [the complete format reference](docs/FORMAT.md). It documents all **65 public components** and their structural children, with validated working examples. The in-app Component guide renders those same examples, and the generation prompt derives from the same registry.

The generation prompt uses a compact catalog and representative examples; the full reference remains available above and in the Component guide. See [prompt design and research](docs/PROMPT-DESIGN.md) for the evidence, tradeoffs, and evaluation limits behind this choice.

```md
---
title: 'A first derivation'
subject: 'Algebra'
version: '1.0'
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

Tests cover parser/nesting/schema errors, all component examples, state transitions, manual tabs, cross-references, security, persistence, file/paste import, explicit replacement, folder operations, and backup validation. Browser tests exercise complete workflows and capture desktop, dark, and narrow-screen screenshots in `test-results/`. The Playwright HTML report is in `playwright-report/`.

The implementation uses standard browser APIs and does not depend on the File System Access API. On this development machine, the downloaded Playwright Firefox executable cannot launch because Windows reports a missing `mozglue` side-by-side assembly. GitHub Actions runs the Firefox suite on Ubuntu alongside Chromium and the production offline checks.

## Project map

- `src/format/` — AST, component registry, parsing, schemas, and generated prompt.
- `src/reader/` — Markdown, mathematics, semantic blocks, exercises, diagrams, scoped interaction state, and print fallbacks.
- `src/storage.ts` — transactional IndexedDB library, bounded imports, asset handling, and portable backup/restore.
- `src/components/` — accessible dialogs and import workflow.
- `src/App.tsx` — application shell, navigation, and initialization.
- `src/pages/` — library, document reader, component guide, and preferences.
- `src/content/` — English and Polish versions of the removable getting-started guide, with parser/math integration tests.
- `tests/e2e/` — repeatable browser workflows.
- `scripts/offline.ts` — production static-asset service worker generation.

See [architecture decisions](docs/ARCHITECTURE.md) for the rationale and product boundaries. Browser storage may be cleared or evicted; request persistent storage in Settings where supported and export regular backups.
