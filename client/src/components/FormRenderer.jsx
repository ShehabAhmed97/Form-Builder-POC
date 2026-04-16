import { useState } from 'react';

function getInitialValues(components) {
  const values = {};
  for (const comp of components) {
    if (comp.type === 'checkbox') {
      values[comp.key] = false;
    } else if (comp.type === 'file') {
      values[comp.key] = [];
    } else {
      values[comp.key] = '';
    }
  }
  return values;
}

function FieldWrapper({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
    </div>
  );
}

const inputBase = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors';

function renderField(comp, value, onChange, error) {
  const required = comp.validate?.required;
  const label = comp.label || comp.key;
  const placeholder = comp.placeholder || '';

  switch (comp.type) {
    case 'textfield':
    case 'email':
    case 'phoneNumber':
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <input
            type={comp.type === 'email' ? 'email' : comp.type === 'phoneNumber' ? 'tel' : 'text'}
            value={value}
            onChange={(e) => onChange(comp.key, e.target.value)}
            placeholder={placeholder}
            className={inputBase}
          />
        </FieldWrapper>
      );

    case 'textarea':
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <textarea
            value={value}
            onChange={(e) => onChange(comp.key, e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={inputBase + ' resize-y'}
          />
        </FieldWrapper>
      );

    case 'number':
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(comp.key, e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={placeholder}
            className={inputBase}
          />
        </FieldWrapper>
      );

    case 'datetime':
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(comp.key, e.target.value)}
            className={inputBase}
          />
        </FieldWrapper>
      );

    case 'select': {
      const options = comp.data?.values || [];
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <select
            value={value}
            onChange={(e) => onChange(comp.key, e.target.value)}
            className={inputBase + ' bg-white'}
          >
            <option value="">{placeholder || 'Select an option...'}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </FieldWrapper>
      );
    }

    case 'radio': {
      const options = comp.values || [];
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <div className="space-y-2 mt-1">
            {options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name={comp.key}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => onChange(comp.key, e.target.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
              </label>
            ))}
          </div>
        </FieldWrapper>
      );
    }

    case 'checkbox':
      return (
        <div className="flex items-start gap-3 py-1">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(comp.key, e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
            {required && <span className="text-red-500 ml-1">*</span>}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>
      );

    case 'file':
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
              <span>Choose file</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    onChange(comp.key, [{
                      name: file.name,
                      originalName: file.name,
                      size: file.size,
                      type: file.type,
                      url: reader.result,
                      storage: 'base64',
                    }]);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {Array.isArray(value) && value.length > 0 && (
              <span className="text-sm text-gray-600">{value[0].originalName || value[0].name}</span>
            )}
          </div>
        </FieldWrapper>
      );

    default:
      return (
        <FieldWrapper label={label} required={required} error={error}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(comp.key, e.target.value)}
            placeholder={placeholder}
            className={inputBase}
          />
        </FieldWrapper>
      );
  }
}

