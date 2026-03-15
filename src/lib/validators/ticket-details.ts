import { z } from "zod";

const currencyNumberRegex = /^\d+(\.\d{1,2})?$/;

export const TicketDetailsValidator = z.object({
  // 🔥 FIX 1: Coerce undefined/null to string (prevents trim crash)
  name: z
    .string({
      required_error: "Ticket name is required",
      invalid_type_error: "Ticket name must be a string",
    })
    .transform((val) => (val ?? "").trim())
    .refine((val) => val.length > 0, {
      message: "Ticket name is required",
    }),

  // 🔥 FIX 2: Always safe optional string
  description: z
    .string()
    .optional()
    .transform((val) => (val ?? "").trim()),

  // 🔥 FIX 3: Default value if undefined (prevents NaN + refine crash)
  value: z
    .string()
    .optional()
    .transform((val) => (val ?? "0").trim())
    .refine((value) => currencyNumberRegex.test(value), {
      message: "Value must be a valid price",
    }),
});

export type TicketDetailsSchema = z.infer<typeof TicketDetailsValidator>;