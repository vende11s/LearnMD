# Verification record

Local verification on 11 October 2026 using Node.js 22.20.0 on Windows, after compacting the generation prompt while preserving its format contract. GitHub Actions checks the same source on Ubuntu with Node.js 22 before deployment.

| Check                                                                                             | Result                                  |
| ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Complete unit suite: format, renderer, interface, storage, migration, security, and guide content | 287 passing across 13 files             |
| English/Polish guide, interactive answers, metadata, and LaTeX                                    | 5 passing, included in the unit total   |
| TypeScript and production build                                                                   | Passing                                 |
| Chromium end-to-end workflows                                                                     | 20 passing                              |
| Project-path production build reopening notes, images, and guide offline                          | 1 passing                               |
| npm dependency audit                                                                              | Previous audit: 0 known vulnerabilities |
| Firefox browser execution                                                                         | 20 passing on Ubuntu CI                 |

## End-to-end scope

The browser suite tests copying the full generation prompt; rejecting invalid source; extracting fenced source; importing from paste and files; skipping invalid files in a batch; interacting with manual tabs, quiz answers, and progressive steps; persisting favorites and reading position across reload; explicit replacement; nested folder creation and moving; preserving notes when deleting folders; bundling a real image; exporting/restoring a portable backup; retaining assets after reload; navigating semantic references without leaving the note; opening every one of the 65 public components; removing untrusted HTML; requiring consent before remote image requests; and reopening a production build offline.

Additional scenarios verify Polish system-language initialization, English preference persistence, localized component help with an English generation prompt, a 14-slide sequence containing 12 quizzes and other content, preserved quiz and scratchpad state, outline navigation to hidden slides, exact full-document and selected-component source copying, a floating source button below selected fractions, and hover-delete cancellation/isolation in grid and list views. A reader regression checks that sections remain visible, layered views still respond to manual selection, no density controls appear in the reader, guide, or Settings, and Settings has no Reading heading.

Desktop, dark-theme, and 390-pixel-wide reader screenshots were captured and visually inspected. Narrow mathematical content was checked separately. Reading stays within the viewport; long expressions, code, diagrams, and tables have local overflow areas. The in-app browser was also used to inspect and operate the local reader.

Folder scenarios cover empty initial folders, icon creation/editing/reload, nested folder icon backup/restore, the 390-pixel icon picker, existing folder reparenting, image backup/restore, and offline initialization. Desktop and mobile picker screenshots are saved in `docs/screenshots/`.

Onboarding scenarios verify the one-guide library, removed decorative text, the direct import-to-generation action, two clear import choices, English/Polish authored content, unchanged personal imports, permanent guide deletion, and several interactive question types with preserved carousel answers. Twenty initialization tests cover legacy sample cleanup, user records and assets, language changes, ownership, concurrent initialization, and transactional rollback.

Prompt checks independently read the compact catalog and verify all 65 public components and 22 structural children, exact attribute sets, required values, enums, numeric bounds, lexical types, and parent/child relationships. All four selected examples parse without diagnostics; assertions inspect their carousel, quiz, math, reference, code, diagram, and shared-state structure. Browser checks confirm that the copied English prompt matches its preview, requests concise notes with necessary reasoning, and stays below the maintenance size guard. The complete format reference is unchanged. These checks validate the authoring contract, not model-generated teaching quality; no model A/B evaluation was performed. See [the research and design record](PROMPT-DESIGN.md).

The UI and security review led to fixes for partial batch writes, unsafe replacement collisions, stale image attachments on paste replacement, excessive folder-restore work, decoded asset bounds, hidden semantic targets, hash-route interference, reading-position races, scroll overflow, and service-worker cache matching. The final local suite rechecked these behaviors against the current revision.

## Previous deployment verification

[GitHub Actions run 38169031381](https://github.com/vende11s/LearnMD/actions/runs/38169031381) passed 277 unit tests, the production build, and all 41 browser tests (20 Chromium, 20 Firefox, and one production/offline Chromium scenario), then successfully deployed to GitHub Pages.

The published site at [vende11s.github.io/LearnMD/](https://vende11s.github.io/LearnMD/) returned HTTP 200 and passed an additional Chromium smoke test covering the single Polish guide, removed decorative UI, exactly two import choices, the import-to-generation action, English authored-guide localization, quiz carousel interaction, and offline reload with mathematical rendering. The import dialog was also checked at 390 pixels and visually inspected. No page errors or failed application responses were recorded.

## Local verification limit

The Playwright Firefox binary was installed, but this Windows host cannot launch it: its side-by-side configuration reports a missing `mozglue` assembly. This is a browser-runtime failure before the application loads. Firefox verification was completed successfully on the Ubuntu GitHub Actions runner instead. The Firefox project remains configured; run `npm run test:e2e -- --project=firefox` on a host with a functioning Firefox runtime.

The application relies on standard IndexedDB, file inputs, native controls, and optional directory input. It does not depend on Chromium's File System Access API. Directory selection and persistent-storage grants depend on the browser.

Production build output has harmless upstream Zod PURE-annotation warnings from Rollup. Compilation succeeds; no runtime workaround or warning suppression was added.
