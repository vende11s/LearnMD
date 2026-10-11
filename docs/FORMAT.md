# LearnMD format 1.0

This file documents the actual parser and renderer contract. The component section is generated from src/format/registry.ts. The application’s Generate Notes page provides the full portable generation prompt.

LearnMD 1.0 is UTF-8 Markdown with YAML frontmatter, GitHub-flavored tables and task lists, LaTeX math, fenced code, and safe declarative directives. There is no JavaScript or HTML execution.

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

MATH AND CODE
Use $...$ for inline mathematics and $$ on separate lines for display mathematics. Use real LaTeX, including \frac, \sqrt, matrices, cases, and \begin{aligned}...\end{aligned}. Backslashes are literal in Markdown; do not double-escape them as JSON. In aligned math, use & for alignment and \\ for row breaks. Do not use executable LaTeX commands, custom macros, external resources, or an entire LaTeX document. The formula block provides equation numbering and semantic references. Put a fenced code block with a language identifier inside code or code-walkthrough. Never place executable scripts in directives. Code examples are displayed, never run.

IDS AND REFERENCES
Set id="meaningful-id" on public blocks to create a semantic target. IDs begin with a letter and contain only letters, digits, hyphens, and underscores (maximum 80 characters). IDs must be unique in the document. Use reference{target="meaningful-id" label="See the definition"} as a container block. Headings receive lowercase slugs, with repeated headings suffixed -2, -3, and so on. Prefer explicit component IDs for durable references. Nodes and participants use diagram-local IDs; edges/messages resolve only within their own diagram. Diagram node IDs are not document reference targets. All references must resolve. A graph can contain cycles; navigation is explicit and bounded, never automatically executed.

DETAIL AND SHARED STATE
The reader has Concise, Standard, and Detailed modes. Content outside detail-level remains visible in all modes. A detail-level block with level="standard" is visible in Standard and Detailed. A level="detailed" block is visible only in Detailed. Preserve the core argument in all modes. Switching detail does not generate or rewrite text.

variable{name="show-proof" value="false"} declares one document-scoped STRING value. Each name has exactly one declaration. Declarations are collected before interaction, regardless of location. toggle{target="show-proof" on="true" off="false" label="Show assumptions"} switches between two literal strings; its default on/off values are "true" and "false". conditional{target="show-proof" equals="true"} shows content on exact string equality. Every consumer must refer to a declaration. There are no arithmetic expressions, callbacks, computed variables, automatic transitions, or executable dependencies; reactive cycles are therefore not possible. Interaction is temporary and does not modify note source.

sync{group="worked-example"} gives descendant steps, derivation, tabs, layers, variants, and spotlight a shared zero-based selected index. Separate sync wrappers with the same group also coordinate. Use the same number and order of items in coordinated blocks; shorter blocks clamp to their final item. Nested sync wrappers use their nearest group. Do not reuse a group for unrelated explanations. initial is a zero-based starting item index where supported.

ASSETS, SAFETY, AND FALLBACKS
Use relative image paths such as assets/circuit.png when the PNG, JPEG, GIF, WebP, or AVIF asset accompanies the imported document. Do not use absolute filesystem paths, parent-directory traversal, data URLs, script URLs, protocol-relative URLs, iframes, or raw HTML. For remote resources use HTTPS and meaningful alternative text; the reader may require an explicit action to load external content. Embed blocks provide explicit external resource links or user-activated native audio/video playback from HTTPS URLs. Arbitrary embedded web pages are not allowed. A pasted document cannot include local image bytes: use an HTTPS image, omit the image, or explain that a bundled file is required. Prefer native diagrams with node/edge data over images when their structure conveys the concept.

Printing provides a static reading fallback, including authored explanations and derivation steps. Keep complete text explanations in the source so the lesson remains intelligible without interaction. A diagram should explain its meaning in its node content, not just its labels. Unknown components retain their Markdown content with a diagnostic; malformed syntax or missing required values produces import diagnostics. Never rely on error recovery for a generated document.

RESOURCE LIMITS
Keep each note below one million characters, 25,000 lines, 20,000 characters per line, 20,000 AST nodes, and 40 nesting levels. Keep YAML below 32,000 characters. A network or decision diagram supports at most 60 nodes and 150 edges. A sequence supports at most 12 participants and 100 messages. Split a large course into coherent notes and complex diagrams into focused views. Do not create more interaction than the concept needs.

