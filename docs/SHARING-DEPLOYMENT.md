# Udostępnianie LearnMD: uruchomienie i limity

Udostępniona notatka lub folder jest kopią z momentu utworzenia linku. Paczka JSON wraz z obrazkami trafia do **prywatnego Cloudflare R2**. Worker obsługuje API, a pojedynczy SQLite Durable Object przechowuje identyfikatory, daty, hashe tokenów usuwania oraz liczniki limitów. Treść notatek pozostaje w R2; SQL nie jest bazą bibliotek użytkowników.

**Link działa przez dokładnie 7 × 24 godziny od czasu serwera.** API sprawdza termin przy każdym pobraniu, także po odczycie z R2. Po terminie zwraca `410`; po usunięciu paczki może zwrócić `404`. Wyłączenie linku blokuje kolejne pobrania. Już pobrane i zaimportowane kopie pozostają u odbiorców.

## Co trzeba przygotować

Potrzebne jest konto Cloudflare właściciela projektu na **Workers Free**, z SQLite Durable Objects, prywatnym R2 **Standard** i darmowym Turnstile. Darmowy budżet konta R2 należy przeznaczyć dla tej aplikacji; najprościej użyć osobnego konta bez innych obciążeń R2. Odbiorcy i autorzy notatek nie zakładają kont.

Stan na 13 października 2026: właściciel potwierdził **Workers Free** w panelu **Workers Plans**. Na koncie `3d7e8dd107ff9e6b10a826103baab744` działa API `https://learnmd-sharing.wierzbinski9.workers.dev` oraz prywatny bucket `learnmd-shares`, Standard, `weur`. Potwierdzono wyłączony publiczny adres r2.dev, brak domen bucketa i aktywną regułę wygaszania `shares/` po 7 dniach. Wersja Workera po zapisie sekretu: `d3c99438-344d-4840-bacb-aebc2ed4d487`.

Istniejący widget `0x4AAAAAAFV584jGr4TxXSOx` zawiera hostname `vende11s.github.io`; zachowano `clearance_level=no_clearance`. Aplikacja wymaga `action=share-upload`. Po wyraźnym potwierdzeniu właściciela sekret pobrano wyłącznie do pamięci, sprawdzono przez Siteverify i zapisano jako `TURNSTILE_SECRET` w produkcyjnym Workerze. Lista sekretów potwierdziła obecność tego wiązania. Publiczny URL API i site key są zapisane w `.env.production` i jako wartości zapasowe w CI.

Sprawdzenia produkcyjnego API potwierdziły sesję `201`, preflight `204` dla właściwego Origin, `Cache-Control: no-store`, odrzucenie obcego Origin oraz błędnego tokenu Turnstile (`403 challenge_failed`, także przy ponowieniu). Test sekretu przez Siteverify zwrócił oczekiwane `invalid-input-response`, bez `invalid-input-secret`. **Frontend udostępniania nie jest jeszcze opublikowany na GitHub Pages. Test z prawdziwym poprawnym tokenem, odrzucenie jego ponownego użycia oraz pełne utworzenie/import/wyłączenie linku pozostają do wykonania po publikacji.**

Nie należy wysyłać haseł ani tokenów na czacie. Publiczne wartości dla aplikacji to URL Workera oraz Turnstile **site key**; Turnstile **secret key** trafia wyłącznie do sekretów Workera.

## Lokalne uruchomienie bez konta Cloudflare

Z katalogu głównego repozytorium:

```powershell
npm ci --prefix worker
npm run dev --prefix worker
```

Worker startuje pod `http://127.0.0.1:8787`; R2 i SQLite są emulowane lokalnie przez Wrangler. W drugim terminalu skonfiguruj plik `.env.local` aplikacji:

```dotenv
VITE_SHARE_API_URL=http://127.0.0.1:8787
VITE_SHARE_DEV_BYPASS=true
```

