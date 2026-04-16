import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getElementTypes } from '../../api/registry';

export default function ElementPalette({ onAddElement }) {
  const [collapsed, setCollapsed] = useState({});

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['registry', 'element-types'],
    queryFn: getElementTypes,
    staleTime: Infinity,
  });

  const toggleCategory = (name) => {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('application/json', JSON.stringify(type));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (isLoading) {
    return <div className="p-4 text-gray-400 text-sm">Loading elements...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Elements
      </h3>
      {categories.map(cat => (
        <div key={cat.name} className="mb-3">
          <button
            onClick={() => toggleCategory(cat.name)}
            className="flex items-center justify-between w-full text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-1 hover:text-gray-700"
          >
            {cat.label}
            <span className="text-gray-400">{collapsed[cat.name] ? '+' : '-'}</span>
          </button>
          {!collapsed[cat.name] && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {cat.types.map(type => (
                <div
                  key={type.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, type)}
                  onClick={() => onAddElement(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-md text-xs cursor-grab active:cursor-grabbing select-none transition-colors"
                  title={type.label}
                >
                  <span className="text-gray-400 text-[10px]">{type.is_layout ? '[ ]' : 'Aa'}</span>
                  {type.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
