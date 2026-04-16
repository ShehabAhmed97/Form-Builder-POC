# Dynamic Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the `data_table` layout element into a dynamic repeatable-row table where child elements define columns, users add/remove rows at fill-time, and submission data is stored as a JSON array.

**Architecture:** Child elements of a data_table become column definitions. The renderer shows an HTML table with add/remove row controls. Table data is serialized as a JSON array string in a single `submission_values` row. Backend validation checks `min_rows` and per-cell constraints.

**Tech Stack:** React (Vite), TailwindCSS, Express, SQLite (node:sqlite), Vitest + Supertest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `server/db/seed.js:279-283` | Replace `columns`+`rows` properties with `min_rows` |
| Modify | `client/src/components/builder/FormCanvas.jsx:106-172` | Table preview rendering in builder canvas |
| Modify | `client/src/components/FormRenderer.jsx:468-478` | Dynamic table renderer with add/remove rows |
| Modify | `server/routes/submissions.js:152-212` | Store table data as JSON, validate min_rows + per-cell |
| Modify | `server/routes/submissions.js:217-246` | Parse JSON array back when reading submissions |
| Modify | `client/src/components/SubmissionViewer.jsx` | Render table data as read-only HTML table |
| Modify | `server/tests/submissions.test.js` | Add data_table submission tests |
| Modify | `docs/superpowers/specs/2026-04-16-form-builder-redesign-design.md:289-293` | Update data_table description in original design |
| Modify | `docs/superpowers/specs/2026-04-17-data-table-design.md` | Keep in sync with any implementation deviations |

---

### Task 1: Update Seed Data

**Files:**
- Modify: `server/db/seed.js:279-283`

- [ ] **Step 1: Replace data_table properties in seed**

In `server/db/seed.js`, find the `data_table` property block (lines 279-283):

```js
    // data_table (4 props)
    ['data_table', 'label', 1, 1, null],
    ['data_table', 'columns', 1, 2, '2'],
    ['data_table', 'rows', 0, 3, '3'],
    ['data_table', 'css_class', 0, 4, null],
```

Replace with:

```js
    // data_table (3 props)
    ['data_table', 'label', 1, 1, null],
    ['data_table', 'min_rows', 0, 2, '0'],
    ['data_table', 'css_class', 0, 3, null],
```

- [ ] **Step 2: Add `min_rows` property definition if missing**

In the `propertyDefinitions` array in `seed.js`, check if `min_rows` exists. If not, add it:

```js
    { group: 'validation', name: 'min_rows', label: 'Minimum Rows', data_type: 'number', input_type: 'number', description: 'Minimum number of rows required', default_value: '0' },
```

- [ ] **Step 3: Run tests to verify seed still works**

Run: `cd server && npm test`
Expected: All existing tests pass (seed runs on `:memory:` DB per test)

- [ ] **Step 4: Commit**

```bash
git add server/db/seed.js
git commit -m "feat: replace data_table columns/rows properties with min_rows"
```

---

### Task 2: Builder Canvas — Table Preview

**Files:**
- Modify: `client/src/components/builder/FormCanvas.jsx:106-172`

The current `renderChildren` function handles `row` (grid) and everything else (vertical stack). Add a third branch for `data_table` that renders a table preview.

- [ ] **Step 1: Add data_table branch to renderChildren**

In `FormCanvas.jsx`, inside the `renderChildren` function (after the `if (isRow)` block, before the `// Section / other layout` comment), add a `data_table` branch:

