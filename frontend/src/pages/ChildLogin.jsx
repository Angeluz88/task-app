import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginChild } from '../services/api';

export default function ChildLogin({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState(''); // Puede ser nombre o PIN
  const [parentEmail, setParentEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginChild(identifier.trim(), parentEmail.trim());
      
      // Guardar sesión
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', 'child');
      localStorage.setItem('user', JSON.stringify(data.user));
      // No guardamos email en user porque el niño no tiene, pero sí el del padre para referencia si fuera necesario
      
      if (onLoginSuccess) onLoginSuccess();
      navigate('/child-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'No te encontramos. ¿Verificaste tu nombre o PIN?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-yellow-300 via-orange-200 to-pink-300 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-4 border-orange-400">
        
        {/* Icono divertido */}
        <div className="flex text-6xl mb-4 animate-bounce items-center">
          <img src="/icons/sol.png" alt="sol" />
        </div>
        
        <h1 className="text-3xl font-extrabold text-orange-600 mb-2">
          ¡Hola Campeón!
        </h1>
        <p className="text-gray-600 mb-8 text-lg">
          Entra para ver tus misiones y ganar superpuntos.
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Email del Padre (Necesario para saber a qué familia perteneces) */}
          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              📧 Email de Papá o Mamá
            </label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-200 outline-none transition text-lg"
              placeholder="papa@ejemplo.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              required
            />
          </div>

          {/* Nombre o PIN del Niño */}
          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              🆔 Tu Nombre o Código Secreto (PIN)
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-200 outline-none transition text-xl text-center tracking-widest font-bold uppercase"
              placeholder="Ej: MAX o 1234"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              Usa el mismo nombre o PIN que papá/mamá creó para ti.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-xl font-bold text-white shadow-lg transform transition hover:scale-105 active:scale-95 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-linear-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600'
            }`}
          >
            {loading ? 'Entrando...' : '¡A Jugar! 🎮'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link
            to="/login"
            className="text-gray-500 hover:text-orange-600 font-medium transition flex items-center justify-center gap-2"
          >
            <span>🔒</span> Soy Papá o Mamá
          </Link>
        </div>
      </div>
    </div>
  );
};