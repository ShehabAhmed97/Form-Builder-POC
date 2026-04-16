import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getForm, createForm, updateForm } from '../../api/forms';
import { useBuilderState } from '../../components/builder/useBuilderState';
import FormBuilderLayout from '../../components/builder/FormBuilderLayout';

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const builder = useBuilderState();

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    enabled: isEditing,
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      if (form.elements) {
        builder.loadElements(form.elements);
      }
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateForm(id, data) : createForm(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      if (!isEditing) {
        navigate(`/admin/forms/${result.id}/edit`);
      }
    },
  });

  const handleSave = () => {
    const payload = {
      name,
      description,
      elements: builder.serializeForSave(),
    };
    saveMutation.mutate(payload);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-0.5"
            placeholder="Form name"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-0.5 flex-1"
            placeholder="Description (optional)"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !name.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Three-panel builder */}
      <FormBuilderLayout
        elements={builder.elements}
        selectedKey={builder.selectedKey}
        selectedElement={builder.selectedElement}
        onAddElement={builder.addElement}
        onDropElement={builder.addElement}
        onMoveElement={builder.moveElement}
        onMoveToParent={builder.moveToParent}
        onRemoveElement={builder.removeElement}
        onSelectElement={builder.selectElement}
        onUpdateValue={builder.updateValue}
        onUpdateKey={builder.updateElementKey}
        onUpdateOptions={builder.updateOptions}
        allElements={builder.elements}
        onUpdateConditions={builder.updateConditions}
        onUndo={builder.undo}
        onRedo={builder.redo}
        canUndo={builder.canUndo}
        canRedo={builder.canRedo}
      />
    </div>
  );
}
