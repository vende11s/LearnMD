export const englishGuideSource = String.raw`---
version: "1.0"
title: "Your first steps with LearnMD"
description: "Three steps. Four quick challenges. Your turn."
subject: "Getting started"
author: "LearnMD"
tags: [guide, workflow]
---

# Your first steps with LearnMD

**Turn your materials into notes you can click.** Bring slides, a PDF, exercises, or just a topic.

## Make your first note

::::steps{title="From topic to note"}
:::step{title="Copy"}
Open **Generate notes → Copy prompt**.
:::

:::step{title="Ask your LLM"}
Paste it into ChatGPT, Claude, or Gemini. Add your materials and say what you want to understand. LearnMD itself makes no AI calls.
:::

:::step{title="Import"}
Choose **Add note → Paste source**, paste the result, then **Import & open**. You can also import a .learn.md file. Check the answers against your materials.
:::
::::

Notes follow your materials' language unless you ask for another.

## Your turn

Four equal pizza slices. One slice is a quarter:

$$
\frac{1}{4}=25\%
$$

:::reveal{label="A quick trick for adding fractions"}
Use the same denominator: $\frac{1}{2}+\frac{1}{4}=\frac{2}{4}+\frac{1}{4}=\frac{3}{4}$.
:::

Try the four challenges. Use the arrows to move between them.

::::::carousel{title="Give it a try"}
:::::slide{title="Pick one"}
::::quiz{title="How much pizza?" explanation="Half is two quarters. Add one quarter: three quarters."}
You eat half a pizza, then another quarter. How much is that?

:::choice{correct="false"}
1/4
:::
:::choice{correct="true"}
3/4
:::
:::choice{correct="false"}
2/6
:::
::::
:::::

:::::slide{title="Pick two"}
::::quiz{title="More than half" multiple="true" explanation="Three quarters and a whole pizza both exceed half. One quarter does not."}
Which portions are larger than 1/2? Select both.

:::choice{correct="true"}
3/4
:::
:::choice{correct="true"}
4/4
:::
:::choice{correct="false"}
1/4
:::
::::
:::::

:::::slide{title="Fill the gap"}
:::fill-blank{title="From fractions to percentages" answer="25|25%" placeholder="Your number"}
One of four equal slices is ______% of the pizza.
:::
:::::

:::::slide{title="Match them"}
::::match{title="Same amount, different words"}
:::pair{left="1/4" right="One quarter"}
:::
:::pair{left="1/2" right="One half"}
:::
:::pair{left="3/4" right="Three quarters"}
:::
::::
:::::
::::::

Exercise answers last while this note is open. More possibilities: **Component guide**.

## Make it yours

- **Stuck?** Use **Copy source** above the note or select a passage. Paste it into your LLM and ask about that step.
- **Keep a backup:** notes live on this device, without cloud sync. Use **Settings → Export library**.
- **Ready?** Create your own folders and delete this guide with the trash icon.
`;
