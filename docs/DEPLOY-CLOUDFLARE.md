# Deploy na Cloudflare Pages

## Błąd `D1 binding 'DB' references database ... which was not found`

Deploy używa `database_id` z pliku `wrangler.jsonc`. Placeholder `00000000-…` nie istnieje na koncie — trzeba utworzyć bazę D1 i wkleić prawdziwe ID.

### 1. Zaloguj się w Wrangler

```bash
npx wrangler login
```

### 2. Utwórz bazę D1

```bash
npx wrangler d1 create kolonia-db
```

Skopiuj **`database_id`** z outputu (UUID).

### 3. Wklej ID do `wrangler.jsonc`

```jsonc
"database_id": "TUTAJ-PRAWDZIWE-UUID"
```

Alternatywa: Cloudflare Dashboard → **D1** → **kolonia-db** → skopiuj **Database ID**.

### 4. Migracje i seed (jednorazowo, na produkcji)

```bash
npx wrangler d1 execute kolonia-db --remote --file=drizzle/0000_lucky_blur.sql
npx wrangler d1 execute kolonia-db --remote --file=drizzle/0001_dry_young_avengers.sql
npx wrangler d1 execute kolonia-db --remote --file=drizzle/0002_telemetry_event.sql
npx wrangler d1 execute kolonia-db --remote --file=drizzle/0003_cms_admin.sql
npm run seed:content
npm run seed:d1
```

(`seed:d1` domyślnie seeduje lokalnie; dla remote użyj `--remote` zamiast `--local` w `tools/seed-d1.mjs` albo wykonaj wygenerowany `data-src/seed-d1.sql` ręcznie:)

```bash
npx wrangler d1 execute kolonia-db --remote --file=data-src/seed-d1.sql
```

### 5. Commit + push + redeploy

```bash
git add wrangler.jsonc
git commit -m "Configure production D1 database ID"
git push
```

Cloudflare Pages zbuduje projekt ponownie po pushu.

## Zmienne środowiskowe (Pages → Settings → Environment variables)

Skopiuj z `.env.example`:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `NEXT_PUBLIC_SITE_URL` (np. `https://kolonia.pages.dev`)
- `ADMIN_GOOGLE_SUBS`
- opcjonalnie: `IP_HASH_SALT`, `NEXT_PUBLIC_CF_BEACON_TOKEN`

## Build settings (Pages)

| Pole | Wartość |
|---|---|
| Build command | `npm run build` |
| Build output | (generowane przez vinext — zostaw domyślne z szablonu CF / wrangler) |
| Node.js | ≥ 22 |

Binding **DB** → D1 **kolonia-db** musi być spójny z `wrangler.jsonc`.
