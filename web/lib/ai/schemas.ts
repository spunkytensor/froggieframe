import { z } from 'zod';

export const photoAnalysisSchema = z.object({
  tags: z.array(z.object({
    tag: z.string().describe('The detected element name (e.g., "beach", "birthday", "dog")'),
    category: z.enum(['person', 'place', 'object', 'event']).describe('Category of the tag'),
    confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  })),
  mood: z.object({
    value: z.enum(['calmer', 'darker', 'vibrant', 'relaxing', 'energetic', 'neutral'])
      .describe('The overall emotional/aesthetic mood of the photo'),
    confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  }),
});

export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;
