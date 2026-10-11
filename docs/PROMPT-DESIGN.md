# Generation prompt design

Decision and evidence recorded on 11 October 2026. This change reduces repeated format documentation in the generation prompt. Its effect on generated learning notes has **not** been measured in a model A/B test.

## Baseline and decision

The previous default prompt measured **57,885 Unicode characters, 7,888 words, and 1,699 lines** before adding learning materials. The full component reference accounted for **77.8%** of its characters. These are text measurements, not token counts; tokenization varies by model and language.

The revised default measures **23,559 characters, 3,035 whitespace-separated words, and 252 lines**: **59.3% fewer characters**. Both measurements use the balanced output of `buildGenerationPrompt()`; the baseline is available at commit `c6539ab`. The complete format-reference output remains unchanged. The 28,000-character regression check is a maintenance guard against accidentally reintroducing the full manual, not a claimed model context limit.

The generation prompt retains a compact schema derived from the same registry as the parser: **65 public components and 22 structural children**, including attribute types, required fields, allowed values, and child relationships. Keeping every supported component available avoids silently reducing the format to a small preferred subset.

Instead of embedding a complete worked example for every component, the prompt uses **four selective examples** to teach difficult syntax and composition: a quiz carousel, mathematics and code, a diagram, and shared state. The complete reference and working examples remain available in `docs/FORMAT.md` and the application's component guide.

The writing instruction explicitly requests concise, educationally complete notes: remove repetition and unnecessary introductions, but retain definitions, assumptions, necessary intermediate reasoning, worked examples, and qualifications. A shorter format manual is not a requirement to make every lesson short. Neither prompt nor note receives an arbitrary universal token ceiling.

## What the evidence supports

Anthropic recommends retaining the smallest sufficient instruction set and choosing diverse canonical examples instead of enumerating every edge case. It explicitly distinguishes minimal information from simply short text. This agent-design guidance supports the compact catalog and example selection as an engineering decision; it is not a benchmark of educational note generation. [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (29 September 2025).

- **Liu et al., _Lost in the Middle_ — TACL 2024; preprint first published 6 July 2023.** Multi-document question answering and key-value retrieval experiments found that the position of relevant information affected performance; information in the middle was often harder to use than information near the ends. These tasks and older model versions establish a context-use problem, not a measured penalty for LearnMD's formatting instructions. [Paper and publication metadata](https://aclanthology.org/2024.tacl-1.9/).
- **Levy, Jacoby, and Goldberg, _Same Task, More Tokens_ — ACL, August 2024; preprint first published 19 February 2024.** Controlled reasoning tasks kept the required facts and task fixed while varying input length and padding. Performance declined as inputs grew in several tested settings, including some containing repeated relevant information. The tasks were deliberately simple and the models are older; their observed lengths are not universal failure thresholds. [Paper](https://aclanthology.org/2024.acl-long.818/).
- **Hong, Troynikov, and Huber, _Context Rot_ — Chroma technical report, 14 July 2025.** Experiments spanning 18 models examined retrieval, distractors, conversational question answering, and repetition. Results varied by model and task, and focused relevant contexts outperformed full histories in its LongMemEval experiment. This is original vendor research, not a peer-reviewed LearnMD evaluation. Removing irrelevant history is also different from removing necessary format rules. [Report and experimental methods](https://www.trychroma.com/research/context-rot).

Together these findings justify testing a smaller, sufficient instruction set. They do **not** establish that shorter is always better, identify an optimal prompt length, or demonstrate a particular internal attention mechanism. Additional examples can improve compliance; removing them creates a tradeoff to evaluate.

## Ordering is model dependent

Anthropic's current Claude guidance recommends placing long documents before the query and putting the query near the end. It also recommends a small set of relevant, varied examples. [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (accessed 11 October 2026; no publication date shown).

Google similarly recommends placing the question after the context in most long-context cases and avoiding unnecessary tokens. [Gemini long-context guidance](https://ai.google.dev/gemini-api/docs/long-context) (last updated 22 June 2026).

By contrast, OpenAI's **14 April 2025** GPT-4.1 guide recommends instructions at both ends of long context, or above it when supplied only once. That guide is now marked archived and its advice is model specific. [GPT-4.1 prompting guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide).

Therefore LearnMD should not claim one ordering works best across ChatGPT, Claude, and Gemini. Keeping the format contract distinct from source materials and the requested learning task makes provider-specific ordering possible without changing the format itself.

## Proposed A/B evaluation — not run

Compare the saved full-reference baseline against the compact prompt using identical materials, task wording, language, model/version, system instructions, tools, and generation settings. Hold output and reasoning budgets constant where configurable; repeat runs when outputs are stochastic. Assess outputs without revealing the prompt variant to the reviewer.

| Case                                                          | What to check                                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Short Polish lecture notes                                    | Faithful terminology, clear explanations, no unnecessary expansion.                                  |
| Dense calculus PDF with worked proofs                         | Correct mathematics, preserved assumptions, and sufficient intermediate reasoning.                   |
| Exercise set with an answer key                               | Correct answers and explanations; valid mixed quiz types inside a carousel.                          |
| Long slides plus notes with overlapping or conflicting claims | Coverage of required concepts, restrained repetition, and explicit handling of source disagreements. |

Measure parser acceptance, rendering and interaction correctness, factual coverage against a prepared checklist, and factual errors. Judge **educationally complete conciseness** separately: omissions of necessary explanation and redundant material are different failures. Record actual input/output tokens and latency if available, without treating shorter output as success by itself.

Parser and unit tests can verify the prompt's format contract. They cannot establish that a model produces better teaching, and no such quality improvement is claimed before this evaluation.
