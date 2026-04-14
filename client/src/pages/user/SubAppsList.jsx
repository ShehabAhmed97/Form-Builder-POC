import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSubApps } from '../../api/subApps';

export default function SubAppsList() {
  const { data: subApps, isLoading } = useQuery({
    queryKey: ['sub-apps'],
    queryFn: getSubApps,
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Available Sub-Apps</h2>

      {subApps?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No sub-apps available yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subApps?.map(sa => (
            <Link
              key={sa.id}
              to={`/sub-apps/${sa.id}`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group"
            >
              <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 transition-colors">
                {sa.name}
              </h3>
              <p className="text-gray-600 text-sm">{sa.description || 'No description'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
