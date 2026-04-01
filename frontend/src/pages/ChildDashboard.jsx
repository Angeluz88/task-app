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
  
  // neuroInfo ahora será un ARRAY completo para poder rotar
  const [neuroInfo, setNeuroInfo] = useState([]);
  const [currentInfoIndex, setCurrentInfoIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  
  // Estados del Temporizador
  const [activeTask, setActiveTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Recargar datos cada minuto
    return () => clearInterval(interval);
  }, [childId]);

  // Efecto para rotar los datos curiosos automáticamente cada 8 segundos
  useEffect(() => {
    if (neuroInfo.length > 1) {
      const rotationInterval = setInterval(() => {
        setCurrentInfoIndex((prevIndex) => (prevIndex + 1) % neuroInfo.length);
      }, 8000); // 8000ms = 8 segundos

      return () => clearInterval(rotationInterval);
    }
  }, [neuroInfo]);

  const loadData = async () => {
    try {
      const [tasksData, scoresData, prizesData, phraseData, infoData] = await Promise.all([
        getChildTasks(childId),
        getScores(childId),
        getChildPrizes(childId),
        getMotivationalPhrase('general'),
        getNeuroInfo('curiosity') // Obtenemos TODA la lista de categoría 'curiosity'
      ]);
      
      setTasks(tasksData);
      setScores(scoresData);
      setPrizes(prizesData);
      setPhrase(phraseData || { phrase: "¡Tú puedes!" });
      
      // Guardamos el array completo. Si viene vacío, dejamos array vacío.
      setNeuroInfo(infoData || []);
      setCurrentInfoIndex(0); // Reiniciar índice al cargar
      
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

  // --- Completar Tarea ---
  const handleCompleteTask = async () => {
    if (!activeTask) return;
    
    if (!window.confirm(`¿Confirmas que completaste "${activeTask.title}"?`)) {
      return;
    }

    try {
      const response = await completeTask(activeTask.id, childId);
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

  // Manejo del Avatar
  const avatarIcon = user?.avatar_icon || 'lobo.png'; 
  const avatarSrc = `/icons/${avatarIcon}`;

  // Elemento actual a mostrar en "¿Sabías qué?"
  const currentItem = neuroInfo.length > 0 ? neuroInfo[currentInfoIndex] : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#d4a5ff] via-[#8fd3f4] to-[#fce38a]">
        <div className="text-center bg-white/80 p-8 rounded-2xl shadow-xl backdrop-blur-sm">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-purple-700 font-bold">Preparando tu aventura...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#d4a5ff] via-[#8fd3f4] to-[#fce38a] p-4 pb-20 font-sans">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/40 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-lg bg-white flex items-center justify-center shrink-0">
            <img 
              src={avatarSrc} 
              alt="Avatar" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerText = user?.name?.charAt(0).toUpperCase();
                e.target.parentElement.classList.add('text-2xl', 'font-bold', 'text-gray-600');
              }}
            />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-800 leading-tight">¡Hola, {user?.name}! 🚀</h1>
            <p className="text-xs md:text-sm text-purple-600 font-bold animate-pulse">{phrase.phrase}</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-100 text-red-600 p-2.5 rounded-xl hover:bg-red-200 transition shadow-sm" title="Cerrar sesión">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* Panel de Puntos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Hoy', value: scores.daily, color: 'yellow' },
          { label: 'Semana', value: scores.weekly, color: 'green' },
          { label: 'Mes', value: scores.monthly, color: 'blue' },
          { label: 'Total', value: scores.total, color: 'purple' }
        ].map((stat) => (
          <div key={stat.label} className={`bg-${stat.color}-100/90 backdrop-blur-sm p-3 rounded-2xl text-center shadow-sm border border-${stat.color}-200 transform hover:-translate-y-1 transition duration-300`}>
            <p className={`text-${stat.color}-800 text-[10px] md:text-xs font-extrabold uppercase tracking-wider`}>{stat.label}</p>
            <p className={`text-2xl md:text-3xl font-black text-${stat.color}-600 mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Modal del Temporizador */}
      {activeTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl border-4 border-blue-100">
            <h2 className="text-2xl font-black mb-2 text-gray-800">{activeTask.title}</h2>
            <p className="text-gray-500 mb-6 font-medium">Concéntrate. ¡Tú puedes!</p>
            
            <div className={`text-6xl md:text-7xl font-mono font-black mb-8 tracking-wider ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
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
                <button onClick={handleCompleteTask} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl font-black hover:from-green-600 hover:to-emerald-700 transition shadow-lg transform hover:scale-105 active:scale-95 animate-bounce">
                  ¡TERMINÉ LA TAREA! ✅
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Columna Izquierda: Tareas */}
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/40">
          <h2 className="text-xl font-black mb-4 text-gray-800 flex items-center gap-2">
            <span className="text-2xl">📋</span> Mis Tareas
          </h2>
          
          {tasks.length === 0 ? (
            <div className="text-center py-12 bg-blue-50 rounded-xl border-2 border-dashed border-blue-200">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-gray-600 font-bold">¡Todo limpio! No hay tareas pendientes.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {tasks.map(task => {
                const isCompleted = Number(task.completed_today) > 0;
                return (
                  <div key={task.id} className={`relative overflow-hidden border-l-4 p-4 rounded-xl flex justify-between items-center transition-all duration-300 ${isCompleted ? 'bg-green-50 border-green-500 opacity-80' : 'bg-white border-blue-500 shadow-md hover:shadow-lg hover:-translate-y-1'}`}>
                    {isCompleted && <div className="absolute inset-0 bg-green-100/50 z-0"></div>}
                    
                    <div className="flex-1 relative z-10">
                      <h3 className={`font-bold text-gray-800 text-lg ${isCompleted ? 'line-through text-gray-500' : ''}`}>{task.title}</h3>
                      <p className="text-xs text-gray-600 mt-1 font-medium">⏱️ {task.duration_minutes} min | 🏆 {task.points} pts</p>
                      {isCompleted && (
                        <span className="inline-block mt-2 text-xs text-green-800 font-black bg-green-200 px-3 py-1 rounded-full">
                          ✓ ¡Completada!
                        </span>
                      )}
                    </div>
                    
                    {!isCompleted ? (
                      <button onClick={() => startTimer(task)} className="ml-4 relative z-10 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition text-sm font-bold shadow-md active:scale-95">
                        Iniciar
                      </button>
                    ) : (
                      <div className="ml-4 text-green-600 text-3xl relative z-10 drop-shadow-sm">✅</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Premios y Curiosidades */}
        <div className="space-y-6">
          {/* Premios */}
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/40">
            <h2 className="text-xl font-black mb-4 text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🎁</span> Mis Premios
            </h2>
            {prizes.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-500 text-sm font-medium">Papá/mamá aún no añade premios.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {prizes.map(prize => (
                  <div key={prize.id} className={`p-4 rounded-xl border-2 transition-all duration-300 ${prize.is_unlocked ? 'border-green-400 bg-gradient-to-r from-green-50 to-white shadow-md transform hover:scale-[1.02]' : 'border-gray-200 bg-gray-50 opacity-70 grayscale hover:grayscale-0 hover:opacity-100'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-black text-lg ${prize.is_unlocked ? 'text-green-800' : 'text-gray-700'}`}>{prize.title}</h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">{prize.description}</p>
                      </div>
                      <span className={`text-xs font-black px-3 py-1.5 rounded-full shadow-sm ${prize.is_unlocked ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {prize.required_points} pts
                      </span>
                    </div>
                    {prize.is_unlocked && (
                      <div className="mt-2 flex justify-end">
                        <span className="text-xs text-green-600 font-black bg-green-100 px-2 py-1 rounded-md animate-pulse">¡Desbloqueado! 🎉</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ¿Sabías qué? (Datos Neurodivergencia con Rotación) */}
          {neuroInfo.length > 0 && currentItem && (
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white transform transition-all hover:scale-[1.02]">
              {/* Decoración de fondo */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
              <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-yellow-400 opacity-20 rounded-full blur-xl"></div>
              
              <div className="relative z-10">
                <h3 className="font-black text-lg mb-3 flex items-center gap-2 uppercase tracking-wider text-indigo-100">
                  <span className="text-2xl">💡</span> ¿Sabías qué?
                </h3>
                
                <div className="min-h-[80px] flex flex-col justify-center transition-opacity duration-500">
                  <h4 className="font-bold text-xl mb-2 leading-tight text-yellow-300">{currentItem.title}</h4>
                  <p className="text-indigo-50 text-sm leading-relaxed font-medium">{currentItem.content}</p>
                </div>

                {/* Indicadores de paginación (Puntos) */}
                {neuroInfo.length > 1 && (
                  <div className="flex gap-2 mt-4 justify-center">
                    {neuroInfo.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentInfoIndex ? 'w-8 bg-yellow-400' : 'w-1.5 bg-indigo-300'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildDashboard;