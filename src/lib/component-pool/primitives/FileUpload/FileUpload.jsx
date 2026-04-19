import { useRef, useState, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";
import { formatBytes } from "../../utils/format.js";

/**
 * FileUpload — a styled file input with file list, size / type validation,
 * and optional image preview thumbnails.
 *
 * @param {function}  onChange          - (files: File[]) => void
 * @param {string[]}  [accept]          - MIME types e.g. ["image/*", "application/pdf"]
 * @param {boolean}   [multiple=false]
 * @param {number}    [maxSize]         - Max file size in bytes
 * @param {number}    [maxFiles]        - Max number of files
 * @param {boolean}   [showPreview=true]
 * @param {string}    [label]
 * @param {string}    [hint]
 * @param {boolean}   [error]
 *
 * @example
 * <FileUpload
 *   label="Upload documents"
 *   accept={["application/pdf", "image/*"]}
 *   multiple
 *   maxSize={10 * 1024 * 1024}
 *   onChange={setFiles}
 * />
 */
export function FileUpload({
  onChange,
  accept       = [],
  multiple     = false,
  maxSize,
  maxFiles,
  showPreview  = true,
  label,
  hint,
  error: errorProp,
  className,
}) {
  const id         = useId();
  const inputRef   = useRef(null);
  const [files,    setFiles]  = useState([]);
  const [errors,   setErrors] = useState([]);

  const validate = useCallback((fileList) => {
    const errs = [];
    const valid = [];
    Array.from(fileList).forEach((f) => {
      if (maxSize && f.size > maxSize) {
        errs.push(`${f.name}: exceeds ${formatBytes(maxSize)}`);
      } else if (accept.length && !accept.some(a => {
        if (a.endsWith("/*")) return f.type.startsWith(a.replace("/*", "/"));
        return f.type === a;
      })) {
        errs.push(`${f.name}: unsupported file type`);
      } else {
        valid.push(f);
      }
    });
    return { valid, errs };
  }, [maxSize, accept]);

  const processFiles = useCallback((fileList) => {
    const { valid, errs } = validate(fileList);
    const next = multiple
      ? [...files, ...valid].slice(0, maxFiles ?? Infinity)
      : valid.slice(0, 1);
    setFiles(next);
    setErrors(errs);
    onChange?.(next);
  }, [files, multiple, maxFiles, validate, onChange]);

  const handleInput = (e) => processFiles(e.target.files);

  const removeFile = (i) => {
    const next = files.filter((_, fi) => fi !== i);
    setFiles(next);
    onChange?.(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const hasError = errorProp || errors.length > 0;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <label
        htmlFor={id}
        className={cn(
          "flex flex-col items-center justify-center w-full",
          "min-h-[100px] rounded-xl border-2 border-dashed",
          "cursor-pointer transition-colors duration-150",
          "bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800",
          hasError
            ? "border-red-400 dark:border-red-500"
            : "border-gray-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500",
        )}
      >
        <div className="flex flex-col items-center gap-2 py-6 px-4 text-center pointer-events-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-400 dark:text-zinc-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5v-9m0 0l-3.75 3.75M12 7.5l3.75 3.75M3 17.25V21h18v-3.75M3 12.75V3h18v9.75"/>
          </svg>
          <div>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span>
              {" "}or drag & drop
            </p>
            {hint && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{hint}</p>}
            {accept.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                {accept.join(", ")}
                {maxSize && ` · max ${formatBytes(maxSize)}`}
              </p>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple={multiple}
          accept={accept.join(",")}
          onChange={handleInput}
          className="sr-only"
        />
      </label>

      {/* Errors */}
      {errors.map((e, i) => (
        <p key={i} className="mt-1 text-xs text-red-600 dark:text-red-400">{e}</p>
      ))}

      {/* File list */}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((f, i) => {
            const isImage = f.type.startsWith("image/");
            const preview = isImage ? URL.createObjectURL(f) : null;
            return (
              <li key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                {showPreview && isImage && preview ? (
                  <img src={preview} alt={f.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-400">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{f.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{formatBytes(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors focus:outline-none"
                  aria-label={`Remove ${f.name}`}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}