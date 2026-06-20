export function EmptyState(props: { title: string; description?: string; className?: string }) {
  return (
    <div className={props.className ?? "surface-empty pad-empty flex min-h-60 flex-col items-center justify-center text-center"}>
      <strong className="type-card-title">{props.title}</strong>
      {props.description ? <p className="type-body-muted mt-2 max-w-xl">{props.description}</p> : null}
    </div>
  );
}
