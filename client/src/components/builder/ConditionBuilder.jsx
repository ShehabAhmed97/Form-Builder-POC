import { useQuery } from '@tanstack/react-query';
import { getConditionActions, getConditionOperators } from '../../api/registry';

export default function ConditionBuilder({ element, elements, onChange }) {
  const { data: actions = [] } = useQuery({
    queryKey: ['registry', 'condition-actions'],
    queryFn: getConditionActions,
    staleTime: Infinity,
  });

  const { data: operators = [] } = useQuery({
    queryKey: ['registry', 'condition-operators'],
    queryFn: getConditionOperators,
    staleTime: Infinity,
  });

  const conditions = element.conditions || [];

  const sourceFields = elements.filter(
    e => e.element_key !== element.element_key
      && !e.is_layout
      && !['heading', 'subheading', 'text'].includes(e.type_name)
  );

  const addCondition = () => {
    onChange([
      ...conditions,
      {
        action_type_id: actions[0]?.id,
        action_name: actions[0]?.name,
        action_value: null,
        logic_operator: 'AND',
        rules: [],
      },
    ]);
  };

  const removeCondition = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index, field, value) => {
    onChange(conditions.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, [field]: value };
      if (field === 'action_type_id') {
        const action = actions.find(a => a.id === Number(value));
        updated.action_name = action?.name;
        updated.action_type_id = Number(value);
      }
      return updated;
    }));
  };

  const addRule = (condIndex) => {
    onChange(conditions.map((c, i) => {
      if (i !== condIndex) return c;
      return {
        ...c,
        rules: [
          ...c.rules,
          {
            source_key: sourceFields[0]?.element_key || '',
            operator_id: operators[0]?.id,
            operator_name: operators[0]?.name,
            value: '',
          },
        ],
      };
    }));
  };

  const removeRule = (condIndex, ruleIndex) => {
    onChange(conditions.map((c, i) => {
      if (i !== condIndex) return c;
      return { ...c, rules: c.rules.filter((_, ri) => ri !== ruleIndex) };
    }));
  };

  const updateRule = (condIndex, ruleIndex, field, value) => {
    onChange(conditions.map((c, i) => {
      if (i !== condIndex) return c;
      return {
        ...c,
        rules: c.rules.map((r, ri) => {
          if (ri !== ruleIndex) return r;
          const updated = { ...r, [field]: value };
          if (field === 'operator_id') {
            const op = operators.find(o => o.id === Number(value));
            updated.operator_name = op?.name;
            updated.operator_id = Number(value);
          }
          return updated;
        }),
      };
    }));
  };

  const getCircularWarning = (condIndex) => {
    const cond = conditions[condIndex];
    if (!cond?.rules) return null;
    for (const rule of cond.rules) {
      const sourceEl = elements.find(e => e.element_key === rule.source_key);
      if (sourceEl?.conditions?.some(c =>
        c.rules?.some(r => r.source_key === element.element_key)
      )) {
        return `Circular dependency: "${rule.source_key}" also depends on "${element.element_key}"`;
      }
    }
    return null;
  };

  if (sourceFields.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        Add more fields to create conditions
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {conditions.map((cond, ci) => {
        const circularWarning = getCircularWarning(ci);
        return (
          <div key={ci} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <select
                value={cond.action_type_id || ''}
                onChange={(e) => updateCondition(ci, 'action_type_id', e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:border-blue-500 outline-none"
              >
                {actions.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>

              {cond.action_name === 'set_value' && (
                <input
                  type="text"
                  value={cond.action_value || ''}
                  onChange={(e) => updateCondition(ci, 'action_value', e.target.value)}
                  placeholder="Value"
                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                />
              )}

              <button
                onClick={() => removeCondition(ci)}
                className="text-gray-400 hover:text-red-500 p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {circularWarning && (
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-2">
                {circularWarning}
              </div>
            )}

            {cond.rules.length > 1 && (
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[10px] text-gray-400">When</span>
                <select
                  value={cond.logic_operator}
                  onChange={(e) => updateCondition(ci, 'logic_operator', e.target.value)}
                  className="px-1.5 py-0.5 text-[10px] border border-gray-300 rounded"
                >
                  <option value="AND">ALL</option>
                  <option value="OR">ANY</option>
                </select>
                <span className="text-[10px] text-gray-400">of these are true:</span>
              </div>
            )}

            <div className="space-y-1.5">
              {cond.rules.map((rule, ri) => (
                <div key={ri} className="flex items-center gap-1">
                  <select
                    value={rule.source_key || ''}
                    onChange={(e) => updateRule(ci, ri, 'source_key', e.target.value)}
                    className="flex-1 px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:border-blue-500 outline-none"
                  >
                    <option value="">Select field...</option>
                    {sourceFields.map(f => (
                      <option key={f.element_key} value={f.element_key}>
                        {f.values.label || f.element_key}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rule.operator_id || ''}
                    onChange={(e) => updateRule(ci, ri, 'operator_id', e.target.value)}
                    className="px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:border-blue-500 outline-none"
                  >
                    {operators.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  {!['is_empty', 'is_not_empty'].includes(rule.operator_name) && (
                    <input
                      type="text"
                      value={rule.value || ''}
                      onChange={(e) => updateRule(ci, ri, 'value', e.target.value)}
                      placeholder="value"
                      className="w-16 px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:border-blue-500 outline-none"
                    />
                  )}
                  <button
                    onClick={() => removeRule(ci, ri)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => addRule(ci)}
              className="text-[10px] text-blue-600 hover:text-blue-800 mt-1.5"
            >
              + Add rule
            </button>
          </div>
        );
      })}

      <button
        onClick={addCondition}
        className="text-xs text-blue-600 hover:text-blue-800"
      >
        + Add condition
      </button>
    </div>
  );
}
