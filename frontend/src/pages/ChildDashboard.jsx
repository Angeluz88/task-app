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
  const [phrase, setPhrase] = useState({ phrase: "¡Tú puedes hacerlo!" });
  const [neuroInfo, setNeuroInfo] = useState([]);
  
  // Estados del Temporizador
  const [activeTask, setActiveTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Recargar cada minuto
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
      setPhrase(phraseData);
      // Tomar solo 1 dato curioso aleatorio si hay varios
      setNeuroInfo(infoData.length > 0 ? [infoData[Math.floor(Math.random() * infoData.length)]] : []);
    } catch (error) {
      console.error("Error cargando datos:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.clear();
        navigate('/login');
      }
    }
  };

  // Lógica del Temporizador
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
      // Tiempo terminado
      clearInterval(timerRef.current);
      setIsTimerRunning(false);
      alert("¡Tiempo terminado! ¿Completaste la tarea?");
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timeLeft]);

  // Completar Tarea
  const handleCompleteTask = async () => {
    if (!activeTask) return;
    
    try {
      await completeTask(activeTask.id, childId);
      alert(`¡Felicidades! Ganaste ${activeTask.points} puntos.`);
      stopTimer();
      loadData(); // Recargar para ver cambios
    } catch (error) {
      alert(error.response?.data?.message || "Error al completar tarea");
    }
  };

  // Formatear tiempo (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Colores de avatar
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
    fontWeight: 'bold'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-md">
        <div className="flex items-center gap-3">
          <div style={avatarStyle}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">¡Hola, {user?.name}! 🚀</h1>
            <p className="text-sm text-gray-500">{phrase.phrase}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition"
        >
          Salir
        </button>
      </header>

      {/* Panel de Puntos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-100 p-4 rounded-xl text-center">
          <p className="text-yellow-800 font-bold">Hoy</p>
          <p className="text-3xl font-extrabold text-yellow-600">{scores.daily}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-xl text-center">
          <p className="text-green-800 font-bold">Semana</p>
          <p className="text-3xl font-extrabold text-green-600">{scores.weekly}</p>
        </div>
        <div className="bg-blue-100 p-4 rounded-xl text-center">
          <p className="text-blue-800 font-bold">Mes</p>
          <p className="text-3xl font-extrabold text-blue-600">{scores.monthly}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded-xl text-center">
          <p className="text-purple-800 font-bold">Total</p>
          <p className="text-3xl font-extrabold text-purple-600">{scores.total}</p>
        </div>
      </div>

      {/* Temporizador Activo (Modal o Panel Superior) */}
      {activeTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-bounce-in">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{activeTask.title}</h2>
            <p className="text-gray-500 mb-6">¡Concéntrate! Tú puedes.</p>
            
            <div className={`text-6xl font-mono font-bold mb-8 ${timeLeft < 60 ? 'text-red-500' : 'text-blue-600'}`}>
              {formatTime(timeLeft)}
            </div>

            <div className="flex gap-3 justify-center">
              {isTimerRunning ? (
                <button onClick={pauseTimer} className="bg-yellow-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-yellow-600">
                  Pausar ⏸️
                </button>
              ) : (
                <button onClick={resumeTimer} className="bg-green-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-600">
                  Reanudar ▶️
                </button>
              )}
              
              {timeLeft === 0 || !isTimerRunning ? (
                 <button onClick={handleCompleteTask} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 animate-pulse">
                 ¡Terminé! ✅
               </button>
              ) : null}

              <button onClick={stopTimer} className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-400">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Columna Izquierda: Tareas */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            📋 Mis Tareas
          </h2>
          
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">¡No hay tareas pendientes! 🎉</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className={`border-l-4 p-4 rounded-r-lg flex justify-between items-center ${task.completed_today ? 'bg-green-50 border-green-500' : 'bg-blue-50 border-blue-500'}`}>
                  <div>
                    <h3 className="font-bold text-gray-800">{task.title}</h3>
                    <p className="text-sm text-gray-600">⏱️ {task.duration_minutes} min | 🏆 {task.points} pts</p>
                    {task.completed_today && <span className="text-xs text-green-600 font-bold">¡Completada hoy!</span>}
                  </div>
                  {!task.completed_today && (
                    <button 
                      onClick={() => startTimer(task)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-bold"
                    >
                      Iniciar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna Derecha: Premios y Curiosidades */}
        <div className="space-y-6">
          {/* Premios */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              🎁 Mis Premios
            </h2>
            {prizes.length === 0 ? (
              <p className="text-gray-500 text-sm">Papá/mamá aún no ha añadido premios.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {prizes.map(prize => (
                  <div key={prize.id} className={`p-3 rounded-lg border-2 ${prize.is_unlocked ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-800">{prize.title}</h4>
                        <p className="text-xs text-gray-600">{prize.description}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${prize.is_unlocked ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {prize.required_points} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dato Curioso */}
          {neuroInfo.length > 0 && (
            <div className="bg-indigo-100 p-4 rounded-xl border-l-4 border-indigo-500">
              <h3 className="font-bold text-indigo-800 mb-1">💡 ¿Sabías qué?</h3>
              <p className="text-sm text-indigo-900">{neuroInfo[0].content}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildDashboard;