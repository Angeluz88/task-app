require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_jwt_para_produccion_12345';

// --- CONFIGURACIÓN DE CORS ---
// Permitimos Vercel y localhost
const allowedOrigins = ['https://task-app-eight-inky.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como móviles o postman) y los de la lista
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// --- CONFIGURACIÓN DE BASE DE DATOS (SQLite) ---
const DB_PATH = path.join(__dirname, 'database.sqlite');
let db;

try {
  db = new Database(DB_PATH);
  console.log('✅ Conectado a SQLite en:', DB_PATH);
  
  // Habilitar claves foráneas
  db.pragma('foreign_keys = ON');

  // Inicializar Tablas
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'parent',
      pin_code TEXT,
      parent_id INTEGER,
      avatar_color TEXT DEFAULT '#3B82F6',
      FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      points INTEGER NOT NULL,
      created_by INTEGER,
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      points_earned INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(child_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      required_points INTEGER NOT NULL,
      reward_type TEXT DEFAULT 'daily',
      parent_id INTEGER,
      target_child_id INTEGER,
      FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS motivational_phrases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phrase TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS neurodivergence_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      active INTEGER DEFAULT 1
    );
  `);
  console.log('📦 Tablas verificadas/creadas.');

  // Seed Data (Solo si está vacío)
  const count = db.prepare('SELECT count() as count FROM motivational_phrases').get();
  if (count.count === 0) {
    console.log('🌱 Insertando datos de ejemplo...');
    const insertPhrase = db.prepare('INSERT INTO motivational_phrases (phrase, category) VALUES (?, ?)');
    insertPhrase.run('¡Tú puedes con esto! Confío en ti.', 'before_task');
    insertPhrase.run('¡Lo lograste! Estoy muy orgulloso de ti.', 'after_task');
    insertPhrase.run('Eres único y especial tal como eres.', 'general');
    
    const insertInfo = db.prepare('INSERT INTO neurodivergence_info (title, content, category) VALUES (?, ?, ?)');
    insertInfo.run('Famosos con TDAH', 'Einstein, Mozart y Disney tenían TDAH.', 'famous_people');
    insertInfo.run('Hiperfoco', 'La capacidad de concentrarse intensamente es un superpoder.', 'curiosity');
  }

} catch (error) {
  console.error('❌ Error fatal iniciando SQLite:', error.message);
  process.exit(1);
}

// --- MIDDLEWARE DE AUTENTICACIÓN ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Todos los campos son requeridos' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ message: 'El email ya está registrado' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hashedPassword, 'parent');

    const token = jwt.sign({ id: result.lastInsertRowid, role: 'parent' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Usuario registrado', token, user: { id: result.lastInsertRowid, name, email, role: 'parent' } });
  } catch (error) {
    console.error('Error registro:', error);
    res.status(500).json({ message: 'Error al registrar', error: error.message });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, 'parent');
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
});

// ==========================================
// RUTAS DE GESTIÓN DE HIJOS
// ==========================================

app.post('/api/children', (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  if (!name || !pin_code || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const existing = db.prepare('SELECT id FROM users WHERE parent_id = ? AND pin_code = ?').get(parent.id, pin_code);
    if (existing) return res.status(400).json({ message: 'PIN ya en uso' });

    const result = db.prepare(
      `INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES (?, ?, ?, ?, ?)`
    ).run(name, 'child', pin_code, avatar_color || '#3B82F6', parent.id);
    
    res.status(201).json({ message: 'Hijo creado', childId: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creando hijo:', error);
    res.status(500).json({ message: 'Error al crear hijo', error: error.message });
  }
});

app.post('/api/login-child', (req, res) => {
  const { identifier, parent_email } = req.body;
  if (!identifier || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const child = db.prepare(
      `SELECT id, name, avatar_color, role FROM users 
       WHERE parent_id = ? AND role = ? AND (pin_code = ? OR name = ?)`
    ).get(parent.id, 'child', identifier, identifier);

    if (!child) return res.status(401).json({ message: 'Hijo no encontrado' });

    const token = jwt.sign({ id: child.id, role: child.role, parent_id: parent.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: child, token });
  } catch (error) {
    console.error('Error login hijo:', error);
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
});

app.get('/api/my-children', (req, res) => {
  const parent_email = req.query.email;
  if (!parent_email) return res.status(400).json({ message: 'Email requerido' });

  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const children = db.prepare(
      'SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = ? AND role = ? ORDER BY name ASC'
    ).all(parent.id, 'child');
    res.json(children);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener hijos', error: error.message });
  }
});

app.delete('/api/children/:id', (req, res) => {
  const { id } = req.params;
  const { parent_email } = req.body;
  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const child = db.prepare('SELECT id FROM users WHERE id = ? AND parent_id = ?').get(id, parent.id);
    if (!child) return res.status(403).json({ message: 'No autorizado' });

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Hijo eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message });
  }
});

// ==========================================
// RUTAS DE TAREAS
// ==========================================

app.post('/api/tasks', authenticateToken, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });

  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;
  if (!title || !duration_minutes || !points || !assigned_to_child_id) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  try {
    const child = db.prepare('SELECT id FROM users WHERE id = ? AND parent_id = ?').get(assigned_to_child_id, req.user.id);
    if (!child) return res.status(403).json({ message: 'Hijo no válido' });

    const result = db.prepare(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id);

    res.status(201).json({ message: 'Tarea creada', taskId: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creando tarea:', error);
    res.status(500).json({ message: 'Error al crear tarea', error: error.message });
  }
});

app.get('/api/tasks/child/:childId', (req, res) => {
  const { childId } = req.params;
  try {
    // Calculamos la fecha de hoy en formato YYYY-MM-DD para SQLite
    const today = new Date().toISOString().slice(0, 10);
    
    const tasks = db.prepare(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
             (SELECT COUNT(*) FROM task_progress tp 
              WHERE tp.task_id = t.id AND tp.child_id = ? AND date(tp.completed_at) = ?) as completed_today
      FROM tasks t
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `).all(childId, today, childId);
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

app.get('/api/tasks', authenticateToken, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  try {
    const tasks = db.prepare(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = ?
      ORDER BY t.created_at DESC
    `).all(req.user.id);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

// ==========================================
// RUTAS DE PROGRESO (CORREGIDO PARA SQLITE)
// ==========================================

app.post('/api/tasks/complete', (req, res) => {
  const { task_id, child_id } = req.body;
  if (!task_id || !child_id) return res.status(400).json({ message: 'Datos requeridos' });

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    const existing = db.prepare(
      'SELECT id FROM task_progress WHERE task_id = ? AND child_id = ? AND date(completed_at) = ?'
    ).get(task_id, child_id, today);
    
    if (existing) return res.status(400).json({ message: 'Ya completada hoy' });

    const task = db.prepare('SELECT points FROM tasks WHERE id = ?').get(task_id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
    
    // Usamos datetime('now', 'localtime') para guardar la hora local del servidor
    db.prepare(
      'INSERT INTO task_progress (task_id, child_id, points_earned, completed_at) VALUES (?, ?, ?, datetime("now", "localtime"))'
    ).run(task_id, child_id, task.points);

    res.json({ message: '¡Tarea completada!', points_earned: task.points });
  } catch (error) {
    console.error('Error completando tarea:', error);
    res.status(500).json({ message: 'Error al completar tarea', error: error.message });
  }
});

app.get('/api/scores/:childId', (req, res) => {
  const { childId } = req.params;
  try {
    // Fechas para cálculos relativos (más seguro en SQLite que usar funciones SQL complejas)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
    
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStart = weekAgo.toISOString().slice(0, 19).replace('T', ' ');

    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthStart = monthAgo.toISOString().slice(0, 19).replace('T', ' ');

    const daily = db.prepare(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND date(completed_at) = date("now")'
    ).get(childId);

    const weekly = db.prepare(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= ?'
    ).get(childId, weekStart);

    const monthly = db.prepare(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= ?'
    ).get(childId, monthStart);

    const total = db.prepare(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ?'
    ).get(childId);

    res.json({
      daily: daily.total || 0,
      weekly: weekly.total || 0,
      monthly: monthly.total || 0,
      total: total.total || 0
    });
  } catch (error) {
    console.error('Error obteniendo puntajes:', error);
    res.status(500).json({ message: 'Error al obtener puntajes', error: error.message });
  }
});

// ==========================================
// RUTAS DE PREMIOS
// ==========================================

app.post('/api/prizes', authenticateToken, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  const { title, description, required_points, reward_type, target_child_id } = req.body;

  if (!title || !required_points || !reward_type) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const finalTargetId = target_child_id && target_child_id !== 'null' && target_child_id !== '' ? target_child_id : null;
    const result = db.prepare(
      'INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, description || '', required_points, reward_type, req.user.id, finalTargetId);
    
    res.status(201).json({ message: 'Premio creado', prizeId: result.lastInsertRowid });
  } catch (error) {
    console.error('Error SQL premio:', error);
    res.status(500).json({ message: 'Error al crear premio', error: error.message });
  }
});

app.get('/api/prizes/child/:childId', (req, res) => {
  const { childId } = req.params;
  try {
    const scoreData = db.prepare('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ?').get(childId);
    const currentPoints = scoreData.total || 0;

    const parentResult = db.prepare('SELECT parent_id FROM users WHERE id = ?').get(childId);
    if (!parentResult) return res.json([]);
    
    const prizes = db.prepare('SELECT * FROM rewards WHERE parent_id = ?').all(parentResult.parent_id);

    const processedPrizes = prizes.filter(prize => {
      if (prize.target_child_id !== null && prize.target_child_id !== undefined) {
        return parseInt(prize.target_child_id) === parseInt(childId);
      }
      return true;
    }).map(prize => ({ ...prize, is_unlocked: currentPoints >= prize.required_points }));

    res.json(processedPrizes);
  } catch (error) {
    console.error('Error obteniendo premios:', error);
    res.status(500).json({ message: 'Error al obtener premios', error: error.message });
  }
});

// ==========================================
// RUTAS DE INFORMACIÓN
// ==========================================

app.get('/api/phrases', (req, res) => {
  const { category } = req.query;
  try {
    let query = 'SELECT phrase FROM motivational_phrases WHERE active = 1';
    let phrases;
    
    if (category) {
      phrases = db.prepare(query + ' AND category = ?').all(category);
    } else {
      // SQLite no tiene ORDER BY RAND() nativo eficiente, pero funciona para pocos datos
      phrases = db.prepare(query + ' ORDER BY RANDOM() LIMIT 1').all();
    }
    
    if (phrases.length === 0) return res.json({ phrase: "¡Tú puedes hacerlo!" });
    res.json(phrases[Math.floor(Math.random() * phrases.length)]);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener frases', error: error.message });
  }
});

app.get('/api/neuro-info', (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT title, content, category FROM neurodivergence_info WHERE active = 1';
    if (type) {
      query += ' AND category = ?';
      var info = db.prepare(query).all(type);
    } else {
      var info = db.prepare(query).all();
    }
    res.json(info);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener información', error: error.message });
  }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💾 Base de datos SQLite lista.`);
});