## Component reference

### columns
Responsive columns that stack on narrow screens.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- columns: Optional. Preferred number of columns; alias of count. Integer from 1 to 4.
- count: Optional. Preferred number of columns. Integer from 1 to 4.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

::::columns{count="2"}
:::card{title="Visual"}
A geometric interpretation.
:::

:::card{title="Symbolic"}
An algebraic interpretation.
:::
::::

### grid
A responsive grid for related content.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- columns: Optional. Preferred column count. Integer from 1 to 4.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

::::grid{columns="2"}
:::card
First principle.
:::

:::card
Second principle.
:::
::::

### stack
Compose blocks vertically or horizontally.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- direction: Optional. Stack direction. Allowed: vertical, horizontal.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

::::stack
:::card
Observe.
:::

:::card
Explain.
:::
::::

### card
Group a small amount of related content.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::card{title="Area"}
The area of a circle is $A=\pi r^2$.
:::

### section
A semantic section with an optional heading.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::section{title="Assumptions" id="assumptions"}
Compare the assumptions before choosing a model.
:::

### divider
A quiet visual separation between ideas.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::divider

:::

### tabs
Switch between related perspectives using tab titles.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- initial: Optional. Initial zero-based tab index. Integer from 0 to 100.
Direct directive children: tab.
May appear at document level or inside compatible content containers.
Working example:

::::tabs
:::tab{title="Intuition"}
A derivative is a local rate of change.
:::

:::tab{title="Definition"}
$$
f′(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}h
$$
:::
::::

### accordion
Independent expandable explanations.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- open: Optional. Open all items initially. Allowed: true, false.
Direct directive children: item.
May appear at document level or inside compatible content containers.
Working example:

::::accordion
:::item{title="Is every continuous function differentiable?"}
Continuity is necessary but not sufficient for differentiability.
:::
::::

### split-view
Compare two related panels side by side.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: panel.
May appear at document level or inside compatible content containers.
Working example:

::::split-view
:::panel{title="Equation"}
$$
a^2+b^2=c^2
$$
:::

:::panel{title="Meaning"}
The square on the hypotenuse equals the sum of the other two squares.
:::
::::

### comparison
Labeled alternatives with equal visual weight.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: item, panel.
May appear at document level or inside compatible content containers.
Working example:

::::comparison
:::item{title="Hash map"}
Fast average lookup; ordering is not intrinsic.
:::

:::item{title="Search tree"}
Ordered keys with logarithmic search.
:::
::::

### definition
A precise definition of a concept.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::definition
A function is **injective** when distinct inputs have distinct outputs.
:::

### theorem
A numbered mathematical statement.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::theorem
If $f$ is differentiable at $a$, then $f$ is continuous at $a$.
:::

### lemma
A supporting mathematical statement.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::lemma
If $a>0$ and $b>0$, then $a+b>0$.
:::

### example
A concrete worked example.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::example
For $f(x)=x^2$, we have $f′(3)=6$.
:::

### counterexample
An example that disproves an overgeneralization.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::counterexample
$f(x)=|x|$ is continuous at zero but is not differentiable there.
:::

### callout
A contextual observation.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- tone: Optional. Visual emphasis. Allowed: note, tip, important.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::callout
The derivative depends on the point where it is evaluated.
:::

### warning
An assumption, hazard, or common error.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::warning
Division by an expression requires that expression to be nonzero.
:::

### intuition
An informal mental model.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::intuition
Zoom in far enough and a smooth curve looks like a straight line.
:::

### summary
A short recap of the essential ideas.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::summary
A derivative measures local change. Check existence before applying rules.
:::

### proof
An expandable proof; use nested steps for progressive reasoning.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- open: Optional. Expand the proof initially. Allowed: true, false.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::proof{title="Proof of positivity"}
Assume $a>0$ and $b>0$. Adding $b$ to both sides of $a>0$ gives $a+b>b>0$.
:::

### steps
Reveal an ordered argument one step at a time.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- initial: Optional. Initial zero-based step index. Integer from 0 to 100.
Direct directive children: step.
May appear at document level or inside compatible content containers.
Working example:

::::steps
:::step{title="Start"}
$$
2x + 4 = 10
$$
:::

