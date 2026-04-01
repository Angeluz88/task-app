import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getChildTasks, 
  completeTask, 
  getScores, 
  getChildPrizes, 
  getMotivationalPhrase, 
  getNeuroInfo 
} from '../services/api';

const ChildDashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const childId = user?.id;

  // Estados
  const [tasks, setTasks] = useState([]);
  const [scores, setScores] = useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [prizes, setPrizes] = useState([]);
  const [phrase, setPhrase] = useState({ phrase: "¡Cargando motivación..." });
  const [neuroInfo, setNeuroInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados del Temporizador
  const [activeTask, setActiveTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [childId]);

  const loadData = async () => {
    try {
      const [tasksData, scoresData, prizesData, phraseData, infoData] = await Promise.all([
        getChildTasks(childId),
        getScores(childId),
        getChildPrizes(childId),
        getMotivationalPhrase('general'),
        getNeuroInfo('curiosity')
      ]);
      setTasks(tasksData);
      setScores(scoresData);
      setPrizes(prizesData);
      setPhrase(phraseData || { phrase: "¡Tú puedes!" });
      setNeuroInfo(infoData && infoData.length > 0 ? [infoData[Math.floor(Math.random() * infoData.length)]] : []);
      setLoading(false);
    } catch (error) {
      console.error("Error cargando datos:", error);
      setLoading(false);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.clear();
        navigate('/login');
      }
    }
  };

  // --- Lógica del Temporizador ---
  const startTimer = (task) => {
    setActiveTask(task);
    setTimeLeft(task.duration_minutes * 60);
    setIsTimerRunning(true);
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resumeTimer = () => {
    setIsTimerRunning(true);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveTask(null);
    setTimeLeft(0);
  };

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      clearInterval(timerRef.current);
      setIsTimerRunning(false);
      if(activeTask) alert(`¡Tiempo terminado para "${activeTask.title}"! ¿La completaste?`);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timeLeft, activeTask]);

  // --- Completar Tarea (CORREGIDO: Puntos definidos) ---
  const handleCompleteTask = async () => {
    if (!activeTask) return;
    
    if (!window.confirm(`¿Confirmas que completaste "${activeTask.title}"?`)) {
      return;
    }

    try {
      const response = await completeTask(activeTask.id, childId);
      // CORRECCIÓN: Usar response.points_earned directamente
      const pointsEarned = response.points_earned || activeTask.points; 
      
      alert(`¡Excelente trabajo! Ganaste ${pointsEarned} puntos.`);
      stopTimer();
      loadData(); 
    } catch (error) {
      const msg = error.response?.data?.message || "Error al completar tarea";
      alert(msg);
      if (msg.includes("Ya completada")) {
        stopTimer();
        loadData();
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const avatarStyle = {
    backgroundColor: user?.avatar_color || '#3B82F6',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: 'white',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[url('https://task-app-eight-inky.vercel.app/bgChildPattern.png')] bg-cover h-screen">
        <div className="text-center bg-white opacity-80">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-blue-600 font-bold">Cargando tu mundo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('https://task-app-eight-inky.vercel.app/bgChildPattern.png')] bg-cover h-screen p-4 pb-20">
      <header className="flex justify-between items-center mb-6 bg-orange-200 p-4 rounded-xl shadow-md sticky top-0 z-10 opacity-80">
        <div className="flex items-center gap-3">
          <div style={avatarStyle}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">¡Hola, {user?.name}! 🚀</h1>
            <p className="text-xs md:text-sm text-purple-600 font-medium">{phrase.phrase}</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition opacity-80" title="Cerrar sesión">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-yellow-200 p-3 rounded-xl text-center shadow-sm border border-yellow-300 opacity-80">
          <p className="text-yellow-800 text-xs font-bold uppercase">Hoy</p>
          <p className="text-2xl font-extrabold text-yellow-600">{scores.daily}</p>
        </div>
        <div className="bg-green-200 p-3 rounded-xl text-center shadow-sm border border-green-300 opacity-80">
          <p className="text-green-800 text-xs font-bold uppercase">Semana</p>
          <p className="text-2xl font-extrabold text-green-600">{scores.weekly}</p>
        </div>
        <div className="bg-blue-200 p-3 rounded-xl text-center shadow-sm border border-blue-300 opacity-80">
          <p className="text-blue-800 text-xs font-bold uppercase">Mes</p>
          <p className="text-2xl font-extrabold text-blue-600">{scores.monthly}</p>
        </div>
        <div className="bg-purple-200 p-3 rounded-xl text-center shadow-sm border border-purple-300 opacity-80">
          <p className="text-purple-800 text-xs font-bold uppercase">Total</p>
          <p className="text-2xl font-extrabold text-purple-600">{scores.total}</p>
        </div>
      </div>

      {activeTask && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl opacity-80">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{activeTask.title}</h2>
            <p className="text-gray-500 mb-6">Concéntrate. ¡Tú puedes!</p>
            
            <div className={`text-6xl md:text-7xl font-mono font-bold mb-8 tracking-wider ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
              {formatTime(timeLeft)}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3 justify-center">
                {isTimerRunning ? (
                  <button onClick={pauseTimer} className="bg-yellow-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-yellow-600 transition shadow-lg flex-1">Pausar ⏸️</button>
                ) : (
                  <button onClick={resumeTimer} className="bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition shadow-lg flex-1">Reanudar ▶️</button>
                )}
                <button onClick={stopTimer} className="bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-gray-300 transition">Cancelar</button>
              </div>

              {(timeLeft === 0 || !isTimerRunning) && activeTask && (
                <button onClick={handleCompleteTask} className="w-full bg-linear-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition shadow-lg transform hover:scale-105 animate-bounce">
                  ¡TERMINÉ LA TAREA! ✅
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-fuchsia-300 p-6 rounded-xl shadow-md border border-gray-100 opacity-80">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <span className="text-2xl">📋</span> Mis Tareas
          </h2>
          
          {tasks.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-gray-500">¡No hay tareas pendientes!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => {
                const isCompleted = Number(task.completed_today) > 0;
                return (
                  <div key={task.id} className={`border-l-4 p-4 rounded-r-lg flex justify-between items-center transition-all ${isCompleted ? 'bg-green-50 border-green-500 opacity-75' : 'bg-blue-50 border-blue-500 hover:shadow-md'}`}>
                    <div className="flex-1">
                      <h3 className={`font-bold text-gray-800 ${isCompleted ? 'line-through text-gray-500' : ''}`}>{task.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">⏱️ {task.duration_minutes} min | 🏆 {task.points} pts</p>
                      {isCompleted && <span className="inline-block mt-1 text-xs text-green-700 font-bold bg-green-200 px-2 py-0.5 rounded-full">✓ Completada hoy</span>}
                    </div>
                    {!isCompleted ? (
                      <button onClick={() => startTimer(task)} className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-bold shadow-sm">Iniciar</button>
                    ) : (
                      <div className="ml-4 text-green-600 text-2xl">✅</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-red-300 p-6 rounded-xl shadow-md border border-gray-100 opacity-80">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🎁</span> Mis Premios
            </h2>
            {prizes.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Papá/mamá aún no ha añadido premios.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {prizes.map(prize => (
                  <div key={prize.id} className={`p-4 rounded-xl border-2 transition-all ${prize.is_unlocked ? 'border-green-400 bg-linear-to-r from-green-50 to-white shadow-sm' : 'border-gray-200 bg-gray-50 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-bold ${prize.is_unlocked ? 'text-green-800' : 'text-gray-700'}`}>{prize.title}</h4>
                        <p className="text-xs text-gray-600 mt-1">{prize.description}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${prize.is_unlocked ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{prize.required_points} pts</span>
                    </div>
                    {prize.is_unlocked && <p className="text-xs text-green-600 font-bold mt-2 text-right">¡Desbloqueado! 🎉</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {neuroInfo.length > 0 && (
            <div className="bg-indigo-200 p-5 rounded-xl border-l-4 border-indigo-500 shadow-sm opacity-80">
              <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2"><span>💡</span> ¿Sabías qué?</h3>
              <p className="text-sm text-indigo-900 leading-relaxed"><strong className="block mb-1">{neuroInfo[0].title}:</strong>{neuroInfo[0].content}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildDashboard;