require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_jwt_para_produccion_12345';

// --- CORS ---
const allowedOrigins = ['https://task-app-eight-inky.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS bloqueado'));
  },
  credentials: true
}));
app.use(express.json());

// --- DB NEON (SSL Corregido) ---
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Falta DATABASE_URL');
  process.exit(1);
}

// Añadimos sslmode=verify-full explícitamente para quitar la warning
const connectionString = databaseUrl.includes('?') 
  ? `${databaseUrl}&sslmode=verify-full` 
  : `${databaseUrl}?sslmode=verify-full`;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

async function initDB() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a Neon (SSL verify-full)');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE,
        password VARCHAR(255), role VARCHAR(50) DEFAULT 'parent', pin_code VARCHAR(10),
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        avatar_color VARCHAR(20) DEFAULT '#3B82F6', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT,
        duration_minutes INTEGER NOT NULL, points INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS task_progress (
        id SERIAL PRIMARY KEY, task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        points_earned INTEGER NOT NULL, completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS rewards (
        id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT,
        required_points INTEGER NOT NULL, reward_type VARCHAR(50) DEFAULT 'daily',
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        target_child_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS motivational_phrases (id SERIAL PRIMARY KEY, phrase TEXT NOT NULL, category VARCHAR(50) DEFAULT 'general', active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS neurodivergence_info (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, category VARCHAR(50) DEFAULT 'general', active BOOLEAN DEFAULT true);
    `);

    const count = await client.query('SELECT COUNT(*) FROM motivational_phrases');
    if (parseInt(count.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO motivational_phrases (phrase, category) VALUES ('¡Tú puedes!', 'before_task'), ('¡Lo lograste!', 'after_task');
        INSERT INTO neurodivergence_info (title, content, category) VALUES ('TDAH', 'Superpoder de hiperfoco.', 'curiosity');
      `);
    }
  } catch (err) {
    console.error('❌ Error DB:', err.message);
    setTimeout(initDB, 5000);
  } finally {
    if (client) client.release();
  }
}
initDB();

