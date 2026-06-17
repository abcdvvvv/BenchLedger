import { useEffect, useState } from "react";
import { formatDate } from "../lib/format";
import { FiMoon, FiSun } from "react-icons/fi";
import {
  databaseTitle,
  metadataTitle,
  sourceSummary,
  type ActivePage,
  type ThemeMode
} from "../lib/dashboard";
import type {
  BenchmarkRun,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset
} from "../lib/types";

type AppSidebarProps = {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  sourceDatabases: BenchLedgerManifestDatabase[];
  selectedDatabaseId: string;
  onDatabaseChange: (databaseId: string) => void | Promise<void>;
  dataset: LoadedBenchmarkDataset | null;
  currentMetadata: BenchLedgerMetadata | null;
  theme: ThemeMode;
  onThemeToggle: () => void;
  latestRun: BenchmarkRun | null;
  assetBaseUrl: string;
  siteTitle: string;
};

const navigationItems: Array<{ page: ActivePage; label: string }> = [
  { page: "overview", label: "Dashboard" },
  { page: "trend-board", label: "Trend Board" },
  { page: "benchmark-keys", label: "Benchmark Keys" },
  { page: "chart-tuning", label: "Chart Tuning" },
  { page: "database-catalog", label: "Databases" }
];

function resolveLogoUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return null;
  try {
    return new URL(trimmed, window.location.href).toString();
  } catch {
    return null;
  }
}

export function AppSidebar(props: AppSidebarProps) {
  const {
    activePage,
    onPageChange,
    sourceDatabases,
    selectedDatabaseId,
    onDatabaseChange,
    dataset,
  currentMetadata,
  theme,
  onThemeToggle,
  latestRun,
  assetBaseUrl,
  siteTitle
  } = props;
  const ThemeIcon = theme === "dark" ? FiSun : FiMoon;
  const defaultLogoSrc = `${assetBaseUrl}${theme === "dark" ? "LightLogo.png" : "DarkLogo.png"}`;
  const defaultLogoHref = "https://github.com/abcdvvvv/BenchLedger";
  const customLogoUrl = currentMetadata?.logo_url.trim() || "";
  const customProjectUrl = currentMetadata?.project_url.trim() || "";
  const resolvedCustomLogoUrl = resolveLogoUrl(customLogoUrl);
  const [brandLogoKind, setBrandLogoKind] = useState<"rectangular" | "square">("rectangular");
  const [customLogoFailed, setCustomLogoFailed] = useState(false);

  useEffect(() => {
    if (!resolvedCustomLogoUrl) {
      setBrandLogoKind("rectangular");
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      const height = image.naturalHeight || 1;
      setBrandLogoKind(image.naturalWidth / height > 1.5 ? "rectangular" : "square");
    };
    image.onerror = () => {
      if (cancelled) return;
      setBrandLogoKind("rectangular");
    };
    image.src = resolvedCustomLogoUrl;

    return () => {
      cancelled = true;
    };
  }, [resolvedCustomLogoUrl]);

  useEffect(() => {
    setCustomLogoFailed(false);
  }, [resolvedCustomLogoUrl]);

  const isCustomLogo = Boolean(resolvedCustomLogoUrl) && !customLogoFailed;
  const brandHref = isCustomLogo ? customProjectUrl : defaultLogoHref;
  const brandLogoSrc = isCustomLogo ? resolvedCustomLogoUrl! : defaultLogoSrc;
  const brandName = currentMetadata ? metadataTitle(currentMetadata) : siteTitle;
  const isSquareLogo = isCustomLogo && brandLogoKind === "square";
  const brandLogo = (
    <img
      className={`brand-logo${isSquareLogo ? " brand-logo-square" : " brand-logo-rect"}`}
      src={brandLogoSrc}
      alt={brandName}
      onError={() => {
        if (isCustomLogo) setCustomLogoFailed(true);
      }}
    />
  );

  return (
    <aside className="sidebar">
      <div className={`brand${isSquareLogo ? " brand-square" : " brand-rect"}`}>
        {brandHref ? (
          <a className="brand-link" href={brandHref} target="_blank" rel="noreferrer">
            {brandLogo}
          </a>
        ) : brandLogo}
        {isSquareLogo ? (
          <div className="brand-copy">
            <strong>{brandName}</strong>
          </div>
        ) : null}
      </div>
      <nav className="nav-section">
        <span className="nav-label">Navigation</span>
        {navigationItems.map((item) => (
          <button
            key={item.page}
            type="button"
            className={`nav-item${activePage === item.page ? " nav-item-active" : ""}`}
            onClick={() => onPageChange(item.page)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {sourceDatabases.length > 1 ? (
        <nav className="nav-section">
          <span className="nav-label">Data Source</span>
          <div className="sidebar-controls">
            <label className="sidebar-field">
              <span className="field-label">Database</span>
              <select
                value={selectedDatabaseId}
                onChange={(event) => {
                  void onDatabaseChange(event.target.value);
                }}
              >
                {sourceDatabases.map((database) => <option key={database.id} value={database.id}>{databaseTitle(database)}</option>)}
              </select>
            </label>
          </div>
        </nav>
      ) : null}
      <div className="sidebar-note subtle-card">
        <strong>Source</strong>
        <span>{sourceSummary(dataset)}</span>
        {currentMetadata?.updated_at ? <p>Updated {formatDate(currentMetadata.updated_at)}</p> : null}
      </div>
      <div className="sidebar-footer">
        <button
          type="button"
          className="theme-icon-button"
          onClick={onThemeToggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <ThemeIcon aria-hidden="true" />
        </button>
        <div className="operator">
          <div className="operator-avatar">BL</div>
          <div>
            <strong>{latestRun?.machine_id ?? dataset?.source_label ?? "No database"}</strong>
            <span>{latestRun ? formatDate(latestRun.date) : "No benchmark run"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