```jsx
    // Data table: show column preview as a table
    if (parent?.type_name === 'data_table') {
      return (
        <div className="p-2">
          {children.length === 0 ? (
            <div
              onDragOver={(e) => handleDragOver(e, `${parentKey}:0`)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, parentKey, 0)}
              className={`min-h-[3rem] border border-dashed rounded-md flex items-center justify-center text-xs text-gray-400 transition-colors ${
                dragOverTarget === `${parentKey}:0` ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
              }`}
            >
              Drop input elements here to define columns
            </div>
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {children.map((child, index) => (
                      <th key={child.element_key} className="border border-gray-300 px-2 py-1.5 text-left text-xs font-semibold text-gray-600">
                        <div className="flex items-center justify-between gap-1">
                          <span>{child.values.label || child.element_key}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemove(child.element_key); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5"
                            title="Remove column"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {children.map(child => (
                      <td key={child.element_key} className="border border-gray-200 px-2 py-1.5 text-xs text-gray-400 italic">
                        {child.type_name}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <div
                onDragOver={(e) => handleDragOver(e, `${parentKey}:${children.length}`)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, parentKey, children.length)}
                className={`mt-1 h-6 border border-dashed rounded flex items-center justify-center text-xs text-gray-400 transition-colors ${
                  dragOverTarget === `${parentKey}:${children.length}` ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
              >
                + column
              </div>
            </>
          )}
        </div>
      );
    }
```

- [ ] **Step 2: Make child elements in data_table selectable by clicking column headers**

The column headers already show labels. To select a child element for property editing, wrap each `<th>` content so clicking it calls `onSelect`. Update the `<th>` to add an onClick:

```jsx
<th
  key={child.element_key}
  onClick={(e) => { e.stopPropagation(); onSelect(child.element_key); }}
  className={`border border-gray-300 px-2 py-1.5 text-left text-xs font-semibold cursor-pointer transition-colors ${
    selectedKey === child.element_key ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
  }`}
>
```

Note: `onSelect` is already passed as a prop to FormCanvas but not destructured directly — it's available via the `onSelect` prop. Check that the prop name is correct (it's passed as `onSelect` from `FormBuilderLayout.jsx`).

- [ ] **Step 3: Verify in browser**

Start the dev server: `cd client && npm run dev`
Open the form builder, add a data_table element, drop input elements into it.
Expected: See a table with column headers and type placeholders.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/builder/FormCanvas.jsx
git commit -m "feat: builder canvas renders data_table as column-preview table"
```

---

### Task 3: Renderer — Dynamic Table with Add/Remove Rows

**Files:**
- Modify: `client/src/components/FormRenderer.jsx:468-478` (data_table case in `renderElementTree`)
- Modify: `client/src/components/FormRenderer.jsx:198-199` (state initialization)

This is the largest task. The `RelationalFormRenderer` needs to handle `data_table` elements by rendering a full interactive table.

- [ ] **Step 1: Update state shape to support table data**

In `RelationalFormRenderer` (line 199), the current state is a flat `values` object. Table data will be stored as arrays under the table's element_key. No change needed to the `useState({})` call — arrays are valid values.

Update `handleChange` (line 273) to also support the table case. The table component will call `handleChange(tableKey, rowsArray)` directly, so the existing logic already works:

```jsx
const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };
```

This already supports setting `values.expenses = [...]`. No change needed.

- [ ] **Step 2: Replace the data_table case in renderElementTree**

In `renderElementTree` (around line 469), replace the current `data_table` block:

