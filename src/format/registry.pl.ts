import type { ComponentDefinition } from './registry';

/** Reader-facing help only. The registry, generated source, and LLM prompt stay in English. */
export const COMPONENT_DESCRIPTIONS_PL: Readonly<Record<string, string>> = {
  columns: 'Kolumny, które na wąskich ekranach układają się jedna pod drugą.',
  grid: 'Elastyczna siatka do prezentowania powiązanych treści.',
  stack: 'Układaj bloki pionowo lub poziomo.',
  card: 'Grupuje niewielką ilość powiązanych treści.',
  section: 'Sekcja tematyczna z opcjonalnym nagłówkiem.',
  divider: 'Subtelny separator między zagadnieniami.',
  tabs: 'Przełączaj się między powiązanymi ujęciami tematu za pomocą zakładek.',
  carousel:
    'Ręcznie przewijana seria slajdów z dowolną treścią Markdown i interaktywnymi komponentami. Pozwala wygodnie przeglądać długie zestawy pytań, bez automatycznego przewijania.',
  accordion: 'Niezależnie rozwijane objaśnienia.',
  'split-view': 'Porównaj dwa powiązane panele obok siebie.',
  comparison: 'Nazwane warianty przedstawione z jednakowym wyróżnieniem.',
  definition: 'Precyzyjna definicja pojęcia.',
  theorem: 'Numerowane twierdzenie matematyczne.',
  lemma: 'Lemat wspierający dalsze rozumowanie.',
  example: 'Konkretny przykład z rozwiązaniem.',
  counterexample:
    'Przykład pokazujący, dlaczego zbyt szerokie uogólnienie jest fałszywe.',
  callout: 'Dodatkowa uwaga związana z omawianym zagadnieniem.',
  warning: 'Ważne założenie, zagrożenie lub częsty błąd.',
  intuition: 'Intuicyjne wyjaśnienie pomagające wyobrazić sobie pojęcie.',
  summary: 'Krótkie podsumowanie najważniejszych myśli.',
  proof:
    'Rozwijany dowód. Zagnieżdżone kroki pozwalają stopniowo śledzić rozumowanie.',
  steps: 'Odsłaniaj uporządkowane rozumowanie krok po kroku.',
  derivation:
    'Wyprowadzenie matematyczne prezentowane stopniowo, z objaśnieniami.',
  reveal: 'Rozwijana odpowiedź lub dodatkowe wyjaśnienie.',
  hint: 'Pokaż wskazówkę przed pełnym rozwiązaniem.',
  layers:
    'Ręcznie przełączaj się między nazwanymi wyjaśnieniami, np. ujęciem intuicyjnym i formalnym.',
  variants: 'Wybieraj spośród alternatywnych wyjaśnień lub metod.',
  branch: 'Wybierz dalszą ścieżkę wyjaśnienia.',
  spotlight: 'Skup uwagę na jednym nazwanym fragmencie naraz.',
  annotated: 'Nazwane adnotacje odsłaniają objaśnienia kontekstowe.',
  question: 'Pytanie do przemyślenia z odpowiedzią, którą można odsłonić.',
  quiz: 'Wybierz jedną lub kilka odpowiedzi i sprawdź wyjaśnienie wyniku.',
  'fill-blank':
    'Sprawdza krótką odpowiedź tekstową, domyślnie pomijając wielkość liter oraz spacje na początku i końcu.',
  match: 'Dopasuj każde pojęcie po lewej stronie do objaśnienia po prawej.',
  sort: 'Ułóż elementy w logicznej kolejności określonej przez autora, korzystając także z klawiatury.',
  predict: 'Zapisz przewidywanie przed odsłonięciem wyniku.',
  scenario: 'Poznaj przygotowane scenariusze bez uruchamiania kodu.',
  'decision-tree':
    'Przechodź przez kolejne decyzje. Węzły zawierają objaśnienia i dostępne dalsze wybory.',
  checklist: 'Zaznaczaj wykonane kroki bez zmieniania treści dokumentu.',
  scratchpad:
    'Tymczasowe miejsce na własne obliczenia i rozumowanie. Nie zmienia źródła notatki.',
  flowchart: 'Schemat przepływu z nazwanymi krokami i rozgałęzieniami.',
  architecture: 'Elementy systemu wraz z opisanymi zależnościami.',
  sequence: 'Uporządkowane komunikaty między nazwanymi uczestnikami.',
  timeline: 'Wydarzenia ułożone chronologicznie, z objaśnieniami.',
  tree: 'Rozwijana hierarchia zbudowana z zagnieżdżonych bloków item.',
  graph: 'Sieć węzłów, które można wybierać, oraz opisanych połączeń.',
  'state-machine':
    'Wybieraj stany i przechodź między nimi za pomocą nazwanych przejść.',
  process: 'Numerowany proces z etapami, które można wybierać.',
  'concept-map': 'Mapa pojęć z opisanymi relacjami i wybieranymi węzłami.',
  'image-annotation':
    'Umieść dostępne z klawiatury znaczniki objaśnień na dołączonym lub jawnie załadowanym obrazie.',
  formula: 'Numerowany wzór z możliwością skopiowania kodu LaTeX.',
  'equation-system': 'Wyrównany układ równań.',
  code: 'Przykład kodu z kolorowaniem składni i możliwością kopiowania.',
  'code-walkthrough':
    'Przechodź przez objaśnienia, które wyróżniają odpowiednie wiersze kodu.',
  'code-diff': 'Porównanie kodu przed zmianą i po zmianie, obok siebie.',
  'data-table':
    'Tabela z możliwością sortowania, zapisana standardową składnią GFM.',
  'symbol-glossary':
    'Słownik symboli i ich znaczeń z możliwością wyszukiwania.',
  reference: 'Przejdź do oznaczonego identyfikatorem miejsca w tym dokumencie.',
  prerequisites: 'Krótka lista pojęć, które warto znać przed lekturą.',
  embed:
    'Bezpieczny odnośnik do zasobu zewnętrznego albo odtwarzacz dźwięku lub filmu uruchamiany przez użytkownika.',
  sync: 'Współdzieli wybraną pozycję między zagnieżdżonymi krokami, zakładkami, karuzelami, warstwami, wariantami i blokami spotlight.',
  variable:
    'Deklaruje tekstową zmienną wspólną dla dokumentu, z jednoznaczną wartością początkową.',
  conditional: 'Pokazuje treść, gdy zadeklarowana zmienna ma podaną wartość.',
  toggle: 'Przełącza zadeklarowaną zmienną między dwiema podanymi wartościami.',
  popover: 'Rozwijane objaśnienie kontekstowe obsługiwane myszą i klawiaturą.',
  step: 'Jeden etap wyjaśnienia odsłanianego krok po kroku.',
  tab: 'Jedna nazwana zakładka wewnątrz bloku tabs.',
  layer: 'Jedna nazwana warstwa wyjaśnienia wewnątrz bloku layers.',
  variant: 'Jeden nazwany wariant wewnątrz bloku variants.',
  option: 'Jedna nazwana ścieżka wewnątrz bloku branch.',
  case: 'Jeden nazwany przypadek wewnątrz bloku scenario.',
  panel: 'Jeden nazwany panel wewnątrz bloku split-view.',
  slide:
    'Jedna strona karuzeli. Opcjonalny tytuł nazywa stronę, a jej treść może zawierać tekst, wzory, pytania, quizy i inne pasujące komponenty.',
  item: 'Nazwany element listy, hierarchii lub rozwijanego objaśnienia.',
  annotation: 'Objaśnienie kontekstowe lub znacznik na obrazie.',
  choice: 'Jedna odpowiedź do wyboru w quizie.',
  pair: 'Jedna para elementów do dopasowania.',
  node: 'Węzeł diagramu, który można wybrać. Identyfikator obowiązuje tylko w obrębie tego diagramu.',
  edge: 'Opisane połączenie między węzłami tego samego diagramu.',
  participant: 'Nazwany uczestnik diagramu sekwencji.',
  message: 'Jeden komunikat w uporządkowanej sekwencji.',
  event: 'Jedno wydarzenie na osi czasu, opatrzone datą.',
  before: 'Wersja kodu przed zmianą w porównaniu.',
  after: 'Wersja kodu po zmianie w porównaniu.',
  term: 'Symbol, krótkie znaczenie i opcjonalne rozwinięcie objaśnienia.',
  symbol: 'Inna nazwa bloku term: symbol i jego znaczenie.',
  answer: 'Pełna odpowiedź na pytanie, zapisana w Markdown.',
};

