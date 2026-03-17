const API_URL = 'http://localhost:3000/api';

const getToken = () => localStorage.getItem('token');

const api = {
  // Autenticación
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  },

  register: async (userData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return response.json();
  },

  // Tareas
  getTasks: async () => {
    const response = await fetch(`${API_URL}/tasks`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  },

  createTask: async (taskData) => {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(taskData)
    });
    return response.json();
  },

  updateTask: async (id, taskData) => {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(taskData)
    });
    return response.json();
  },

  deleteTask: async (id) => {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  },

  startTask: async (taskId) => {
    const response = await fetch(`${API_URL}/tasks/${taskId}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  },

  completeTask: async (taskId) => {
    const response = await fetch(`${API_URL}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  },

  // Puntajes
  getScores: async (childId = null) => {
    const url = childId ? `${API_URL}/scores/${childId}` : `${API_URL}/scores`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  },

  // Premios
  getRewards: async () => {
    const response = await fetch(`${API_URL}/rewards`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  },

  createReward: async (rewardData) => {
    const response = await fetch(`${API_URL}/rewards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(rewardData)
    });
    return response.json();
  },

  // Frases motivadoras
  getMotivationalPhrase: async (category = 'general') => {
    const response = await fetch(`${API_URL}/motivational-phrases?category=${category}`);
    return response.json();
  },

  // Información sobre neurodivergencia
  getNeurodivergenceInfo: async (category = 'all') => {
    const response = await fetch(`${API_URL}/neurodivergence-info?category=${category}`);
    return response.json();
  },

  // Hijos (para padres)
  getChildren: async () => {
    const response = await fetch(`${API_URL}/children`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return response.json();
  }
};

export default api;