:::step{title="Subtract four" explanation="Apply the same operation to both sides."}
$$
2x = 6
$$
:::

:::step{title="Divide by two"}
$$
x = 3
$$
:::
::::

### derivation
A progressive mathematical derivation with explanations.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- initial: Optional. Initial zero-based step index. Integer from 0 to 100.
Direct directive children: step.
May appear at document level or inside compatible content containers.
Working example:

::::derivation{title="Solve a linear equation"}
:::step{title="Start"}
$$
2x + 4 = 10
$$
:::

:::step{title="Subtract four" explanation="Apply the same operation to both sides."}
$$
2x = 6
$$
:::

:::step{title="Divide by two"}
$$
x = 3
$$
:::
::::

### reveal
A disclosure for an answer or additional explanation.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- label: Optional. Text of the disclosure control.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::reveal{label="Show the answer"}
The slope is $2x$, so at $x=3$ it is $6$.
:::

### hint
Reveal a nudge before the complete solution.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- label: Optional. Disclosure label.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::hint{label="A small hint"}
Try subtracting the constant term from both sides.
:::

### layers
Switch between named levels of explanation.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- initial: Optional. Initial zero-based layer. Integer from 0 to 100.
Direct directive children: layer.
May appear at document level or inside compatible content containers.
Working example:

::::layers
:::layer{title="Intuition"}
A matrix describes a linear transformation.
:::

:::layer{title="Formal"}
$$
T(\alpha u+\beta v)=\alpha T(u)+\beta T(v)
$$
:::
::::

### detail-level
Show content at or above a document detail threshold.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- level: Required. Minimum visible detail level. Allowed: concise, standard, detailed.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::detail-level{level="detailed"}
At a corner, the left and right derivatives may disagree.
:::

### variants
Select among alternative explanations or methods.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- initial: Optional. Initial zero-based variant. Integer from 0 to 100.
Direct directive children: variant.
May appear at document level or inside compatible content containers.
Working example:

::::variants
:::variant{title="Algebra"}
Complete the square to solve a quadratic.
:::

:::variant{title="Geometry"}
Find where the parabola crosses the horizontal axis.
:::
::::

### branch
Choose an explanatory path.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: option.
May appear at document level or inside compatible content containers.
Working example:

::::branch
:::option{title="I am new to vectors"}
Begin with repeated addition and scaling.
:::

:::option{title="I know the basics"}
Consider linear combinations and spanning sets.
:::
::::

### spotlight
Focus on one labeled region at a time.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: item.
May appear at document level or inside compatible content containers.
Working example:

::::spotlight
:::item{title="Numerator"}
The numerator measures output change.
:::

:::item{title="Denominator"}
The denominator measures input change.
:::
::::

### annotated
Labeled annotations reveal contextual explanations.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: annotation.
May appear at document level or inside compatible content containers.
Working example:

::::annotated
The derivative measures local change.

:::annotation{label="What does local mean?"}
Local means near a particular input, rather than across the full domain.
:::
::::

### question
A reflection question with a revealable answer.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- prompt: Optional. Question text shown before the body.
- answer: Optional. Short answer; longer explanation can be nested in an answer block.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::question{answer="A finite interval gives an average rate; the limit gives a local rate."}
Why does a derivative require a limit?
:::

### quiz
Select one or more choices and receive explanatory feedback.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- multiple: Optional. Allow several correct choices. Allowed: true, false.
- explanation: Optional. Feedback after checking.
Direct directive children: choice.
May appear at document level or inside compatible content containers.
Working example:

::::quiz{explanation="The power rule gives d(x²)/dx = 2x."}
Which function has derivative $2x$?

:::choice{correct="true"}
$f(x)=x^2$
:::

:::choice{correct="false"}
$f(x)=2x$
:::
::::

### fill-blank
Check a short text answer, ignoring letter case and outer spaces.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- caseSensitive: Optional. Match letter case exactly. Allowed: true, false.
- answer: Required. Expected answer.
- placeholder: Optional. Input hint.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::fill-blank{answer="2x" placeholder="Your expression"}
The derivative of $x^2$ is…
:::

### match
Match each left-hand concept to a right-hand explanation.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: pair.
May appear at document level or inside compatible content containers.
Working example:

