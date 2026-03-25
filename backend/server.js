require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_jwt_para_produccion_12345';

// --- CONFIGURACIÓN DE CORS ---
const allowedOrigins = [
  'https://task-app-eight-inky.vercel.app', 
  'http://localhost:5173', 
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// --- CONFIGURACIÓN DE BASE DE DATOS (Neon PostgreSQL) ---
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ ERROR CRÍTICO: No se encontró DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

// Inicializar DB
async function initDB() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a Neon PostgreSQL (UTC)');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'parent',
        pin_code VARCHAR(10),
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        avatar_color VARCHAR(20) DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        target_child_id INTEGER REFERENCES users(id) ON DELETE SET NULL
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
    
    const countRes = await client.query('SELECT COUNT(*) FROM motivational_phrases');
    if (parseInt(countRes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO motivational_phrases (phrase, category) VALUES 
        ('¡Tú puedes con esto!', 'before_task'),
        ('¡Lo lograste!', 'after_task');
        INSERT INTO neurodivergence_info (title, content, category) VALUES 
        ('Hiperfoco', 'Es un superpoder.', 'curiosity');
      `);
      console.log('🌱 Datos iniciales insertados.');
    }
  } catch (error) {
    console.error('❌ Error DB:', error.message);
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
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email ya registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, 'parent']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/children', async (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parentRes.rows[0].id;

    const result = await pool.query(
      'INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, 'child', pin_code, avatar_color || '#3B82F6', parentId]
    );
    res.status(201).json({ childId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    
    const result = await pool.query(
      `SELECT id, name, avatar_color, role FROM users 
       WHERE parent_id = $1 AND role = 'child' AND (pin_code = $2 OR name = $3)`,
      [parentRes.rows[0].id, identifier, identifier]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'Hijo no encontrado' });
    
    const child = result.rows[0];
    const token = jwt.sign({ id: child.id, role: child.role, parent_id: parentRes.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: child, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/my-children', async (req, res) => {
  const { email } = req.query;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    
    const result = await pool.query(
      'SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = $1 AND role = $2 ORDER BY name ASC',
      [parentRes.rows[0].id, 'child']
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/children/:id', async (req, res) => {
  const { id } = req.params;
  const { parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    
    await pool.query('DELETE FROM users WHERE id = $1 AND parent_id = $2', [id, parentRes.rows[0].id]);
    res.json({ message: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });
  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id]
    );
    res.status(201).json({ taskId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ CORRECCIÓN DEFINITIVA: Usar DATE_TRUNC en UTC para comparar solo el día
app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
             (SELECT COUNT(*) FROM task_progress tp 
              WHERE tp.task_id = t.id 
                AND tp.child_id = $1 
                AND DATE_TRUNC('day', tp.completed_at AT TIME ZONE 'UTC') = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
             ) as completed_today
      FROM tasks t
      WHERE t.assigned_to = $1
      ORDER BY t.created_at DESC
    `, [childId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
      FROM tasks t JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = $1 ORDER BY t.created_at DESC`, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ CORRECCIÓN DEFINITIVA: Insertar y verificar usando UTC
app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  try {
    // Verificar si ya completó HOY (en UTC)
    const checkRes = await pool.query(`
      SELECT id FROM task_progress 
      WHERE task_id = $1 AND child_id = $2 
        AND DATE_TRUNC('day', completed_at AT TIME ZONE 'UTC') = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
    `, [task_id, child_id]);

    if (checkRes.rows.length > 0) return res.status(400).json({ message: 'Ya completada hoy' });

    const taskRes = await pool.query('SELECT points FROM tasks WHERE id = $1', [task_id]);
    if (taskRes.rows.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });

    await pool.query(
      'INSERT INTO task_progress (task_id, child_id, points_earned, completed_at) VALUES ($1, $2, $3, NOW())',
      [task_id, child_id, taskRes.rows[0].points]
    );

    res.json({ message: '¡Tarea completada!', points_earned: taskRes.rows[0].points });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/scores/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const daily = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= $2', [childId, todayStart]);
    const weekly = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= $2', [childId, weekAgo]);
    const total = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);

    res.json({
      daily: daily.rows[0].total || 0,
      weekly: weekly.rows[0].total || 0,
      monthly: weekly.rows[0].total || 0, // Simplificado para el ejemplo
      total: total.rows[0].total || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/prizes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  const { title, description, required_points, reward_type, target_child_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', required_points, reward_type, req.user.id, target_child_id || null]
    );
    res.status(201).json({ prizeId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/prizes/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const scoreRes = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);
    const currentPoints = scoreRes.rows[0].total || 0;
    const parentRes = await pool.query('SELECT parent_id FROM users WHERE id = $1', [childId]);
    if (parentRes.rows.length === 0) return res.json([]);
    
    const prizesRes = await pool.query('SELECT * FROM rewards WHERE parent_id = $1', [parentRes.rows[0].parent_id]);
    const processed = prizesRes.rows.map(p => ({ ...p, is_unlocked: currentPoints >= p.required_points }));
    res.json(processed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/phrases', async (req, res) => {
  const result = await pool.query('SELECT phrase FROM motivational_phrases WHERE active = true ORDER BY RANDOM() LIMIT 1');
  res.json(result.rows[0] || { phrase: "¡Tú puedes!" });
});

app.get('/api/neuro-info', async (req, res) => {
  const result = await pool.query('SELECT title, content FROM neurodivergence_info WHERE active = true LIMIT 1');
  res.json(result.rows);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});