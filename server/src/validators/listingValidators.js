import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.enum([
    'CYCLES',
    'TEXTBOOKS',
    'ELECTRONICS',
    'LAB_EQUIPMENT',
    'FURNITURE',
    'CALCULATORS',
    'OTHER',
  ]),
  description: z.string().trim().min(10).max(2000),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']),
  startingPricePaise: z.number().int().min(100), // Min ₹1.00
  minBidIncrementPaise: z.number().int().min(100).default(5000), // Min ₹1, default ₹50
  closingAt: z.string().datetime().refine((val) => new Date(val) > new Date(), {
    message: 'Closing time must be in the future',
  }),
  images: z
    .array(
      z.object({
        publicId: z.string(),
        secureUrl: z.string().url(),
        order: z.number().default(0),
      })
    )
    .max(5)
    .default([]),
  pickupPoint: z.string().trim().max(150).optional(),
  sellerPhone: z.string().trim().max(30).optional(),
});

export const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']).optional(),
  startingPricePaise: z.number().int().min(100).optional(),
  minBidIncrementPaise: z.number().int().min(100).optional(),
  pickupPoint: z.string().trim().max(150).optional(),
  sellerPhone: z.string().trim().max(30).optional(),
  images: z
    .array(
      z.object({
        publicId: z.string(),
        secureUrl: z.string().url(),
        order: z.number().default(0),
      })
    )
    .max(5)
    .optional(),
});

export const cancelListingSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});

export const queryListingsSchema = z.object({
  q: z.string().optional(),
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
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'EXTENDED', 'CLOSED', 'CANCELLED', 'ALL']).default('ACTIVE'),
  sortBy: z.enum(['closingSoon', 'priceAsc', 'priceDesc', 'newest']).default('closingSoon'),
  excludeOwn: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
