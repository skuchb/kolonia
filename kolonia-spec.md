# KOLONIA — Specyfikacja produktu

**Wersja:** 1.5 · **Data:** 2026-06-10 · **Status:** do realizacji
**Changelog 1.5:** architektura B (odpowiedzi w kliencie + telemetria — serwerowa walidacja zbędna przy rywalizacji wyłącznie towarzyskiej); globalna tablica punktów usunięta, punkty żyją tylko w lidze znajomych i Wojnie Obozów; Cytat = **wymiana dialogowa 1–4 linie (Bohater ↔ NPC)**, wspólne ID międzyjęzykowe z OU.csl, odpowiedź przez autocomplete z pełnej puli; start w **trzech językach (PL/EN/DE)** z data-driven kuracją kultowości; copy obozowe EN/DE neutralne do czasu przeglądu przez native'a.
**Changelog 1.1:** telemetria wyników (Worker + D1) przeniesiona z F2 do F1 — dane z tygodnia launchu są niezastępowalne; ekspozycja statystyk pozostaje w F2.
**Changelog 1.2:** Drabina (F2) zastępuje Pojedynek; Mapa przesunięta do F3; Emoji jako tryb weekendowy; Lokacja w Klasycznym zostaje — automatyzacja z rutyn dobowych (sekcja 11, krok 3b); karty-kolekcja w backlogu F4.
**Changelog 1.3:** Warstwa Obozowa (sekcja 3.5): wybór obozu w onboardingu (F1), Wojna Obozów + rangi + Kronika (F2), inwariant „ta sama zagadka dla wszystkich"; drabiny rang zweryfikowane w kanonie (Gothicpedia); etykieta „kanon: oryginał 2001" w UI.
**Changelog 1.4:** odpowiedzi server-authoritative (POST /api/guess — koniec odpowiedzi w bundlu); konta opcjonalne (nick + kod / magic-link — decyzja otwarta) z synchronizacją serii i punktów; system punktów + liga znajomych (F2); start wyłącznie PL (EN/DE → F4, słowniki od dnia 1); tryb Emoji usunięty całkowicie.
**Typ:** daily guessing game (model Loldle) w uniwersum Gothic 1
**Nazwa robocza:** KOLONIA — finalna nazwa/domena to otwarta decyzja (sekcja 15)

---

## 1. Cel i pozycjonowanie

Codzienna gra-zagadka dla fanów Gothica: ten sam zestaw zagadek dla wszystkich, reset o północy, wynik do udostępnienia jako emoji-grid. Wzorzec sprawdzony przez Wordle/Loldle/Witchdle. Slot „Gothic-dle" jest pusty (stan na 2026-06-09), a premiera Gothic 1 Remake (2026-06-05, peak ~78K CCU na Steam) otworzyła okno największego zainteresowania marką od 25 lat.

**Grupa docelowa:** fani Gothica PL/DE/EN — reaktywowani weterani (primary) i nowi gracze Remake'a (secondary). Trzy języki od premiery.
**Cel biznesowy:** zero przychodu z produktu. Wartość = portfolio, społeczność, demo silnika „daily fandom game" pod ewentualne B2B, opcja na relację z THQ Nordic.

**Non-goals (świadomie poza zakresem):**
- monetyzacja w jakiejkolwiek formie (reklamy, płatności) — patrz sekcja 12,
- **obowiązkowe** logowanie — konto jest zawsze opcjonalne; pełna gra dostępna anonimowo,
- backend ponad: telemetrię, konta, ligi i agregaty (żadnych profili publicznych, czatu, awatarów, globalnych rankingów),
- assety z gry: audio, screenshoty, logo, ripowane tekstury,
- Gothic 2/NOTR w MVP (osobny zestaw w fazie 4).

---

## 2. Fazy i zakres

| Faza | Zakres | Szacunek | Cel |
|---|---|---|---|
| **F1 — MVP** | Tryby: Klasyczny + Cytat (architektura B: odpowiedzi w kliencie, telemetria fire-and-forget). Konto opcjonalne (Google OAuth): sync serii. Percentyl dnia, wybór obozu + theming, share-grid, **3 języki (PL/EN/DE)**, dane ~120–150 NPC + 60–100 wymian dialogowych ×3 wersje | 8–10 wieczorów | Launch w oknie hype'u |
| **F2** | Tryb Drabina, **liga znajomych** (kod zaproszenia; punkty wyłącznie wewnątrz ligi i Wojny Obozów — globalnej tablicy nie ma), Wojna Obozów + rangi + Kronika, ekspozycja statystyk | 3–5 wieczorów | Druga fala (drugi post na forach) |
| **F3** | Tryb Mapa (ilustrację zamawiamy już w F1 — zależność kalendarzowa) | 2–3 wieczory | Trzecia fala |
| **F4** | Zestaw Gothic 2 / NOTR, PWA; backlog: karty-kolekcja | wg trakcji | Retencja długoterminowa |

