# Phase 3: Complete Elements + Layout Nesting

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all remaining element types to the builder and renderer, implement layout elements (Row with column grid, Section as collapsible group), content elements (Heading, Subheading, Text), and nested drag-and-drop for placing elements inside layout containers.

**Architecture:** Layout elements (Row, Section) render as containers on the canvas with internal drop zones. Elements can be dragged into/out of these containers (updating parent_key). Row distributes children across N columns using CSS grid. The builder state hook gains nesting-aware operations. The renderer mirrors this structure for user-facing forms.

**Tech Stack:** React 18, TanStack Query, HTML5 Drag and Drop API, TailwindCSS.

**Depends on:** Phase 2 complete (builder components, forms API, state hook).

---

## File Structure

### Files to Modify
- `client/src/components/builder/useBuilderState.js` — add nesting operations
- `client/src/components/builder/FormCanvas.jsx` — layout containers, nested rendering, content elements
- `client/src/components/builder/ElementPalette.jsx` — visual distinction for layout/content types
- `client/src/components/FormRenderer.jsx` — all element types + layout rendering in RelationalFormRenderer

---

## Task 1: Builder State — Nesting Support

**Files:**
- Modify: `client/src/components/builder/useBuilderState.js`

Add support for:
- Adding elements to a specific parent (for dropping into layout containers)
- Moving elements between parents (drag from root into container, or from container to root)
- Proper position recalculation when nesting changes

- [ ] **Step 1: Update useBuilderState.js**

The key changes to `useBuilderState.js`:

1. Update `addElement` to accept an optional `parentKey` parameter
2. Add `moveToParent(key, newParentKey, newPosition)` for nesting operations
3. Update `moveElement` to handle same-parent reordering correctly
4. Update `removeElement` to recursively remove children of layout elements

