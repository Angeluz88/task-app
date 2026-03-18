
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_jwt_para_produccion_12345';

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de la Base de Datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'tdah_user',
  password: process.env.DB_PASSWORD || 'Password123',
  database: process.env.DB_NAME || 'tdah_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  // FORZAR ZONA HORARIA UTC-3 (Argentina/Uruguay/Chile, etc.)
  timezone: '-03:00' 
};

let pool;

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    console.log('✅ Conectado exitosamente a MySQL');
    
    // Verificar zona horaria activa
    const [rows] = await connection.query('SELECT @@global.time_zone as global_tz, @@session.time_zone as session_tz, NOW() as now_db');
    console.log('🕒 Hora DB:', rows[0].now_db);
    console.log('🌍 Zona Horaria Global:', rows[0].global_tz, '| Session:', rows[0].session_tz);
    
    connection.release();
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    setTimeout(initDB, 5000);
  }
}

initDB();

// Middleware de Autenticación
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
// RUTAS DE AUTENTICACIÓN (PADRES)
// ==========================================

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Todos los campos son requeridos' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ message: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "parent")',
      [name, email, hashedPassword]
    );

    const token = jwt.sign({ id: result.insertId, role: 'parent' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Usuario registrado', token, user: { id: result.insertId, name, email, role: 'parent' } });
  } catch (error) {
    console.error('Error registro:', error);
    res.status(500).json({ message: 'Error al registrar', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "parent"', [email]);
    if (users.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' });

    const user = users[0];
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
// RUTAS DE GESTIÓN DE HIJOS
// ==========================================

app.post('/api/children', async (req, res) => {
  const { name, pin_code, avatar_color, parent_email } = req.body;
  if (!name || !pin_code || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const [parents] = await pool.query('SELECT id FROM users WHERE email = ?', [parent_email]);
    if (parents.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parents[0].id;

    const [existing] = await pool.query('SELECT id FROM users WHERE parent_id = ? AND pin_code = ?', [parentId, pin_code]);
    if (existing.length > 0) return res.status(400).json({ message: 'PIN ya en uso' });

    const [result] = await pool.query(
      `INSERT INTO users (name, role, pin_code, avatar_color, parent_id) VALUES (?, 'child', ?, ?, ?)`,
      [name, pin_code, avatar_color || '#3B82F6', parentId]
    );
    res.status(201).json({ message: 'Hijo creado', childId: result.insertId });
  } catch (error) {
    console.error('Error creando hijo:', error);
    res.status(500).json({ message: 'Error al crear hijo', error: error.message });
  }
});

app.post('/api/login-child', async (req, res) => {
  const { identifier, parent_email } = req.body;
  if (!identifier || !parent_email) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const [parents] = await pool.query('SELECT id FROM users WHERE email = ?', [parent_email]);
    if (parents.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parents[0].id;

    const [children] = await pool.query(
      `SELECT id, name, avatar_color, role FROM users WHERE parent_id = ? AND role = 'child' AND (pin_code = ? OR name = ?)`,
      [parentId, identifier, identifier]
    );

    if (children.length === 0) return res.status(401).json({ message: 'Hijo no encontrado' });

    const child = children[0];
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
    const [parents] = await pool.query('SELECT id FROM users WHERE email = ?', [parent_email]);
    if (parents.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });

    const [children] = await pool.query(
      'SELECT id, name, avatar_color, pin_code FROM users WHERE parent_id = ? AND role = "child" ORDER BY name ASC',
      [parents[0].id]
    );
    res.json(children);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener hijos', error: error.message });
  }
});

app.delete('/api/children/:id', async (req, res) => {
  const { id } = req.params;
  const { parent_email } = req.body;
  try {
    const [parents] = await pool.query('SELECT id FROM users WHERE email = ?', [parent_email]);
    if (parents.length === 0) return res.status(404).json({ message: 'Padre no encontrado' });
    const parentId = parents[0].id;

    const [child] = await pool.query('SELECT id FROM users WHERE id = ? AND parent_id = ?', [id, parentId]);
    if (child.length === 0) return res.status(403).json({ message: 'No autorizado' });

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Hijo eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message });
  }
});

// ==========================================
// RUTAS DE TAREAS (CORREGIDO)
// ==========================================

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Solo padres' });

  const { title, description, duration_minutes, points, assigned_to_child_id } = req.body;

  if (!title || !duration_minutes || !points || !assigned_to_child_id) {
    return res.status(400).json({ message: 'Faltan datos requeridos (título, tiempo, puntos, hijo)' });
  }

  try {
    console.log(`[DEBUG TASKS] Padre ${req.user.id} intenta asignar tarea al hijo ${assigned_to_child_id}`);
    
    // Validar que el hijo pertenezca al padre
    const [children] = await pool.query('SELECT id FROM users WHERE id = ? AND parent_id = ?', [assigned_to_child_id, req.user.id]);
    if (children.length === 0) {
      console.error('[ERROR TASKS] El hijo no pertenece a este padre o no existe.');
      return res.status(403).json({ message: 'Hijo no válido o no pertenece a ti' });
    }

    const [result] = await pool.query(
      'INSERT INTO tasks (title, description, duration_minutes, points, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', parseInt(duration_minutes), parseInt(points), req.user.id, assigned_to_child_id]
    );

    console.log(`[ÉXITO TASKS] Tarea creada con ID: ${result.insertId}`);
    res.status(201).json({ message: 'Tarea creada', taskId: result.insertId });
  } catch (error) {
    console.error('Error SQL creando tarea:', error);
    res.status(500).json({ message: 'Error al crear tarea', error: error.message });
  }
});