::::match
:::pair{left="Derivative" right="Local rate of change"}

:::

:::pair{left="Integral" right="Accumulation"}

:::
::::

### sort
Put items in their authored logical order using keyboard-accessible controls.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: item.
May appear at document level or inside compatible content containers.
Working example:

::::sort
:::item
Identify the unknown.
:::

:::item
Isolate the unknown.
:::

:::item
Check the result.
:::
::::

### predict
Write a prediction before revealing the outcome.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- prompt: Optional. Question shown above the prediction area.
- answer: Required. Outcome to reveal.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::predict{answer="The current halves, because I = V/R."}
What happens to current if resistance doubles while voltage stays fixed?
:::

### scenario
Explore authored scenarios without executing code.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: case.
May appear at document level or inside compatible content containers.
Working example:

::::scenario
:::case{title="Low resistance"}
Low resistance permits a larger current for the same voltage.
:::

:::case{title="High resistance"}
High resistance limits the current.
:::
::::

### decision-tree
Navigate a graph of decisions; nodes show explanations and outgoing choices.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- root: Optional. Initial node ID; alias of start.
- start: Optional. Initial node ID.
Direct directive children: node, edge.
May appear at document level or inside compatible content containers.
Working example:

::::decision-tree{start="start"}
:::node{id="start" label="Choose a loop"}
Does the list have a known length?
:::

:::node{id="known" label="Known length"}
Use a for loop for a known number of iterations.
:::

:::node{id="unknown" label="Unknown length"}
Use a while loop when a condition determines termination.
:::

:::edge{from="start" to="known" label="Yes"}

:::

:::edge{from="start" to="unknown" label="No"}

:::
::::

### checklist
Track temporary checks without modifying the document.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::checklist
- [ ] Identify assumptions
- [ ] Check dimensions
- [ ] Test a limiting case
:::

### scratchpad
A temporary private working area; this never changes note source.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- placeholder: Optional. Prompt inside the working area.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::scratchpad{title="Work it out" placeholder="Try a calculation or explain this in your own words…"}

:::

### flowchart
A directed flow of labeled steps and branches.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: node, edge.
May appear at document level or inside compatible content containers.
Working example:

::::flowchart
:::node{id="input" label="Input"}
Input arrives.
:::

:::node{id="transform" label="Transform"}
Transform the input.
:::

:::edge{from="input" to="transform" label="next"}

:::
::::

### architecture
System components with labeled dependencies.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: node, edge.
May appear at document level or inside compatible content containers.
Working example:

::::architecture
:::node{id="browser" label="Browser"}
Presents the interface.
:::

:::node{id="database" label="IndexedDB"}
Persists local notes.
:::

:::edge{from="browser" to="database" label="read / write"}

:::
::::

### sequence
Ordered messages between named participants.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: participant, message.
May appear at document level or inside compatible content containers.
Working example:

::::sequence
:::participant{id="client" label="Client"}

:::

:::participant{id="server" label="Server"}

:::

:::message{from="client" to="server" label="Request"}

:::

:::message{from="server" to="client" label="Response"}

:::
::::

### timeline
Chronological events with contextual explanations.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: event.
May appear at document level or inside compatible content containers.
Working example:

::::timeline
:::event{date="c. 1450" title="Movable type in Europe"}
The printing press spreads reproducible texts.
:::

:::event{date="1687" title="Newton’s Principia"}
The first edition presents the laws of motion.
:::
::::

### tree
An expandable hierarchy using nested item blocks.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: item.
May appear at document level or inside compatible content containers.
Working example:

:::::tree
::::item{title="Root"}
:::item{title="Leaf"}
A leaf stores one value.
:::
::::
:::::

### graph
A network of selectable vertices and labeled edges.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- directed: Optional. Display directed connections. Allowed: true, false.
Direct directive children: node, edge.
May appear at document level or inside compatible content containers.
Working example:

::::graph
:::node{id="input" label="Input"}
Input arrives.
:::

:::node{id="transform" label="Transform"}
Transform the input.
:::

:::edge{from="input" to="transform" label="next"}

:::
::::

### state-machine
Select states and follow labeled transitions.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- start: Optional. Initial state ID.
Direct directive children: node, edge.
May appear at document level or inside compatible content containers.
Working example:

