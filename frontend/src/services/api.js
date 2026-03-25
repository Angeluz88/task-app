import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- Autenticación ---
export const registerParent = async (name, email, password) => {
  const response = await api.post('/register', { name, email, password });
  return response.data;
};

export const loginParent = async (email, password) => {
  const response = await api.post('/login', { email, password });
  return response.data;
};

// --- Gestión de Hijos ---
export const registerChild = async (childData) => {
  const parentEmail = localStorage.getItem('userEmail');
  if (!parentEmail) throw new Error('No se encontró el email del padre');
  
  const response = await api.post('/children', { ...childData, parent_email: parentEmail });
  return response.data;
};

export const loginChild = async (identifier, parentEmail) => {
  const response = await api.post('/login-child', { identifier, parent_email: parentEmail });
  return response.data;
};

export const getMyChildren = async () => {
  const parentEmail = localStorage.getItem('userEmail');
  if (!parentEmail) throw new Error('Email del padre no encontrado');
  
  const response = await api.get('/my-children', { params: { email: parentEmail } });
  return response.data;
};

export const deleteChild = async (childId) => {
  const parentEmail = localStorage.getItem('userEmail');
  const response = await api.delete(`/children/${childId}`, { data: { parent_email: parentEmail } });
  return response.data;
};

// --- Tareas ---
export const createTask = async (taskData) => {
  const response = await api.post('/tasks', taskData);
  return response.data;
};

// NUEVA FUNCIÓN: Eliminar tarea
export const deleteTask = async (taskId) => {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
};

export const getChildTasks = async (childId) => {
  const response = await api.get(`/tasks/child/${childId}`);
  return response.data;
};

export const getParentTasks = async () => {
  const response = await api.get('/tasks');
  return response.data;
};

export const completeTask = async (taskId, childId) => {
  const response = await api.post('/tasks/complete', { task_id: taskId, child_id: childId });
  return response.data;
};

// --- Puntajes ---
export const getScores = async (childId) => {
  const response = await api.get(`/scores/${childId}`);
  return response.data;
};

// --- Premios ---
export const createPrize = async (prizeData) => {
  const response = await api.post('/prizes', prizeData);
  return response.data;
};

export const getChildPrizes = async (childId) => {
  const response = await api.get(`/prizes/child/${childId}`);
  return response.data;
};

// --- Información ---
export const getMotivationalPhrase = async (category = null) => {
  const params = category ? { category } : {};
  const response = await api.get('/phrases', { params });
  return response.data;
};

export const getNeuroInfo = async (type = null) => {
  const params = type ? { type } : {};
  const response = await api.get('/neuro-info', { params });
  return response.data;
};

export default api;