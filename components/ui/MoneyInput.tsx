"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "onChange" | "className"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Marca o campo como inválido (borda vermelha + aria-invalid). */
  invalid?: boolean;
  /** Classes do contêiner (largura, grid etc.). */
  className?: string;
  /** Versão compacta (tabelas): menos padding vertical e cantos menores. */
  compact?: boolean;
  /** Classes extras do campo (ex.: alinhamento do texto). */
  inputClassName?: string;
};

/**
 * Campo de valor em reais: teclado numérico com vírgula (inputMode="decimal"), prefixo R$
 * e fonte de 16px (evita o zoom automático do iOS ao focar). Converta com `parseBRL`.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, invalid = false, compact = false, className = "", inputClassName = "", placeholder = "0,00", ...rest },
  ref,
) {
  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-zinc-500"
      >
        R$
      </span>
      <input
        ref={ref}
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(event) => onValueChange(event.target.value)}
        className={`w-full border bg-zinc-950 pl-10 pr-3 text-base text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 ${
          compact ? "rounded py-1" : "rounded-xl py-2"
        } ${
          invalid ? "border-rose-500" : "border-zinc-700"
        } ${inputClassName}`}
      />
    </div>
  );
});
