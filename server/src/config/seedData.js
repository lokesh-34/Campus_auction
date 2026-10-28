import { Listing, User } from '../models/index.js';

export async function seedDemoData() {
  try {
    const existingCount = await Listing.countDocuments();
    if (existingCount > 0) return;

    console.log('🌱 Seeding demo campus listings and users...');

    // Create demo campus sellers
    const seller1 = await User.findOneAndUpdate(
      { firebaseUid: 'demo_seller_kavita' },
      {
        firebaseUid: 'demo_seller_kavita',
        displayName: 'Kavita Roy (Civil 3rd Yr)',
        email: 'kavita@campus.edu',
        stats: { completedSales: 4, ratingCount: 4, averageRating: 4.8 },
      },
      { upsert: true, new: true }
    );

    const seller2 = await User.findOneAndUpdate(
      { firebaseUid: 'demo_seller_aditya' },
      {
        firebaseUid: 'demo_seller_aditya',
        displayName: 'Aditya Mehta (CSE 2nd Yr)',
        email: 'aditya@campus.edu',
        stats: { completedSales: 2, ratingCount: 2, averageRating: 5.0 },
      },
      { upsert: true, new: true }
    );

    const seller3 = await User.findOneAndUpdate(
      { firebaseUid: 'demo_seller_sneha' },
      {
        firebaseUid: 'demo_seller_sneha',
        displayName: 'Sneha Patel (ECE Final Yr)',
        email: 'sneha@campus.edu',
        stats: { completedSales: 6, ratingCount: 5, averageRating: 4.9 },
      },
      { upsert: true, new: true }
    );

    // Create diverse demo auctions
    const now = Date.now();
    await Listing.create([
      {
        sellerId: seller1._id,
        title: 'Firefox Target 21-Speed Mountain Bicycle with Disc Brakes',
        category: 'CYCLES',
        description:
          'Single-owner gear bicycle, 1.5 years old, smooth Shimano Tourney gears, front suspension and dual disc brakes. Perfect for commuting between campus hostels and lecture halls.',
        condition: 'LIKE_NEW',
        startingPricePaise: 300000, // ₹3,000
        minBidIncrementPaise: 5000,  // ₹50
        currentPricePaise: 380000,  // ₹3,800
        bidCount: 5,
        status: 'ACTIVE',
        closingAt: new Date(now + 2 * 60 * 60 * 1000), // 2 hours from now
        images: [
          {
            publicId: 'cycle_demo_1',
            secureUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
            order: 0,
          },
        ],
      },
      {
        sellerId: seller2._id,
        title: 'Casio fx-991EX ClassWiz Scientific Calculator',
        category: 'CALCULATORS',
        description:
          'High-resolution LCD calculator with 552 functions, spreadsheet calculation, matrix and vector math. Permitted in university semester exams. Includes protective slip case.',
        condition: 'GOOD',
        startingPricePaise: 70000,  // ₹700
        minBidIncrementPaise: 2500,  // ₹25
        currentPricePaise: 95000,   // ₹950
        bidCount: 4,
        status: 'ACTIVE',
        closingAt: new Date(now + 45 * 60 * 1000), // 45 mins from now (closing soon!)
        images: [
          {
            publicId: 'calc_demo_1',
            secureUrl: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
            order: 0,
          },
        ],
      },
      {
        sellerId: seller3._id,
        title: 'Introduction to Algorithms (CLRS 3rd Edition) + Semester Lecture Notes',
        category: 'TEXTBOOKS',
        description:
          'Standard Algorithms textbook by Cormen, Leiserson, Rivest, Stein. Clean pages, no torn sheets. Bonus: includes handwritten lecture summary sheets for DSA exams.',
        condition: 'GOOD',
        startingPricePaise: 45000,  // ₹450
        minBidIncrementPaise: 5000,  // ₹50
        currentPricePaise: 65000,   // ₹650
        bidCount: 3,
        status: 'ACTIVE',
        closingAt: new Date(now + 4 * 60 * 60 * 1000), // 4 hours from now
        images: [
          {
            publicId: 'clrs_demo_1',
            secureUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
            order: 0,
          },
        ],
      },
      {
        sellerId: seller1._id,
        title: 'Omega Engineering Mini Drafter with Sheet Container & Clips',
        category: 'LAB_EQUIPMENT',
        description:
          'Heavy-duty stainless steel clamp mini-drafter for engineering graphics and machine drawing. Comes with sturdy waterproof cylindrical drawing sheet holder.',
        condition: 'LIKE_NEW',
        startingPricePaise: 35000,  // ₹350
        minBidIncrementPaise: 2500,  // ₹25
        currentPricePaise: 42500,   // ₹425
        bidCount: 2,
        status: 'ACTIVE',
        closingAt: new Date(now + 6 * 60 * 60 * 1000), // 6 hours from now
        images: [
          {
            publicId: 'drafter_demo_1',
            secureUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
            order: 0,
          },
        ],
      },
      {
        sellerId: seller2._id,
        title: 'Ergonomic Mesh Study Chair with Lumbar Support for Hostel Dorm',
        category: 'FURNITURE',
        description:
          'Breathable mesh backrest, pneumatic height adjustment, 360-degree swivel wheels. Kept in non-smoking room, wheels roll smoothly without creaking.',
        condition: 'GOOD',
        startingPricePaise: 120000, // ₹1,200
        minBidIncrementPaise: 5000,  // ₹50
        currentPricePaise: 155000,  // ₹1,550
        bidCount: 6,
        status: 'ACTIVE',
        closingAt: new Date(now + 24 * 60 * 60 * 1000), // 24 hours
        images: [
          {
            publicId: 'chair_demo_1',
            secureUrl: 'https://images.unsplash.com/photo-1580481077195-c228c29188d3?auto=format&fit=crop&w=800&q=80',
            order: 0,
          },
        ],
      },
    ]);

    console.log('✅ Demo campus listings seeded successfully.');
  } catch (err) {
    console.error('Failed to seed demo data:', err.message);
  }
}
