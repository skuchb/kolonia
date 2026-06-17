import type { ReactNode } from "react";
import type { AuthSession } from "@/src/core/auth";
import type { DayStats } from "@/src/core/day-stats";
import type { Locale, ModeId, Npc, PlayerCamp } from "@/src/core/types";
import { npcDisplayName } from "@/src/data";
import { getDictionary, guildLabel, npcLocationLabel, playerCampLabel, roleLabel } from "@/src/i18n";

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--hairline)] bg-black/95 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl text-[var(--ember-bright)]" id="modal-title">
            {title}
          </h2>
          <button
            className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)] hover:text-[var(--bone)]"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HelpModal({ lang, onClose }: { lang: Locale; onClose: () => void }) {
  const dict = getDictionary(lang);
  const help = dict.ui.help;

  return (
    <ModalShell title={help.title} onClose={onClose}>
      <div className="space-y-5 font-mono text-[10pt] uppercase leading-relaxed tracking-[0.12em] text-[var(--bone-dim)]">
        <section>
          <h3 className="mb-2 text-[var(--bone)]">{help.classicTitle}</h3>
          <p>{help.classicBody}</p>
        </section>
        <section>
          <h3 className="mb-2 text-[var(--bone)]">{help.quoteTitle}</h3>
          <p>{help.quoteBody}</p>
        </section>
        <section>
          <h3 className="mb-2 text-[var(--bone)]">{help.mapTitle}</h3>
          <p>{help.mapBody}</p>
        </section>
        <section>
          <h3 className="mb-2 text-[var(--bone)]">{help.cardTitle}</h3>
          <p>{help.cardBody}</p>
        </section>
        <section>
          <h3 className="mb-2 text-[var(--bone)]">{help.legendTitle}</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-3">
              <span className="size-3 bg-[var(--moss)]" />
              {help.legendHit}
            </li>
            <li className="flex items-center gap-3">
              <span className="size-3 bg-[var(--ember)]" />
              {help.legendNear}
            </li>
            <li className="flex items-center gap-3">
              <span className="size-3 bg-[var(--panel-ink)]/25" />
              {help.legendMiss}
            </li>
            <li>{help.legendArrows}</li>
          </ul>
        </section>
        <p className="border-t border-[var(--hairline)] pt-4 text-[10pt] text-[var(--bone)]/80">
          {dict.ui.footerCanon}
        </p>
        <button
          className="w-full border border-[var(--ember)]/50 px-4 py-3 text-[var(--ember-bright)] hover:border-[var(--ember)]"
          onClick={onClose}
          type="button"
        >
          {help.close}
        </button>
      </div>
    </ModalShell>
  );
}

