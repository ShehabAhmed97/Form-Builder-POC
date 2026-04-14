import { useState } from 'react';

const FIELD_TYPES = [
  { type: 'textfield', label: 'Text Field', icon: 'Aa' },
  { type: 'textarea', label: 'Text Area', icon: '\u00b6' },
  { type: 'number', label: 'Number', icon: '#' },
  { type: 'email', label: 'Email', icon: '@' },
  { type: 'phoneNumber', label: 'Phone', icon: '\u260e' },
  { type: 'datetime', label: 'Date/Time', icon: '\u29d6' },
  { type: 'select', label: 'Dropdown', icon: '\u25bc' },
  { type: 'radio', label: 'Radio', icon: '\u25cb' },
  { type: 'checkbox', label: 'Checkbox', icon: '\u2610' },
  { type: 'file', label: 'File Upload', icon: '\u2191' },
];

function generateKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'field';
}

function fieldToFormioComponent(field) {
  const comp = {
    type: field.type,
    key: field.key,
    label: field.label,
    input: true,
  };

  if (field.placeholder) comp.placeholder = field.placeholder;
  if (field.required) comp.validate = { required: true };

  if (field.type === 'select') {
    comp.data = { values: field.values || [] };
    comp.widget = 'choicesjs';
  }
  if (field.type === 'radio') {
    comp.values = field.values || [];
  }
  if (field.type === 'file') {
    comp.storage = 'base64';
  }

  return comp;
}

function formioComponentToField(comp, index) {
  return {
    id: `field_${index}_${Date.now()}`,
    type: comp.type,
    label: comp.label || '',
    key: comp.key || '',
    placeholder: comp.placeholder || '',
    required: comp.validate?.required || false,
    values: comp.data?.values || comp.values || [],
  };
}

export default function SimpleBuilder({ schema, onChange }) {
  const [fields, setFields] = useState(() =>
    (schema?.components || []).map((comp, i) => formioComponentToField(comp, i))
  );

  const updateSchema = (updatedFields) => {
    setFields(updatedFields);
    onChange({
      display: 'form',
      components: updatedFields.map(fieldToFormioComponent),
    });
  };

  const addField = (type) => {
    const typeDef = FIELD_TYPES.find(t => t.type === type);
    const label = typeDef?.label || type;
    const newField = {
      id: `field_${Date.now()}`,
      type,
      label,
      key: generateKey(label),
      placeholder: '',
      required: false,
      values: (type === 'select' || type === 'radio')
        ? [{ label: 'Option 1', value: 'option1' }]
        : [],
    };
    updateSchema([...fields, newField]);
  };

  const updateField = (id, updates) => {
    updateSchema(fields.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id) => {
    updateSchema(fields.filter(f => f.id !== id));
  };

  const moveField = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    updateSchema(newFields);
  };

  const hasValues = (type) => type === 'select' || type === 'radio';

  return (
    <div className="flex gap-6">
      <div className="w-48 shrink-0">
        <div className="bg-white rounded-lg shadow p-4 sticky top-6">
          <h3 className="font-medium mb-3 text-sm text-gray-700">Add Field</h3>
          <div className="flex flex-col gap-1.5">
            {FIELD_TYPES.map(ft => (
              <button
                key={ft.type}
                onClick={() => addField(ft.type)}
                className="flex items-center gap-2 text-left text-sm px-3 py-2 bg-gray-50 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <span className="w-5 text-center text-gray-400 font-mono text-xs">{ft.icon}</span>
                {ft.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {fields.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
            Click a field type on the left to add it to your form.
          </div>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {FIELD_TYPES.find(t => t.type === field.type)?.label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1.5 py-0.5 text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1.5 py-0.5 text-sm"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeField(field.id)}
                  className="text-red-400 hover:text-red-600 px-1.5 py-0.5 ml-2 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.id, {
                      label: e.target.value,
                      key: generateKey(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Key</label>
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateField(field.id, { key: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                />
              </div>
              {field.type !== 'checkbox' && field.type !== 'file' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              )}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>
              </div>
            </div>

            {hasValues(field.type) && (
              <div className="mt-3 pt-3 border-t">
                <label className="block text-xs text-gray-500 mb-2">Options</label>
                {field.values.map((v, vi) => (
                  <div key={vi} className="flex gap-2 mb-1.5">
                    <input
                      type="text"
                      value={v.label}
                      placeholder="Label"
                      onChange={(e) => {
                        const newValues = [...field.values];
                        newValues[vi] = {
                          label: e.target.value,
                          value: generateKey(e.target.value),
                        };
                        updateField(field.id, { values: newValues });
                      }}
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() =>
                        updateField(field.id, {
                          values: field.values.filter((_, i) => i !== vi),
                        })
                      }
                      className="text-red-400 hover:text-red-600 px-2 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateField(field.id, {
                      values: [...field.values, { label: '', value: '' }],
                    })
                  }
                  className="text-sm text-blue-600 hover:underline mt-1"
                >
                  + Add option
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