Opcja sekwencyjna pod presję okna: launch F1 bez modułu kont (gra anonimowa + percentyl), konta jako F1.5 tydzień później — schemat D1 wspiera to od dnia 0.

Zasada: **data premiery F1 > kompletność.** Każda faza = osobny news dla community.

---

## 3. Tryby gry

Wspólne dla wszystkich trybów:
- Jedna zagadka dziennie per tryb, identyczna dla wszystkich graczy. Reset 00:00 **Europe/Warsaw**.
- Licznik do następnej zagadki po ukończeniu.
- Nielimitowana liczba prób (jak Loldle Classic); liczba prób trafia do share-grida.
- Pole odpowiedzi = autocomplete po nazwach NPC (sekcja 9.3).
- Stan zapisywany w `localStorage` (sekcja 6).
- **Inwariant konstytucyjny:** wszyscy gracze, niezależnie od obozu i rangi, otrzymują identyczne zagadki. Obóz jest soczewką (theming, copy, rywalizacja) — nigdy mechaniką zmieniającą treść gry. Złamanie tej zasady zabija porównywalność gridów, czyli rdzeń formatu.
- Stopka i ekran pomocy noszą etykietę: **„Dane, cytaty i wartości: oryginalny Gothic (2001)"** — Remake zmienia mapę, questy i dialogi; jawna deklaracja kanonu ucina spory u źródła.

### 3.1 Tryb KLASYCZNY (F1)

Gracz zgaduje NPC dnia. Po każdej próbie tabela feedbacku porównuje 6 atrybutów zgadniętego NPC z celem.

**Atrybuty i reguły feedbacku:**

| # | Atrybut | Wartości (słownik) | Feedback |
|---|---|---|---|
| 1 | Obóz | Stary Obóz / Nowy Obóz / Bractwo / Magowie Ognia / Magowie Wody / Bez frakcji | 🟩 zgodny / 🟥 inny |
| 2 | Lokacja | makro: Stary Obóz / Nowy Obóz / Obóz na Bagnach / Stara Kopalnia / Wolna Kopalnia / Świątynia Śniącego / Dolina (poza obozami) | 🟩 / 🟥 |
| 3 | Rola | szczegółowa (Strażnik, Cień, Kopacz, Magnat, Najemnik, Szkodnik, Guru, Nowicjusz, Mag, Kupiec, Kowal, Alchemik, Łowca, Przywódca, …) | 🟩 zgodna / 🟨 ta sama grupa ról / 🟥 inna |
| 4 | Trener | uczy: Broń 1H / Broń 2H / Łuk / Kusza / Siła / Zręczność / Magia / Akrobatyka / — (nie uczy) | 🟩 zgodny / 🟨 uczy, ale czego innego / 🟥 |
| 5 | Handel | Tak / Nie | 🟩 / 🟥 |
| 6 | Rozdział | 1–6 (pierwszy rozdział, w którym NPC jest dostępny) | 🟩 zgodny / ⬆️ cel później / ⬇️ cel wcześniej |

**Reguła Lokacji:** dominanta czasowa rutyny dobowej NPC w jego pierwszym rozdziale dostępności, wyliczana automatycznie z plików gry (sekcja 11, krok 3b). Waypointy bez dopasowanego prefiksu → kubełek „Dolina (poza obozami)". Zamek Gomeza liczy się jako Stary Obóz.

**Grupy ról** (do logiki 🟨): `WARRIOR` (Strażnik, Cień, Najemnik, Łowca), `WORKER` (Kopacz, Szkodnik, Nowicjusz), `MAGE` (Mag Ognia, Mag Wody, Guru), `CRAFT_TRADE` (Kupiec, Kowal, Alchemik, Kucharz), `LEADER` (Magnat, Przywódca, Arcymag), `OUTSIDER` (Bez przydziału).

**Wygrana:** trafienie NPC. Ekran wyniku: nazwa + 1–2 zdania opisu (własny tekst), przycisk „Udostępnij".

### 3.2 Tryb CYTAT (F1)

Wyświetlana jest **wymiana dialogowa: 1–4 linie, Bohater ↔ NPC** (tekst, bez audio) w języku interfejsu. Odpowiedź = NPC-rozmówca. Pole odpowiedzi: ten sam autocomplete co w Klasycznym, po pełnej puli postaci — spójny komponent, zero przecieku „skoro jest na liście, to ma cytat". Ambientowe dialogi NPC↔NPC poza zakresem F1.

**Drabinka podpowiedzi:** po 3. błędnej próbie → obóz NPC; po 5. → pierwsza litera imienia; po 7. → kontekst sytuacyjny (1 zdanie, własny opis).