::::state-machine{start="idle"}
:::node{id="idle" label="Idle"}
No request is in flight.
:::

:::node{id="loading" label="Loading"}
A request is being processed.
:::

:::edge{from="idle" to="loading" label="Fetch"}

:::

:::edge{from="loading" to="idle" label="Complete"}

:::
::::

### process
A numbered process with selectable stages.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: step.
May appear at document level or inside compatible content containers.
Working example:

::::process
:::step{title="Hypothesis"}
State a testable explanation.
:::

:::step{title="Experiment"}
Choose measurements that could disprove it.
:::

:::step{title="Evaluation"}
Compare observations with predictions.
:::
::::

### concept-map
Labeled conceptual relationships in a selectable network.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: node, edge.
May appear at document level or inside compatible content containers.
Working example:

::::concept-map
:::node{id="acceleration" label="Acceleration"}
A change in velocity per unit time.
:::

:::node{id="force" label="Force"}
The net interaction acting on an object.
:::

:::edge{from="force" to="acceleration" label="causes, for nonzero mass"}

:::
::::

### image-annotation
Position accessible annotation markers on a bundled or explicitly allowed image.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- src: Required. Safe relative asset path or HTTPS URL.
- alt: Required. Accessible description.
Direct directive children: annotation.
May appear at document level or inside compatible content containers.
Working example:

::::image-annotation{src="unit-circle.png" alt="A unit circle with a point at angle theta"}
:::annotation{label="A point on the circle" x="69" y="28"}
$(\cos \theta, \sin \theta)$ lies on $x^2 + y^2 = 1$.
:::
::::

### formula
A numbered display equation with copyable LaTeX.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- label: Optional. Optional equation label.
- number: Optional. Optional equation label; otherwise numbered automatically.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::formula{id="energy" title="Mass–energy equivalence"}
$$
E = mc^2
$$
:::

### equation-system
An aligned system of equations.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::equation-system
$$
\begin{aligned}
2x+y &= 5\\
x-y &= 1
\end{aligned}
$$
:::

### code
A syntax-highlighted, copyable code example.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- language: Optional. Syntax language, such as javascript or python.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::code{title="Square a number" language="python"}
```python
def square(x):
    return x * x
```
:::

### code-walkthrough
Step through explanations that highlight source lines.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: step.
May appear at document level or inside compatible content containers.
Working example:

::::code-walkthrough
```python
def square(x):
    return x * x
```

:::step{title="Input" lines="1"}
Bind the input to the parameter x.
:::

:::step{title="Output" lines="2"}
Multiply the input by itself.
:::
::::

### code-diff
Side-by-side before and after code.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: before, after.
May appear at document level or inside compatible content containers.
Working example:

::::code-diff
:::before
```js
const result = values.map(f).map(g);
```
:::

:::after
```js
const result = values.map(x => g(f(x)));
```
:::
::::

### data-table
A sortable table using ordinary GFM table syntax.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- sortable: Optional. Allow sorting by column headers. Allowed: true, false.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::data-table{title="Values of x²" sortable="true"}
| Input | Square |
| --- | --- |
| 2 | 4 |
| 3 | 9 |
| 4 | 16 |
:::

### symbol-glossary
A searchable glossary of symbols and meanings.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Direct directive children: term, symbol.
May appear at document level or inside compatible content containers.
Working example:

::::symbol-glossary
:::term{symbol="v" meaning="Velocity"}
The rate of change of position.
:::

:::term{symbol="a" meaning="Acceleration"}
The rate of change of velocity.
:::
::::

### reference
Navigate to a semantic ID in this document.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- target: Required. ID of a component or the generated heading slug.
- label: Optional. Link text.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::definition{id="injective" title="Injective function"}
Distinct inputs have distinct outputs.
:::

:::reference{target="injective" label="Return to the definition"}

:::

### prerequisites
A concise list of assumed concepts.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::prerequisites
- Algebraic manipulation
- Function notation
- Limits
:::

### embed
A safe external resource link or user-activated native audio/video playback.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- kind: Optional. Resource kind; alias of type. Allowed: audio, video, link.
- src: Required. HTTPS resource URL.
- label: Optional. Resource link text.
- type: Optional. Resource kind. Allowed: video, audio, resource.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::embed{src="https://en.wikipedia.org/wiki/Derivative" label="Derivative reference" type="resource"}
Use this optional external resource after reading the section.
:::

