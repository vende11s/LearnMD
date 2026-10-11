import { FormatDiagnosticsDemo } from '../components/FormatDiagnosticsDemo';
import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { COMPONENTS, PUBLIC_COMPONENTS } from '../format/registry';
import {
  componentDescriptionPL,
  componentPropertiesPL,
} from '../format/registry.pl';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import unitCircle from '../assets/unit-circle.png?inline';
import { useI18n } from '../i18n';

export function Showcase() {
  const { t } = useI18n();
  const categoryLabel = (category: string) =>
    ({
      Educational: t('Educational', 'Edukacyjne'),
      Interactive: t('Interactive', 'Interaktywne'),
      Layout: t('Layout', 'Układ'),
      Technical: t('Technical', 'Techniczne'),
      Diagrams: t('Diagrams', 'Diagramy'),
      Progressive: t('Progressive', 'Stopniowe odkrywanie'),
      Composition: t('Composition', 'Kompozycja'),
    })[category] ?? category;
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState('definition');
  const components = PUBLIC_COMPONENTS;
  const entry = COMPONENTS.find((c) => c.name === selected) ?? COMPONENTS[0];
  const doc = useMemo(() => parseLearnMD(entry.example), [entry]);
  const propertiesPL = componentPropertiesPL(entry);
  return (
    <div className="page showcase-page">
      <div className="eyebrow">
        {t('THE LEARNMD FIELD GUIDE', 'PRZEWODNIK PO LEARNMD')}
      </div>
      <h1>
        {t(
          'Ideas deserve the right form.',
          'Pomysły zasługują na dobrą formę.',
        )}
      </h1>
      <p className="page-description">
        {t(
          'Explore the building blocks of a deeper understanding.',
          'Poznaj komponenty, które pomagają lepiej zrozumieć materiał.',
        )}
        <br />
        {t(
          'Every example is live. Try it, then take a look at the source.',
          'Każdy przykład działa. Wypróbuj go, a potem zajrzyj do źródła.',
        )}
      </p>
      <FormatDiagnosticsDemo />
      <div className="showcase-layout">
        <aside className="component-index">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label={t('Find a component', 'Znajdź komponent')}
              placeholder={t('Find a component…', 'Znajdź komponent…')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          {Array.from(new Set(components.map((c) => c.category))).map(
            (category) => (
              <div key={category}>
                <h3>{categoryLabel(category)}</h3>
                {components
                  .filter(
                    (c) =>
                      c.category === category &&
                      c.name.includes(filter.toLowerCase()),
                  )
                  .map((c) => (
                    <button
                      key={c.name}
                      className={selected === c.name ? 'active' : ''}
                      onClick={() => setSelected(c.name)}
                    >
                      {c.name}
                      <ChevronRight size={13} />
                    </button>
                  ))}
              </div>
            ),
          )}
        </aside>
        <section className="component-example">
          <div className="example-heading">
            <span className="eyebrow">{categoryLabel(entry.category)}</span>
            <h2>{entry.name}</h2>
            <p>{t(entry.description, componentDescriptionPL(entry))}</p>
          </div>
          <div className="live-example" key={selected}>
            <ReaderContent
              document={doc}
              assets={{ 'unit-circle.png': unitCircle }}
            />
          </div>
          <details className="source-example" open>
            <summary>{t('Authoring syntax', 'Składnia źródła')}</summary>
            <pre>{entry.example}</pre>
          </details>
          <h3>{t('Properties', 'Właściwości')}</h3>
          <dl className="property-list">
            {Object.entries(entry.properties).map(([key, value]) => (
              <div key={key}>
                <dt>
                  <code>{key}</code>
                </dt>
                <dd>{t(value, propertiesPL[key])}</dd>
              </div>
            ))}
          </dl>
          <p className="fineprint">
            {t(
              'Nested containers use longer outer fences:',
              'Zagnieżdżone kontenery wymagają dłuższych zewnętrznych znaczników:',
            )}{' '}
            <code>::::tabs</code> {t('contains', 'zawiera')} <code>:::tab</code>
            .{' '}
            {t(
              'Close each block with exactly the same number of colons used to open it. See Generate notes for the full reference.',
              'Zamknij każdy blok dokładnie taką samą liczbą dwukropków jak przy otwieraniu. Pełną specyfikację znajdziesz w sekcji Generuj notatki.',
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
