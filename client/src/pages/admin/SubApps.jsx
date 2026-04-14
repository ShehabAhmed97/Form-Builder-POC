import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSubApps } from '../../api/subApps';

export default function SubApps() {
  const { data: subApps, isLoading } = useQuery({
    queryKey: ['sub-apps'],
    queryFn: getSubApps,
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Sub-Apps</h2>
        <Link
          to="/admin/sub-apps/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create New
        </Link>
      </div>

      {subApps?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No sub-apps yet. Create your first one!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Form Template</th>
                <th className="px-4 py-3 font-medium">Submissions</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subApps?.map(sa => (
                <tr key={sa.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{sa.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{sa.description}</td>
                  <td className="px-4 py-3 text-sm">{sa.form_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                      {sa.submission_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link to={`/admin/sub-apps/${sa.id}/edit`} className="text-blue-600 hover:underline text-sm">
                        Edit
                      </Link>
                      <Link to={`/admin/sub-apps/${sa.id}/submissions`} className="text-gray-600 hover:underline text-sm">
                        Submissions
                      </Link>
                    </div>
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
