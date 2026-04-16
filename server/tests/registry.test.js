import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Registry API', () => {
  let app;

  beforeAll(() => {
    app = createApp(':memory:');
  });

  describe('GET /api/registry/element-types', () => {
    it('returns element types grouped by category', async () => {
      const res = await request(app).get('/api/registry/element-types');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
      expect(res.body[0].name).toBe('basic_input');
      expect(res.body[0].types).toHaveLength(8);
      expect(res.body[0].types[0]).toMatchObject({
        name: 'textfield',
        label: 'Text Field',
        icon: 'text_fields',
        is_layout: 0,
      });
    });

    it('returns categories in display_order', async () => {
      const res = await request(app).get('/api/registry/element-types');
      const names = res.body.map(c => c.name);
      expect(names).toEqual(['basic_input', 'selection', 'layout', 'content', 'advanced']);
    });

    it('layout types have is_layout = 1', async () => {
      const res = await request(app).get('/api/registry/element-types');
      const layoutCat = res.body.find(c => c.name === 'layout');
      for (const t of layoutCat.types) {
        expect(t.is_layout).toBe(1);
      }
    });
  });

  describe('GET /api/registry/element-types/:id/properties', () => {
    it('returns properties for textfield grouped by property group', async () => {
      const typesRes = await request(app).get('/api/registry/element-types');
      const textfieldId = typesRes.body[0].types[0].id;

      const res = await request(app).get(`/api/registry/element-types/${textfieldId}/properties`);
      expect(res.status).toBe(200);

      const groupNames = res.body.map(g => g.name);
      expect(groupNames).toContain('general');
      expect(groupNames).toContain('validation');
      expect(groupNames).toContain('display');

      const general = res.body.find(g => g.name === 'general');
      expect(general.properties[0]).toMatchObject({
        name: 'label',
        is_required: 1,
        data_type: 'string',
        input_type: 'text',
      });
    });

    it('returns 404 for non-existent type', async () => {
      const res = await request(app).get('/api/registry/element-types/9999/properties');
      expect(res.status).toBe(404);
    });

    it('row type has only columns and css_class', async () => {
      const typesRes = await request(app).get('/api/registry/element-types');
      const layoutCat = typesRes.body.find(c => c.name === 'layout');
      const rowId = layoutCat.types.find(t => t.name === 'row').id;

      const res = await request(app).get(`/api/registry/element-types/${rowId}/properties`);
      const allProps = res.body.flatMap(g => g.properties);
      expect(allProps).toHaveLength(2);
      expect(allProps.map(p => p.name)).toEqual(['columns', 'css_class']);
    });
  });

  describe('GET /api/registry/condition-actions', () => {
    it('returns all condition action types', async () => {
      const res = await request(app).get('/api/registry/condition-actions');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      expect(res.body[0]).toMatchObject({ name: 'show', label: 'Show' });
    });
  });

  describe('GET /api/registry/condition-operators', () => {
    it('returns all condition operators', async () => {
      const res = await request(app).get('/api/registry/condition-operators');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
      expect(res.body[0]).toMatchObject({ name: 'equals', label: 'Equals' });
    });
  });
});