```jsx
      // Layout: Data Table (dynamic rows)
      if (el.type_name === 'data_table') {
        const columns = getChildren(el.element_key);
        const tableKey = el.element_key;
        const rows = Array.isArray(values[tableKey]) ? values[tableKey] : [];
        const minRows = Number(el.values.min_rows) || 0;
        const tableError = errors[tableKey];

        const addRow = () => {
          const emptyRow = {};
          for (const col of columns) emptyRow[col.element_key] = '';
          handleChange(tableKey, [...rows, emptyRow]);
        };

        const removeRow = (rowIdx) => {
          handleChange(tableKey, rows.filter((_, i) => i !== rowIdx));
        };

        const updateCell = (rowIdx, colKey, cellValue) => {
          const updated = rows.map((row, i) =>
            i === rowIdx ? { ...row, [colKey]: cellValue } : row
          );
          handleChange(tableKey, updated);
          // Clear cell-level error
          const cellErrorKey = `${tableKey}.${rowIdx}.${colKey}`;
          if (errors[cellErrorKey]) {
            setErrors(prev => { const next = { ...prev }; delete next[cellErrorKey]; return next; });
          }
        };

        // Initialize min rows on first render if needed
        if (minRows > 0 && rows.length === 0) {
          const initial = Array.from({ length: minRows }, () => {
            const row = {};
            for (const col of columns) row[col.element_key] = '';
            return row;
          });
          // Use setTimeout to avoid setState during render
          setTimeout(() => handleChange(tableKey, initial), 0);
        }

        const renderCellInput = (col, rowIdx, cellValue) => {
          const cellErrorKey = `${tableKey}.${rowIdx}.${col.element_key}`;
          const cellError = errors[cellErrorKey];
          const inputClass = `w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none ${
            cellError ? 'border-red-500' : 'border-gray-300'
          }`;

          let input;
          switch (col.type_name) {
            case 'textarea':
              input = <textarea value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} rows={2} className={inputClass} />;
              break;
            case 'number':
              input = <input type="number" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
              break;
            case 'email':
              input = <input type="email" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
              break;
            case 'phone':
              input = <input type="tel" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
              break;
            case 'date':
              input = <input type="date" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
              break;
            case 'time':
              input = <input type="time" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
              break;
            case 'datetime':
              input = <input type="datetime-local" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
              break;
            case 'select':
              input = (
                <select value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass + ' bg-white'}>
                  <option value="">Select...</option>
                  {(col.options || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              );
              break;
            case 'checkbox':
              input = (
                <input type="checkbox" checked={cellValue === 'true'} onChange={e => updateCell(rowIdx, col.element_key, e.target.checked ? 'true' : 'false')} className="rounded text-blue-600" />
              );
              break;
            case 'toggle':
              input = (
                <input type="checkbox" checked={cellValue === 'true'} onChange={e => updateCell(rowIdx, col.element_key, e.target.checked ? 'true' : 'false')} className="rounded text-blue-600" />
              );
              break;
            default:
              input = <input type="text" value={cellValue} onChange={e => updateCell(rowIdx, col.element_key, e.target.value)} className={inputClass} />;
          }

          return (
            <td key={col.element_key} className="border border-gray-200 px-2 py-1.5">
              {input}
              {cellError && <p className="text-xs text-red-500 mt-0.5">{cellError}</p>}
            </td>
          );
        };

        return (
          <div key={el.element_key} className="mb-4">
            {el.values.label && (
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {el.values.label}
                {minRows > 0 && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
            {tableError && <p className="text-sm text-red-500 mb-1">{tableError}</p>}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map(col => (
                      <th key={col.element_key} className="border border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-600">
                        {col.values.label || col.element_key}
                        {col.values.required === 'true' && <span className="text-red-500 ml-0.5">*</span>}
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {columns.map(col => renderCellInput(col, rowIdx, row[col.element_key] ?? ''))}
                      <td className="border border-gray-200 px-2 py-1.5 text-center">
                        {rows.length > minRows && (
                          <button
                            type="button"
                            onClick={() => removeRow(rowIdx)}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove row"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 1} className="border border-gray-200 px-4 py-3 text-center text-gray-400 text-sm">
                        No rows added yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Row
            </button>
          </div>
        );
      }
```

- [ ] **Step 3: Update validation to handle data_table**

In the `validate` function (line 278), add data_table validation. Currently `inputElements` filters out layout elements. The table itself is a layout element, so it's already excluded from flat validation. Add a new block after the existing loop:

