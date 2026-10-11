import { FormatDiagnosticsDemo } from '../components/FormatDiagnosticsDemo';
import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { COMPONENTS, PUBLIC_COMPONENTS } from '../format/registry';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import type { DetailLevel as Detail } from '../reader/context';
import { DetailControl } from '../components/DetailControl';
import unitCircle from '../assets/unit-circle.png?inline';

export function Showcase({
  detail,
  setDetail,
}: {
  detail: Detail;
  setDetail: (d: Detail) => void;
}) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState('definition');
  const components = PUBLIC_COMPONENTS;
  const entry = COMPONENTS.find((c) => c.name === selected) ?? COMPONENTS[0];
  const doc = useMemo(() => parseLearnMD(entry.example), [entry]);
  return (
    <div className="page showcase-page">
      <div className="eyebrow">THE LEARNMD FIELD GUIDE</div>
      <h1>Ideas deserve the right form.</h1>
      <p className="page-description">
        Explore the building blocks of a deeper understanding.
        <br />
        Every example is live. Try it, then take a look at the source.
      </p>
      <FormatDiagnosticsDemo />
      <div className="showcase-layout">
        <aside className="component-index">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Find a component"
              placeholder="Find a component…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          {Array.from(new Set(components.map((c) => c.category))).map(
            (category) => (
              <div key={category}>
                <h3>{category}</h3>
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
            <span className="eyebrow">{entry.category}</span>
            <h2>{entry.name}</h2>
            <p>{entry.description}</p>
          </div>
          <DetailControl detail={detail} setDetail={setDetail} />
          <div className="live-example" key={selected}>
            <ReaderContent
              document={doc}
              detail={detail}
              assets={{ 'unit-circle.png': unitCircle }}
            />
          </div>
          <details className="source-example" open>
            <summary>Authoring syntax</summary>
            <pre>{entry.example}</pre>
          </details>
          <h3>Properties</h3>
          <dl className="property-list">
            {Object.entries(entry.properties).map(([key, value]) => (
              <div key={key}>
                <dt>
                  <code>{key}</code>
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="fineprint">
            Nested containers use longer outer fences: <code>::::tabs</code>{' '}
            contains <code>:::tab</code>. Close each block with exactly the same
            number of colons used to open it. See Generate notes for the full
            reference.
          </p>
        </section>
      </div>
    </div>
  );
}
