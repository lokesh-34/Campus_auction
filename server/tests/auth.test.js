import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { User } from '../src/models/index.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Authentication & User Management APIs', () => {
  const mockToken = 'mock:test_firebase_user_1:testuser@campus.edu:John Doe';

  it('rejects protected routes without Bearer token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('syncs authenticated user and auto-provisions profile', async () => {
    const res = await request(app)
      .post('/api/v1/users/sync')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({ displayName: 'John Student' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('John Student');
    expect(res.body.data.email).toBe('testuser@campus.edu');
  });

  it('retrieves current authenticated profile via /api/v1/users/me', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${mockToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('notificationPreferences');
    expect(res.body.data.stats).toHaveProperty('completedSales', 0);
  });

  it('updates notification preferences and profile', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({
        displayName: 'John Updated',
        notificationPreferences: { outbid: false, closingSoon: true },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('John Updated');
    expect(res.body.data.notificationPreferences.outbid).toBe(false);
  });

  it('returns public profile without leaking private email or preferences', async () => {
    const user = await User.findOne({ firebaseUid: 'test_firebase_user_1' });
    const res = await request(app).get(`/api/v1/users/${user._id}/public`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.displayName).toBe('John Updated');
    expect(res.body.data.profile).not.toHaveProperty('email');
    expect(res.body.data.profile).not.toHaveProperty('notificationPreferences');
    expect(res.body.data).toHaveProperty('activeListings');
  });
});
