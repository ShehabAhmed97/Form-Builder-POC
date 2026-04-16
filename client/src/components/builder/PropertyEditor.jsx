import { useQuery } from '@tanstack/react-query';
import { getElementTypeProperties } from '../../api/registry';

export default function PropertyEditor({
  element,
  onUpdateValue,
  onUpdateKey,
  onUpdateOptions,
}) {
  const { data: propertyGroups = [], isLoading } = useQuery({
    queryKey: ['registry', 'element-type-properties', element?.element_type_id],
    queryFn: () => getElementTypeProperties(element.element_type_id),
    enabled: !!element,
    staleTime: Infinity,
  });

  if (!element) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-gray-400 text-sm text-center">
        Select an element on the canvas to edit its properties
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-gray-400 text-sm">Loading properties...</div>;
  }

  const hasOptions = ['select', 'radio', 'checkbox_group'].includes(element.type_name);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
          {element.type_name}
        </div>
        <div className="text-sm font-semibold text-gray-800">
          {element.values.label || element.element_key}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Field Key
        </label>
        <input
          type="text"
          value={element.element_key}
          onChange={(e) => onUpdateKey(element.element_key, e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
        />
      </div>

      {propertyGroups.map(group => (
        <div key={group.id} className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {group.label}
          </h4>
          <div className="space-y-2.5">
            {group.properties.map(prop => (
              <PropertyInput
                key={prop.id}
                property={prop}
                value={element.values[prop.name] ?? prop.default_value ?? ''}
                onChange={(val) => onUpdateValue(element.element_key, prop.name, val)}
              />
            ))}
          </div>
        </div>
      ))}

      {hasOptions && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Options
          </h4>
          <OptionsEditor
            options={element.options || []}
            onChange={(opts) => onUpdateOptions(element.element_key, opts)}
          />
        </div>
      )}
    </div>
  );
}

function PropertyInput({ property, value, onChange }) {
  const { label, input_type, is_required } = property;

  if (input_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">{label}</span>
        {is_required === 1 && <span className="text-red-400 text-xs">*</span>}
      </label>
    );
  }

  if (input_type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {label} {is_required === 1 && <span className="text-red-400">*</span>}
        </label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {is_required === 1 && <span className="text-red-400">*</span>}
      </label>
      <input
        type={input_type === 'number' ? 'number' : 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
      />
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const addOption = () => {
    const next = [...options, { label: '', value: '', display_order: options.length }];
    onChange(next);
  };

  const removeOption = (index) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (index, field, val) => {
    const next = options.map((opt, i) => {
      if (i !== index) return opt;
      const updated = { ...opt, [field]: val };
      if (field === 'label' && (!opt.value || opt.value === opt.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))) {
        updated.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      return updated;
    });
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={opt.label}
            onChange={(e) => updateOption(i, 'label', e.target.value)}
            placeholder="Label"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
          <input
            type="text"
            value={opt.value}
            onChange={(e) => updateOption(i, 'value', e.target.value)}
            placeholder="Value"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none font-mono"
          />
          <button
            onClick={() => removeOption(i)}
            className="text-gray-400 hover:text-red-500 p-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        + Add option
      </button>
    </div>
  );
}
