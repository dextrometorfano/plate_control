const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
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

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: "online", 
    message: "Servidor respondiendo correctamente",
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
          subfamilia (
            nombre,
            familia ( nombre )
          )
        )
      `);

    if (invError) throw invError;

    // 2. Mapear los datos de tu DB al formato exacto que espera tu app.js
    const articles = invData.map((row) => {
      // Equivalente a tu SQL: CONCAT_WS(' ', sb.nombre, i.nombre) AS item
      const subfamiliaNombre = row.item?.subfamilia?.nombre || '';
      const itemNombre = row.item?.nombre || '';
      const itemCompleto = `${subfamiliaNombre} ${itemNombre}`.trim();

      // Equivalente a tu SQL: f.nombre AS familia
      const familiaNombre = row.item?.subfamilia?.familia?.nombre || '';

      // Equivalente a tu SQL: alm.nombre AS ubicacion
      const ubicacion = row.almacen?.nombre || '';

      // Validación visual (critico/bajo) según cantidad
      let estadoVisual = 'ok';
      if (row.cantidad === 0) {
        estadoVisual = 'danger'; // Crítico
      } else if (row.cantidad <= 4) {
        estadoVisual = 'warn';   // Bajo stock
      }

      return {
        id: row.item?.id ?? row.id, // i.id (entero)
        item: itemCompleto,
        familia: familiaNombre,
        stock: row.cantidad,
        ubicacion,
        estado: estadoVisual
      };
    });

    // 3. Calcular los contadores rápidos para el panel principal (stats)
    const totalArticulos = articles.length;
    const escaneados = articles.filter(a => a.stock > 0).length; // Simulación lógica basada en disponibilidad
    const restantes = totalArticulos - escaneados;

    // 4. Retornar la estructura limpia requerida por el frontend
    res.json({
      companyName: "FAMECA",
      user: {
        nombre: "random",
        email: "random@fameca.pe"
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

/**
 * GET: datos completos para formulario de Recepción
 * - Calcula próximo ID de guia_recepcion
 * - Devuelve familias, subfamilias (y items)
 * Regla: si no se selecciona familia/subfamilia => items TODOS.
 */
app.get('/api/recepcion-data', async (req, res) => {
  try {
    const familiaId = req.query.familia_id ? Number(req.query.familia_id) : null;
    const subfamiliaId = req.query.subfamilia_id ? Number(req.query.subfamilia_id) : null;

    // Próximo ID
    const { data: lastGuia, error: errLast } = await supabase
      .from('guia_recepcion')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (errLast) throw errLast;

    const proximoId = (lastGuia && lastGuia.length > 0) ? (Number(lastGuia[0].id) + 1) : 1;

    // Familias
    const { data: familias, error: errFam } = await supabase
      .from('familia')
      .select('id, nombre')
      .order('nombre');

    if (errFam) throw errFam;

    // Subfamilias (filtradas si viene familiaId, si no: todas)
    let subQuery = supabase
      .from('subfamilia')
      .select('id, id_familia, nombre');

    if (familiaId) subQuery = subQuery.eq('id_familia', familiaId);

    const { data: subfamilias, error: errSub } = await subQuery
      .order('nombre');

    if (errSub) throw errSub;

    // Listar Proveedores y Almacenes (necesario porque schema exige id_proveedor y id_almacen)
    const { data: proveedores, error: errProv } = await supabase
      .from('proveedor')
      .select('id, nombre')
      .order('nombre');

    if (errProv) throw errProv;

    const { data: almacenes, error: errAlm } = await supabase
      .from('almacen')
      .select('id, nombre')
      .order('nombre');

    if (errAlm) throw errAlm;

    // Items:
    // Regla crítica: si no se selecciona familia/subfamilia => TODOS los items (según inventario/item)
    // En este schema, inventario es por (id_almacen, id_item), así que si no elegimos almacén
    // deduplicamos por id_item, pero guardamos id_almacen opcional en UI (la UI deberá mandarlo).
    let itemsQuery = supabase
      .from('inventario')
      .select(`
        id,
        cantidad,
        id_item,
        id_almacen,
        item (
          id,
          nombre,
          descripcion,
          subfamilia (
            id,
            id_familia,
            nombre,
            familia ( id, nombre )
          )
        )
      `);

    if (subfamiliaId) {
      itemsQuery = itemsQuery.eq('item.subfamilia.id', subfamiliaId);
    } else if (familiaId) {
      itemsQuery = itemsQuery.eq('item.subfamilia.id_familia', familiaId);
    }

    const { data: invRows, error: errInv } = await itemsQuery;
    if (errInv) throw errInv;

    // Deduplicar por id_item (mostramos 1 option por item). Guardamos un id_almacen ejemplo para que UI
    // pueda usarlo si decide auto-seleccionar; pero el POST real usará el id_almacen elegido.
    // IMPORTANTE:
    // `inventario` puede tener el mismo id_item en múltiples almacenes.
    // Para que el dropdown no "mezcle" registros, deduplicamos por (id_item, id_almacen).
    const mapByItemAlmacen = new Map();
    (invRows || []).forEach((r) => {
      const it = r.item;
      if (!it) return;

      const idItem = it.id;
      if (idItem == null) return;

      const sugeridoAlmacenId = r.id_almacen ?? null;
      const key = `${idItem}|${sugeridoAlmacenId ?? ''}`;

      if (!mapByItemAlmacen.has(key)) {
        mapByItemAlmacen.set(key, {
          itemId: idItem,
          itemNombre: it.nombre || '',
          descripcion: it.descripcion || null,
          subfamiliaId: it.subfamilia?.id ?? null,
          subfamiliaNombre: it.subfamilia?.nombre ?? '',
          familiaId: it.subfamilia?.id_familia ?? null,
          familiaNombre: it.subfamilia?.familia?.nombre ?? '',
          // cantidad es la del inventario para el primer row que aparezca
          cantidad: r.cantidad ?? 0,
          // clave de almacén para que la UI distinga la variante por ubicación
          sugeridoAlmacenId
        });
      }
    });

    const items = Array.from(mapByItemAlmacen.values()).sort((a, b) => {
      const af = `${a.familiaNombre}`.toLowerCase();
      const bf = `${b.familiaNombre}`.toLowerCase();
      if (af !== bf) return af.localeCompare(bf);
      const as = `${a.subfamiliaNombre}`.toLowerCase();
      const bs = `${b.subfamiliaNombre}`.toLowerCase();
      if (as !== bs) return as.localeCompare(bs);
      return `${a.itemNombre}`.toLowerCase().localeCompare(`${b.itemNombre}`.toLowerCase());
    });

    res.json({
      proximoId,
      familias: familias || [],
      subfamilias: subfamilias || [],
      proveedores: proveedores || [],
      almacenes: almacenes || [],
      items
    });
  } catch (error) {
    console.error("❌ Error en /api/recepcion-data:", error.message || error);
    res.status(500).json({ error: 'Error al cargar datos de recepción' });
  }
});

/**
 * POST: Ajustar inventario por modalidad Recepción
 * Inserta guía_recepcion + det_guia_recepcion y suma stock en inventario.
 */
app.post('/api/ajuste-recepcion', async (req, res) => {
  try {
    const body = req.body || {};
    const observaciones = body.observaciones || '';
    const id_proveedor = body.id_proveedor;
    const id_almacen = body.id_almacen;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!id_proveedor) {
      return res.status(400).json({ success: false, message: "Falta id_proveedor" });
    }
    if (!id_almacen) {
      return res.status(400).json({ success: false, message: "Falta id_almacen" });
    }
    if (!items.length) {
      return res.status(400).json({ success: false, message: "No hay items para ajustar" });
    }

    // Validar cantidades > 0 (det_guia_recepcion.chk_guia_cantidad)
    const cleanItems = items
      .map((it) => ({
        id_item: Number(it.id),
        cantidad: Number(it.cantidad)
      }))
      .filter((it) => Number.isFinite(it.id_item) && Number.isFinite(it.cantidad) && it.cantidad > 0);

    if (!cleanItems.length) {
      return res.status(400).json({ success: false, message: "Todas las cantidades deben ser > 0" });
    }

    // Próximo ID de guía
    const { data: lastGuia, error: errLast } = await supabase
      .from('guia_recepcion')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (errLast) throw errLast;

    const proximoId = (lastGuia && lastGuia.length > 0) ? (Number(lastGuia[0].id) + 1) : 1;

    // Inserta guía
    const guiaInsertPayload = {
      id: proximoId,
      fecha_recepcion: new Date().toISOString(),
      id_proveedor: Number(id_proveedor),
      observaciones
    };

    const { error: errGuia } = await supabase
      .from('guia_recepcion')
      .insert(guiaInsertPayload);

    if (errGuia) throw errGuia;

    // Insert det_guia_recepcion (batch)
    const detPayload = cleanItems.map((it) => ({
      id_guia: proximoId,
      id_item: it.id_item,
      cantidad: it.cantidad
    }));

    const { error: errDet } = await supabase
      .from('det_guia_recepcion')
      .insert(detPayload);

    if (errDet) throw errDet;

    // Actualiza inventario SUMANDO cantidad por (id_almacen + id_item)
    for (const it of cleanItems) {
      const { data: invRow, error: errRow } = await supabase
        .from('inventario')
        .select('id, cantidad')
        .eq('id_almacen', Number(id_almacen))
        .eq('id_item', it.id_item)
        .limit(1);

      if (errRow) throw errRow;

      if (!invRow || invRow.length === 0) {
        const { error: errIns } = await supabase
          .from('inventario')
          .insert({
            id_almacen: Number(id_almacen),
            id_item: it.id_item,
            cantidad: it.cantidad
          });

        if (errIns) throw errIns;
      } else {
        const newCantidad = Number(invRow[0].cantidad) + it.cantidad;

        const { error: errUpd } = await supabase
          .from('inventario')
          .update({ cantidad: newCantidad })
          .eq('id', invRow[0].id);

        if (errUpd) throw errUpd;
      }
    }

    res.json({
      success: true,
      message: "Inventario ajustado correctamente",
      id_guia: proximoId
    });
  } catch (error) {
    console.error("❌ Error en /api/ajuste-recepcion:", error.message || error);
    res.status(500).json({ success: false, message: error.message || 'Error al ajustar inventario' });
  }
});
