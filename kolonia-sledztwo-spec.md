# KOLONIA — Specyfikacja trybu ŚLEDZTWO

**Wersja:** 1.3 · **Status:** do implementacji · **Zastępuje:** tryb Klasyczny

---

## 1. Zasada gry

Fikcja = zasady, jedno zdanie w tutorialu:

> *Sakiewka na informatorów: 10 bryłek rudy. Im mniej wydasz na ujęcie zbiega, tym więcej zdobędziesz doświadczenia. Pomyłki też kosztują.*

Gracz dostaje **list gończy** z zakrytymi informacjami o poszukiwanej postaci. Zakup wskazówki kosztuje bryłki z sakiewki, błędne wskazanie kosztuje bryłkę, a **nagrodą za ujęcie jest doświadczenie liczone z pozostałych bryłek** (§2.4): im oszczędniejsze śledztwo, tym więcej XP. Brak stanu porażki: przy 0 bryłek list odsłania się w całości (łącznie ze zdjęciem), a wskazywanie jest darmowe do skutku — ujęcie daje wtedy tylko bazowe XP.

Rdzeń decyzyjny trybu:
- **niedobór** — suma cen (11) > budżet (10), nie da się kupić wszystkiego, więc każdy zakup to wybór;
- **koszt pudła** — „strzelam przy 70% pewności czy dopłacam za potwierdzenie?" to rachunek opłacalności, nie loteria.

---

## 2. Ekonomia

| Parametr | Wartość |
|---|---|
| Budżet dzienny | **10 bryłek** (stały — kalibrujemy cenami, nigdy budżetem) |
| Koszt pudła | **1 bryłka** |
| Suma cen zakupów | **11** (inwariant: zawsze > budżet, walidowane w buildzie) |

### 2.1 Pola i ceny

| Pole | Cena | Uzasadnienie |
|---|---|---|
| Obóz | 0 — odkryte od startu | zawiązka dnia, uczy interfejsu przez przykład, diegetycznie część nagłówka listu |
| Gildia / rola | 2 | tnie pulę wewnątrz obozu |
| Lokacja | 2 | silna; często koreluje z obozem — świadomie bez korekty (nauka meta) |
| Pierwsza litera imienia | 2 | „wyrównywacz" dla nie-ekspertów; synergia z autouzupełnianiem → cena zaporowa |
| Nauczyciel (czego uczy) | 1 | loteria — dla większości postaci „—" |
| Handel (czym handluje) | 1 | loteria — dla większości postaci „—" |
| Cytat | 3 | najbliżej unikalności; domyka dzień każdemu graczowi |

### 2.2 Inwarianty ekonomii

1. Suma cen pól płatnych > budżet (11 > 10).
2. Stan bryłek nigdy < 0 — pudło przy stanie 1 sprowadza do 0 i uruchamia pełne odsłonięcie.
3. Odkryte pole nie pobiera opłaty ponownie (idempotencja — ochrona przed double-tapem).
4. Przycisk PRZEKUP nieaktywny, gdy cena > aktualny stan.

### 2.3 Świadome decyzje projektowe (nie ruszać bez danych z telemetrii)

- **Zdjęcie poza ekonomią.** Kupowalne wyostrzanie dominowałoby strategię (twarz identyfikuje pewniej niż atrybuty) — pokazujemy je wyłącznie jako nagrodę po wygranej i przy spadku do zera.
- **Bez wyrównywania wartości informacji.** Ekspert wyciśnie z lokacji więcej niż casual — ta asymetria to głębia, nie bug.
- **Bez auto-odsłaniania pól implikowanych.** Odkrycie „lokacja zawiera obóz" to nauka meta i powód do porównywania ścieżek.
- **Ceny jednolite dla wszystkich postaci.** Diego da medianę 8/10, anonimowy kopacz 3/10 — rytm dni łatwych i trudnych jest zamierzony; porównania w share dzieją się w obrębie dnia, więc się normalizują.

### 2.4 Doświadczenie (XP) — wynik dnia

Ruda jest **budżetem** dnia, doświadczenie jest **wynikiem**:

```
XP dnia = xpBase + xpPerNugget × pozostałe bryłki
        = 50 + 100 × n          (zakres 50–1050)
```