// Middleware Auth
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// --- RUTAS ---

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) return res.status(400).json({ message: 'Email ya existe' });
    
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hash, 'parent']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'parent']);
    if (result.rows.length === 0 || !await bcrypt.compare(password, result.rows[0].password)) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/children', async (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  try {
    const p = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (!p.rows.length) return res.status(404).json({ message: 'Padre no encontrado' });
    const pid = p.rows[0].id;
    
    const exists = await pool.query('SELECT id FROM users WHERE parent_id = $1 AND pin_code = $2', [pid, pin_code]);
    if (exists.rows.length) return res.status(400).json({ message: 'PIN en uso' });

    const r = await pool.query(
      'INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, 'child', pin_code, avatar_color || '#3B82F6', pid]
    );
    res.json({ childId: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  try {
    const p = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (!p.rows.length) return res.status(404).json({ message: 'Padre no encontrado' });
    
    const r = await pool.query(
      `SELECT id, name, avatar_color, role FROM users 
       WHERE parent_id = $1 AND role = 'child' AND (pin_code = $2 OR name = $3)`,
      [p.rows[0].id, identifier, identifier]
    );
    if (!r.rows.length) return res.status(401).json({ message: 'Hijo no encontrado' });
    
    const child = r.rows[0];
    const token = jwt.sign({ id: child.id, role: child.role, parent_id: p.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: child, token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/my-children', async (req, res) => {
  const { email } = req.query;
  try {
    const p = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!p.rows.length) return res.status(404).json({ message: 'Padre no encontrado' });
    const r = await pool.query('SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = $1 AND role = $2', [p.rows[0].id, 'child']);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/children/:id', async (req, res) => {
  const { id } = req.params;
  const { parent_email } = req.body;
  try {
    const p = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (!p.rows.length) return res.status(404).json({ message: 'Padre no encontrado' });
    await pool.query('DELETE FROM users WHERE id = $1 AND parent_id = $2', [id, p.rows[0].id]);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });
  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;
  try {
    const valid = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [assigned_to_child_id, req.user.id]);
    if (!valid.rows.length) return res.status(403).json({ message: 'Hijo inválido' });
    
    const r = await pool.query(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id]
    );
    res.json({ taskId: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CORRECCIÓN DEFINITIVA DE FECHAS
app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    // Usamos DATE_TRUNC en UTC para obtener SOLO la fecha de hoy según el servidor DB
    // Y comparamos truncando también la fecha de completion. Esto elimina problemas de horas/minutos.
    const query = `
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
             CASE 
               WHEN EXISTS (
                 SELECT 1 FROM task_progress tp 
                 WHERE tp.task_id = t.id 
                 AND tp.child_id = $1 
                 AND DATE_TRUNC('day', tp.completed_at AT TIME ZONE 'UTC') = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
               ) THEN TRUE 
               ELSE FALSE 
             END as is_completed_today
      FROM tasks t
      WHERE t.assigned_to = $1
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query, [childId]);
    res.json(result.rows);
  } catch (e) {
    console.error("Error tareas:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  try {
    const r = await pool.query(
      `SELECT t.id, t.title, t.description, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
       FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.created_by = $1`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  try {
    // Verificación estricta en UTC
    const check = await pool.query(
      `SELECT id FROM task_progress 
       WHERE task_id = $1 AND child_id = $2 
       AND DATE_TRUNC('day', completed_at AT TIME ZONE 'UTC') = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`,
      [task_id, child_id]
    );
    
    if (check.rows.length > 0) return res.status(400).json({ message: 'Ya completada hoy' });

    const task = await pool.query('SELECT points FROM tasks WHERE id = $1', [task_id]);
    if (!task.rows.length) return res.status(404).json({ message: 'Tarea no encontrada' });

    await pool.query(
      'INSERT INTO task_progress (task_id, child_id, points_earned, completed_at) VALUES ($1, $2, $3, NOW())',
      [task_id, child_id, task.rows[0].points]
    );
    res.json({ message: '¡Completada!', points: task.rows[0].points });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scores/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const today = await pool.query(
      `SELECT SUM(points_earned) as total FROM task_progress 
       WHERE child_id = $1 AND DATE_TRUNC('day', completed_at AT TIME ZONE 'UTC') = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`,
      [childId]
    );
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    
    const weekly = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= $2', [childId, weekAgo]);
    const monthly = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= $2', [childId, monthAgo]);
    const total = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);

    res.json({
      daily: today.rows[0].total || 0,
      weekly: weekly.rows[0].total || 0,
      monthly: monthly.rows[0].total || 0,
      total: total.rows[0].total || 0
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/prizes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  const { title, description, required_points, reward_type, target_child_id } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', required_points, reward_type, req.user.id, target_child_id || null]
    );
    res.json({ prizeId: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/prizes/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const score = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);
    const currentPoints = score.rows[0].total || 0;
    
    const parent = await pool.query('SELECT parent_id FROM users WHERE id = $1', [childId]);
    if (!parent.rows.length) return res.json([]);
    
    const prizes = await pool.query('SELECT * FROM rewards WHERE parent_id = $1', [parent.rows[0].parent_id]);
    
    const processed = prizes.rows.filter(p => !p.target_child_id || p.target_child_id == childId)
                                  .map(p => ({ ...p, is_unlocked: currentPoints >= p.required_points }));
    res.json(processed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/phrases', async (req, res) => {
  try {
    const r = await pool.query('SELECT phrase FROM motivational_phrases WHERE active = true ORDER BY RANDOM() LIMIT 1');
    res.json(r.rows[0] || { phrase: "¡Tú puedes!" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/neuro-info', async (req, res) => {
  try {
    const r = await pool.query('SELECT title, content, category FROM neurodivergence_info WHERE active = true LIMIT 5');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server on port ${PORT}`);
});