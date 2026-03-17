import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      // --- AstroPaper base fields ---
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
      // --- Post format ---
      postType: z.enum(["standard", "captains-log"]).default("standard"),
      needsReview: z.boolean().default(false),
      ttsVoice: z.enum(["neutral", "narrative"]).default("neutral"),
      // --- Captain's Log only ---
      experimentNumber: z.string().optional(),
      codename: z.string().optional(),
      status: z
        .enum(["Ongoing", "Concluded", "Inconclusive", "Promising"])
        .optional(),
      duration: z.string().optional(),
    }),
});

export const collections = { blog };
