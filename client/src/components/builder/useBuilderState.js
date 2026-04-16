import { useState, useCallback, useRef } from 'react';

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

  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const maxHistory = 50;

  const setElementsWithHistory = useCallback((updater) => {
    setElements(prev => {
      historyRef.current = [...historyRef.current.slice(-(maxHistory - 1)), prev];
      futureRef.current = [];
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  }, []);

  const getChildren = useCallback((parentKey) => {
    return elements
      .filter(e => e.parent_key === (parentKey || null))
      .sort((a, b) => a.position - b.position);
  }, [elements]);

  const addElement = useCallback((elementType, atPosition = null, parentKey = null) => {
    setElementsWithHistory(prev => {
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

      const updated = prev.map(e => {
        if (e.parent_key === (parentKey || null) && e.position >= position) {
          return { ...e, position: e.position + 1 };
        }
        return e;
      });

      return [...updated, newElement];
    });
  }, []);

  const removeElement = useCallback((key) => {
    setElementsWithHistory(prev => {
      const keysToRemove = new Set();
      const collect = (k) => {
        keysToRemove.add(k);
        prev.filter(e => e.parent_key === k).forEach(child => collect(child.element_key));
      };
      collect(key);

      const removedEl = prev.find(e => e.element_key === key);
      const filtered = prev.filter(e => !keysToRemove.has(e.element_key));

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

  const moveElement = useCallback((key, newPosition) => {
    setElementsWithHistory(prev => {
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

  const moveToParent = useCallback((key, newParentKey, newPosition = null) => {
    setElementsWithHistory(prev => {
      const el = prev.find(e => e.element_key === key);
      if (!el) return prev;

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

      const oldSiblings = prev
        .filter(e => e.parent_key === oldParentKey && e.element_key !== key)
        .sort((a, b) => a.position - b.position);

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
        const oldIdx = oldSiblings.findIndex(s => s.element_key === e.element_key);
        if (oldIdx !== -1) return { ...e, position: oldIdx };
        const newIdx = newSiblings.findIndex(s => s.element_key === e.element_key);
        if (newIdx !== -1 && e.element_key !== key) return { ...e, position: newIdx };
        return e;
      });
    });
  }, []);

  const updateValue = useCallback((key, propName, propValue) => {
    setElementsWithHistory(prev =>
      prev.map(e =>
        e.element_key === key
          ? { ...e, values: { ...e.values, [propName]: propValue } }
          : e
      )
    );
  }, [setElementsWithHistory]);

  const updateElementKey = useCallback((oldKey, newKey) => {
    setElementsWithHistory(prev => {
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
    setElementsWithHistory(prev =>
      prev.map(e =>
        e.element_key === key ? { ...e, options } : e
      )
    );
  }, [setElementsWithHistory]);

  const updateConditions = useCallback((key, conditions) => {
    setElementsWithHistory(prev =>
      prev.map(e =>
        e.element_key === key ? { ...e, conditions } : e
      )
    );
  }, [setElementsWithHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    setElements(prev => {
      futureRef.current = [prev, ...futureRef.current];
      const last = historyRef.current[historyRef.current.length - 1];
      historyRef.current = historyRef.current.slice(0, -1);
      return last;
    });
    setSelectedKey(null);
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setElements(prev => {
      historyRef.current = [...historyRef.current, prev];
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      return next;
    });
    setSelectedKey(null);
  }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

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
      conditions: el.conditions || [],
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
      conditions: (el.conditions || []).map((c, ci) => ({
        action_type_id: c.action_type_id,
        action_value: c.action_value || null,
        logic_operator: c.logic_operator || 'AND',
        rules: (c.rules || []).map((r, ri) => ({
          source_key: r.source_key,
          operator_id: r.operator_id,
          value: r.value,
        })),
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
    updateConditions,
    selectElement,
    loadElements,
    serializeForSave,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
