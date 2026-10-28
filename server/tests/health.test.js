import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health and System Routes', () => {
  it('GET / should return service info and doc endpoints', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'CampusBid API');
    expect(res.body).toHaveProperty('docs', '/api-docs');
    expect(res.body).toHaveProperty('openApiSpec', '/api-docs.json');
  });

  it('GET /api-docs.json should serve OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('openapi', '3.0.3');
    expect(res.body.info).toHaveProperty('title', 'CampusBid API Documentation');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/listings');
    expect(res.body.paths).toHaveProperty('/listings/{id}/bids');
  });

  it('GET /api-docs/ should serve interactive Swagger HTML', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('swagger-ui');
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
