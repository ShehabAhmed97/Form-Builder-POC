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