- `xpBase = 50` — dzień ukończony przy pustej sakiewce musi być odróżnialny od dnia porzuconego (retencja), ale nie może konkurować z oszczędnym śledztwem.
- Miarą porównań i histogramu pozostają **bryłki 0–10**; XP jest ich funkcją afiniczną, więc osobny histogram XP niczego nie wnosi.
- **XP sumuje się dożywotnio** (`totalXp`) i wyznacza **poziom łowcy**: próg awansu `l → l+1` = `500 × l` (kumulatywnie 500 / 1500 / 3000 / 5000…). Przy medianie ~5 bryłek: poziom 5 około 10. dnia, poziom 10 około 40. — tempo naturalnie maleje jak w RPG.
- Poziom w v1 jest czysto prestiżowy: widoczny w statystykach i na ekranie wygranej. Tytuły poziomów — §15.

---

## 3. Przebieg dnia — maszyna stanów

```
START  (obóz odkryty, 10 bryłek, status: playing)
  │
  ├── PRZEKUP(pole) ──→ stan -= cena · pole → jawne
  │
  ├── WSKAŻ(imię)
  │     ├── trafienie ──→ WYGRANA  (XP z aktualnego stanu bryłek — §2.4, status: won)
  │     └── pudło ──────→ stan -= 1 · imię na listę skreśleń
  │
  └── stan == 0 ──→ AUTO-ODSŁONIĘCIE (wszystkie pola + zdjęcie)
                    wskazywanie darmowe, bez limitu ──→ WYGRANA (bazowe XP)
```

Stan „wyzerowany" nie jest osobnym statusem — wyprowadzany z `nuggets === 0 && status === 'playing'`.

---

## 4. Pola — definicje i kontrakt wartości

**Migawka kanoniczna świata: Rozdział 1 Gothic 1** (stan zastany na starcie gry) — to ona rozstrzyga postaci, które w późniejszych rozdziałach zmieniają lokację albo rolę. Rozstrzygnięcia kuratorskie w `data-src/npc.csv` są źródłem prawdy i mają pierwszeństwo przed wiki.

| Pole | Wartość | Uwagi |
|---|---|---|
| Obóz | słownik istniejący (Stary Obóz / Nowy Obóz / Obóz na Bagnach) | zawsze jawne |
| Gildia / rola | słownik istniejący (Cień, Strażnik, Kopacz, Mag Ognia, Najemnik, Nowicjusz, Guru, Mag Wody…) | |
| Lokacja | słownik istniejący regionów | wg migawki kanonicznej |
| Nauczyciel | lista umiejętności, których NPC uczy, albo `—` | np. „walka mieczem, siła" |
| Handel | asortyment albo `—` | np. „broń, zbroje" |
| Cytat | z `quotes.json` po `npcId`, bez atrybucji | reużycie danych trybu Cytat |
| Pierwsza litera | pochodna imienia kanonicznego | zero nowych danych |

- Pole puste po zakupie renderuje **`—`** — to pełnoprawna odpowiedź na pytanie, nie błąd; koszt bezzwrotny (element loterii, patrz 2.1).
- Kolumna **„przyjaciel" — wycofana** (subiektywna, generator sporów).
- **7 wierszy (1 darmowy + 6 płatnych)**; strop układu przy 360 px to 8 — jest zapas na dokładnie jedno pole, gdyby telemetria pokazała taką potrzebę.

---

## 5. Zgadywanie

- Input z **autouzupełnianiem ograniczonym do rosteru**; dopasowanie bez rozróżniania diakrytyków i wielkości liter.
- **Submit aktywny wyłącznie dla pozycji z listy** — literówka fizycznie nie może kosztować bryłki.
- Imiona już skreślone: wyszarzone/ukryte na liście podpowiedzi, ponowne wskazanie zablokowane (bez kosztu).
- Pudło: −1 bryłka, imię dopisane jako przekreślone na marginesie listu.
- Przy `nuggets === 0`: wskazania darmowe, bez limitu prób.

---

## 6. UI — minimalizm, reużycie istniejących komponentów karty

Szkielet 360 px (pergamin + typografia bez zmian względem obecnej karty):

```
┌ LIST GOŃCZY  №20 ─────────────────┐
│  Zbiegł z: Starego Obozu          │
│                                   │
│         ┌─────────┐               │
│         │    ?    │  ← placeholder│
│         └─────────┘               │
│                                   │
│  SAKIEWKA   ●●●●●●●●○○            │
│                                   │
│  GILDIA      [ PRZEKUP · 2 ]      │
│  LOKACJA     [ PRZEKUP · 2 ]      │
│  1. LITERA   [ PRZEKUP · 2 ]      │
│  NAUCZYCIEL  [ PRZEKUP · 1 ]      │
│  HANDEL      [ PRZEKUP · 1 ]      │
│  CYTAT       [ PRZEKUP · 3 ]      │
│                                   │
│  ~~Diego~~  ~~Mud~~               │
├───────────────────────────────────┤
│  → wpisz imię zbiega   [ WSKAŻ ]  │  ← sticky
└───────────────────────────────────┘
```

Elementy:
- **Nagłówek:** `LIST GOŃCZY №{n}` + wiersz `Zbiegł(a) z: {obóz}` — darmowy obóz jest diegetycznie częścią listu, nie „polem za 0".
- **Portret w trakcie gry:** statyczny placeholder „?" (własne SVG w stylu drzeworytu). Pełne zdjęcie wyłącznie po wygranej lub przy zerze.
- **Sakiewka:** 10 bryłek pełna/pusta, czysty CSS, bez licznika liczbowego. To budżet, nie wynik — XP pojawia się dopiero na ekranie wygranej.
- **Wiersz pola:** `ETYKIETA — wartość` (po odkryciu) albo przycisk `PRZEKUP · {cena}` z glifem bryłki (tym samym co w sakiewce) — czasownik i cena razem niosą poczucie wydatku; cena zawsze widoczna na przycisku, to jedyna ochrona przed „przypadkowym zakupem" (żadnych hold-to-confirm).
- **Skreślenia** pod polami, w linii, przekreślone.
- **Sticky dół:** input + `WSKAŻ` (adaptacja obecnego komponentu ZGADNIJ) — odkrywanie i wskazywanie to fizycznie osobne strefy ekranu.
- **Wygrana:** statyczny stempel `UJĘTY` (czysty CSS: rotate + kolor ceglasty), pełne zdjęcie, komplet pól, linia `+{xp} XP` (przy awansie dodatkowo `POZIOM {l}`), przycisk share, histogram wyników 0–10.
- **Animacje: zero obowiązkowych.** Dopuszczalny pojedynczy CSS fade przy odkryciu pola. Opcjonalnie `navigator.vibrate(15)` przy odkryciu/pudle.

### 6.1 i18n (propozycje — do akceptacji)

| Klucz | PL | EN | DE |
|---|---|---|---|
| zakładka | ŚLEDZTWO | MANHUNT | FAHNDUNG |
| nagłówek karty | LIST GOŃCZY | WANTED | STECKBRIEF |
| sakiewka | SAKIEWKA | PURSE | BEUTEL |
| przycisk zakupu | PRZEKUP | BRIBE | BESTECHEN |
| przycisk wskazania | WSKAŻ | ACCUSE | ANKLAGEN |
| stempel wygranej | UJĘTY | CAPTURED | GEFASST |
| doświadczenie | DOŚWIADCZENIE | EXPERIENCE | ERFAHRUNG |
| placeholder inputu | wpisz imię zbiega… | name the fugitive… | Name des Flüchtigen… |

Etykiety pól: OBÓZ/CAMP/LAGER · GILDIA/GUILD/GILDE · LOKACJA/LOCATION/ORT · NAUCZYCIEL/TEACHER/LEHRER · HANDEL/TRADE/HANDEL · CYTAT/QUOTE/ZITAT · 1. LITERA / 1ST LETTER / 1. BUCHSTABE.

---

## 7. Share — tekstowy, bez spoilerów

```
KOLONIA · ŚLEDZTWO №20
🪨 6/10 · 🔍 3 · ❌ 1
kolonia.app
```

- 🪨 = wynik (pozostałe bryłki), 🔍 = liczba kupionych wskazówek, ❌ = pudła.
- **Bez nazw odkrytych pól** — ścieżka gracza to spoiler strategii dnia.
- Tytuł trybu lokalizowany; format spójny z istniejącymi share'ami pozostałych trybów.
- XP celowo poza share'em: to funkcja bryłek (zero nowej informacji), a `🪨 6/10` jest czytelne także dla odbiorców spoza gry. Flaga na później, gdyby poziom łowcy miał trafić do share'a.

---

## 8. Dane i pipeline

- `npc.json` — nowe pole: `photo: "a1b2c3f0.webp"` (**hash w nazwie pliku** — imię postaci nie może być widoczne w nazwie ani URL-u). Pozostałe pola już istnieją w modelu.
- **Pula odpowiedzi ⊂ roster** (osobna lista): wymagane zdjęcie + cytat + komplet pól rdzeniowych (obóz, gildia, lokacja). Roster do zgadywania bez tych wymagań — dzięki temu „postać bez cytatu" nie jest przypadkiem brzegowym w rozgrywce, tylko ograniczeniem kuratorskim puli.
- **Zdjęcia:** webp, ~512 px dłuższy bok; preload **dopiero po wygranej albo przy zerze** (nie zdradzamy odpowiedzi w network tabie wcześniej niż to konieczne; pełnej ochrony i tak nie ma — architektura B, odpowiedzi client-side, akceptowane).
- **Źródło portretów:** zgodnie z §12 speca głównego (zakaz assetów z gry) rekomendowane stylizowane przerysy własne; użycie kadrów z gry = świadome odstępstwo właściciela projektu.
- **Losowanie dnia:** istniejący mechanizm daily (`LAUNCH_DAY` + indeks), numeracja № kontynuowana po Klasycznym.

### 8.1 Nowe walidacje w `build-data.mjs` (build pada przy błędzie)

1. Każda postać z puli odpowiedzi ma komplet: zdjęcie (plik istnieje), cytat (istnieje w `quotes.json`), pola rdzeniowe niepuste.
2. `suma cen pól płatnych > budżet` (z configu).
3. Hash w nazwie zdjęcia nie koliduje i nie zawiera fragmentów imienia.

---

## 9. Stan i storage (localStorage)

```ts
interface ManhuntState {
  day: number;              // daily index
  nuggets: number;          // 0..10
  revealed: FieldId[];      // purchased + auto-revealed
  misses: string[];         // npcIds, in order
  status: 'playing' | 'won';
  finishedAt?: string;      // ISO, won only
}
```

- Klucz: `kolonia.manhunt.v1`. Refresh / powrót w ciągu dnia = pełne odtworzenie stanu.
- Zmiana języka nie dotyka stanu — wartości pól renderowane ze słowników i18n po `id`.
- **Statystyki lokalne:** rozegrane dni, średni wynik, najlepszy wynik, seria, histogram 0–10 (odpowiednik rozkładu prób z Wordle), `totalXp`; poziom łowcy wyprowadzany z progów przy renderze — nie zapisujemy go osobno.

---

## 10. Config — jedno miejsce kalibracji

Wewnętrzny identyfikator trybu: **`manhunt`** (katalog `modes/manhunt/`). Kod, typy, eventy i klucze storage wyłącznie po angielsku — „Śledztwo", „sakiewka" i reszta polszczyzny żyją tylko w warstwie i18n (§6.1).

```ts
export const MANHUNT_CONFIG = {
  budget: 10,
  missCost: 1,
  xp: { base: 50, perNugget: 100, levelStep: 500 },
  freeFields: ['camp'] as FieldId[],   // free camp reveal, can be disabled without code changes
  fields: [
    { id: 'guild',    cost: 2 },
    { id: 'location', cost: 2 },
    { id: 'letter',   cost: 2 },
    { id: 'teacher',  cost: 1 },
    { id: 'trade',    cost: 1 },
    { id: 'quote',    cost: 3 },
  ],
} as const;
```

Kolejność w tablicy = kolejność wierszy na liście gończym.

---

## 11. Telemetria i kalibracja

Eventy (fire-and-forget do D1, jak w pozostałych trybach):

| Event | Payload |
|---|---|
| `manhunt_start` | `{ day }` |
| `manhunt_reveal` | `{ day, field, order, nuggetsAfter }` |
| `manhunt_miss` | `{ day, nuggetsAfter }` |
| `manhunt_zero` | `{ day, reveals, misses }` |
| `manhunt_win` | `{ day, score, reveals, misses, ms }` |
| `manhunt_share` | `{ day, score }` |

**Przegląd po 14 dniach. Kręcimy wyłącznie cenami — budżet 10 jest stały.**

