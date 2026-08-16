import { useState, useCallback, useRef, useMemo } from "react";

/**
 * Production form state manager.
 *
 * Features:
 *  - Field-level validation with per-field error messages
 *  - "touched" tracking — errors only shown after a field is blurred
 *  - `isDirty` — true when values differ from initial
 *  - `isValid` — true when all validators pass
 *  - Async onSubmit with loading state
 *  - `field(name)` helper that returns props for any input
 *  - `reset()` restores all state to initial
 *  - `setValues()` bulk-update (e.g. from API pre-fill)
 *  - `setErrors()` for server-side error injection
 *
 * @param {Record<string, any>} initialValues
 *   Initial field values.
 *
 * @param {Record<string, (value: any, allValues: Record<string, any>) => string | null>} [validators]
 *   Per-field validator functions. Return an error string or null.
 *
 * @returns {FormState}
 *
 * @example
 * const form = useForm(
 *   { email: "", password: "" },
 *   {
 *     email:    (v) => !v ? "Required" : !isEmail(v) ? "Invalid email" : null,
 *     password: (v) => !v ? "Required" : v.length < 8 ? "Min 8 chars" : null,
 *   }
 * );
 *
 * <form onSubmit={form.handleSubmit(async (values) => await login(values))}>
 *   <Input {...form.field("email")} label="Email" error={form.errors.email} />
 *   <Button type="submit" loading={form.isSubmitting}>Sign in</Button>
 * </form>
 */
export function useForm(initialValues = {}, validators = {}) {
  const initialRef = useRef(initialValues);

  const [values,      setValuesState]  = useState(initialValues);
  const [errors,      setErrors]       = useState({});
  const [touched,     setTouched]      = useState({});
  const [isSubmitting,setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount]  = useState(0);
  const [submitError, setSubmitError]  = useState(null);

  const validatorsRef = useRef(validators);
  validatorsRef.current = validators;

  // ── Derived state ─────────────────────────────────────────────────────────

  const isDirty = useMemo(() =>
    Object.keys(values).some(k => values[k] !== initialRef.current[k]),
    [values]
  );

  const isValid = useMemo(() => {
    for (const [field, fn] of Object.entries(validatorsRef.current)) {
      if (fn(values[field], values)) return false;
    }
    return true;
  }, [values]);

  // ── Field setter ──────────────────────────────────────────────────────────

  const setValue = useCallback((name, value) => {
    setValuesState(prev => {
      const next = { ...prev, [name]: value };
      // Validate this field if already touched
      const fn = validatorsRef.current[name];
      if (fn) {
        setErrors(e => ({ ...e, [name]: fn(value, next) }));
      }
      return next;
    });
  }, []);

  /** Set multiple values at once (e.g. pre-fill from API) */
  const setValues = useCallback((partial) => {
    setValuesState(prev => ({ ...prev, ...partial }));
  }, []);

  // ── Touch handler ─────────────────────────────────────────────────────────

  const touch = useCallback((name) => {
    setTouched(t => ({ ...t, [name]: true }));
    const fn = validatorsRef.current[name];
    if (fn) {
      setErrors(e => ({
        ...e,
        [name]: fn(values[name], values),
      }));
    }
  }, [values]);

  /** Mark all fields as touched (used before submission) */
  const touchAll = useCallback(() => {
    const allTouched = Object.fromEntries(Object.keys(validatorsRef.current).map(k => [k, true]));
    setTouched(allTouched);
  }, []);

  // ── Full validation ───────────────────────────────────────────────────────

  const validate = useCallback(() => {
    const newErrors = {};
    for (const [field, fn] of Object.entries(validatorsRef.current)) {
      const err = fn(values[field], values);
      if (err) newErrors[field] = err;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values]);

  // ── Submit handler ────────────────────────────────────────────────────────

  /**
   * Returns an event handler for <form onSubmit={...}>.
   * Validates all fields, then calls onSubmit with current values if valid.
   *
   * @param {(values: Record<string, any>) => Promise<void> | void} onSubmit
   */
  const handleSubmit = useCallback((onSubmit) => async (event) => {
    event?.preventDefault?.();
    touchAll();
    setSubmitError(null);
    setSubmitCount(c => c + 1);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, touchAll]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback((newInitial) => {
    const init = newInitial ?? initialRef.current;
    if (newInitial) initialRef.current = newInitial;
    setValuesState(init);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitCount(0);
    setSubmitError(null);
  }, []);

  // ── field() helper ────────────────────────────────────────────────────────

  /**
   * Returns props to spread onto an <input>, <select>, or <textarea>.
   * Handles value, onChange, onBlur automatically.
   *
   * @param {string} name - Field name
   * @returns {{ value, onChange, onBlur, name }}
   *
   * @example
   * <Input label="Email" {...form.field("email")} error={form.fieldError("email")} />
   */
  const field = useCallback((name) => ({
    name,
    value:    values[name] ?? "",
    onChange: (e) => setValue(name, e?.target?.value ?? e),
    onBlur:   ()  => touch(name),
  }), [values, setValue, touch]);

  /**
   * Returns the error for a field ONLY if it has been touched.
   * Use this to avoid showing errors before the user interacts.
   */
  const fieldError = useCallback((name) =>
    touched[name] ? errors[name] : null,
    [touched, errors]
  );

  /**
   * Returns props for a checkbox input.
   */
  const checkbox = useCallback((name) => ({
    name,
    checked:  !!values[name],
    onChange: (e) => setValue(name, e?.target?.checked ?? e),
    onBlur:   ()  => touch(name),
  }), [values, setValue, touch]);

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    submitCount,
    submitError,
    // Actions
    setValue,
    setValues,
    setErrors,
    touch,
    touchAll,
    validate,
    handleSubmit,
    reset,
    // Helpers
    field,
    fieldError,
    checkbox,
  };
}