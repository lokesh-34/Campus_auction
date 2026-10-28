import swaggerUi from 'swagger-ui-express';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CampusBid API Documentation',
    version: '1.0.0',
    description: [
      '**CampusBid — Campus Auction Marketplace REST API**',
      '',
      'Features:',
      '- **Monetary Precision**: All monetary values are integer **paise** (1 INR = 100 paise). Example: ₹250 = `25000`.',
      '- **Anti-sniping Protection**: Bids accepted within 30 seconds of closing extend closing time by 60 seconds.',
      '- **Proxy AutoBidding**: Private maximum bid ceilings with deterministic tie-breaking.',
      '- **Post-Auction Sales Lifecycle**: Approval -> Reservation -> Dual Handover Confirmation.',
      '- **Instant Interactive Testing**: Click the **Authorize** button above and enter:',
      '  - Mock User: `mock:seller_1:seller@campus.edu:DemoSeller` or `mock:buyer_1:buyer@campus.edu:DemoBuyer`',
      '  - Or a real Firebase Auth JWT ID Token.',
    ].join('\n'),
    contact: {
      name: 'CampusBid Team',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local Development Server (API v1)',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT or mock:<uid>:<email>:<name>',
        description: 'Enter Firebase ID Token or mock token e.g. mock:user_123:student@campus.edu:John',
      },
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          error: { type: 'object', nullable: true },
          meta: { type: 'object' },
        },
      },
      Listing: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '67bf98c5e63...' },
          title: { type: 'string', example: 'Hero Sprint 26T Mountain Bicycle' },
          category: {
            type: 'string',
            enum: ['CYCLES', 'TEXTBOOKS', 'ELECTRONICS', 'LAB_EQUIPMENT', 'FURNITURE', 'CALCULATORS', 'OTHER'],
            example: 'CYCLES',
          },
          condition: {
            type: 'string',
            enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'],
            example: 'LIKE_NEW',
          },
          startingPricePaise: { type: 'integer', example: 250000, description: '₹2,500' },
          minBidIncrementPaise: { type: 'integer', example: 5000, description: '₹50' },
          currentPricePaise: { type: 'integer', example: 380000, description: '₹3,800' },
          bidCount: { type: 'integer', example: 5 },
          status: { type: 'string', enum: ['ACTIVE', 'EXTENDED', 'CLOSED', 'CANCELLED'], example: 'ACTIVE' },
          closingAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'System health check and database status',
        responses: {
          200: { description: 'Healthy' },
          503: { description: 'Database disconnected' },
        },
      },
    },
    '/users/sync': {
      post: {
        tags: ['Users & Auth'],
        summary: 'Synchronize authenticated Firebase profile with MongoDB',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  displayName: { type: 'string', example: 'Rahul Verma' },
                  profileImage: {
                    type: 'object',
                    properties: {
                      secureUrl: { type: 'string', example: 'https://example.com/avatar.jpg' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Profile synchronized' } },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users & Auth'],
        summary: 'Get current user profile and private preferences',
        responses: { 200: { description: 'Current profile' } },
      },
      patch: {
        tags: ['Users & Auth'],
        summary: 'Update current user display name and notification preferences',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  displayName: { type: 'string', example: 'Rahul V.' },
                  notificationPreferences: {
                    type: 'object',
                    properties: {
                      outbid: { type: 'boolean', example: true },
                      closingSoon: { type: 'boolean', example: true },
                      saleUpdates: { type: 'boolean', example: true },
                      browserAlerts: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/users/{id}/public': {
      get: {
        tags: ['Users & Auth'],
        summary: 'Get public seller profile (no private email or secrets)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Public seller profile' } },
      },
    },
    '/listings': {
      get: {
        tags: ['Listings'],
        summary: 'Search and filter active campus auctions',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Keyword search' },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'condition', in: 'query', schema: { type: 'string' } },
          { name: 'minPrice', in: 'query', schema: { type: 'integer' }, description: 'Min price in paise' },
          { name: 'maxPrice', in: 'query', schema: { type: 'integer' }, description: 'Max price in paise' },
          { name: 'status', in: 'query', schema: { type: 'string', default: 'ACTIVE' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['closingSoon', 'priceAsc', 'priceDesc', 'newest'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
        ],
        responses: { 200: { description: 'List of matching auctions' } },
      },
      post: {
        tags: ['Listings'],
        summary: 'Create a new auction listing (Seller)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'category', 'description', 'condition', 'startingPricePaise', 'closingAt'],
                properties: {
                  title: { type: 'string', example: 'Casio fx-991EX ClassWiz' },
                  category: { type: 'string', example: 'CALCULATORS' },
                  description: { type: 'string', example: 'Scientific calculator in mint condition.' },
                  condition: { type: 'string', example: 'LIKE_NEW' },
                  startingPricePaise: { type: 'integer', example: 70000, description: '₹700' },
                  minBidIncrementPaise: { type: 'integer', example: 2500, description: '₹25' },
                  closingAt: { type: 'string', format: 'date-time' },
                  images: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        publicId: { type: 'string', example: 'calc_img_1' },
                        secureUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Listing created' } },
      },
    },
    '/listings/seller/me': {
      get: {
        tags: ['Listings'],
        summary: 'Get auctions created by the current seller',
        responses: { 200: { description: 'Seller listings' } },
      },
    },
    '/listings/{id}': {
      get: {
        tags: ['Listings'],
        summary: 'Get full auction details with public bid history',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Auction details' } },
      },
      patch: {
        tags: ['Listings'],
        summary: 'Edit listing details (safe fields only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  condition: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/listings/{id}/cancel': {
      post: {
        tags: ['Listings'],
        summary: 'Cancel an auction listing (Seller)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', example: 'Item was damaged during transport' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Cancelled' } },
      },
    },
    '/bids/my/active': {
      get: {
        tags: ['Bidding & Proxy Bids'],
        summary: 'Get active auctions where the authenticated buyer has placed bids',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'List of active auctions with buyer leading/outbid status',
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/listings/{id}/bids': {
      post: {
        tags: ['Bidding & Proxy Bids'],
        summary: 'Place manual bid (transaction-safe with anti-sniping extension)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amountPaise'],
                properties: { amountPaise: { type: 'integer', example: 100000, description: '₹1,000' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Bid accepted' } },
      },
      get: {
        tags: ['Bidding & Proxy Bids'],
        summary: 'Get immutable bid history for this listing',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bid ledger' } },
      },
    },
    '/listings/{id}/autobid': {
      post: {
        tags: ['Bidding & Proxy Bids'],
        summary: 'Configure private AutoBid maximum ceiling',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['maxAmountPaise'],
                properties: { maxAmountPaise: { type: 'integer', example: 250000, description: '₹2,500 private ceiling' } },
              },
            },
          },
        },
        responses: { 200: { description: 'AutoBid configured' } },
      },
      get: {
        tags: ['Bidding & Proxy Bids'],
        summary: 'Get caller\'s private AutoBid configuration',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Private configuration' } },
      },
      delete: {
        tags: ['Bidding & Proxy Bids'],
        summary: 'Disable caller\'s AutoBid configuration',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'AutoBid disabled' } },
      },
    },
    '/sales/my': {
      get: {
        tags: ['Sales & Handovers'],
        summary: 'Get sales history for current user (seller or buyer)',
        parameters: [{ name: 'role', in: 'query', schema: { type: 'string', enum: ['all', 'seller', 'buyer'] } }],
        responses: { 200: { description: 'Sales list' } },
      },
    },
    '/sales/{id}': {
      get: {
        tags: ['Sales & Handovers'],
        summary: 'Get sale record and handover status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Sale details' } },
      },
    },
    '/sales/{id}/approve': {
      post: {
        tags: ['Sales & Handovers'],
        summary: 'Seller approves winning price (Item becomes RESERVED)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Sale approved' } },
      },
    },
    '/sales/{id}/reject': {
      post: {
        tags: ['Sales & Handovers'],
        summary: 'Seller declines winning price (Item becomes REJECTED)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Sale rejected' } },
      },
    },
    '/sales/{id}/confirm-handover': {
      post: {
        tags: ['Sales & Handovers'],
        summary: 'Confirm in-person campus handover (both seller and buyer confirm)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Handover confirmed' } },
      },
    },
    '/sales/{id}/cancel': {
      post: {
        tags: ['Sales & Handovers'],
        summary: 'Cancel an active sale before handover',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', example: 'Buyer did not show up' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Sale cancelled' } },
      },
    },
    '/listings/{id}/questions': {
      get: {
        tags: ['Community Q&A'],
        summary: 'Get questions and answers for a listing',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Questions list' } },
      },
      post: {
        tags: ['Community Q&A'],
        summary: 'Ask the seller a question',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['questionText'],
                properties: { questionText: { type: 'string', example: 'Is the charger included?' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Question submitted' } },
      },
    },
    '/questions/{id}/answer': {
      post: {
        tags: ['Community Q&A'],
        summary: 'Seller answers a question on their listing',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['answerText'],
                properties: { answerText: { type: 'string', example: 'Yes, original fast charger is included.' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Answered' } },
      },
    },
    '/watchlist': {
      get: {
        tags: ['Watchlist'],
        summary: 'Get current user\'s bookmarked auctions',
        responses: { 200: { description: 'Watchlist items' } },
      },
    },
    '/watchlist/{id}': {
      post: {
        tags: ['Watchlist'],
        summary: 'Toggle listing in user\'s watchlist',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Watchlist toggled' } },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get user notifications with unread count',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Notifications list' } },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark single notification as read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Marked read' } },
      },
    },
    '/notifications/read-all': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        responses: { 200: { description: 'All marked read' } },
      },
    },
    '/saved-searches': {
      get: {
        tags: ['Saved Searches'],
        summary: 'Get caller saved searches',
        responses: { 200: { description: 'Saved search alerts' } },
      },
      post: {
        tags: ['Saved Searches'],
        summary: 'Create a saved search alert for campus listings',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', example: 'Bicycle' },
                  category: { type: 'string', example: 'CYCLES' },
                  maxPricePaise: { type: 'integer', example: 350000 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Saved search created' } },
      },
    },
    '/saved-searches/{id}': {
      delete: {
        tags: ['Saved Searches'],
        summary: 'Delete saved search alert',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/ai/query': {
      post: {
        tags: ['AI Assistant'],
        summary: 'Natural language search query grounded in real MongoDB listings with Gemini',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: { query: { type: 'string', example: 'Find me a bicycle under ₹4,000' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Matching listings and AI explanation' } },
      },
    },
    '/ai/propose-bid': {
      post: {
        tags: ['AI Assistant'],
        summary: 'Propose structured bidding action requiring explicit confirmation',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['listingId', 'proposedAmountRupees'],
                properties: {
                  listingId: { type: 'string' },
                  actionType: { type: 'string', default: 'MANUAL_BID' },
                  proposedAmountRupees: { type: 'number', example: 3800 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Structured proposal' } },
      },
    },
    '/uploads/sign': {
      post: {
        tags: ['Uploads'],
        summary: 'Generate signed upload parameters for Cloudinary direct upload',
        responses: { 200: { description: 'Upload parameters' } },
      },
    },
    '/uploads/mock-upload': {
      post: {
        tags: ['Uploads'],
        summary: 'Simulate direct upload without Cloudinary API credentials for testing',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['filename'],
                properties: {
                  filename: { type: 'string', example: 'drafter.jpg' },
                  contentType: { type: 'string', example: 'image/jpeg' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Mock image metadata' } },
      },
    },
  },
};

export { swaggerUi };
