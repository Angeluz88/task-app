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
    console.log('📦 Tablas listas.');

    const countRes = await client.query('SELECT COUNT(*) FROM motivational_phrases');
    if (parseInt(countRes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO motivational_phrases (phrase, category) VALUES 
        ('¡Tú puedes!', 'before_task'), ('¡Lo lograste!', 'after_task'), ('Eres único', 'general');
        INSERT INTO neurodivergence_info (title, content, category) VALUES 
        ('Famosos con TDAH', 'Einstein y Disney tenían TDAH.', 'famous_people');
      `);
    }
  } catch (error) {
    console.error('❌ Error DB:', error.message);
    setTimeout(initDB, 5000);
  } finally {
    if (client) client.release();
  }
}
initDB();

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

// --- RUTAS ---

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Faltan datos' });
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
    res.status(201).json({ message: 'Registrado', token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Faltan datos' });
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
  if (!name || !pin_code || !parent_email) return res.status(400).json({ message: 'Faltan datos' });
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parentRes.rows[0].id;
    const existing = await pool.query('SELECT id FROM users WHERE parent_id = $1 AND pin_code = $2', [parentId, pin_code]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'PIN en uso' });
    const result = await pool.query(
      'INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, 'child', pin_code, avatar_color || '#3B82F6', parentId]
    );
    res.status(201).json({ message: 'Hijo creado', childId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  if (!identifier || !parent_email) return res.status(400).json({ message: 'Faltan datos' });
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parentRes.rows[0].id;
    const result = await pool.query(
      'SELECT id, name, avatar_color, role FROM users WHERE parent_id = $1 AND role = $2 AND (pin_code = $3 OR name = $4)',
      [parentId, 'child', identifier, identifier]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'Hijo no encontrado' });
    const child = result.rows[0];
    const token = jwt.sign({ id: child.id, role: child.role, parent_id: parentId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: child, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/my-children', async (req, res) => {
  const parent_email = req.query.email;
  if (!parent_email) return res.status(400).json({ message: 'Email requerido' });
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
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
    const childRes = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [id, parentRes.rows[0].id]);
    if (childRes.rows.length === 0) return res.status(403).json({ message: 'No autorizado' });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });
  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;
  if (!title || !duration_minutes || !points || !assigned_to_child_id) return res.status(400).json({ message: 'Faltan datos' });
  try {
    const childRes = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [assigned_to_child_id, req.user.id]);
    if (childRes.rows.length === 0) return res.status(403).json({ message: 'Hijo no válido' });
    const result = await pool.query(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id]
    );
    res.status(201).json({ message: 'Tarea creada', taskId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ CORRECCIÓN DEFINITIVA: Usar DATE_TRUNC en SQL para comparar solo el DÍA
app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    // La consulta compara el día de 'completed_at' con el día de 'NOW()' en el servidor
    const result = await pool.query(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
             (SELECT COUNT(*) FROM task_progress tp 
              WHERE tp.task_id = t.id 
                AND tp.child_id = $1 
                AND DATE_TRUNC('day', tp.completed_at) = DATE_TRUNC('day', NOW())) as completed_today
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
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
      FROM tasks t JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = $1 ORDER BY t.created_at DESC`, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ CORRECCIÓN DEFINITIVA: Insertar y verificar usando DATE_TRUNC
app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  if (!task_id || !child_id) return res.status(400).json({ message: 'Datos requeridos' });

  try {
    // Verificar si ya existe un registro HOY según el reloj del servidor
    const existing = await pool.query(
      `SELECT id FROM task_progress 
       WHERE task_id = $1 AND child_id = $2 
       AND DATE_TRUNC('day', completed_at) = DATE_TRUNC('day', NOW())`,
      [task_id, child_id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Ya completada hoy' });
    }

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
    // Puntaje diario: mismo día que hoy
    const daily = await pool.query(
      `SELECT SUM(points_earned) as total FROM task_progress 
       WHERE child_id = $1 AND DATE_TRUNC('day', completed_at) = DATE_TRUNC('day', NOW())`,
      [childId]
    );
    // Semanal: últimos 7 días
    const weekly = await pool.query(
      `SELECT SUM(points_earned) as total FROM task_progress 
       WHERE child_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'`,
      [childId]
    );
    // Mensual: últimos 30 días
    const monthly = await pool.query(
      `SELECT SUM(points_earned) as total FROM task_progress 
       WHERE child_id = $1 AND completed_at >= NOW() - INTERVAL '30 days'`,
      [childId]
    );
    // Total
    const total = await pool.query(
      `SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1`,
      [childId]
    );

    res.json({
      daily: daily.rows[0].total || 0,
      weekly: weekly.rows[0].total || 0,
      monthly: monthly.rows[0].total || 0,
      total: total.rows[0].total || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/prizes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  const { title, description, required_points, reward_type, target_child_id } = req.body;
  if (!title || !required_points || !reward_type) return res.status(400).json({ message: 'Faltan datos' });
  try {
    const finalTargetId = target_child_id && target_child_id !== 'null' && target_child_id !== '' ? target_child_id : null;
    const result = await pool.query(
      'INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', required_points, reward_type, req.user.id, finalTargetId]
    );
    res.status(201).json({ message: 'Premio creado', prizeId: result.rows[0].id });
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
    const processedPrizes = prizesRes.rows.filter(prize => {
      if (prize.target_child_id !== null && prize.target_child_id !== undefined) {
        return parseInt(prize.target_child_id) === parseInt(childId);
      }
      return true;
    }).map(prize => ({ ...prize, is_unlocked: currentPoints >= prize.required_points }));
    res.json(processedPrizes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/phrases', async (req, res) => {
  const { category } = req.query;
  try {
    let query = 'SELECT phrase FROM motivational_phrases WHERE active = true';
    let params = [];
    if (category) {
      query += ' AND category = $1';
      params.push(category);
    } else {
      query += ' ORDER BY RANDOM() LIMIT 1';
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.json({ phrase: "¡Tú puedes hacerlo!" });
    res.json(result.rows[Math.floor(Math.random() * result.rows.length)]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/neuro-info', async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT title, content, category FROM neurodivergence_info WHERE active = true';
    let params = [];
    if (type) {
      query += ' AND category = $1';
      params.push(type);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});