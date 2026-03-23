import React from "react";
import clsx from "clsx";

interface SegmentedToggleProps {
  value: "left" | "right";
  onChange: (v: "left" | "right") => void;
  leftLabel: string;
  rightLabel: string;
  leftActiveClass: string;
  rightActiveClass: string;
}

export const SegmentedToggle: React.FC<SegmentedToggleProps> = ({
  value,
  onChange,
  leftLabel,
  rightLabel,
  leftActiveClass,
  rightActiveClass,
}) => (
  <div className="inline-flex rounded-xl overflow-hidden border border-dark-shadow dark:border-dark-dark-shadow select-none h-11">
    <button
      type="button"
      onClick={() => onChange("left")}
      className={clsx(
        "px-4 text-sm font-semibold flex items-center",
        value === "left"
          ? leftActiveClass
          : "bg-plate dark:bg-dark-s1 text-gray-700 dark:text-dark-t1"
      )}
    >
      {leftLabel}
    </button>
    <button
      type="button"
      onClick={() => onChange("right")}
      className={clsx(
        "px-4 text-sm font-semibold flex items-center",
        value === "right"
          ? rightActiveClass
          : "bg-plate dark:bg-dark-s1 text-gray-700 dark:text-dark-t1"
      )}
    >
      {rightLabel}
    </button>
  </div>
);
