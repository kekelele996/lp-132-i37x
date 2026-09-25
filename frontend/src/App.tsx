import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import MainLayout from './components/Layout';
import Login from './pages/Login';
import NeedSquare from './pages/NeedSquare';
import ElderlyProfile from './pages/ElderlyProfile';
import PublishNeed from './pages/PublishNeed';
import MessageCenter from './pages/MessageCenter';
import Profile from './pages/Profile';
import Favorites from './pages/Favorites';
import Schedule from './pages/Schedule';
import IncomeRanking from './pages/IncomeRanking';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuthStore();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <MainLayout>{children}</MainLayout>;
};

const RoleRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { user } = useAuthStore();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <NeedSquare />
          </ProtectedRoute>
        }
      />
      <Route
        path="/elderly"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['child', 'admin']}>
              <ElderlyProfile />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/publish"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['child', 'admin']}>
              <PublishNeed />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-orders"
        element={
          <ProtectedRoute>
            <NeedSquare />
          </ProtectedRoute>
        }
      />
      <Route
        path="/favorites"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['child', 'admin']}>
              <Favorites />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['worker', 'volunteer', 'admin']}>
              <Schedule />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/income"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['worker', 'volunteer', 'admin']}>
              <IncomeRanking />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <MessageCenter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
