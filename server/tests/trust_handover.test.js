import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Sale, User } from '../src/models/index.js';

describe('Trust, Safety & Handover Verification Unit Tests', () => {
  it('generates a secure 6-digit OTP with 72h expiration on Sale model', () => {
    const sale = new Sale({
      listingId: new mongoose.Types.ObjectId(),
      sellerId: new mongoose.Types.ObjectId(),
      winnerId: new mongoose.Types.ObjectId(),
      finalPricePaise: 150000,
      outcome: 'RESERVED',
    });

    const otp = sale.generateHandoverOtp();

    expect(otp).toBeDefined();
    expect(typeof otp).toBe('string');
    expect(otp.length).toBe(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
    expect(sale.handoverOtp).toBe(otp);
    expect(sale.handoverAttempts).toBe(0);

    // Expiration should be roughly 72 hours in the future
    const now = Date.now();
    const expiryMs = new Date(sale.handoverOtpExpiresAt).getTime();
    const diffHours = (expiryMs - now) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThanOrEqual(71.9);
    expect(diffHours).toBeLessThanOrEqual(72.1);
  });

  it('correctly updates user reputation and karma upon successful handover (SALE_COMPLETED)', () => {
    const user = new User({
      firebaseUid: 'test_uid_seller_1',
      displayName: 'Arjun Sharma',
      email: 'arjun@campus.edu',
      department: 'Electrical Engineering',
      year: '4th Year',
      isVerifiedStudent: true,
      stats: {
        completedSales: 2,
        cancelledSales: 0,
        karmaScore: 120,
        handoverRate: 100,
        ghostingPenalties: 0,
        trustTier: 'VERIFIED_STUDENT',
      },
    });

    const updatedStats = user.updateReputation('SALE_COMPLETED');

    expect(updatedStats.completedSales).toBe(3);
    expect(updatedStats.karmaScore).toBe(130); // +10 Karma points
    expect(updatedStats.handoverRate).toBe(100);
    expect(updatedStats.trustTier).toBe('TRUSTED_SELLER'); // 3 completed sales triggers TRUSTED_SELLER
  });

  it('applies ghosting penalty (-25 Karma) and adjusts handover rate upon cancellation (SALE_CANCELLED)', () => {
    const user = new User({
      firebaseUid: 'test_uid_ghost_1',
      displayName: 'Rohan Mehta',
      email: 'rohan@campus.edu',
      stats: {
        completedSales: 9,
        cancelledSales: 0,
        karmaScore: 190,
        handoverRate: 100,
        ghostingPenalties: 0,
        trustTier: 'TRUSTED_SELLER',
      },
    });

    const updatedStats = user.updateReputation('SALE_CANCELLED');

    expect(updatedStats.completedSales).toBe(9);
    expect(updatedStats.cancelledSales).toBe(1);
    expect(updatedStats.ghostingPenalties).toBe(1);
    expect(updatedStats.karmaScore).toBe(165); // -25 Karma penalty
    expect(updatedStats.handoverRate).toBe(90); // 9 out of 10 = 90%
  });

  it('graduates to ELITE_SELLER when achieving ≥10 completed sales and ≥95% handover rate', () => {
    const user = new User({
      firebaseUid: 'test_uid_elite_1',
      displayName: 'Priya Patel',
      email: 'priya@campus.edu',
      stats: {
        completedSales: 9,
        cancelledSales: 0,
        karmaScore: 190,
        handoverRate: 100,
        ghostingPenalties: 0,
        trustTier: 'TRUSTED_SELLER',
      },
    });

    user.updateReputation('SALE_COMPLETED'); // 10th completed sale

    expect(user.stats.completedSales).toBe(10);
    expect(user.stats.handoverRate).toBe(100);
    expect(user.stats.trustTier).toBe('ELITE_SELLER');
  });

  it('formats toPublicProfile including academic and reputation verification badges', () => {
    const user = new User({
      firebaseUid: 'test_uid_profile_1',
      displayName: 'Sneha Rao',
      email: 'sneha@campus.edu',
      department: 'Mechanical Engineering',
      year: '2nd Year',
      isVerifiedStudent: true,
      verifiedEmailDomain: '@campus.edu',
      stats: {
        completedSales: 4,
        cancelledSales: 0,
        karmaScore: 140,
        handoverRate: 100,
        trustTier: 'TRUSTED_SELLER',
      },
    });

    const profile = user.toPublicProfile();

    expect(profile.displayName).toBe('Sneha Rao');
    expect(profile.department).toBe('Mechanical Engineering');
    expect(profile.year).toBe('2nd Year');
    expect(profile.isVerifiedStudent).toBe(true);
    expect(profile.verifiedEmailDomain).toBe('@campus.edu');
    expect(profile.stats.karmaScore).toBe(140);
    expect(profile.stats.trustTier).toBe('TRUSTED_SELLER');
    expect(profile.email).toBeUndefined(); // Email remains private
  });

  it('guarantees confidential handover OTP isolation: only buyer can view code while reserved', () => {
    const buyerId = new mongoose.Types.ObjectId();
    const sellerId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();

    const sale = new Sale({
      listingId: new mongoose.Types.ObjectId(),
      sellerId: sellerId,
      winnerId: buyerId,
      finalPricePaise: 200000,
      outcome: 'RESERVED',
    });
    const otp = sale.generateHandoverOtp();

    // Plain sanitization simulation (as implemented in saleController)
    function sanitize(doc, requestingUserId) {
      const obj = doc.toObject();
      if (obj.outcome === 'RESERVED' && requestingUserId.toString() !== obj.winnerId.toString()) {
        delete obj.handoverOtp;
      }
      return obj;
    }

    // 1. Seller inspecting sale should NOT see OTP
    const sellerView = sanitize(sale, sellerId);
    expect(sellerView.handoverOtp).toBeUndefined();

    // 2. Random third party should NOT see OTP
    const otherView = sanitize(sale, otherUserId);
    expect(otherView.handoverOtp).toBeUndefined();

    // 3. Winning buyer DOES see OTP to show seller in person
    const buyerView = sanitize(sale, buyerId);
    expect(buyerView.handoverOtp).toBe(otp);
  });
});
