import { Navigate, useLocation } from 'react-router-dom';
import { getStoredUserRole, hasValidSession } from '../utils/auth.js';

export default function ProtectedRoute({ children, roles }) {
  const location = useLocation();
  const role = getStoredUserRole();

  if (!hasValidSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'session-required' }} />;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
