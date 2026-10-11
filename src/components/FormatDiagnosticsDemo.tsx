import { useMemo, useState } from 'react';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import { useI18n } from '../i18n';
const examples = [
  {
    label: 'Missing fence',
    labelPl: 'Brak zamknięcia bloku',
    source:
      ':::definition{title="An unfinished definition"}\nA derivative measures local change.',
  },
  {
    label: 'Unknown component',
    labelPl: 'Nieznany element',
    source:
      ':::future-component\nThis explanation stays readable, even when its component is unknown.\n:::',
  },
  {
    label: 'Unsafe content',
    labelPl: 'Niebezpieczna treść',
    source:
      '# A safe reading experience\n\n<script>alert("untrusted")</script>\n\n[Unsafe link](javascript:alert)\n\nOrdinary **Markdown** is preserved.',
  },
];
export function FormatDiagnosticsDemo() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const example = examples[index];
  const doc = useMemo(() => parseLearnMD(example.source), [example]);
  return (
    <details className="diagnostics-demo">
      <summary>
        {t('When a document needs attention', 'Gdy dokument wymaga poprawy')}{' '}
        <span>
          {t(
            'Validation & safe recovery',
            'Walidacja i bezpieczne wyświetlanie',
          )}
        </span>
      </summary>
      <div>
        <p>
          {t(
            'Useful diagnostics explain what needs fixing. Unknown components preserve their text; unsafe HTML is removed. Errors prevent import until the source is corrected externally.',
            'Komunikaty wyjaśniają, co wymaga poprawy. Tekst nieznanych elementów pozostaje czytelny, a niebezpieczny HTML jest usuwany. Błędy blokują import do czasu poprawienia źródła poza aplikacją.',
          )}
        </p>
        <div className="segmented">
          {examples.map((e, i) => (
            <button
              key={e.label}
              className={i === index ? 'selected' : ''}
              onClick={() => setIndex(i)}
            >
              {t(e.label, e.labelPl)}
            </button>
          ))}
        </div>
        <pre>{example.source}</pre>
        <ul>
          {doc.diagnostics.map((d, i) => (
            <li key={i}>
              <strong>
                {d.severity === 'error'
                  ? t('Error', 'Błąd')
                  : t('Notice', 'Uwaga')}
                {d.line ? t(` · line ${d.line}`, ` · wiersz ${d.line}`) : ''}:
              </strong>{' '}
              {d.message}
            </li>
          ))}
        </ul>
        {!doc.diagnostics.some((d) => d.severity === 'error') && (
          <div className="diagnostic-fallback">
            <span className="eyebrow">
              {t('SAFE READING FALLBACK', 'BEZPIECZNE WYŚWIETLANIE TREŚCI')}
            </span>
            <ReaderContent document={doc} />
          </div>
        )}
      </div>
    </details>
  );
}
