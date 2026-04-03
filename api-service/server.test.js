const request = require('supertest');

// Mock pg module before requiring the app
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    rpush: jest.fn().mockResolvedValue(1),
    llen: jest.fn().mockResolvedValue(0),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

const app = require('./server');

describe('API Service', () => {
  describe('GET /', () => {
    it('should return a welcome message', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('API Service Running');
    });
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /users', () => {
    it('should return an array', async () => {
      const res = await request(app).get('/users');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /users', () => {
    it('should create a user', async () => {
      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'TestUser' }] });

      const res = await request(app)
        .post('/users')
        .send({ name: 'TestUser' })
        .set('Content-Type', 'application/json');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /jobs', () => {
    it('should enqueue a job', async () => {
      const res = await request(app)
        .post('/jobs')
        .send({ job: 'test-job' })
        .set('Content-Type', 'application/json');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('queued', true);
    });
  });
});
