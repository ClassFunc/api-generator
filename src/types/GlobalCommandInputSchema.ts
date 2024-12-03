import {z} from "zod";

export const GlobalCommandInputSchema = z.object({
    force: z.boolean().describe(`force overwritten`).default(false).optional()
})