Uruchom `npm run dev`. Lokalnie dozwolone są dokładne origins `localhost` i `127.0.0.1` z portami 5173, 4173 i 5183. Bypass Turnstile wymaga jednocześnie konfiguracji `ENVIRONMENT=local`, lokalnego adresu Workera, lokalnego Origin oraz nagłówka `X-Turnstile-Token: local-development`. Frontend dodatkowo dopuszcza go wyłącznie w trybie developerskim. Wdrożenie konfiguracji `local` na publiczny adres nie włącza tego obejścia.

Kontrole bez logowania:

```powershell
npm run typecheck --prefix worker
npm test --prefix worker
npm run deploy:dry-run --prefix worker
```

Testy uruchamiają prawdziwy lokalny runtime workerd, R2 i SQLite; nie korzystają z zasobów produkcyjnych. `deploy:dry-run` tylko buduje pakiet.

Pełne testy aplikacji uruchomisz z katalogu głównego przez `npm test`, a przeglądarkowy scenariusz udostępniania przez `npm run test:sharing`. `npm run build` sprawdza typy i przygotowuje frontend produkcyjny.

## Wdrożenie

Polecenia poniżej uruchamiaj z `C:\Users\vende\Desktop\dev\LearnMD`. Używają zatwierdzonego Wranglera **4.150.0**, zainstalowanego poza projektem. Do operacji na sekretach nie używaj `npx`, skryptów npm ani binariów z repozytorium. Procedura opisuje odtworzenie konfiguracji; przy kolejnych wdrożeniach zachowaj istniejące zasoby i sekret, pomijając ich tworzenie oraz ponowny transfer.

1. Sprawdź logowanie i konto; odnów OAuth tylko w razie potrzeby. Plan sprawdzisz w **Workers Plans**. Pozostaw **Workers Free**; nie włączaj Workers Paid ani innych płatnych usług. Sprawdź, czy inne aplikacje nie zużywają darmowego budżetu R2.

   ```powershell
   $LearnMdWrangler = 'C:\Users\vende\AppData\Roaming\npm\wrangler.cmd'
   & $LearnMdWrangler login
   & $LearnMdWrangler whoami
   ```

2. Użyj istniejącego bucketa `learnmd-shares` na koncie `3d7e8dd107ff9e6b10a826103baab744`; nie twórz drugiego. Pozostaw go prywatnym, bez publicznego `r2.dev`, domeny ani Workera omijającego kontrolę API. R2 nie potrzebuje publicznego CORS. Sprawdź lifecycle i dodaj regułę tylko wtedy, gdy jeszcze jej nie ma:

   ```powershell
   & $LearnMdWrangler r2 bucket lifecycle list learnmd-shares --config .\worker\wrangler.jsonc
   & $LearnMdWrangler r2 bucket lifecycle add learnmd-shares learnmd-shares-seven-days shares/ --expire-days 7 --config .\worker\wrangler.jsonc
   ```

   Ponownie sprawdź listę reguł. Prefiks `shares/` ma być usuwany po 7 dniach; nie konfiguruj przejścia do Infrequent Access.

