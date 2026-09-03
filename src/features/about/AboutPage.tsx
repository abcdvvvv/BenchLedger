import { FaGithub } from "react-icons/fa";
import { PageHeader } from "../../components/common/PageHeader";
import { IconButton } from "../../components/ui/IconButton";

type AboutPageProps = {
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

      <div className="inline-flex items-center gap-2 text-[1rem] leading-6 text-[var(--color-text-theme-strong)]">
        <span className="font-semibold">{applicationName}</span>
        <span className="font-mono text-[0.98rem]">v{version}</span>
        <IconButton
          href={repositoryUrl}
          target="_blank"
          rel="noreferrer"
          label="Open repository on GitHub"
          variant="ghost"
          className="size-8"
        >
          <FaGithub className="size-5" aria-hidden="true" />
        </IconButton>
      </div>
    </>
  );
}
