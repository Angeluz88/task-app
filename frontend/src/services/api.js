import axios from 'axios';

// URL base de tu API (Asegúrate de que coincida con tu puerto backend)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Configuración básica de Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el Token automáticamente en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ==========================================
// AUTENTICACIÓN (PADRES)
// ==========================================

export const registerParent = async (name, email, password) => {
  const response = await api.post('/register', { name, email, password });
  return response.data;
};

export const loginParent = async (email, password) => {
  const response = await api.post('/login', { email, password });
  return response.data;
};

// ==========================================
// GESTIÓN DE HIJOS
// ==========================================

// Registrar un nuevo hijo (Solo Padres)
export const registerChild = async (childData) => {
  // childData: { name, pin_code, avatar_color }
  const parentEmail = localStorage.getItem('userEmail'); // Obtenemos el email del padre logueado
  
  if (!parentEmail) {
    throw new Error('No se encontró el email del padre. Inicia sesión nuevamente.');
  }

  const response = await api.post('/children', {
    ...childData,
    parent_email: parentEmail
  });
  return response.data;
};

// Login para Hijos (Sin contraseña, solo PIN o Nombre)
export const loginChild = async (identifier, parentEmail) => {
  const response = await api.post('/login-child', {
    identifier, // Puede ser el nombre o el PIN
    parent_email: parentEmail
  });
  return response.data;
};

// Obtener lista de hijos del padre logueado
export const getMyChildren = async () => {
  const parentEmail = localStorage.getItem('userEmail');
  
  if (!parentEmail) {
    throw new Error('Email del padre no encontrado');
  }

  const response = await api.get('/my-children', {
    params: { email: parentEmail }
  });
  return response.data;
};

// Eliminar un hijo
export const deleteChild = async (childId) => {
  const parentEmail = localStorage.getItem('userEmail');
  const response = await api.delete(`/children/${childId}`, {
    data: { parent_email: parentEmail } // Enviar email en el body para DELETE
  });
  return response.data;
};

// ==========================================
// TAREAS
// ==========================================

// Crear una nueva tarea (Padre)
export const createTask = async (taskData) => {
  // taskData: { title, description, duration_minutes, points, assigned_to_child_id }
  const response = await api.post('/tasks', taskData);
  return response.data;
};

// Obtener tareas asignadas a un hijo (Para el Dashboard del Hijo)
export const getChildTasks = async (childId) => {
  const response = await api.get(`/tasks/child/${childId}`);
  return response.data;
};

// Obtener todas las tareas creadas por el padre (Para ver el estado general)
export const getParentTasks = async () => {
  const response = await api.get('/tasks');
  return response.data;
};

// Completar una tarea (Hijo)
export const completeTask = async (taskId, childId) => {
  const response = await api.post('/tasks/complete', {
    task_id: taskId,
    child_id: childId
  });
  return response.data;
};

// ==========================================
// PUNTAJES Y PROGRESO
// ==========================================

// Obtener puntajes de un niño (Diario, Semanal, Mensual, Total)
export const getScores = async (childId) => {
  const response = await api.get(`/scores/${childId}`);
  return response.data;
};

// ==========================================
// PREMIOS
// ==========================================

// Crear un nuevo premio (Padre)
export const createPrize = async (prizeData) => {
  // prizeData: { title, description, required_points, reward_type, target_child_id }
  const response = await api.post('/prizes', prizeData);
  return response.data;
};

// Obtener premios disponibles para un niño
export const getChildPrizes = async (childId) => {
  const response = await api.get(`/prizes/child/${childId}`);
  return response.data;
};

// ==========================================
// CONTENIDO MOTIVACIONAL E INFO
// ==========================================

// Obtener una frase motivadora aleatoria
export const getMotivationalPhrase = async (category = null) => {
  const params = category ? { category } : {};
  const response = await api.get('/phrases', { params });
  return response.data;
};

// Obtener información sobre neurodivergencia
export const getNeuroInfo = async (type = null) => {
  const params = type ? { type } : {};
  const response = await api.get('/neuro-info', { params });
  return response.data;
};

export default api;