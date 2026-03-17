# TDAH App - Gestión de Tareas con Temporizador y Puntajes

Aplicación PWA diseñada para ayudar a niños con TDAH a gestionar sus tareas diarias mediante temporizadores, puntajes y un sistema de recompensas.

## Características

### Para Padres:
- ✅ Crear, editar y eliminar tareas con duración y puntaje personalizado
- ✅ Definir premios diarios, semanales y mensuales según puntajes
- ✅ Ver el progreso y puntajes de los hijos
- ✅ Acceder a información sobre neurodivergencia y famosos neurodivergentes

### Para Hijos:
- ✅ Ver tareas asignadas con temporizador integrado
- ✅ Iniciar y completar tareas
- ✅ Acumular puntajes diarios, semanales y mensuales
- ✅ Ver premios disponibles
- ✅ Recibir frases motivadoras
- ✅ Leer curiosidades sobre neurodivergencia

## Tecnologías

- **Frontend**: React.js + Vite (PWA)
- **Backend**: Node.js + Express
- **Base de Datos**: MySQL

## Instalación

### 1. Clonar el repositorio
```bash
cd tdah-app
```

### 2. Configurar la Base de Datos

```bash
# Instalar MySQL si no lo tienes
# Luego ejecutar el script SQL
mysql -u root -p < backend/database.sql
```

### 3. Configurar el Backend

```bash
cd backend

# Editar .env con tus credenciales de MySQL
nano .env

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

### 4. Configurar el Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

## Estructura del Proyecto

```
tdah-app/
├── backend/
│   ├── server.js          # Servidor Express
│   ├── database.sql       # Script de base de datos
│   ├── .env              # Variables de entorno
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/        # Componentes de página
│   │   ├── services/     # Servicios API
│   │   ├── App.jsx       # Componente principal
│   │   └── main.jsx      # Punto de entrada
│   ├── public/
│   │   └── manifest.json # Manifiesto PWA
│   └── package.json
└── README.md
```

## Uso

### Registro de Usuarios

1. **Padre**: Registrarse como "Padre/Madre"
2. **Hijo**: Registrarse como "Hijo/a" e ingresar el ID del padre

### Flujo de Trabajo

1. El padre crea tareas con duración y puntaje
2. El padre define premios según puntajes acumulados
3. El hijo inicia sesión y ve sus tareas
4. El hijo inicia una tarea → comienza el temporizador
5. Al completar el tiempo → recibe puntos y frase motivadora
6. El padre puede ver el progreso y puntajes

## Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/register | Registrar usuario |
| POST | /api/auth/login | Iniciar sesión |
| GET | /api/tasks | Obtener tareas |
| POST | /api/tasks | Crear tarea |
| POST | /api/tasks/:id/start | Iniciar tarea |
| POST | /api/tasks/:id/complete | Completar tarea |
| GET | /api/scores | Obtener puntajes |
| GET | /api/rewards | Obtener premios |
| GET | /api/motivational-phrases | Frases motivadoras |
| GET | /api/neurodivergence-info | Info neurodivergencia |

## Notas Importantes

- Asegúrate de tener MySQL corriendo antes de iniciar el backend
- El frontend se ejecuta en `http://localhost:5173`
- El backend se ejecuta en `http://localhost:3000`
- La app está diseñada para ser instalable como PWA

## Licencia

MIT
