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
const allowedOrigins = ['https://task-app-eight-inky.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para Neon
  }
});

// Función de inicio de DB con logs detallados
async function initDB() {
  try {
    console.log('🔄 Intentando conectar a Neon...');
    const client = await pool.connect();
    console.log('✅ Conectado exitosamente a Neon PostgreSQL');
    
    // Crear Tablas si no existen
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

    // Seed Data (Frases)
    const countRes = await client.query('SELECT count(*) FROM motivational_phrases');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log('🌱 Insertando datos de ejemplo...');
      await client.query(`INSERT INTO motivational_phrases (phrase, category) VALUES 
        ('¡Tú puedes con esto! Confío en ti.', 'before_task'),
        ('¡Lo lograste! Estoy muy orgulloso de ti.', 'after_task'),
        ('Eres único y especial tal como eres.', 'general')
      `);
      await client.query(`INSERT INTO neurodivergence_info (title, content, category) VALUES 
        ('Famosos con TDAH', 'Einstein, Mozart y Disney tenían TDAH.', 'famous_people'),
        ('Hiperfoco', 'La capacidad de concentrarse intensamente es un superpoder.', 'curiosity')
      `);
    }

    client.release();
  } catch (error) {
    console.error('❌ Error fatal iniciando DB:', error.message);
    console.error('Detalles:', error);
    // No salir del proceso para que Render no entre en loop infinito, pero marcar error
  }
}

initDB();

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
// RUTAS (Adaptadas a sintaxis PostgreSQL)
// ==========================================

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Todos los campos son requeridos' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, 'parent']
    );

    const token = jwt.sign({ id: result.rows[0].id, role: 'parent' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Usuario registrado', token, user: { id: result.rows[0].id, name, email, role: 'parent' } });
  } catch (error) {
    console.error('Error registro:', error);
    res.status(500).json({ message: 'Error al registrar', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'parent']);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
});

