// Configuración básica (sin cambios)
var express = require('express');
var cors = require('cors');
var mysql = require('mysql2');
var app = express();
app.use(cors());
app.use(express.json());

// Conexión a MySQL (sin cambios)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: 'sofiag1', 
  database: 'examenLaboratorio' 
});

db.connect((err) => {
  if (err) {
    console.error('❌ Error de conexión a la base de datos:', err);
    return;
  }
  console.log('✅ Conexión a la base de datos establecida');
});

// Ruta de login (mejorada)
app.post('/login', (req, res) => {
  const { usuario, contraseña } = req.body;

  if (!usuario || !contraseña) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const query = 'SELECT id, usuario, grado_id FROM maestros WHERE usuario = ? AND contraseña = ?';

  db.query(query, [usuario, contraseña], (err, results) => {
    if (err) {
      console.error('Error al consultar usuario:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length > 0) {
      res.json({ 
        success: true,
        usuario: results[0] 
      });
    } else {
      res.status(401).json({ error: 'Credenciales incorrectas' });
    }
  });
});

// Ruta para alumnos por maestro (optimizada)
app.get('/alumnos-por-maestro/:maestroId', (req, res) => {
  const { maestroId } = req.params;
  
  const query = `
    SELECT a.id, a.nombre, a.grado_id 
    FROM alumnos a
    INNER JOIN maestros m ON a.grado_id = m.grado_id
    WHERE m.id = ?
    ORDER BY a.nombre
  `;
  
  db.query(query, [maestroId], (err, results) => {
    if (err) {
      console.error('Error al obtener alumnos:', err);
      return res.status(500).json({ 
        error: true,
        message: 'Error al cargar lista de alumnos' 
      });
    }
    
    // Si no hay alumnos, devolver array vacío
    res.json(results || []);
  });
});

// Mantener ruta general de alumnos si es necesaria
app.get('/alumnos', (req, res) => {
  const query = 'SELECT id, nombre, grado_id FROM alumnos ORDER BY nombre';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener todos los alumnos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    res.json(results);
  });
});

app.post('/guardar-asistencia', async (req, res) => {
  console.log('Datos recibidos:', req.body); // Log para depuración
  
  try {
      const { maestro_id, grado_id, fecha, alumnos } = req.body;

      // Validación exhaustiva
      const errores = [];
      if (!maestro_id) errores.push("maestro_id es requerido");
      if (!grado_id) errores.push("grado_id es requerido");
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          errores.push("Formato de fecha inválido (YYYY-MM-DD)");
      }
      if (!alumnos || !Array.isArray(alumnos) || alumnos.length === 0) {
          errores.push("Lista de alumnos vacía o inválida");
      }

      if (errores.length > 0) {
          return res.status(400).json({ 
              error: 'Datos incompletos',
              detalles: errores 
          });
      }

      // Iniciar transacción
      await db.promise().query('START TRANSACTION');

      // 1. Eliminar registros existentes
      await db.promise().query(
          'DELETE FROM asistencia WHERE fecha = ? AND grado_id = ?', 
          [fecha, grado_id]
      );

      // 2. Insertar nuevos registros
      const insertQuery = `
          INSERT INTO asistencia 
          (maestro_id, grado_id, fecha, alumno, estado) 
          VALUES ?
      `;

      const values = alumnos.map(alumno => [
          maestro_id,
          grado_id,
          fecha,
          alumno.nombre,
          alumno.estado ? 1 : 0 // Convertir boolean a TINYINT
      ]);

      await db.promise().query(insertQuery, [values]);

      // Confirmar transacción
      await db.promise().query('COMMIT');

      res.json({ 
          success: true,
          message: `Asistencia guardada para ${values.length} alumnos`
      });

  } catch (error) {
      // Revertir en caso de error
      await db.promise().query('ROLLBACK');
      console.error('Error en la base de datos:', error);
      
      res.status(500).json({ 
          error: 'Error al guardar asistencia',
          detalle: process.env.NODE_ENV === 'development' ? error.message : null
      });
  }
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
