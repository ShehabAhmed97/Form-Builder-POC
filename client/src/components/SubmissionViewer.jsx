export default function SubmissionViewer({ submission }) {
  if (!submission) return null;

  const values = submission.values || {};
  const entries = Object.entries(values);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600">Submission #{submission.id}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
          submission.status === 'approved' ? 'bg-green-100 text-green-700' :
          submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {submission.status}
        </span>
      </div>

      <div className="text-xs text-gray-400 mb-4">
        By: {submission.user_id} | {new Date(submission.created_at).toLocaleString()}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No values submitted</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <div key={key}>
              <div className="text-xs font-medium text-gray-500">{key}</div>
              <div className="text-sm text-gray-800 mt-0.5">
                {typeof value === 'object' ? JSON.stringify(value) : String(value) || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
