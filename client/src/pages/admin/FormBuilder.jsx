import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormBuilder } from '@formio/react';
import { getForm, createForm, updateForm } from '../../api/forms';
import FormPreview from '../../components/FormPreview';
import SimpleBuilder from '../../components/SimpleBuilder';

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState({ display: 'form', components: [] });
  const [mode, setMode] = useState('dnd');
  const [activeTab, setActiveTab] = useState('build');
  const builderRef = useRef(null);

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    enabled: isEditing,
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      setSchema(form.schema);
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateForm(id, data) : createForm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      navigate('/admin/forms');
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    saveMutation.mutate({ name, description, schema });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {isEditing ? 'Edit' : 'Create'} Form Template
      </h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g. Employee Onboarding Form"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Brief description"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('dnd')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                mode === 'dnd' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Drag & Drop
            </button>
            <button
              onClick={() => setMode('simple')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Simple
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('build')}
              className={`px-3 py-1.5 rounded text-sm ${
                activeTab === 'build' ? 'bg-gray-200 font-medium' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Build
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded text-sm ${
                activeTab === 'preview' ? 'bg-gray-200 font-medium' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'build' ? (
        mode === 'dnd' ? (
          <div className="bg-white rounded-lg shadow p-6" ref={builderRef}>
            <FormBuilder
              form={schema}
              onChange={(newSchema) => setSchema(newSchema)}
            />
          </div>
        ) : (
          <SimpleBuilder schema={schema} onChange={setSchema} />
        )
      ) : (
        <FormPreview schema={schema} />
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saveMutation.isPending}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => navigate('/admin/forms')}
          className="bg-gray-100 text-gray-700 px-6 py-2 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
