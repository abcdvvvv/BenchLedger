import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/common/EmptyState";
import { Panel } from "../../components/ui/Card";
import { PageHeader } from "../../components/common/PageHeader";
import {
  formatOptionalDate,
  formatSchemaLabel,
  type DatabaseCatalogEntry
} from "../../lib/dashboard";
import { formatBytes } from "../../lib/format";

export type DatabasesPageProps = {
  databaseCatalog: DatabaseCatalogEntry[];
  onOpenLocalFilePicker: () => void;
};

function CatalogGrid(props: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
      {props.children}
    </div>
  );
}

function CatalogGridItem(props: { label: string; value: string; wide?: boolean; fullRow?: boolean; code?: boolean }) {
  const className = props.fullRow
    ? "surface-inset-muted pad-field-compact col-span-full min-w-0 grid gap-1"
    : props.wide
      ? "surface-inset-muted pad-field-compact min-w-0 grid gap-1 sm:col-span-2"
      : "surface-inset-muted pad-field-compact min-w-0 grid gap-1";

  return (
    <div className={className}>
      <span className="type-table-head">{props.label}</span>
      {props.code ? (
        <code className="type-body break-all">{props.value}</code>
      ) : (
        <strong className="type-body-strong break-words">{props.value}</strong>
      )}
    </div>
  );
}

function MetadataPreviewRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-2 border-theme-b border-stone-200 pb-3 last:border-b-0 last:pb-0 dark:border-[#2f2f33] sm:grid-cols-[10rem_minmax(0,1fr)]">
      <span className="type-table-head">{props.label}</span>
      <code className="type-body break-all">{props.value}</code>
    </div>
  );
}

export function DatabasesPage(props: DatabasesPageProps) {
  const { databaseCatalog, onOpenLocalFilePicker } = props;

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Databases"
        title="Databases"
        description="All benchmark databases currently visible to the frontend, plus metadata and loaded-dataset statistics when available."
        actions={<Button variant="secondary" className="max-sm:w-full" onClick={onOpenLocalFilePicker}>Choose SQLite</Button>}
      />

      {databaseCatalog.length ? (
        <section className="grid gap-6">
          {databaseCatalog.map((entry) => (
            <Panel key={entry.id} className={entry.isActive ? "border-amber-300 dark:border-amber-400/40" : undefined}>
              <div className="grid gap-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="type-table-head text-theme-brand">{entry.source}</div>
                    <div className="space-y-2">
                      <h2 className="type-section-title">{entry.title}</h2>
                      <p className="type-body-muted">{entry.description}</p>
                    </div>
                  </div>
                  {entry.isActive ? <StatusBadge tone="brand">Loaded</StatusBadge> : <StatusBadge>Available</StatusBadge>}
                </div>

                <CatalogGrid>
                  <CatalogGridItem label="ID" value={entry.id} />
                  <CatalogGridItem label="Schema" value={formatSchemaLabel(entry.schemaVersion)} />
                  <CatalogGridItem label="Size" value={entry.sizeBytes === null ? "n/a" : formatBytes(entry.sizeBytes)} />
                  <CatalogGridItem label="Packed" value={formatOptionalDate(entry.packedAt)} />
                  <CatalogGridItem label="Source" value={entry.url} wide code />
                  {entry.sha256 ? <CatalogGridItem label="SHA-256" value={entry.sha256} wide code /> : null}
                </CatalogGrid>

                {entry.stats ? (
                  <CatalogGrid>
                    <CatalogGridItem label="Rows" value={entry.stats.rowCount.toLocaleString()} />
                    <CatalogGridItem label="Runs" value={entry.stats.runCount.toLocaleString()} />
                    <CatalogGridItem label="Keys" value={entry.stats.keyCount.toLocaleString()} />
                    <CatalogGridItem label="Environments" value={entry.stats.environmentCount.toLocaleString()} />
                    <CatalogGridItem label="Latest Run" value={formatOptionalDate(entry.stats.latestRunDate)} />
                    <CatalogGridItem label="Dirty Runs" value={entry.stats.dirtyRunCount.toLocaleString()} />
                    <CatalogGridItem label="Metrics" value={entry.stats.metrics.join(", ") || "n/a"} fullRow />
                  </CatalogGrid>
                ) : (
                  <div className="surface-inset-muted pad-field type-body-muted">
                    Load this database to compute row, run, environment, metric, and latest-run statistics.
                  </div>
                )}

                {Object.keys(entry.metadataPreview).length ? (
                  <details className="grid gap-3">
                    <summary className="type-body-strong cursor-pointer text-stone-600 marker:text-stone-400 dark:text-stone-300 dark:marker:text-stone-500">
                      Metadata Preview
                    </summary>
                    <div className="grid gap-3">
                      {Object.entries(entry.metadataPreview).map(([key, value]) => (
                        <MetadataPreviewRow
                          key={key}
                          label={key}
                          value={value || "n/a"}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </Panel>
          ))}
        </section>
      ) : (
        <EmptyState title="No databases are visible yet" description="Choose a local SQLite file, or provide a benchledger manifest so the frontend can list available databases." />
      )}
    </>
  );
}
