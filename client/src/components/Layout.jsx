import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useEffect } from 'react';

export default function Layout() {
  const { role, userId, setRole, setUserId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const adminLinks = [
    { to: '/admin/forms', label: 'Form Templates' },
    { to: '/admin/sub-apps', label: 'Sub-Apps' },
  ];

  const userLinks = [
    { to: '/sub-apps', label: 'Sub-Apps' },
  ];

  const links = role === 'admin' ? adminLinks : userLinks;

  useEffect(() => {
    if (role === 'admin' && location.pathname.startsWith('/sub-apps')) {
      navigate('/admin/forms');
    } else if (role === 'user' && location.pathname.startsWith('/admin')) {
      navigate('/sub-apps');
    }
  }, [role]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-gray-900">POC Platform</Link>
          <nav className="flex gap-4">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm ${
                  location.pathname.startsWith(link.to)
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="text-sm border rounded px-2 py-1 w-24"
            placeholder="User ID"
          />
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
