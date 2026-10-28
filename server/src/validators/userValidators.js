import { z } from 'zod';

export const syncUserSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  profileImage: z
    .object({
      publicId: z.string().optional(),
      secureUrl: z.string().url().optional(),
    })
    .optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  profileImage: z
    .object({
      publicId: z.string().optional(),
      secureUrl: z.string().url().optional(),
    })
    .optional(),
  notificationPreferences: z
    .object({
      outbid: z.boolean().optional(),
      closingSoon: z.boolean().optional(),
      saleUpdates: z.boolean().optional(),
      browserAlerts: z.boolean().optional(),
    })
    .optional(),
});
