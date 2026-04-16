import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getForm, createForm, updateForm } from '../../api/forms';
import SimpleBuilder from '../../components/SimpleBuilder';

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState({ display: 'form', components: [] });

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    enabled: isEditing,
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      if (form.schema) {
        setSchema(typeof form.schema === 'string' ? JSON.parse(form.schema) : form.schema);
      }
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
    saveMutation.mutate({ name, description, schema });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Form Template' : 'New Form Template'}
        </h1>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !name.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Enter form name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Enter description"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <SimpleBuilder
          schema={schema}
          onChange={setSchema}
        />
      </div>
    </div>
  );
}
