import ElementPalette from './ElementPalette';
import FormCanvas from './FormCanvas';
import PropertyEditor from './PropertyEditor';

export default function FormBuilderLayout({
  elements,
  selectedKey,
  selectedElement,
  onAddElement,
  onDropElement,
  onMoveElement,
  onRemoveElement,
  onSelectElement,
  onUpdateValue,
  onUpdateKey,
  onUpdateOptions,
}) {
  return (
    <div className="flex h-[calc(100vh-12rem)] border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Left sidebar — Element Palette */}
      <div className="w-60 border-r border-gray-200 bg-white flex-shrink-0">
        <ElementPalette onAddElement={onAddElement} />
      </div>

      {/* Center — Canvas */}
      <div className="flex-1 min-w-0">
        <FormCanvas
          elements={elements}
          selectedKey={selectedKey}
          onSelect={onSelectElement}
          onDrop={onDropElement}
          onMove={onMoveElement}
          onRemove={onRemoveElement}
        />
      </div>

      {/* Right sidebar — Property Editor */}
      <div className="w-72 border-l border-gray-200 bg-white flex-shrink-0">
        <PropertyEditor
          element={selectedElement}
          onUpdateValue={onUpdateValue}
          onUpdateKey={onUpdateKey}
          onUpdateOptions={onUpdateOptions}
        />
      </div>
    </div>
  );
}
