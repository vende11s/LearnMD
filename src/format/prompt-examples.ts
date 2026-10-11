/** Representative syntax examples; the registry remains the complete catalog. */
export const PROMPT_EXAMPLES = [
  {
    name: 'Nested carousel with a source excerpt and two kinds of practice',
    source: String.raw`---
title: "Reason about an implication"
version: "1.0"
---

# Reason about an implication

An implication need not work in reverse. Test both directions separately.

::::::carousel{title="Apply the statement"}
:::::slide{title="Read and choose"}
> Demonstration excerpt, written for this example: A square has four equal sides. A rectangle need not have four equal sides.

::::quiz{multiple="true" explanation="The excerpt states that squares have four equal sides and that rectangles need not. It does not imply every rectangle is a square."}
Which statements follow from the excerpt? Select both.

:::choice{correct="true"}
A square has four equal sides.
:::

:::choice{correct="true"}
Being a rectangle does not guarantee four equal sides.
:::

:::choice{correct="false"}
Every rectangle is a square.
:::
::::
:::::

:::::slide{title="Check the direction"}
:::fill-blank{answer="no" placeholder="yes or no"}
A rectangle has unequal adjacent sides. Must it be a square?
:::
:::::
::::::`,
  },
  {
    name: 'Mathematics, a semantic reference, and an explained code example',
    source: String.raw`:::formula{id="mean" title="Mean of two numbers"}
$$
m=\frac{a+b}{2}
$$
:::

The sum is shared equally between two values; division by two gives their mean.

::::code-walkthrough{title="Implement the formula"}

~~~python
def mean(a, b):
    return (a + b) / 2
~~~

:::step{title="Inputs" lines="1"}
Accept the two numeric values $a$ and $b$.
:::

:::step{title="Calculation" lines="2"}
Parentheses ensure addition occurs before division.
:::
::::

:::reference{target="mean" label="Return to the equation"}
:::`,
  },
  {
    name: 'A declarative diagram with local IDs and useful node explanations',
    source: String.raw`::::flowchart{title="Check a proposed answer"}
:::node{id="attempt" label="Try"}
Write an answer and state the assumption it depends on.
:::

:::node{id="verify" label="Check"}
Compare the result with the original question and revise if necessary.
:::

:::edge{from="attempt" to="verify" label="Then"}
:::
::::`,
  },
  {
    name: 'Declared state and synchronized perspectives',
    source: String.raw`:::variable{name="show-reason" value="false"}
:::

:::toggle{target="show-reason" label="Show the reason"}
:::

:::conditional{target="show-reason" equals="true"}
Applying the same reversible operation to both sides preserves equality.
:::

:::::sync{group="equation"}
::::tabs{title="Equation"}
:::tab{title="Start"}
$x+1=3$
:::

:::tab{title="Result"}
$x=2$
:::
::::

::::tabs{title="Reasoning"}
:::tab{title="Start"}
Identify the unknown and the constant term.
:::

:::tab{title="Result"}
Subtract one from both sides.
:::
::::
:::::`,
  },
] as const;
