/*
-- ===================================================
-- Código             : /src/components/ui/TimePicker.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-11 21:26 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Seletor de hora (HH:mm) com colunas separadas (hora/minuto) e controle de posição/altura.
-- Fluxo              : EditActionForm / ScheduleActionModal → TimePickerRHF
-- Alterações (1.0.0) :
--   • Componente com Popover do Radix (2 colunas, step configurável, altura/offset configuráveis).
--   • Wrapper para react-hook-form (TimePickerRHF).
-- Dependências        : react, react-hook-form, @radix-ui/react-popover, lucide-react, tailwind
-- ===================================================
*/

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Control, Controller, FieldPath, FieldValues } from "react-hook-form";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import clsx from "clsx";

/* ---------------- Utils ---------------- */
const pad2 = (n: number) => String(n).padStart(2, "0");

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function splitValue(value?: string | null) {
  const [h, m] = (value || "00:00").split(":").map((v) => parseInt(v, 10));
  return { hours: isNaN(h) ? 0 : h, minutes: isNaN(m) ? 0 : m };
}

/* ---------------- Componente ---------------- */
export interface TimePickerProps {
  value?: string | null;                 // "HH:mm"
  onChange?: (v: string) => void;
  label?: string;
  placeholder?: string;
  minuteStep?: number;                   // default 15
  dropdownMaxHeight?: number;            // px, default 240
  side?: "top" | "bottom" | "left" | "right"; // default "bottom"
  sideOffset?: number;                   // default 6
  align?: "start" | "center" | "end";    // default "start"
  className?: string;
  disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = "Selecione...",
  minuteStep = 15,
  dropdownMaxHeight = 240,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  className,
  disabled,
}) => {
  const step = clamp(Math.floor(minuteStep), 1, 60);
  const minutes = React.useMemo(
    () => Array.from({ length: Math.floor(60 / step) }, (_, i) => i * step),
    [step]
  );
  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const { hours: hSel, minutes: mSel } = splitValue(value);

  const [open, setOpen] = React.useState(false);
  const [hTmp, setHTmp] = React.useState(hSel);
  const [mTmp, setMTmp] = React.useState(mSel);

  React.useEffect(() => {
    const { hours: hh, minutes: mm } = splitValue(value);
    setHTmp(hh);
    setMTmp(mm);
  }, [value]);

  const commit = (h: number, m: number) => {
    const v = `${pad2(h)}:${pad2(m)}`;
    onChange?.(v);
  };

  const confirmAndClose = () => {
    commit(hTmp, mTmp);
    setOpen(false);
  };

  return (
    <div className={clsx("w-full", className)}>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={disabled}
          className={clsx(
            "w-full h-11 px-3 rounded-lg text-left",
            "bg-gray-50 dark:bg-dark-s2 border border-gray-200 dark:border-dark-bmd",
            "dark:text-dark-t1",
            "focus:outline-none focus:ring-2 focus:ring-accent/30 dark:focus:ring-accent/30",
            "flex items-center justify-between"
          )}
        >
          <span className={clsx("truncate", !value && "text-gray-400")}>
            {value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-80" />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className={clsx(
              "z-[3000] rounded-xl border border-gray-200 dark:border-dark-bmd",
              "shadow-sh1 [[data-theme='sepia']_&]:shadow-[0_4px_16px_rgba(0,0,0,0.10)]",
              "[[data-theme='sepia']_&]:border-[rgba(59,42,20,0.15)]",
              "bg-white dark:bg-dark-s1 p-2"
            )}
          >
            <div className="grid grid-cols-2 gap-2 min-w-[220px]">
              {/* Coluna Horas */}
              <div
                className="rounded-lg bg-gray-50 dark:bg-dark-s2 overflow-auto"
                style={{ maxHeight: dropdownMaxHeight }}
              >
                <div className="sticky top-0 z-10 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-dark-s3 dark:text-dark-t2">
                  Hora
                </div>
                <ul className="py-1 text-[12px]">
                  {hours.map((h) => (
                    <li key={h}>
                      <button
                        type="button"
                        className={clsx(
                          "w-full text-left px-3 py-2 rounded-[6px]",
                          "text-gray-600 dark:text-dark-t2 [[data-theme='sepia']_&]:text-[#3b2e1a]",
                          "hover:bg-gray-200 dark:hover:bg-dark-s3 dark:hover:text-dark-t1",
                          "[[data-theme='sepia']_&]:hover:bg-[#3b68f5] [[data-theme='sepia']_&]:hover:text-white",
                          hTmp === h && "bg-blue-50 dark:bg-accent/[0.12] font-medium text-blue-700 dark:text-accent",
                          hTmp === h && "[[data-theme='sepia']_&]:bg-[rgba(59,104,245,0.10)] [[data-theme='sepia']_&]:text-[#3b68f5] [[data-theme='sepia']_&]:font-medium"
                        )}
                        onClick={() => setHTmp(h)}
                      >
                        {pad2(h)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Coluna Minutos */}
              <div
                className="rounded-lg bg-gray-50 dark:bg-dark-s2 overflow-auto"
                style={{ maxHeight: dropdownMaxHeight }}
              >
                <div className="sticky top-0 z-10 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-dark-s3 dark:text-dark-t2">
                  Minuto
                </div>
                <ul className="py-1 text-[12px]">
                  {minutes.map((m) => (
                    <li key={m}>
                      <button
                        type="button"
                        className={clsx(
                          "w-full text-left px-3 py-2 rounded-[6px]",
                          "text-gray-600 dark:text-dark-t2 [[data-theme='sepia']_&]:text-[#3b2e1a]",
                          "hover:bg-gray-200 dark:hover:bg-dark-s3 dark:hover:text-dark-t1",
                          "[[data-theme='sepia']_&]:hover:bg-[#3b68f5] [[data-theme='sepia']_&]:hover:text-white",
                          mTmp === m && "bg-blue-50 dark:bg-accent/[0.12] font-medium text-blue-700 dark:text-accent",
                          mTmp === m && "[[data-theme='sepia']_&]:bg-[rgba(59,104,245,0.10)] [[data-theme='sepia']_&]:text-[#3b68f5] [[data-theme='sepia']_&]:font-medium"
                        )}
                        onClick={() => setMTmp(m)}
                      >
                        {pad2(m)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-2 text-sm opacity-80">
                <Clock className="h-4 w-4" />
                <span>
                  {pad2(hTmp)}:{pad2(mTmp)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid #c4a882',
                    borderRadius: '8px',
                    color: '#9a7d5a',
                    padding: '7px 15px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setHTmp(hSel);
                    setMTmp(mSel);
                    setOpen(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="bg-[#3b68f5] text-white rounded-lg text-[13px] font-medium px-[15px] py-[7px] transition-all duration-200 hover:opacity-[0.88]"
                  onClick={confirmAndClose}
                >
                  Aplicar
                </button>
              </div>
            </div>

            <Popover.Arrow className="fill-white dark:fill-dark-s1" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

/* ---------------- RHF Wrapper ---------------- */
type PrimitivePath<T extends FieldValues> = FieldPath<T>;
export interface TimePickerRHFProps<T extends FieldValues = any>
  extends Omit<TimePickerProps, "value" | "onChange"> {
  control: Control<T>;
  name: PrimitivePath<T>;
}

export function TimePickerRHF<T extends FieldValues = any>({
  control,
  name,
  ...rest
}: TimePickerRHFProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TimePicker value={field.value ?? ""} onChange={field.onChange} {...rest} />
      )}
    />
  );
}

export default TimePicker;
