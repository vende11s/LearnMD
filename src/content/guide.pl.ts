export const polishGuideSource = String.raw`---
version: "1.0"
title: "Pierwsze kroki z LearnMD"
description: "Zamień własne materiały w przejrzyste, interaktywne notatki i urządź bibliotekę po swojemu."
subject: "Na początek"
author: "LearnMD"
tags: [guide, workflow]
---

# Pierwsze kroki z LearnMD

Dobra notatka pozwala coś zrozumieć, samodzielnie spróbować i sprawdzić tok rozumowania. LearnMD łączy te elementy w spokojnym miejscu do nauki. Ty wybierasz materiał: slajdy z wykładu, rozdział PDF, zestaw zadań, robocze notatki albo po prostu temat, który chcesz poznać.

Ten przewodnik jest Twoją pierwszą zwykłą notatką. Wypróbuj jego elementy, wróć do wybranego fragmentu przez spis treści i usuń go, kiedy przestanie być potrzebny. Jego miejsce zajmą Twoje własne notatki.

:::callout{title="Cały proces w jednym zdaniu" tone="tip"}
**Skopiuj prompt LearnMD → użyj go z materiałami w zewnętrznym LLM-ie → zaimportuj wynik → czytaj i ćwicz.** LearnMD sam nie wywołuje modelu i nie generuje odpowiedzi. ChatGPT, Claude i Gemini to przykłady zewnętrznych narzędzi, z których możesz skorzystać.
:::

## Utwórz pierwszą notatkę

Zacznij od jednego rozdziału lub tematu. Łatwiej zweryfikować opracowanie niewielkiego materiału niż całego kursu wygenerowanego naraz. Poniższa instrukcja jest interaktywna: przechodź do kolejnych kroków przyciskiem nawigacji.

::::steps{title="Od materiałów do własnej biblioteki"}
:::step{title="1. Przygotuj materiał i cel"}
Wybierz slajdy, fragment PDF, listę zadań albo dotychczasowe notatki. Określ, w czym nowa notatka ma pomóc: wyjaśnić pojęcie, nauczyć rozwiązywania pewnego typu zadań czy porównać metody. Powiedz modelowi, co już wiesz i gdzie pojawiają się trudności. Jeśli zaczynasz od samego tematu, podaj go wraz z poziomem i konkretnym celem nauki.
:::

:::step{title="2. Skopiuj prompt do generowania"}
Otwórz **Generuj notatki** w panelu bocznym, a następnie wybierz **Kopiuj prompt**. Skopiujesz instrukcję formatu LearnMD i wskazówki dotyczące uczenia. Użyj całego promptu: sama prośba o zwykły Markdown nie mówi modelowi, jak przygotować interaktywne elementy LearnMD.
:::

:::step{title="3. Pracuj w zewnętrznym LLM-ie"}
Wklej prompt do ChatGPT, Claude, Gemini lub innego narzędzia, którego już używasz. Dołącz materiały jako pliki albo tekst, zależnie od możliwości tego narzędzia. Jeśli nie odczytuje ono danego pliku, wklej potrzebne fragmenty tekstu. Poproś o jeden kompletny dokument LearnMD z wyjaśnieniami przed ćwiczeniami oraz informacją zwrotną objaśniającą rozumowanie. Porównaj fakty i rozwiązania z materiałem źródłowym.
:::

:::step{title="4. Zaimportuj i sprawdź wynik"}
Skopiuj wygenerowany dokument, wróć do LearnMD i wybierz **Dodaj notatkę → Wklej źródło**. Możesz też zapisać wynik jako plik .learn.md i wybrać **Importuj pliki**; przyjmowane są również pliki .md. Przejrzyj komunikaty walidacji, a potem wybierz **Importuj i otwórz**. Poprawny format potwierdza strukturę dokumentu, ale nie gwarantuje poprawności wyjaśnień ani odpowiedzi.
:::
::::

Prompt do generowania jest napisany po angielsku niezależnie od języka interfejsu. Prosi model o notatki w języku dostarczonych materiałów, chyba że wyraźnie wskażesz inny. Możesz więc korzystać z polskiego interfejsu i angielskich materiałów albo poprosić o polskie wyjaśnienie angielskiego źródła.

## Daj modelowi konkretne zadanie

Przełączaj poniższe zakładki i dostosuj przykład do swoich materiałów. Nie musisz samodzielnie pisać składni komponentów: skopiowany prompt zawiera odpowiednią instrukcję.

::::tabs{title="Trzy dobre punkty wyjścia"}
:::tab{title="Slajdy lub PDF"}
> Opracuj załączony materiał z wykładu jako samodzielny rozdział LearnMD dla osoby, która poznaje ten temat po raz pierwszy. Wyjaśnij oznaczenia, połącz slajdy w spójny tok rozumowania i odróżnij informacje ze źródła od dodatkowych objaśnień. Dodaj rozwiązane przykłady i krótką karuzelę pytań.

Slajdy często pomijają rozumowanie przedstawiane ustnie na wykładzie. Poproś model o wskazanie brakujących założeń i niejasnych rysunków zamiast zgadywania intencji prowadzącego. Przy długim dokumencie wskaż strony lub rozdział, od których chcesz zacząć.
:::

:::tab{title="Zestaw zadań"}
> Wykorzystaj te zadania, żeby nauczyć mnie metod potrzebnych do ich rozwiązania. Najpierw wprowadź pojęcia, potem pokaż rozwiązany przykład w kolejnych krokach. Podaj wskazówki przed odpowiedziami i dodaj nowe zadanie do samodzielnego rozwiązania tą samą metodą. Wyjaśnij typowe błędy.

Zdecyduj, czy chcesz od razu widzieć pełne rozwiązania, czy najpierw spróbować samodzielnie. Poproś o różne ćwiczenia: pytanie z jedną odpowiedzią, kilka poprawnych odpowiedzi, uzupełnienie, dopasowanie i wyjaśnienie własnymi słowami.
:::

:::tab{title="Notatki lub temat"}
> Przygotuj notatkę LearnMD o [temacie] na [moim poziomie]. Chcę nauczyć się [konkretnej umiejętności]. Wykorzystaj moje notatki poniżej, wskaż luki i uporządkuj wyjaśnienie wokół pojęć, które muszę zrozumieć. Zakończ pytaniami sprawdzającymi zastosowanie wiedzy, nie tylko znajomość nazw.

Konkretny cel pomaga bardziej niż „opisz to szczegółowo”. Na przykład „pomóż mi rozpoznać, kiedy model liniowy jest odpowiedni” nadaje wyjaśnieniu kierunek. Wskaż też, czy potrzebujesz przykładów, źródeł albo innego języka.
:::
::::

## Czytaj, próbuj i dopytuj

Używaj spisu treści, żeby przechodzić między sekcjami. Zakładki pozwalają wybrać perspektywę, kroki odsłaniają tok rozumowania, a karuzela mieści wiele pytań lub wyjaśnień bez wydłużania całej strony. Spróbuj odpowiedzieć przed sprawdzeniem wyniku. Informacja zwrotna ma pomóc Ci skorygować rozumowanie.

LearnMD wyświetla również zapis matematyczny. Na przykład krótka sesja nauki złożona z trzech pięciominutowych części trwa

$$
T=3\times 5\,\mathrm{min}=15\,\mathrm{min}.
$$

Ten wzór jest częścią opracowania, a nie wykonywanym obliczeniem. Notatka może łączyć symbole takie jak $T$ z wyjaśnieniami, dowodami, kodem, diagramami i ćwiczeniami. Otwórz **Komponenty**, aby zobaczyć możliwości formatu.

:::reveal{label="Co zrobić, gdy wyjaśnienie jest niejasne?"}
Wybierz **Kopiuj źródło** nad notatką, żeby skopiować cały oryginalny dokument. Jeśli potrzebujesz mniejszego kontekstu, zaznacz odpowiedni tekst i użyj pływającego przycisku **Kopiuj źródło**. Kopiuje on źródło zaznaczonych bloków wraz z formatowaniem i wzorami, a nie tylko widoczny tekst. Wklej kontekst do swojego LLM-a i zadaj konkretne pytanie. „Które założenie uzasadnia ten krok?” zwykle prowadzi do przydatniejszej odpowiedzi niż samo „nie rozumiem”.
:::

Treść notatki w LearnMD jest tylko do odczytu. Żeby ją poprawić lub rozbudować, zmień źródło poza aplikacją i zaimportuj je ponownie. Wybierz **Zastąp istniejącą notatkę…** i wskaż dokładnie tę zapisaną notatkę, którą chcesz zaktualizować. Wybierz **Nowa notatka**, gdy chcesz osobną notatkę i zachowanie wcześniejszej wersji. Zmiana tytułu notatki dotyczy nazwy w bibliotece, nie jej źródła.

Odpowiedzi i brudnopis są tymczasowym stanem ćwiczeń. Pozostają na miejscu podczas przechodzenia między slajdami otwartej notatki, ale nie tworzą zapisanych wyników nauki. Odświeżenie lub ponowne otwarcie notatki może je wyzerować. Kopie notatek, ulubione i miejsce czytania są zapisywane lokalnie.

## Przećwicz sześć małych decyzji

Poniżej znajdziesz sytuacje, które mogą pojawić się podczas pracy z LearnMD. Używaj strzałek lub wyboru slajdu i po odpowiedzi przeczytaj uzasadnienie. Możesz wrócić do wcześniejszego slajdu bez utraty bieżącej odpowiedzi.

::::::carousel{title="Krótka próba przed pierwszym importem"}
:::::slide{title="1. Wybierz kolejny krok"}
::::quiz{title="LLM przygotował dokument" explanation="Dodaj notatkę zapisuje wygenerowane źródło w bibliotece tej przeglądarki. LearnMD nie pobiera automatycznie odpowiedzi z zewnętrznego czatu."}
Prompt został użyty w zewnętrznym LLM-ie, który zwrócił kompletny dokument .learn.md. Co należy teraz zrobić?

:::choice{correct="true"}
Otworzyć Dodaj notatkę, wkleić dokument, sprawdzić walidację i zaimportować go.
:::
:::choice{correct="false"}
Poczekać, aż LearnMD sam pobierze rozmowę.
:::
:::choice{correct="false"}
Wkleić dokument w pole wyszukiwania notatek.
:::
::::
:::::

:::::slide{title="2. Przygotuj się na zmianę urządzenia"}
::::quiz{title="Zachowaj całą bibliotekę" multiple="true" explanation="Eksport biblioteki zawiera notatki, foldery, ulubione i dołączone obrazy. Zachowaj plik w miejscu dostępnym na drugim urządzeniu i tam go przywróć. Sam adres strony lub otwarty czat nie przenosi danych przeglądarki."}
Chcesz przenieść notatki razem z dołączonymi obrazami na inny komputer. Które działania są przydatne? Wybierz oba.

:::choice{correct="true"}
Wybrać Ustawienia → Eksportuj bibliotekę.
:::
:::choice{correct="true"}
Zachować plik kopii i przywrócić go w LearnMD na drugim komputerze.
:::
:::choice{correct="false"}
Zapisać tylko adres strony, ponieważ zawiera on notatki.
:::
:::choice{correct="false"}
Zostawić otwartą rozmowę z LLM-em, aby zsynchronizowała bibliotekę.
:::
::::
:::::

:::::slide{title="3. Zapisz wygenerowany plik"}
:::fill-blank{title="Uzupełnij nazwę pliku" answer="learn.md|.learn.md" placeholder="Rozszerzenie po słowie rozdzial"}
Zwyczajowa nazwa wygenerowanego dokumentu to rozdzial.______. Wpisz opisane wyżej rozszerzenie LearnMD. Zwykły plik .md również jest akceptowany, jeśli jego zawartość jest poprawna.
:::
:::::

:::::slide{title="4. Dopasuj działanie do celu"}
::::match{title="Wybierz właściwe narzędzie"}
:::pair{left="Dodaj notatkę" right="Zaimportuj wygenerowany dokument do tej biblioteki"}
:::
:::pair{left="Kopiuj źródło" right="Przekaż LLM-owi oryginalny kontekst z formatowaniem"}
:::
:::pair{left="Eksportuj bibliotekę" right="Zabezpiecz notatki, foldery i dołączone obrazy"}
:::
:::pair{left="Zmień tytuł notatki" right="Zmień nazwę w bibliotece, zachowując jej źródło"}
:::
::::
:::::

:::::slide{title="5. Popraw błąd formatu"}
:::question{title="Import zgłasza błąd" answer="Zachowaj pierwotny wynik, skopiuj komunikat błędu i odpowiedni fragment źródła do zewnętrznego LLM-a, a następnie poproś o poprawiony dokument LearnMD. Wklej nową wersję do Dodaj notatkę, ponownie sprawdź walidację i oceń zaimportowane wyjaśnienie."}
W wygenerowanej notatce jeden komponent nie ma wymaganej właściwości. Przycisk importu jest nieaktywny. Jak naprawić dokument, pamiętając, że komunikat walidacji dotyczy formatu, a nie poprawności merytorycznej?
:::
:::::

:::::slide{title="6. Zaplanuj własną pierwszą notatkę"}
:::scratchpad{title="Dobra prośba zaczyna się od celu"}
Zapisz temat lub materiał, który już masz, jedną rzecz, którą chcesz zrozumieć, i jedno zadanie, które chcesz umieć wykonać. Użyj tych trzech punktów razem z promptem do generowania. Ten brudnopis jest tymczasowy, więc skopiuj wszystko, co chcesz zachować.
:::
:::::
::::::

## Urządź bibliotekę po swojemu

Nie ma tu gotowych folderów tematycznych. Utwórz folder, kiedy pomoże Ci odnaleźć własne materiały, wybierz ikonę i w razie potrzeby dodaj podfoldery. Okna zarządzania pozwalają zmieniać nazwy folderów i przenosić notatki. Wyszukiwanie obejmuje tytuły i treść, a ulubione ułatwiają powrót do przydatnych rozdziałów.

Usunięcie folderu przenosi jego notatki i podfoldery do folderu nadrzędnego zamiast je kasować. Usunięcie notatki po potwierdzeniu usuwa tę lokalną kopię i dołączone do niej obrazy. **Ten przewodnik możesz usunąć dokładnie tak samo**, korzystając z ikony kosza przy notatce w bibliotece. Nie jest potrzebny do działania aplikacji.

## Zachowaj kopię pod własną kontrolą

Biblioteka znajduje się w tej przeglądarce, pod adresem tej strony. Inna przeglądarka, komputer lub adres wersji deweloperskiej ma osobną bibliotekę. LearnMD nie synchronizuje danych przez konto. Wyczyszczenie danych strony może usunąć lokalne notatki, dlatego korzystaj z **Ustawienia → Eksportuj bibliotekę** i zachowuj pobrany plik w odpowiednim miejscu.

Przywracanie dodaje nowe kopie zamiast zastępować istniejące notatki. Kopia biblioteki zawiera dołączone obrazy; eksport samego źródła jednej notatki ich nie zawiera. Jeśli dokument korzysta z lokalnych obrazów, zaimportuj zawierający go folder razem z plikami graficznymi, aby aplikacja mogła odnaleźć ścieżki względne. Obrazy zewnętrzne wymagają zgody na wczytanie i połączenia z siecią.

Po pełnej pierwszej wizycie w opublikowanej aplikacji można otworzyć ją bez internetu. Zapisane notatki i dołączone obrazy pozostają dostępne; zewnętrzne łącza i zasoby nadal wymagają sieci. Dostęp offline jest wygodny, ale nie zastępuje kopii zapasowej.

:::summary{title="Dobry początek"}
Wybierz niewielki materiał i konkretny cel. Skopiuj prompt do generowania, popracuj w wybranym zewnętrznym LLM-ie, a następnie zaimportuj i sprawdź wynik. Korzystaj z interakcji, żeby aktywnie myśleć, kopiuj źródło, żeby lepiej dopytywać, i eksportuj bibliotekę, zanim powierzysz jedynej przeglądarce wszystkie swoje notatki.
:::
`;
