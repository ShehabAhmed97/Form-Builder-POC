import { useState, useCallback } from 'react';

const CONTENT_TYPES = ['heading', 'subheading', 'text'];
const LAYOUT_TYPES = ['row', 'section', 'data_table'];

export default function FormCanvas({
  elements,
  selectedKey,
  onSelect,
  onDrop,
  onMove,
  onMoveToParent,
  onRemove,
}) {
  const [dragOverTarget, setDragOverTarget] = useState(null); // "root:0", "parent_key:0", etc.

  const getChildren = useCallback((parentKey) => {
    return elements
      .filter(e => e.parent_key === (parentKey || null))
      .sort((a, b) => a.position - b.position);
  }, [elements]);

  const rootElements = getChildren(null);

  // Parse drag data
  const parseDragData = (e) => {
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try { return { type: 'new', data: JSON.parse(json) }; } catch {}
    }
    const key = e.dataTransfer.getData('text/plain');
    if (key) return { type: 'move', key };
    return null;
  };

  const handleDragOver = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/json') ? 'copy' : 'move';
    setDragOverTarget(target);
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDragOverTarget(null);
  };

  const handleDrop = (e, parentKey, position) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    const drag = parseDragData(e);
    if (!drag) return;

    if (drag.type === 'new') {
      onDrop(drag.data, position, parentKey);
    } else if (drag.type === 'move') {
      const el = elements.find(el => el.element_key === drag.key);
      if (!el) return;
      if (el.parent_key === (parentKey || null)) {
        onMove(drag.key, position);
      } else {
        onMoveToParent(drag.key, parentKey, position);
      }
    }
  };

  const handleElementDragStart = (e, element) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', element.element_key);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Drop zone component
  const DropZone = ({ parentKey, index, compact }) => {
    const target = `${parentKey || 'root'}:${index}`;
    const isOver = dragOverTarget === target;
    return (
      <div
        onDragOver={(e) => handleDragOver(e, target)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, parentKey, index)}
        className={`transition-all rounded ${compact ? 'h-0.5' : 'h-1'} ${
          isOver ? 'h-8 bg-blue-100 border-2 border-dashed border-blue-400 my-1' : ''
        }`}
      />
    );
  };

  // Render a content element (heading, subheading, text)
  const renderContentElement = (element) => {
    switch (element.type_name) {
      case 'heading':
        return <div className="text-lg font-bold text-gray-800">{element.values.label || 'Heading'}</div>;
      case 'subheading':
        return <div className="text-base font-semibold text-gray-600">{element.values.label || 'Sub Heading'}</div>;
      case 'text':
        return <div className="text-sm text-gray-500">{element.values.description || 'Text content'}</div>;
      default:
        return null;
    }
  };

  // Render children inside a layout container
  const renderChildren = (parentKey) => {
    const children = getChildren(parentKey);
    const parent = elements.find(e => e.element_key === parentKey);
    const isRow = parent?.type_name === 'row';
    const columns = isRow ? Number(parent?.values?.columns) || 2 : 1;

    if (isRow) {
      // Row: CSS grid with N columns, each column is a drop zone
      return (
        <div
          className="grid gap-2 p-2"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }, (_, colIdx) => {
            const child = children[colIdx];
            return (
              <div
                key={colIdx}
                onDragOver={(e) => handleDragOver(e, `${parentKey}:${colIdx}`)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, parentKey, colIdx)}
                className={`min-h-[3rem] border border-dashed rounded-md p-1 transition-colors ${
                  dragOverTarget === `${parentKey}:${colIdx}`
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 bg-gray-50/50'
                }`}
              >
                {child ? renderElement(child) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-400">
                    Drop here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Data table: column-preview table
    if (parent?.type_name === 'data_table') {
      const dropTarget = `${parentKey}:${children.length}`;
      const emptyDropTarget = `${parentKey}:0`;
      return (
        <div className="p-2">
          {children.length === 0 ? (
            <div
              onDragOver={(e) => handleDragOver(e, emptyDropTarget)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, parentKey, 0)}
              className={`min-h-[3rem] border border-dashed rounded-md flex items-center justify-center text-xs text-gray-400 transition-colors ${
                dragOverTarget === emptyDropTarget ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
              }`}
            >
              Drop input elements here to define columns
            </div>
          ) : (
            <>
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr>
                    {children.map((child) => {
                      const isSelected = selectedKey === child.element_key;
                      return (
                        <th
                          key={child.element_key}
                          onClick={(e) => { e.stopPropagation(); onSelect(child.element_key); }}
                          className={`border border-gray-300 px-2 py-1.5 text-left font-medium cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{child.values.label || child.element_key}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemove(child.element_key); }}
                              className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove column"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {children.map((child) => (
                      <td key={child.element_key} className="border border-gray-300 px-2 py-1.5">
                        <span className="italic text-gray-400">{child.type_name}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <div
                onDragOver={(e) => handleDragOver(e, dropTarget)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, parentKey, children.length)}
                className={`mt-1 border border-dashed rounded-md flex items-center justify-center text-xs text-gray-400 transition-colors py-1 ${
                  dragOverTarget === dropTarget ? 'border-blue-400 bg-blue-50 h-8' : 'border-gray-300 h-6'
                }`}
              >
                + column
              </div>
            </>
          )}
        </div>
      );
    }

    // Section / other layout: vertical stack
    return (
      <div className="p-2 space-y-1">
        {children.length === 0 ? (
          <div
            onDragOver={(e) => handleDragOver(e, `${parentKey}:0`)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, parentKey, 0)}
            className={`min-h-[3rem] border border-dashed rounded-md flex items-center justify-center text-xs text-gray-400 transition-colors ${
              dragOverTarget === `${parentKey}:0` ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
            }`}
          >
            Drop elements here
          </div>
        ) : (
          <>
            {children.map((child, index) => (
              <div key={child.element_key}>
                <DropZone parentKey={parentKey} index={index} compact />
                {renderElement(child)}
              </div>
            ))}
            <DropZone parentKey={parentKey} index={children.length} compact />
          </>
        )}
      </div>
    );
  };

  // Render a single element (recursive for layout elements)
  const renderElement = (element) => {
    const isLayout = LAYOUT_TYPES.includes(element.type_name);
    const isContent = CONTENT_TYPES.includes(element.type_name);
    const isSelected = selectedKey === element.element_key;

    return (
      <div
        key={element.element_key}
        draggable
        onDragStart={(e) => handleElementDragStart(e, element)}
        onClick={(e) => { e.stopPropagation(); onSelect(element.element_key); }}
        className={`group relative bg-white rounded-lg border-2 cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 shadow-md'
            : isLayout
              ? 'border-green-300 hover:border-green-400 hover:shadow-sm'
              : isContent
                ? 'border-purple-200 hover:border-purple-300'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }`}
      >
        {/* Element header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            {isContent ? (
              renderContentElement(element)
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${isLayout ? 'text-green-500' : 'text-gray-400'}`}>
                    {element.type_name}
                  </span>
                  {element.values.required === 'true' && (
                    <span className="text-red-400 text-xs">*</span>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-800 truncate">
                  {element.values.label || element.element_key}
                </div>
                {element.values.placeholder && (
                  <div className="text-xs text-gray-400 truncate">{element.values.placeholder}</div>
                )}
              </>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onRemove(element.element_key); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
            title="Remove"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Layout container body */}
        {isLayout && renderChildren(element.element_key)}
      </div>
    );
  };

  return (
    <div
      className="h-full overflow-y-auto p-6 bg-gray-50"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => handleDrop(e, null, rootElements.length)}
      onClick={() => onSelect(null)}
    >
      {rootElements.length === 0 ? (
        <div
          onDragOver={(e) => handleDragOver(e, 'root:0')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null, 0)}
          className={`flex items-center justify-center h-64 border-2 border-dashed rounded-lg transition-colors ${
            dragOverTarget === 'root:0' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <p className="text-gray-400 text-sm">
            Drag elements here or click them in the palette
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {rootElements.map((element, index) => (
            <div key={element.element_key}>
              <DropZone parentKey={null} index={index} />
              {renderElement(element)}
            </div>
          ))}
          <DropZone parentKey={null} index={rootElements.length} />
        </div>
      )}
    </div>
  );
}
