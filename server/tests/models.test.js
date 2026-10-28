import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Listing, Bid, AutoBid, Sale } from '../src/models/index.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await AutoBid.init();
  await User.init();
  await Listing.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Mongoose Models & Schema Constraints', () => {
  it('should create user and transform to public profile safely', async () => {
    const user = await User.create({
      firebaseUid: 'test_uid_123',
      displayName: 'Alice Student',
      email: 'alice@campus.edu',
    });

    expect(user.displayName).toBe('Alice Student');
    const publicProfile = user.toPublicProfile();
    expect(publicProfile).toHaveProperty('displayName', 'Alice Student');
    expect(publicProfile).not.toHaveProperty('email'); // private
    expect(publicProfile).not.toHaveProperty('notificationPreferences'); // private
  });

  it('should enforce integer paise constraints on Listing', async () => {
    const user = await User.findOne({ firebaseUid: 'test_uid_123' });

    // Floating point amount should fail validation
    const invalidListing = new Listing({
      sellerId: user._id,
      title: 'Mountain Bike',
      category: 'CYCLES',
      description: 'Used gear cycle in great shape',
      condition: 'GOOD',
      startingPricePaise: 1500.5, // Invalid float!
      minBidIncrementPaise: 100,
      currentPricePaise: 1500.5,
      closingAt: new Date(Date.now() + 86400000),
    });

    await expect(invalidListing.validate()).rejects.toThrow();

    // Valid integer paise should succeed
    const validListing = new Listing({
      sellerId: user._id,
      title: 'Mountain Bike',
      category: 'CYCLES',
      description: 'Used gear cycle in great shape',
      condition: 'GOOD',
      startingPricePaise: 150000, // ₹1500.00
      minBidIncrementPaise: 5000,  // ₹50.00
      currentPricePaise: 150000,
      closingAt: new Date(Date.now() + 86400000),
    });

    await expect(validListing.validate()).resolves.toBeUndefined();
    await validListing.save();
    expect(validListing.currentPricePaise).toBe(150000);
  });

  it('should enforce unique AutoBid per user per listing', async () => {
    const user = await User.findOne({ firebaseUid: 'test_uid_123' });
    const listing = await Listing.findOne();

    await AutoBid.create({
      listingId: listing._id,
      bidderId: user._id,
      maxAmountPaise: 250000,
    });

    // Second AutoBid for same user and listing should throw duplicate key error
    await expect(
      AutoBid.create({
        listingId: listing._id,
        bidderId: user._id,
        maxAmountPaise: 300000,
      })
    ).rejects.toThrow();
  });
});