// HIJOS
app.post('/api/children', async (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  if (!name || !pin_code || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parentRes.rows[0].id;

    const existing = await pool.query('SELECT id FROM users WHERE parent_id = $1 AND pin_code = $2', [parentId, pin_code]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'PIN ya en uso' });

    const result = await pool.query(
      `INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, 'child', pin_code, avatar_color || '#3B82F6', parentId]
    );
    res.status(201).json({ message: 'Hijo creado', childId: result.rows[0].id });
  } catch (error) {
    console.error('Error creando hijo:', error);
    res.status(500).json({ message: 'Error al crear hijo', error: error.message });
  }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  if (!identifier || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parentRes.rows[0].id;

    const childRes = await pool.query(
      `SELECT id, name, avatar_color, role FROM users 
       WHERE parent_id = $1 AND role = $2 AND (pin_code = $3 OR name = $3)`,
      [parentId, 'child', identifier]
    );

    if (childRes.rows.length === 0) return res.status(401).json({ message: 'Hijo no encontrado' });
    const child = childRes.rows[0];

    const token = jwt.sign({ id: child.id, role: child.role, parent_id: parentId }, JWT_SECRET, { expiresIn: '7d' });
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
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });

    const children = await pool.query(
      'SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = $1 AND role = $2 ORDER BY name ASC',
      [parentRes.rows[0].id, 'child']
    );
    res.json(children.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener hijos', error: error.message });
  }
});

app.delete('/api/children/:id', async (req, res) => {
  const { id } = req.params;
  const { parent_email } = req.body;
  try {
    const parentRes = await pool.query('SELECT id FROM users WHERE email = $1', [parent_email]);
    if (parentRes.rows.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });

    const child = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [id, parentRes.rows[0].id]);
    if (child.rows.length === 0) return res.status(403).json({ message: 'No autorizado' });

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Hijo eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message });
  }
});

// TAREAS
app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });
  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;
  if (!title || !duration_minutes || !points || !assigned_to_child_id) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  try {
    const child = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [assigned_to_child_id, req.user.id]);
    if (child.rows.length === 0) return res.status(403).json({ message: 'Hijo no válido' });

    const result = await pool.query(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id]
    );
    res.status(201).json({ message: 'Tarea creada', taskId: result.rows[0].id });
  } catch (error) {
    console.error('Error creando tarea:', error);
    res.status(500).json({ message: 'Error al crear tarea', error: error.message });
  }
});

app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await pool.query(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
             (SELECT COUNT(*) FROM task_progress tp 
              WHERE tp.task_id = t.id AND tp.child_id = $1 AND DATE(tp.completed_at) = $2) as completed_today
      FROM tasks t
      WHERE t.assigned_to = $1
      ORDER BY t.created_at DESC
    `, [childId, today]);
    res.json(tasks.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  try {
    const tasks = await pool.query(`
      SELECT t.id, t.title, t.description, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = $1
      ORDER BY t.created_at DESC
    `, [req.user.id]);
    res.json(tasks.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

// PROGRESO
app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  if (!task_id || !child_id) return res.status(400).json({ message: 'Datos requeridos' });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await pool.query(
      'SELECT id FROM task_progress WHERE task_id = $1 AND child_id = $2 AND DATE(completed_at) = $3',
      [task_id, child_id, today]
    );
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya completada hoy' });

    const task = await pool.query('SELECT points FROM tasks WHERE id = $1', [task_id]);
    if (task.rows.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    
    await pool.query(
      'INSERT INTO task_progress (task_id, child_id, points_earned, completed_at) VALUES ($1, $2, $3, NOW())',
      [task_id, child_id, task.rows[0].points]
    );
    res.json({ message: '¡Tarea completada!', points_earned: task.rows[0].points });
  } catch (error) {
    console.error('Error completando tarea:', error);
    res.status(500).json({ message: 'Error al completar tarea', error: error.message });
  }
});

app.get('/api/scores/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const daily = await pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND DATE(completed_at) = CURRENT_DATE',
      [childId]
    );
    const weekly = pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= NOW() - INTERVAL ', '7 days', '',
      [childId]
    );
    const monthly = pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1 AND completed_at >= NOW() - INTERVAL ', '30 days', '',
      [childId]
    );
    const total = await pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1',
      [childId]
    );

    res.json({
      daily: daily.rows[0].total || 0,
      weekly: weekly.rows[0].total || 0,
      monthly: monthly.rows[0].total || 0,
      total: total.rows[0].total || 0
    });
  } catch (error) {
    console.error('Error obteniendo puntajes:', error);
    res.status(500).json({ message: 'Error al obtener puntajes', error: error.message });
  }
});

// PREMIOS
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
    console.error('Error SQL premio:', error);
    res.status(500).json({ message: 'Error al crear premio', error: error.message });
  }
});

app.get('/api/prizes/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const scoreData = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = $1', [childId]);
    const currentPoints = scoreData.rows[0].total || 0;

    const parentResult = await pool.query('SELECT parent_id FROM users WHERE id = $1', [childId]);
    if (parentResult.rows.length === 0) return res.json([]);
    
    const prizes = await pool.query('SELECT * FROM rewards WHERE parent_id = $1', [parentResult.rows[0].parent_id]);

    const processedPrizes = prizes.rows.filter(prize => {
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

// INFO
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
    if (phrases.rows.length === 0) return res.json({ phrase: "¡Tú puedes hacerlo!" });
    res.json(phrases.rows[Math.floor(Math.random() * phrases.rows.length)]);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener frases', error: error.message });
  }
});

app.get('/api/neuro-info', async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT title, content, category FROM neurodivergence_info WHERE active = true';
    let info;
    if (type) {
      info = await pool.query(query + ' AND category = $1', [type]);
    } else {
      info = await pool.query(query);
    }
    res.json(info.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener información', error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💾 Conectado a Neon PostgreSQL`);
});