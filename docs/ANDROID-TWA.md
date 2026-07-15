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

**Build failed — typowe przyczyny:**

| Błąd | Rozwiązanie |
|------|-------------|
| `Dependency requires at least JVM runtime version 11` | Użyj JDK z Android Studio: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` |
| `SDK location not found` | Utwórz `local.properties`: `sdk.dir=C\:\\Users\\TWOJ_USER\\AppData\\Local\\Android\\Sdk` |
| `'var' is not allowed` / błąd kompilacji Java | Zaktualizuj repo — `NotificationPermissionHelper` nie używa już `var` (Java 8) |

Alternatywa bez bubblewrap (z katalogu `kolonia-android`):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleRelease
adb install -r app\build\outputs\apk\release\app-release-unsigned.apk
```

(bubblewrap podpisuje APK automatycznie; przy `gradlew` potrzebny keystore z `app/build.gradle` / konfiguracji bubblewrap)

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
3. Po deployu powiadomienia push w apce Android włączają się po zgodzie systemowej przy starcie; wyłączenie: Ustawienia → Aplikacje → KOLONIA → Powiadomienia.
4. Cron worker wysyła przypomnienie codziennie o **14:00** czasu warszawskiego (testowo; zmiana: `DAILY_PUSH_HOUR_WARSAW` w `wrangler.jsonc`).

### Powiadomienia w apce Android (TWA)

**Apka Android pyta o powiadomienia przy pierwszym uruchomieniu** (`NotificationGateActivity` jako ikona apki → dialog → `LauncherActivity` z intentem `ACTION_VIEW`).

Overlay nad TWA nie pokazywał dialogu. Gate jako launcher działa, ale TWA trzeba startować przez `ACTION_VIEW` + URL — inaczej apka się zamyka po zgodzie.

Warstwa web **nie ma opcji powiadomień w ustawieniach gry** — po zgodzie systemowej strona automatycznie rejestruje subskrypcję push.

**Nie używaj intent URL z warstwy web** — Chrome w TWA blokuje lub źle interpretuje takie linki.

Wymagania techniczne:

1. APK ma `DelegationService` + `NotificationPermissionRequestActivity` + `POST_NOTIFICATIONS`
2. `NotificationGateActivity` (MAIN/LAUNCHER) pyta o `POST_NOTIFICATIONS`, potem startuje `LauncherActivity` przez `ACTION_VIEW` + `launchUrl`
3. `assetlinks.json` i `assetStatements` muszą być poprawne (TWA bez paska adresu)
4. Web nasłuchuje `Notification.permission` i subskrybuje push po zgodzie systemowej

**Czysta instalacja po problemach:**

```powershell
# Odinstaluj apkę z telefonu, potem:
cd ..\kolonia-android
bubblewrap build
bubblewrap install
```

Dodatkowo: wyczyść dane Chrome dla `kolonia.app` (Ustawienia → Aplikacje → Chrome → Pamięć → Wyczyść cache).

**Weryfikacja asset links (adb):**

```text
adb shell pm get-app-links app.kolonia.game
```

Status `verified` dla `kolonia.app` = pełny tryb TWA z delegacją.