### sync
Share the selected index between descendant steps, tabs, layers, variants, and spotlight blocks.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- group: Required. Document-scoped synchronization group.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::::sync{group="equation-demo"}
::::steps
:::step{title="Equation"}
$$
x+1=3
$$
:::

:::step{title="Solution"}
$$
x=2
$$
:::
::::

::::steps
:::step{title="Equation"}
Start from the given equation.
:::

:::step{title="Solution"}
Subtract one from both sides.
:::
::::
:::::

### variable
Declare a document-scoped string value with a deterministic initial value.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- name: Required. Unique variable name.
- value: Required. Initial string value.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::variable{name="show-extra" value="off"}

:::

:::toggle{target="show-extra" on="on" off="off" label="Show the shared value in action"}

:::

:::conditional{target="show-extra" equals="on"}
The toggle changed the declared variable from **off** to **on**, making this explanation visible.
:::

### conditional
Show content when a declared variable equals a literal value.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- target: Required. Declared variable name.
- equals: Required. Exact string value to compare.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::variable{name="context" value="on"}

:::

:::toggle{target="context" on="on" off="off" label="Show supporting context"}

:::

:::conditional{target="context" equals="on"}
This explanation is visible while the shared variable is **on**. Switch the toggle to hide it.
:::

### toggle
Switch a declared variable between two literal values.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- target: Required. Declared variable name.
- on: Optional. Value when enabled. Default: true.
- off: Optional. Value when disabled. Default: false.
- label: Optional. Control label.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::variable{name="assumptions" value="false"}

:::

:::toggle{target="assumptions" label="Show assumptions"}

:::

:::conditional{target="assumptions" equals="true"}
Assume the function is differentiable on the interval.
:::

### popover
An accessible contextual disclosure, usable by pointer and keyboard.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- label: Required. Disclosure label.
Content: ordinary Markdown and compatible nested blocks.
May appear at document level or inside compatible content containers.
Working example:

:::popover{label="Continuity"}
A function is continuous when its value agrees with its limit at the point.
:::

### step (structural child)
One stage in a progressive explanation.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- explanation: Optional. Short secondary explanation.
- lines: Optional. Code line numbers or ranges, such as 1,3-5.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: steps, derivation, code-walkthrough, process, hint, proof.
Working example:

::::steps
:::step{title="Preserve equality"}
Apply the same operation to both sides.
:::
::::

### tab (structural child)
One labeled tab inside tabs.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: tabs.
Working example:

::::tabs
:::tab{title="Perspective"}
An explanation of this perspective.
:::
::::

### layer (structural child)
One labeled layer inside layers.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- level: Optional. Associated detail level. Allowed: concise, standard, detailed.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: layers.
Working example:

::::layers
:::layer{title="Perspective"}
An explanation of this perspective.
:::
::::

### variant (structural child)
One labeled variant inside variants.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: variants.
Working example:

::::variants
:::variant{title="Perspective"}
An explanation of this perspective.
:::
::::

### option (structural child)
One labeled option inside branch.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: branch.
Working example:

::::branch
:::option{title="Perspective"}
An explanation of this perspective.
:::
::::

### case (structural child)
One labeled case inside scenario.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: scenario.
Working example:

::::scenario
:::case{title="Perspective"}
An explanation of this perspective.
:::
::::

### panel (structural child)
One labeled panel inside split-view.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: split-view, comparison.
Working example:

::::split-view
:::panel{title="Perspective"}
An explanation of this perspective.
:::
::::

### item (structural child)
A labeled list, hierarchy, or disclosure item.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- target: Optional. Optional semantic reference or heading slug.
- checked: Optional. Initial checked state. Allowed: true, false.
- value: Optional. Optional item value.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: accordion, comparison, spotlight, sort, checklist, tree, item, prerequisites, sync.
Working example:

::::accordion
:::item{title="Details"}
A supporting explanation.
:::
::::

### annotation (structural child)
A contextual explanation or image marker.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- label: Required. Annotation trigger text.
- x: Optional. Horizontal marker position, in percent. Number from 0 to 100.
- y: Optional. Vertical marker position, in percent. Number from 0 to 100.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: annotated, image-annotation.
Working example:

