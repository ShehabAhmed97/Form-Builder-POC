import { useState } from 'react';

export default function FormCanvas({
  elements,
  selectedKey,
  onSelect,
  onDrop,
  onMove,
  onRemove,
}) {
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const rootElements = elements
    .filter(e => !e.parent_key)
    .sort((a, b) => a.position - b.position);

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/json') ? 'copy' : 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    setDragOverIndex(null);

    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const type = JSON.parse(json);
        onDrop(type, index);
        return;
      } catch { /* not a palette drag */ }
    }

    const key = e.dataTransfer.getData('text/plain');
    if (key) {
      onMove(key, index);
    }
  };

  const handleElementDragStart = (e, element) => {
    e.dataTransfer.setData('text/plain', element.element_key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setDragOverIndex(null);
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const type = JSON.parse(json);
        onDrop(type);
        return;
      } catch { /* ignore */ }
    }
  };

  return (
    <div
      className="h-full overflow-y-auto p-6 bg-gray-50"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleCanvasDrop}
    >
      {rootElements.length === 0 ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-400 text-sm">
            Drag elements here or click them in the palette
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {rootElements.map((element, index) => (
            <div key={element.element_key}>
              <div
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`h-1 transition-all rounded ${
                  dragOverIndex === index ? 'h-8 bg-blue-100 border-2 border-dashed border-blue-400' : ''
                }`}
              />

              <div
                draggable
                onDragStart={(e) => handleElementDragStart(e, element)}
                onClick={() => onSelect(element.element_key)}
                className={`group relative p-3 bg-white rounded-lg border-2 cursor-pointer transition-all ${
                  selectedKey === element.element_key
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{element.type_name}</span>
                      {element.values.required === 'true' && (
                        <span className="text-red-400 text-xs">*</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {element.values.label || element.element_key}
                    </div>
                    {element.values.placeholder && (
                      <div className="text-xs text-gray-400 truncate">
                        {element.values.placeholder}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(element.element_key); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                    title="Remove element"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div
            onDragOver={(e) => handleDragOver(e, rootElements.length)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, rootElements.length)}
            className={`h-1 transition-all rounded ${
              dragOverIndex === rootElements.length ? 'h-8 bg-blue-100 border-2 border-dashed border-blue-400' : ''
            }`}
          />
        </div>
      )}
    </div>
  );
}
