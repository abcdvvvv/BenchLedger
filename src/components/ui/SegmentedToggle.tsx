import { cn } from "./cn";

export function SegmentedToggle<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
}) {
  const activeIndex = Math.max(props.options.findIndex(({ value }) => value === props.value), 0);
  const optionCount = Math.max(props.options.length, 1);
  return (
    <div
      className={cn(
        "control-frame surface-control relative inline-grid min-h-[2.3rem] overflow-hidden p-[0.2rem] shadow-none",
        props.className
      )}
      style={{ gridTemplateColumns: `repeat(${optionCount}, minmax(0, 1fr))` }}
      role="group"
      aria-label={props.ariaLabel}
    >
      <span
        aria-hidden="true"
        className="radius-theme absolute top-[0.2rem] bottom-[0.2rem] left-[0.2rem] z-0 transition-transform"
        style={{
          width: `calc((100% - 0.4rem) / ${optionCount})`,
          transform: `translateX(${activeIndex * 100}%)`,
          backgroundColor: "var(--color-text-theme-brand)"
        }}
      />
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "radius-theme relative z-10 border-0 bg-transparent text-center text-[0.82rem] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
              active ? "text-stone-950" : "text-stone-500 dark:text-stone-400",
              props.buttonClassName
            )}
            onClick={() => props.onChange(option.value)}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