::::annotated
:::annotation{label="Explain this"}
A precise contextual explanation.
:::
::::

### choice (structural child)
A choice in a quiz.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- correct: Required. Whether this choice is correct. Allowed: true, false.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: quiz.
Working example:

::::quiz
:::choice{correct="true"}
Two plus two is four.
:::

:::choice{correct="false"}
Two plus two is five.
:::
::::

### pair (structural child)
One matching pair.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- left: Required. Left concept.
- right: Required. Matching concept.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: match.
Working example:

::::match
:::pair{left="Derivative" right="Rate of change"}

:::
::::

### node (structural child)
A selectable diagram node; IDs are local to the diagram.
- id: Required. Unique ID within the containing diagram.
- title: Optional. Optional visible title.
- next: Optional. Default next node.
- yes: Optional. Next node for a yes answer.
- no: Optional. Next node for a no answer.
- label: Required. Visible node name.
- description: Optional. Brief node explanation.
- x: Optional. Optional horizontal coordinate. Number from 0 to 100.
- y: Optional. Optional vertical coordinate. Number from 0 to 100.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: flowchart, architecture, graph, state-machine, concept-map, decision-tree.
Working example:

::::graph
:::node{id="input" label="Input"}
Input arrives.
:::

:::node{id="transform" label="Transform"}
Transform the input.
:::

:::edge{from="input" to="transform" label="next"}

:::
::::

### edge (structural child)
A labeled connection between diagram-local nodes.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- from: Required. Origin node ID.
- to: Required. Destination node ID.
- label: Optional. Relationship or transition label.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: flowchart, architecture, graph, state-machine, concept-map, decision-tree.
Working example:

::::flowchart
:::node{id="input" label="Input"}
Input arrives.
:::

:::node{id="transform" label="Transform"}
Transform the input.
:::

:::edge{from="input" to="transform" label="next"}

:::
::::

### participant (structural child)
A named sequence-diagram participant.
- id: Required. Unique ID within this sequence.
- title: Optional. Optional visible title.
- label: Required. Visible participant name.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: sequence.
Working example:

::::sequence
:::participant{id="reader" label="Reader"}

:::

:::participant{id="book" label="Book"}

:::

:::message{from="reader" to="book" label="Read"}

:::
::::

### message (structural child)
An ordered message in a sequence diagram.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- from: Required. Sender participant ID.
- to: Required. Receiver participant ID.
- label: Required. Message text.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: sequence.
Working example:

::::sequence
:::participant{id="a" label="A"}

:::

:::participant{id="b" label="B"}

:::

:::message{from="a" to="b" label="Request"}

:::
::::

### event (structural child)
One dated timeline event.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- date: Required. Date or period label.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: timeline.
Working example:

::::timeline
:::event{date="1687" title="Principia"}
The first edition is published.
:::
::::

### before (structural child)
The before version of a code comparison.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: code-diff.
Working example:

::::code-diff
:::before
```js
const result = values.map(f).map(g);
```
:::

:::after
```js
const result = values.map(x => g(f(x)));
```
:::
::::

### after (structural child)
The after version of a code comparison.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: code-diff.
Working example:

::::code-diff
:::before
```js
const result = values.map(f).map(g);
```
:::

:::after
```js
const result = values.map(x => g(f(x)));
```
:::
::::

### term (structural child)
A symbol, short meaning, and optional expanded explanation.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- symbol: Required. Symbol or technical term.
- meaning: Required. Concise meaning.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: symbol-glossary.
Working example:

::::symbol-glossary
:::term{symbol="v" meaning="Velocity"}
Its SI unit is metres per second.
:::
::::

### symbol (structural child)
Alias of term: a symbol and its meaning.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
- symbol: Required. Symbol or technical term.
- meaning: Required. Concise meaning.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: symbol-glossary.
Working example:

::::symbol-glossary
:::symbol{symbol="v" meaning="Velocity"}
Its SI unit is metres per second.
:::
::::

### answer (structural child)
A full Markdown answer to a question.
- id: Optional. Unique semantic ID, beginning with a letter.
- title: Optional. Optional visible title.
Content: ordinary Markdown and compatible nested blocks.
Allowed direct parents: question, predict.
Working example:

::::question
Why use a limit?

:::answer
The limit resolves the change at an individual point.
:::
::::
