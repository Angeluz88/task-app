import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Asegúrate de que estas rutas sean correctas según tu estructura de carpetas
import Login from './pages/Login';
import Register from './pages/Register';
import ParentDashboard from './pages/ParentDashboard';
import ChildDashboard from './pages/ChildDashboard';
import ChildLogin from './pages/ChildLogin';

// Componente para proteger rutas
const PrivateRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token && role) {
      setIsAuthenticated(true);
      setUserRole(role);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail');
    setIsAuthenticated(false);
    setUserRole(null);
    // CORRECCIÓN CLAVE: Redirigir explícitamente a la ruta con hash
    window.location.href = '/#/login';
  };

  return (
    <Router>
      <Routes>
        {/* Rutas Públicas */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              userRole === 'parent' ? <Navigate to="/parent-dashboard" /> : <Navigate to="/child-dashboard" />
            ) : (
              <Login onLoginSuccess={() => {
                const role = localStorage.getItem('role');
                setIsAuthenticated(true);
                setUserRole(role);
              }} />
            )
          } 
        />
        
        <Route 
          path="/register" 
          element={
            isAuthenticated ? (
              <Navigate to="/parent-dashboard" />
            ) : (
              <Register />
            )
          } 
        />

        <Route 
          path="/child-login" 
          element={
            isAuthenticated && userRole === 'child' ? (
              <Navigate to="/child-dashboard" />
            ) : (
              <ChildLogin onLoginSuccess={() => {
                setIsAuthenticated(true);
                setUserRole('child');
              }} />
            )
          } 
        />

        {/* Rutas Protegidas */}
        <Route 
          path="/parent-dashboard" 
          element={
            <PrivateRoute allowedRoles={['parent']}>
              <ParentDashboard onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/child-dashboard" 
          element={
            <PrivateRoute allowedRoles={['child']}>
              <ChildDashboard onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/" 
          element={
            <Navigate to={
              isAuthenticated 
                ? (userRole === 'parent' ? '/parent-dashboard' : '/child-dashboard')
                : '/login'
            } replace />
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;