import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { getForm } from '../../api/forms';
import { createSubmission } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';
import { RelationalFormRenderer } from '../../components/FormRenderer';

export default function CreateRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [submitError, setSubmitError] = useState(null);

  const { data: subApp, isLoading: loadingSubApp } = useQuery({
    queryKey: ['subApp', id],
    queryFn: () => getSubApp(id),
  });

  const { data: form, isLoading: loadingForm } = useQuery({
    queryKey: ['form', subApp?.form_id],
    queryFn: () => getForm(subApp.form_id),
    enabled: !!subApp?.form_id,
  });

  const submitMutation = useMutation({
    mutationFn: (values) => createSubmission(id, { user_id: userId, values }),
    onSuccess: () => navigate(`/sub-apps/${id}`),
    onError: (err) => setSubmitError(err.message),
  });

  if (loadingSubApp || loadingForm) return <div className="p-6">Loading...</div>;
  if (!subApp) return <div className="p-6">Sub-app not found</div>;

  const elements = form?.elements || [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{subApp.name}</h1>
      <p className="text-gray-600 mb-6">{subApp.description}</p>

      {submitError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{submitError}</div>
      )}

      {elements.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <RelationalFormRenderer
            elements={elements}
            onSubmit={(values) => submitMutation.mutate(values)}
          />
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          No form elements configured. The admin needs to add fields to this form.
        </div>
      )}
    </div>
  );
}
