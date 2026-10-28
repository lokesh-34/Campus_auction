import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { Listing, Sale, User, Notification } from '../src/models/index.js';
import { reconcileOverdueAuctions } from '../src/services/closureService.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(replSet.getUri());
  await Sale.init();
  await Listing.init();
}, 60000);

afterAll(async () => {
  await disconnectDB();
  if (replSet) await replSet.stop();
});

describe('Durable Auction Closure & Post-Auction Sale Lifecycle', () => {
  const sellerToken = 'mock:close_seller_1:seller@campus.edu:Prof Roy';
  const buyerToken = 'mock:close_buyer_1:buyer@campus.edu:Pooja Singh';

  let listingWithBidId;
  let listingWithoutBidId;
  let saleId;

  it('sets up auctions for closure testing', async () => {
    // 1. Create auction that will receive a bid
    const res1 = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Drafting Board with Mini Drafter',
        category: 'LAB_EQUIPMENT',
        description: 'Complete drawing kit for first year engineering graphics.',
        condition: 'GOOD',
        startingPricePaise: 80000, // ₹800
        minBidIncrementPaise: 5000,
        pickupPoint: 'Hostel 4 Common Room',
        sellerPhone: '+91 9876543210',
        closingAt: new Date(Date.now() + 60000).toISOString(),
      });
    listingWithBidId = res1.body.data._id;

    // Buyer places a winning bid
    await request(app)
      .post(`/api/v1/listings/${listingWithBidId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amountPaise: 80000 });

    // 2. Create auction that receives 0 bids
    const res2 = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Unsold Textbook',
        category: 'TEXTBOOKS',
        description: 'Old syllabus book.',
        condition: 'FAIR',
        startingPricePaise: 30000,
        minBidIncrementPaise: 5000,
        closingAt: new Date(Date.now() + 60000).toISOString(),
      });
    listingWithoutBidId = res2.body.data._id;
  });

  it('reconciles overdue auctions and creates appropriate Sale outcomes', async () => {
    // Manually expire both auctions
    const pastTime = new Date(Date.now() - 5000);
    await Listing.updateMany(
      { _id: { $in: [listingWithBidId, listingWithoutBidId] } },
      { closingAt: pastTime }
    );

    // Run reconciliation worker logic
    const { closedCount } = await reconcileOverdueAuctions();
    expect(closedCount).toBe(2);

    // Verify auction with bid -> PENDING_SELLER_APPROVAL
    const saleWithBid = await Sale.findOne({ listingId: listingWithBidId });
    expect(saleWithBid).not.toBeNull();
    expect(saleWithBid.outcome).toBe('PENDING_SELLER_APPROVAL');
    expect(saleWithBid.finalPricePaise).toBe(80000);
    expect(saleWithBid.pickupPoint).toBe('Hostel 4 Common Room');
    expect(saleWithBid.sellerPhone).toBe('+91 9876543210');
    saleId = saleWithBid._id;

    // Verify buyer received notification with pickup point and phone number
    const buyer = await User.findOne({ firebaseUid: 'close_buyer_1' });
    const wonNotif = await Notification.findOne({
      recipientId: buyer._id,
      type: 'AUCTION_WON',
    });
    expect(wonNotif).not.toBeNull();
    expect(wonNotif.message).toContain('Hostel 4 Common Room');
    expect(wonNotif.message).toContain('+91 9876543210');
    expect(wonNotif.data.pickupPoint).toBe('Hostel 4 Common Room');
    expect(wonNotif.data.sellerPhone).toBe('+91 9876543210');

    // Verify auction without bid -> UNSOLD
    const saleWithoutBid = await Sale.findOne({ listingId: listingWithoutBidId });
    expect(saleWithoutBid).not.toBeNull();
    expect(saleWithoutBid.outcome).toBe('UNSOLD');
  });

  it('allows the seller to approve winning price, reserving the item', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/${saleId}/approve`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('RESERVED');
    expect(res.body.data).toHaveProperty('reservationExpiresAt');
  });

  it('completes the transaction to SOLD only after both parties confirm handover', async () => {
    // 1. Seller confirms handover
    const sellerConfRes = await request(app)
      .post(`/api/v1/sales/${saleId}/confirm-handover`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(sellerConfRes.status).toBe(200);
    expect(sellerConfRes.body.data.outcome).toBe('RESERVED'); // Still reserved until buyer also confirms

    // 2. Buyer confirms handover
    const buyerConfRes = await request(app)
      .post(`/api/v1/sales/${saleId}/confirm-handover`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(buyerConfRes.status).toBe(200);
    expect(buyerConfRes.body.data.outcome).toBe('SOLD');

    // Verify seller's completedSales stat incremented
    const sellerUser = await User.findOne({ firebaseUid: 'close_seller_1' });
    expect(sellerUser.stats.completedSales).toBe(1);
  });
});
