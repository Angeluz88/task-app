import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getMyChildren, 
  registerChild, 
  deleteChild, 
  createTask, 
  getParentTasks, 
  deleteTask,
  createPrize, 
  getChildPrizes,
  getScores,
  getNeuroInfo
} from '../services/api';

// Lista de Avatares Disponibles (Asegúrate que estos archivos existan en public/icons/)
const AVAILABLE_AVATARS = [
  { id: 'lobo', src: '/icons/lobo.png', name: 'Lobo' },
  { id: 'unicornio', src: '/icons/unicornio.png', name: 'Unicornio' },
  { id: 'elefante', src: '/icons/elefante.png', name: 'Elefante' },
  { id: 'gorila', src: '/icons/gorila.png', name: 'Gorila' },
  { id: 'panda', src: '/icons/panda.png', name: 'Panda' },
  { id: 'gato', src: '/icons/gato.png', name: 'Gato' },
  { id: 'oso', src: '/icons/oso.png', name: 'Oso' },
  { id: 'conejo', src: '/icons/conejo.png', name: 'Conejo' },
  { id: 'pinguino', src: '/icons/Pingüino.png', name: 'Pingüino' },
  { id: 'perro', src: '/icons/perro.png', name: 'Perro' },
  { id: 'vaca', src: '/icons/vaca.png', name: 'Vaca' },
  { id: 'jirafa', src: '/icons/jirafa.png', name: 'Jirafa' },
];

const ParentDashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('userEmail');
  const user = JSON.parse(localStorage.getItem('user'));

  // Estados Generales
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [neuroInfo, setNeuroInfo] = useState([]);

  // Estados para Agregar Hijo
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildPin, setNewChildPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0].id); // Guardamos el ID

  // Estados para Crear Tarea
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    duration_minutes: '',
    points: ''
  });

  // Estados para Crear Premio
  const [showAddPrize, setShowAddPrize] = useState(false);
  const [prizeForm, setPrizeForm] = useState({
    title: '',
    description: '',
    required_points: '',
    reward_type: 'daily'
  });

  // Estados para Visualización
  const [tasks, setTasks] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [childScores, setChildScores] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadChildren();
    loadNeuroInfo();
  }, []);

  // Cargar tareas/premios cuando cambia el hijo seleccionado
  useEffect(() => {
    if (selectedChildId) {
      loadChildData(selectedChildId);
    }
  }, [selectedChildId]);

  const loadChildren = async () => {
    try {
      const list = await getMyChildren();
      setChildren(list);
      if (list.length > 0 && !selectedChildId) {
        setSelectedChildId(list[0].id);
      }
    } catch (error) {
      console.error("Error cargando hijos:", error);
    }
  };

  const loadNeuroInfo = async () => {
    try {
      const info = await getNeuroInfo('tip');
      setNeuroInfo(info.slice(0, 2)); 
    } catch (error) {
      console.error("Error cargando info:", error);
    }
  };

  const loadChildData = async (childId) => {
    try {
      const [tasksData, prizesData, scoresData] = await Promise.all([
        getParentTasks(), 
        getChildPrizes(childId),
        getScores(childId)
      ]);
      
      setTasks(tasksData.filter(t => t.assigned_to == childId));
      setPrizes(prizesData);
      setChildScores(scoresData);
    } catch (error) {
      console.error("Error cargando datos del niño:", error);
    }
  };

  // --- Manejadores de Hijos ---
  const handleAddChild = async (e) => {
    e.preventDefault();
    try {
      // Enviamos el ID del avatar seleccionado (ej: 'lobo')
      // El backend lo guardará en avatar_icon o similar
      await registerChild({ 
        name: newChildName, 
        pin_code: newChildPin, 
        avatar_icon: selectedAvatar 
      });
      
      alert('¡Hijo agregado correctamente!');
      setShowAddChild(false);
      setNewChildName('');
      setNewChildPin('');
      setSelectedAvatar(AVAILABLE_AVATARS[0].id);
      loadChildren();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteChild = async (id, name) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${name}? Se borrarán sus tareas y progreso.`)) {
      try {
        await deleteChild(id);
        setChildren(children.filter(c => c.id !== id));
        if (selectedChildId === id) setSelectedChildId('');
        alert('Hijo eliminado');
      } catch (error) {
        alert('Error al eliminar: ' + error.message);
      }
    }
  };

  // --- Manejadores de Tareas ---
  const handleTaskChange = (e) => {
    setTaskForm({ ...taskForm, [e.target.name]: e.target.value });
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!selectedChildId) return alert('Selecciona un hijo primero');

    try {
      await createTask({
        ...taskForm,
        duration_minutes: Number(taskForm.duration_minutes),
        points: Number(taskForm.points),
        assigned_to_child_id: selectedChildId
      });
      
      alert('Tarea creada exitosamente');
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', duration_minutes: '', points: '' });
      loadChildData(selectedChildId);
    } catch (error) {
      console.error(error);
      alert('Error: ' + (error.response?.data?.message || 'Falló la creación'));
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (window.confirm(`¿Estás seguro de eliminar la tarea "${taskTitle}"?`)) {
      try {
        await deleteTask(taskId); 
        alert('Tarea eliminada');
        loadChildData(selectedChildId);
      } catch (error) {
        console.error(error);
        alert('Error al eliminar: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  // --- Manejadores de Premios ---
  const handlePrizeChange = (e) => {
    setPrizeForm({ ...prizeForm, [e.target.name]: e.target.value });
  };

  const handleCreatePrize = async (e) => {
    e.preventDefault();
    
    if (!prizeForm.title || !prizeForm.required_points) {
      return alert('Título y puntos son requeridos');
    }

    try {
      await createPrize({
        title: prizeForm.title,
        description: prizeForm.description,
        required_points: Number(prizeForm.required_points),
        reward_type: prizeForm.reward_type,
        target_child_id: selectedChildId || null
      });
      
      alert('¡Premio creado!');
      setShowAddPrize(false);
      setPrizeForm({ title: '', description: '', required_points: '', reward_type: 'daily' });
      loadChildData(selectedChildId);
    } catch (error) {
      console.error(error);
      alert('Error: ' + (error.response?.data?.message || 'Falló la creación del premio'));
    }
  };

  // Función auxiliar para obtener la URL del avatar
  const getAvatarUrl = (child) => {
    // Si el backend devuelve avatar_icon (nombre del archivo)
    if (child.avatar_icon) {
      const avatar = AVAILABLE_AVATARS.find(a => a.id === child.avatar_icon);
      return avatar ? avatar.src : '/icons/lobo.png'; // Fallback
    }
    // Fallback para datos antiguos si usabas avatar_color (opcional)
    return null; 
  };

  return (
    <div className="min-h-screen bg-liner-to-r from-cyan-500 to-blue-500 p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Panel de Control 👨‍👩‍👧‍👦</h1>
          <p className="text-xl text-gray-500">Bienvenido/a, {user?.name}</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Inicio
          </button>
          <button 
            onClick={onLogout}
            className="bg-red-50 text-red-600 px-5 py-2 rounded-lg hover:bg-red-100 font-medium transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-4 gap-6">
        
        {/* Columna Izquierda: Lista de Hijos */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg text-gray-800">Mis Hijos</h2>
              <button 
                onClick={() => setShowAddChild(!showAddChild)}
                className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition"
                title="Agregar hijo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {showAddChild && (
              <form onSubmit={handleAddChild} className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <input 
                  type="text" 
                  placeholder="Nombre" 
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  className="w-full mb-2 p-2 text-sm border rounded"
                  required
                />
                <input 
                  type="number" 
                  placeholder="PIN (4 dígitos)" 
                  maxLength="4"
                  value={newChildPin}
                  onChange={(e) => setNewChildPin(e.target.value)}
                  className="w-full mb-2 p-2 text-sm border rounded"
                  required
                />
                
                {/* Selector de Avatares */}
                <div className="mb-3">
                  <label className="block text-xs font-bold text-gray-700 mb-2">Elige un Avatar:</label>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 bg-white rounded border">
                    {AVAILABLE_AVATARS.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar.id)}
                        className={`flex flex-col items-center justify-center p-1 rounded transition ${
                          selectedAvatar === avatar.id 
                            ? 'bg-blue-100 ring-2 ring-blue-500 scale-105' 
                            : 'hover:bg-gray-100'
                        }`}
                        title={avatar.name}
                      >
                        <img 
                          src={avatar.src} 
                          alt={avatar.name} 
                          className="w-8 h-8 object-contain"
                        />
                        <span className="text-[9px] mt-1 text-center leading-tight truncate w-full">{avatar.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white text-xs py-2 rounded hover:bg-blue-700">Guardar</button>
                  <button type="button" onClick={() => setShowAddChild(false)} className="flex-1 bg-gray-300 text-gray-700 text-xs py-2 rounded">Cancelar</button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {children.map(child => {
                const avatarSrc = getAvatarUrl(child);
                return (
                  <div 
                    key={child.id} 
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition ${
                      selectedChildId === child.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-200 shadow-sm shrink-0">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={child.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-blue-600">{child.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="font-medium truncate max-w-100px">{child.name}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteChild(child.id, child.name); }}
                      className={`p-1 rounded hover:bg-red-200 ${
                        selectedChildId === child.id 
                          ? 'text-white hover:text-red-900' 
                          : 'text-gray-400 hover:text-red-600'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {children.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay hijos registrados.</p>}
            </div>
          </div>

          {/* Info Neurodivergencia */}
          <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
            <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
              <span>💡</span> Consejos TDAH
            </h3>
            <ul className="space-y-2">
              {neuroInfo.map((info, idx) => (
                <li key={idx} className="text-sm text-indigo-900 bg-white p-2 rounded shadow-sm">
                  <strong>{info.title}:</strong> {info.content}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Columna Derecha: Gestión */}
        <div className="lg:col-span-3">
          {!selectedChildId ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-300 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-lg">Selecciona un hijo para gestionar sus tareas y premios</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Resumen de Puntos */}
              {childScores && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-400">
                    <p className="text-xs text-gray-500 uppercase font-bold">Puntos Hoy</p>
                    <p className="text-2xl font-bold text-gray-800">{childScores.daily}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-400">
                    <p className="text-xs text-gray-500 uppercase font-bold">Esta Semana</p>
                    <p className="text-2xl font-bold text-gray-800">{childScores.weekly}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-400">
                    <p className="text-xs text-gray-500 uppercase font-bold">Este Mes</p>
                    <p className="text-2xl font-bold text-gray-800">{childScores.monthly}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-400">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Histórico</p>
                    <p className="text-2xl font-bold text-gray-800">{childScores.total}</p>
                  </div>
                </div>
              )}

              {/* Sección Tareas */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h2 className="font-bold text-lg text-gray-800">📋 Tareas Asignadas</h2>
                  <button 
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    {showAddTask ? 'Cancelar' : '+ Nueva Tarea'}
                  </button>
                </div>
                
                {showAddTask && (
                  <form onSubmit={handleCreateTask} className="p-5 bg-blue-50 border-b border-blue-100 grid md:grid-cols-2 gap-4">
                    <input name="title" value={taskForm.title} onChange={handleTaskChange} placeholder="Título (ej: Hacer cama)" className="p-2 border rounded w-full" required />
                    <input name="description" value={taskForm.description} onChange={handleTaskChange} placeholder="Descripción breve" className="p-2 border rounded w-full" />
                    <input type="number" name="duration_minutes" value={taskForm.duration_minutes} onChange={handleTaskChange} placeholder="Minutos" className="p-2 border rounded w-full" required />
                    <input type="number" name="points" value={taskForm.points} onChange={handleTaskChange} placeholder="Puntos" className="p-2 border rounded w-full" required />
                    <button type="submit" className="md:col-span-2 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold">Guardar Tarea</button>
                  </form>
                )}

                <div className="divide-y divide-gray-100">
                  {tasks.length === 0 ? (
                    <p className="p-6 text-center text-gray-400">No hay tareas creadas aún.</p>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className="p-4 flex justify-between items-center hover:bg-gray-50 group">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800">{task.title}</h4>
                          <p className="text-sm text-gray-500">{task.description}</p>
                          <div className="flex gap-3 mt-1 text-xs font-medium">
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">⏱️ {task.duration_minutes} min</span>
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">🏆 {task.points} pts</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleDeleteTask(task.id, task.title)}
                          className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Eliminar tarea"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sección Premios */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h2 className="font-bold text-lg text-gray-800">🎁 Premios Disponibles</h2>
                  <button 
                    onClick={() => setShowAddPrize(!showAddPrize)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                  >
                    {showAddPrize ? 'Cancelar' : '+ Nuevo Premio'}
                  </button>
                </div>

                {showAddPrize && (
                  <form onSubmit={handleCreatePrize} className="p-5 bg-purple-50 border-b border-purple-100 grid md:grid-cols-2 gap-4">
                    <input name="title" value={prizeForm.title} onChange={handlePrizeChange} placeholder="Título del premio" className="p-2 border rounded w-full" required />
                    <select name="reward_type" value={prizeForm.reward_type} onChange={handlePrizeChange} className="p-2 border rounded w-full">
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                    <input type="number" name="required_points" value={prizeForm.required_points} onChange={handlePrizeChange} placeholder="Puntos requeridos" className="p-2 border rounded w-full" required />
                    <input name="description" value={prizeForm.description} onChange={handlePrizeChange} placeholder="Descripción" className="p-2 border rounded w-full md:col-span-2" />
                    <button type="submit" className="md:col-span-2 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold">Guardar Premio</button>
                  </form>
                )}

                <div className="grid md:grid-cols-2 gap-4 p-5">
                  {prizes.length === 0 ? (
                    <p className="col-span-2 text-center text-gray-400">No hay premios configurados.</p>
                  ) : (
                    prizes.map(prize => (
                      <div key={prize.id} className={`border rounded-lg p-4 ${prize.is_unlocked ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-800">{prize.title}</h4>
                          <span className="text-xs font-bold bg-white px-2 py-1 rounded border">{prize.required_points} pts</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{prize.description}</p>
                        <span className="text-xs uppercase font-bold text-gray-400">{prize.reward_type}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;