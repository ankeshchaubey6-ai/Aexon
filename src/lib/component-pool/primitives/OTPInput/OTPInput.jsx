import { useRef, useState, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * OTPInput — a one-time password / verification code input.
 * Auto-advances on digit entry, handles paste, backspace navigation.
 *
 * @param {number}   [length=6]        - Number of digits
 * @param {string}   [value]           - Controlled value (full string)
 * @param {function} [onChange]        - (value: string) => void
 * @param {function} [onComplete]      - Called when all digits are filled
 * @param {"numeric"|"alphanumeric"}   [type="numeric"]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {boolean}  [disabled]
 * @param {boolean}  [error]
 * @param {boolean}  [masked=false]    - Show as password (*)
 *
 * @example
 * const [code, setCode] = useState("");
 * <OTPInput
 *   length={6}
 *   value={code}
 *   onChange={setCode}
 *   onComplete={(v) => verifyCode(v)}
 *   error={isInvalid}
 * />
 */
export function OTPInput({
  length     = 6,
  value      = "",
  onChange,
  onComplete,
  type       = "numeric",
  size       = "md",
  disabled   = false,
  error      = false,
  masked     = false,
  className,
  ...props
}) {
  const inputsRef = useRef([]);
  const id        = useId();

  // Split controlled value into slots
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const pattern = type === "numeric" ? /^\d$/ : /^[a-zA-Z0-9]$/;

  const focusAt = useCallback((i) => {
    inputsRef.current[Math.max(0, Math.min(i, length - 1))]?.focus();
  }, [length]);

  const updateDigit = useCallback((index, char) => {
    const next = digits.slice();
    next[index] = char;
    const str = next.join("");
    onChange?.(str);
    if (char && index < length - 1) focusAt(index + 1);
    if (str.length === length && !str.includes("")) onComplete?.(str);
  }, [digits, length, onChange, onComplete, focusAt]);

  const handleKeyDown = useCallback((e, i) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        updateDigit(i, "");
      } else {
        focusAt(i - 1);
        updateDigit(i - 1, "");
      }
    }
    if (e.key === "ArrowLeft")  { e.preventDefault(); focusAt(i - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); focusAt(i + 1); }
  }, [digits, updateDigit, focusAt]);

  const handleChange = useCallback((e, i) => {
    const char = e.target.value.slice(-1);
    if (!char || !pattern.test(char)) return;
    updateDigit(i, char.toUpperCase());
  }, [pattern, updateDigit]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, length);
    const chars  = pasted.split("").filter(c => pattern.test(c));
    const next   = digits.slice();
    chars.forEach((c, idx) => { if (idx < length) next[idx] = c.toUpperCase(); });
    const str = next.join("");
    onChange?.(str);
    const lastFilled = Math.min(chars.length, length - 1);
    focusAt(lastFilled);
    if (str.replace(/\s/g, "").length === length) onComplete?.(str);
  }, [digits, length, pattern, onChange, onComplete, focusAt]);

  const boxSize = {
    sm: "w-8  h-10 text-base",
    md: "w-10 h-12 text-xl",
    lg: "w-12 h-14 text-2xl",
  }[size] ?? "w-10 h-12 text-xl";

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          id={i === 0 ? id : undefined}
          type={masked ? "password" : "text"}
          inputMode={type === "numeric" ? "numeric" : "text"}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e)  => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={cn(
            "flex-shrink-0 text-center font-semibold rounded-xl border-2",
            "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100",
            "transition-colors duration-150 outline-none",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            boxSize,
            error
              ? "border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400"
              : digit
              ? "border-blue-400 dark:border-blue-500"
              : "border-gray-200 dark:border-zinc-700",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
      ))}
    </div>
  );
}