| Metryka | Cel | Reakcja poza celem |
|---|---|---|
| Mediana wyniku dnia (w bryłkach) | 4–7 | ≥8 przez kilka dni → podnieś ceny mocnych pól; ≤2 → obniż |
| Rozkład pierwszego zakupu | brak dominanty | jedno pole otwiera >60% gier → cena +1 |
| Nadużycie litery | niski udział wygranych „litera + ≤1 inne pole" | wysoki → litera 2→3 |
| % dni zakończonych zerem | <15% | wyżej → obniż ceny loterii albo koszt pudła zostaw, ceny w dół |
| Completion / share rate | ≥ baseline Klasycznego | niżej → wracamy do rozmowy projektowej, nie do cen |

---

## 12. Migracja z Klasycznego

1. Zakładka KLASYCZNY → **ŚLEDZTWO**, badge „NOWE" przez 7 dni.
2. Stan i statystyki Klasycznego: **nieruszane pod starym kluczem** localStorage — bez migracji do statystyk Śledztwa (inna skala wyniku, mieszanie zafałszuje histogram).
3. Pierwsza wizyta: auto-otwarcie krótkiej karty „Jak grać" (one-liner fikcji z §1 + trzy punkty: wskazówki kosztują rudę, pudło kosztuje rudę, XP rośnie z każdą zaoszczędzoną bryłką). Potem dostępna pod „?".
4. Numeracja № kontynuowana — dzień się nie resetuje.

---

## 13. Przypadki brzegowe — checklista QA

- [ ] Pudło przy stanie 1 → stan 0 → auto-odsłonięcie wszystkiego łącznie ze zdjęciem, wskazywanie darmowe.
- [ ] Trafienie przy stanie 0 → wygrana, bazowe 50 XP, stempel i share działają normalnie.
- [ ] `totalXp` inkrementowane dokładnie raz per dzień; awans na progu `500 × l` → linia POZIOM na ekranie wygranej.
- [ ] Double-tap na PRZEKUP → jedna opłata (idempotencja po `revealed`).
- [ ] PRZEKUP przy cenie > stan → przycisk nieaktywny (nigdy ujemne saldo).
- [ ] Wszystkie pola kupione, brak trafienia → gra toczy się dalej na samych wskazaniach (możliwe zejście do 0 pudłami).
- [ ] Powtórne wskazanie skreślonego imienia → zablokowane w autouzupełnianiu, bez kosztu.
- [ ] Tekst spoza rosteru → submit nieaktywny, zero kosztu.
- [ ] Nauczyciel/handel puste → po zakupie `—`, koszt pobrany (by design).
- [ ] Refresh w trakcie dnia → pełne odtworzenie: bryłki, odkrycia, skreślenia, status.
- [ ] Zmiana języka w trakcie gry → etykiety i wartości w nowym języku, stan nietknięty.
- [ ] Wejście po północy → nowy dzień, czysty stan, stary wynik w statystykach.
- [ ] Postać bez cytatu/zdjęcia w rosterze → może być wskazywana, nigdy nie jest odpowiedzią (walidacja puli w buildzie).

---

## 14. Poza zakresem v1 (świadomie)

- Tryb hardcore (bez autouzupełniania) — kandydat na później, jeśli telemetria pokaże sufit trudności.
- Obrazkowy share (canvas) — tekst wystarcza, spójność z resztą trybów.
- Wyostrzanie/pikselizacja zdjęcia — zdjęcie jest nagrodą, nie mechaniką (decyzja §2.3).
- Animacje ponad pojedynczy fade.
- Liga znajomych per Śledztwo — dziedziczy z istniejącej infrastruktury, bez zmian specyficznych.

---

## 15. Otwarte pytania

1. Akceptacja stringów EN/DE z §6.1 (w szczególności ACCUSE/ANKLAGEN vs neutralne GUESS/RATEN).
2. Czy darmowy obóz zostaje po pierwszym przeglądzie telemetrii (`freeFields` pozwala wyłączyć konfigiem).
3. Potwierdzenie migawki kanonicznej: Rozdział 1 (alternatywa: Rozdział 2, jeśli kuracja lokacji okaże się łatwiejsza dla stanu po zawiązaniu fabuły).
4. Tytuły poziomów łowcy — neutralne stopnie zamiast rang obozowych (gracz w tym trybie nie deklaruje obozu); propozycje do osobnej iteracji.
