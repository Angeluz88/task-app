# 🧠 Task App TDAH - Sistema de Gestión de Tareas Gamificado

Una aplicación web progresiva (PWA) diseñada para ayudar a niños con TDAH (Trastorno por Déficit de Atención e Hiperactividad) a gestionar sus tareas diarias mediante gamificación, temporizadores visuales y un sistema de recompensas.

## 🚀 Características Principales

### 👨‍👩‍👧‍👦 Para los Padres
- **Gestión de Hijos**: Registro ilimitado de hijos con avatares personalizados y PIN de acceso.
- **Creación de Tareas**: Asigna tareas con tiempo estimado y puntos de recompensa.
- **Sistema de Premios**: Configura premios diarios, semanales o mensuales canjeables por puntos.
- **Seguimiento**: Visualiza el progreso, puntajes acumulados y historial de completitud.
- **Recursos**: Acceso a consejos sobre neurodivergencia y frases motivadoras.

### 🧒 Para los Niños
- **Interfaz Amigable**: Diseño colorido, simple y libre de distracciones.
- **Temporizador Visual**: Herramienta integrada para fomentar la concentración (Técnica Pomodoro adaptada).
- **Gamificación**: Gana puntos al completar tareas y desbloquea premios.
- **Motivación**: Frases positivas y datos curiosos sobre el cerebro TDAH.
- **Acceso Rápido**: Login seguro mediante nombre o PIN de 4 dígitos.

## 🛠️ Tecnologías Utilizadas

### Frontend
- **React**: Biblioteca principal para la interfaz de usuario.
- **Vite**: Build tool rápido y moderno.
- **Tailwind CSS**: Estilizado ágil y responsivo.
- **React Router DOM**: Navegación entre vistas (Padres/Hijos).
- **Axios**: Cliente HTTP para comunicación con la API.
- **PWA**: Configuración para instalación en móviles y funcionamiento offline básico.

### Backend
- **Node.js & Express**: Servidor API RESTful.
- **PostgreSQL (Neon)**: Base de datos relacional en la nube (Serverless).
- **JWT (jsonwebtoken)**: Autenticación segura por roles.
- **Bcryptjs**: Encriptación de contraseñas.
- **CORS**: Gestión de seguridad para peticiones cruzadas.

### Infraestructura & Despliegue
- **Frontend**: Vercel (CDN global, HTTPS automático).
- **Backend**: Render (Hosting de servicios Node.js).
- **Base de Datos**: Neon (PostgreSQL Serverless gratuito).
- **Control de Versiones**: Git & GitHub.

## 📂 Estructura del Proyecto

```text
task-app/
├── backend/
│   ├── server.js          # Lógica del servidor y rutas API
│   ├── .env               # Variables de entorno (DATABASE_URL, JWT_SECRET)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Vistas principales (Login, Dashboards)
│   │   ├── services/      # Conexión con API (api.js)
│   │   └── App.jsx        # Enrutador principal
│   ├── public/            # Assets estáticos e iconos PWA
│   └── package.json
├── README.md
└── .gitignore
