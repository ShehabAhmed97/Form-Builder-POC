import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Form } from '@formio/react';
import { getForm, getFormVersions } from '../../api/forms';

export default function FormVersionHistory() {
  const { id } = useParams();
  const [previewVersion, setPreviewVersion] = useState(null);

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
  });

  const { data: versions, isLoading } = useQuery({
    queryKey: ['form-versions', id],
    queryFn: () => getFormVersions(id),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/forms" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Forms
        </Link>
        <h2 className="text-2xl font-bold">Version History: {form?.name}</h2>
      </div>

      <div className="flex gap-6">
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {versions?.map(v => (
              <button
                key={v.id}
                onClick={() => setPreviewVersion(v)}
                className={`w-full text-left p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                  previewVersion?.id === v.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                }`}
              >
                <div className="font-medium text-sm">
                  Version {v.version_num}
                  {v.version_num === form?.current_version && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      current
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(v.created_at).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {v.schema?.components?.length || 0} fields
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {previewVersion ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">
                  Preview: Version {previewVersion.version_num}
                </h3>
                <span className="text-xs text-gray-400">
                  {previewVersion.schema?.components?.length || 0} fields
                </span>
              </div>
              <Form form={previewVersion.schema} options={{ readOnly: true }} />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
              Select a version to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
