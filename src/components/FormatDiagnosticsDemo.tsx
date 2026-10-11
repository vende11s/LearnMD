import { useMemo, useState } from 'react';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
const examples = [
  {
    label: 'Missing fence',
    source:
      ':::definition{title="An unfinished definition"}\nA derivative measures local change.',
  },
  {
    label: 'Unknown component',
    source:
      ':::future-component\nThis explanation stays readable, even when its component is unknown.\n:::',
  },
  {
    label: 'Unsafe content',
    source:
      '# A safe reading experience\n\n<script>alert("untrusted")</script>\n\n[Unsafe link](javascript:alert)\n\nOrdinary **Markdown** is preserved.',
  },
];
export function FormatDiagnosticsDemo() {
  const [index, setIndex] = useState(0);
  const example = examples[index];
  const doc = useMemo(() => parseLearnMD(example.source), [example]);
  return (
    <details className="diagnostics-demo">
      <summary>
        When a document needs attention <span>Validation & safe recovery</span>
      </summary>
      <div>
        <p>
          Useful diagnostics explain what needs fixing. Unknown components
          preserve their text; unsafe HTML is removed. Errors prevent import
          until the source is corrected externally.
        </p>
        <div className="segmented">
          {examples.map((e, i) => (
            <button
              key={e.label}
              className={i === index ? 'selected' : ''}
              onClick={() => setIndex(i)}
            >
              {e.label}
            </button>
          ))}
        </div>
        <pre>{example.source}</pre>
        <ul>
          {doc.diagnostics.map((d, i) => (
            <li key={i}>
              <strong>
                {d.severity === 'error' ? 'Error' : 'Notice'}
                {d.line ? ` · line ${d.line}` : ''}:
              </strong>{' '}
              {d.message}
            </li>
          ))}
        </ul>
        {!doc.diagnostics.some((d) => d.severity === 'error') && (
          <div className="diagnostic-fallback">
            <span className="eyebrow">SAFE READING FALLBACK</span>
            <ReaderContent document={doc} detail="standard" />
          </div>
        )}
      </div>
    </details>
  );
}