```js
import { useState, useCallback } from 'react';

function generateKey(label, existingKeys) {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!base) base = 'field';

  let key = base;
  let counter = 1;
  while (existingKeys.has(key)) {
    key = `${base}_${counter}`;
    counter++;
  }
  return key;
}

export function useBuilderState(initialElements = []) {
  const [elements, setElements] = useState(initialElements);
  const [selectedKey, setSelectedKey] = useState(null);

  const selectedElement = elements.find(el => el.element_key === selectedKey) || null;

  // Get children of a parent, sorted by position
  const getChildren = useCallback((parentKey) => {
    return elements
      .filter(e => e.parent_key === parentKey)
      .sort((a, b) => a.position - b.position);
  }, [elements]);

  // Add a new element (from palette drop or click)
  const addElement = useCallback((elementType, atPosition = null, parentKey = null) => {
    setElements(prev => {
      const existingKeys = new Set(prev.map(e => e.element_key));
      const key = generateKey(elementType.label, existingKeys);
      const siblings = prev.filter(e => e.parent_key === (parentKey || null));
      const position = atPosition ?? siblings.length;

      const newElement = {
        element_type_id: elementType.id,
        element_key: key,
        type_name: elementType.name,
        type_label: elementType.label,
        is_layout: elementType.is_layout,
        position,
        parent_key: parentKey || null,
        values: { label: elementType.label },
        options: [],
      };

      // Re-index siblings at and after insertion point
      const updated = prev.map(e => {
        if (e.parent_key === (parentKey || null) && e.position >= position) {
          return { ...e, position: e.position + 1 };
        }
        return e;
      });

      return [...updated, newElement];
    });
  }, []);

  // Remove an element and all its descendants
  const removeElement = useCallback((key) => {
    setElements(prev => {
      // Collect all keys to remove (element + descendants)
      const keysToRemove = new Set();
      const collect = (k) => {
        keysToRemove.add(k);
        prev.filter(e => e.parent_key === k).forEach(child => collect(child.element_key));
      };
      collect(key);

      const removedEl = prev.find(e => e.element_key === key);
      const filtered = prev.filter(e => !keysToRemove.has(e.element_key));

      // Re-index siblings of the removed element
      if (removedEl) {
        const siblings = filtered
          .filter(e => e.parent_key === removedEl.parent_key)
          .sort((a, b) => a.position - b.position);
        return filtered.map(e => {
          const idx = siblings.findIndex(s => s.element_key === e.element_key);
          if (idx !== -1) return { ...e, position: idx };
          return e;
        });
      }

      return filtered;
    });
    setSelectedKey(prev => prev === key ? null : prev);
  }, []);

  // Move element to a new position within the same parent
  const moveElement = useCallback((key, newPosition) => {
    setElements(prev => {
      const el = prev.find(e => e.element_key === key);
      if (!el) return prev;

      const siblings = prev
        .filter(e => e.parent_key === el.parent_key && e.element_key !== key)
        .sort((a, b) => a.position - b.position);

      const clampedPos = Math.min(newPosition, siblings.length);
      siblings.splice(clampedPos, 0, el);

      return prev.map(e => {
        const idx = siblings.findIndex(s => s.element_key === e.element_key);
        if (idx !== -1) return { ...e, position: idx };
        return e;
      });
    });
  }, []);

  // Move element to a different parent (nesting/unnesting)
  const moveToParent = useCallback((key, newParentKey, newPosition = null) => {
    setElements(prev => {
      const el = prev.find(e => e.element_key === key);
      if (!el) return prev;

      // Prevent moving a layout element into itself or its descendants
      if (newParentKey) {
        const isDescendant = (parentKey, targetKey) => {
          if (parentKey === targetKey) return true;
          const parent = prev.find(e => e.element_key === parentKey);
          if (!parent || !parent.parent_key) return false;
          return isDescendant(parent.parent_key, targetKey);
        };
        if (isDescendant(newParentKey, key)) return prev;
      }

      const oldParentKey = el.parent_key;
      const resolvedNewParent = newParentKey || null;

      // Remove from old parent's sibling list
      const oldSiblings = prev
        .filter(e => e.parent_key === oldParentKey && e.element_key !== key)
        .sort((a, b) => a.position - b.position);

      // Insert into new parent's sibling list
      const newSiblings = prev
        .filter(e => e.parent_key === resolvedNewParent && e.element_key !== key)
        .sort((a, b) => a.position - b.position);

      const insertPos = newPosition ?? newSiblings.length;
      newSiblings.splice(insertPos, 0, { ...el, parent_key: resolvedNewParent });

      return prev.map(e => {
        if (e.element_key === key) {
          const idx = newSiblings.findIndex(s => s.element_key === key);
          return { ...e, parent_key: resolvedNewParent, position: idx };
        }
        // Re-index old siblings
        const oldIdx = oldSiblings.findIndex(s => s.element_key === e.element_key);
        if (oldIdx !== -1) return { ...e, position: oldIdx };
        // Re-index new siblings (excluding the moved element which is handled above)
        const newIdx = newSiblings.findIndex(s => s.element_key === e.element_key);
        if (newIdx !== -1 && e.element_key !== key) return { ...e, position: newIdx };
        return e;
      });
    });
  }, []);

  // Update a property value on an element
  const updateValue = useCallback((key, propName, propValue) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key
          ? { ...e, values: { ...e.values, [propName]: propValue } }
          : e
      )
    );
  }, []);

  // Update the element_key itself
  const updateElementKey = useCallback((oldKey, newKey) => {
    setElements(prev => {
      const existingKeys = new Set(prev.map(e => e.element_key));
      if (existingKeys.has(newKey) && newKey !== oldKey) return prev;
      return prev.map(e => {
        if (e.element_key === oldKey) return { ...e, element_key: newKey };
        if (e.parent_key === oldKey) return { ...e, parent_key: newKey };
        return e;
      });
    });
    setSelectedKey(prev => prev === oldKey ? newKey : prev);
  }, []);

  // Update options for select/radio/checkbox_group elements
  const updateOptions = useCallback((key, options) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key ? { ...e, options } : e
      )
    );
  }, []);

  // Select an element
  const selectElement = useCallback((key) => {
    setSelectedKey(key);
  }, []);

  // Load elements from API response
  const loadElements = useCallback((apiElements) => {
    const idToKey = new Map();
    for (const el of apiElements) {
      idToKey.set(el.id, el.element_key);
    }

    const builderElements = apiElements.map(el => ({
      element_type_id: el.element_type_id,
      element_key: el.element_key,
      type_name: el.type_name,
      type_label: el.type_name,
      is_layout: el.is_layout,
      position: el.position,
      parent_key: el.parent_id ? idToKey.get(el.parent_id) || null : null,
      values: el.values || {},
      options: el.options || [],
    }));

    setElements(builderElements);
    setSelectedKey(null);
  }, []);

  // Serialize elements for API save
  const serializeForSave = useCallback(() => {
    return elements.map(el => ({
      element_type_id: el.element_type_id,
      element_key: el.element_key,
      position: el.position,
      parent_key: el.parent_key,
      values: el.values,
      options: el.options.map((o, i) => ({
        label: o.label,
        value: o.value,
        display_order: i,
      })),
    }));
  }, [elements]);

  return {
    elements,
    selectedKey,
    selectedElement,
    getChildren,
    addElement,
    removeElement,
    moveElement,
    moveToParent,
    updateValue,
    updateElementKey,
    updateOptions,
    selectElement,
    loadElements,
    serializeForSave,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/builder/useBuilderState.js
git commit -m "feat: add nesting support to builder state (moveToParent, recursive delete)"
```

