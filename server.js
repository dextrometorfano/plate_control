const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Solo para desarrollo local con un archivo .env

const app = express();

// Permitir peticiones desde tu frontend y habilitar lectura de JSON
app.use(cors());
app.use(express.json());

// 1. Inicialización de Supabase con variables de entorno del sistema
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("⚠️ Alerta: Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY.");
}

// Cliente global de Supabase listo para usar
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Ruta de prueba (Ping) para verificar en tu App Service que el backend responde
app.get('/api/health', (req, res) => {
  res.json({ 
    status: "online", 
    message: "Servidor Invex respondiendo correctamente",
    supabaseConnected: !!SUPABASE_URL && !!SUPABASE_KEY
  });
});

// 3. El puerto lo asignará Azure App Service dinámicamente mediante la variable PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor base de Invex listo en el puerto ${PORT}`);
});

// Endpoint para alimentar el estado inicial del frontend mapeado con tu DB real
app.get('/api/state', async (req, res) => {
  try {
    // 1. Consultar la lista de items con sus relaciones (Equivalente a tu VISTA INVENTARIO)
    const { data: invData, error: invError } = await supabase
      .from('inventario')
      .select(`
        id,
        cantidad,
        almacen ( nombre ),
        item (
          id,
          nombre,
          subfamilia ( nombre )
        )
      `);

    if (invError) throw invError;

    // 2. Mapear los datos de tu DB al formato exacto que espera tu app.js
    const articles = invData.map((row) => {
      // Replicamos el CONCAT_WS(' ', sb.nombre, i.nombre) de tu SQL
      const subfamiliaNombre = row.item?.subfamilia?.nombre || '';
      const itemNombre = row.item?.nombre || '';
      const nombreCompleto = `${subfamiliaNombre} ${itemNombre}`.trim();

      // Determinamos el estado dinámico visual según tu stock real
      let estadoVisual = 'ok';
      if (row.cantidad === 0) {
        estadoVisual = 'danger'; // Crítico
      } else if (row.cantidad <= 2) {
        estadoVisual = 'warn';   // Bajo stock
      }

      return {
        id: `ART-${row.item?.id || row.id}`, // Formateo visual de ID
        nombre: nombreCompleto,
        categoria: subfamiliaNombre, // Usamos la subfamilia como categoría visual
        stock: row.cantidad,
        estado: estadoVisual
      };
    });

    // 3. Calcular los contadores rápidos para el panel principal (stats)
    const totalArticulos = articles.length;
    const escaneados = articles.filter(a => a.stock > 0).length; // Simulación lógica basada en disponibilidad
    const restantes = totalArticulos - escaneados;

    // 4. Retornar la estructura limpia requerida por el frontend
    res.json({
      companyName: "RADEEL",
      user: {
        nombre: "Operario Invex",
        email: "almacen@radeel.com"
      },
      stats: {
        totalArticulos,
        escaneados,
        restantes
      },
      articles: articles,
      activity: [
        { id: "H-1", titulo: "Base de datos sincronizada", detalle: "Conexión exitosa con Supabase", tiempo: "Ahora" }
      ]
    });

  } catch (error) {
    console.error("❌ Error en /api/state:", error.message || error);
    res.status(500).json({ error: 'Error al compilar el estado del inventario' });
  }
});