const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de la base de datos
let pool;

async function initializeDatabase() {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Verificar conexión
        const connection = await pool.getConnection();
        console.log('✅ Conectado a MySQL exitosamente');
        connection.release();
    } catch (error) {
        console.error('❌ Error conectando a MySQL:', error.message);
        console.log('Asegúrate de tener MySQL corriendo y la base de datos creada');
    }
}

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
};

// Rutas de Autenticación
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role, parentId } = req.body;

        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, role, parent_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, parentId || null]
        );

        res.status(201).json({ 
            message: 'Usuario registrado exitosamente',
            userId: result.insertId 
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'El email ya está registrado' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                parentId: user.parent_id
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rutas para Tareas (solo padres pueden crear/editar)
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let query;
        let params;

        if (req.user.role === 'parent') {
            query = 'SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at DESC';
            params = [req.user.id];
        } else {
            query = `
                SELECT t.*, tp.status, tp.started_at, tp.completed_at, tp.points_earned
                FROM tasks t
                LEFT JOIN task_progress tp ON t.id = tp.task_id AND tp.child_id = ?
                WHERE t.parent_id = ? AND t.active = TRUE
                ORDER BY t.created_at DESC
            `;
            params = [req.user.id, req.user.parentId];
        }

        const [tasks] = await pool.query(query, params);
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ error: 'Solo los padres pueden crear tareas' });
        }

        const { title, description, duration_minutes, points } = req.body;

        const [result] = await pool.query(
            'INSERT INTO tasks (title, description, duration_minutes, points, parent_id) VALUES (?, ?, ?, ?, ?)',
            [title, description, duration_minutes, points || 10, req.user.id]
        );

        res.status(201).json({ 
            message: 'Tarea creada exitosamente',
            taskId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ error: 'Solo los padres pueden editar tareas' });
        }

        const { title, description, duration_minutes, points, active } = req.body;
        const taskId = req.params.id;

        await pool.query(
            'UPDATE tasks SET title = ?, description = ?, duration_minutes = ?, points = ?, active = ? WHERE id = ? AND parent_id = ?',
            [title, description, duration_minutes, points, active, taskId, req.user.id]
        );

        res.json({ message: 'Tarea actualizada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ error: 'Solo los padres pueden eliminar tareas' });
        }

        await pool.query(
            'DELETE FROM tasks WHERE id = ? AND parent_id = ?',
            [req.params.id, req.user.id]
        );

        res.json({ message: 'Tarea eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Progreso de tareas
app.post('/api/tasks/:taskId/start', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'child') {
            return res.status(403).json({ error: 'Solo los hijos pueden iniciar tareas' });
        }

        const taskId = req.params.taskId;

        // Crear o actualizar el progreso
        await pool.query(`
            INSERT INTO task_progress (task_id, child_id, status, started_at)
            VALUES (?, ?, 'in_progress', NOW())
            ON DUPLICATE KEY UPDATE status = 'in_progress', started_at = NOW()
        `, [taskId, req.user.id]);

        res.json({ message: 'Tarea iniciada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/complete', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'child') {
            return res.status(403).json({ error: 'Solo los hijos pueden completar tareas' });
        }

        const taskId = req.params.taskId;

        const [tasks] = await pool.query(
            'SELECT points FROM tasks WHERE id = ?',
            [taskId]
        );

        if (tasks.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const points = tasks[0].points;

        await pool.query(`
            UPDATE task_progress 
            SET status = 'completed', completed_at = NOW(), points_earned = ?
            WHERE task_id = ? AND child_id = ?
        `, [points, taskId, req.user.id]);

        res.json({ message: '¡Tarea completada!', points });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Puntajes del usuario
app.get('/api/scores', authenticateToken, async (req, res) => {
    try {
        const childId = req.user.role === 'child' ? req.user.id : req.params.childId;

        if (!childId) {
            return res.status(400).json({ error: 'ID de hijo requerido' });
        }

        // Puntos diarios
        const [daily] = await pool.query(`
            SELECT COALESCE(SUM(points_earned), 0) as total
            FROM task_progress
            WHERE child_id = ? AND DATE(completed_at) = CURDATE()
        `, [childId]);

        // Puntos semanales
        const [weekly] = await pool.query(`
            SELECT COALESCE(SUM(points_earned), 0) as total
            FROM task_progress
            WHERE child_id = ? AND YEARWEEK(completed_at) = YEARWEEK(NOW())
        `, [childId]);

        // Puntos mensuales
        const [monthly] = await pool.query(`
            SELECT COALESCE(SUM(points_earned), 0) as total
            FROM task_progress
            WHERE child_id = ? AND MONTH(completed_at) = MONTH(NOW())
        `, [childId]);

        // Total histórico
        const [total] = await pool.query(`
            SELECT COALESCE(SUM(points_earned), 0) as total
            FROM task_progress
            WHERE child_id = ?
        `, [childId]);

        res.json({
            daily: daily[0].total,
            weekly: weekly[0].total,
            monthly: monthly[0].total,
            total: total[0].total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rutas para Premios
app.get('/api/rewards', authenticateToken, async (req, res) => {
    try {
        const parentId = req.user.role === 'parent' ? req.user.id : req.user.parentId;

        const [rewards] = await pool.query(
            'SELECT * FROM rewards WHERE parent_id = ? AND active = TRUE ORDER BY reward_type, required_points',
            [parentId]
        );

        res.json(rewards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ error: 'Solo los padres pueden crear premios' });
        }

        const { title, description, required_points, reward_type } = req.body;

        const [result] = await pool.query(
            'INSERT INTO rewards (title, description, required_points, reward_type, parent_id) VALUES (?, ?, ?, ?, ?)',
            [title, description, required_points, reward_type, req.user.id]
        );

        res.status(201).json({ 
            message: 'Premio creado exitosamente',
            rewardId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Frases motivadoras
app.get('/api/motivational-phrases', async (req, res) => {
    try {
        const category = req.query.category || 'general';
        
        let query = 'SELECT * FROM motivational_phrases WHERE active = TRUE';
        let params = [];

        if (category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        const [phrases] = await pool.query(query, params);
        
        // Devolver una frase aleatoria
        const randomPhrase = phrases.length > 0 
            ? phrases[Math.floor(Math.random() * phrases.length)]
            : { phrase: '¡Tú puedes hacerlo!' };

        res.json(randomPhrase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Información sobre neurodivergencia
app.get('/api/neurodivergence-info', async (req, res) => {
    try {
        const category = req.query.category || 'all';
        
        let query = 'SELECT * FROM neurodivergence_info WHERE active = TRUE';
        let params = [];

        if (category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        const [info] = await pool.query(query, params);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener hijos (para padres)
app.get('/api/children', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ error: 'Solo los padres pueden ver esta información' });
        }

        const [children] = await pool.query(
            'SELECT id, name, email FROM users WHERE parent_id = ? AND role = "child"',
            [req.user.id]
        );

        res.json(children);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        console.log('📝 API endpoints disponibles:');
        console.log('   - POST /api/auth/register');
        console.log('   - POST /api/auth/login');
        console.log('   - GET  /api/tasks');
        console.log('   - POST /api/tasks');
        console.log('   - PUT  /api/tasks/:id');
        console.log('   - DELETE /api/tasks/:id');
        console.log('   - POST /api/tasks/:taskId/start');
        console.log('   - POST /api/tasks/:taskId/complete');
        console.log('   - GET  /api/scores');
        console.log('   - GET  /api/rewards');
        console.log('   - POST /api/rewards');
        console.log('   - GET  /api/motivational-phrases');
        console.log('   - GET  /api/neurodivergence-info');
        console.log('   - GET  /api/children');
    });
});
