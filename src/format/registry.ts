import { z } from 'zod';

export type AttributeSpec = {
  description: string;
  required?: boolean;
  values?: readonly string[];
  number?: [number, number];
  integer?: boolean;
  pattern?: RegExp;
};
export interface ComponentDefinition {
  name: string;
  category: string;
  description: string;
  properties: Record<string, string>;
  example: string;
  attributes: Record<string, AttributeSpec>;
  schema: z.ZodType<Record<string, string>>;
  children?: string[];
  parents?: string[];
  structural?: boolean;
}

const text = (description: string, required = false): AttributeSpec => ({
  description,
  required,
});
const choice = (
  description: string,
  values: string[],
  required = false,
): AttributeSpec => ({ description, values, required });
const number = (
  description: string,
  min: number,
  max: number,
  integer = true,
): AttributeSpec => ({ description, number: [min, max], integer });
const identifier = (description: string, required = false): AttributeSpec => ({
  description,
  required,
  pattern: /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/,
});
const referenceTarget = (
  description: string,
  required = false,
): AttributeSpec => ({
  description,
  required,
  pattern: /^[\p{L}\p{N}_-]{1,100}$/u,
});
const common = {
  id: identifier('Unique semantic ID, beginning with a letter.'),
  title: text('Optional visible title.'),
};
const extraAttributes: Record<string, Record<string, AttributeSpec>> = {
  columns: {
    columns: number('Preferred number of columns; alias of count.', 1, 4),
  },
  layer: {
    level: choice('Associated detail level.', [
      'concise',
      'standard',
      'detailed',
    ]),
  },
  'fill-blank': {
    caseSensitive: choice('Match letter case exactly.', ['true', 'false']),
  },
  predict: { prompt: text('Question shown above the prediction area.') },
  question: { prompt: text('Question text shown before the body.') },
  formula: { label: text('Optional equation label.') },
  embed: {
    kind: choice('Resource kind; alias of type.', ['audio', 'video', 'link']),
  },
  item: {
    target: referenceTarget('Optional semantic reference or heading slug.'),
  },
  'decision-tree': { root: identifier('Initial node ID; alias of start.') },
  node: {
    next: identifier('Default next node.'),
    yes: identifier('Next node for a yes answer.'),
    no: identifier('Next node for a no answer.'),
  },
};
const block = (name: string, body: string, attrs = '', count = 3): string =>
  `${':'.repeat(count)}${name}${attrs ? `{${attrs}}` : ''}\n${body.replace(/^\$\$(.+)\$\$$/gm, (_, math: string) => `$$\n${math}\n$$`)}\n${':'.repeat(count)}`;
const child = (name: string, body: string, attrs = '') =>
  block(name, body, attrs);
const make = (
  name: string,
  category: string,
  description: string,
  attrs: Record<string, AttributeSpec> = {},
  body = 'Explain the idea clearly, with context.',
  options: {
    children?: string[];
    parents?: string[];
    structural?: boolean;
    example?: string;
    exampleAttrs?: string;
  } = {},
): ComponentDefinition => {
  const attributes = { ...common, ...extraAttributes[name], ...attrs };
  const shape: Record<string, z.ZodType> = {};
  for (const [key, spec] of Object.entries(attributes)) {
    let field = z.string().max(4000);
    if (spec.required) field = field.min(1);
    if (spec.pattern)
      field = field.regex(
        spec.pattern,
        key === 'lines'
          ? 'Use comma-separated line numbers or ranges, such as 1,3-5.'
          : key === 'target' && ['reference', 'item'].includes(name)
            ? 'Use a semantic ID or heading slug (letters, numbers, underscores, and hyphens).'
            : 'Use a letter followed by letters, numbers, underscores, or hyphens (maximum 80 characters).',
      );
    let rule: z.ZodType = field;
    if (spec.values)
      rule = field.refine(
        (value) => spec.values!.includes(value),
        `Expected one of: ${spec.values.join(', ')}.`,
      );
    if (spec.number)
      rule = field.refine(
        (value) =>
          value.trim() !== '' &&
          Number.isFinite(Number(value)) &&
          (!spec.integer || Number.isInteger(Number(value))) &&
          Number(value) >= spec.number![0] &&
          Number(value) <= spec.number![1],
        `Expected ${spec.integer ? 'an integer' : 'a number'} from ${spec.number[0]} to ${spec.number[1]}.`,
      );
    shape[key] = spec.required ? rule : rule.optional();
  }
  const properties = Object.fromEntries(
    Object.entries(attributes).map(([key, spec]) => [
      key,
      `${spec.required ? 'Required. ' : 'Optional. '}${spec.description}${spec.values ? ` Allowed: ${spec.values.join(', ')}.` : ''}${spec.number ? ` ${spec.integer ? 'Integer' : 'Number'} from ${spec.number[0]} to ${spec.number[1]}.` : ''}`,
    ]),
  );
  return {
    name,
    category,
    description,
    properties,
    attributes,
    schema: z.object(shape).strict() as z.ZodType<Record<string, string>>,
    example:
      options.example ??
      block(name, body, options.exampleAttrs, body.includes(':::') ? 4 : 3),
    children: options.children,
    parents: options.parents,
    structural: options.structural,
  };
};

