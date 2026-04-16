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

describe('Submissions API with data_table', () => {
  let app, formId, subAppId;
  let textTypeId, numberTypeId, dataTableTypeId;

  beforeAll(async () => {
    app = createApp(':memory:');

    const types = await request(app).get('/api/registry/element-types');
    const basicInput = types.body.find(c => c.name === 'basic_input');
    textTypeId = basicInput.types.find(t => t.name === 'textfield').id;
    numberTypeId = basicInput.types.find(t => t.name === 'number').id;
    dataTableTypeId = types.body.find(c => c.name === 'layout').types.find(t => t.name === 'data_table').id;

    const form = await request(app).post('/api/forms').send({ name: 'Table Form' });
    formId = form.body.id;

    await request(app).put(`/api/forms/${formId}`).send({
      name: 'Table Form',
      elements: [
        {
          element_type_id: dataTableTypeId,
          element_key: 'expenses',
          position: 0,
          parent_key: null,
          values: { label: 'Expenses', min_rows: '1' },
          options: [],
          conditions: [],
        },
        {
          element_type_id: textTypeId,
          element_key: 'item',
          position: 0,
          parent_key: 'expenses',
          values: { label: 'Item', required: 'true' },
          options: [],
          conditions: [],
        },
        {
          element_type_id: numberTypeId,
          element_key: 'cost',
          position: 1,
          parent_key: 'expenses',
          values: { label: 'Cost' },
          options: [],
          conditions: [],
        },
      ],
    });

    const sa = await request(app).post('/api/sub-apps').send({ name: 'Expense App', form_id: formId });
    subAppId = sa.body.id;
  });

  it('rejects submission when min_rows not met', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { expenses: [] } });
    expect(res.status).toBe(400);
    expect(res.body.errors.expenses).toBeDefined();
  });

  it('rejects submission when required cell is empty', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { expenses: [{ item: '', cost: '50' }] } });
    expect(res.status).toBe(400);
    expect(res.body.errors['expenses.0.item']).toBeDefined();
  });

  it('accepts valid table submission', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { expenses: [{ item: 'Flight', cost: '500' }] } });
    expect(res.status).toBe(201);
  });

  it('returns table data as parsed array on GET', async () => {
    const create = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({ user_id: 'user1', values: { expenses: [{ item: 'Hotel', cost: '300' }, { item: 'Taxi', cost: '50' }] } });

    const res = await request(app).get(`/api/submissions/${create.body.id}`);
    expect(res.body.values.expenses).toEqual([
      { item: 'Hotel', cost: '300' },
      { item: 'Taxi', cost: '50' },
    ]);
  });
});
