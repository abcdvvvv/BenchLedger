import {
  Popover,
  PopoverDisclosure,
  usePopoverStore,
  useStoreState
} from "@ariakit/react";
import { useEffect, useRef } from "react";
import { openNativeDatePicker } from "../../../lib/dashboard";
import { InputField } from "../../../components/ui/Field";
import { DisclosureTriggerContent, menuTriggerClassName } from "../../../components/ui/Menu";

type TimeRangePopoverProps = {
  disabled: boolean;
  label: string;
  timeStart: string;
  timeEnd: string;
  datasetTimeStart: string;
  datasetTimeEnd: string;
  onTimeStartChange: (value: string) => void;
  onTimeEndChange: (value: string) => void;
};

export function TimeRangePopover(props: TimeRangePopoverProps) {
  const {
    disabled,
    label,
    timeStart,
    timeEnd,
    datasetTimeStart,
    datasetTimeEnd,
    onTimeStartChange,
    onTimeEndChange
  } = props;
  const popover = usePopoverStore({ placement: "bottom-end" });
  const open = useStoreState(popover, "open");
  const timeStartInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || disabled) return;
    window.requestAnimationFrame(() => openNativeDatePicker(timeStartInputRef.current));
  }, [disabled, open]);

  return (
    <>
      <PopoverDisclosure
        store={popover}
        className={menuTriggerClassName({ disabled })}
        disabled={disabled}
      >
        <DisclosureTriggerContent>{label}</DisclosureTriggerContent>
      </PopoverDisclosure>
      <Popover
        store={popover}
        gutter={0}
        flip
        slide
        fitViewport
        overflowPadding={16}
        unmountOnHide
        className="surface-floating pad-panel z-50 flex w-[min(calc(100vw-2rem),calc(548px+var(--panel-padding-theme)*2+1rem))] flex-col gap-4 outline-none"
      >
        <div className="grid gap-4 sm:grid-cols-[repeat(2,minmax(274px,1fr))]">
          <label className="flex flex-col gap-2">
            <span className="type-label">Start</span>
            <InputField
              ref={timeStartInputRef}
              type="date"
              value={timeStart}
              min={datasetTimeStart}
              max={timeEnd || datasetTimeEnd}
              onChange={(event) => onTimeStartChange(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="type-label">End</span>
            <InputField
              type="date"
              value={timeEnd}
              min={timeStart || datasetTimeStart}
              max={datasetTimeEnd}
              onChange={(event) => onTimeEndChange(event.target.value)}
            />
          </label>
        </div>
      </Popover>
    </>
  );
}