**Dane:** 60–100 wymian na start. Ta sama wymiana dnia we wszystkich językach: skrypty dialogów są wspólne, więc parser paruje PL/EN/DE automatycznie po ID dialogu; teksty per locale z odpowiednich OU.csl — transkrypcje, nie tłumaczenia. Kryterium doboru: sygnał kultowości w ≥2 językach (pipeline: sekcja 11, krok 4). Kult bywa asymetryczny między dubbingami — akceptujemy, że pojedynczy rynek dostanie czasem słabszy dzień.

### 3.3 Tryb MAPA (F3)

Rysowana (własna/zlecona) mapa Górniczej Doliny. Zadanie dnia: „Gdzie znajdziesz [NPC/miejsce]?" Gracz stawia pin.

- Maks. 4 próby. Po każdej: dystans (w „krokach", jednostka umowna) + strzałka kierunku.
- Wygrana: pin w promieniu progu trafienia (kalibracja: ~3% szerokości mapy).
- Share-grid: 🟩 trafiono za N / 🟨 blisko / 🟥 pudło, np. `📍🟥🟨🟩 (3/4)`.
- Współrzędne znormalizowane `[0..1] × [0..1]` względem obrazu mapy.

### 3.4 Tryb DRABINA (F2)

Codziennie 6 elementów do ułożenia rosnąco po ukrytej wartości z plików gry. Jedna interakcja (drag&drop), rotujące kategorie wg dnia tygodnia:

| Dzień | Kategoria | Układane po | Pula |
|---|---|---|---|
| Pn | Bestiariusz | HP | ~40 bestii |
| Wt | Zbrojownia | obrażenia | ~80 broni |
| Śr | Targ | cena w rudzie | ~200 przedmiotów |
| Cz | Mieszkańcy | Siła | ~150 NPC |
| Pt | Magia | koszt many | ~20 zaklęć |
| Sb | Pancerze | ochrona | ~20 zbroi |
| Nd | Miks | cena w rudzie, międzykategoryjnie | wszystko |

**Mechanika:** 3 próby; feedback per pozycja — 🟩 właściwe miejsce, 🟨 o jedną pozycję obok, 🟥 dalej. Po rozwiązaniu lub porażce odsłaniamy faktyczne wartości całej szóstki (odsłona = content, nie nagroda). 6 elementów = 720 układów — zgadywanie strukturalnie nie działa (problem, który zabił Pojedynek).

**Generator:** deterministyczny (`daily.ts`, osobny seed per kategoria). Reguły doboru szóstki: sąsiednie wartości różnią się ≥15% (pokrętło kalibracji — żadnych remisów), ≥4 elementy tieru rozpoznawalności S/A + maks. 2 głębsze, cooldown elementu 3 tygodnie w kategorii. Zestawy generują się ze statów — zero ręcznego contentu, kiedykolwiek.

**Kalibracja na telemetrii:** cel mediana ~2,3 próby i 60–75% rozwiązań dziennie; odchylenia korygujemy progiem różnicy. Z danych D1 generujemy „Pomyłkę dnia" („71% graczy zamieniło Wilka z Topielcem") — gotowy materiał społecznościowy.

**Wymóg techniczny:** dopracowany touch drag&drop (dnd-kit lub własna reorder-lista) — jedyna „fizyczna" interakcja w grze; do zrobienia w wieczór, ale starannie.

### 3.5 WARSTWA OBOZOWA (onboarding F1, wojna i rangi F2)

**Onboarding (F1):** przed pierwszą zagadką jeden ekran: „Do którego obozu należysz?" — Stary Obóz / Nowy Obóz / Obóz na Bagnach. Wybór zapisywany w `localStorage`, doklejany do telemetrii (`camp`). Zmiana możliwa w ustawieniach; dezercja = start od dna drabiny rang nowego obozu (lore: nikt cię tam nie zna).

**Wojna Obozów (F2):** tygodniowa rywalizacja, reset w poniedziałek 00:00 Europe/Warsaw. Wynik obozu = **średnia** skuteczność członków (mediana prób, solve rate) — nie suma, żeby liczebność nie wygrywała z jakością. Ekspozycja tablicy od ≥30 wyników/obóz/tydzień; udziały procentowe obozów widoczne zawsze. Nagroda kosmetyczna: barwy zwycięzcy w UI przez tydzień + wpis w Kronice.

**Rangi obozowe (F2):** progresja czysto kliencka (skumulowane wygrane + kamienie serii z `localStorage`). Drabiny kanoniczne, zweryfikowane w Gothicpedii:

| Obóz | Drabina |
|---|---|
| Stary Obóz | Kopacz → Cień → Strażnik → Magnat |
| Nowy Obóz | Zbieracz → Szkodnik → Najemnik → Mag Wody |
| Obóz na Bagnach | Nowicjusz → Strażnik Świątynny → Guru |

