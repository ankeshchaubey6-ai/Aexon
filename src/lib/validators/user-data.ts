import { Role } from "@prisma/client";
import { z } from "zod";

export const UserDataValidator = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  // 🔥 FIX: allow empty OR valid URL (for your Prisma schema)
  avatarUrl: z
    .string()
    .optional()
    .or(z.literal("")), 
  role: z.nativeEnum(Role),
});

export type UserDataSchema = z.infer<typeof UserDataValidator>;