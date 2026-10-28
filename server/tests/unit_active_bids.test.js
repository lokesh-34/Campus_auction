import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyActiveBids } from '../src/controllers/bidController.js';
import { AutoBid, Bid, Listing } from '../src/models/index.js';

describe('getMyActiveBids Controller', () => {
  const mockUserId = 'user_buyer_123';
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockReq = {
      user: {
        _id: mockUserId,
        displayName: 'Test Buyer',
      },
    };
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns empty array when user has placed no bids and has no autobids', async () => {
    vi.spyOn(Bid, 'distinct').mockResolvedValue([]);
    vi.spyOn(AutoBid, 'distinct').mockResolvedValue([]);

    await getMyActiveBids(mockReq, mockRes, next);

    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: [],
    });
  });

  it('returns empty array when listings for user bids are all closed', async () => {
    vi.spyOn(Bid, 'distinct').mockResolvedValue(['listing_1']);
    vi.spyOn(AutoBid, 'distinct').mockResolvedValue([]);

    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(Listing, 'find').mockReturnValue(findChain);

    await getMyActiveBids(mockReq, mockRes, next);

    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: [],
    });
  });

  it('returns active bids with correct LEADING and OUTBID statuses', async () => {
    const listing1Id = 'listing_1';
    const listing2Id = 'listing_2';

    vi.spyOn(Bid, 'distinct').mockResolvedValue([listing1Id, listing2Id]);
    vi.spyOn(AutoBid, 'distinct').mockResolvedValue([listing1Id]);

    const mockListings = [
      {
        _id: listing1Id,
        title: 'MacBook Pro M2',
        category: 'ELECTRONICS',
        condition: 'LIKE_NEW',
        images: [{ secureUrl: 'https://example.com/mac.jpg' }],
        startingPricePaise: 5000000,
        currentPricePaise: 6500000,
        minBidIncrementPaise: 100000,
        bidCount: 5,
        status: 'ACTIVE',
        closingAt: new Date(Date.now() + 3600000),
        leadingBidderId: mockUserId, // User is winning
        sellerId: { _id: 'seller_1', displayName: 'Prof Smith' },
        pickupPoint: 'Hostel 4 Gate',
      },
      {
        _id: listing2Id,
        title: 'Hero Sprint Bicycle',
        category: 'CYCLES',
        condition: 'GOOD',
        images: [],
        startingPricePaise: 200000,
        currentPricePaise: 350000,
        minBidIncrementPaise: 5000,
        bidCount: 3,
        status: 'ACTIVE',
        closingAt: new Date(Date.now() + 7200000),
        leadingBidderId: 'other_buyer_999', // User is outbid
        sellerId: { _id: 'seller_2', displayName: 'Jane Doe' },
        pickupPoint: 'SAC Grounds',
      },
    ];

    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockResolvedValue(mockListings),
    };
    vi.spyOn(Listing, 'find').mockReturnValue(findChain);

    vi.spyOn(Bid, 'aggregate').mockResolvedValue([
      {
        _id: listing1Id,
        myHighestBidPaise: 6500000,
        latestBidAmountPaise: 6500000,
        myBidCount: 2,
        latestBidCreatedAt: new Date('2026-10-28T10:00:00Z'),
      },
      {
        _id: listing2Id,
        myHighestBidPaise: 300000,
        latestBidAmountPaise: 300000,
        myBidCount: 1,
        latestBidCreatedAt: new Date('2026-10-28T09:00:00Z'),
      },
    ]);

    vi.spyOn(AutoBid, 'find').mockResolvedValue([
      {
        listingId: listing1Id,
        bidderId: mockUserId,
        maxAmountPaise: 8000000,
        enabled: true,
      },
    ]);

    await getMyActiveBids(mockReq, mockRes, next);

    expect(mockRes.json).toHaveBeenCalledTimes(1);
    const responseData = mockRes.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    expect(responseData.data).toHaveLength(2);

    // Listing 1: Leading
    const item1 = responseData.data[0];
    expect(item1._id).toBe(listing1Id);
    expect(item1.isLeading).toBe(true);
    expect(item1.bidStatus).toBe('LEADING');
    expect(item1.myHighestBidPaise).toBe(6500000);
    expect(item1.currentPricePaise).toBe(6500000);
    expect(item1.hasAutoBid).toBe(true);
    expect(item1.autoBidMaxPaise).toBe(8000000);
    expect(item1.minNextBidPaise).toBe(6600000); // 6500000 + 100000

    // Listing 2: Outbid
    const item2 = responseData.data[1];
    expect(item2._id).toBe(listing2Id);
    expect(item2.isLeading).toBe(false);
    expect(item2.bidStatus).toBe('OUTBID');
    expect(item2.myHighestBidPaise).toBe(300000);
    expect(item2.currentPricePaise).toBe(350000);
    expect(item2.hasAutoBid).toBe(false);
    expect(item2.minNextBidPaise).toBe(355000); // 350000 + 5000
  });
});
