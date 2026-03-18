-- Base de datos para la aplicación TDAH App
DROP TABLE IF EXISTS task_progress, rewards, scores, tasks, neurodiversity_info, users;

CREATE DATABASE IF NOT EXISTS tdah_app;
USE tdah_app;

-- Tabla de usuarios (padres e hijos)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('parent', 'child') NOT NULL,
    parent_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de tareas
CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL,
    points INT NOT NULL DEFAULT 10,
    parent_id INT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de progreso de tareas
CREATE TABLE task_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    child_id INT NOT NULL,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    points_earned INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de premios
CREATE TABLE rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    required_points INT NOT NULL,
    reward_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
    parent_id INT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de frases motivadoras
CREATE TABLE motivational_phrases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phrase TEXT NOT NULL,
    category ENUM('before_task', 'after_task', 'general') DEFAULT 'general',
    active BOOLEAN DEFAULT TRUE
);

-- Tabla de información sobre neurodivergencia
CREATE TABLE neurodivergence_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category ENUM('famous_people', 'curiosity', 'tip', 'general') DEFAULT 'general',
    active BOOLEAN DEFAULT TRUE
);

-- Insertar frases motivadoras por defecto
-- INSERT INTO motivational_phrases (phrase, category) VALUES
-- ('¡Tú puedes lograrlo! Confío en ti.', 'before_task'),
-- ('Cada pequeño paso cuenta. ¡Vamos!', 'before_task'),
-- ('Eres increíble y capaz de hacer cosas maravillosas.', 'before_task'),
-- ('Respira profundo y comienza. ¡Tú puedes!', 'before_task'),
-- ('¡Lo lograste! Estoy muy orgulloso/a de ti.', 'after_task'),
-- ('Has completado otra tarea. ¡Eres un campeón!', 'after_task'),
-- ('Tu esfuerzo vale la pena. ¡Sigue así!', 'after_task'),
-- ('Cada tarea completada te hace más fuerte.', 'after_task'),
-- ('Eres único y especial tal como eres.', 'general'),
-- ('Tu cerebro funciona de manera diferente, y eso es genial.', 'general'),
-- ('Las personas con TDAH tienen superpoderes creativos.', 'general'),
-- ('No hay límites para lo que puedes lograr.', 'general');

-- Insertar información sobre neurodivergencia
-- INSERT INTO neurodivergence_info (title, content, category) VALUES
-- ('Albert Einstein', 'El famoso físico teórico que desarrolló la teoría de la relatividad tenía características asociadas con el TDAH y dislexia. Su mente creativa y capacidad para pensar diferente revolucionaron la ciencia.', 'famous_people'),
-- ('Leonardo da Vinci', 'El genio del Renacimiento, artista, inventor y científico, mostraba características de TDAH. Su curiosidad insaciable y capacidad para hiperconcentrarse en sus proyectos son rasgos comunes en personas neurodivergentes.', 'famous_people'),
-- ('Mozart', 'El compositor austriaco Wolfgang Amadeus Mozart probablemente tenía TDAH. Su energía inagotable, creatividad desbordante y capacidad para crear música compleja son ejemplos del potencial neurodivergente.', 'famous_people'),
-- ('Thomas Edison', 'El inventor de la bombilla eléctrica tenía TDAH y dislexia. Fue considerado un estudiante "difícil" en la escuela, pero su perseverancia y pensamiento innovador lo llevaron a obtener más de 1,000 patentes.', 'famous_people'),
-- ('¿Sabías qué?', 'Las personas con TDAH suelen tener mayor creatividad y capacidad para pensar "fuera de la caja". Muchos emprendedores exitosos tienen TDAH.', 'curiosity'),
-- ('Hiperfocus', 'Aunque parezca contradictorio, las personas con TDAH pueden experimentar "hiperfocus", una concentración intensa en actividades que les interesan mucho.', 'curiosity'),
-- ('Dopamina', 'El cerebro con TDAH procesa la dopamina de manera diferente. Por eso las recompensas inmediatas y los temporizadores ayudan tanto a mantener la motivación.', 'curiosity'),
-- ('Consejo: Divide y vencerás', 'Divide las tareas grandes en pasos pequeños. Cada paso completado libera dopamina y te motiva a continuar.', 'tip'),
-- ('Consejo: Usa temporizadores', 'El método Pomodoro (25 min trabajo + 5 min descanso) funciona muy bien para cerebros con TDAH.', 'tip'),
-- ('Consejo: Movimiento', 'Incorporar movimiento físico ayuda a concentrarse. No es necesario estar quieto para aprender o trabajar.', 'tip');

-- Insertar algunos premios de ejemplo
-- INSERT INTO rewards (title, description, required_points, reward_type, parent_id) VALUES
-- ('Tiempo extra de pantalla', '30 minutos adicionales de tiempo para videojuegos o tablet', 50, 'daily', 1),
-- ('Elegir la cena', 'Puedes elegir qué cenaremos esta noche', 100, 'daily', 1),
-- ('Salida al parque', 'Iremos al parque o lugar que elijas', 300, 'weekly', 1),
-- ('Película familiar', 'Elegirás la película para ver en familia', 500, 'weekly', 1),
-- ('Juego nuevo o libro', 'Un juego de mesa nuevo o libro que quieras', 1000, 'monthly', 1),
-- ('Experiencia especial', 'Una salida o actividad especial que elijas', 2000, 'monthly', 1);
