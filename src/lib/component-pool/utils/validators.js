// ─────────────────────────────────────────────
// Primitive checks
// ─────────────────────────────────────────────

/** True if value is not null, undefined, or empty string */
export const isRequired = (v) =>
  v !== null && v !== undefined && String(v).trim() !== "";

/** True if value is a valid email address */
export const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? "").trim());

/** True if value is a valid absolute URL */
export const isURL = (v) => {
  try { new URL(v); return true; } catch { return false; }
};

/** True if value is a valid URL path (relative or absolute) */
export const isURLPath = (v) => /^(\/[^\s]*|https?:\/\/[^\s]+)$/.test(v);

/** True if value looks like a phone number (7–15 digits, allows +, spaces, dashes, parens) */
export const isPhone = (v) =>
  /^\+?[\d\s\-().]{7,15}$/.test(String(v ?? "").trim());

/** True if value is a number (string or number) */
export const isNumber = (v) =>
  !Number.isNaN(parseFloat(v)) && isFinite(Number(v));

/** True if value is an integer */
export const isInteger = (v) => Number.isInteger(Number(v));

/** True if value is a positive number */
export const isPositive = (v) => isNumber(v) && Number(v) > 0;

/** True if value is a non-negative number */
export const isNonNegative = (v) => isNumber(v) && Number(v) >= 0;

/** True if string value has at least `min` characters */
export const minLength = (min) => (v) => String(v ?? "").length >= min;

/** True if string value has at most `max` characters */
export const maxLength = (max) => (v) => String(v ?? "").length <= max;

/** True if numeric value is >= min */
export const min = (minimum) => (v) => Number(v) >= minimum;

/** True if numeric value is <= max */
export const max = (maximum) => (v) => Number(v) <= maximum;

/** True if numeric value is within [min, max] inclusive */
export const inRange = (minimum, maximum) => (v) =>
  Number(v) >= minimum && Number(v) <= maximum;

/** True if value matches the given regex */
export const matches = (regex) => (v) => regex.test(String(v ?? ""));

/** True if value is in the given array of allowed values */
export const isOneOf = (allowed) => (v) => allowed.includes(v);

// ─────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────

/**
 * Strong password: 8+ chars, uppercase, lowercase, digit, special char.
 */
export const isStrongPassword = (v) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#\-_=+])[A-Za-z\d@$!%*?&^#\-_=+]{8,}$/.test(
    String(v ?? "")
  );

/**
 * Password strength score: 0 (very weak) → 4 (very strong).
 * Useful for a strength indicator bar.
 */
export function passwordStrength(v) {
  let score = 0;
  if (!v) return score;
  if (v.length >= 8)  score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[@$!%*?&^#\-_=+]/.test(v)) score++;
  return Math.min(4, score);
}

// ─────────────────────────────────────────────
// Domain / Identity
// ─────────────────────────────────────────────

/** True if value is a valid domain name (e.g. "example.com") */
export const isDomain = (v) =>
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(v);

/** True if value is a valid hex color (#rgb or #rrggbb) */
export const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

/** True if value is a valid IPv4 address */
export const isIPv4 = (v) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(v) &&
  v.split(".").every((seg) => Number(seg) <= 255);

/** True if value is a valid credit card number (Luhn algorithm) */
export function isCreditCard(v) {
  const digits = String(v).replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** True if value is a valid US ZIP code (5 digits or ZIP+4) */
export const isZipCode = (v) => /^\d{5}(-\d{4})?$/.test(v);

// ─────────────────────────────────────────────
// File
// ─────────────────────────────────────────────

/**
 * True if the File object has an accepted MIME type.
 * @param {string[]} accepted - e.g. ["image/jpeg", "image/png", "application/pdf"]
 */
export const isAcceptedFileType = (accepted) => (file) =>
  accepted.includes(file?.type);

/**
 * True if the File object is within the size limit.
 * @param {number} maxBytes - e.g. 5 * 1024 * 1024 for 5 MB
 */
export const isWithinFileSize = (maxBytes) => (file) =>
  (file?.size ?? 0) <= maxBytes;

// ─────────────────────────────────────────────
// Composite validator runner
// ─────────────────────────────────────────────

/**
 * Run a list of [validatorFn, errorMessage] pairs against a value.
 * Returns the first error message encountered, or null if all pass.
 *
 * @param {*} value
 * @param {Array<[(v:any)=>boolean, string]>} rules
 * @returns {string|null}
 *
 * @example
 * const error = validate(email, [
 *   [isRequired,  "Email is required"],
 *   [isEmail,     "Enter a valid email address"],
 *   [maxLength(255), "Email is too long"],
 * ]);
 */
export function validate(value, rules) {
  for (const [fn, message] of rules) {
    if (!fn(value)) return message;
  }
  return null;
}

/**
 * Run validators on multiple fields at once.
 * Returns an object of { fieldName: errorMessage | null }.
 *
 * @param {Record<string, any>} values
 * @param {Record<string, Array<[(v:any)=>boolean, string]>>} schema
 * @returns {Record<string, string | null>}
 *
 * @example
 * const errors = validateAll(
 *   { email: "bad", password: "" },
 *   {
 *     email:    [[isRequired, "Required"], [isEmail, "Invalid email"]],
 *     password: [[isRequired, "Required"], [minLength(8), "Min 8 chars"]],
 *   }
 * );
 */
export function validateAll(values, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    errors[field] = validate(values[field], rules);
  }
  return errors;
}

/**
 * True if a validateAll result object has no errors.
 */
export function isFormValid(errors) {
  return Object.values(errors).every((e) => e === null);
}