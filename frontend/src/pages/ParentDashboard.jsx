import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css';

function ParentDashboard({ user, onLogout }) {
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [children, setChildren] = useState([]);
  const [scores, setScores] = useState({});
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [motivationalPhrase, setMotivationalPhrase] = useState(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    duration_minutes: 15,
    points: 10
  });

  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    required_points: 50,
    reward_type: 'daily'
  });

  useEffect(() => {
    loadTasks();
    loadRewards();
    loadChildren();
    loadMotivationalPhrase();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadRewards = async () => {
    try {
      const data = await api.getRewards();
      setRewards(data);
    } catch (error) {
      console.error('Error loading rewards:', error);
    }
  };

  const loadChildren = async () => {
    try {
      const data = await api.getChildren();
      setChildren(data);
      // Load scores for each child
      data.forEach(child => {
        loadScores(child.id);
      });
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };

  const loadScores = async (childId) => {
    try {
      const data = await api.getScores(childId);
      setScores(prev => ({ ...prev, [childId]: data }));
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  };

  const loadMotivationalPhrase = async () => {
    try {
      const data = await api.getMotivationalPhrase('general');
      setMotivationalPhrase(data);
    } catch (error) {
      console.error('Error loading phrase:', error);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.createTask(newTask);
      setNewTask({ title: '', description: '', duration_minutes: 15, points: 10 });
      setShowTaskModal(false);
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleCreateReward = async (e) => {
    e.preventDefault();
    try {
      await api.createReward(newReward);
      setNewReward({ title: '', description: '', required_points: 50, reward_type: 'daily' });
      setShowRewardModal(false);
      loadRewards();
    } catch (error) {
      console.error('Error creating reward:', error);
    }
  };

  const handleDeleteTask = async (id) => {
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
      try {
        await api.deleteTask(id);
        loadTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-brand">🧩 TDAH App - Padre</div>
        <div className="nav-links">
          <Link to="/parent" className={isActive('/parent') ? 'active' : ''}>Tareas</Link>
          <Link to="/parent/rewards" className={isActive('/parent/rewards') ? 'active' : ''}>Premios</Link>
          <Link to="/parent/scores" className={isActive('/parent/scores') ? 'active' : ''}>Puntajes</Link>
          <Link to="/parent/info" className={isActive('/parent/info') ? 'active' : ''}>Info TDAH</Link>
          <button onClick={onLogout} className="btn-logout">Cerrar Sesión</button>
        </div>
      </nav>

      <main className="main-content">
        {motivationalPhrase && (
          <div className="motivational-banner">
            💬 "{motivationalPhrase.phrase}"
          </div>
        )}

        <Routes>
          <Route path="/" element={
            <div className="tasks-section">
              <div className="section-header">
                <h2>📋 Tareas</h2>
                <button className="btn-primary" onClick={() => setShowTaskModal(true)}>
                  + Nueva Tarea
                </button>
              </div>

              <div className="cards-grid">
                {tasks.map(task => (
                  <div key={task.id} className="card task-card">
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    <div className="task-meta">
                      <span>⏱️ {task.duration_minutes} min</span>
                      <span>⭐ {task.points} pts</span>
                    </div>
                    <button 
                      className="btn-danger"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="empty-message">No hay tareas creadas aún.</p>
                )}
              </div>
            </div>
          } />

          <Route path="/rewards" element={
            <div className="rewards-section">
              <div className="section-header">
                <h2>🎁 Premios</h2>
                <button className="btn-primary" onClick={() => setShowRewardModal(true)}>
                  + Nuevo Premio
                </button>
              </div>

              <div className="cards-grid">
                {rewards.map(reward => (
                  <div key={reward.id} className={`card reward-card ${reward.reward_type}`}>
                    <span className="reward-badge">{reward.reward_type}</span>
                    <h3>{reward.title}</h3>
                    <p>{reward.description}</p>
                    <div className="reward-points">🌟 {reward.required_points} puntos</div>
                  </div>
                ))}
                {rewards.length === 0 && (
                  <p className="empty-message">No hay premios creados aún.</p>
                )}
              </div>
            </div>
          } />

          <Route path="/scores" element={
            <div className="scores-section">
              <h2>📊 Puntajes de tus Hijos</h2>
              <div className="cards-grid">
                {children.map(child => (
                  <div key={child.id} className="card score-card">
                    <h3>👤 {child.name}</h3>
                    {scores[child.id] && (
                      <div className="score-details">
                        <div className="score-item">
                          <span>📅 Hoy:</span>
                          <strong>{scores[child.id].daily} pts</strong>
                        </div>
                        <div className="score-item">
                          <span>📆 Esta semana:</span>
                          <strong>{scores[child.id].weekly} pts</strong>
                        </div>
                        <div className="score-item">
                          <span>📅 Este mes:</span>
                          <strong>{scores[child.id].monthly} pts</strong>
                        </div>
                        <div className="score-item total">
                          <span>🏆 Total:</span>
                          <strong>{scores[child.id].total} pts</strong>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {children.length === 0 && (
                  <p className="empty-message">No hay hijos registrados.</p>
                )}
              </div>
            </div>
          } />

          <Route path="/info" element={
            <NeurodivergenceInfo />
          } />
        </Routes>
      </main>

      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Crear Nueva Tarea</h2>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label>Título</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Duración (min)</label>
                  <input
                    type="number"
                    value={newTask.duration_minutes}
                    onChange={e => setNewTask({...newTask, duration_minutes: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Puntos</label>
                  <input
                    type="number"
                    value={newTask.points}
                    onChange={e => setNewTask({...newTask, points: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowTaskModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Crear Tarea</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRewardModal && (
        <div className="modal-overlay" onClick={() => setShowRewardModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Crear Nuevo Premio</h2>
            <form onSubmit={handleCreateReward}>
              <div className="form-group">
                <label>Título</label>
                <input
                  type="text"
                  value={newReward.title}
                  onChange={e => setNewReward({...newReward, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={newReward.description}
                  onChange={e => setNewReward({...newReward, description: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Puntos requeridos</label>
                  <input
                    type="number"
                    value={newReward.required_points}
                    onChange={e => setNewReward({...newReward, required_points: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={newReward.reward_type}
                    onChange={e => setNewReward({...newReward, reward_type: e.target.value})}
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowRewardModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Crear Premio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NeurodivergenceInfo() {
  const [info, setInfo] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadInfo();
  }, [filter]);

  const loadInfo = async () => {
    try {
      const data = await api.getNeurodivergenceInfo(filter);
      setInfo(data);
    } catch (error) {
      console.error('Error loading info:', error);
    }
  };

  return (
    <div className="info-section">
      <h2>🧠 Información sobre Neurodivergencia</h2>
      
      <div className="filter-buttons">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button>
        <button className={filter === 'famous_people' ? 'active' : ''} onClick={() => setFilter('famous_people')}>Famosos</button>
        <button className={filter === 'curiosity' ? 'active' : ''} onClick={() => setFilter('curiosity')}>Curiosidades</button>
        <button className={filter === 'tip' ? 'active' : ''} onClick={() => setFilter('tip')}>Consejos</button>
      </div>

      <div className="cards-grid">
        {info.map(item => (
          <div key={item.id} className={`card info-card ${item.category}`}>
            <span className="info-badge">{item.category}</span>
            <h3>{item.title}</h3>
            <p>{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ParentDashboard;
