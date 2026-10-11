import {
  COMPONENTS,
  DIAGRAM_LIMITS,
  FORMAT_VERSION,
  PUBLIC_COMPONENTS,
} from './registry';

export const GENERATION_STYLES = [
  {
    id: 'balanced',
    label: 'Balanced',
    description:
      'Clear concepts, worked examples, and a measured amount of interaction.',
  },
  {
    id: 'rigorous',
    label: 'Rigorous',
    description:
      'Precise definitions, explicit assumptions, and complete mathematical arguments.',
  },
  {
    id: 'intuitive',
    label: 'Intuitive',
    description:
      'Build understanding through mental models, concrete examples, and visual explanations.',
  },
  {
    id: 'practical',
    label: 'Practical',
    description:
      'Focus on applications, worked procedures, and common mistakes.',
  },
] as const;

const grammar = `LearnMD ${FORMAT_VERSION} is UTF-8 Markdown with YAML frontmatter, GitHub-flavored tables and task lists, LaTeX math, fenced code, and safe declarative directives. There is no JavaScript or HTML execution.

DOCUMENT METADATA
Start the document with YAML frontmatter. Use only these fields: title (string), description (string), subject (string), author (string), tags (list of strings), version ("1.0"). Title is optional and falls back to the first H1. Do not invent an author. Do not use YAML aliases, anchors, custom tags, or nested objects.

---
title: "Understanding derivatives"
description: "Rates of change, limits, and local linear models."
subject: "Calculus"
tags: [calculus, derivatives]
version: "1.0"
---

# Understanding derivatives

DIRECTIVE GRAMMAR AND NESTING
Every component is a container directive on its own line:

:::definition{title="Derivative" id="derivative"}
A derivative measures a local rate of change.
:::

Use a space between attributes. Quote all attribute values with double quotes; use &quot; inside an attribute to represent a quotation mark. A block's closing fence has exactly as many colons as its opening fence. Every outer fence MUST be longer than every immediately nested fence. Use five colons for a grandparent, four for a parent, and three for an innermost block. Never indent fences as code. Put blank lines around directives and between Markdown blocks. Do not place closing fences after text on the same line. Do not use inline/leaf shorthand in generated documents.

:::::tabs
::::tab{title="Reasoning"}
:::theorem{title="Differentiability implies continuity"}
If a function is differentiable at a point, it is continuous there.
:::

:::proof
Write the output change as the difference quotient multiplied by the input change, then take the limit.
:::
::::

::::tab{title="Counterexample"}
The converse fails: $f(x)=|x|$ is continuous but not differentiable at zero.
::::
:::::

CHILD RELATIONSHIPS
Ordinary Markdown is allowed inside every content block unless its purpose is purely declarative (variable, toggle, reference, divider, pair, edge, participant, message). Layout and semantic wrappers can contain ordinary Markdown and other compatible public components. Structural children belong directly inside their stated parent. For a component with an explicit child list, use only those directive child types; ordinary explanatory Markdown may precede the children. Put other public components inside a structural child's body, not beside it. Diagram nodes may contain rich explanations. Tree item blocks can contain further item blocks. Lists, tables, blockquotes, code, and math retain their ordinary Markdown grammar.

CAROUSELS AND LONG QUESTION SETS
Use carousel with one or more slide children to paginate a long explanation, worked example, or question set. There is no fixed slide-count cap beyond the document resource limits. A slide can contain any compatible content: ordinary text, a source excerpt, a quiz, a question with a revealable answer, a formula, a diagram, or several composed blocks. A carousel is a general layout, so do not assume every slide must be a question. For long quizzes, place each quiz or question component inside its own slide and include brief context or recap slides when helpful. Set initial="0" to start at the first slide; slide title is optional. Navigation is manual, with no autoplay. Interactions remain intact when moving between slides, and printing includes every slide.

When a question depends on a passage from the supplied materials, place the relevant short excerpt in ordinary Markdown blockquote syntax (lines beginning with >) on the question slide or a clearly identified context slide. Preserve the source's wording and attribution when quoting; label paraphrases as paraphrases. Quote only material actually supplied by the user, and never invent source text or citations. Keep enough context visible for the question to make sense. The carousel example below uses an explicitly labeled demonstration excerpt rather than claiming a quotation from an external source.

MATH AND CODE
Use $...$ for inline mathematics and $$ on separate lines for display mathematics. Use real LaTeX, including \\frac, \\sqrt, matrices, cases, and \\begin{aligned}...\\end{aligned}. Backslashes are literal in Markdown; do not double-escape them as JSON. In aligned math, use & for alignment and \\\\ for row breaks. Do not use executable LaTeX commands, custom macros, external resources, or an entire LaTeX document. The formula block provides equation numbering and semantic references. Put a fenced code block with a language identifier inside code or code-walkthrough. Never place executable scripts in directives. Code examples are displayed, never run.

IDS AND REFERENCES
Set id="meaningful-id" on public blocks to create a semantic target. IDs begin with a letter and contain only letters, digits, hyphens, and underscores (maximum 80 characters). IDs must be unique in the document. Use reference{target="meaningful-id" label="See the definition"} as a container block. Headings receive lowercase slugs, with repeated headings suffixed -2, -3, and so on. Prefer explicit component IDs for durable references. Nodes and participants use diagram-local IDs; edges/messages resolve only within their own diagram. Diagram node IDs are not document reference targets. All references must resolve. A graph can contain cycles; navigation is explicit and bounded, never automatically executed.

SHARED STATE
variable{name="show-proof" value="false"} declares one document-scoped STRING value. Each name has exactly one declaration. Declarations are collected before interaction, regardless of location. toggle{target="show-proof" on="true" off="false" label="Show assumptions"} switches between two literal strings; its default on/off values are "true" and "false". conditional{target="show-proof" equals="true"} shows content on exact string equality. Every consumer must refer to a declaration. There are no arithmetic expressions, callbacks, computed variables, automatic transitions, or executable dependencies; reactive cycles are therefore not possible. Interaction is temporary and does not modify note source.

sync{group="worked-example"} gives descendant steps, derivation, tabs, carousel, layers, variants, and spotlight a shared zero-based selected index. Separate sync wrappers with the same group also coordinate. Use the same number and order of items in coordinated blocks; shorter blocks clamp to their final item. Nested sync wrappers use their nearest group. Do not reuse a group for unrelated explanations. initial is a zero-based starting item index where supported.

ASSETS, SAFETY, AND FALLBACKS
Use relative image paths such as assets/circuit.png when the PNG, JPEG, GIF, WebP, or AVIF asset accompanies the imported document. Do not use absolute filesystem paths, parent-directory traversal, data URLs, script URLs, protocol-relative URLs, iframes, or raw HTML. For remote resources use HTTPS and meaningful alternative text; the reader may require an explicit action to load external content. Embed blocks provide explicit external resource links or user-activated native audio/video playback from HTTPS URLs. Arbitrary embedded web pages are not allowed. A pasted document cannot include local image bytes: use an HTTPS image, omit the image, or explain that a bundled file is required. Prefer native diagrams with node/edge data over images when their structure conveys the concept.

Printing provides a static reading fallback, including authored explanations and derivation steps. Keep complete text explanations in the source so the lesson remains intelligible without interaction. A diagram should explain its meaning in its node content, not just its labels. Unknown components retain their Markdown content with a diagnostic; malformed syntax or missing required values produces import diagnostics. Never rely on error recovery for a generated document.

RESOURCE LIMITS
Keep each note below one million characters, 25,000 lines, 20,000 characters per line, 20,000 AST nodes, and 40 nesting levels. Keep YAML below 32,000 characters. A network or decision diagram supports at most ${DIAGRAM_LIMITS.nodes} nodes and ${DIAGRAM_LIMITS.edges} edges. A sequence supports at most ${DIAGRAM_LIMITS.participants} participants and ${DIAGRAM_LIMITS.messages} messages. Split a large course into coherent notes and complex diagrams into focused views. Do not create more interaction than the concept needs.`;

