import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../db/database.js';
import { createApp } from '../app.js';

let db, app;

beforeEach(async () => {
  db = createDb(':memory:');
  app = createApp(db);

  await request(app).post('/api/forms').send({
    name: 'Test Form',
    schema: { components: [{ type: 'textfield', key: 'name', label: 'Name' }] },
  });
  await request(app).post('/api/sub-apps').send({
    name: 'Test App', description: 'Test', form_id: 1,
  });
});

describe('Submissions API', () => {
  it('POST creates submission pinned to current form version', async () => {
    const res = await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'John' } });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('John');
    expect(res.body.status).toBe('submitted');
  });

  it('old submissions keep old version after form edit', async () => {
    // Submit with version 1
    await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'John' } });

    // Edit form -> version 2
    await request(app).put('/api/forms/1').send({
      name: 'Test Form',
      schema: { components: [{ type: 'textfield', key: 'name' }, { type: 'email', key: 'email' }] },
    });

    // Submit with version 2
    await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'Jane', email: 'jane@test.com' } });

    // First submission still has version 1 schema (1 component)
    const sub1 = await request(app).get('/api/submissions/1');
    expect(sub1.body.version_num).toBe(1);
    expect(sub1.body.schema.components).toHaveLength(1);

    // Second submission has version 2 schema (2 components)
    const sub2 = await request(app).get('/api/submissions/2');
    expect(sub2.body.version_num).toBe(2);
    expect(sub2.body.schema.components).toHaveLength(2);
  });

  it('GET /api/submissions/:id returns submission with schema', async () => {
    await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'Test' } });

    const res = await request(app).get('/api/submissions/1');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test');
    expect(res.body.schema.components).toBeDefined();
  });

  it('GET filters submissions by user_id', async () => {
    await request(app).post('/api/sub-apps/1/submissions').send({ user_id: 'user1', data: { name: 'A' } });
    await request(app).post('/api/sub-apps/1/submissions').send({ user_id: 'user2', data: { name: 'B' } });

    const res = await request(app).get('/api/sub-apps/1/submissions?user_id=user1');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].data.name).toBe('A');
  });
});
