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

  const addElement = useCallback((elementType, atPosition = null) => {
    setElements(prev => {
      const existingKeys = new Set(prev.map(e => e.element_key));
      const key = generateKey(elementType.label, existingKeys);
      const position = atPosition ?? prev.filter(e => !e.parent_key).length;

      const newElement = {
        element_type_id: elementType.id,
        element_key: key,
        type_name: elementType.name,
        type_label: elementType.label,
        is_layout: elementType.is_layout,
        position,
        parent_key: null,
        values: { label: elementType.label },
        options: [],
      };

      return [...prev, newElement];
    });
  }, []);

  const removeElement = useCallback((key) => {
    setElements(prev => {
      const filtered = prev.filter(e => e.element_key !== key && e.parent_key !== key);
      const roots = filtered.filter(e => !e.parent_key);
      return filtered.map(e => {
        if (!e.parent_key) {
          return { ...e, position: roots.indexOf(e) };
        }
        return e;
      });
    });
    setSelectedKey(prev => prev === key ? null : prev);
  }, []);

  const moveElement = useCallback((key, newPosition) => {
    setElements(prev => {
      const el = prev.find(e => e.element_key === key);
      if (!el) return prev;

      const siblings = prev
        .filter(e => e.parent_key === el.parent_key && e.element_key !== key)
        .sort((a, b) => a.position - b.position);

      siblings.splice(newPosition, 0, el);

      return prev.map(e => {
        const idx = siblings.findIndex(s => s.element_key === e.element_key);
        if (idx !== -1) return { ...e, position: idx };
        return e;
      });
    });
  }, []);

  const updateValue = useCallback((key, propName, propValue) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key
          ? { ...e, values: { ...e.values, [propName]: propValue } }
          : e
      )
    );
  }, []);

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

  const updateOptions = useCallback((key, options) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key ? { ...e, options } : e
      )
    );
  }, []);

  const selectElement = useCallback((key) => {
    setSelectedKey(key);
  }, []);

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
    addElement,
    removeElement,
    moveElement,
    updateValue,
    updateElementKey,
    updateOptions,
    selectElement,
    loadElements,
    serializeForSave,
  };
}
