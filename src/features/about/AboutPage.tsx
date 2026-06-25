import { PageHeader } from "../../components/common/PageHeader";

export type AboutPageProps = {
  applicationName: string;
  version: string;
  repositoryUrl: string;
};

export function AboutPage(props: AboutPageProps) {
  const { applicationName, version, repositoryUrl } = props;

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › About"
        title="About"
        description="Basic information about this BenchLedger frontend."
      />

      <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
        <dt className="text-[1rem] leading-6 font-semibold text-[var(--color-text-theme-strong)]">Software</dt>
        <dd className="min-w-0 text-[1rem] leading-6 text-[var(--color-text-theme-strong)] sm:m-0">
          {applicationName}
        </dd>

        <dt className="text-[1rem] leading-6 font-semibold text-[var(--color-text-theme-strong)]">Version</dt>
        <dd className="min-w-0 font-mono text-[0.98rem] leading-6 text-[var(--color-text-theme-strong)] sm:m-0">
          {version}
        </dd>

        <dt className="text-[1rem] leading-6 font-semibold text-[var(--color-text-theme-strong)]">Repository</dt>
        <dd className="min-w-0 text-[1rem] leading-6 sm:m-0">
          <a
            className="text-theme-brand underline underline-offset-2"
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            {repositoryUrl}
          </a>
        </dd>
      </dl>
    </>
  );
}
