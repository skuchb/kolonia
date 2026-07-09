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

### 4. Migracje i seed (produkcja)

**Migracje D1** uruchamiają się **automatycznie** przy każdym deployu (`npm run build` → `post-deploy-migrate` przed seedem CMS). Skrypt śledzi zastosowane pliki w tabeli `schema_migrations` i pomija już wykonane.

Przy pierwszym deployu po włączeniu auto-migrate na istniejącej bazie (tabele już utworzone ręcznie) skrypt traktuje błędy typu „already exists” jako sygnał, że migracja była wcześniej zastosowana, i zapisuje ją w rejestrze.

Ręcznie (opcjonalnie, lokalnie lub gdy build nie ma tokena CF):

```bash
npm run d1:migrate:remote
npm run seed:content
npm run seed:d1:remote
```

Nowa migracja: `npm run db:generate`, commit pliku z `drizzle/`, push — kolejny deploy zastosuje ją sam.

### 5. Commit + push + redeploy

```bash
git add wrangler.jsonc
git commit -m "Configure production D1 database ID"
git push
```

Cloudflare Pages zbuduje projekt ponownie po pushu.

Binding **DB** → D1 **kolonia-db** musi być spójny z `wrangler.jsonc`.

## Zmienne środowiskowe i sekrety (OAuth Google)

### Dlaczego Dashboard → Environment variables „nie działa”

Projekt deployuje się z **`wrangler.jsonc` w repo** (git push). Wrangler traktuje ten plik jako **źródło prawdy**:

- **Zwykłe zmienne** (plain text) ustawione tylko w Dashboardzie → **znikają przy redeployu**
- **Sekrety** (encrypted / `wrangler secret put`) → **zostają** między deployami
- Zmienne z sekcji `"vars"` w `wrangler.jsonc` → **zawsze** nadpisują deploy

Źródło: [Workers configuration — Source of truth](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth), [Pages bindings — Secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets).

### Co gdzie ustawić

| Zmienna | Gdzie | Typ |
|---------|--------|-----|
| `NEXT_PUBLIC_SITE_URL` | `wrangler.jsonc` → `vars` | publiczna, w gicie |
| `ADMIN_GOOGLE_SUBS` | `wrangler.jsonc` → `vars` | publiczna, w gicie |
| `AUTH_SECRET` | **Secret** (panel lub CLI) | szyfrowana |
| `GOOGLE_CLIENT_ID` | **Secret** | szyfrowana |
| `GOOGLE_CLIENT_SECRET` | **Secret** | szyfrowana |

**Nie wpisuj** `GOOGLE_CLIENT_*` ani `AUTH_SECRET` do `wrangler.jsonc` → `vars` (wyciek na GitHub + nadpisuje prawdziwe sekrety).

### Metoda A — Panel Cloudflare (trwałe sekrety)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. Kliknij projekt **kolonia** (nie D1, nie DNS)
3. **Settings** → **Variables and Secrets**
4. **Add** → wpisz nazwę (np. `GOOGLE_CLIENT_ID`) i wartość
5. **Włącz „Encrypt”** (to musi być Secret, nie zwykła zmienna)
6. Powtórz dla: `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`
7. **Save** / **Deploy** jeśli panel o to prosi
8. **Deployments** → **Retry deployment** (żeby worker wczytał sekrety)

### Metoda B — Terminal (zalecane, jednorazowo)

**Kolonia to Cloudflare Worker** (`main` w `wrangler.jsonc`), nie projekt Pages. Używaj `wrangler secret put`, **nie** `wrangler pages secret put` (stąd błąd „Project kolonia does not exist”).

```powershell
cd c:\Users\skucharski\Documents\claude\gothic
npx wrangler login

npx wrangler secret put AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

npx wrangler secret list
```

Każde polecenie poprosi o wartość (wklej, Enter). Sekrety **nie znikają** przy kolejnych deployach z gita.

Lokalnie: skopiuj `.dev.vars.example` → `.dev.vars` i uzupełnij wartości.

### Google Cloud Console

W [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client:

**Authorized redirect URI:**
```
https://kolonia.app/api/auth/google/callback
```

### Weryfikacja

Po ustawieniu secretów i redeployu:

```bash
curl -I https://kolonia.app/api/auth/google/start
```

- **302** → redirect do Google = OK
- **503** → nadal brak `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` w runtime

W przeglądarce: kliknij logowanie Google — powinieneś trafić na `accounts.google.com`, nie błąd `google_oauth_not_configured`.

## Build settings (Pages)

| Pole | Wartość |
|---|---|
| Build command | `npm run build` |
| Build output | (generowane przez vinext — zostaw domyślne z szablonu CF / wrangler) |
| Node.js | ≥ 22 |

Binding **DB** → D1 **kolonia-db** musi być spójny z `wrangler.jsonc`.
