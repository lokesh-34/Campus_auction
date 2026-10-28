import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health and System Routes', () => {
  it('GET / should return service info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'CampusBid API');
  });

  it('GET /api/v1/health should return system health status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBeOneOf([200, 503]);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('database');
  });

  it('GET unknown route should return 404 with structured error', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