```jsx
  const validate = () => {
    const newErrors = {};
    // Existing flat field validation...
    for (const el of inputElements) {
      // ... existing code stays the same ...
    }

    // Data table validation
    for (const el of elements) {
      if (el.type_name !== 'data_table') continue;
      const state = elementStates.get(el.element_key);
      if (!state?.visible) continue;

      const tableKey = el.element_key;
      const rows = Array.isArray(values[tableKey]) ? values[tableKey] : [];
      const minRows = Number(el.values.min_rows) || 0;
      const columns = elements.filter(c => c.parent_key === tableKey).sort((a, b) => a.position - b.position);

      if (minRows > 0 && rows.length < minRows) {
        newErrors[tableKey] = `At least ${minRows} row${minRows > 1 ? 's' : ''} required`;
      }

      // Per-cell validation
      for (let ri = 0; ri < rows.length; ri++) {
        for (const col of columns) {
          const cellVal = rows[ri][col.element_key] ?? '';
          const cellErrorKey = `${tableKey}.${ri}.${col.element_key}`;

          if (col.values.required === 'true' && (!cellVal || cellVal === '')) {
            newErrors[cellErrorKey] = `${col.values.label || col.element_key} is required`;
          }
          if (col.values.min_length && cellVal && String(cellVal).length < Number(col.values.min_length)) {
            newErrors[cellErrorKey] = col.values.custom_error || `Minimum ${col.values.min_length} characters`;
          }
          if (col.values.max_length && cellVal && String(cellVal).length > Number(col.values.max_length)) {
            newErrors[cellErrorKey] = col.values.custom_error || `Maximum ${col.values.max_length} characters`;
          }
          if (col.values.pattern && cellVal) {
            try {
              if (!new RegExp(col.values.pattern).test(String(cellVal))) {
                newErrors[cellErrorKey] = col.values.custom_error || 'Invalid format';
              }
            } catch { /* invalid regex */ }
          }
        }
      }
    }

    return newErrors;
  };
```

- [ ] **Step 4: Exclude data_table children from flat inputElements**

The `inputElements` filter (line 207) currently keeps all non-layout, non-content elements. Children of a data_table are columns, not standalone fields. Update the filter:

```jsx
  // Build set of element_keys that are children of a data_table
  const dataTableChildKeys = new Set();
  for (const el of elements) {
    if (el.type_name === 'data_table') {
      for (const child of elements) {
        if (child.parent_key === el.element_key) {
          dataTableChildKeys.add(child.element_key);
        }
      }
    }
  }

  const inputElements = elements.filter(
    el => !el.is_layout && !['heading', 'subheading', 'text'].includes(el.type_name) && !dataTableChildKeys.has(el.element_key)
  );
```

- [ ] **Step 5: Verify in browser**

Navigate to a sub-app's new request page with a form that has a data_table with child elements.
Expected: See a table with column headers, add row button, can add/remove rows, validation works.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/FormRenderer.jsx
git commit -m "feat: dynamic data table renderer with add/remove rows and validation"
```

---

### Task 4: Backend — Store and Validate Table Data

**Files:**
- Modify: `server/routes/submissions.js:152-212` (POST handler)
- Modify: `server/routes/submissions.js:217-246` (GET handler)

- [ ] **Step 1: Write failing test for data_table submission**

Add a new describe block in `server/tests/submissions.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/submissions.test.js`
Expected: FAIL — the new tests fail because backend doesn't handle data_table yet.

- [ ] **Step 3: Update POST handler to validate and store data_table values**

In `server/routes/submissions.js`, update the POST handler. After the existing flat-field validation loop (line 179), add data_table handling:

```js
    // Data table validation and storage
    const dataTableElements = elements.filter(e => e.type_name === 'data_table');
    const dataTableChildIds = new Set();

    for (const table of dataTableElements) {
      // Collect child element IDs so we skip them in flat validation
      const tableChildren = elements.filter(e => e.parent_id === table.id);
      for (const child of tableChildren) dataTableChildIds.add(child.element_key);

      const tableKey = table.element_key;
      const tableState = elementState.get(tableKey);
      if (!tableState || !tableState.visible) continue;

      const rawValue = values[tableKey];
      const rows = Array.isArray(rawValue) ? rawValue : [];
      const minRows = Number(table.values.min_rows) || 0;

      if (minRows > 0 && rows.length < minRows) {
        errors[tableKey] = `At least ${minRows} row${minRows > 1 ? 's' : ''} required`;
      }

      // Per-cell validation
      for (let ri = 0; ri < rows.length; ri++) {
        for (const col of tableChildren) {
          const cellVal = rows[ri]?.[col.element_key] ?? '';
          const cellErrorKey = `${tableKey}.${ri}.${col.element_key}`;
          const colRequired = col.values?.required === 'true';

          if (colRequired && (!cellVal || cellVal === '')) {
            errors[cellErrorKey] = col.values.custom_error || `${col.values.label || col.element_key} is required`;
          }
        }
      }
    }
