import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Submissions API with conditions', () => {
  let app, formId, subAppId;
  let selectTypeId, textTypeId, showActionId, requireActionId, equalsOpId;

  beforeAll(async () => {
    app = createApp(':memory:');

    const types = await request(app).get('/api/registry/element-types');
    selectTypeId = types.body.find(c => c.name === 'selection').types.find(t => t.name === 'select').id;
    textTypeId = types.body.find(c => c.name === 'basic_input').types.find(t => t.name === 'textfield').id;

    const actions = await request(app).get('/api/registry/condition-actions');
    showActionId = actions.body.find(a => a.name === 'show').id;
    requireActionId = actions.body.find(a => a.name === 'require').id;

    const ops = await request(app).get('/api/registry/condition-operators');
    equalsOpId = ops.body.find(o => o.name === 'equals').id;

    const form = await request(app).post('/api/forms').send({ name: 'Conditional Form' });
    formId = form.body.id;

    await request(app).put(`/api/forms/${formId}`).send({
      name: 'Conditional Form',
      elements: [
        {
          element_type_id: selectTypeId,
          element_key: 'department',
          position: 0,
          parent_key: null,
          values: { label: 'Department', required: 'true' },
          options: [
            { label: 'Engineering', value: 'eng', display_order: 0 },
            { label: 'HR', value: 'hr', display_order: 1 },
          ],
          conditions: [],
        },
        {
          element_type_id: textTypeId,
          element_key: 'tech_stack',
          position: 1,
          parent_key: null,
          values: { label: 'Tech Stack' },
          options: [],
          conditions: [
            {
              action_type_id: showActionId,
              action_value: null,
              logic_operator: 'AND',
              rules: [{ source_key: 'department', operator_id: equalsOpId, value: 'eng' }],
            },
            {
              action_type_id: requireActionId,
              action_value: null,
              logic_operator: 'AND',
              rules: [{ source_key: 'department', operator_id: equalsOpId, value: 'eng' }],
            },
          ],
        },
      ],
    });

    const sa = await request(app).post('/api/sub-apps').send({ name: 'Test App', form_id: formId });
    subAppId = sa.body.id;
  });

  it('accepts submission when conditional field is hidden', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { department: 'hr' } });
    expect(res.status).toBe(201);
  });

  it('rejects submission when conditional field is visible+required but missing', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { department: 'eng' } });
    expect(res.status).toBe(400);
    expect(res.body.errors.tech_stack).toBeDefined();
  });

  it('accepts submission when conditional field is visible+required and provided', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { department: 'eng', tech_stack: 'React, Node.js' } });
    expect(res.status).toBe(201);
  });

  it('saves submission values as individual rows', async () => {
    const create = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user2', values: { department: 'eng', tech_stack: 'Python' } });

    const res = await request(app).get(`/api/submissions/${create.body.id}`);
    expect(res.body.values).toBeDefined();
    expect(res.body.values.department).toBe('eng');
    expect(res.body.values.tech_stack).toBe('Python');
  });
});
