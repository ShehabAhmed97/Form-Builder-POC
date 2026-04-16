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
  onMoveToParent,
  onRemoveElement,
  onSelectElement,
  onUpdateValue,
  onUpdateKey,
  onUpdateOptions,
  allElements,
  onUpdateConditions,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo"
        >
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo"
        >
          Redo
        </button>
      </div>

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
          onMoveToParent={onMoveToParent}
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
          allElements={allElements}
          onUpdateConditions={onUpdateConditions}
        />
      </div>
    </div>
    </div>
  );
}