export function RelationalFormRenderer({ elements, onSubmit }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  const getChildren = (parentKey) =>
    elements
      .filter(e => e.parent_key === (parentKey || null))
      .sort((a, b) => a.position - b.position);

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

  // Condition evaluation engine
  const evalRule = (rule, vals) => {
    const fieldValue = vals[rule.source_key] ?? '';
    switch (rule.operator_name) {
      case 'equals': return String(fieldValue) === String(rule.value);
      case 'not_equals': return String(fieldValue) !== String(rule.value);
      case 'contains': return String(fieldValue).includes(String(rule.value));
      case 'not_contains': return !String(fieldValue).includes(String(rule.value));
      case 'greater_than': return Number(fieldValue) > Number(rule.value);
      case 'less_than': return Number(fieldValue) < Number(rule.value);
      case 'is_empty': return !fieldValue || fieldValue === '';
      case 'is_not_empty': return fieldValue && fieldValue !== '';
      default: return false;
    }
  };

  const evalCondition = (cond, vals) => {
    if (!cond.rules || cond.rules.length === 0) return false;
    if (cond.logic_operator === 'OR') return cond.rules.some(r => evalRule(r, vals));
    return cond.rules.every(r => evalRule(r, vals));
  };

  // Compute element states based on conditions and current values
  const elementStates = new Map();
  for (const el of elements) {
    elementStates.set(el.element_key, {
      visible: true,
      required: el.values?.required === 'true',
      disabled: el.values?.disabled === 'true',
    });
  }
  // Elements with "show" conditions start hidden
  for (const el of elements) {
    if (el.conditions?.some(c => c.action_name === 'show')) {
      elementStates.get(el.element_key).visible = false;
    }
  }
  // Evaluate conditions
  for (const el of elements) {
    if (!el.conditions) continue;
    for (const cond of el.conditions) {
      const result = evalCondition(cond, values);
      const s = elementStates.get(el.element_key);
      if (result) {
        switch (cond.action_name) {
          case 'show': s.visible = true; break;
          case 'hide': s.visible = false; break;
          case 'require': s.required = true; break;
          case 'unrequire': s.required = false; break;
          case 'set_value':
            if (values[el.element_key] !== cond.action_value) {
              // Use a ref or schedule to avoid infinite re-renders
              // For now, just note it - set_value is applied on next change
            }
            break;
          case 'disable': s.disabled = true; break;
          case 'enable': s.disabled = false; break;
        }
      }
    }
  }

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const newErrors = {};
    for (const el of inputElements) {
      const state = elementStates.get(el.element_key);
      if (!state?.visible) continue; // Skip hidden fields
      const val = values[el.element_key];
      if (state.required && (!val || val === '' || (Array.isArray(val) && val.length === 0))) {
        newErrors[el.element_key] = el.values.custom_error || `${el.values.label || el.element_key} is required`;
      }
      if (el.values.min_length && val && String(val).length < Number(el.values.min_length)) {
        newErrors[el.element_key] = el.values.custom_error || `Minimum ${el.values.min_length} characters`;
      }
      if (el.values.max_length && val && String(val).length > Number(el.values.max_length)) {
        newErrors[el.element_key] = el.values.custom_error || `Maximum ${el.values.max_length} characters`;
      }
      if (el.values.pattern && val) {
        try {
          if (!new RegExp(el.values.pattern).test(String(val))) {
            newErrors[el.element_key] = el.values.custom_error || 'Invalid format';
          }
        } catch { /* invalid regex */ }
      }
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(values);
  };

  const renderField = (el) => {
    const state = elementStates.get(el.element_key);
    if (!state?.visible) return null;
    const value = values[el.element_key] ?? '';
    const error = errors[el.element_key];
    const label = el.values.label || el.element_key;
    const placeholder = el.values.placeholder || '';
    const required = state.required;
    const disabled = state.disabled;

    const inputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
      error ? 'border-red-500' : 'border-gray-300'
    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`;

    let input;
    switch (el.type_name) {
      case 'textarea':
        input = <textarea value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} rows={Number(el.values.rows) || 3} disabled={disabled} className={inputClass} />;
        break;
      case 'number':
        input = <input type="number" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} min={el.values.min_value} max={el.values.max_value} disabled={disabled} className={inputClass} />;
        break;
      case 'email':
        input = <input type="email" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} disabled={disabled} className={inputClass} />;
        break;
      case 'phone':
        input = <input type="tel" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} disabled={disabled} className={inputClass} />;
        break;
      case 'date':
        input = <input type="date" value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass} />;
        break;
      case 'time':
        input = <input type="time" value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass} />;
        break;
      case 'datetime':
        input = <input type="datetime-local" value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass} />;
        break;
      case 'select':
        input = (
          <select value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass}>
            <option value="">{placeholder || 'Select...'}</option>
            {(el.options || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
        break;
      case 'radio':
        input = (
          <div className="space-y-2">
            {(el.options || []).map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={el.element_key} value={opt.value} checked={value === opt.value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className="text-blue-600" />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        );
        break;
      case 'checkbox':
        input = (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={value === 'true'} onChange={e => handleChange(el.element_key, e.target.checked ? 'true' : 'false')} disabled={disabled} className="rounded text-blue-600" />
            <span className="text-sm">{label}</span>
          </label>
        );
        break;
      case 'checkbox_group':
        input = (
          <div className="space-y-2">
            {(el.options || []).map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(Array.isArray(value) ? value : []).includes(opt.value)} onChange={e => {
                  const current = Array.isArray(value) ? value : [];
                  const next = e.target.checked ? [...current, opt.value] : current.filter(v => v !== opt.value);
                  handleChange(el.element_key, next);
                }} disabled={disabled} className="rounded text-blue-600" />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        );
        break;
      case 'toggle':
        input = (
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={value === 'true'} onChange={e => handleChange(el.element_key, e.target.checked ? 'true' : 'false')} disabled={disabled} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        );
        break;
      case 'file_upload':
        input = <input type="file" onChange={e => handleChange(el.element_key, e.target.files?.[0]?.name || '')} multiple={el.values.multiple === 'true'} disabled={disabled} className="text-sm" />;
        break;
      default:
        input = <input type="text" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} disabled={disabled} className={inputClass} />;
    }

    // Checkbox and toggle render label inline, not above
    if (el.type_name === 'checkbox' || el.type_name === 'toggle') {
      return (
        <div key={el.element_key} className="mb-4">
          {input}
          {el.values.description && <p className="text-xs text-gray-500 mt-1">{el.values.description}</p>}
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    return (
      <div key={el.element_key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {el.values.description && <p className="text-xs text-gray-500 mb-1">{el.values.description}</p>}
        {input}
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  };

  // Recursive element tree renderer
  const renderElementTree = (parentKey) => {
    const children = getChildren(parentKey);

    return children.map(el => {
      // Check visibility from conditions
      const state = elementStates.get(el.element_key);
      if (state && !state.visible) return null;

      // Skip children of data_table — they're rendered as columns inside the table
      if (dataTableChildKeys.has(el.element_key)) return null;

      // Content elements
      if (el.type_name === 'heading') return <h2 key={el.element_key} className="text-xl font-bold mt-4 mb-2">{el.values.label}</h2>;
      if (el.type_name === 'subheading') return <h3 key={el.element_key} className="text-lg font-semibold mt-3 mb-1">{el.values.label}</h3>;
      if (el.type_name === 'text') return <p key={el.element_key} className="text-sm text-gray-600 mb-3">{el.values.description}</p>;

      // Layout: Row
      if (el.type_name === 'row') {
        const cols = Number(el.values.columns) || 2;
        return (
          <div key={el.element_key} className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {renderElementTree(el.element_key)}
          </div>
        );
      }

      // Layout: Section
      if (el.type_name === 'section') {
        return (
          <fieldset key={el.element_key} className="border border-gray-200 rounded-lg p-4 mb-4">
            {el.values.label && <legend className="text-sm font-semibold px-2">{el.values.label}</legend>}
            {el.values.description && <p className="text-xs text-gray-500 mb-3">{el.values.description}</p>}
            {renderElementTree(el.element_key)}
          </fieldset>
        );
      }

      // Layout: Data Table (dynamic rows)
      if (el.type_name === 'data_table') {
        const tableKey = el.element_key;
        const columns = getChildren(tableKey);
        const rows = Array.isArray(values[tableKey]) ? values[tableKey] : [];
        const minRows = Number(el.values.min_rows) || 0;
        const tableError = errors[tableKey];

        // Pre-populate minimum rows on first render
        if (minRows > 0 && rows.length === 0) {
          const initialRows = Array.from({ length: minRows }, () =>
            Object.fromEntries(columns.map(col => [col.element_key, '']))
          );
          setTimeout(() => handleChange(tableKey, initialRows), 0);
        }

        const addRow = () => {
          const newRow = Object.fromEntries(columns.map(col => [col.element_key, '']));
          handleChange(tableKey, [...rows, newRow]);
        };

        const removeRow = (rowIdx) => {
          handleChange(tableKey, rows.filter((_, i) => i !== rowIdx));
        };

        const updateCell = (rowIdx, colKey, cellValue) => {
          const updated = rows.map((row, i) =>
            i === rowIdx ? { ...row, [colKey]: cellValue } : row
          );
          handleChange(tableKey, updated);
          const cellErrorKey = `${tableKey}.${rowIdx}.${colKey}`;
          if (errors[cellErrorKey]) {
            setErrors(prev => ({ ...prev, [cellErrorKey]: null }));
          }
        };

        const renderCellInput = (col, rowIdx) => {
          const colKey = col.element_key;
          const cellValue = rows[rowIdx]?.[colKey] ?? '';
          const cellClass = 'w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none';

          switch (col.type_name) {
            case 'textarea':
              return <textarea value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} rows={2} className={cellClass} />;
            case 'number':
              return <input type="number" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
            case 'email':
              return <input type="email" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
            case 'phone':
              return <input type="tel" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
            case 'date':
              return <input type="date" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
            case 'time':
              return <input type="time" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
            case 'datetime':
              return <input type="datetime-local" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
            case 'select':
              return (
                <select value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass + ' bg-white'}>
                  <option value="">Select...</option>
                  {(col.options || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              );
            case 'checkbox':
            case 'toggle':
              return <input type="checkbox" checked={cellValue === 'true' || cellValue === true} onChange={e => updateCell(rowIdx, colKey, e.target.checked ? 'true' : 'false')} className="rounded text-blue-600" />;
            default:
              return <input type="text" value={cellValue} onChange={e => updateCell(rowIdx, colKey, e.target.value)} className={cellClass} />;
          }
        };

        return (
          <div key={tableKey} className="mb-4">
            {el.values.label && <label className="block text-sm font-medium text-gray-700 mb-1">{el.values.label}</label>}
            {tableError && <p className="text-sm text-red-500 mb-1">{tableError}</p>}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {columns.map(col => (
                      <th key={col.element_key} className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wide">
                        {col.values.label || col.element_key}
                        {col.values.required === 'true' && <span className="text-red-500 ml-0.5">*</span>}
                      </th>
                    ))}
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-gray-400 text-sm">
                        No rows added yet
                      </td>
                    </tr>
                  ) : (
                    rows.map((_, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        {columns.map(col => {
                          const cellErrorKey = `${tableKey}.${rowIdx}.${col.element_key}`;
                          const cellError = errors[cellErrorKey];
                          return (
                            <td key={col.element_key} className="px-2 py-1.5 align-top">
                              {renderCellInput(col, rowIdx)}
                              {cellError && <p className="text-xs text-red-500 mt-0.5">{cellError}</p>}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 align-top">
                          {rows.length > minRows && (
                            <button
                              type="button"
                              onClick={() => removeRow(rowIdx)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                              title="Remove row"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Row
            </button>
          </div>
        );
      }

      // Input elements
      return renderField(el);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {renderElementTree(null)}
      <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 mt-4">
        Submit
      </button>
    </form>
  );
}

export default function FormRenderer({ schema, onSubmit }) {
  const components = schema?.components || [];
  const [values, setValues] = useState(() => getInitialValues(components));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    for (const comp of components) {
      if (comp.validate?.required) {
        const val = values[comp.key];
        if (val === '' || val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
          newErrors[comp.key] = `${comp.label || comp.key} is required`;
        }
      }
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {components.map((comp) => (
        <div key={comp.key}>
          {renderField(comp, values[comp.key], handleChange, errors[comp.key])}
        </div>
      ))}

      <div className="pt-4 border-t border-gray-100">
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-sm transition-colors"
        >
          Submit
        </button>
      </div>
    </form>
  );
}
