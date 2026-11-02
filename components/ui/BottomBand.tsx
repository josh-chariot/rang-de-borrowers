import type { ReactNode } from "react";
import { cn } from "./cn";
import { Button } from "./Button";
import { Icon } from "./Icon";

const SHELL = "flex w-full items-center justify-center gap-r3 border-2 border-text-grey-8 bg-white-100 px-r3 py-r2";
const LABEL = "text-h5 font-medium uppercase";

type BottomBandProps = {
  actionLabel: string;
  onAction?: () => void;
  className?: string;
} & (
  | {
      /** "How much is left" band with a progress bar. */
      variant: "progress";
      title: string;
      goalLabel: string;
      /** 0 to 1. */
      progress: number;
    }
  | {
      /** Returns + tenure band. */
      variant: "returns";
      returnsValue: string;
      returnsLabel?: string;
      tenureValue: string;
      tenureLabel?: string;
    }
);

export function BottomBand(props: BottomBandProps) {
  const { actionLabel, onAction, className } = props;
  const pct = props.variant === "progress" ? Math.min(Math.max(props.progress, 0), 1) * 100 : 0;

  return (
    <div className={cn(SHELL, className)}>
      {props.variant === "progress" ? (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-f1">
          <p className="w-full text-p4 font-bold text-text-grey-100">{props.title}</p>
          <div className="flex w-full items-center gap-2">
            <span className={cn(LABEL, "whitespace-nowrap text-text-grey-64")}>{props.goalLabel}</span>
            <div className="h-x6 min-w-0 flex-1 overflow-clip rounded-full bg-text-grey-8">
              <div className="h-x6 rounded-full bg-progress-lime" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex flex-col gap-f1">
            <p className="whitespace-nowrap text-p4 font-bold text-text-grey-100">{props.returnsValue}</p>
            <p className={cn(LABEL, "text-text-grey-48")}>{props.returnsLabel ?? "XIRR"}</p>
          </div>
          <div className="flex flex-col gap-f1">
            <p className="whitespace-nowrap text-p4 font-bold text-text-grey-100">{props.tenureValue}</p>
            <p className={cn(LABEL, "text-text-grey-64")}>{props.tenureLabel ?? "Tenure"}</p>
          </div>
        </div>
      )}
      <Button size="sm" className="flex-1" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

type CartBandProps = {
  /** Small avatar images, e.g. the investees in the cart. */
  avatars?: string[];
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the label / arrow area is pressed (expand the cart). */
  onExpand?: () => void;
  className?: string;
  children?: ReactNode;
};

export function CartBand({
  avatars = [],
  label,
  actionLabel = "Pay",
  onAction,
  onExpand,
  className,
}: CartBandProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between bg-primary-100 px-r3 py-4 shadow-band",
        className,
      )}
    >
      <button type="button" onClick={onExpand} className="flex min-w-0 items-center gap-2 text-left">
        <span className="flex">
          {avatars.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic remote avatar
            <img
              key={src}
              src={src}
              alt=""
              className={cn(
                "size-x24 rounded-full border border-white-100 object-cover",
                i > 0 && "-ml-f1",
              )}
            />
          ))}
        </span>
        <span className="flex items-center gap-r0 text-p3 font-bold text-white-100">
          {label}
          <Icon name="cart-arrow" />
        </span>
      </button>
      <Button size="sm" tone="white" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