const nodes = `${child('node', 'Input arrives.', 'id="input" label="Input"')}\n\n${child('node', 'Transform the input.', 'id="transform" label="Transform"')}\n\n${child('edge', '', 'from="input" to="transform" label="next"')}`;
const steps = `${child('step', '$$2x + 4 = 10$$', 'title="Start"')}\n\n${child('step', '$$2x = 6$$', 'title="Subtract four" explanation="Apply the same operation to both sides."')}\n\n${child('step', '$$x = 3$$', 'title="Divide by two"')}`;
const tabs = `${child('tab', 'A derivative is a local rate of change.', 'title="Intuition"')}\n\n${child('tab', '$$f\u2032(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}h$$', 'title="Definition"')}`;
const cases = `${child('case', 'Low resistance permits a larger current for the same voltage.', 'title="Low resistance"')}\n\n${child('case', 'High resistance limits the current.', 'title="High resistance"')}`;
const beforeAfter = `${child('before', '\u0060\u0060\u0060js\nconst result = values.map(f).map(g);\n\u0060\u0060\u0060')}\n\n${child('after', '\u0060\u0060\u0060js\nconst result = values.map(x => g(f(x)));\n\u0060\u0060\u0060')}`;

/** This registry is the source of truth for validation, the gallery, and the generation prompt. */
export const COMPONENTS: ComponentDefinition[] = [
  make(
    'columns',
    'Layout',
    'Responsive columns that stack on narrow screens.',
    { count: number('Preferred number of columns.', 1, 4) },
    `${child('card', 'A geometric interpretation.', 'title="Visual"')}\n\n${child('card', 'An algebraic interpretation.', 'title="Symbolic"')}`,
    { exampleAttrs: 'count="2"' },
  ),
  make(
    'grid',
    'Layout',
    'A responsive grid for related content.',
    { columns: number('Preferred column count.', 1, 4) },
    `${child('card', 'First principle.')}\n\n${child('card', 'Second principle.')}`,
    { exampleAttrs: 'columns="2"' },
  ),
  make(
    'stack',
    'Layout',
    'Compose blocks vertically or horizontally.',
    { direction: choice('Stack direction.', ['vertical', 'horizontal']) },
    `${child('card', 'Observe.')}\n\n${child('card', 'Explain.')}`,
  ),
  make(
    'card',
    'Layout',
    'Group a small amount of related content.',
    {},
    'The area of a circle is $A=\\pi r^2$.',
    { exampleAttrs: 'title="Area"' },
  ),
  make(
    'section',
    'Layout',
    'A semantic section with an optional heading.',
    {},
    'Compare the assumptions before choosing a model.',
    { exampleAttrs: 'title="Assumptions" id="assumptions"' },
  ),
  make('divider', 'Layout', 'A quiet visual separation between ideas.', {}, ''),
  make(
    'tabs',
    'Layout',
    'Switch between related perspectives using tab titles.',
    { initial: number('Initial zero-based tab index.', 0, 100) },
    tabs,
    { children: ['tab'] },
  ),
  make(
    'accordion',
    'Layout',
    'Independent expandable explanations.',
    { open: choice('Open all items initially.', ['true', 'false']) },
    `${child('item', 'Continuity is necessary but not sufficient for differentiability.', 'title="Is every continuous function differentiable?"')}`,
    { children: ['item'] },
  ),
  make(
    'split-view',
    'Layout',
    'Compare two related panels side by side.',
    {},
    `${child('panel', '$$a^2+b^2=c^2$$', 'title="Equation"')}\n\n${child('panel', 'The square on the hypotenuse equals the sum of the other two squares.', 'title="Meaning"')}`,
    { children: ['panel'] },
  ),
  make(
    'comparison',
    'Layout',
    'Labeled alternatives with equal visual weight.',
    {},
    `${child('item', 'Fast average lookup; ordering is not intrinsic.', 'title="Hash map"')}\n\n${child('item', 'Ordered keys with logarithmic search.', 'title="Search tree"')}`,
    { children: ['item', 'panel'] },
  ),
  ...(
    [
      'definition',
      'theorem',
      'lemma',
      'example',
      'counterexample',
      'callout',
      'warning',
      'intuition',
      'summary',
    ] as const
  ).map((name) =>
    make(
      name,
      'Educational',
      {
        definition: 'A precise definition of a concept.',
        theorem: 'A numbered mathematical statement.',
        lemma: 'A supporting mathematical statement.',
        example: 'A concrete worked example.',
        counterexample: 'An example that disproves an overgeneralization.',
        callout: 'A contextual observation.',
        warning: 'An assumption, hazard, or common error.',
        intuition: 'An informal mental model.',
        summary: 'A short recap of the essential ideas.',
      }[name],
      name === 'callout'
        ? { tone: choice('Visual emphasis.', ['note', 'tip', 'important']) }
        : {},
      {
        definition:
          'A function is **injective** when distinct inputs have distinct outputs.',
        theorem:
          'If $f$ is differentiable at $a$, then $f$ is continuous at $a$.',
        lemma: 'If $a>0$ and $b>0$, then $a+b>0$.',
        example: 'For $f(x)=x^2$, we have $f\u2032(3)=6$.',
        counterexample:
          '$f(x)=|x|$ is continuous at zero but is not differentiable there.',
        callout: 'The derivative depends on the point where it is evaluated.',
        warning:
          'Division by an expression requires that expression to be nonzero.',
        intuition:
          'Zoom in far enough and a smooth curve looks like a straight line.',
        summary:
          'A derivative measures local change. Check existence before applying rules.',
      }[name],
    ),
  ),
  make(
    'proof',
    'Educational',
    'An expandable proof; use nested steps for progressive reasoning.',
    { open: choice('Expand the proof initially.', ['true', 'false']) },
    'Assume $a>0$ and $b>0$. Adding $b$ to both sides of $a>0$ gives $a+b>b>0$.',
    { exampleAttrs: 'title="Proof of positivity"' },
  ),
  make(
    'steps',
    'Progressive',
    'Reveal an ordered argument one step at a time.',
    { initial: number('Initial zero-based step index.', 0, 100) },
    steps,
    { children: ['step'] },
  ),
  make(
    'derivation',
    'Progressive',
    'A progressive mathematical derivation with explanations.',
    { initial: number('Initial zero-based step index.', 0, 100) },
    steps,
    { children: ['step'], exampleAttrs: 'title="Solve a linear equation"' },
  ),
  make(
    'reveal',
    'Progressive',
    'A disclosure for an answer or additional explanation.',
    { label: text('Text of the disclosure control.') },
    'The slope is $2x$, so at $x=3$ it is $6$.',
    { exampleAttrs: 'label="Show the answer"' },
  ),
  make(
    'hint',
    'Progressive',
    'Reveal a nudge before the complete solution.',
    { label: text('Disclosure label.') },
    'Try subtracting the constant term from both sides.',
    { exampleAttrs: 'label="A small hint"' },
  ),
  make(
    'layers',
    'Progressive',
    'Switch between named levels of explanation.',
    { initial: number('Initial zero-based layer.', 0, 100) },
    `${child('layer', 'A matrix describes a linear transformation.', 'title="Intuition"')}\n\n${child('layer', '$$T(\\alpha u+\\beta v)=\\alpha T(u)+\\beta T(v)$$', 'title="Formal"')}`,
    { children: ['layer'] },
  ),
  make(
    'detail-level',
    'Progressive',
    'Show content at or above a document detail threshold.',
    {
      level: choice(
        'Minimum visible detail level.',
        ['concise', 'standard', 'detailed'],
        true,
      ),
    },
    'At a corner, the left and right derivatives may disagree.',
    { exampleAttrs: 'level="detailed"' },
  ),
  make(
    'variants',
    'Progressive',
    'Select among alternative explanations or methods.',
    { initial: number('Initial zero-based variant.', 0, 100) },
    `${child('variant', 'Complete the square to solve a quadratic.', 'title="Algebra"')}\n\n${child('variant', 'Find where the parabola crosses the horizontal axis.', 'title="Geometry"')}`,
    { children: ['variant'] },
  ),
  make(
    'branch',
    'Progressive',
    'Choose an explanatory path.',
    {},
    `${child('option', 'Begin with repeated addition and scaling.', 'title="I am new to vectors"')}\n\n${child('option', 'Consider linear combinations and spanning sets.', 'title="I know the basics"')}`,
    { children: ['option'] },
  ),
  make(
    'spotlight',
    'Progressive',
    'Focus on one labeled region at a time.',
    {},
    `${child('item', 'The numerator measures output change.', 'title="Numerator"')}\n\n${child('item', 'The denominator measures input change.', 'title="Denominator"')}`,
    { children: ['item'] },
  ),
  make(
    'annotated',
    'Progressive',
    'Labeled annotations reveal contextual explanations.',
    {},
    `The derivative measures local change.\n\n${child('annotation', 'Local means near a particular input, rather than across the full domain.', 'label="What does local mean?"')}`,
    { children: ['annotation'] },
  ),
  make(
    'question',
    'Interactive',
    'A reflection question with a revealable answer.',
    {
      answer: text(
        'Short answer; longer explanation can be nested in an answer block.',
      ),
    },
    'Why does a derivative require a limit?',
    {
      exampleAttrs:
        'answer="A finite interval gives an average rate; the limit gives a local rate."',
    },
  ),
  make(
    'quiz',
    'Interactive',
    'Select one or more choices and receive explanatory feedback.',
    {
      multiple: choice('Allow several correct choices.', ['true', 'false']),
      explanation: text('Feedback after checking.'),
    },
    `Which function has derivative $2x$?\n\n${child('choice', '$f(x)=x^2$', 'correct="true"')}\n\n${child('choice', '$f(x)=2x$', 'correct="false"')}`,
    {
      children: ['choice'],
      exampleAttrs: 'explanation="The power rule gives d(x²)/dx = 2x."',
    },
  ),
  make(
    'fill-blank',
    'Interactive',
    'Check a short text answer, ignoring letter case and outer spaces.',
    {
      answer: text('Expected answer.', true),
      placeholder: text('Input hint.'),
    },
    'The derivative of $x^2$ is…',
    { exampleAttrs: 'answer="2x" placeholder="Your expression"' },
  ),
  make(
    'match',
    'Interactive',
    'Match each left-hand concept to a right-hand explanation.',
    {},
    `${child('pair', '', 'left="Derivative" right="Local rate of change"')}\n\n${child('pair', '', 'left="Integral" right="Accumulation"')}`,
    { children: ['pair'] },
  ),
  make(
    'sort',
    'Interactive',
    'Put items in their authored logical order using keyboard-accessible controls.',
    {},
    `${child('item', 'Identify the unknown.')}\n\n${child('item', 'Isolate the unknown.')}\n\n${child('item', 'Check the result.')}`,
    { children: ['item'] },
  ),
  make(
    'predict',
    'Interactive',
    'Write a prediction before revealing the outcome.',
    { answer: text('Outcome to reveal.', true) },
    'What happens to current if resistance doubles while voltage stays fixed?',
    { exampleAttrs: 'answer="The current halves, because I = V/R."' },
  ),
  make(
    'scenario',
    'Interactive',
    'Explore authored scenarios without executing code.',
    {},
    cases,
    { children: ['case'] },
  ),
  make(
    'decision-tree',
    'Interactive',
    'Navigate a graph of decisions; nodes show explanations and outgoing choices.',
    { start: identifier('Initial node ID.') },
    `${child('node', 'Does the list have a known length?', 'id="start" label="Choose a loop"')}\n\n${child('node', 'Use a for loop for a known number of iterations.', 'id="known" label="Known length"')}\n\n${child('node', 'Use a while loop when a condition determines termination.', 'id="unknown" label="Unknown length"')}\n\n${child('edge', '', 'from="start" to="known" label="Yes"')}\n\n${child('edge', '', 'from="start" to="unknown" label="No"')}`,
    { children: ['node', 'edge'], exampleAttrs: 'start="start"' },
  ),
  make(
    'checklist',
    'Interactive',
    'Track temporary checks without modifying the document.',
    {},
    '- [ ] Identify assumptions\n- [ ] Check dimensions\n- [ ] Test a limiting case',
  ),
  make(
    'scratchpad',
    'Interactive',
    'A temporary private working area; this never changes note source.',
    { placeholder: text('Prompt inside the working area.') },
    '',
    {
      exampleAttrs:
        'title="Work it out" placeholder="Try a calculation or explain this in your own words…"',
    },
  ),
  make(
    'flowchart',
    'Diagrams',
    'A directed flow of labeled steps and branches.',
    {},
    nodes,
    { children: ['node', 'edge'] },
  ),
  make(
    'architecture',
    'Diagrams',
    'System components with labeled dependencies.',
    {},
    `${child('node', 'Presents the interface.', 'id="browser" label="Browser"')}\n\n${child('node', 'Persists local notes.', 'id="database" label="IndexedDB"')}\n\n${child('edge', '', 'from="browser" to="database" label="read / write"')}`,
    { children: ['node', 'edge'] },
  ),
  make(
    'sequence',
    'Diagrams',
    'Ordered messages between named participants.',
    {},
    `${child('participant', '', 'id="client" label="Client"')}\n\n${child('participant', '', 'id="server" label="Server"')}\n\n${child('message', '', 'from="client" to="server" label="Request"')}\n\n${child('message', '', 'from="server" to="client" label="Response"')}`,
    { children: ['participant', 'message'] },
  ),
  make(
    'timeline',
    'Diagrams',
    'Chronological events with contextual explanations.',
    {},
    `${child('event', 'The printing press spreads reproducible texts.', 'date="c. 1450" title="Movable type in Europe"')}\n\n${child('event', 'The first edition presents the laws of motion.', 'date="1687" title="Newton’s Principia"')}`,
    { children: ['event'] },
  ),
  make(
    'tree',
    'Diagrams',
    'An expandable hierarchy using nested item blocks.',
    {},
    child(
      'item',
      `${child('item', 'A leaf stores one value.', 'title="Leaf"')}`,
      'title="Root"',
    ),
    {
      children: ['item'],
      example: block(
        'tree',
        block(
          'item',
          child('item', 'A leaf stores one value.', 'title="Leaf"'),
          'title="Root"',
          4,
        ),
        '',
        5,
      ),
    },
  ),
  make(
    'graph',
    'Diagrams',
    'A network of selectable vertices and labeled edges.',
    { directed: choice('Display directed connections.', ['true', 'false']) },
    nodes,
    { children: ['node', 'edge'] },
  ),
  make(
    'state-machine',
    'Diagrams',
    'Select states and follow labeled transitions.',
    { start: identifier('Initial state ID.') },
    `${child('node', 'No request is in flight.', 'id="idle" label="Idle"')}\n\n${child('node', 'A request is being processed.', 'id="loading" label="Loading"')}\n\n${child('edge', '', 'from="idle" to="loading" label="Fetch"')}\n\n${child('edge', '', 'from="loading" to="idle" label="Complete"')}`,
    { children: ['node', 'edge'], exampleAttrs: 'start="idle"' },
  ),
  make(
    'process',
    'Diagrams',
    'A numbered process with selectable stages.',
    {},
    `${child('step', 'State a testable explanation.', 'title="Hypothesis"')}\n\n${child('step', 'Choose measurements that could disprove it.', 'title="Experiment"')}\n\n${child('step', 'Compare observations with predictions.', 'title="Evaluation"')}`,
    { children: ['step'] },
  ),
  make(
    'concept-map',
    'Diagrams',
    'Labeled conceptual relationships in a selectable network.',
    {},
    `${child('node', 'A change in velocity per unit time.', 'id="acceleration" label="Acceleration"')}\n\n${child('node', 'The net interaction acting on an object.', 'id="force" label="Force"')}\n\n${child('edge', '', 'from="force" to="acceleration" label="causes, for nonzero mass"')}`,
    { children: ['node', 'edge'] },
  ),
  make(
    'image-annotation',
    'Diagrams',
    'Position accessible annotation markers on a bundled or explicitly allowed image.',
    {
      src: text('Safe relative asset path or HTTPS URL.', true),
      alt: text('Accessible description.', true),
    },
    child(
      'annotation',
      '$(\\cos \\theta, \\sin \\theta)$ lies on $x^2 + y^2 = 1$.',
      'label="A point on the circle" x="69" y="28"',
    ),
    {
      children: ['annotation'],
      exampleAttrs:
        'src="unit-circle.png" alt="A unit circle with a point at angle theta"',
    },
  ),
  make(
    'formula',
    'Technical',
    'A numbered display equation with copyable LaTeX.',
    {
      number: text(
        'Optional equation label; otherwise numbered automatically.',
      ),
    },
    '$$E = mc^2$$',
    { exampleAttrs: 'id="energy" title="Mass–energy equivalence"' },
  ),
  make(
    'equation-system',
    'Technical',
    'An aligned system of equations.',
    {},
    '$$\n\\begin{aligned}\n2x+y &= 5\\\\\nx-y &= 1\n\\end{aligned}\n$$',
  ),
  make(
    'code',
    'Technical',
    'A syntax-highlighted, copyable code example.',
    { language: text('Syntax language, such as javascript or python.') },
    '\u0060\u0060\u0060python\ndef square(x):\n    return x * x\n\u0060\u0060\u0060',
    { exampleAttrs: 'title="Square a number" language="python"' },
  ),
  make(
    'code-walkthrough',
    'Technical',
    'Step through explanations that highlight source lines.',
    {},
    `\u0060\u0060\u0060python\ndef square(x):\n    return x * x\n\u0060\u0060\u0060\n\n${child('step', 'Bind the input to the parameter x.', 'title="Input" lines="1"')}\n\n${child('step', 'Multiply the input by itself.', 'title="Output" lines="2"')}`,
    { children: ['step'] },
  ),
  make(
    'code-diff',
    'Technical',
    'Side-by-side before and after code.',
    {},
    beforeAfter,
    { children: ['before', 'after'] },
  ),
  make(
    'data-table',
    'Technical',
    'A sortable table using ordinary GFM table syntax.',
    { sortable: choice('Allow sorting by column headers.', ['true', 'false']) },
    '| Input | Square |\n| --- | --- |\n| 2 | 4 |\n| 3 | 9 |\n| 4 | 16 |',
    { exampleAttrs: 'title="Values of x²" sortable="true"' },
  ),
  make(
    'symbol-glossary',
    'Technical',
    'A searchable glossary of symbols and meanings.',
    {},
    `${child('term', 'The rate of change of position.', 'symbol="v" meaning="Velocity"')}\n\n${child('term', 'The rate of change of velocity.', 'symbol="a" meaning="Acceleration"')}`,
    { children: ['term', 'symbol'] },
  ),
  make(
    'reference',
    'Technical',
    'Navigate to a semantic ID in this document.',
    {
      target: referenceTarget(
        'ID of a component or the generated heading slug.',
        true,
      ),
      label: text('Link text.'),
    },
    '',
    {
      example: `${block('definition', 'Distinct inputs have distinct outputs.', 'id="injective" title="Injective function"')}\n\n${block('reference', '', 'target="injective" label="Return to the definition"')}`,
    },
  ),
  make(
    'prerequisites',
    'Technical',
    'A concise list of assumed concepts.',
    {},
    '- Algebraic manipulation\n- Function notation\n- Limits',
  ),
  make(
    'embed',
    'Technical',
    'A safe external resource link or user-activated native audio/video playback.',
    {
      src: text('HTTPS resource URL.', true),
      label: text('Resource link text.'),
      type: choice('Resource kind.', ['video', 'audio', 'resource']),
    },
    'Use this optional external resource after reading the section.',
    {
      exampleAttrs:
        'src="https://en.wikipedia.org/wiki/Derivative" label="Derivative reference" type="resource"',
    },
  ),
  make(
    'sync',
    'Composition',
    'Share the selected index between descendant steps, tabs, layers, variants, and spotlight blocks.',
    { group: identifier('Document-scoped synchronization group.', true) },
    `${block('steps', `${child('step', '$$x+1=3$$', 'title="Equation"')}\n\n${child('step', '$$x=2$$', 'title="Solution"')}`, '', 4)}\n\n${block('steps', `${child('step', 'Start from the given equation.', 'title="Equation"')}\n\n${child('step', 'Subtract one from both sides.', 'title="Solution"')}`, '', 4)}`,
    {
      example: block(
        'sync',
        `${block('steps', `${child('step', '$$x+1=3$$', 'title="Equation"')}\n\n${child('step', '$$x=2$$', 'title="Solution"')}`, '', 4)}\n\n${block('steps', `${child('step', 'Start from the given equation.', 'title="Equation"')}\n\n${child('step', 'Subtract one from both sides.', 'title="Solution"')}`, '', 4)}`,
        'group="equation-demo"',
        5,
      ),
    },
  ),
  make(
    'variable',
    'Composition',
    'Declare a document-scoped string value with a deterministic initial value.',
    {
      name: identifier('Unique variable name.', true),
      value: text('Initial string value.', true),
    },
    '',
    {
      example: `${block('variable', '', 'name="show-extra" value="off"')}\n\n${block('toggle', '', 'target="show-extra" on="on" off="off" label="Show the shared value in action"')}\n\n${block('conditional', 'The toggle changed the declared variable from **off** to **on**, making this explanation visible.', 'target="show-extra" equals="on"')}`,
    },
  ),
  make(
    'conditional',
    'Composition',
    'Show content when a declared variable equals a literal value.',
    {
      target: identifier('Declared variable name.', true),
      equals: text('Exact string value to compare.', true),
    },
    'Additional context.',
    {
      example: `${block('variable', '', 'name="context" value="on"')}\n\n${block('toggle', '', 'target="context" on="on" off="off" label="Show supporting context"')}\n\n${block('conditional', 'This explanation is visible while the shared variable is **on**. Switch the toggle to hide it.', 'target="context" equals="on"')}`,
    },
  ),
  make(
    'toggle',
    'Composition',
    'Switch a declared variable between two literal values.',
    {
      target: identifier('Declared variable name.', true),
      on: text('Value when enabled. Default: true.'),
      off: text('Value when disabled. Default: false.'),
      label: text('Control label.'),
    },
    '',
    {
      example: `${block('variable', '', 'name="assumptions" value="false"')}\n\n${block('toggle', '', 'target="assumptions" label="Show assumptions"')}\n\n${block('conditional', 'Assume the function is differentiable on the interval.', 'target="assumptions" equals="true"')}`,
    },
  ),
  make(
    'popover',
    'Composition',
    'An accessible contextual disclosure, usable by pointer and keyboard.',
    { label: text('Disclosure label.', true) },
    'A function is continuous when its value agrees with its limit at the point.',
    { exampleAttrs: 'label="Continuity"' },
  ),
  // Structural children have the same validation and fallback rendering guarantees as public blocks.
  make(
    'step',
    'Structural',
    'One stage in a progressive explanation.',
    {
      explanation: text('Short secondary explanation.'),
      lines: {
        description: 'Code line numbers or ranges, such as 1,3-5.',
        pattern: /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/,
      },
    },
    'Apply the same operation to both sides.',
    {
      structural: true,
      parents: [
        'steps',
        'derivation',
        'code-walkthrough',
        'process',
        'hint',
        'proof',
      ],
      example: block(
        'steps',
        child(
          'step',
          'Apply the same operation to both sides.',
          'title="Preserve equality"',
        ),
        '',
        4,
      ),
    },
  ),
  ...(['tab', 'layer', 'variant', 'option', 'case', 'panel'] as const).map(
    (name) => {
      const parent = {
        tab: 'tabs',
        layer: 'layers',
        variant: 'variants',
        option: 'branch',
        case: 'scenario',
        panel: 'split-view',
      }[name];
      return make(
        name,
        'Structural',
        `One labeled ${name} inside ${parent}.`,
        {},
        'An explanation of this perspective.',
        {
          structural: true,
          parents: name === 'panel' ? ['split-view', 'comparison'] : [parent],
          example: block(
            parent,
            child(
              name,
              'An explanation of this perspective.',
              'title="Perspective"',
            ),
            '',
            4,
          ),
        },
      );
    },
  ),
  make(
    'item',
    'Structural',
    'A labeled list, hierarchy, or disclosure item.',
    {
      checked: choice('Initial checked state.', ['true', 'false']),
      value: text('Optional item value.'),
    },
    'A supporting explanation.',
    {
      structural: true,
      parents: [
        'accordion',
        'comparison',
        'spotlight',
        'sort',
        'checklist',
        'tree',
        'item',
        'prerequisites',
        'sync',
      ],
      example: block(
        'accordion',
        child('item', 'A supporting explanation.', 'title="Details"'),
        '',
        4,
      ),
    },
  ),
  make(
    'annotation',
    'Structural',
    'A contextual explanation or image marker.',
    {
      label: text('Annotation trigger text.', true),
      x: number('Horizontal marker position, in percent.', 0, 100, false),
      y: number('Vertical marker position, in percent.', 0, 100, false),
    },
    'A precise contextual explanation.',
    {
      structural: true,
      parents: ['annotated', 'image-annotation'],
      example: block(
        'annotated',
        child(
          'annotation',
          'A precise contextual explanation.',
          'label="Explain this"',
        ),
        '',
        4,
      ),
    },
  ),
  make(
    'choice',
    'Structural',
    'A choice in a quiz.',
    {
      correct: choice(
        'Whether this choice is correct.',
        ['true', 'false'],
        true,
      ),
    },
    'This statement is correct.',
    {
      structural: true,
      parents: ['quiz'],
      example: block(
        'quiz',
        `${child('choice', 'Two plus two is four.', 'correct="true"')}\n\n${child('choice', 'Two plus two is five.', 'correct="false"')}`,
        '',
        4,
      ),
    },
  ),
  make(
    'pair',
    'Structural',
    'One matching pair.',
    {
      left: text('Left concept.', true),
      right: text('Matching concept.', true),
    },
    '',
    {
      structural: true,
      parents: ['match'],
      example: block(
        'match',
        child('pair', '', 'left="Derivative" right="Rate of change"'),
        '',
        4,
      ),
    },
  ),
  make(
    'node',
    'Structural',
    'A selectable diagram node; IDs are local to the diagram.',
    {
      id: identifier('Unique ID within the containing diagram.', true),
      label: text('Visible node name.', true),
      description: text('Brief node explanation.'),
      x: number('Optional horizontal coordinate.', 0, 100, false),
      y: number('Optional vertical coordinate.', 0, 100, false),
    },
    'A meaningful explanation of this node.',
    {
      structural: true,
      parents: [
        'flowchart',
        'architecture',
        'graph',
        'state-machine',
        'concept-map',
        'decision-tree',
      ],
      example: block('graph', nodes, '', 4),
    },
  ),
  make(
    'edge',
    'Structural',
    'A labeled connection between diagram-local nodes.',
    {
      from: identifier('Origin node ID.', true),
      to: identifier('Destination node ID.', true),
      label: text('Relationship or transition label.'),
    },
    '',
    {
      structural: true,
      parents: [
        'flowchart',
        'architecture',
        'graph',
        'state-machine',
        'concept-map',
        'decision-tree',
      ],
      example: block('flowchart', nodes, '', 4),
    },
  ),
  make(
    'participant',
    'Structural',
    'A named sequence-diagram participant.',
    {
      id: identifier('Unique ID within this sequence.', true),
      label: text('Visible participant name.', true),
    },
    '',
    {
      structural: true,
      parents: ['sequence'],
      example: block(
        'sequence',
        `${child('participant', '', 'id="reader" label="Reader"')}\n\n${child('participant', '', 'id="book" label="Book"')}\n\n${child('message', '', 'from="reader" to="book" label="Read"')}`,
        '',
        4,
      ),
    },
  ),
  make(
    'message',
    'Structural',
    'An ordered message in a sequence diagram.',
    {
      from: identifier('Sender participant ID.', true),
      to: identifier('Receiver participant ID.', true),
      label: text('Message text.', true),
    },
    '',
    {
      structural: true,
      parents: ['sequence'],
      example: block(
        'sequence',
        `${child('participant', '', 'id="a" label="A"')}\n\n${child('participant', '', 'id="b" label="B"')}\n\n${child('message', '', 'from="a" to="b" label="Request"')}`,
        '',
        4,
      ),
    },
  ),
  make(
    'event',
    'Structural',
    'One dated timeline event.',
    { date: text('Date or period label.', true) },
    'Explain what happened and why it matters.',
    {
      structural: true,
      parents: ['timeline'],
      example: block(
        'timeline',
        child(
          'event',
          'The first edition is published.',
          'date="1687" title="Principia"',
        ),
        '',
        4,
      ),
    },
  ),
  ...(['before', 'after'] as const).map((name) =>
    make(
      name,
      'Structural',
      `The ${name} version of a code comparison.`,
      {},
      '\u0060\u0060\u0060js\nconst x = 2;\n\u0060\u0060\u0060',
      {
        structural: true,
        parents: ['code-diff'],
        example: block('code-diff', beforeAfter, '', 4),
      },
    ),
  ),
  make(
    'term',
    'Structural',
    'A symbol, short meaning, and optional expanded explanation.',
    {
      symbol: text('Symbol or technical term.', true),
      meaning: text('Concise meaning.', true),
    },
    'Its SI unit is metres per second.',
    {
      structural: true,
      parents: ['symbol-glossary'],
      example: block(
        'symbol-glossary',
        child(
          'term',
          'Its SI unit is metres per second.',
          'symbol="v" meaning="Velocity"',
        ),
        '',
        4,
      ),
    },
  ),
  make(
    'symbol',
    'Structural',
    'Alias of term: a symbol and its meaning.',
    {
      symbol: text('Symbol or technical term.', true),
      meaning: text('Concise meaning.', true),
    },
    'Its SI unit is metres per second.',
    {
      structural: true,
      parents: ['symbol-glossary'],
      example: block(
        'symbol-glossary',
        child(
          'symbol',
          'Its SI unit is metres per second.',
          'symbol="v" meaning="Velocity"',
        ),
        '',
        4,
      ),
    },
  ),
  make(
    'answer',
    'Structural',
    'A full Markdown answer to a question.',
    {},
    'The limit resolves the change at an individual point.',
    {
      structural: true,
      parents: ['question', 'predict'],
      example: block(
        'question',
        `Why use a limit?\n\n${child('answer', 'The limit resolves the change at an individual point.')}`,
        '',
        4,
      ),
    },
  ),
];

export const COMPONENT_MAP = new Map(
  COMPONENTS.map((component) => [component.name, component]),
);
export const PUBLIC_COMPONENTS = COMPONENTS.filter(
  (component) => !component.structural,
);
export const FORMAT_VERSION = '1.0';
export const DIAGRAM_LIMITS = Object.freeze({
  nodes: 60,
  edges: 150,
  participants: 12,
  messages: 100,
});
