import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginParent, loginChild } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [isParent, setIsParent] = useState(true); // true = Padre, false = Hijo
  
  // Estados para Padre
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  
  // Estados para Hijo
  const [childParentEmail, setChildParentEmail] = useState('');
  const [childIdentifier, setChildIdentifier] = useState(''); // Nombre o PIN
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleParentLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginParent(parentEmail, parentPassword);
      
      // Guardar datos en localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('userEmail', data.user.email); // Importante para crear hijos después
      localStorage.setItem('role', 'parent');

      navigate('/parent-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleChildLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginChild(childIdentifier, childParentEmail);
      
      // Guardar datos del niño
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('userEmail', childParentEmail); // Usamos el email del padre como referencia
      localStorage.setItem('role', 'child');

      navigate('/child-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'No te encontramos. ¿Escribiste bien tu nombre/PIN y el email de papá?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${isParent ? 'bg-linear-to-r from-cyan-500 to-blue-500' : 'bg-linear-to-r from-yellow-500 to-orange-500'}`}>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md transform transition-all">
        
        {/* Encabezado con Switch */}
        <div className="text-center mb-6">
          <h1 className={`text-3xl font-bold mb-2 ${isParent ? 'text-blue-600' : 'text-yellow-600'}`}>
            {isParent ? 'Bienvenido Papá/Mamá' : '¡Hola Campeón!'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isParent ? 'Gestiona las tareas y premios de tus hijos' : 'Entra para ganar puntos y diversion'}
          </p>

          {/* Interruptor Padre/Hijo */}
          <div className="mt-6 flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setIsParent(true); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                isParent 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Soy Padre
            </button>
            <button
              type="button"
              onClick={() => { setIsParent(false); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                !isParent 
                  ? 'bg-white text-yellow-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Soy Hijo
            </button>
          </div>
        </div>

        {/* Formulario de Padre */}
        {isParent && (
          <form onSubmit={handleParentLogin} className="space-y-4 animate-fade-in">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="papá@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

        {/* Formulario de Hijo */}
        {!isParent && (
          <form onSubmit={handleChildLogin} className="space-y-4 animate-fade-in">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo de Papá/Mamá</label>
              <input
                type="email"
                required
                value={childParentEmail}
                onChange={(e) => setChildParentEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition"
                placeholder="papá@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tu Nombre o PIN</label>
              <input
                type="text"
                required
                value={childIdentifier}
                onChange={(e) => setChildIdentifier(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition text-center text-lg tracking-widest uppercase"
                placeholder="Ej: Juan o 1234"
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-1">Usa el nombre que te puso papá o tu código secreto.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? 'Entrando...' : '¡A Jugar! 🚀'}
            </button>
          </form>
        )}

        {/* Pie de página */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            {isParent ? "¿Aún no tienes cuenta?" : "¿Eres papá/mamá?"}{" "}
            <Link 
              to={isParent ? "/register" : "/login"} 
              className={`font-bold hover:underline ${isParent ? 'text-blue-600' : 'text-yellow-600'}`}
            >
              {isParent ? "Regístrate aquí" : "Ve al login de padres"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};