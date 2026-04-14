import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Form } from '@formio/react';
import { getSubApp } from '../../api/subApps';
import { getSubmissions, getSubmission } from '../../api/submissions';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function SubAppSubmissions() {
  const { id } = useParams();
  const [selectedId, setSelectedId] = useState(null);

  const { data: subApp } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => getSubmissions(id),
  });

  const { data: selected } = useQuery({
    queryKey: ['submission', selectedId],
    queryFn: () => getSubmission(selectedId),
    enabled: Boolean(selectedId),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/sub-apps" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Sub-Apps
        </Link>
        <h2 className="text-2xl font-bold">Submissions: {subApp?.name}</h2>
        <span className="text-sm text-gray-500">({submissions?.length || 0} total)</span>
      </div>

      {submissions?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No submissions yet.</p>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Form Version</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions?.map(s => (
                    <tr
                      key={s.id}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedId === s.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <td className="px-4 py-3 text-sm">{s.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{s.user_id}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                          v{s.version_num}
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
          </div>

          {selected && (
            <div className="w-[400px] shrink-0">
              <div className="bg-white rounded-lg shadow p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Submission #{selected.id}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[selected.status] || ''}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-4">
                  Form version: v{selected.version_num} | User: {selected.user_id}
                </div>
                <Form
                  form={selected.schema}
                  submission={{ data: selected.data }}
                  options={{ readOnly: true }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
