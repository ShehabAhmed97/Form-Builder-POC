import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Forms API', () => {
  let app;

  beforeAll(() => {
    app = createApp(':memory:');
  });

  describe('POST /api/forms', () => {
    it('creates a new blank form with version 1', async () => {
      const res = await request(app)
        .post('/api/forms')
        .send({ name: 'Test Form', description: 'A test' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Test Form',
        description: 'A test',
        current_version: 1,
      });
      expect(res.body.id).toBeDefined();
    });

    it('requires name', async () => {
      const res = await request(app).post('/api/forms').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/forms/:id', () => {
    it('returns form with empty elements for new form', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Empty Form' });

      const res = await request(app).get(`/api/forms/${create.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Empty Form');
      expect(res.body.elements).toEqual([]);
    });

    it('returns 404 for non-existent form', async () => {
      const res = await request(app).get('/api/forms/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/forms/:id — save with elements', () => {
    it('saves elements and creates new version', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'My Form' });
      const formId = create.body.id;

      const res = await request(app)
        .put(`/api/forms/${formId}`)
        .send({
          name: 'My Form Updated',
          description: 'Updated desc',
          elements: [
            {
              element_type_id: 1,
              element_key: 'first_name',
              position: 0,
              parent_key: null,
              values: { label: 'First Name', placeholder: 'Enter name', required: 'true' },
              options: [],
            },
            {
              element_type_id: 1,
              element_key: 'last_name',
              position: 1,
              parent_key: null,
              values: { label: 'Last Name' },
              options: [],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('My Form Updated');
      expect(res.body.current_version).toBe(2);
    });

    it('persists elements that can be loaded back', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Persist Test' });
      const formId = create.body.id;

      await request(app)
        .put(`/api/forms/${formId}`)
        .send({
          name: 'Persist Test',
          elements: [
            {
              element_type_id: 1,
              element_key: 'email_field',
              position: 0,
              parent_key: null,
              values: { label: 'Email', required: 'true', pattern: '^.+@.+$' },
              options: [],
            },
          ],
        });

      const res = await request(app).get(`/api/forms/${formId}`);
      expect(res.body.elements).toHaveLength(1);
      expect(res.body.elements[0]).toMatchObject({
        element_key: 'email_field',
        type_name: 'textfield',
        position: 0,
        parent_id: null,
      });
      expect(res.body.elements[0].values).toMatchObject({
        label: 'Email',
        required: 'true',
        pattern: '^.+@.+$',
      });
    });

    it('saves options for select elements', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Options Test' });
      const formId = create.body.id;

      const typesRes = await request(app).get('/api/registry/element-types');
      const selectType = typesRes.body
        .find(c => c.name === 'selection').types
        .find(t => t.name === 'select');

      await request(app)
        .put(`/api/forms/${formId}`)
        .send({
          name: 'Options Test',
          elements: [
            {
              element_type_id: selectType.id,
              element_key: 'department',
              position: 0,
              parent_key: null,
              values: { label: 'Department', required: 'true' },
              options: [
                { label: 'HR', value: 'hr', display_order: 0 },
                { label: 'Engineering', value: 'eng', display_order: 1 },
              ],
            },
          ],
        });

      const res = await request(app).get(`/api/forms/${formId}`);
      expect(res.body.elements[0].options).toHaveLength(2);
      expect(res.body.elements[0].options[0]).toMatchObject({
        label: 'HR',
        value: 'hr',
      });
    });

    it('version pinning works — old version data preserved', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Version Test' });
      const formId = create.body.id;

      await request(app).put(`/api/forms/${formId}`).send({
        name: 'Version Test',
        elements: [
          { element_type_id: 1, element_key: 'field_a', position: 0, parent_key: null, values: { label: 'Field A' }, options: [] },
        ],
      });

      await request(app).put(`/api/forms/${formId}`).send({
        name: 'Version Test',
        elements: [
          { element_type_id: 1, element_key: 'field_b', position: 0, parent_key: null, values: { label: 'Field B' }, options: [] },
        ],
      });

      const current = await request(app).get(`/api/forms/${formId}`);
      expect(current.body.current_version).toBe(3);
      expect(current.body.elements[0].element_key).toBe('field_b');

      const versions = await request(app).get(`/api/forms/${formId}/versions`);
      const v2 = versions.body.find(v => v.version_num === 2);

      const v2Detail = await request(app).get(`/api/forms/${formId}/versions/${v2.id}`);
      expect(v2Detail.body.elements[0].element_key).toBe('field_a');
    });
  });
});
