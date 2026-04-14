import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getForms } from '../../api/forms';

export default function FormTemplates() {
  const { data: forms, isLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: getForms,
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Form Templates</h2>
        <Link
          to="/admin/forms/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create New
        </Link>
      </div>

      {forms?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No form templates yet. Create your first one!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms?.map(form => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{form.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{form.description}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                      v{form.current_version}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(form.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link to={`/admin/forms/${form.id}/edit`} className="text-blue-600 hover:underline text-sm">
                        Edit
                      </Link>
                      <Link to={`/admin/forms/${form.id}/versions`} className="text-gray-600 hover:underline text-sm">
                        History
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