---

## Task 2: Canvas — Layout Containers + Nested Rendering

**Files:**
- Replace: `client/src/components/builder/FormCanvas.jsx`

The canvas needs to:
1. Render layout elements (row, section) as containers with child elements inside
2. Render content elements (heading, subheading, text) as preview blocks
3. Support dropping elements into layout containers
4. Support dragging elements out of containers
5. Row renders children in a CSS grid based on `columns` property

- [ ] **Step 1: Replace FormCanvas.jsx with nesting-aware version**

This is a full rewrite of the canvas. The key change is a recursive `renderElement` function that handles layout containers.

Replace `client/src/components/builder/FormCanvas.jsx`:

```jsx
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
```

- [ ] **Step 2: Update FormBuilderLayout.jsx to pass new props**

In `client/src/components/builder/FormBuilderLayout.jsx`, add `onMoveToParent` prop to FormCanvas:

Add `onMoveToParent` to the component's props and pass it through:

```jsx
// Add to the props destructuring:
onMoveToParent,

// Add to FormCanvas:
onMoveToParent={onMoveToParent}
```

- [ ] **Step 3: Update FormBuilder page to pass moveToParent**

In `client/src/pages/admin/FormBuilder.jsx`, add `onMoveToParent={builder.moveToParent}` to FormBuilderLayout.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/builder/FormCanvas.jsx client/src/components/builder/FormBuilderLayout.jsx client/src/pages/admin/FormBuilder.jsx
git commit -m "feat: add layout containers and nested drag-and-drop to canvas

