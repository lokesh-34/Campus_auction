import { z } from 'zod';

export const placeBidSchema = z.object({
  amountPaise: z.number().int().positive({ message: 'amountPaise must be a positive integer in paise' }),
});

export const autoBidSchema = z.object({
  maxAmountPaise: z.number().int().positive({ message: 'maxAmountPaise must be a positive integer in paise' }),
});
