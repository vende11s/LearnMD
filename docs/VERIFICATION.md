# Verification record

Verified locally on 11 October 2026 using Node.js 22.20.0 on Windows.

| Check | Result |
| --- | --- |
| TypeScript and production build | Pass |
| Format, schema, nesting, limits, references, and prompt tests | 105 passing |
| Renderer, all public components, interaction, accessibility, and security tests | 80 passing |
| IndexedDB, imports, replacement, folders, assets, backup/restore tests | 19 passing |
| Six substantive sample chapters and their LaTeX expressions | 6 passing |
| Chromium end-to-end workflows | 8 passing |
| Production build reopening and interaction without a network connection | 1 passing |
| npm dependency audit | 0 known vulnerabilities |
| Firefox browser execution | Blocked by local Windows runtime; see below |

## End-to-end scope

The browser suite tests copying the full generation prompt; rejecting invalid source; extracting fenced source; importing from paste and files; skipping invalid files in a batch; interacting with detail levels, quiz answers, and progressive steps; persisting favorites and reading position across reload; explicit replacement; nested folder creation and moving; preserving notes when deleting folders; bundling a real image; exporting/restoring a portable backup; retaining assets after reload; navigating semantic references without leaving the note; opening every one of the 65 public components; removing untrusted HTML; requiring consent before remote image requests; and reopening a production build offline.

Desktop, dark-theme, and 390-pixel-wide reader screenshots were captured and visually inspected. Narrow mathematical content was checked separately. Reading stays within the viewport; long expressions, code, diagrams, and tables have local overflow areas. The in-app browser was also used to inspect and operate the local reader.

The UI and security review led to fixes for partial batch writes, unsafe replacement collisions, stale image attachments on paste replacement, excessive folder-restore work, decoded asset bounds, hidden semantic targets, hash-route interference, reading-position races, scroll overflow, and service-worker cache matching. The final automated suite passes after these fixes.

## Remaining verification limit

The Playwright Firefox binary was installed, but Windows cannot launch it: its side-by-side configuration reports a missing `mozglue` assembly. This is a browser-runtime failure before the application loads. No Firefox compatibility pass is claimed. The Firefox project remains configured; run `npm run test:e2e -- --project=firefox` on a host with a functioning Firefox runtime.

The application relies on standard IndexedDB, file inputs, native controls, and optional directory input. It does not depend on Chromium's File System Access API. Directory selection and persistent-storage grants depend on the browser.

Production build output has harmless upstream Zod PURE-annotation warnings from Rollup. Compilation succeeds; no runtime workaround or warning suppression was added.