Źródło hierarchii Starego Obozu wprost z dialogu Orry'ego (gotowy tooltip w UI). Uwaga nazewnicza: kanon PL to „Strażnik Świątynny", nie „Templariusz". Progi awansu: start konserwatywny (np. ranga 2 po 7 wygranych; 3 po 25 wygranych i serii 7; 4 po 60 i serii 14), kalibracja na telemetrii — inflacja tytułów dewaluuje system, luzować łatwiej niż zaostrzać.

**Theming i copy:** akcent kolorystyczny UI per obóz (CSS variables), zwroty per obóz i ranga („Nieźle, Szkodniku") — własne teksty stylizowane na rejestr gry, zero cytatów verbatim. ~30–40 linii na obóz, pisane ręcznie.

**Kronika (F2):** statyczna podstrona z tygodniowymi werdyktami generowanymi z agregatów D1 („Tydzień 3: Bractwo broni tytułu. Stary Obóz poległ na Targu."). Trwała, linkowalna historia wojny.

**Share:** nagłówek grida rozszerzony o rangę i obóz, np. `Cień Starego Obozu · seria 12`.



---

## 4. Model danych

Wszystkie dane = statyczne JSON-y generowane build-scriptem z kuratorowanego CSV (sekcja 11). Identyfikatory i kod po angielsku.

```ts
// src/core/types.ts

export type Camp =
  | 'OLD_CAMP' | 'NEW_CAMP' | 'SWAMP_CAMP'
  | 'FIRE_MAGES' | 'WATER_MAGES' | 'NONE';

export type RoleGroup =
  | 'WARRIOR' | 'WORKER' | 'MAGE' | 'CRAFT_TRADE' | 'LEADER' | 'OUTSIDER';

export type Skill =
  | 'ONE_H' | 'TWO_H' | 'BOW' | 'CROSSBOW'
  | 'STR' | 'DEX' | 'MAGIC' | 'ACROBATICS';

export interface Npc {
  id: string;                 // slug: "diego"
  name: string;               // kanoniczne imię (wspólne dla locale)
  camp: Camp;
  location: string;           // klucz słownika lokacji (makro)
  role: string;               // klucz słownika ról (szczegółowa)
  roleGroup: RoleGroup;
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  trainer: Skill | null;
  trades: boolean;
  stats?: { str: number; dex: number; hp: number }; // Drabina (kategoria Mieszkańcy)
  aliases?: string[];         // alternatywne pisownie do autocomplete
}

export interface Quote {
  id: string;
  npcId: string;
  text: { pl: string; en: string; de?: string };     // transkrypcje per dubbing
  context?: { pl: string; en: string; de?: string }; // podpowiedź po 7. błędzie
}

export interface MapTarget {
  id: string;
  label: { pl: string; en: string; de?: string };
  x: number; y: number;       // [0..1] względem obrazu mapy
}
```

**Słowniki wartości** (`src/i18n/dict.{pl,en,de}.json`): tłumaczenia obozów, ról, lokacji, umiejętności. W danych trzymamy klucze, nie teksty.

**Wolumeny F1:** ~120–150 NPC (Gothic 1 ma wystarczająco nazwanych postaci), 60–100 cytatów. Pole `game` celowo pominięte w F1 — dojdzie w F4 razem z zestawem G2 (migracja: dodać pole z defaultem `G1`).

---

## 5. Logika dziennej zagadki (architektura B — klient)

Zagadka dnia = deterministyczna funkcja daty, wykonywana w przeglądarce; backend nie uczestniczy w rozgrywce (telemetria fire-and-forget po fakcie). **Znana słabość (akceptowana, decyzja v1.5):** odpowiedź da się wyłuskać z bundla JS — ale jedyna rywalizacja to liga znajomych (kontrola towarzyska) i Wojna Obozów (średnie, odporne na jednostki), więc serwerowa walidacja chroniłaby nic, kosztując ~2 wieczory i krytyczną zależność od API.

```ts
// src/core/daily.ts
export const LAUNCH_DAY = '2026-06-15'; // YYYY-MM-DD, dzień #0 — USTAW przy deployu

export function puzzleNumber(now = new Date()): number {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })
    .format(now); // 'YYYY-MM-DD' w strefie PL
  return Math.round((Date.parse(day) - Date.parse(LAUNCH_DAY)) / 86_400_000);
}

// mulberry32 — mały deterministyczny PRNG
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stała permutacja puli — brak powtórek aż do wyczerpania puli.
export function buildPermutation(n: number, seed = 0x474f54 /* "GOT" */): number[] {
  const rng = mulberry32(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dailyItem<T>(pool: T[], puzzle: number, seed?: number): T {
  const perm = buildPermutation(pool.length, seed);
  return pool[perm[puzzle % pool.length]];
}
```

Każdy tryb używa **innego seeda** (np. classic `0x474f54`, quote `0x474f55`, …), żeby NPC dnia w Klasycznym ≠ autor cytatu dnia.

---

## 6. Stan lokalny, konta i streak

Klucz: `kolonia_v1`. Wersjonowanie w polu `version` (przyszłe migracje).

**Model hybrydowy:** gracz anonimowy żyje w `localStorage` (pełna funkcjonalność). Po zalogowaniu przez **Google OAuth** źródłem prawdy dla **serii** staje się serwer (od F2 także punktów ligowych); `localStorage` zostaje cache'em. Przy pierwszym logowaniu jednorazowy merge lokalnego stanu do konta. Konto = `google_sub` + `display_name` z Google; pełna gra działa bez konta.

```ts
export type ModeId = 'classic' | 'quote' | 'ladder' | 'map';

interface ModeDay {
  puzzle: number;
  guesses: string[];   // npcId[] lub serializacja prób
  solved: boolean;
}

interface ModeStats {
  played: number;
  won: number;
  streak: number;        // kolejne dni z wygraną
  maxStreak: number;
  lastWonPuzzle: number; // do liczenia ciągłości serii
  dist: Record<string, number>; // liczba prób -> ile razy
}

export interface Persisted {
  version: 1;
  lang: 'pl' | 'en' | 'de';
  camp: 'OLD_CAMP' | 'NEW_CAMP' | 'SWAMP_CAMP' | null; // wybór gracza (3.6); null = przed onboardingiem
  modes: Partial<Record<ModeId, ModeDay>>;
  stats: Partial<Record<ModeId, ModeStats>>;
}
```

Reguła streaka: wygrana w `puzzle == lastWonPuzzle + 1` → `streak++`; przerwa ≥1 dnia → `streak = 1`. Brak kont = brak synchronizacji między urządzeniami (świadomy trade-off MVP; ewentualny eksport/import stanu jako string w F4).

---

## 7. Udostępnianie wyniku

Generowany tekst → `navigator.share()` na mobile, fallback `clipboard.writeText()` + toast „Skopiowano".

Przykład (Klasyczny):

```
KOLONIA #12 — Klasyczny 🏰
Zgadnięte w 4 | seria: 7🔥

🟥🟥🟨🟥🟩⬆️
🟨🟥🟩🟩🟩⬇️
🟩🟨🟩🟩🟩🟩
🟩🟩🟩🟩🟩🟩

kolonia.app
```

Zasady: kolejność kolumn = kolejność atrybutów z tabeli 3.1; przy >8 próbach pokazujemy ostatnie 8 + linijkę `(+N wcześniejszych)`. Bez spoilera (nigdy nie wklejamy imienia NPC).

---

## 8. i18n

- Start: **PL + EN + DE** (decyzja v1.5). UI w całości przez słowniki — zero stringów w kodzie.
- Cytaty: wspólne ID wymiany ze skryptów; teksty per locale z PL/EN/DE OU.csl (transkrypcje, nie tłumaczenia). Kuracja data-driven — sekcja 11, krok 4.
- Copy obozowe: PL z charakterem (pisane ręcznie); EN/DE na starcie neutralne i funkcjonalne, charakter po przeglądzie przez native'a z community.
- Nazwy NPC: kanoniczne, nietłumaczone (Diego = Diego we wszystkich wersjach).
- Wartości atrybutów: przez słowniki `dict.{locale}.json`.
- Wykrywanie języka: `navigator.language` → default, przełącznik w nagłówku, zapis w `localStorage`.
- Routing bez prefiksów językowych (jedna aplikacja, język = stan kliencki).

---

## 9. UI / UX

### 9.1 Zasady
- **Mobile-first.** Kontener treści max ~480 px, czytelne na 360 px.
- Ciemny motyw inspirowany klimatem (rdza/ochra/węgiel), np. tło `#17120e`, panel `#241c14`, akcent `#c47a2c`, tekst `#e8ddcc`. Font nagłówków: dowolny darmowy (OFL) krój o średniowiecznym charakterze — **nie** odtwarzamy kroju logo Gothic. Tekst: systemowy/Inter.
- Feedback kolorami + symbolem (⬆️⬇️), nie samym kolorem (dostępność).

### 9.2 Ekrany
1. **Home:** logo tekstowe, lista trybów z badge'ami stanu dnia (✅ / ●), licznik do resetu, stopka z disclaimerem.
2. **Tryb:** pole zgadywania + tabela prób (najnowsza na górze), nagłówki kolumn z tooltipami legend.
3. **Wynik (modal):** odpowiedź + opis, share, statystyki osobiste (rozkład prób), licznik do jutra.
4. **Pomoc (modal):** zasady trybu, legenda kolorów — otwierane automatycznie przy pierwszej wizycie.
5. **Ustawienia (modal):** język, reset danych lokalnych.

### 9.3 Autocomplete
- Dopasowanie bez diakrytyków i wielkości liter (`normalize('NFD')` + strip), prefix > substring, max 8 podpowiedzi, nawigacja klawiaturą.
- Po wybraniu NPC znika on z listy podpowiedzi (nie można zgadywać dwa razy tego samego).

---

## 10. Stack techniczny

| Warstwa | Wybór | Uzasadnienie |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | standard, szybki dev; brak lib stanu — `useReducer` wystarczy |
| Styling | Tailwind CSS | tempo |
| Hosting | **Cloudflare Pages** | darmowy nielimitowany bandwidth — odporność na spike z Reddita (Vercel free ma limity transferu) |
| Analityka | Cloudflare Web Analytics | darmowa, bez cookies, bez banera zgód |
| Backend (F1) | Pages Functions (Worker) + **D1** (SQLite) | ten sam repo i deploy co front, zero osobnej infry; atomowe zapisy; SQL = naturalne środowisko autora |
| CI | GitHub → Pages auto-deploy | zero konfiguracji |

**Backend i API (v1.4 — server-authoritative):**

Zasada: **backend nigdy nie jest zależnością rozgrywki.** Gra działa w 100% przy martwym API; telemetria leci fire-and-forget (`navigator.sendBeacon`, błędy połykane), konta tylko dodają (sync serii, liga).

```
POST /api/result   body: { mode, puzzle, attempts, solved, camp, userId?, event? }  -> 204   (F1)
GET  /api/auth/google/start                          -> 302 Google OAuth
GET  /api/auth/google/callback                     -> 302 + sesja w hash
GET  /api/me       -> { nick, camp, stats, lang }
PUT  /api/me       body: { camp, stats, lang }       -> sync profilu
GET  /api/stats?mode=classic&puzzle=12                 -> { players, solvedPct, avgAttempts }  (F2)
POST /api/league   / GET /api/league/:code             -> liga znajomych (F2)
```

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  google_sub   TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  camp         TEXT,                   -- OLD_CAMP / NEW_CAMP / SWAMP_CAMP
  state        TEXT NOT NULL DEFAULT '{}',
  created      INTEGER NOT NULL
);
CREATE TABLE results (
  user_id  TEXT,                      -- NULL = gracz anonimowy
  mode     TEXT    NOT NULL,
  puzzle   INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  solved   INTEGER NOT NULL,
  points   INTEGER NOT NULL,          -- patrz wzór niżej
  camp     TEXT,
  ip_hash  TEXT    NOT NULL,          -- SHA-256(IP + sól); surowe IP nie dotyka dysku
  ts       INTEGER NOT NULL,
  UNIQUE (mode, puzzle, ip_hash)      -- dedup anonimów
);
CREATE UNIQUE INDEX uq_user_puzzle ON results(user_id, mode, puzzle) WHERE user_id IS NOT NULL;
```

**Punkty (wyłącznie liga + Wojna Obozów, od F2):** Klasyczny i Cytat — `max(1, 11 − próby)`; Drabina — 10/6/3 za rozwiązanie w 1/2/3 próbie. Suma tygodniowa zasila ligę znajomych i średnią obozu. Wyniki ligowe to honor system z kontrolą towarzyską — świadoma decyzja v1.5. **Globalnej tablicy (punktów ani streaków) nie ma.**

Walidacja telemetrii: `mode` ze słownika, `puzzle` = dzisiejszy ±1, `attempts ∈ 1..50`, rate-limit po IP. Ekspozycja statystyk publicznych (F2) od ≥30 wyników dnia.

**Struktura repo:**

```
kolonia/
├─ src/
│  ├─ app/                # layout, routing, modale
│  ├─ modes/
│  │  ├─ classic/
│  │  └─ quote/
│  ├─ core/               # daily.ts, feedback.ts, storage.ts, share.ts, types.ts
│  ├─ data/               # npc.json, quotes.json (GENEROWANE — nie edytować ręcznie)
│  └─ i18n/
├─ functions/
│  └─ api/
│     ├─ result.ts        # POST — telemetria (F1)
│     └─ stats.ts         # GET — agregaty (F2)
├─ tools/
│  ├─ scrape-fandom.mjs   # raw dump z wiki
│  ├─ build-data.mjs      # CSV -> JSON + walidacja
│  └─ map-annotator/      # dev-tool: klik na mapie -> zapis współrzędnych (F2)
├─ data-src/              # npc.csv, quotes.csv — ŹRÓDŁO PRAWDY (kuracja ręczna)
└─ public/
```

---

## 11. Pipeline danych

Źródło prawdy = `data-src/*.csv` (kuracja ręczna w Excelu), JSON-y generowane skryptem. Nigdy nie edytujemy JSON-ów ręcznie.

**Krok 1 — surowy dump (1 wieczór):** `tools/scrape-fandom.mjs` (Node + cheerio) zbiera z gothic.fandom.com kategorię postaci Gothic 1 → `raw-npc.json` (imię, link, infobox). To tylko szkielet do uzupełnienia.

**Krok 2 — kuracja (1–2 wieczory):** import do `npc.csv`; ręczne uzupełnienie obozu, roli, lokacji, rozdziału, trenera, handlu. Wiedza własna + wiki. ~120–150 wierszy. (To jest wąskie gardło projektu i jednocześnie jego fosa — nikt nie zrobi tego dobrze bez znajomości gry.)

**Krok 3 — staty i wartości (1 wieczór):** zdekompilowane skrypty Gothic 1 (worldofgothic.de / community patch sources) → `str/dex/hp` per NPC oraz dump itemów pod Drabinę (obrażenia broni, ochrona zbroi, pole `value`, koszt many zaklęć). Parser regex po plikach `.d`. Potrzebne od F2 — nie blokuje MVP.

**Krok 3b — Lokacja z rutyn (1 wieczór, F1):** rozszerzenie parsera z kroku 1/3 — z funkcji `Rtn_Start_*` zbieramy wywołania `TA_*` (waypoint + przedział godzin), mapujemy waypointy na makrolokacje słownikiem prefiksów (`OC_`, `NC_`, `PSI_`, `OM_`, `FM_`…; pełną listę prefiksów daje `sort | uniq` na dumpie), Lokacja = dominanta czasowa z pierwszego rozdziału dostępności. Output: `location_auto` + `location_confidence`; confidence <70% albo nieznany prefiks → kolejka ręcznego review (oczekiwane ~15–25 NPC). Fallback dla postaci bez rutyny: waypoint z `Wld_InsertNpc`. Niedopasowane → „Dolina (poza obozami)". Walidacja krzyżowa geometrią waypointów z WORLD.ZEN — praca współdzielona z trybem Mapa.

**Krok 4 — wymiany dialogowe (2 wieczory):** kandydaci = wymiany Bohater↔NPC zgrupowane po ID dialogu ze skryptów; teksty PL/EN/DE parowane automatycznie z trzech OU.csl. Ranking kultowości z sygnałów zewnętrznych: rekurencja w wątkach forumowych (WoG, spieleforum, Wykop), kompilacjach YouTube, stronach cytatów. Próg: sygnał w ≥2 językach. Finalny ludzki przegląd 60–100 wymian. Zasada: pamięć proponuje, dane decydują — dotyczy też polskiego.

**Krok 5 — walidacja:** `build-data.mjs` sprawdza: unikalność `id`, komplet pól wymaganych, wartości w słownikach, `chapter ∈ 1..6`, każdy `quote.npcId` istnieje. Build pada przy błędzie.

**Mapa (F3, zlecenie startuje w F1):** ilustracja własna (zlecenie ~50–150 zł / Fiverr albo stylizowana generacja AI + poprawki) — NIE mapa z gry ani skan oficjalnej. Współrzędne nanoszone narzędziem `map-annotator` (klik → append do JSON), z prefillem pozycji z waynetu (krok 3b).

---

## 12. Ramy prawne (twarde zasady)

1. Projekt **niekomercyjny**: zero reklam, zero płatności, zero zbierania maili w MVP.
2. **Zakaz assetów z gry:** audio, screenshoty, modele, tekstury, oficjalne artworki, logo i jego krój. Dozwolone: fakty (atrybuty), krótkie cytaty tekstowe w celach identyfikacyjnych (charakter trivii), własna grafika.
3. Stopka na każdej stronie:
   - PL: „KOLONIA to nieoficjalny, niekomercyjny projekt fanowski. Gothic oraz powiązane nazwy i postacie są własnością THQ Nordic GmbH. Projekt nie jest powiązany z właścicielem marki ani przez niego wspierany."
   - EN: "KOLONIA is an unofficial, non-commercial fan project. Gothic and related names and characters are the property of THQ Nordic GmbH. Not affiliated with or endorsed by the trademark owner."
4. Domena **bez słowa „gothic"** (rekomendacja ostrożnościowa) — patrz sekcja 15.
5. Wpłynęło C&D → wykonujemy bez dyskusji, archiwizujemy kod (silnik zostaje nasz).
6. Przy realnej trakcji (≥2 tyg. stabilnego ruchu): mail do THQ Nordic z propozycją formalnej zgody / współpracy. Ton: „darmowe narzędzie engagement dla waszej społeczności przy okazji Remake'a".

Uwaga: powyższe to środki ostrożności laika, nie porada prawna.

---

## 13. Metryki i kryteria decyzji

**Mierzone:** CF Web Analytics (unikalni dziennie, % powracających, źródła ruchu) + D1 od dnia 0 (ukończenia per tryb, rozkład prób, solved rate). Share rate: licznik kliknięć „Udostępnij" dopisany do telemetrii. Dzięki temu decyzja z dnia 14 opiera się na twardych danych, a F2 wyświetla statystyki wstecz od pierwszej zagadki.

**Decyzja po 14 dniach od launchu:**

| Unikalni/dzień (mediana tyg. 2) | Decyzja |
|---|---|
| > 300 | Pełny commit: F3, DE, kontakt THQ |
| 100–300 | Utrzymanie + F2 wolnym tempem |
| < 100 | Freeze: zostaje online (koszt ~0), wnioski do silnika, koniec aktywnego rozwoju |

Health-check jakości zagadek: jeśli mediana prób w Klasycznym > 9 → kalibracja (za trudne atrybuty/za mało znanych NPC w puli pierwszych tygodni; pierwsze 14 dni puli układamy ręcznie z rozpoznawalnych postaci). Drabina: cel mediana ~2,3 próby i 60–75% rozwiązań — korekta progiem różnicy wartości w generatorze.

---

## 14. Plan startu (F1)

**Pre-launch checklist:**
- [ ] 14 pierwszych zagadek ułożonych ręcznie (rozpoznawalne postacie, rosnąca trudność)
- [ ] Test na 360 px szerokości + iOS Safari (clipboard, share)
- [ ] Disclaimer w stopce PL/EN
- [ ] OG-tagi (tytuł, opis, własny obrazek 1200×630)
- [ ] Analityka podpięta
- [ ] `LAUNCH_DAY` ustawiony na dzień publikacji

**Kanały (kolejność PL → DE → EN, odstęp 1–2 dni):**
1. polski Discord Gothic + Wykop (#gothic, tag gry),
2. społeczność Kronik Myrtany: Archolos (Discord/Steam) — największa aktywna polska baza fanów klasycznego Gothica,
3. forum WorldOfGothic.de (DE — największy rynek Gothica),
4. r/worldofgothic + subreddit Remake'a (EN).

**Szkic posta (PL):**
> **Zrobiłem KOLONIĘ — codzienną zagadkę dla fanów Gothica. Zgadniesz dzisiejszego NPC-a?**
> Krótka darmowa gra w przeglądarce, w stylu Wordle: codziennie jeden NPC do odgadnięcia po atrybutach (obóz, rola, rozdział…) i jeden kultowy cytat. Grasz bez zakładania konta; konto opcjonalnie chroni serię i wpisuje cię do rankingu. Zero reklam, projekt fanowski. Zbudowane na fali Remake'a — feedback bardzo mile widziany. [link] [screenshot grida]

Zasada komunikacji: pokazuj grid wyniku, nie opis gry. Grid sam tłumaczy mechanikę.

---

## 15. Otwarte decyzje (do rozstrzygnięcia przed startem)

1. **Nazwa i domena.** Kandydaci: `kolonia.gg`, `kolonia-gra.pl`, `colonydle.com`, `barrier.gg`. Kryteria: bez „gothic" w domenie, krótka, czytelna w trzech językach (KOLONIA + podtytuł EN/DE w OG/description).
2. ~~Języki na start.~~ **Rozstrzygnięte (v1.5):** PL + EN + DE od premiery; cytaty jako wymiany parowane po ID dialogu; copy obozowe EN/DE neutralne do przeglądu native'a.
3. **Pula Klasycznego:** wszyscy nazwani NPC (~150, trudniej) vs top ~100 rozpoznawalnych (łatwiej, lepszy onboarding). Rekomendacja: top 100 na start, reszta dochodzi po miesiącu jako „twardy tydzień".
4. ~~Licznik globalny od F1?~~ **Rozstrzygnięte (v1.1):** zbieranie wyników od F1; ekspozycja statystyk w UI od F2, przy ≥30 wynikach dnia.
5. **Metoda auth:** nick + kod odzyskiwania (zero PII, ryzyko: zgubiony kod = stracone konto) vs magic-link e-mail (wygodniejszy, ale PII + polityka prywatności + infrastruktura mailowa). Rekomendacja: nick + kod w F1, magic-link ewentualnie później.
6. **Sekwencja kont:** moduł kont w F1 (pełny zakres, launch później) vs F1.5 (launch szybciej, konta tydzień po). Zależna od tempa prac względem okna.

---

## 16. Definicja ukończenia MVP (DoD)

- [ ] Tryby Klasyczny i Cytat działają E2E na mobile i desktopie
- [ ] Dane: ≥120 NPC, ≥60 wymian dialogowych ×3 wersje językowe, walidator przechodzi
- [ ] Streak + share-grid (Web Share + clipboard fallback); percentyl dnia po rozwiązaniu (próg ≥30)
- [ ] Telemetria: `POST /api/result` zapisuje do D1; gra działa poprawnie przy wyłączonym API
- [x] Konto opcjonalne: logowanie Google, merge stanu lokalnego, sync serii; pełna gra działa bez konta
- [ ] i18n: PL/EN/DE kompletne dla UI; zero stringów w kodzie
- [ ] Pomoc/zasady przy pierwszej wizycie
- [ ] Deploy na Cloudflare Pages, własna domena, OG-tagi, analityka
- [ ] Pierwsze 14 dni zagadek ułożone ręcznie
- [ ] Ekran wyboru obozu w onboardingu; `camp` w stanie i wynikach; theming frakcyjny UI
