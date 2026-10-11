# LearnMD architecture

LearnMD is a browser application for importing, organizing, and reading externally authored educational documents. The reader is the central product surface. Document bodies remain read-only after import; an explicit reimport creates another local copy or replaces a chosen copy.

## Boundaries

- **Format and AST:** Markdown is parsed with the remark ecosystem, including GFM, directives, frontmatter, and mathematics. Nested directives use longer outer fences so their structure is unambiguous. A structured component registry supplies property schemas, allowed child relationships, examples, and authoring documentation.
- **Validation:** The import path validates document metadata, directive names and properties, structural relationships, semantic identifiers, and references. Errors are attached to source positions where available. Resource limits constrain pathological inputs.
- **Renderer:** React renders the validated structure and ordinary Markdown. Semantic components share layout and disclosure primitives while preserving their distinct behavior. KaTeX renders mathematics. The renderer never executes source-provided JavaScript.
- **Document state:** Each open document has an explicit interaction scope. Shared variables and synchronized selections are declarative. Sections show their complete authored text, and layers provide manually selected alternative views. Working answers and scratchpad text are interaction state, not source edits.
- **Library:** IndexedDB stores local document copies, folder metadata, assets, and reading information. It is independent of the original file path. The application must surface persistence failures and support portable export; browser storage is not a substitute for backups.
- **User folders:** Initialization creates example notes at root without predefined folders. A transactional, one-time migration retires unchanged legacy starter folders while preserving notes and customized folder structure. Folder glyphs use a fixed allowlist of IDs; the optional icon property is compatible with existing local records and older backups.
- **Authoring contract:** The Generate Notes prompt and component showcase derive their technical reference from the same registry used by validation. This avoids a separate, drifting specification and gives every public component a visible example.
- **Localization:** An interface context selects Polish for a Polish browser/system preference and English otherwise. Only explicit choices are persisted. Authored note content and the English generation contract remain independent of interface language.
- **Source context:** Rendered blocks carry original AST offsets into the normalized LearnMD source. Selection copying uses those offsets, preserves complete interactive component fences, and never reconstructs Markdown from flattened DOM text. The full-document action retains the stored source. Both actions use the local clipboard; there is no model connection.
- **Pagination:** Carousel slides stay mounted while inactive slides are hidden, preserving each slide's working state. Semantic navigation can reveal a target slide, keyboard navigation avoids text inputs, and print styling reveals all slides.

## Security and portability

All imported source is untrusted. Raw HTML is not an execution path. Rendered links, images, media, and asset references pass explicit URL checks; embedded content uses a restricted allowlist. Diagrams are structured data rather than executable snippets. Invalid components render useful diagnostics or safe fallbacks instead of crashing an entire chapter.

The core workflow uses standard file inputs, drag and drop, pasted text, and IndexedDB. Optional directory selection can improve supported browsers but must not be a prerequisite. No account, application backend, external model request, or Chromium-only filesystem API is required to read and manage notes. Remote links and optional remote media naturally depend on connectivity.

## Content as a verification surface

One root-level LearnMD guide introduces the workflow in English or Polish and demonstrates progressive reasoning, alternative views, and a carousel with varied interactive questions. It uses the same public format as imported notes. A transactional migration removes known legacy sample records, preserves personal imports, and seeds the guide once. A stored ownership snapshot allows language changes to refresh only the unmodified built-in guide, retaining organization and reading state. Deletion or content customization stops automatic updates; changing language never recreates a deleted guide.

The component showcase complements the guide by exposing every registered component, including combinations and edge cases. Automated checks cover parser boundaries, interaction transitions, storage mutations, import and replacement semantics, prompt consistency, and unsafe input. Browser verification covers the complete workflow, reload persistence, printing, themes, and narrow layouts.

## Deliberate exclusions

There is no document editor, AI chat, model integration, account system, cloud synchronization, social publishing, or spaced-repetition scheduler. Library metadata and ephemeral reading interactions may change; source content is updated externally and reimported intentionally.
