# Verification record

Verification on 11 October 2026 using Node.js 22.20.0 on Windows, after simplifying the reader and format.

| Check                                                                                              | Result                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Complete unit suite: format, renderer, interface, storage, migration, security, and sample content | 261 passing across 11 files                 |
| Six substantive sample chapters and their LaTeX expressions                                        | 6 passing, included in the unit total       |
| TypeScript and production build                                                                    | Passing                                     |
| Chromium end-to-end workflows                                                                      | 16 passing                                  |
| Project-path production build reopening notes, images, and guide offline                           | 1 passing                                   |
| npm dependency audit                                                                               | Previous audit: 0 known vulnerabilities     |
| Firefox browser execution                                                                          | Blocked by local Windows runtime; see below |

## End-to-end scope

The browser suite tests copying the full generation prompt; rejecting invalid source; extracting fenced source; importing from paste and files; skipping invalid files in a batch; interacting with manual tabs, quiz answers, and progressive steps; persisting favorites and reading position across reload; explicit replacement; nested folder creation and moving; preserving notes when deleting folders; bundling a real image; exporting/restoring a portable backup; retaining assets after reload; navigating semantic references without leaving the note; opening every one of the 65 public components; removing untrusted HTML; requiring consent before remote image requests; and reopening a production build offline.

Additional scenarios verify Polish system-language initialization, English preference persistence, localized component help with an English generation prompt, a 14-slide sequence containing 12 quizzes and other content, preserved quiz and scratchpad state, outline navigation to hidden slides, exact full-document and selected-component source copying, a floating source button below selected fractions, and hover-delete cancellation/isolation in grid and list views. A reader regression checks that sections remain visible, layered views still respond to manual selection, no density controls appear in the reader, guide, or Settings, and Settings has no Reading heading.

Desktop, dark-theme, and 390-pixel-wide reader screenshots were captured and visually inspected. Narrow mathematical content was checked separately. Reading stays within the viewport; long expressions, code, diagrams, and tables have local overflow areas. The in-app browser was also used to inspect and operate the local reader.

Folder scenarios cover empty initial folders, icon creation/editing/reload, nested folder icon backup/restore, the 390-pixel icon picker, existing folder reparenting, image backup/restore, and offline initialization. Desktop and mobile picker screenshots are saved in `docs/screenshots/`. The earlier in-app preview confirmed that existing starter folders were removed while all six notes remained.

The UI and security review led to fixes for partial batch writes, unsafe replacement collisions, stale image attachments on paste replacement, excessive folder-restore work, decoded asset bounds, hidden semantic targets, hash-route interference, reading-position races, scroll overflow, and service-worker cache matching. The final local suite rechecked these behaviors against the current revision.

## Remaining verification limit

The Playwright Firefox binary was installed, but Windows cannot launch it: its side-by-side configuration reports a missing `mozglue` assembly. This is a browser-runtime failure before the application loads. No Firefox compatibility pass is claimed. The Firefox project remains configured; run `npm run test:e2e -- --project=firefox` on a host with a functioning Firefox runtime.

The application relies on standard IndexedDB, file inputs, native controls, and optional directory input. It does not depend on Chromium's File System Access API. Directory selection and persistent-storage grants depend on the browser.

Production build output has harmless upstream Zod PURE-annotation warnings from Rollup. Compilation succeeds; no runtime workaround or warning suppression was added.
