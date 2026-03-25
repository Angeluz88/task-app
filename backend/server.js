require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_jwt';

// --- CORS ---
const allowedOrigins = ['https://task-app-eight-inky.vercel.app', 'http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) callback(null, true);
    else callback(new Error('CORS bloqueado'));
  },
  credentials: true
}));
app.use(express.json());

// --- CONFIGURACIÓN NEON (POSTGRES) ---
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR CRÍTICO: Falta la variable DATABASE_URL en Render');
  process.exit(1);
}

console.log('🔄 Intentando conectar a Neon...');
console.log('🔗 URL (ocultando pass):', connectionString.split('@')[1]); 

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false } // Requerido para Neon
});

pool.on('connect', () => console.log('✅ Conexión establecida con Neon'));
pool.on('error', (err) => console.error('❌ Error inesperado en cliente PG:', err));

// Inicializar DB
async function initDB() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado exitosamente a Neon PostgreSQL');

    // Crear Tablas
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'parent',
        pin_code VARCHAR(10),
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        avatar_color VARCHAR(20) DEFAULT '#3B82F6'
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL,
        points INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_progress (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        points_earned INTEGER NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rewards (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        required_points INTEGER NOT NULL,
        reward_type VARCHAR(50) DEFAULT 'daily',
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        target_child_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS motivational_phrases (
        id SERIAL PRIMARY KEY,
        phrase TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS neurodivergence_info (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        active BOOLEAN DEFAULT true
      );
    `);
    console.log('📦 Tablas verificadas/creadas.');

    // Seed Data
    const countRes = await client.query('SELECT count(*) FROM motivational_phrases');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log('🌱 Insertando datos de ejemplo...');
      await client.query(`INSERT INTO motivational_phrases (phrase, category) VALUES 
        ('¡Tú puedes con esto!', 'before_task'),
        ('¡Lo lograste!', 'after_task'),
        ('Eres único', 'general')`);
      
      await client.query(`INSERT INTO neurodivergence_info (title, content, category) VALUES 
        ('Famosos con TDAH', 'Einstein y Disney tenían TDAH.', 'famous_people'),
        ('Hiperfoco', 'Un superpoder de concentración.', 'curiosity')`);
    }

  } catch (err) {
    console.error('❌ Error iniciando DB:', err.message);
    console.error('🔍 Detalles:', err.stack);
  } finally {
    if (client) client.release();
  }
}

initDB();

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// --- RUTAS (RESUMIDAS PARA BREVEDAD, LÓGICA IGUAL A ANTERIOR PERO CON SQL POSTGRES) ---

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email ya registrado' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hash, 'parent']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'parent']);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' });
    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Credenciales inválidas' });
    
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/children', async (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parentRes.rows[0].id;

    const exist = await pool.query('SELECT id FROM users WHERE parent_id = $1 AND pin_code = $2', [parentId, pin_code]);
    if (exist.rows.length > 0) return res.status(400).json({ message: 'PIN en uso' });

    const result = await pool.query(
      'INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, 'child', pin_code, avatar_color || '#3B82F6', parentId]
    );
    res.status(201).json({ childId: result.rows[0].id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    
    const result = await pool.query(
      `SELECT id, name, avatar_color, role FROM users 
       WHERE parent_id = $1 AND role = $2 AND (pin_code = $3 OR name = $3)`,
      [parentRes.rows[0].id, 'child', identifier]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'Hijo no encontrado' });
    
    const child = result.rows[0];
    const token = jwt.sign({ id: child.id, role: child.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: child, token });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/my-children', async (req, res) => {
  const { email } = req.query;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    
    const result = await pool.query(
      'SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = $1 AND role = $2 ORDER BY name',
      [parentRes.rows[0].id, 'child']
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/children/:id', async (req, res) => {
  const { id } = req.params;
  const { parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    
    await pool.query('DELETE FROM users WHERE id = $1 AND parent_id = $2', [id, parentRes.rows[0].id]);
    res.json({ message: 'Eliminado' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });
  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;
  try {
    const valid = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [assigned_to_child_id, req.user.id]);
    if (valid.rows.length === 0) return res.status(403).json({ message: 'Hijo no válido' });

    const result = await pool.query(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description, parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id]
    );
    res.status(201).json({ taskId: result.rows[0].id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
             (SELECT COUNT(*) FROM task_progress tp 
              WHERE tp.task_id = t.id AND tp.child_id = $1 AND DATE(tp.completed_at) = $2) as completed_today
      FROM tasks t WHERE t.assigned_to = $1 ORDER BY t.created_at DESC`, 
      [childId, today]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.description, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
       FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.created_by = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const exist = await pool.query(
      'SELECT id FROM task_progress WHERE task_id = $1 AND child_id = $2 AND DATE(completed_at) = $3',
      [task_id, child_id, today]
    );
    if (exist.rows.length > 0) return res.status(400).json({ message: 'Ya completada hoy' });

    const task = await pool.query('SELECT points FROM tasks WHERE id = $1', [task_id]);
    if (task.rows.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });

    await pool.query(
      'INSERT INTO task_progress (task_id, child_id, points_earned) VALUES ($1, $2, $3)',
      [task_id, child_id, task.rows[0].points]
    );
    res.json({ message: '¡Completada!', points_earned: task.rows[0].points });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/scores/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

    const daily = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND DATE(completed_at) = $2', [childId, today]);
    const weekly = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= $2', [childId, weekAgo]);
    const monthly = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= $2', [childId, monthAgo]);
    const total = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);

    res.json({
      daily: daily.rows[0]?.total || 0,
      weekly: weekly.rows[0]?.total || 0,
      monthly: monthly.rows[0]?.total || 0,
      total: total.rows[0]?.total || 0
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/prizes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  const { title, description, required_points, reward_type, target_child_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description, required_points, reward_type, req.user.id, target_child_id || null]
    );
    res.status(201).json({ prizeId: result.rows[0].id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/prizes/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const score = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);
    const currentPoints = score.rows[0]?.total || 0;

    const parentRes = await pool.query('SELECT parent_id FROM users WHERE id = $1', [childId]);
    if (parentRes.rows.length === 0) return res.json([]);

    const prizes = await pool.query('SELECT * FROM rewards WHERE parent_id = $1', [parentRes.rows[0].parent_id]);
    
    const processed = prizes.rows.filter(p => !p.target_child_id || p.target_child_id == childId)
      .map(p => ({ ...p, is_unlocked: currentPoints >= p.required_points }));
    
    res.json(processed);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/phrases', async (req, res) => {
  const { category } = req.query;
  try {
    let query = 'SELECT phrase FROM motivational_phrases WHERE active = true';
    let phrases;
    if (category) {
      phrases = await pool.query(query + ' AND category = $1', [category]);
    } else {
      phrases = await pool.query(query + ' ORDER BY RANDOM() LIMIT 1');
    }
    res.json(phrases.rows[0] || { phrase: "¡Tú puedes!" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/neuro-info', async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT title, content, category FROM neurodivergence_info WHERE active = true';
    let info;
    if (type) info = await pool.query(query + ' AND category = $1', [type]);
    else info = await pool.query(query);
    res.json(info.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});