function componentReference(includeExamples: boolean): string {
  return COMPONENTS.map((component) => {
    const properties = Object.entries(component.properties)
      .map(([name, description]) => `- ${name}: ${description}`)
      .join('\n');
    const relationships = [
      component.children
        ? `Direct directive children: ${component.children.join(', ')}.`
        : 'Content: ordinary Markdown and compatible nested blocks.',
      component.parents
        ? `Allowed direct parents: ${component.parents.join(', ')}.`
        : 'May appear at document level or inside compatible content containers.',
    ].join('\n');
    return `### ${component.name}${component.structural ? ' (structural child)' : ''}\n${component.description}\n${properties}\n${relationships}${includeExamples ? `\nWorking example:\n\n${component.example}` : ''}`;
  }).join('\n\n');
}

export function buildGenerationPrompt(style = 'balanced'): string {
  const selected =
    GENERATION_STYLES.find((entry) => entry.id === style) ??
    GENERATION_STYLES[0];
  return `You are an expert educator writing a complete .learn.md document for LearnMD, a local-first interactive textbook reader. Use the source materials I provide after this prompt. Produce excellent, coherent educational notes that prioritize understanding, precision, and a calm reading experience.

OUTPUT LANGUAGE: Write the notes in the language of the supplied materials unless the user explicitly requests a different language. This prompt is written in English only to describe the task and format; it does not require English notes.

GENERATION STYLE: ${selected.label}. ${selected.description}

TEACHING AND SOURCE FIDELITY
1. Identify the central question, intended audience, prerequisites, and conceptual progression. Start with a short orientation, then develop one idea at a time. Use descriptive headings, connected prose, precise notation, and purposeful examples.
2. Preserve the supplied sources' actual claims, assumptions, scope, terminology, and limitations. Distinguish a source's statement from your explanatory inference. Do not invent facts, citations, page numbers, quotations, experiments, historical dates, author credentials, or references. Include a source citation only when it is present in the supplied material and can be reproduced accurately.
3. Resolve apparent contradictions explicitly. If a premise, proof step, or source detail is missing, state what is missing and either qualify the discussion or omit the unsupported claim. Never silently fill factual gaps. Mark uncertainty in ordinary prose or a callout.
4. Explain WHY a step is valid, not just what operation occurred. For difficult calculations, use derivation with one meaningful operation per step. State assumptions before using a theorem. Give dimensional checks or limiting cases where they help. Use full mathematical precision for definitions and proofs.
5. Use a worked example, a counterexample, an intuitive explanation, or an alternative method only where it contributes to understanding. Explain how the example connects to the general idea. Do not bury the main argument in expandable controls.
6. Use interaction sparingly and purposefully: steps for a sequence, tabs for genuine alternatives, layers for manually selected explanations, annotated for contextual terminology, and sync for explanations that must be read together. Quizzes and predictions are optional checks of reasoning, not a gamified memory system.
7. Keep the essential argument in the main text. Add supporting examples, complete proofs, subtle exceptions, and extensions where they improve understanding. A reader who opens no optional controls should still understand the lesson's purpose.
8. Write substantial connected explanations. Avoid a wall of bullets, a container around every paragraph, decorative diagrams, repetitive summaries, and using every component merely because it exists. Add a focused recap at the end and meaningful next questions when appropriate.
9. Create diagrams from safe declarative node/edge data with clear labels and useful node explanations. Give meaningful alt text to images. Use code-walkthrough when line-level explanation helps. All text must be readable without color-dependent meaning.
10. Before returning the note, check every fence, required attribute, parent/child relationship, semantic reference, variable declaration, math delimiter, equation step, and factual claim. The file must be complete and independently usable.

${grammar}

COMPONENT REFERENCE — ${PUBLIC_COMPONENTS.length} PUBLIC COMPONENTS PLUS STRUCTURAL CHILDREN
The following reference is generated from the same registry used to validate LearnMD. Use only documented properties. Optional title and id are shared by all components; diagram children scope their IDs locally. Examples are independent documents/snippets: when combining them, rename duplicate semantic IDs, variables, and sync groups, and increase enclosing fence lengths as needed.

${componentReference(true)}

FINAL OUTPUT REQUIREMENTS
Return exactly one complete LearnMD document, starting with YAML frontmatter and an H1. Return the raw file text, without an enclosing Markdown code fence, commentary before/after it, or placeholders for missing sections. Use format version "1.0". Do not claim to have inspected any source that was not provided. When source material is insufficient, state that limitation in the note and avoid invented coverage. Match the language of the provided materials unless I request another language. All interaction must use only the declared components above.

SOURCE MATERIALS AND ADDITIONAL INSTRUCTIONS FOLLOW:
`;
}

export function buildFormatReference(): string {
  return `# LearnMD format ${FORMAT_VERSION}\n\nThis file documents the actual parser and renderer contract. The component section is generated from src/format/registry.ts. The application’s Generate Notes page provides the full portable generation prompt.\n\n${grammar}\n\n## Component reference\n\n${componentReference(true)}\n`;
}
