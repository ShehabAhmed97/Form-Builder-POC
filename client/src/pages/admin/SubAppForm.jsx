import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubApp, createSubApp, updateSubApp } from '../../api/subApps';
import { getForms } from '../../api/forms';

export default function SubAppForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formId, setFormId] = useState('');

  const { data: subApp } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
    enabled: isEditing,
  });

  const { data: forms } = useQuery({
    queryKey: ['forms'],
    queryFn: getForms,
  });

  useEffect(() => {
    if (subApp) {
      setName(subApp.name);
      setDescription(subApp.description || '');
      setFormId(String(subApp.form_id));
    }
  }, [subApp]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateSubApp(id, data) : createSubApp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-apps'] });
      navigate('/admin/sub-apps');
    },
  });

  const handleSave = () => {
    if (!name.trim() || !formId) return;
    saveMutation.mutate({ name, description, form_id: Number(formId) });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {isEditing ? 'Edit' : 'Create'} Sub-App
      </h2>

      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g. IT Equipment Request"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="What is this sub-app for?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Template *</label>
            <select
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select a form template...</option>
              {forms?.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} (v{f.current_version})
                </option>
              ))}
            </select>
            {forms?.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">
                No form templates yet. Create one first.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!name.trim() || !formId || saveMutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => navigate('/admin/sub-apps')}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