- Row renders children in CSS grid with configurable columns
- Section renders as titled vertical container
- Content elements (heading, subheading, text) show inline preview
- Drop zones inside layout containers for nesting
- Drag elements between root and containers"
```

---

## Task 3: Renderer — All Element Types + Layout

**Files:**
- Modify: `client/src/components/FormRenderer.jsx`

Update `RelationalFormRenderer` to:
1. Handle all input types: phone, date, time, datetime, radio, checkbox, checkbox_group, toggle, file_upload
2. Render layout elements: Row as grid, Section as group
3. Render content elements: Heading, Subheading, Text as static content
4. Use recursive rendering for nested elements

- [ ] **Step 1: Replace the RelationalFormRenderer export**

Replace the entire `RelationalFormRenderer` function in `client/src/components/FormRenderer.jsx` with the expanded version that handles all element types and layout.

Key additions:
- `renderElementTree(parentKey)` — recursive function for layout nesting
- `radio` — renders radio button group from options
- `checkbox` — single checkbox
- `checkbox_group` — multiple checkboxes from options
- `toggle` — switch/toggle input
- `date`, `time`, `datetime` — native date/time inputs
- `phone` — tel input
- `file_upload` — file input
- `row` — CSS grid container
- `section` — fieldset with legend
- `heading`, `subheading`, `text` — static content

```jsx
export function RelationalFormRenderer({ elements, onSubmit }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  const getChildren = (parentKey) =>
    elements
      .filter(e => e.parent_key === (parentKey || null))
      .sort((a, b) => a.position - b.position);

  const inputElements = elements.filter(
    el => !el.is_layout && !['heading', 'subheading', 'text'].includes(el.type_name)
  );

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const newErrors = {};
    for (const el of inputElements) {
      const val = values[el.element_key];
      if (el.values.required === 'true' && (!val || val === '' || (Array.isArray(val) && val.length === 0))) {
        newErrors[el.element_key] = el.values.custom_error || `${el.values.label || el.element_key} is required`;
      }
      if (el.values.min_length && val && String(val).length < Number(el.values.min_length)) {
        newErrors[el.element_key] = el.values.custom_error || `Minimum ${el.values.min_length} characters`;
      }
      if (el.values.max_length && val && String(val).length > Number(el.values.max_length)) {
        newErrors[el.element_key] = el.values.custom_error || `Maximum ${el.values.max_length} characters`;
      }
      if (el.values.pattern && val) {
        try {
          if (!new RegExp(el.values.pattern).test(String(val))) {
            newErrors[el.element_key] = el.values.custom_error || 'Invalid format';
          }
        } catch { /* invalid regex */ }
      }
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(values);
  };

  const renderField = (el) => {
    const value = values[el.element_key] ?? '';
    const error = errors[el.element_key];
    const label = el.values.label || el.element_key;
    const placeholder = el.values.placeholder || '';
    const required = el.values.required === 'true';
    const disabled = el.values.disabled === 'true';

    const inputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
      error ? 'border-red-500' : 'border-gray-300'
    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`;

    let input;
    switch (el.type_name) {
      case 'textarea':
        input = <textarea value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} rows={Number(el.values.rows) || 3} disabled={disabled} className={inputClass} />;
        break;
      case 'number':
        input = <input type="number" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} min={el.values.min_value} max={el.values.max_value} disabled={disabled} className={inputClass} />;
        break;
      case 'email':
        input = <input type="email" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} disabled={disabled} className={inputClass} />;
        break;
      case 'phone':
        input = <input type="tel" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} disabled={disabled} className={inputClass} />;
        break;
      case 'date':
        input = <input type="date" value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass} />;
        break;
      case 'time':
        input = <input type="time" value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass} />;
        break;
      case 'datetime':
        input = <input type="datetime-local" value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass} />;
        break;
      case 'select':
        input = (
          <select value={value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className={inputClass}>
            <option value="">{placeholder || 'Select...'}</option>
            {(el.options || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
        break;
      case 'radio':
        input = (
          <div className="space-y-2">
            {(el.options || []).map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={el.element_key} value={opt.value} checked={value === opt.value} onChange={e => handleChange(el.element_key, e.target.value)} disabled={disabled} className="text-blue-600" />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        );
        break;
      case 'checkbox':
        input = (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={value === 'true'} onChange={e => handleChange(el.element_key, e.target.checked ? 'true' : 'false')} disabled={disabled} className="rounded text-blue-600" />
            <span className="text-sm">{label}</span>
          </label>
        );
        break;
      case 'checkbox_group':
        input = (
          <div className="space-y-2">
            {(el.options || []).map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(Array.isArray(value) ? value : []).includes(opt.value)} onChange={e => {
                  const current = Array.isArray(value) ? value : [];
                  const next = e.target.checked ? [...current, opt.value] : current.filter(v => v !== opt.value);
                  handleChange(el.element_key, next);
                }} disabled={disabled} className="rounded text-blue-600" />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        );
        break;
      case 'toggle':
        input = (
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={value === 'true'} onChange={e => handleChange(el.element_key, e.target.checked ? 'true' : 'false')} disabled={disabled} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        );
        break;
      case 'file_upload':
        input = <input type="file" onChange={e => handleChange(el.element_key, e.target.files?.[0]?.name || '')} multiple={el.values.multiple === 'true'} disabled={disabled} className="text-sm" />;
        break;
      default:
        input = <input type="text" value={value} onChange={e => handleChange(el.element_key, e.target.value)} placeholder={placeholder} disabled={disabled} className={inputClass} />;
    }

    // Checkbox and toggle render label inline, not above
    if (el.type_name === 'checkbox' || el.type_name === 'toggle') {
      return (
        <div key={el.element_key} className="mb-4">
          {input}
          {el.values.description && <p className="text-xs text-gray-500 mt-1">{el.values.description}</p>}
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    return (
      <div key={el.element_key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {el.values.description && <p className="text-xs text-gray-500 mb-1">{el.values.description}</p>}
        {input}
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  };

  // Recursive element tree renderer
  const renderElementTree = (parentKey) => {
    const children = getChildren(parentKey);

    return children.map(el => {
      // Content elements
      if (el.type_name === 'heading') return <h2 key={el.element_key} className="text-xl font-bold mt-4 mb-2">{el.values.label}</h2>;
      if (el.type_name === 'subheading') return <h3 key={el.element_key} className="text-lg font-semibold mt-3 mb-1">{el.values.label}</h3>;
      if (el.type_name === 'text') return <p key={el.element_key} className="text-sm text-gray-600 mb-3">{el.values.description}</p>;

      // Layout: Row
      if (el.type_name === 'row') {
        const cols = Number(el.values.columns) || 2;
        return (
          <div key={el.element_key} className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {renderElementTree(el.element_key)}
          </div>
        );
      }

      // Layout: Section
      if (el.type_name === 'section') {
        return (
          <fieldset key={el.element_key} className="border border-gray-200 rounded-lg p-4 mb-4">
            {el.values.label && <legend className="text-sm font-semibold px-2">{el.values.label}</legend>}
            {el.values.description && <p className="text-xs text-gray-500 mb-3">{el.values.description}</p>}
            {renderElementTree(el.element_key)}
          </fieldset>
        );
      }

      // Layout: Data Table (basic rendering)
      if (el.type_name === 'data_table') {
        return (
          <div key={el.element_key} className="mb-4">
            {el.values.label && <label className="block text-sm font-medium text-gray-700 mb-1">{el.values.label}</label>}
            <div className="border rounded-lg overflow-hidden">
              {renderElementTree(el.element_key)}
            </div>
          </div>
        );
      }

      // Input elements
      return renderField(el);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {renderElementTree(null)}
      <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 mt-4">
        Submit
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd client && npx vite build
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/FormRenderer.jsx
git commit -m "feat: expand renderer with all element types, layout rendering, and nesting

- Added: phone, date, time, datetime, radio, checkbox, checkbox_group, toggle, file_upload
- Layout: Row renders as CSS grid, Section as fieldset, Data Table as container
- Content: Heading, Subheading, Text render as static HTML
- Recursive renderElementTree for nested layout structures"
```

---

## Task 4: Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Run all server tests**

```bash
cd server && npx vitest run
```

Expected: 26 tests PASS.

- [ ] **Step 2: Verify frontend builds**

```bash
cd client && npx vite build
```

- [ ] **Step 3: Manual verification**

Start the full stack and verify:
1. Open form builder — left sidebar shows all 5 categories with 20 element types
2. Click "Row" from Layout — it appears as a green-bordered container with 2 column drop zones
3. Drag a "Text Field" into the first column of the row — it nests inside
4. Drag a "Number" into the second column — both fields are side by side
5. Click the row — right sidebar shows "columns" and "css_class" properties
6. Click "Section" — it appears as a collapsible container
7. Click "Heading" — it shows inline text preview on the canvas
8. Drag elements to reorder — positions update correctly
9. Save and reload — nested structure persists correctly
10. Test select element with options — options editor works in right sidebar

---

## Summary

**Phase 3 delivers:**
- All 20 element types functional in builder and renderer
- Layout nesting: Row (CSS grid with configurable columns), Section (titled container)
- Content elements: Heading, Subheading, Text render as static previews
- Nested drag-and-drop: drop into layout containers, reorder within, move between parents
- Recursive rendering in both canvas and form renderer
- Data Table basic container support

**What Phase 4 will build on this:**
- Conditional logic builder UI in right sidebar
- Condition evaluation engine in renderer
- Server-side condition evaluation for validation
