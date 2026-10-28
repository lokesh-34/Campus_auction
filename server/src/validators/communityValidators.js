import { z } from 'zod';

export const cancelSaleSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});

export const askQuestionSchema = z.object({
  questionText: z.string().trim().min(5).max(500),
});

export const answerQuestionSchema = z.object({
  answerText: z.string().trim().min(2).max(1000),
});

export const savedSearchSchema = z.object({
  keyword: z.string().trim().optional(),
  category: z
    .enum([
      'CYCLES',
      'TEXTBOOKS',
      'ELECTRONICS',
      'LAB_EQUIPMENT',
      'FURNITURE',
      'CALCULATORS',
      'OTHER',
    ])
    .optional(),
  maxPricePaise: z.number().int().min(0).optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']).optional(),
  notifyEnabled: z.boolean().default(true),
});
