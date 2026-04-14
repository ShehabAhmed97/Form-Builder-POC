import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { getSubmissions } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function MySubmissions() {
  const { id } = useParams();
  const { userId } = useAuth();

  const { data: subApp } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['my-submissions', id, userId],
    queryFn: () => getSubmissions(id, userId),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <Link to="/sub-apps" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back
        </Link>
        <h2 className="text-2xl font-bold">{subApp?.name}</h2>
      </div>
      {subApp?.description && (
        <p className="text-gray-600 mb-6">{subApp.description}</p>
      )}

      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {submissions?.length || 0} request{submissions?.length !== 1 ? 's' : ''}
        </span>
        <Link
          to={`/sub-apps/${id}/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create New Request
        </Link>
      </div>

      {submissions?.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No submissions yet. Create your first request!
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3 font-medium">Request #</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions?.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">#{s.id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
