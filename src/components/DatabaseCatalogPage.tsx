import {
  formatOptionalDate,
  formatSchemaLabel,
  type DatabaseCatalogEntry
} from "../lib/dashboard";
import { formatBytes } from "../lib/format";

type DatabaseCatalogPageProps = {
  databaseCatalog: DatabaseCatalogEntry[];
  onOpenLocalFilePicker: () => void;
};

export function DatabaseCatalogPage(props: DatabaseCatalogPageProps) {
  const { databaseCatalog, onOpenLocalFilePicker } = props;

  return (
    <>
      <header className="topbar page-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Databases</div>
        <div className="page-topbar-row">
          <div className="page-topbar-title">
            <h1>Databases</h1>
          </div>
          <div className="topbar-actions page-topbar-actions database-topbar-actions">
            <button type="button" className="button button-secondary button-compact" onClick={onOpenLocalFilePicker}>Choose SQLite</button>
          </div>
        </div>
        <p>All benchmark databases currently visible to the frontend, plus metadata and loaded-dataset statistics when available.</p>
      </header>
      <section className="catalog-grid">
        {databaseCatalog.length ? databaseCatalog.map((entry) => (
          <article className={`surface-card panel catalog-card${entry.isActive ? " catalog-card-active" : ""}`} key={entry.id}>
            <div className="catalog-card-head">
              <div>
                <div className="catalog-eyebrow">{entry.source}</div>
                <h2>{entry.title}</h2>
                <p>{entry.description}</p>
              </div>
              {entry.isActive ? <span className="status-pill">Loaded</span> : <span className="status-pill status-pill-muted">Available</span>}
            </div>
            <div className="catalog-meta">
              <div className="catalog-field">
                <span>ID</span>
                <strong>{entry.id}</strong>
              </div>
              <div className="catalog-field">
                <span>Schema</span>
                <strong>{formatSchemaLabel(entry.schemaVersion)}</strong>
              </div>
              <div className="catalog-field">
                <span>Size</span>
                <strong>{entry.sizeBytes === null ? "n/a" : formatBytes(entry.sizeBytes)}</strong>
              </div>
              <div className="catalog-field">
                <span>Packed</span>
                <strong>{formatOptionalDate(entry.packedAt)}</strong>
              </div>
              <div className="catalog-field catalog-field-wide">
                <span>Source</span>
                <code>{entry.url}</code>
              </div>
              {entry.sha256 ? (
                <div className="catalog-field catalog-field-wide">
                  <span>SHA-256</span>
                  <code>{entry.sha256}</code>
                </div>
              ) : null}
            </div>
            {entry.stats ? (
              <div className="catalog-stats">
                <div className="catalog-stat"><span>Rows</span><strong>{entry.stats.rowCount.toLocaleString()}</strong></div>
                <div className="catalog-stat"><span>Runs</span><strong>{entry.stats.runCount.toLocaleString()}</strong></div>
                <div className="catalog-stat"><span>Keys</span><strong>{entry.stats.keyCount.toLocaleString()}</strong></div>
                <div className="catalog-stat"><span>Machines</span><strong>{entry.stats.machineCount.toLocaleString()}</strong></div>
                <div className="catalog-stat"><span>Metrics</span><strong>{entry.stats.metrics.join(", ") || "n/a"}</strong></div>
                <div className="catalog-stat"><span>Latest Run</span><strong>{formatOptionalDate(entry.stats.latestRunDate)}</strong></div>
                <div className="catalog-stat"><span>Dirty Runs</span><strong>{entry.stats.dirtyRunCount.toLocaleString()}</strong></div>
              </div>
            ) : (
              <div className="catalog-empty subtle-card">Load this database to compute row, run, machine, metric, and latest-run statistics.</div>
            )}
            {Object.keys(entry.metadataPreview).length ? (
              <details className="catalog-details">
                <summary>Metadata Preview</summary>
                <div className="catalog-preview">
                  {Object.entries(entry.metadataPreview).map(([key, value]) => (
                    <div className="catalog-preview-row" key={key}>
                      <span>{key}</span>
                      <code>{value || "n/a"}</code>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </article>
        )) : (
          <article className="surface-card panel catalog-card">
            <div className="catalog-card-head">
              <div>
                <div className="catalog-eyebrow">No catalog</div>
                <h2>No databases are visible yet</h2>
                <p>Choose a local SQLite file, or provide a benchledger manifest so the frontend can list available databases.</p>
              </div>
            </div>
            <button type="button" className="button button-primary" onClick={onOpenLocalFilePicker}>Choose Local SQLite</button>
          </article>
        )}
      </section>
    </>
  );
}
