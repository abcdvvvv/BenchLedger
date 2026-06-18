import {
  Popover,
  PopoverDisclosure,
  usePopoverStore,
  useStoreState
} from "@ariakit/react";
import { useEffect, useRef } from "react";
import { openNativeDatePicker } from "../lib/dashboard";

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
        className={`date-range-summary${disabled ? " date-range-summary-disabled" : ""}`}
        disabled={disabled}
      >
        <strong>{label}</strong>
        <em aria-hidden="true">▾</em>
      </PopoverDisclosure>
      <Popover
        store={popover}
        gutter={8}
        flip
        slide
        fitViewport
        overflowPadding={16}
        unmountOnHide
        className="date-range-popover"
      >
        <label className="date-range-input">
          <span className="field-label">Start</span>
          <input
            ref={timeStartInputRef}
            type="date"
            value={timeStart}
            min={datasetTimeStart}
            max={timeEnd || datasetTimeEnd}
            onChange={(event) => onTimeStartChange(event.target.value)}
          />
        </label>
        <label className="date-range-input">
          <span className="field-label">End</span>
          <input
            type="date"
            value={timeEnd}
            min={timeStart || datasetTimeStart}
            max={datasetTimeEnd}
            onChange={(event) => onTimeEndChange(event.target.value)}
          />
        </label>
      </Popover>
    </>
  );
}
