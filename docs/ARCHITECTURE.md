# LearnMD architecture

LearnMD is a browser application for importing, organizing, and reading externally authored educational documents. The reader is the central product surface. Document bodies remain read-only after import; an explicit reimport creates another local copy or replaces a chosen copy.

## Boundaries

- **Format and AST:** Markdown is parsed with the remark ecosystem, including GFM, directives, frontmatter, and mathematics. Nested directives use longer outer fences so their structure is unambiguous. A structured component registry supplies property schemas, allowed child relationships, examples, and authoring documentation.
- **Validation:** The import path validates document metadata, directive names and properties, structural relationships, semantic identifiers, and references. Errors are attached to source positions where available. Resource limits constrain pathological inputs.
- **Renderer:** React renders the validated structure and ordinary Markdown. Semantic components share layout and disclosure primitives while preserving their distinct behavior. KaTeX renders mathematics. The renderer never executes source-provided JavaScript.
- **Document state:** Each open document has an explicit interaction scope. Shared variables and synchronized selections are declarative; detail levels filter authored content without generating or modifying prose. Working answers and scratchpad text are interaction state, not source edits.
- **Library:** IndexedDB stores local document copies, folder metadata, assets, and reading information. It is independent of the original file path. The application must surface persistence failures and support portable export; browser storage is not a substitute for backups.
- **Authoring contract:** The Generate Notes prompt and component showcase derive their technical reference from the same registry used by validation. This avoids a separate, drifting specification and gives every public component a visible example.

## Security and portability

All imported source is untrusted. Raw HTML is not an execution path. Rendered links, images, media, and asset references pass explicit URL checks; embedded content uses a restricted allowlist. Diagrams are structured data rather than executable snippets. Invalid components render useful diagnostics or safe fallbacks instead of crashing an entire chapter.

The core workflow uses standard file inputs, drag and drop, pasted text, and IndexedDB. Optional directory selection can improve supported browsers but must not be a prerequisite. No account, application backend, external model request, or Chromium-only filesystem API is required to read and manage notes. Remote links and optional remote media naturally depend on connectivity.

## Content as a verification surface

The six substantial sample chapters cover calculus, linear algebra, algorithms, networks, physics, and history. They use components where interaction supports understanding: progressive mathematical reasoning, alternative interpretations, inspectable structures, evidence evaluation, and questions with explanations. They are authored with the same public format as imported documents, so parsing them is an integration check rather than a privileged demo path.

The component showcase complements those realistic chapters by exposing every registered component, including combinations and edge cases. Automated checks should cover parser boundaries, interaction transitions, storage mutations, import and replacement semantics, prompt consistency, and unsafe input. Browser verification covers the complete workflow, reload persistence, printing, themes, and narrow layouts.

## Deliberate exclusions

There is no document editor, AI chat, model integration, account system, cloud synchronization, social publishing, or spaced-repetition scheduler. Library metadata and ephemeral reading interactions may change; source content is updated externally and reimported intentionally.
