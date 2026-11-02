import type { ReactNode } from "react";
import { cn } from "./cn";
import { Button } from "./Button";
import { Icon } from "./Icon";

export type TimelineRow = {
  label: string;
  date: string;
  /** Shows "₹ amount" with an info icon. Omit for a plain row. */
  amount?: string;
  /** Renders the date as a dotted-underline link-style text (first row in Figma). */
  dateIsLink?: boolean;
};

type CommonProps = {
  onClose?: () => void;
  className?: string;
};

type PopupProps = CommonProps &
  (
    | { variant: "default"; title: string; text: string; timeline?: TimelineRow[] }
    | { variant: "priority"; title: string; text: string }
    | { variant: "centre"; title: string; text: string; items?: string[]; showIcon?: boolean }
    | { variant: "xirr"; headline: ReactNode; text: ReactNode; note?: string }
    | {
        variant: "cta";
        text: string;
        primaryLabel: string;
        secondaryLabel?: string;
        onPrimary?: () => void;
        onSecondary?: () => void;
      }
  );

const SHELL = "relative flex w-full flex-col overflow-clip rounded-4 bg-white-100";

function CloseButton({ onClose }: { onClose?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-text-grey-32 p-2 backdrop-blur-sm"
    >
      <Icon name="close" />
    </button>
  );
}

function Rail({ srcs }: { srcs: string[] }) {
  return (
    <div className="flex w-4 flex-col self-stretch">
      {srcs.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- static SVG
        <img
          key={i}
          src={`/ui/${src}.svg`}
          alt=""
          aria-hidden="true"
          className={cn("block w-4 max-w-none", src.startsWith("timeline-line") ? "min-h-0 flex-1" : "shrink-0")}
        />
      ))}
    </div>
  );
}

function Timeline({ rows }: { rows: TimelineRow[] }) {
  return (
    <div className="flex w-full flex-col">
      {rows.map((row, i) => {
        const first = i === 0;
        const last = i === rows.length - 1;
        const rail = first
          ? ["timeline-start", "timeline-line-a"]
          : last
            ? ["timeline-line-b", "timeline-dot", "timeline-end"]
            : ["timeline-line-b", "timeline-dot", "timeline-line-b"];
        return (
          <div key={i} className="flex w-full flex-col">
            {!first && (
              // eslint-disable-next-line @next/next/no-img-element -- static SVG
              <img src="/ui/timeline-gap.svg" width={16} height={16} alt="" aria-hidden="true" />
            )}
            <div className="flex w-full items-start gap-2">
              <Rail srcs={rail} />
              <div className="flex min-w-0 flex-1 items-center justify-between">
                <span className="flex items-center gap-f1 text-p3 font-medium text-text-grey-100">
                  {row.amount ?? row.label}
                  {row.amount && <Icon name="info" />}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-p3 font-medium text-text-grey-64",
                    row.dateIsLink && "underline decoration-dotted decoration-text-grey-48 decoration-from-font",
                  )}
                >
                  {row.date}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Popup(props: PopupProps) {
  const { onClose, className } = props;

  switch (props.variant) {
    case "default":
      return (
        <div className={cn(SHELL, "items-center gap-r4 p-r5", className)}>
          <div className="flex w-full flex-col gap-f1 text-p3">
            <p className="font-black text-text-grey-100">{props.title}</p>
            <p className="font-medium text-text-grey-80">{props.text}</p>
          </div>
          {props.timeline && <Timeline rows={props.timeline} />}
          <CloseButton onClose={onClose} />
        </div>
      );

    case "priority":
      return (
        <div className={cn(SHELL, "items-start gap-r4 p-r5", className)}>
          <Icon name="flag" />
          <div className="flex w-full flex-col gap-f1">
            <p className="text-p3 font-black text-priority-purple">{props.title}</p>
            <p className="text-p3 font-medium text-text-grey-80">{props.text}</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
      );

    case "centre":
      return (
        <div className={cn(SHELL, "items-start gap-r4 p-r5", className)}>
          <div className="flex w-full flex-col gap-f1">
            <div className="flex w-full flex-col items-center gap-4">
              {(props.showIcon ?? true) && <Icon name="money-rupee-circle" />}
              <p className="text-center text-p1 font-black text-text-grey-100">{props.title}</p>
            </div>
            <p className="text-center text-p3 font-medium text-text-grey-80">{props.text}</p>
          </div>
          {props.items && (
            <ul className="flex w-full flex-col gap-4">
              {props.items.map((item, i) => (
                <li
                  key={item}
                  className={cn(
                    "text-center text-p3 font-medium text-text-grey-80",
                    i > 0 && "border-t border-text-grey-16 pt-4",
                  )}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
          <CloseButton onClose={onClose} />
        </div>
      );

    case "xirr":
      return (
        <div
          className={cn(SHELL, "items-center gap-r4 px-r4 pb-r4 pt-r8 shadow-popup", className)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
          <img
            src="/ui/xirr-ellipse.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-6 max-w-none -translate-x-1/2"
            width={770}
            height={770}
          />
          <p className="relative text-center text-h4 font-black text-green-100">{props.headline}</p>
          <p className="relative text-center text-p3 font-medium text-text-grey-80">{props.text}</p>
          {props.note && (
            <div className="relative flex w-full items-center justify-center rounded-2 bg-text-grey-8 p-x18">
              <p className="flex-1 text-center text-p3 font-medium text-text-grey-80">{props.note}</p>
            </div>
          )}
          <CloseButton onClose={onClose} />
        </div>
      );

    case "cta":
      return (
        <div className={cn(SHELL, "items-center gap-r4 p-7", className)}>
          <p className="w-full text-center text-p3 font-medium text-text-grey-80">{props.text}</p>
          <div className="flex w-full items-start justify-center gap-2">
            <Button className="flex-1" onClick={props.onPrimary}>
              {props.primaryLabel}
            </Button>
            {props.secondaryLabel && (
              <Button variant="secondary" className="flex-1" onClick={props.onSecondary}>
                {props.secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      );
  }
}
