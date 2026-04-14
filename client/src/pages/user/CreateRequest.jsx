import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from '@formio/react';
import { getSubApp } from '../../api/subApps';
import { createSubmission } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';

export default function CreateRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  const { data: subApp, isLoading } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
  });

  const submitMutation = useMutation({
    mutationFn: (data) => createSubmission(id, { user_id: userId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-submissions', id] });
      queryClient.invalidateQueries({ queryKey: ['submissions', id] });
      navigate(`/sub-apps/${id}`);
    },
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  if (!subApp?.schema) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No form assigned to this sub-app.</p>
        <Link to={`/sub-apps/${id}`} className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/sub-apps/${id}`} className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back
        </Link>
        <h2 className="text-2xl font-bold">New Request: {subApp.name}</h2>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
        <Form
          form={subApp.schema}
          onSubmit={(submission) => {
            submitMutation.mutate(submission.data);
          }}
        />
        {submitMutation.isPending && (
          <div className="mt-4 text-sm text-gray-500">Submitting...</div>
        )}
        {submitMutation.isError && (
          <div className="mt-4 text-sm text-red-600">
            Failed to submit. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
