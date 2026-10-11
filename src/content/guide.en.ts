export const englishGuideSource = String.raw`---
version: "1.0"
title: "Your first steps with LearnMD"
description: "Turn your own materials into clear, interactive notes, then make this library your own."
subject: "Getting started"
author: "LearnMD"
tags: [guide, workflow]
---

# Your first steps with LearnMD

A good note gives you something to understand, something to try, and a way to check your reasoning. LearnMD brings those pieces together in a calm reading space. You supply the subject: lecture slides, a PDF chapter, an exercise set, rough notes, or simply a topic you want to explore.

This guide is your first ordinary note. Try its controls, return to a section through the outline, and delete it whenever you no longer need it. Your own notes will take its place.

:::callout{title="The whole workflow" tone="tip"}
**Copy the LearnMD prompt → use it with your materials in an external LLM → import the result → read and practice.** LearnMD does not call a model or generate answers itself. ChatGPT, Claude, and Gemini are examples of external tools you can use.
:::

## Create your first note

Start with one manageable chapter or lesson. A focused source is easier to verify than a whole course generated at once. The sequence below is interactive: use the next-step control to follow it.

::::steps{title="From your materials to your library"}
:::step{title="1. Prepare a useful input"}
Choose slides, a PDF excerpt, an exercise sheet, or your existing notes. Decide what the new note should help you do: explain an idea, solve a type of problem, or compare approaches. Tell the model what you already know and where you get stuck. For a topic without source material, state the topic, intended level, and learning goal clearly.
:::

:::step{title="2. Copy the generation prompt"}
Open **Generate notes** in the sidebar, then choose **Copy prompt**. This copies LearnMD's format instructions and teaching guidance. Use the full prompt: asking for ordinary Markdown alone does not tell a model how to build LearnMD's interactive components.
:::

:::step{title="3. Work in your external LLM"}
Paste the prompt into ChatGPT, Claude, Gemini, or another tool you already use. Add your materials using the file or text input available there. If a tool cannot read a file, supply relevant text excerpts instead. Ask for one complete LearnMD document, with explanations before exercises and feedback that explains the reasoning. Check factual claims and worked answers against your materials.
:::

:::step{title="4. Import and inspect"}
Copy the generated document, return to LearnMD, and choose **Add note → Paste source**. Alternatively, save the output as a .learn.md file and use **Import files**; .md files are accepted too. Review validation messages, then choose **Import & open**. A valid format is a structural check, not a guarantee that the teaching or answers are correct.
:::
::::

The generation prompt is written in English regardless of the interface language. It asks the model to write notes in the language of your materials unless you request another language explicitly. You can therefore use a Polish interface with English course materials, or ask for Polish explanations of an English source.

## Give the model a clear learning task

Switch between these examples and adapt the wording to your own work. You do not need to write component syntax yourself: the copied prompt supplies that contract.

::::tabs{title="Three useful starting points"}
:::tab{title="Slides or a PDF"}
> Turn the attached lecture material into a self-contained LearnMD chapter for someone meeting the topic for the first time. Define the notation, connect the slides into an argument, and distinguish what the source states from any added explanation. Include worked examples and a short carousel of questions.

Slides often omit the reasoning spoken aloud in a lecture. Ask the model to flag missing assumptions and unclear diagrams rather than inventing what a lecturer meant. If the document is long, identify the pages or section you want to study first.
:::

:::tab{title="An exercise set"}
> Use these exercises to teach the methods behind them. Introduce the relevant ideas, then show a worked solution in steps. Give hints before revealing answers, and add a fresh practice problem that uses the same method. Explain common errors.

Decide whether you want full solutions immediately or a chance to attempt each task first. Ask for a mixture of questions: one answer, several correct answers, a short completion, matching, and reasoning in your own words.
:::

:::tab{title="Notes or a topic"}
> Build a LearnMD note about [topic] for [my level]. My goal is to [specific task]. Use my notes below, identify gaps, and organize the explanation around the ideas I need to understand. Finish with a few questions that test application, not just vocabulary.

A concrete goal helps more than “make this detailed.” For example, “help me decide when a linear model is appropriate” gives the explanation a purpose. Tell the model when you want examples, sources, or a different language.
:::
::::

## Read, try, and follow up

Use the outline to move between sections. Tabs let you choose a perspective; steps reveal a sequence; a carousel holds several questions or explanations without making a long page. Try an answer before checking it. Feedback is there to help you revise your reasoning.

LearnMD also displays mathematical notation. For example, a short study session with three five-minute parts lasts

$$
T=3\times 5\,\mathrm{min}=15\,\mathrm{min}.
$$

The formula is authored text, not an executable calculation. A note can combine notation such as $T$ with explanations, proofs, code, diagrams, and exercises. Use **Component guide** when you want to see what the format can express.

:::reveal{label="What should I do when an explanation is unclear?"}
Use **Copy source** above the note to copy the whole original document. For a smaller context, select the relevant text and use the floating **Copy source** button. It copies the original selected blocks, including formatting and formulas, rather than only their visible text. Paste that context into your LLM and ask a specific follow-up: “Which assumption justifies this step?” is easier to answer usefully than “I do not understand.”
:::

The note body is read-only in LearnMD. To correct or expand it, revise the source externally, then import it again. Choose **Replace existing note…** and select the exact saved note you want to update. Choose **New note** when you want a separate note and wish to keep the earlier version. Renaming a note changes its library label, not its source.

Answers and scratchpad work are temporary working state. They stay in place while you move between carousel slides in the open note, but they are not saved assessment records. Reloading or reopening a note can reset them. Your library copies, favorites, and reading position are saved locally.

## Try the workflow through six small decisions

These are practical situations you may encounter in LearnMD. Use the carousel's arrows or slide selector, and check the explanations after answering. You can return to an earlier slide without losing its current answer.

::::::carousel{title="A little practice before your first import"}
:::::slide{title="1. Choose the next step"}
::::quiz{title="Your LLM has produced a document" explanation="Add note imports the generated source into this browser's library. LearnMD does not pull responses from an external chat automatically."}
You copied the generation prompt into an external LLM and received a complete .learn.md document. What should you do next?

:::choice{correct="true"}
Open Add note, paste the document, review validation, and import it.
:::
:::choice{correct="false"}
Wait for LearnMD to retrieve the conversation automatically.
:::
:::choice{correct="false"}
Paste the document into the library search field.
:::
::::
:::::

:::::slide{title="2. Prepare for a new device"}
::::quiz{title="Keep the whole library" multiple="true" explanation="A library export includes notes, folders, favorites, and bundled images. Keep the exported file somewhere you can reach from the new device, then restore it there. A URL or an open chat does not transfer browser storage."}
You want to move your notes and their bundled images to another computer. Which actions are useful? Select both.

:::choice{correct="true"}
Use Settings → Export library.
:::
:::choice{correct="true"}
Keep that backup file and restore it in LearnMD on the other computer.
:::
:::choice{correct="false"}
Save only the site's address; the address contains the notes.
:::
:::choice{correct="false"}
Leave the external LLM conversation open so it can synchronize the library.
:::
::::
:::::

:::::slide{title="3. Save a generated file"}
:::fill-blank{title="Complete the filename" answer="learn.md|.learn.md" placeholder="The extension after chapter"}
The conventional filename for the generated document is chapter.______. Enter the LearnMD extension described above. A plain .md file is also accepted when its contents are valid.
:::
:::::

:::::slide{title="4. Match the action to its purpose"}
::::match{title="Use the right control"}
:::pair{left="Add note" right="Import a generated document into this library"}
:::
:::pair{left="Copy source" right="Give an external LLM the original formatted context"}
:::
:::pair{left="Export library" right="Back up notes, folders, and bundled images"}
:::
:::pair{left="Rename a note" right="Change the library label while retaining its source"}
:::
::::
:::::

:::::slide{title="5. Recover from a format error"}
:::question{title="The import reports an error" answer="Keep the original output, copy the reported error and the relevant source into your external LLM, and request a corrected LearnMD document. Paste the revision into Add note, check validation again, and inspect the imported explanation."}
Your generated note contains a component with a missing required property. The import button is disabled. How can you repair the document without treating the validation message as a learning-content answer?
:::
:::::

:::::slide{title="6. Plan your own first note"}
:::scratchpad{title="A useful request starts with a goal"}
Write a topic or source you already have, one thing you want to understand, and one task you want to be able to perform. Use these three points with the generation prompt. This scratch space is temporary, so copy anything you want to keep.
:::
:::::
::::::

## Make the library yours

There are no predefined subject folders. Create a folder when it helps you find your own material, choose an icon, and add subfolders if you need them. You can rename folders and move notes through their management dialogs. Search works across note titles and content; favorites keep useful chapters close at hand.

Deleting a folder moves its notes and subfolders into its parent rather than deleting them. Deleting a note removes that local copy and its bundled images after confirmation. **You may delete this guide in exactly the same way**, using its trash action in the library. It is not required for the application to work.

## Keep a copy you control

Your library lives in this browser, on this site's origin. Another browser, computer, or a development URL has a separate library. LearnMD does not synchronize through an account. Clearing site data can remove local notes, so use **Settings → Export library** for a portable backup and keep the downloaded file somewhere useful.

Restore adds new copies instead of replacing existing notes. A library backup carries bundled images; exporting one note's source does not. If a note uses local images, import its containing folder with the image files so relative paths can be resolved. External images require your permission to load and need a connection.

After a complete first visit to the production site, the application can reopen offline. Saved notes and bundled images remain available; external links and remote resources still need the network. Offline access is convenient, but it is not a backup.

:::summary{title="One good place to begin"}
Choose a small source and a clear learning goal. Copy the generation prompt, work in your preferred external LLM, then import and check the result. Use the interactions to think actively, use source copying to ask better follow-up questions, and export your library before you depend on a single browser to keep it.
:::
`;
