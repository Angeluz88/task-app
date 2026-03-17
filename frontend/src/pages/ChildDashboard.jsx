import { useState, useEffect } from 'react';
import api from '../services/api';
import './Dashboard.css';

function ChildDashboard({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [scores, setScores] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [motivationalPhrase, setMotivationalPhrase] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    loadTasks();
    loadRewards();
    loadScores();
    loadMotivationalPhrase();
  }, []);

  useEffect(() => {
    let interval;
    if (activeTask && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && activeTask) {
      handleCompleteTask(activeTask.id);
    }
    return () => clearInterval(interval);
  }, [activeTask, timeLeft]);

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

  const loadScores = async () => {
    try {
      const data = await api.getScores();
      setScores(data);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  };

  const loadMotivationalPhrase = async () => {
    try {
      const data = await api.getMotivationalPhrase('before_task');
      setMotivationalPhrase(data);
    } catch (error) {
      console.error('Error loading phrase:', error);
    }
  };

  const handleStartTask = async (task) => {
    try {
      await api.startTask(task.id);
      setActiveTask(task);
      setTimeLeft(task.duration_minutes * 60);
    } catch (error) {
      console.error('Error starting task:', error);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const result = await api.completeTask(taskId);
      setShowCelebration(true);
      setActiveTask(null);
      setTimeLeft(0);
      setTimeout(() => setShowCelebration(false), 5000);
      loadTasks();
      loadScores();
      loadMotivationalPhrase();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!activeTask) return 0;
    const totalSeconds = activeTask.duration_minutes * 60;
    return ((totalSeconds - timeLeft) / totalSeconds) * 100;
  };

  return (
    <div className="dashboard child-dashboard">
      <nav className="navbar">
        <div className="nav-brand">🌟 TDAH App - ¡Hola {user.name}!</div>
        <div className="nav-links">
          <button onClick={onLogout} className="btn-logout">Cerrar Sesión</button>
        </div>
      </nav>

      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-content">
            <h1>🎉 ¡Felicidades! 🎉</h1>
            <p>¡Completaste la tarea!</p>
            <p className="celebration-points">+{activeTask?.points} puntos</p>
          </div>
        </div>
      )}

      <main className="main-content">
        {motivationalPhrase && (
          <div className="motivational-banner child-banner">
            💬 "{motivationalPhrase.phrase}"
          </div>
        )}

        {activeTask && (
          <div className="active-task-card">
            <h2>⏱️ Tarea en progreso: {activeTask.title}</h2>
            <div className="timer-display">
              <div className="timer-circle" style={{
                background: `conic-gradient(#667eea ${getProgressPercentage()}%, #e0e0e0 ${getProgressPercentage()}%)`
              }}>
                <div className="timer-time">{formatTime(timeLeft)}</div>
              </div>
            </div>
            <p>¡Tú puedes hacerlo! Sigue así.</p>
          </div>
        )}

        <section className="scores-section">
          <h2>🏆 Tus Puntajes</h2>
          {scores && (
            <div className="scores-display">
              <div className="score-box daily">
                <span className="score-label">📅 Hoy</span>
                <span className="score-value">{scores.daily}</span>
              </div>
              <div className="score-box weekly">
                <span className="score-label">📆 Semana</span>
                <span className="score-value">{scores.weekly}</span>
              </div>
              <div className="score-box monthly">
                <span className="score-label">📅 Mes</span>
                <span className="score-value">{scores.monthly}</span>
              </div>
              <div className="score-box total">
                <span className="score-label">🏆 Total</span>
                <span className="score-value">{scores.total}</span>
              </div>
            </div>
          )}
        </section>

        <section className="tasks-section">
          <h2>📋 Tus Tareas</h2>
          <div className="cards-grid">
            {tasks.filter(t => !t.status || t.status !== 'completed').map(task => (
              <div key={task.id} className="card task-card child-task">
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <div className="task-meta">
                  <span>⏱️ {task.duration_minutes} min</span>
                  <span>⭐ {task.points} pts</span>
                </div>
                <button 
                  className="btn-primary"
                  onClick={() => handleStartTask(task)}
                  disabled={!!activeTask}
                >
                  {activeTask ? 'En progreso...' : 'Comenzar'}
                </button>
              </div>
            ))}
            {tasks.filter(t => !t.status || t.status !== 'completed').length === 0 && (
              <p className="empty-message">¡No hay tareas pendientes! 🎉</p>
            )}
          </div>
        </section>

        <section className="rewards-section">
          <h2>🎁 Premios Disponibles</h2>
          <div className="cards-grid">
            {rewards.map(reward => (
              <div key={reward.id} className={`card reward-card ${reward.reward_type}`}>
                <span className="reward-badge">{reward.reward_type}</span>
                <h3>{reward.title}</h3>
                <p>{reward.description}</p>
                <div className="reward-points">🌟 {reward.required_points} puntos</div>
              </div>
            ))}
          </div>
        </section>

        <section className="info-section">
          <h2>🧠 ¿Sabías qué?</h2>
          <NeurodivergenceCuriosity />
        </section>
      </main>
    </div>
  );
}

function NeurodivergenceCuriosity() {
  const [curiosity, setCuriosity] = useState(null);

  useEffect(() => {
    loadCuriosity();
  }, []);

  const loadCuriosity = async () => {
    try {
      const data = await api.getNeurodivergenceInfo('curiosity');
      if (data.length > 0) {
        setCuriosity(data[Math.floor(Math.random() * data.length)]);
      }
    } catch (error) {
      console.error('Error loading curiosity:', error);
    }
  };

  if (!curiosity) return null;

  return (
    <div className="card info-card curiosity">
      <h3>{curiosity.title}</h3>
      <p>{curiosity.content}</p>
    </div>
  );
}

export default ChildDashboard;