3. Użyj **istniejącego widgetu** o site key `0x4AAAAAAFV584jGr4TxXSOx`. Odczytana [oficjalna instrukcja Turnstile dla istniejącego widgetu](https://developers.cloudflare.com/turnstile/spin/prompt.md) opisuje bezpieczne przeniesienie jego sekretu do Workera; nie wymaga tworzenia kolejnego widgetu. Sprawdź hostname `vende11s.github.io`, zachowaj zastane ustawienia clearance i nie rotuj klucza. Konfiguracja aplikacji oczekuje `action=share-upload`, `ALLOWED_ORIGINS=https://vende11s.github.io` i `TURNSTILE_HOSTNAMES=vende11s.github.io`.

4. Wdróż Worker **najpierw bez sekretu**. Upload pozostanie zablokowany do czasu poprawnej konfiguracji Turnstile:

   ```powershell
   & $LearnMdWrangler deploy --name learnmd-sharing --config .\worker\wrangler.jsonc
   ```

   Migracja `new_sqlite_classes` utworzy SQLite Durable Object. Zachowaj klasę `ShareCoordinator`, jej namespace i nazwę obiektu `admission-v1` przy kolejnych wdrożeniach; ich zmiana nie przenosi istniejących liczników. Zapisz rzeczywisty URL z wyniku wdrożenia.

5. Przed pobraniem lub zapisem sekretu sprawdź listę sekretów **istniejącego, dokładnie wskazanego Workera**:

   ```powershell
   & $LearnMdWrangler secret list --name learnmd-sharing --config .\worker\wrangler.jsonc
   ```

   Polecenie pokazuje nazwy, nie wartości. Nie nadpisuj istniejącego `TURNSTILE_SECRET` bez świadomej decyzji. Zgodnie z oficjalnym przepływem przedstaw właścicielowi poniższy zakres i uzyskaj wyraźne potwierdzenie przed odczytem klucza widgetu oraz zapisem sekretu:

   | Pole | Cel |
   | --- | --- |
   | Konto | `3d7e8dd107ff9e6b10a826103baab744` |
   | Site key / hostname | `0x4AAAAAAFV584jGr4TxXSOx` / `vende11s.github.io` |
   | Katalog projektu | `C:\Users\vende\Desktop\dev\LearnMD` |
   | Zatwierdzony CLI | `C:\Users\vende\AppData\Roaming\npm\wrangler.cmd`, wersja `4.150.0` |
   | Worker / konfiguracja | `learnmd-sharing` / `worker/wrangler.jsonc` |
   | Środowisko / sekret | produkcyjne, bez `--env local` / `TURNSTILE_SECRET` |

   Przy automatycznym transferze odpowiedź JSON z odczytu widgetu pozostaje wyłącznie w pamięci: sprawdź site key, hostname, zachowanie clearance i niepusty sekret, zweryfikuj klucz przez Siteverify z testowym tokenem, a następnie przekaż sam sekret na standardowe wejście zatwierdzonego `secret put`. Nie zapisuj go do argumentów procesu, zmiennych środowiskowych, plików, logów ani czatu. Lokalny ręczny zapis korzysta z interaktywnego wejścia tego samego polecenia:

   ```powershell
   & $LearnMdWrangler secret put TURNSTILE_SECRET --name learnmd-sharing --config .\worker\wrangler.jsonc
   ```

6. Publiczny URL `https://learnmd-sharing.wierzbinski9.workers.dev` oraz site key są już w `.env.production` i wartościach zapasowych CI. Zmienne GitHub **Settings → Secrets and variables → Actions → Variables → VITE_SHARE_API_URL / VITE_TURNSTILE_SITE_KEY** są opcjonalnymi nadpisaniami. Ich usunięcie przywraca wartości zapasowe. Nie ustawiaj `VITE_SHARE_DEV_BYPASS` na produkcji i nigdy nie dodawaj sekretu do `VITE_*`.

7. Zbuduj i opublikuj frontend, a dopiero potem potwierdź działanie produkcyjne: utworzenie linku, podgląd w innej przeglądarce, import i wyłączenie linku. Błędny token Turnstile oraz `429` sprawdzaj także lokalnie. Dla miesięcznego bezpiecznika ustaw lokalnie `R2_WRITES_MONTH=1`: po jednym linku nowe sesje, uploady i pobrania mają być zablokowane, a wyłączenie linku przez autora nadal dostępne.

## Miesięczny bezpiecznik darmowego budżetu

Serwer dopuszcza najwyżej **10 000 prób zapisu R2 i 100 000 prób odczytu R2 na miesiąc kalendarzowy UTC**, przy najwyżej **4 GiB** przechowywanych paczek i rezerwacji. Wartości `R2_WRITES_MONTH`, `R2_READS_MONTH` oraz `STORAGE_BYTES_LIMIT` pozwalają tylko obniżyć te granice. Próba konfiguracji większej wartości blokuje operacje zamiast wyłączać zabezpieczenie.

Po wykorzystaniu któregoś miesięcznego licznika albo odmowie przyjęcia paczki przekraczającej limit magazynu serwer zapamiętuje blokadę do **1. dnia następnego miesiąca o 00:00 UTC**. Ostatnia operacja mieszcząca się w budżecie może się zakończyć. Nowe tokeny przeglądarki, tworzenie linków i pobieranie paczek otrzymują `429 monthly_limit` z `resetAt` (czas UNIX w milisekundach) oraz `Retry-After`. Aplikacja pokazuje datę wznowienia, zapamiętuje blokadę dla danego adresu API i nie ponawia tych żądań do tego czasu, również po odświeżeniu strony. Po terminie użytkownik może ponowić operację; nie ma automatycznych uploadów.

Blokada dotyczy udostępniania przez sieć. Lokalne notatki, import plików i już zaimportowane kopie działają dalej. Autor nadal może wyłączyć link, a sprzątanie wygasłych paczek działa w tle. Zwolnienie przestrzeni ani ponowne wdrożenie nie zdejmują blokady w bieżącym miesiącu. Zmiana miesiąca nie zeruje zajętości magazynu; jeśli nadal jest pełny, upload nie zostanie przyjęty. Terminy ważności istniejących linków biegną także podczas przerwy.

Każdy `put/get` jest rezerwowany atomowo w trwałym liczniku **przed** wywołaniem R2. Błędy R2, brakujący obiekt i przerwane pobranie nie oddają wykorzystanej operacji. Równoległe żądania nie mogą przekroczyć limitu. Błąd licznika zatrzymuje dostęp. Zapisy jawnie wybierają klasę `Standard`.

To celowo zachowawczy budżet aplikacji. R2 Standard obejmuje bez opłat 10 GB-miesiąc, milion operacji klasy A i 10 milionów klasy B; usuwanie obiektów jest bezpłatne. Pułapy aplikacji pozostawiają duży zapas również wtedy, gdy okres rozliczeniowy obejmuje części kilku miesięcy kalendarzowych. Stały pułap 4 GiB to około 4,3 GB, poniżej darmowego limitu przestrzeni. [Cennik R2](https://developers.cloudflare.com/r2/pricing/)

**Reset aplikacji nie jest odczytem rzeczywistego rozliczenia konta.** Okres rozliczeniowy Cloudflare zależy od cyklu subskrypcji. Workers Free oraz SQLite Durable Objects mają też limity dzienne: dostawca blokuje dalsze użycie po ich wyczerpaniu i odnawia je o północy UTC. Mogą więc przerwać usługę wcześniej niż miesięczny bezpiecznik; wtedy odpowiedź dostawcy może zastąpić komunikat aplikacji. [Okresy rozliczeniowe](https://developers.cloudflare.com/billing/manage/billable-usage/), [Workers Free](https://developers.cloudflare.com/workers/platform/limits/#daily-requests), [Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/)

Ochrona obejmuje operacje wykonywane przez tę usługę w powyższej konfiguracji. Nie jest blokadą rachunku całego konta: inne aplikacje, publiczny dostęp do bucketa, narzędzia administratora, utrata liczników lub przejście na płatny plan pozostają poza jej kontrolą. Na Workers Paid nawet żądanie odrzucone przez aplikację uruchamia rozliczany kod, dlatego ten wariant wymaga pozostania na Workers Free.

## Domyślne limity

| Operacja                | Zakres                             | Limit                                                 |
| ----------------------- | ---------------------------------- | ----------------------------------------------------- |
| Paczka                  | Całe JSON, razem z base64 obrazków | 20 MiB                                                |
| Tworzenie               | Jeden IP, burst                    | 300 prób/min                                          |
| Tworzenie               | Jedna przeglądarka, doba UTC       | 20 rozpoczętych uploadów i 100 MiB przyjętych danych  |
| Tworzenie               | Cała usługa, doba UTC              | 500 rozpoczętych uploadów i 500 MiB przyjętych danych |
| Zapisy R2               | Cała usługa, miesiąc UTC           | 10 000 prób; twarde maksimum                          |
| Przechowywanie          | Cała usługa                        | 4 GiB, łącznie z rezerwacjami uploadów                |
| Pobieranie              | Jeden IP, burst                    | 1200 żądań/min                                        |
| Pobieranie              | Jedna przeglądarka, doba UTC       | 500 prób i 1 GiB                                      |
| Pobieranie              | Cała usługa, doba UTC              | 10 000 prób i 10 GiB                                  |
| Odczyty R2              | Cała usługa, miesiąc UTC           | 100 000 prób; twarde maksimum                         |
| Usuwanie                | Jeden IP, burst                    | 300 prób/min                                          |
| Nowy token przeglądarki | Jeden IP, burst                    | 600 żądań/min                                         |
| Nowy token przeglądarki | Cała usługa, doba UTC              | 10 000 tokenów                                        |
| Równoczesny upload      | Cała usługa                        | 1; pozostałe otrzymują `429` i `Retry-After: 5`       |

MiB/GiB to jednostki binarne. Limit paczki obejmuje narzut JSON i base64; obrazki o łącznym rozmiarze 15 MiB mogą przekroczyć go po zakodowaniu. Limity wpisów: 500 notatek, 500 folderów, 1000 obrazków. Serwer sprawdza obwiednię i złożoność JSON; pełną walidację grafu folderów, Markdown i obrazków wykonuje klient przed podglądem i importem.

Minutowe limity używają Cloudflare Rate Limiting API. Są **lokalne dla centrum Cloudflare i przybliżone**; nie stanowią twardego limitu kosztu. Dzienne limity i rezerwacja przestrzeni są atomowe w jednym Durable Object i obowiązują globalnie. Wyłączenie lub błąd licznika blokuje operację zamiast pomijać kontrolę. IP jest pobierany z nagłówka ustawianego przez Cloudflare i służy tylko do minutowej ochrony oraz weryfikacji Turnstile; koordynator nie otrzymuje IP. Użytkownicy uczelni i akademików mają osobne dzienne liczniki przypisane do tokenów przeglądarek. Nadal dzielą wysoki limit minutowy IP i budżet całej usługi.

Przy pierwszym tworzeniu lub otwarciu linku klient pobiera anonimowy token przez `POST /session`. Serwer zwraca `{ token }`: losowy identyfikator z podpisem HMAC-SHA256, w formacie `v1.<identyfikator>.<podpis>`. Token jest zapamiętywany w `localStorage` osobno dla każdego adresu API, a gdy zapis przeglądarki jest niedostępny — w pamięci bieżącej strony. Kolejne uploady i pobrania przekazują go w nagłówku `X-Share-Client`. Token nie wygasa samodzielnie i nie daje dostępu do prywatnej biblioteki ani uprawnienia do usuwania linków. Koordynator używa identyfikatora do dziennego licznika, bez tabeli sesji; klucz podpisu pozostaje w trwałych metadanych Durable Object. Usunięcie linku wymaga wyłącznie osobnego sekretu autora, również po wyczerpaniu limitów klienta lub wydawania tokenów.

To identyfikator przeglądarki, **nie gwarancja limitu na osobę**: wyczyszczenie danych, inny profil albo ręczne pobranie nowego tokenu tworzą nowy licznik. Podpis blokuje samodzielne fałszowanie identyfikatorów, ale nie zastępuje Turnstile i limitów globalnych. Wydawanie tokenów nie wymaga CAPTCHA, aby odbiorcy mogli otworzyć notatkę bez dodatkowego kroku. Jego globalny limit chroni zasoby; po wyczerpaniu nowe przeglądarki muszą poczekać do kolejnej doby UTC, a istniejące tokeny nadal działają. Resetowanie tożsamości może wyczerpać ten budżet, więc nie jest to pełna ochrona przed celowym przeciążaniem usługi.

Wartości `UPLOADS_PER_CLIENT_DAY`, `UPLOAD_BYTES_PER_CLIENT_DAY`, `READS_PER_CLIENT_DAY` i `READ_BYTES_PER_CLIENT_DAY` sterują limitami jednej przeglądarki; `SESSIONS_GLOBAL_DAY` steruje wydawaniem tokenów. Dzienne limity pozostają dodatkową ochroną rozłożenia ruchu. Ich zmiana nie zwiększa twardych miesięcznych pułapów operacji ani maksymalnej przestrzeni.

Po weryfikacji Turnstile przyjęcie uploadu zużywa próbę **przed odczytem treści**. Niepoprawny JSON, zbyt duży strumień i timeout również zużywają próbę. Bajty są rozliczane podczas przyjęcia poprawnej paczki; awaria zapisu nie oddaje dziennego budżetu, żeby wielokrotne awarie nie pozwalały ominąć limitu. Odmowy z powodu zajętego slotu albo już pełnego magazynu nie rozpoczynają uploadu. Utrata połączenia po zapisie może pozostawić niedostarczony autorowi link; taka paczka nadal podlega terminowi i sprzątaniu.

Żądania pobrania brakujących identyfikatorów również zużywają dzienny licznik prób. Budżet bajtów pobierania jest rezerwowany przed odczytem R2; przerwane pobranie go nie zwraca. Usunięcie ma osobny limiter i nadal działa po wyczerpaniu limitu pobierania. `429` zawiera nagłówek `Retry-After` (sekundy) oraz JSON `{ error, message, retryAfter }`. Dzienne limity resetują się o północy UTC; aplikacja pokazuje czas oczekiwania z odpowiedzi serwera.

Turnstile w produkcji jest sprawdzany po stronie serwera wraz z hostname oraz action; sprawdzenie Origin jest dodatkowym zabezpieczeniem przeglądarki. Sam CORS nie stanowi uwierzytelnienia klienta i nie zastępuje Turnstile ani liczników. Usuwanie wymaga 256-bitowego tajnego tokenu autora; serwer przechowuje tylko SHA-256 tokenu. Publiczne identyfikatory mają 192 bity losowości. Token autora nie jest częścią linku odbiorcy.

## Wygaśnięcie, sprzątanie i eksploatacja

Odczyty omijają Cache API, zwracają `Cache-Control: no-store` i wymagają aktywnego rekordu koordynatora. Nie dodawaj reguły CDN cache dla API. Sprawdzenie `now >= expiresAt` natychmiast kończy ważność linku, niezależnie od tego, kiedy R2 fizycznie usunie plik.

Alarm Durable Object sprząta wygasłe/niedokończone/revoked paczki oraz stare liczniki dzienne. Nie usuwa miesięcznego budżetu ani jego blokady. Działa co godzinę, a przy zaległościach po 20 paczek na minutę; po błędzie R2 próbuje ponownie po 5 minutach. Zajętość magazynu spada dopiero po potwierdzonym usunięciu R2. Lifecycle po 7 dniach jest drugim mechanizmem porządkowania; jego wykonanie może być opóźnione. Dzienny limit 500 MiB ogranicza normalną retencję 7-dniową do około 3,5 GiB. Próba przekroczenia pułapu 4 GiB zatrzyma udostępnianie do kolejnego miesiąca, jeśli sprzątanie będzie opóźnione. Obejmuje wyłącznie obiekty tworzone przez tę usługę; nie zapisuj do tego prefiksu innymi narzędziami.

Duże JSON-y są odczytywane z twardym limitem strumienia i czasem 30 sekund, bez zaufania do `Content-Length`. Walidacja odbywa się w Durable Object, aby nie wykonywać parsowania 20 MiB w 10-ms budżecie CPU Workera Free. Jeden buforowany upload i ograniczenia zagnieżdżenia/liczby elementów JSON ograniczają zużycie pamięci. Pobrania są strumieniowane. Lokalna emulacja nie dowodzi wydajności produkcyjnej; sprawdź dużą reprezentatywną paczkę po wdrożeniu.

Po uruchomieniu obserwuj zużycie konta, błędy 429/503, czas CPU i zajętość R2. W razie awarii liczników najpierw napraw dostępność istniejącego namespace, zamiast tworzyć nowy i zerować księgowanie. Jeśli namespace utracono, odłącz udostępnianie do czasu ponownego rozliczenia istniejących paczek i budżetu operacji w okresie rozliczeniowym. Samo usunięcie obiektów nie zeruje operacji naliczonych już przez Cloudflare.

Źródła Cloudflare: [Rate Limiting — locality i accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [SQLite i transakcje Durable Objects](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [plany i limity Durable Objects](https://developers.cloudflare.com/durable-objects/platform/limits/), [R2 lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [weryfikacja Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
