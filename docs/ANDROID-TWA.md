# Android (TWA) — KOLONIA

Aplikacja Android to **Trusted Web Activity** — pełnoekranowa powłoka Chrome wokół `https://kolonia.app`.

## Wymagania w repo (gotowe)

- `public/manifest.webmanifest` — manifest PWA
- `public/icons/` — ikony 192, 512, maskable 512
- `public/.well-known/assetlinks.json` — powiązanie z apką (uzupełnij fingerprint)
- `public/sw.js` — minimalny service worker (install + offline fallback)

Sprawdź po deployu:

```text
https://kolonia.app/manifest.webmanifest
https://kolonia.app/.well-known/assetlinks.json
```

## 1. Wygeneruj projekt Android (Bubblewrap)

```powershell
npm install -g @bubblewrap/cli
mkdir ..\kolonia-android
cd ..\kolonia-android
bubblewrap init --manifest https://kolonia.app/manifest.webmanifest
```

Sugerowane wartości:

| Pole | Wartość |
|------|---------|
| Package name | `app.kolonia.game` |
| App name | `KOLONIA` |
| Theme / background | `#12100e` |

Zapisz keystore i hasła — bez nich nie zaktualizujesz aplikacji w Play Store.

## 2. Digital Asset Links

Po `bubblewrap init` skopiuj **SHA-256 certificate fingerprint** i wklej do `public/.well-known/assetlinks.json`:

```powershell
cd ..\kolonia-android
bubblewrap fingerprint list
```

```json
"sha256_cert_fingerprints": [
  "AA:BB:CC:..."
]
```

**Bez poprawnego fingerprintu TWA działa w trybie Custom Tabs** — powiadomienia push wymagają zgody Chrome, a nie aplikacji KOLONIA. Po uzupełnieniu fingerprintu i deployu przeinstaluj apkę.

Commit, push, deploy. W Play Console zweryfikuj domenę `kolonia.app`.

## 3. Build i test

```powershell
bubblewrap build
bubblewrap install
```

## 4. Ikony PWA (regeneracja)

```powershell
npm run generate:pwa-icons
```

## 5. Play Console

- Wgraj `app-release-bundle.aab`
- Store listing: screenshoty, ikona 512×512, feature graphic 1024×500
- Polityka prywatności: URL na stronie (wymagane przy logowaniu Google)
- Data safety: e-mail opcjonalny (Google), nick, postęp gry

OAuth Google **nie wymaga** osobnego klienta Android — TWA ładuje produkcyjną stronę z istniejącym redirect URI.

## Push (Web Push / VAPID)

1. Wygeneruj klucze:
   ```powershell
   npm run generate:vapid-keys
   ```
2. Ustaw sekrety:
   ```powershell
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```
3. Po deployu włącz powiadomienia w **Ustawienia** w grze (checkbox push).
4. **Android 13+:** przy pierwszym uruchomieniu apki pojawi się systemowe pytanie o powiadomienia — zaakceptuj, potem włącz checkbox w grze.
5. Cron worker wysyła przypomnienie codziennie o **8:00** czasu warszawskiego.
