export const polishGuideSource = String.raw`---
version: "1.0"
title: "Pierwsze kroki z LearnMD"
description: "Trzy kroki. Cztery krótkie zadania. Teraz Ty."
subject: "Na początek"
author: "LearnMD"
tags: [guide, workflow]
---

# Pierwsze kroki z LearnMD

**Zamień materiały w notatki, które można klikać.** Wystarczą slajdy, PDF, zadania albo sam temat.

## Zrób pierwszą notatkę

::::steps{title="Od tematu do notatki"}
:::step{title="Skopiuj"}
Otwórz **Generuj notatki → Kopiuj prompt**.
:::

:::step{title="Zapytaj LLM-a"}
Wklej prompt do ChatGPT, Claude lub Gemini. Dodaj materiały i napisz, co chcesz zrozumieć. Sam LearnMD nie wysyła zapytań do AI.
:::

:::step{title="Zaimportuj"}
Wybierz **Dodaj notatkę → Wklej źródło**, wklej wynik i kliknij **Importuj i otwórz**. Możesz też zaimportować plik .learn.md. Sprawdź odpowiedzi z materiałami.
:::
::::

Notatki powstają w języku materiałów, chyba że poprosisz o inny.

## Teraz Ty

Pizza ma cztery równe kawałki. Jeden kawałek to ćwiartka:

$$
\frac{1}{4}=25\%
$$

:::reveal{label="Szybki sposób na dodawanie ułamków"}
Sprowadź je do wspólnego mianownika: $\frac{1}{2}+\frac{1}{4}=\frac{2}{4}+\frac{1}{4}=\frac{3}{4}$.
:::

Spróbuj czterech zadań. Przechodź między nimi strzałkami.

::::::carousel{title="Sprawdź się"}
:::::slide{title="Wybierz jedną"}
::::quiz{title="Ile pizzy?" explanation="Połowa to dwie ćwiartki. Dodaj jedną ćwiartkę: razem trzy ćwiartki."}
Zjadasz pół pizzy, a potem jeszcze ćwiartkę. Ile to razem?

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

:::::slide{title="Wybierz dwie"}
::::quiz{title="Więcej niż połowa" multiple="true" explanation="Trzy ćwiartki i cała pizza to więcej niż połowa. Jedna ćwiartka to mniej."}
Które porcje są większe niż 1/2? Zaznacz obie.

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

:::::slide{title="Uzupełnij"}
:::fill-blank{title="Z ułamka na procenty" answer="25|25%" placeholder="Wpisz liczbę"}
Jeden z czterech równych kawałków to ______% pizzy.
:::
:::::

:::::slide{title="Połącz w pary"}
::::match{title="Tyle samo, innymi słowami"}
:::pair{left="1/4" right="Jedna ćwiartka"}
:::
:::pair{left="1/2" right="Jedna połowa"}
:::
:::pair{left="3/4" right="Trzy ćwiartki"}
:::
::::
:::::
::::::

Odpowiedzi w ćwiczeniach zostają, dopóki notatka jest otwarta. Więcej możliwości znajdziesz w **Komponentach**.

## Po swojemu

- **Coś niejasne?** Wybierz **Kopiuj źródło** nad notatką lub zaznacz fragment. Wklej go do LLM-a i dopytaj o ten krok.
- **Zachowaj kopię:** notatki są na tym urządzeniu, bez synchronizacji z chmurą. Użyj **Ustawienia → Eksportuj bibliotekę**.
- **Gotowe?** Twórz własne foldery, a ten przewodnik usuń ikoną kosza.
`;
