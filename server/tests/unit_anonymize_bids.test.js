import { describe, it, expect } from 'vitest';

describe('Bidder Anonymization Policy', () => {
  function formatSafeBid(b, currentUserId) {
    const idStr = b.bidderId?._id?.toString() || b.bidderId?.toString() || '';
    const isMyBid = Boolean(currentUserId && idStr && idStr === currentUserId.toString());
    const shortSuffix = idStr ? idStr.slice(-4) : '';

    return {
      id: b._id,
      amountPaise: b.amountPaise,
      source: b.source,
      createdAt: b.createdAt,
      isMyBid,
      bidderName: isMyBid ? 'You' : `Bidder ***${shortSuffix}`,
    };
  }

  it('masks bidder name for other students and public viewers', () => {
    const mockBid = {
      _id: 'bid_123',
      amountPaise: 50500,
      source: 'MANUAL',
      createdAt: '2026-10-28T10:00:00.000Z',
      bidderId: {
        _id: '6ae1908057924a46ac684fb6',
        displayName: 'Lokesh N',
      },
    };

    const spectatorUserId = '6ae999999999999999999999';
    const safeBid = formatSafeBid(mockBid, spectatorUserId);

    // Ensure the real name is not present
    expect(safeBid.bidderName).toBe('Bidder ***4fb6');
    expect(safeBid.isMyBid).toBe(false);
    expect(safeBid).not.toHaveProperty('displayName');
  });

  it('displays "You" when the viewing user is the bidder', () => {
    const myUserId = '6ae1908057924a46ac684fb6';
    const mockBid = {
      _id: 'bid_123',
      amountPaise: 50500,
      source: 'MANUAL',
      createdAt: '2026-10-28T10:00:00.000Z',
      bidderId: {
        _id: myUserId,
        displayName: 'Lokesh N',
      },
    };

    const safeBid = formatSafeBid(mockBid, myUserId);

    expect(safeBid.bidderName).toBe('You');
    expect(safeBid.isMyBid).toBe(true);
  });

  it('masks correctly for unauthenticated guest visitors', () => {
    const mockBid = {
      _id: 'bid_456',
      amountPaise: 60000,
      source: 'AUTO',
      createdAt: '2026-10-28T10:05:00.000Z',
      bidderId: {
        _id: '6ae1908057924a46ac6899aa',
        displayName: 'Alice Student',
      },
    };

    const safeBid = formatSafeBid(mockBid, null);

    expect(safeBid.bidderName).toBe('Bidder ***99aa');
    expect(safeBid.isMyBid).toBe(false);
  });
});

