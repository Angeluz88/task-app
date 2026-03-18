import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Páginas (Asegúrate de que estos archivos existan en src/pages/)
import Login from './pages/Login';
import Register from './pages/Register';
import ParentDashboard from './pages/ParentDashboard';
import ChildDashboard from './pages/ChildDashboard';
import ChildLogin from './pages/ChildLogin'; // La nueva página especial para hijos

// Componente para proteger rutas privadas
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
    // Verificar sesión al cargar la app
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
    window.location.href = '/login'; // Recargar para limpiar estados
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

        {/* Login Especial para Hijos (Acceso rápido sin contraseña) */}
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

        {/* Dashboard del Padre (Protegido) */}
        <Route 
          path="/parent-dashboard" 
          element={
            <PrivateRoute allowedRoles={['parent']}>
              <ParentDashboard onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />

        {/* Dashboard del Hijo (Protegido) */}
        <Route 
          path="/child-dashboard" 
          element={
            <PrivateRoute allowedRoles={['child']}>
              <ChildDashboard onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />

        {/* Ruta por defecto */}
        <Route 
          path="/" 
          element={
            <Navigate to={
              isAuthenticated 
                ? (userRole === 'parent' ? '/parent-dashboard' : '/child-dashboard')
                : '/login'
            } replace />
        } />

        {/* Ruta 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;