export function SettingsModal({
  lang,
  camp,
  session,
  onClose,
  onLanguageChange,
  onGoogleLogin,
  onLogout,
}: {
  lang: Locale;
  camp: PlayerCamp | null;
  session: AuthSession | null;
  onClose: () => void;
  onLanguageChange: (lang: Locale) => void;
  onGoogleLogin: () => void;
  onLogout: () => void;
}) {
  const dict = getDictionary(lang);
  const settings = dict.ui.settings;
  const locales: Locale[] = ["pl", "en", "de"];

  return (
    <ModalShell title={settings.title} onClose={onClose}>
      <div className="space-y-6 font-mono text-sm uppercase tracking-[0.12em] text-[var(--bone-dim)]">
        <section>
          <h3 className="mb-3 text-[var(--bone)]">{settings.language}</h3>
          <div className="flex flex-wrap gap-2">
            {locales.map((locale) => (
              <button
                className={`min-h-10 min-w-12 border px-3 py-2 font-mono text-[10pt] uppercase tracking-widest ${
                  lang === locale
                    ? "border-[var(--ember)] bg-[var(--ember)]/15 text-[var(--ember-bright)]"
                    : "border-[var(--hairline)] text-[var(--bone-dim)] hover:border-[var(--bone)]/40 hover:text-[var(--bone)]"
                }`}
                key={locale}
                onClick={() => onLanguageChange(locale)}
                type="button"
              >
                {locale.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {camp ? (
          <section>
            <h3 className="mb-2 text-[var(--bone)]">{settings.camp}</h3>
            <p className="text-[var(--bone-dim)]">{playerCampLabel(lang, camp)}</p>
          </section>
        ) : null}

        <section>
          <h3 className="mb-2 text-[var(--bone)]">{settings.account}</h3>
          <p className="mb-3 normal-case leading-relaxed tracking-normal">{settings.accountBody}</p>
          {session ? (
            <div className="space-y-3">
              <p className="text-[var(--bone)]">
                {settings.loggedInAs}: <span className="text-[var(--ember-bright)]">{session.nick}</span>
              </p>
              <button
                className="border-b border-[var(--ember)]/60 pb-0.5 text-[var(--ember-bright)]"
                onClick={onLogout}
                type="button"
              >
                {settings.logout}
              </button>
            </div>
          ) : (
            <button
              className="border border-[var(--ember)]/50 px-4 py-3 text-[var(--ember-bright)] hover:border-[var(--ember)]"
              onClick={onGoogleLogin}
              type="button"
            >
              {settings.googleLogin}
            </button>
          )}
        </section>
      </div>
    </ModalShell>
  );
}

export function ResultModal({
  lang,
  mode,
  attempts,
  streak,
  targetNpc,
  resetLabel,
  stats,
  statsLoading,
  xpEarned,
  distanceMeters,
  isLoggedIn,
  onClose,
  onShare,
  onSaveProgress,
  onPlayWithoutAccount,
}: {
  lang: Locale;
  mode: ModeId;
  attempts: number;
  streak: number;
  targetNpc: Npc;
  resetLabel: string;
  stats: DayStats | null;
  statsLoading: boolean;
  xpEarned: number;
  distanceMeters?: number | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onShare: () => void;
  onSaveProgress?: () => void;
  onPlayWithoutAccount?: () => void;
}) {
  const dict = getDictionary(lang);
  const result = dict.ui.result;
  const xp = dict.ui.xp;

  return (
    <ModalShell title={result.title} onClose={onClose}>
      <div className="space-y-5">
        <div className="border border-[var(--ember)]/30 bg-[var(--ember)]/10 p-4">
          <div className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--ember-bright)]">
            {xp.gained.replace("{n}", String(xpEarned))}
          </div>
        </div>

        <div>
          <div className="font-serif text-3xl text-[var(--bone)]">{npcDisplayName(targetNpc, lang)}</div>
          <p className="mt-2 font-mono text-[10pt] normal-case leading-relaxed tracking-normal text-[var(--bone-dim)]">
            {guildLabel(lang, targetNpc.guild)} · {npcLocationLabel(lang, targetNpc)} · {roleLabel(lang, targetNpc.role)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)]">
          <div className="border border-[var(--hairline)] p-3">
            <div>{result.attempts}</div>
            <div className="mt-1 text-lg text-[var(--bone)]">{attempts}</div>
          </div>
          <div className="border border-[var(--hairline)] p-3">
            <div>{dict.ui.streakDays}</div>
            <div className="mt-1 text-lg text-[var(--bone)]">{streak}</div>
          </div>
          <div className="border border-[var(--hairline)] p-3">
            <div>{result.mode}</div>
            <div className="mt-1 text-[var(--bone)]">
              {mode === "quote"
                ? dict.ui.modeQuote
                : mode === "map"
                  ? dict.ui.modeMap
                  : mode === "card"
                    ? dict.ui.modeCard
                    : dict.ui.modeClassic}
            </div>
          </div>
          <div className="border border-[var(--hairline)] p-3">
            <div>{dict.ui.resetIn}</div>
            <div className="mt-1 text-[var(--ember-bright)]">{resetLabel}</div>
          </div>
          {distanceMeters != null ? (
            <div className="col-span-2 border border-[var(--hairline)] p-3">
              <div>{dict.ui.mapDistance}</div>
              <div className="mt-1 text-lg text-[var(--bone)]">{distanceMeters} m</div>
            </div>
          ) : null}
        </div>

        {!isLoggedIn ? (
          <div className="space-y-3 border border-[var(--hairline)] p-4">
            <p className="font-mono text-[10pt] uppercase leading-relaxed tracking-[0.12em] text-[var(--bone-dim)]">
              {xp.localOnly}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 border border-[var(--hairline)] px-4 py-3 font-mono text-[10pt] uppercase tracking-[0.12em]"
                onClick={onPlayWithoutAccount}
                type="button"
              >
                {xp.playWithoutAccount}
              </button>
              <button
                className="flex-1 border border-[var(--ember)]/50 px-4 py-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--ember-bright)]"
                onClick={onSaveProgress}
                type="button"
              >
                {xp.saveProgress}
              </button>
            </div>
          </div>
        ) : null}

        {statsLoading ? (
          <p className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)]">
            {result.statsLoading}
          </p>
        ) : stats?.ready && stats.percentile !== undefined ? (
          <p className="border border-[var(--ember)]/30 bg-[var(--ember)]/10 p-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--ember-bright)]">
            {result.percentile.replace("{n}", String(stats.percentile))}
          </p>
        ) : stats && !stats.ready ? (
          <p className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)]">
            {result.percentilePending}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="flex-1 border border-[var(--ember)]/50 px-4 py-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--ember-bright)] hover:border-[var(--ember)]"
            onClick={onShare}
            type="button"
          >
            {dict.ui.share}
          </button>
          <button
            className="flex-1 border border-[var(--hairline)] px-4 py-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)] hover:border-[var(--bone)]/40"
            onClick={onClose}
            type="button"
          >
            {result.close}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
