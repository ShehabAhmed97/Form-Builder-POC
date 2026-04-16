import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { createSubmission } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';
import FormRenderer from '../../components/FormRenderer';

export default function CreateRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [submitError, setSubmitError] = useState(null);

  const { data: subApp, isLoading } = useQuery({
    queryKey: ['subApp', id],
    queryFn: () => getSubApp(id),
  });

  const submitMutation = useMutation({
    mutationFn: (data) => createSubmission(id, { user_id: userId, data }),
    onSuccess: () => navigate(`/sub-apps/${id}`),
    onError: (err) => setSubmitError(err.message),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!subApp) return <div className="p-6">Sub-app not found</div>;

  const schema = subApp.schema ? (typeof subApp.schema === 'string' ? JSON.parse(subApp.schema) : subApp.schema) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{subApp.name}</h1>
      <p className="text-gray-600 mb-6">{subApp.description}</p>

      {submitError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{submitError}</div>
      )}

      {schema ? (
        <div className="bg-white rounded-lg shadow p-6">
          <FormRenderer
            schema={schema}
            onSubmit={(data) => submitMutation.mutate(data)}
          />
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          No form schema available. The admin needs to configure this form.
        </div>
      )}
    </div>
  );
}
