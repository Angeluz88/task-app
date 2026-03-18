require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3'); // Librería para SQLite
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_jwt_para_produccion_12345';

// Middleware
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN SQLITE ---
// En Render, usamos un archivo temporal porque el sistema de archivos es efímero
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/tdah.db' 
  : path.join(__dirname, 'tdah.db');

let db;

try {
  db = new Database(dbPath);
  console.log(`✅ Base de datos SQLite iniciada en: ${dbPath}`);
  
  // Habilitar claves foráneas
  db.pragma('foreign_keys = ON');

  // Crear tablas si no existen
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
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
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
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      child_id INTEGER,
      points_earned INTEGER,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      required_points INTEGER NOT NULL,
      reward_type TEXT,
      parent_id INTEGER,
      target_child_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_child_id) REFERENCES users(id) ON DELETE SET NULL
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
  console.log('📋 Tablas verificadas/creadas correctamente.');

  // Insertar datos de ejemplo si está vacío
  const count = db.prepare('SELECT count(*) as count FROM motivational_phrases').get();
  if (count.count === 0) {
    const insertPhrase = db.prepare('INSERT INTO motivational_phrases (phrase, category) VALUES (?, ?)');
    insertPhrase.run('¡Tú puedes con esto! Confío en ti.', 'before_task');
    insertPhrase.run('¡Lo lograste! Estoy muy orgulloso de ti.', 'after_task');
    insertPhrase.run('Eres único y especial tal como eres.', 'general');
    
    const insertInfo = db.prepare('INSERT INTO neurodivergence_info (title, content, category) VALUES (?, ?, ?)');
    insertInfo.run('Famosos con TDAH', 'Personas como Einstein y Disney tenían TDAH.', 'famous_people');
    insertInfo.run('Consejo: Movimiento', 'Moverse ayuda a concentrar la mente.', 'tip');
    console.log('🌱 Datos de ejemplo insertados.');
  }

} catch (error) {
  console.error('❌ Error fatal iniciando SQLite:', error.message);
  process.exit(1);
}

