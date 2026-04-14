import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../db/database.js';
import { createApp } from '../app.js';

let db, app;

beforeEach(() => {
  db = createDb(':memory:');
  app = createApp(db);
});

describe('Forms API', () => {
  it('POST /api/forms creates form with version 1', async () => {
    const res = await request(app)
      .post('/api/forms')
      .send({ name: 'Test Form', description: 'A test', schema: { display: 'form', components: [] } });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Form');
    expect(res.body.current_version).toBe(1);
  });

  it('GET /api/forms lists all forms', async () => {
    await request(app).post('/api/forms').send({ name: 'Form A', schema: { components: [] } });
    await request(app).post('/api/forms').send({ name: 'Form B', schema: { components: [] } });

    const res = await request(app).get('/api/forms');
    expect(res.body).toHaveLength(2);
  });

  it('GET /api/forms/:id returns form with current schema', async () => {
    await request(app).post('/api/forms').send({
      name: 'Test',
      schema: { components: [{ type: 'textfield', key: 'name', label: 'Name' }] },
    });

    const res = await request(app).get('/api/forms/1');
    expect(res.status).toBe(200);
    expect(res.body.schema.components).toHaveLength(1);
    expect(res.body.schema.components[0].key).toBe('name');
  });

  it('PUT /api/forms/:id creates new version', async () => {
    await request(app).post('/api/forms').send({ name: 'Test', schema: { components: [] } });

    const res = await request(app).put('/api/forms/1').send({
      name: 'Test Updated',
      schema: { components: [{ type: 'textfield', key: 'email', label: 'Email' }] },
    });

    expect(res.body.current_version).toBe(2);
    expect(res.body.schema.components[0].key).toBe('email');

    const versions = await request(app).get('/api/forms/1/versions');
    expect(versions.body).toHaveLength(2);
    expect(versions.body[0].version_num).toBe(2);
    expect(versions.body[1].version_num).toBe(1);
  });

  it('GET /api/forms/:id returns 404 for missing form', async () => {
    const res = await request(app).get('/api/forms/999');
    expect(res.status).toBe(404);
  });
});
