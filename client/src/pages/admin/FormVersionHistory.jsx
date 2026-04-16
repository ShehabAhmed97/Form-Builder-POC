import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getForm, getFormVersions, getFormVersion } from '../../api/forms';
import { useState } from 'react';

export default function FormVersionHistory() {
  const { id } = useParams();
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['form-versions', id],
    queryFn: () => getFormVersions(id),
  });

  const { data: versionDetail } = useQuery({
    queryKey: ['form-version', id, selectedVersionId],
    queryFn: () => getFormVersion(id, selectedVersionId),
    enabled: !!selectedVersionId,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{form?.name || 'Form'}</h1>
      <p className="text-gray-500 text-sm mb-6">Version History</p>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow divide-y">
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedVersionId === v.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="text-sm font-medium">Version {v.version_num}</div>
                <div className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</div>
                {v.version_num === form?.current_version && (
                  <span className="text-xs text-green-600 font-medium">Current</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {versionDetail ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">
                Version {versionDetail.version_num} — {versionDetail.elements?.length || 0} elements
              </h3>
              <div className="space-y-2">
                {(versionDetail.elements || []).map(el => (
                  <div key={el.element_key} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{el.type_name}</span>
                      <span className="text-sm font-medium">{el.values?.label || el.element_key}</span>
                      {el.values?.required === 'true' && <span className="text-red-400 text-xs">*</span>}
                    </div>
                    {el.options?.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">Options: {el.options.map(o => o.label).join(', ')}</div>
                    )}
                    {el.conditions?.length > 0 && (
                      <div className="text-xs text-blue-400 mt-1">{el.conditions.length} condition(s)</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
              Select a version to view its elements
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
