# data-src — dane Gothic 1 dla KOLONII

Źródłem prawdy dla **kanonicznego katalogu** są skrypty Gothic 1 z repozytorium `VaanaCZ/gothic-1-classic-scripts`.

Harmonogram gry (które NPC/cytaty/mapa na dany dzień) jest w **Cloudflare D1** lub — w dev bez bazy — w `data-src/cms-fallback.json`.

## Generowanie katalogu

`npm run build:data` pobiera skrypty Daedalusa i generuje:

- `src/data/npc.json`
- `src/data/quotes.json`
- `data-src/g1-summary.json`

## Seed CMS

`npm run seed:content` importuje katalog do `data-src/cms-fallback.json` i tworzy:

- 14 dni kuratorowanego harmonogramu (classic, quote, map)
- domyślną mapę `public/maps/kolonia.svg`
- punkty mapy dla wybranych NPC

W produkcji uruchom migrację `drizzle/0003_cms_admin.sql` na D1 i zsynchronizuj dane (panel `/admin` lub import z fallback).

## Panel admina

`/admin` — zarządzanie cytatami, NPC, harmonogramem i mapą. Wymaga logowania Google oraz roli `admin` lub wpisu w `ADMIN_GOOGLE_SUBS`.
