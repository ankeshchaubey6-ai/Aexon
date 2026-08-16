import { useState, useRef, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";
import { formatBytes } from "../../utils/format.js";

/**
 * Dropzone — a drag-and-drop area for file uploads.
 * More prominent than FileUpload — used when file dropping is the primary action.
 *
 * @param {function}  onDrop            - (files: File[]) => void
 * @param {string[]}  [accept]
 * @param {boolean}   [multiple=true]
 * @param {number}    [maxSize]
 * @param {string}    [label]
 * @param {boolean}   [disabled=false]
 * @param {React.ReactNode} [children]  - Custom inner content
 *
 * @example
 * <Dropzone
 *   onDrop={(files) => uploadFiles(files)}
 *   accept={["image/*"]}
 *   multiple
 *   maxSize={5 * 1024 * 1024}
 *   label="Drop images here"
 * />
 */
export function Dropzone({
  onDrop,
  accept    = [],
  multiple  = true,
  maxSize,
  label     = "Drop files here",
  disabled  = false,
  children,
  className,
}) {
  const [dragging,  setDragging]  = useState(false);
  const [dropped,   setDropped]   = useState([]);
  const [errors,    setErrors]    = useState([]);
  const inputRef = useRef(null);
  const id       = useId();
  const counter  = useRef(0); // track nested dragenter/dragleave

  const validateAndProcess = useCallback((fileList) => {
    const valid = [], errs = [];
    Array.from(fileList).forEach((f) => {
      if (maxSize && f.size > maxSize) {
        errs.push(`${f.name} is too large (max ${formatBytes(maxSize)})`);
      } else if (accept.length && !accept.some(a => {
        if (a.endsWith("/*")) return f.type.startsWith(a.replace("/*", "/"));
        return f.type === a;
      })) {
        errs.push(`${f.name}: unsupported type`);
      } else {
        valid.push(f);
      }
    });
    const next = multiple ? valid : valid.slice(0, 1);
    setDropped(next);
    setErrors(errs);
    onDrop?.(next);
  }, [accept, maxSize, multiple, onDrop]);

  const onDragEnter = (e) => {
    e.preventDefault();
    counter.current++;
    if (!disabled) setDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    counter.current--;
    if (counter.current === 0) setDragging(false);
  };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDropEvent = (e) => {
    e.preventDefault();
    counter.current = 0;
    setDragging(false);
    if (disabled) return;
    validateAndProcess(e.dataTransfer.files);
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDropEvent}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center",
          "min-h-[180px] rounded-2xl border-2 border-dashed",
          "transition-all duration-200 cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          dragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950 scale-[1.01]"
            : "border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-100 dark:hover:bg-zinc-800",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple={multiple}
          accept={accept.join(",")}
          disabled={disabled}
          onChange={(e) => validateAndProcess(e.target.files)}
          className="sr-only"
        />

        {children ?? (
          <div className="flex flex-col items-center gap-3 py-8 px-6 text-center pointer-events-none select-none">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
              dragging ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500",
            )}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V7.5m0 0l-4 4m4-4l4 4M3 15.75v3A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75v-3"/>
              </svg>
            </div>
            <div>
              <p className={cn("text-sm font-semibold", dragging ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-zinc-200")}>
                {dragging ? "Release to drop" : label}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                or <span className="text-blue-600 dark:text-blue-400">browse files</span>
              </p>
              {(accept.length > 0 || maxSize) && (
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {accept.join(", ")}{maxSize && ` · max ${formatBytes(maxSize)}`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.map((e, i) => <p key={i} className="mt-1.5 text-xs text-red-600 dark:text-red-400">{e}</p>)}

      {/* Dropped file names */}
      {dropped.length > 0 && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ {dropped.length} file{dropped.length > 1 ? "s" : ""} selected
          ({dropped.map(f => f.name).join(", ")})
        </p>
      )}
    </div>
  );
}