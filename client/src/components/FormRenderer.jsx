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

  const inputElements = elements.filter(
    el => !el.is_layout && !['heading', 'subheading', 'text'].includes(el.type_name)
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

      // Layout: Data Table (basic rendering)
      if (el.type_name === 'data_table') {
        return (
          <div key={el.element_key} className="mb-4">
            {el.values.label && <label className="block text-sm font-medium text-gray-700 mb-1">{el.values.label}</label>}
            <div className="border rounded-lg overflow-hidden">
              {renderElementTree(el.element_key)}
            </div>
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
