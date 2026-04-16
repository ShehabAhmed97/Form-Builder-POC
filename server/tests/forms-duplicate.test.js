import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('POST /api/forms/:id/duplicate', () => {
  let app;

  beforeAll(() => {
    app = createApp(':memory:');
  });

  it('duplicates a form with all elements, values, options, and conditions', async () => {
    const create = await request(app).post('/api/forms').send({ name: 'Source Form' });
    const sourceId = create.body.id;

    const typesRes = await request(app).get('/api/registry/element-types');
    const textType = typesRes.body.find(c => c.name === 'basic_input').types.find(t => t.name === 'textfield');
    const selectType = typesRes.body.find(c => c.name === 'selection').types.find(t => t.name === 'select');

    const actionsRes = await request(app).get('/api/registry/condition-actions');
    const showAction = actionsRes.body.find(a => a.name === 'show');
    const opsRes = await request(app).get('/api/registry/condition-operators');
    const equalsOp = opsRes.body.find(o => o.name === 'equals');

    await request(app).put(`/api/forms/${sourceId}`).send({
      name: 'Source Form',
      elements: [
        {
          element_type_id: selectType.id, element_key: 'dept', position: 0, parent_key: null,
          values: { label: 'Department', required: 'true' },
          options: [{ label: 'Eng', value: 'eng', display_order: 0 }, { label: 'HR', value: 'hr', display_order: 1 }],
          conditions: [],
        },
        {
          element_type_id: textType.id, element_key: 'stack', position: 1, parent_key: null,
          values: { label: 'Stack' }, options: [],
          conditions: [{
            action_type_id: showAction.id, action_value: null, logic_operator: 'AND',
            rules: [{ source_key: 'dept', operator_id: equalsOp.id, value: 'eng' }],
          }],
        },
      ],
    });

    const dupRes = await request(app).post(`/api/forms/${sourceId}/duplicate`);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.id).not.toBe(sourceId);
    expect(dupRes.body.name).toBe('Source Form (Copy)');
    expect(dupRes.body.current_version).toBe(1);

    const loaded = await request(app).get(`/api/forms/${dupRes.body.id}`);
    expect(loaded.body.elements).toHaveLength(2);
    expect(loaded.body.elements[0].element_key).toBe('dept');
    expect(loaded.body.elements[0].options).toHaveLength(2);
    expect(loaded.body.elements[1].element_key).toBe('stack');
    expect(loaded.body.elements[1].conditions).toHaveLength(1);
    expect(loaded.body.elements[1].conditions[0].rules[0].source_key).toBe('dept');
  });

  it('returns 404 for non-existent form', async () => {
    const res = await request(app).post('/api/forms/9999/duplicate');
    expect(res.status).toBe(404);
  });
});
