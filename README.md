# 🧠 Task App TDAH - Sistema de Gestión de Tareas Gamificado

Una aplicación web progresiva (PWA) diseñada para ayudar a niños con **TDAH** (Trastorno por Déficit de Atención e Hiperactividad) a gestionar sus tareas diarias mediante gamificación, temporizadores visuales y un sistema de recompensas motivador.

El objetivo es transformar la rutina diaria en una aventura, aprovechando los mecanismos de dopamina mediante puntos, premios y refuerzo positivo, mientras se ofrece a los padres herramientas de seguimiento y consejos expertos.

## 🚀 Características Principales

### 👨‍👩‍👧‍👦 Para los Padres

- **Gestión de Hijos**: Registro ilimitado con selección de **avatares personalizados** (animales).
- **Creación de Tareas**: Asigna tareas con tiempo estimado, descripción y puntos de recompensa.
- **Sistema de Premios**: Configura premios canjeables por puntos (diarios, semanales, mensuales).
- **Seguimiento en Tiempo Real**: Visualiza puntajes acumulados (hoy, semana, mes, total).
- **Consejos Rotativos**: Panel dinámico con consejos sobre neurodivergencia que cambian automáticamente cada 10 segundos.
- **Control Total**: Edita o elimina tareas y gestiona el progreso de cada hijo.

### 🧒 Para los Niños

- **Interfaz Gamificada**: Diseño colorido, amigable y libre de distracciones.
- **Temporizador Visual**: Herramienta integrada (Técnica Pomodoro adaptada) para fomentar el hiperfoco.
- **Recompensas Inmediatas**: Gana puntos al completar tareas y desbloquea premios visuales.
- **Motivación Constante**: Frases aleatorias y sección **"¿Sabías qué?"** con datos curiosos sobre ventajas del TDAH (creatividad, energía, etc.) que rotan automáticamente.
- **Acceso Rápido**: Login seguro mediante nombre o PIN de 4 dígitos.
- **Avatar Personalizado**: Se identifica con su animal favorito elegido por sus padres.

## 🛠️ Tecnologías Utilizadas

### Frontend

- **React**: Biblioteca principal para la interfaz de usuario.
- **Vite**: Build tool rápido y moderno.
- **Tailwind CSS**: Estilizado ágil, responsivo y con diseño personalizado.
- **React Router DOM**: Navegación fluida entre vistas (Padres/Hijos).
- **Axios**: Cliente HTTP para comunicación con la API.
- **PWA**: Configuración para instalación en móviles y funcionamiento offline básico.

### Backend & Base de Datos

- **Node.js & Express**: Servidor API RESTful robusto.
- **PostgreSQL (Neon)**: Base de datos relacional en la nube (Serverless) para persistencia de datos real.
- **JWT (jsonwebtoken)**: Autenticación segura por roles.
- **Bcryptjs**: Encriptación de contraseñas.
- **CORS**: Gestión de seguridad para peticiones cruzadas.

### Infraestructura & Despliegue

- **Frontend**: [Vercel](https://vercel.com) (CDN global, HTTPS automático).
- **Backend**: [Render](https://render.com) (Hosting de servicios Node.js).
- **Base de Datos**: [Neon](https://neon.tech) (PostgreSQL Serverless gratuito).
- **Control de Versiones**: Git & GitHub.

## 📂 Estructura del Proyecto

```text
task-app/
├── backend/
│   ├── server.js          # Lógica del servidor, rutas API y conexión a Neon
│   ├── .env               # Variables de entorno (DATABASE_URL, JWT_SECRET)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Vistas principales (Login, ParentDashboard, ChildDashboard)
│   │   ├── services/      # Conexión con API (api.js)
│   │   └── App.jsx        # Enrutador principal con HashRouter
│   ├── public/
│   │   └── icons/         # Avatares de animales (PNG)
│   └── package.json
├── README.md
└── .gitignore

⚙️ Instalación Local (Desarrollo)

Sigue estos pasos para correr el proyecto en tu máquina:
1. Clonar el repositorio

bash:
git clone https://github.com/TU_USUARIO/task-app.git
cd task-app

2. Configurar Backend
Necesitas una URL de conexión de PostgreSQL (puedes obtener una gratis en Neon).

bash:
cd backend
npm install

Crea un archivo .env en la carpeta backend con:

env:
PORT=3000
DATABASE_URL=tu_conexion_de_neon_postgres?sslmode=require
JWT_SECRET=tu_secreto_seguro

3. Configurar Frontend
Abre una nueva terminal:

bash:
cd frontend
npm install

Crea un archivo .env en la carpeta frontend con:

env:
VITE_API_URL=http://localhost:3000/api


4. Ejecutar la aplicación
En la terminal del backend:

bash:
npm start

Deberías ver: "✅ Conectado exitosamente a Neon PostgreSQL"


En la terminal del frontend:

bash:
npm run dev

Accede a http://localhost:5173 en tu navegador.

Nota: La primera vez que inicies el backend, creará automáticamente las tablas en tu base de datos e insertará datos de ejemplo (frases y consejos).

🌐 Enlaces de Producción
Frontend: https://task-app-eight-inky.vercel.app
Backend: https://tdah-backend.onrender.com
Base de Datos: Neon PostgreSQL

⚠️ Nota sobre Render Free: El plan gratuito de Render puede tardar unos 30-50 segundos en "despertar" si la aplicación ha estado inactiva. Es normal.

🔒 Seguridad

Las contraseñas se encriptan con bcrypt antes de guardarse.
La autenticación se maneja mediante tokens JWT con expiración de 7 días.
Las rutas están protegidas por middleware que valida el rol del usuario (Padre/Hijo).
La base de datos utiliza conexiones SSL seguras obligatorias.
Validación de CORS restringida solo al dominio de producción y localhost.

🎨 Personalización

Avatares: Puedes agregar más iconos en frontend/public/icons/ y actualizar la lista AVAILABLE_AVATARS en ParentDashboard.jsx.
Consejos y Frases: Se almacenan en la base de datos (neurodivergence_info y motivational_phrases). Puedes editarlos directamente en tu panel de Neon o agregar scripts de seed.

🤝 Contribución

Este proyecto es una demostración de capacidades full-stack con propósito social. Si encuentras errores o tienes sugerencias de mejora (como notificaciones push reales, modo oscuro o exportación de reportes), siéntete libre de abrir un Issue o enviar un Pull Request.

📄 Licencia

MIT License - Libre uso para fines educativos y personales.


Hecho con ❤️ y código para apoyar la neurodivergencia.
