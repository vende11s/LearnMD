import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Terminal } from 'lucide-react';
import { useI18n } from '../i18n';
import './learnmd-skill-panel.css';

const INSTALL_COMMAND = 'npx skills add vende11s/LearnMD';

export function LearnMDSkillPanel() {
  const { t } = useI18n();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyCommand() {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopyStatus('copied');
      resetTimer.current = setTimeout(() => setCopyStatus('idle'), 2500);
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <section
      className="learnmd-skill-panel"
      aria-labelledby="learnmd-skill-title"
    >
      <div className="learnmd-skill-heading">
        <Terminal size={20} aria-hidden="true" />
        <div>
          <h3 id="learnmd-skill-title">
            {t('Prefer an AI agent?', 'Korzystasz z agenta AI?')}
          </h3>
          <p>
            {t(
              'Install the learnmd skill in Codex, Claude Code, Cursor, or another compatible AI agent. It teaches your agent to create and improve .learn.md notes with quizzes, diagrams, and formulas.',
              'Zainstaluj skill learnmd w Codex, Claude Code, Cursor lub innym kompatybilnym agencie AI. Uczy agenta tworzyć i poprawiać notatki .learn.md z quizami, diagramami i wzorami.',
            )}
          </p>
        </div>
      </div>
      <div className="learnmd-skill-command">
        <code>{INSTALL_COMMAND}</code>
        <button
          type="button"
          className="button secondary"
          onClick={() => void copyCommand()}
        >
          {copyStatus === 'copied' ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {copyStatus === 'copied'
            ? t('Copied', 'Skopiowano')
            : t('Copy command', 'Kopiuj komendę')}
        </button>
      </div>
      <p className="learnmd-skill-status" role="status" aria-live="polite">
        {copyStatus === 'copied' &&
          t('Command copied to clipboard.', 'Komenda skopiowana do schowka.')}
        {copyStatus === 'error' &&
          t(
            'Could not copy. Select the command above and copy it manually.',
            'Nie udało się skopiować. Zaznacz powyższą komendę i skopiuj ją ręcznie.',
          )}
      </p>
      <p className="learnmd-skill-help">
        {t(
          'Run it in a terminal from your project folder (requires Node.js and npm). Then ask your agent to turn your materials into a LearnMD note.',
          'Uruchom ją w terminalu w katalogu projektu (wymaga Node.js i npm). Następnie poproś agenta o utworzenie notatki LearnMD z Twoich materiałów.',
        )}
      </p>
      <a
        className="text-button learnmd-skill-link"
        href="https://github.com/vende11s/LearnMD/tree/main/skills/learnmd"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('View the skill on GitHub', 'Zobacz skill na GitHubie')}
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    </section>
  );
}
