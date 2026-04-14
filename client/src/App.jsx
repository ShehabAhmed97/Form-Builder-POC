import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './components/AuthContext';
import FormTemplates from './pages/admin/FormTemplates';
import FormBuilderPage from './pages/admin/FormBuilder';
import FormVersionHistory from './pages/admin/FormVersionHistory';
import SubApps from './pages/admin/SubApps';
import SubAppForm from './pages/admin/SubAppForm';
import SubAppSubmissions from './pages/admin/SubAppSubmissions';
import SubAppsList from './pages/user/SubAppsList';
import MySubmissions from './pages/user/MySubmissions';
import CreateRequest from './pages/user/CreateRequest';

export default function App() {
  const { role } = useAuth();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/admin/forms" element={<FormTemplates />} />
        <Route path="/admin/forms/new" element={<FormBuilderPage />} />
        <Route path="/admin/forms/:id/edit" element={<FormBuilderPage />} />
        <Route path="/admin/forms/:id/versions" element={<FormVersionHistory />} />
        <Route path="/admin/sub-apps" element={<SubApps />} />
        <Route path="/admin/sub-apps/new" element={<SubAppForm />} />
        <Route path="/admin/sub-apps/:id/edit" element={<SubAppForm />} />
        <Route path="/admin/sub-apps/:id/submissions" element={<SubAppSubmissions />} />

        <Route path="/sub-apps" element={<SubAppsList />} />
        <Route path="/sub-apps/:id" element={<MySubmissions />} />
        <Route path="/sub-apps/:id/new" element={<CreateRequest />} />

        <Route path="/" element={<Navigate to={role === 'admin' ? '/admin/forms' : '/sub-apps'} replace />} />
      </Route>
    </Routes>
  );
}