export const ATTRIBUTE_DESCRIPTIONS_PL: Readonly<Record<string, string>> = {
  'Unique semantic ID, beginning with a letter.':
    'Unikatowy identyfikator rozpoczynający się literą.',
  'Optional visible title.': 'Widoczny tytuł.',
  'Preferred number of columns; alias of count.':
    'Preferowana liczba kolumn; inna nazwa właściwości count.',
  'Preferred number of columns.': 'Preferowana liczba kolumn.',
  'Preferred column count.': 'Preferowana liczba kolumn.',
  'Stack direction.': 'Kierunek układania elementów.',
  'Initial zero-based tab index.': 'Początkowa zakładka, liczona od zera.',
  'Initial zero-based slide index. Default: 0.':
    'Początkowy slajd, liczony od zera. Domyślnie: 0.',
  'Open all items initially.':
    'Czy wszystkie elementy mają być początkowo rozwinięte.',
  'Visual emphasis.': 'Sposób wizualnego wyróżnienia.',
  'Expand the proof initially.': 'Czy dowód ma być początkowo rozwinięty.',
  'Initial zero-based step index.': 'Początkowy krok, liczony od zera.',
  'Text of the disclosure control.': 'Tekst przycisku odsłaniającego treść.',
  'Disclosure label.': 'Etykieta przycisku odsłaniającego treść.',
  'Initial zero-based layer.': 'Początkowa warstwa, liczona od zera.',
  'Initial zero-based variant.': 'Początkowy wariant, liczony od zera.',
  'Question text shown before the body.':
    'Tekst pytania wyświetlany przed główną treścią.',
  'Short answer; longer explanation can be nested in an answer block.':
    'Krótka odpowiedź; dłuższe wyjaśnienie można umieścić w zagnieżdżonym bloku answer.',
  'Allow several correct choices.':
    'Czy pytanie dopuszcza kilka poprawnych odpowiedzi.',
  'Feedback after checking.':
    'Wyjaśnienie wyświetlane po sprawdzeniu odpowiedzi.',
  'Match letter case exactly.':
    'Czy przy sprawdzaniu uwzględniać wielkość liter.',
  'Expected answer.': 'Oczekiwana odpowiedź.',
  'Input hint.': 'Podpowiedź w polu odpowiedzi.',
  'Question shown above the prediction area.':
    'Pytanie wyświetlane nad polem przewidywania.',
  'Outcome to reveal.': 'Wynik, który zostanie odsłonięty.',
  'Initial node ID; alias of start.':
    'Identyfikator węzła początkowego; inna nazwa właściwości start.',
  'Initial node ID.': 'Identyfikator węzła początkowego.',
  'Prompt inside the working area.': 'Podpowiedź w obszarze na własne notatki.',
  'Display directed connections.': 'Czy pokazywać kierunek połączeń.',
  'Initial state ID.': 'Identyfikator stanu początkowego.',
  'Safe relative asset path or HTTPS URL.':
    'Bezpieczna względna ścieżka do pliku albo adres HTTPS.',
  'Accessible description.':
    'Opis alternatywny dla osób korzystających z czytnika ekranu.',
  'Optional equation label.': 'Własna etykieta równania.',
  'Optional equation label; otherwise numbered automatically.':
    'Własna etykieta równania; bez niej numer nadawany jest automatycznie.',
  'Syntax language, such as javascript or python.':
    'Język kolorowania składni, np. javascript lub python.',
  'Allow sorting by column headers.':
    'Czy kliknięcie nagłówka kolumny umożliwia sortowanie.',
  'ID of a component or the generated heading slug.':
    'Identyfikator komponentu lub automatycznie utworzony identyfikator nagłówka.',
  'Link text.': 'Tekst odnośnika.',
  'Resource kind; alias of type.':
    'Rodzaj zasobu; inna nazwa właściwości type.',
  'HTTPS resource URL.': 'Adres HTTPS zasobu.',
  'Resource link text.': 'Tekst odnośnika do zasobu.',
  'Resource kind.': 'Rodzaj zasobu.',
  'Document-scoped synchronization group.':
    'Nazwa grupy synchronizacji wspólnej dla dokumentu.',
  'Unique variable name.': 'Unikatowa nazwa zmiennej.',
  'Initial string value.': 'Początkowa wartość tekstowa.',
  'Declared variable name.': 'Nazwa zadeklarowanej zmiennej.',
  'Exact string value to compare.':
    'Dokładna wartość tekstowa, z którą porównywana jest zmienna.',
  'Value when enabled. Default: true.':
    'Wartość po włączeniu. Domyślnie: true.',
  'Value when disabled. Default: false.':
    'Wartość po wyłączeniu. Domyślnie: false.',
  'Control label.': 'Etykieta przełącznika.',
  'Short secondary explanation.': 'Krótkie dodatkowe objaśnienie.',
  'Code line numbers or ranges, such as 1,3-5.':
    'Numery wierszy kodu lub ich zakresy, np. 1,3-5.',
  'Optional semantic reference or heading slug.':
    'Odwołanie do identyfikatora komponentu lub nagłówka.',
  'Initial checked state.': 'Czy element ma być początkowo zaznaczony.',
  'Optional item value.': 'Wartość przypisana do elementu.',
  'Annotation trigger text.': 'Tekst przycisku otwierającego adnotację.',
  'Horizontal marker position, in percent.':
    'Poziome położenie znacznika w procentach.',
  'Vertical marker position, in percent.':
    'Pionowe położenie znacznika w procentach.',
  'Whether this choice is correct.': 'Czy ta odpowiedź jest poprawna.',
  'Left concept.': 'Pojęcie po lewej stronie.',
  'Matching concept.': 'Pasujące pojęcie.',
  'Unique ID within the containing diagram.':
    'Unikatowy identyfikator w obrębie danego diagramu.',
  'Default next node.': 'Domyślny następny węzeł.',
  'Next node for a yes answer.': 'Następny węzeł po odpowiedzi twierdzącej.',
  'Next node for a no answer.': 'Następny węzeł po odpowiedzi przeczącej.',
  'Visible node name.': 'Widoczna nazwa węzła.',
  'Brief node explanation.': 'Krótkie objaśnienie węzła.',
  'Optional horizontal coordinate.': 'Współrzędna pozioma.',
  'Optional vertical coordinate.': 'Współrzędna pionowa.',
  'Origin node ID.': 'Identyfikator węzła początkowego połączenia.',
  'Destination node ID.': 'Identyfikator węzła docelowego połączenia.',
  'Relationship or transition label.': 'Etykieta relacji lub przejścia.',
  'Unique ID within this sequence.':
    'Unikatowy identyfikator w obrębie tej sekwencji.',
  'Visible participant name.': 'Widoczna nazwa uczestnika.',
  'Sender participant ID.': 'Identyfikator nadawcy.',
  'Receiver participant ID.': 'Identyfikator odbiorcy.',
  'Message text.': 'Treść komunikatu.',
  'Date or period label.': 'Data lub nazwa okresu.',
  'Symbol or technical term.': 'Symbol lub termin specjalistyczny.',
  'Concise meaning.': 'Krótkie objaśnienie znaczenia.',
};

export function componentDescriptionPL(
  component: Pick<ComponentDefinition, 'name' | 'description'>,
): string {
  return COMPONENT_DESCRIPTIONS_PL[component.name] ?? component.description;
}

export function componentPropertiesPL(
  component: ComponentDefinition,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(component.attributes).map(([name, attribute]) => [
      name,
      `${attribute.required ? 'Wymagane.' : 'Opcjonalne.'} ${ATTRIBUTE_DESCRIPTIONS_PL[attribute.description] ?? attribute.description}${attribute.values ? ` Dozwolone wartości: ${attribute.values.join(', ')}.` : ''}${attribute.number ? ` ${attribute.integer ? 'Liczba całkowita' : 'Liczba'} od ${attribute.number[0]} do ${attribute.number[1]}.` : ''}`,
    ]),
  );
}