```

Also, update the existing flat validation loop to skip data_table children by adding a guard at the start:

```js
    for (const el of elements) {
      if (el.is_layout || contentTypes.includes(el.type_name)) continue;
      if (dataTableChildIds.has(el.element_key)) continue; // Skip table columns
      // ... rest of existing validation ...
    }
```

Important: The `dataTableChildIds` set and `dataTableElements` processing must be computed BEFORE the flat validation loop. Reorder the code so:
1. Compute `dataTableElements` and `dataTableChildIds`
2. Run flat validation (skipping table children)
3. Run data_table validation

For storing: update the value insertion loop to handle data_table elements:

```js
      for (const el of elements) {
        if (el.is_layout || contentTypes.includes(el.type_name)) continue;
        if (dataTableChildIds.has(el.element_key)) continue; // Skip table columns
        const state = elementState.get(el.element_key);
        if (!state || !state.visible) continue;
        const val = values[el.element_key];
        if (val !== undefined && val !== null && val !== '') {
          insertValue.run(submissionId, el.id, String(val));
        }
      }

      // Store data_table values as JSON arrays
      for (const table of dataTableElements) {
        const tableState = elementState.get(table.element_key);
        if (!tableState || !tableState.visible) continue;
        const rawValue = values[table.element_key];
        if (Array.isArray(rawValue) && rawValue.length > 0) {
          insertValue.run(submissionId, table.id, JSON.stringify(rawValue));
        }
      }
```

- [ ] **Step 4: Update GET handler to parse table JSON**

In `createSingleSubmissionRoutes`, the GET handler (line 230) reads `submission_values` rows. Currently it builds a flat values object. Update it to detect and parse JSON arrays:

```js
    const values = {};
    for (const v of valueRows) {
      // Try to parse JSON arrays (data_table values)
      if (v.value && v.value.startsWith('[')) {
        try {
          values[v.element_key] = JSON.parse(v.value);
          continue;
        } catch { /* not JSON, store as string */ }
      }
      values[v.element_key] = v.value;
    }
