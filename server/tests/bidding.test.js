import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { Listing, User, AutoBid } from '../src/models/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(replSet.getUri());
  await AutoBid.init();
  await Listing.init();
});

afterAll(async () => {
  await disconnectDB();
  if (replSet) await replSet.stop();
});

describe('Authoritative Bidding & Proxy Bidding Engine', () => {
  const sellerToken = 'mock:bid_seller_1:seller@campus.edu:Seller Sam';
  const buyer1Token = 'mock:bid_buyer_1:buyer1@campus.edu:Buyer Alice';
  const buyer2Token = 'mock:bid_buyer_2:buyer2@campus.edu:Buyer Bob';

  let listingId;

  it('sets up active auction listing for bidding tests', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Casio Scientific fx-991CW Calculator',
        category: 'CALCULATORS',
        description: 'Approved for college engineering exams, fresh battery.',
        condition: 'LIKE_NEW',
        startingPricePaise: 100000, // ₹1,000
        minBidIncrementPaise: 5000,  // ₹50
        closingAt: new Date(Date.now() + 600000).toISOString(),
      });

    expect(res.status).toBe(201);
    listingId = res.body.data._id;
  });

  it('rejects bids lower than starting price on opening bid', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ amountPaise: 95000 }); // Below ₹1,000 starting price

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('lower than minimum acceptable bid');
  });

  it('rejects seller bidding on their own listing', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ amountPaise: 100000 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Sellers cannot bid on their own listings');
  });

  it('accepts valid opening manual bid at starting price', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ amountPaise: 100000 });

    expect(res.status).toBe(201);
    expect(res.body.data.listing.currentPricePaise).toBe(100000);
    expect(res.body.data.listing.bidCount).toBe(1);
  });

  it('rejects subsequent bid from the same buyer when they are already the highest bidder', async () => {
    // Buyer 1 is currently the highest bidder at 100000 paise
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ amountPaise: 110000 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already the highest bidder');
  });

  it('enforces minimum increment for subsequent manual bid', async () => {
    // Current price is ₹1,000 (100000 paise). Min increment is ₹50 (5000 paise).
    // Bid of 102000 paise (₹1,020) should be rejected
    const invalidRes = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer2Token}`)
      .send({ amountPaise: 102000 });

    expect(invalidRes.status).toBe(400);

    // Bid of 105000 paise (₹1,050) should succeed
    const validRes = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer2Token}`)
      .send({ amountPaise: 105000 });

    expect(validRes.status).toBe(201);
    expect(validRes.body.data.listing.currentPricePaise).toBe(105000);
  });

  it('triggers anti-sniping extension when bid arrives within 30s of closing', async () => {
    // Set listing closing time to 20 seconds from now
    const nearClosing = new Date(Date.now() + 20000);
    await Listing.findByIdAndUpdate(listingId, { closingAt: nearClosing });

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ amountPaise: 110000 });

    expect(res.status).toBe(201);
    expect(res.body.data.listing.status).toBe('EXTENDED');
    // New closing time should be approximately now + 60s
    const extendedClosing = new Date(res.body.data.listing.closingAt).getTime();
    expect(extendedClosing).toBeGreaterThan(Date.now() + 50000);
  });

  it('configures private AutoBid ceiling and protects confidentiality', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/autobid`)
      .set('Authorization', `Bearer ${buyer2Token}`)
      .send({ maxAmountPaise: 200000 }); // ₹2,000 ceiling

    expect(res.status).toBe(200);
    expect(res.body.data.autobid.maxAmountPaise).toBe(200000);

    // Verify public listing details do NOT expose the autobid ceiling
    const publicRes = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(publicRes.body.data.listing).not.toHaveProperty('maxAmountPaise');
    expect(publicRes.body.data.listing).not.toHaveProperty('autobid');
  });

  it('automatically defends lead when competing manual bid arrives under ceiling', async () => {
    // Buyer 1 bids ₹1,200 (120000 paise).
    // Buyer 2 has AutoBid up to ₹2,000.
    // Buyer 2 should automatically retain lead at 120000 + 5000 = 125000 paise (₹1,250).
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/bids`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ amountPaise: 120000 });

    expect(res.status).toBe(201);
    // After auto-defense:
    const listing = await Listing.findById(listingId);
    expect(listing.currentPricePaise).toBe(125000);
  });
});
