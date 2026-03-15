

import { z } from "zod";

export const UploadMediaValidator = z.object({
  link: z.string().min(1).url(),
  name: z.string().min(1),
  size: z.number().optional(),
});

export type UploadMediaSchema = z.infer<typeof UploadMediaValidator>;


