import { Banner } from "../../components/common/Banner";
import { Button } from "../../components/ui/Button";

export function DimensionSelectorInvalidBanner(props: { issues: string[]; onOpenDimensionSelector: () => void; }) {
  return <Banner tone="negative" title="Dimension Selector configuration is invalid" description={props.issues.join(" ")} action={<Button variant="secondary" onClick={props.onOpenDimensionSelector}>Open Dimension Selector</Button>} />;
}