```

- [ ] **Step 5: Update loadVersionForValidation to include parent_id**

The `loadVersionForValidation` function (line 67) needs `parent_id` so we can find children of a data_table. Check it already selects `fe.parent_id` — it does (line 69). Good.

Also need to make `parent_key` available for matching. The children are found by `parent_id` (integer), not `parent_key` (string). The `elements` array has `id` and `parent_id`. We find children via: `elements.filter(e => e.parent_id === table.id)`. This works.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: All tests pass, including the 4 new data_table tests.

- [ ] **Step 7: Commit**

```bash
git add server/routes/submissions.js server/tests/submissions.test.js
git commit -m "feat: backend data_table validation (min_rows, per-cell) and JSON storage"
```

---

### Task 5: Submission Viewer — Read-Only Table

**Files:**
- Modify: `client/src/components/SubmissionViewer.jsx`

- [ ] **Step 1: Update SubmissionViewer to render table data**

Currently the viewer (line 29-37) renders all values as flat key-value pairs, using `JSON.stringify` for objects. Update it to detect arrays and render them as tables:

```jsx
export default function SubmissionViewer({ submission }) {
  if (!submission) return null;

  const values = submission.values || {};
  const entries = Object.entries(values);

  const renderValue = (key, value) => {
    // Data table: array of row objects
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      const columns = Object.keys(value[0]);
      return (
        <div key={key} className="mb-4">
          <div className="text-xs font-medium text-gray-500 mb-1">{key}</div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {columns.map(col => (
                    <th key={col} className="border border-gray-200 px-3 py-1.5 text-left text-xs font-semibold text-gray-600">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td key={col} className="border border-gray-200 px-3 py-1.5 text-sm text-gray-800">
                        {String(row[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Flat value (existing behavior)
    return (
      <div key={key}>
        <div className="text-xs font-medium text-gray-500">{key}</div>
        <div className="text-sm text-gray-800 mt-0.5">
          {typeof value === 'object' ? JSON.stringify(value) : String(value) || '—'}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600">Submission #{submission.id}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
          submission.status === 'approved' ? 'bg-green-100 text-green-700' :
          submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {submission.status}
        </span>
      </div>

      <div className="text-xs text-gray-400 mb-4">
        By: {submission.user_id} | {new Date(submission.created_at).toLocaleString()}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No values submitted</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => renderValue(key, value))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Submit a form with table data, then view it in the admin submissions viewer.
Expected: Table data renders as a read-only HTML table with column headers and row data.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SubmissionViewer.jsx
git commit -m "feat: submission viewer renders data_table values as read-only tables"
```

---

### Task 6: Update Design Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-04-16-form-builder-redesign-design.md:289-293`
- Modify: `docs/superpowers/specs/2026-04-17-data-table-design.md`

- [ ] **Step 1: Update original design doc — data_table entry**

In `2026-04-16-form-builder-redesign-design.md`, find the Layout table row for `data_table` (line 293):

```
| data_table | Data Table | Yes | label*, columns*, rows, css_class. Columns defines the number of columns; column headings are stored as `form_element_options` (label = heading text, value = column key, display_order = column position). Input elements nested as children populate the rows. Each row is a set of values per column. |
```

Replace with:

```
| data_table | Data Table | Yes | label*, min_rows, css_class. Child elements define table columns. Users add/remove rows at fill-time. Submission data stored as JSON array in `submission_values`. See `2026-04-17-data-table-design.md` for full spec. |
```

- [ ] **Step 2: Update original design doc — property definitions seed list**

In the same file, line 86, the property definitions list includes `rows, columns` but not `min_rows`. Update to reflect:

Find: `default_value, required, min_length, max_length, min_value, max_value, pattern, custom_error, hidden, disabled, css_class, multiple, rows, columns`

Replace with: `default_value, required, min_length, max_length, min_value, max_value, pattern, custom_error, hidden, disabled, css_class, multiple, rows, columns, min_rows`

- [ ] **Step 3: Update original design doc — note bug fixes**

Add a "Change Log" section at the end of `2026-04-16-form-builder-redesign-design.md`:

```markdown

## Change Log

### 2026-04-17
- **Bug fix**: `POST /api/forms` was not saving elements — extracted `saveVersionElements` helper, used by both POST and PUT handlers.
- **Bug fix**: `loadVersionElements` API response included `parent_id` (integer FK) but not `parent_key` (string element key). Added `parent_key` resolution so both the form builder and renderer can filter by parent correctly.
- **Design update**: `data_table` element redesigned — see `2026-04-17-data-table-design.md`. Replaced unused `columns`/`rows` properties with `min_rows`. Child elements now define columns; submission data stored as JSON array.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-16-form-builder-redesign-design.md docs/superpowers/specs/2026-04-17-data-table-design.md
git commit -m "docs: update design specs with data_table redesign and bug fix changelog"
```
