import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ParentDashboard from './pages/ParentDashboard';
import ChildDashboard from './pages/ChildDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route 
            path="/login" 
            element={
              !user ? 
                <Login onLogin={handleLogin} /> : 
                <Navigate to={user.role === 'parent' ? '/parent' : '/child'} />
            } 
          />
          <Route 
            path="/register" 
            element={
              !user ? 
                <Register /> : 
                <Navigate to={user.role === 'parent' ? '/parent' : '/child'} />
            } 
          />
          <Route 
            path="/parent/*" 
            element={
              user?.role === 'parent' ? 
                <ParentDashboard user={user} onLogout={handleLogout} /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/child/*" 
            element={
              user?.role === 'child' ? 
                <ChildDashboard user={user} onLogout={handleLogout} /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to={user ? (user.role === 'parent' ? '/parent' : '/child') : '/login'} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
