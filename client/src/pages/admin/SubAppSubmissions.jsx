import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { getSubmissions, getSubmission } from '../../api/submissions';
import SubmissionViewer from '../../components/SubmissionViewer';

export default function SubAppSubmissions() {
  const { id } = useParams();
  const [selectedId, setSelectedId] = useState(null);

  const { data: subApp } = useQuery({
    queryKey: ['subApp', id],
    queryFn: () => getSubApp(id),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => getSubmissions(id),
  });

  const { data: selectedSubmission } = useQuery({
    queryKey: ['submission', selectedId],
    queryFn: () => getSubmission(selectedId),
    enabled: !!selectedId,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{subApp?.name || 'Sub-App'}</h1>
      <p className="text-gray-500 text-sm mb-6">Submissions ({submissions.length})</p>

      <div className="flex gap-6">
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-lg shadow divide-y">
            {submissions.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">No submissions yet</div>
            ) : submissions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedId === s.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">#{s.id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    s.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    s.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{s.status}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{s.user_id}</div>
                <div className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {selectedSubmission ? (
            <div className="bg-white rounded-lg shadow p-6">
              <SubmissionViewer submission={selectedSubmission} />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
              Select a submission to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
