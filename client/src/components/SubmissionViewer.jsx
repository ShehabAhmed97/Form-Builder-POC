const TYPE_LABELS = {
  textfield: 'Text',
  textarea: 'Text',
  number: 'Number',
  email: 'Email',
  phoneNumber: 'Phone',
  datetime: 'Date/Time',
  select: 'Selection',
  radio: 'Selection',
  checkbox: 'Checkbox',
  file: 'File',
};

function formatValue(component, value) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-gray-300 italic">Not provided</span>;
  }

  switch (component.type) {
    case 'checkbox':
      return (
        <span className={`inline-flex items-center gap-1.5 ${value ? 'text-green-700' : 'text-gray-500'}`}>
          <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${value ? 'bg-green-100 border-green-300' : 'border-gray-300'}`}>
            {value ? '✓' : ''}
          </span>
          {value ? 'Yes' : 'No'}
        </span>
      );

    case 'select': {
      const options = component.data?.values || [];
      const match = options.find(o => o.value === value);
      return match?.label || String(value);
    }

    case 'radio': {
      const options = component.values || [];
      const match = options.find(o => o.value === value);
      return match?.label || String(value);
    }

    case 'file':
      if (Array.isArray(value) && value.length > 0) {
        return (
          <div className="space-y-1">
            {value.map((file, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">📎</span>
                <span>{file.originalName || file.name || `File ${i + 1}`}</span>
                <span className="text-xs text-gray-400">
                  {file.size ? `(${(file.size / 1024).toFixed(1)} KB)` : ''}
                </span>
              </div>
            ))}
          </div>
        );
      }
      return <span className="text-gray-300 italic">No file</span>;

    case 'datetime':
      try {
        return new Date(value).toLocaleString();
      } catch {
        return String(value);
      }

    case 'textarea':
      return <span className="whitespace-pre-wrap">{String(value)}</span>;

    default:
      return String(value);
  }
}

export default function SubmissionViewer({ schema, data }) {
  const components = schema?.components || [];

  if (components.length === 0) {
    return <p className="text-gray-400 text-sm">No form fields in this schema.</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {components.map((comp) => {
        const value = data?.[comp.key];
        const isRequired = comp.validate?.required;

        return (
          <div key={comp.key} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {comp.label || comp.key}
                {isRequired && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <span className="text-[10px] text-gray-300 font-mono">
                {TYPE_LABELS[comp.type] || comp.type}
              </span>
            </div>
            <div className="text-sm text-gray-900">
              {formatValue(comp, value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