app.get('/api/tasks/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const [tasks] = await pool.query(
      `SELECT t.id, t.title, t.description, t.duration_minutes, t.points, t.created_at,
              (SELECT COUNT(*) FROM task_progress tp WHERE tp.task_id = t.id AND tp.child_id = ? AND DATE(tp.completed_at) = CURDATE()) as completed_today
       FROM tasks t
       WHERE t.assigned_to = ?
       ORDER BY t.created_at DESC`,
      [childId, childId]
    );
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Acceso denegado' });
  try {
    const [tasks] = await pool.query(
      `SELECT t.id, t.title, t.description, t.duration_minutes, t.points, u.name as child_name, t.assigned_to
       FROM tasks t
       JOIN users u ON t.assigned_to = u.id
       WHERE t.created_by = ?
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
});

// ==========================================
// RUTAS DE PROGRESO (CORREGIDO CON RANGO DE FECHAS)
// ==========================================

app.post('/api/tasks/complete', async (req, res) => {
  const { task_id, child_id } = req.body;
  if (!task_id || !child_id) return res.status(400).json({ message: 'Datos requeridos' });

  try {
    // Verificar si ya completó hoy usando CURDATE()
    const [existing] = await pool.query(
      'SELECT id FROM task_progress WHERE task_id = ? AND child_id = ? AND DATE(completed_at) = CURDATE()',
      [task_id, child_id]
    );
    if (existing.length > 0) return res.status(400).json({ message: 'Ya completada hoy' });

    const [tasks] = await pool.query('SELECT points FROM tasks WHERE id = ?', [task_id]);
    if (tasks.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    
    const points = tasks[0].points;

    // Insertar con NOW() explícito para que use la zona horaria configurada
    await pool.query(
      'INSERT INTO task_progress (task_id, child_id, points_earned, completed_at) VALUES (?, ?, ?, NOW())', 
      [task_id, child_id, points]
    );

    console.log(`[ÉXITO PROGRESS] Tarea ${task_id} completada por niño ${child_id}. Puntos: ${points}`);
    res.json({ message: '¡Tarea completada!', points_earned: points });
  } catch (error) {
    console.error('Error completando tarea:', error);
    res.status(500).json({ message: 'Error al completar tarea', error: error.message });
  }
});

app.get('/api/scores/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    // CORRECCIÓN DEFINITIVA: Usar rango de fechas en lugar de DATE()
    // Esto evita problemas si la columna tiene hora y la función DATE() falla por TZ
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Formatear a string YYYY-MM-DD HH:MM:SS para MySQL
    const startStr = todayStart.toISOString().slice(0, 19).replace('T', ' ');
    const endStr = tomorrowStart.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`[DEBUG SCORES] Rango diario: Desde '${startStr}' hasta '${endStr}'`);

    const [daily] = await pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= ? AND completed_at < ?',
      [childId, startStr, endStr]
    );

    const [weekly] = await pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
      [childId]
    );

    const [monthly] = await pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ? AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
      [childId]
    );

    const [total] = await pool.query(
      'SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ?',
      [childId]
    );

    // Log de depuración
    console.log(`[DEBUG SCORES] Niño ${childId}: Diario=${daily[0].total}, Semanal=${weekly[0].total}, Mensual=${monthly[0].total}, Total=${total[0].total}`);

    res.json({
      daily: daily[0].total || 0,
      weekly: weekly[0].total || 0,
      monthly: monthly[0].total || 0,
      total: total[0].total || 0
    });
  } catch (error) {
    console.error('Error obteniendo puntajes:', error);
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
    const finalTargetId = target_child_id && target_child_id !== 'null' && target_child_id !== '' ? target_child_id : null;
    const [result] = await pool.query(
      'INSERT INTO rewards (title, description, required_points, reward_type, parent_id, target_child_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', required_points, reward_type, req.user.id, finalTargetId]
    );
    res.status(201).json({ message: 'Premio creado', prizeId: result.insertId });
  } catch (error) {
    console.error('Error SQL premio:', error);
    res.status(500).json({ message: 'Error al crear premio', error: error.message });
  }
});

app.get('/api/prizes/child/:childId', async (req, res) => {
  const { childId } = req.params;
  try {
    const [scoreData] = await pool.query('SELECT SUM(points_earned) as total FROM task_progress WHERE child_id = ?', [childId]);
    const currentPoints = scoreData[0].total || 0;

    const [parentResult] = await pool.query('SELECT parent_id FROM users WHERE id = ?', [childId]);
    if (parentResult.length === 0) return res.json([]);
    const parentId = parentResult[0].parent_id;

    const [prizes] = await pool.query('SELECT * FROM rewards WHERE parent_id = ?', [parentId]);

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
    const params = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    } else {
      query += ' ORDER BY RAND() LIMIT 1';
    }
    const [phrases] = await pool.query(query, params);
    if (phrases.length === 0) return res.json({ phrase: "¡Tú puedes hacerlo!" });
    res.json(phrases[Math.floor(Math.random() * phrases.length)]);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener frases', error: error.message });
  }
});

app.get('/api/neuro-info', async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT title, content, category FROM neurodivergence_info WHERE active = 1';
    const params = [];
    if (type) {
      query += ' AND category = ?';
      params.push(type);
    }
    const [info] = await pool.query(query, params);
    res.json(info);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener información', error: error.message });
  }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: ${dbConfig.database} (TZ: -03:00)`);
});