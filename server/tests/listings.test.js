import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { Listing, User } from '../src/models/index.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Listings API', () => {
  const sellerToken = 'mock:seller_uid_10:seller@campus.edu:Prof Sharma';
  const buyerToken = 'mock:buyer_uid_20:buyer@campus.edu:Rahul Verma';
  let createdListingId;

  it('creates an auction listing with startingPrice in integer paise', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Hero Sprint 26T Mountain Bicycle',
        category: 'CYCLES',
        description: 'Single-hand driven bicycle, 1 year old, perfect tyres and disc brakes.',
        condition: 'LIKE_NEW',
        startingPricePaise: 250000, // ₹2,500
        minBidIncrementPaise: 5000, // ₹50
        closingAt: new Date(Date.now() + 86400000).toISOString(),
        images: [{ publicId: 'bike_img_1', secureUrl: 'https://example.com/bike.jpg', order: 0 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentPricePaise).toBe(250000);
    expect(res.body.data.status).toBe('ACTIVE');
    createdListingId = res.body.data._id;
  });

  it('rejects listing creation with floating-point price', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Engineering Mathematics by Erwin Kreyszig',
        category: 'TEXTBOOKS',
        description: 'Hardcover 10th edition textbook in mint condition.',
        condition: 'GOOD',
        startingPricePaise: 500.5, // Invalid float!
        minBidIncrementPaise: 50,
        closingAt: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('filters and searches listings on the server side', async () => {
    const res = await request(app)
      .get('/api/v1/listings')
      .query({ category: 'CYCLES', condition: 'LIKE_NEW', page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.listings.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.listings[0].category).toBe('CYCLES');
    expect(res.body.data.pagination).toHaveProperty('total');
  });

  it('retrieves detailed listing with public safe bid history', async () => {
    const res = await request(app).get(`/api/v1/listings/${createdListingId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.listing.title).toContain('Hero Sprint');
    expect(res.body.data.minNextBidPaise).toBe(250000); // 0 bids -> starting price
    expect(Array.isArray(res.body.data.bidHistory)).toBe(true);
  });

  it('prevents non-sellers from editing the listing', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${createdListingId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows the seller to cancel an eligible listing with reason', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${createdListingId}/cancel`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ reason: 'Item gifted to campus department' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.cancellationReason).toBe('Item gifted to campus department');
  });
});