// Middleware de Autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ message: 'Email ya registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "parent")').run(name, email, hashedPassword);
    
    const token = jwt.sign({ id: result.lastInsertRowid, role: 'parent' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Usuario registrado', token, user: { id: result.lastInsertRowid, name, email, role: 'parent' } });
  } catch (error) {
    console.error('Error registro:', error);
    res.status(500).json({ message: 'Error al registrar', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND role = "parent"').get(email);
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
});

// ==========================================
// RUTAS DE HIJOS
// ==========================================

app.post('/api/children', async (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  if (!name || !pin_code || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const existing = db.prepare('SELECT id FROM users WHERE parent_id = ? AND pin_code = ?').get(parent.id, pin_code);
    if (existing) return res.status(400).json({ message: 'PIN ya en uso' });

    const result = db.prepare('INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES (?, "child", ?, ?, ?)').run(name, pin_code, avatar_color || '#3B82F6', parent.id);
    res.status(201).json({ message: 'Hijo creado', childId: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creando hijo:', error);
    res.status(500).json({ message: 'Error al crear hijo', error: error.message });
  }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  if (!identifier || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const child = db.prepare(`
      SELECT id, name, avatar_color, role FROM users 
      WHERE parent_id = ? AND role = 'child' AND (pin_code = ? OR name = ?)
    `).get(parent.id, identifier, identifier);

    if (!child) return res.status(401).json({ message: 'Hijo no encontrado' });

    const token = jwt.sign({ id: child.id, role: child.role, parent_id: parent.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: child, token });
  } catch (error) {
    console.error('Error login hijo:', error);
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
});

app.get('/api/my-children', async (req, res) => {
  const parent_email = req.query.email;
  if (!parent_email) return res.status(400).json({ message: 'Email requerido' });

  try {
    const parent = db.prepare('SELECT id FROM users WHERE email = ?').get(parent_email);
    if (!parent) return res.status(404).json({ message: 'Padre no encontrado' });

    const children = db.prepare('SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = ? AND role = "child" ORDER BY name ASC').all(parent.id);
    res.json(children);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener hijos', error: error.message });
  }
});

app.delete('/api/children/:id', async (req, res) => {
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

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });
  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;

  if (!title || !duration_minutes || !points || !assigned_to_child_id) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  try {
    const child = db.prepare('SELECT id FROM users WHERE id = ? AND parent_id = ?').get(assigned_to_child_id, req.user.id);
    if (!child) return res.status(403).json({ message: 'Hijo no válido' });

    const result = db.prepare('INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?)').run(title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id);
    res.status(201).json({ message: 'Tarea creada', taskId: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creando tarea:', error);
    res.status(500).json({ message: 'Error al crear tarea', error: error.message });
  }
});

app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const tasks = db.prepare(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
        (SELECT COUNT(*) FROM task_progress tp WHERE tp.task_id = t.id AND tp.child_id = ? AND date(tp.completed_at) = date('now')) as completed_today
      FROM tasks t
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `).all(childId, childId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
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
// RUTAS DE PROGRESO
// ==========================================

app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  if (!task_id || !child_id) return res.status(400).json({ message: 'Datos requeridos' });

  try {
    const existing = db.prepare('SELECT id FROM task_progress WHERE task_id = ? AND child_id = ? AND date(completed_at) = date("now")').get(task_id, child_id);
    if (existing) return res.status(400).json({ message: 'Ya completada hoy' });

    const task = db.prepare('SELECT points FROM tasks WHERE id = ?').get(task_id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    db.prepare('INSERT INTO task_progress (task_id, child_id, points_earned, completed_at) VALUES (?, ?, ?, datetime("now"))').run(task_id, child_id, task.points);
    res.json({ message: '¡Tarea completada!', points_earned: task.points });
  } catch (error) {
    console.error('Error completando tarea:', error);
    res.status(500).json({ message: 'Error al completar tarea', error: error.message });
  }
});

app.get('/api/scores/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const daily = db.prepare('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND date(completed_at) = date("now")').get(childId);
    const weekly = db.prepare('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= datetime("now", "-7 days")').get(childId);
    const monthly = db.prepare('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= datetime("now", "-30 days")').get(childId);
    const total = db.prepare('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ?').get(childId);

    res.json({
      daily: daily.total || 0,
      weekly: weekly.total || 0,
      monthly: monthly.total || 0,
      total: total.total || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener puntajes', error: error.message });
  }
});

// ==========================================
// RUTAS DE PREMIOS
// ==========================================

app.post('/api/prizes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  const { title, description, required_points, reward_type, target_child_id } = req.body;
  if (!title || !required_points || !reward_type) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const finalTargetId = target_child_id && target_child_id !== 'null' ? target_child_id : null;
    const result = db.prepare('INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES (?, ?, ?, ?, ?, ?)').run(title, description || '', required_points, reward_type, req.user.id, finalTargetId);
    res.status(201).json({ message: 'Premio creado', prizeId: result.lastInsertRowid });
  } catch (error) {
    console.error('Error SQL premio:', error);
    res.status(500).json({ message: 'Error al crear premio', error: error.message });
  }
});

app.get('/api/prizes/child/:childId', async (req, res) => {
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

app.get('/api/phrases', async (req, res) => {
  const { category } = req.query;
  try {
    let query = 'SELECT phrase FROM motivational_phrases WHERE active = 1';
    if (category) {
      const phrases = db.prepare(query + ' AND category = ?').all(category);
      if (phrases.length === 0) return res.json({ phrase: "¡Tú puedes hacerlo!" });
      return res.json(phrases[Math.floor(Math.random() * phrases.length)]);
    } else {
      const phrases = db.prepare(query + ' ORDER BY RANDOM() LIMIT 1').get();
      return res.json(phrases || { phrase: "¡Tú puedes hacerlo!" });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener frases', error: error.message });
  }
});

app.get('/api/neuro-info', async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT title, content, category FROM neurodivergence_info WHERE active = 1';
    if (type) {
      const info = db.prepare(query + ' AND category = ?').all(type);
      return res.json(info);
    } else {
      const info = db.prepare(query).all();
      return res.json(info);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener información', error: error.message });
  }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💾 Usando SQLite en: ${dbPath}`);
});