import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { Listing, Notification } from '../src/models/index.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Community Features & AI Assistant APIs', () => {
  const sellerToken = 'mock:comm_seller_1:seller@campus.edu:Prof Roy';
  const buyerToken = 'mock:comm_buyer_1:buyer@campus.edu:Pooja Singh';

  let listingId;
  let questionId;

  it('sets up listing for community tests', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Firefox Target 21-Speed Mountain Bike',
        category: 'CYCLES',
        description: 'Hardtail MTB, lightweight alloy frame, serviced last month.',
        condition: 'LIKE_NEW',
        startingPricePaise: 350000, // ₹3,500
        minBidIncrementPaise: 5000,
        closingAt: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(201);
    listingId = res.body.data._id;
  });

  it('allows authenticated buyers to ask questions on a listing', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/questions`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ questionText: 'Is the frame size medium or large?' });

    expect(res.status).toBe(201);
    expect(res.body.data.questionText).toBe('Is the frame size medium or large?');
    expect(res.body.data.status).toBe('OPEN');
    questionId = res.body.data._id;
  });

  it('allows the seller to answer listing questions', async () => {
    const res = await request(app)
      .post(`/api/v1/questions/${questionId}/answer`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ answerText: 'It is a medium frame suitable for heights 5ft 4in to 5ft 10in.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ANSWERED');
    expect(res.body.data.answerText).toContain('medium frame');
  });

  it('automatically detects duplicate question and reuses existing seller answer', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/questions`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ questionText: 'Is the frame size medium?' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ANSWERED');
    expect(res.body.data.isAutoAnswered).toBe(true);
    expect(res.body.data.answerText).toBe('It is a medium frame suitable for heights 5ft 4in to 5ft 10in.');
    expect(res.body.data.matchedFromQuestionId).toBe(questionId);
    expect(res.body.meta.autoAnswered).toBe(true);
  });

  it('keeps novel unanswered questions OPEN and routes them to the seller', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/questions`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ questionText: 'Are the disc brakes hydraulic or mechanical?' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.isAutoAnswered).toBe(false);
    expect(res.body.data.answerText).toBeNull();
    expect(res.body.meta.autoAnswered).toBe(false);
  });

  it('toggles listing on the user watchlist', async () => {
    // 1. Add to watchlist
    const addRes = await request(app)
      .post(`/api/v1/watchlist/${listingId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.isWatched).toBe(true);

    // 2. Query watchlist
    const listRes = await request(app)
      .get('/api/v1/watchlist')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0]._id).toBe(listingId);

    // 3. Toggle off
    const removeRes = await request(app)
      .post(`/api/v1/watchlist/${listingId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.isWatched).toBe(false);
  });

  it('saves search criteria and retrieves them', async () => {
    const res = await request(app)
      .post('/api/v1/saved-searches')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        keyword: 'bicycle',
        category: 'CYCLES',
        maxPricePaise: 400000,
        notifyEnabled: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.category).toBe('CYCLES');

    const getRes = await request(app)
      .get('/api/v1/saved-searches')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.length).toBe(1);
  });

  it('queries AI Assistant with natural language and returns matching real listings', async () => {
    const res = await request(app)
      .post('/api/v1/ai/query')
      .send({ query: 'Find me a bicycle under ₹4,000' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('listings');
    expect(res.body.data.listings.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.listings[0].title).toContain('Firefox');
  });

  it('proposes structured bidding action requiring user confirmation', async () => {
    const res = await request(app)
      .post('/api/v1/ai/propose-bid')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        listingId,
        actionType: 'MANUAL_BID',
        proposedAmountRupees: 3500,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresConfirmation).toBe(true);
    expect(res.body.data.proposedAmountPaise).toBe(350000);
    expect(res.body.data.isEligible).toBe(true);
  });
});
