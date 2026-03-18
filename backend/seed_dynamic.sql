-- ==========================================
-- SEED DATA: Frases, Info Neurodivergencia y Recompensas
-- ==========================================

-- 1. FRASES MOTIVADORAS
INSERT IGNORE INTO motivational_phrases (phrase, category, active) VALUES
('¡Tú puedes con esto! Confío en ti.', 'before_task', 1),
('Respira hondo y empieza paso a paso.', 'before_task', 1),
('Tu esfuerzo es increíble, sigue así.', 'before_task', 1),
('Cada pequeño paso cuenta mucho.', 'before_task', 1),
('¡Lo lograste! Estoy muy orgulloso de ti.', 'after_task', 1),
('¡Eres un campeón! Mira todo lo que hiciste.', 'after_task', 1),
('Tu dedicación hoy fue espectacular.', 'after_task', 1),
('¡Excelente trabajo! Te ganaste un descanso.', 'after_task', 1),
('Eres único y especial tal como eres.', 'general', 1),
('Tu cerebro funciona de una manera maravillosa.', 'general', 1),
('Los errores son parte de aprender, ¡sigue intentando!', 'general', 1),
('Tienes superpoderes para resolver problemas.', 'general', 1);

-- 2. INFORMACIÓN SOBRE NEURODIVERGENCIA
-- Corregido: Usamos 'category' en lugar de 'type' y los valores correctos del ENUM
INSERT IGNORE INTO neurodivergence_info (title, content, category) VALUES
('Famosos con TDAH', '¿Sabías que personas como Albert Einstein, Mozart, Walt Disney y Adam Levine tienen TDAH? Su creatividad y energía fueron clave para su éxito.', 'famous_people'),
('El Superpoder del Hiperfoco', 'Muchas personas con TDAH pueden concentrarse intensamente en cosas que les apasionan. Esto se llama hiperfoco y puede ser una gran ventaja.', 'curiosity'),
('Creatividad Sin Límites', 'El cerebro TDAH suele pensar "fuera de la caja", generando ideas innovadoras que otros no ven.', 'curiosity'),
('Grandes Emprendedores', 'Estudios muestran que las personas con TDAH tienen más probabilidades de ser emprendedores debido a su tolerancia al riesgo y creatividad.', 'famous_people'),
('Consejo: Movimiento', 'Moverse mientras se estudia o trabaja (como usar una pelota de yoga o caminar) puede ayudar a concentrar mejor la mente.', 'tip'),
('Consejo: Temporizadores', 'Usar temporizadores visuales ayuda a entender el paso del tiempo y hace que las tareas sean menos abrumadoras.', 'tip');

-- 3. RECOMPENSAS AUTOMÁTICAS
-- Se vinculan automáticamente al primer usuario con rol 'parent' encontrado
INSERT INTO rewards (title, description, required_points, reward_type, parent_id)
SELECT 'Tiempo Extra de Pantalla', '30 minutos adicionales de videojuegos o tablet.', 50, 'daily', id FROM users WHERE role = 'parent' LIMIT 1
ON DUPLICATE KEY UPDATE title=title;

INSERT INTO rewards (title, description, required_points, reward_type, parent_id)
SELECT 'Ir al Parque', 'Una tarde jugando en el parque favorito.', 150, 'weekly', id FROM users WHERE role = 'parent' LIMIT 1
ON DUPLICATE KEY UPDATE title=title;

INSERT INTO rewards (title, description, required_points, reward_type, parent_id)
SELECT 'Película en Familia', 'Elegir la película del viernes por la noche.', 200, 'weekly', id FROM users WHERE role = 'parent' LIMIT 1
ON DUPLICATE KEY UPDATE title=title;

INSERT INTO rewards (title, description, required_points, reward_type, parent_id)
SELECT 'Juguete Pequeño', 'Un juguete o libro de la lista de deseos.', 500, 'monthly', id FROM users WHERE role = 'parent' LIMIT 1
ON DUPLICATE KEY UPDATE title=title;

INSERT INTO rewards (title, description, required_points, reward_type, parent_id)
SELECT 'Salida Especial', 'Ir a comer helado o a un lugar divertido solo contigo.', 300, 'monthly', id FROM users WHERE role = 'parent' LIMIT 1
ON DUPLICATE KEY UPDATE title=title;

INSERT INTO rewards (title, description, required_points, reward_type, parent_id)
SELECT 'Noche de Juegos', 'Elegir los juegos de mesa de la noche familiar.', 100, 'weekly', id FROM users WHERE role = 'parent' LIMIT 1
ON DUPLICATE KEY UPDATE title=title;