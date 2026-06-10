const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config(); // Solo para desarrollo local con un archivo .env

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Inicialización de Supabase con variables de entorno del sistema
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("⚠️ Alerta: Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// RUTAS ESTÁTICAS Y DE CONTROL (HEALTH)
// ==========================================
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

// ==========================================
// CORE: ESTADO INICIAL DEL PANEL (STATE)
// ==========================================
app.get('/api/state', async (req, res) => {
  try {
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

    const articles = invData.map((row) => {
      const subfamiliaNombre = row.item?.subfamilia?.nombre || '';
      const itemNombre = row.item?.nombre || '';
      const itemCompleto = `${subfamiliaNombre} ${itemNombre}`.trim();
      const familiaNombre = row.item?.subfamilia?.familia?.nombre || '';
      const ubicacion = row.almacen?.nombre || '';

      let estadoVisual = 'ok';
      if (row.cantidad === 0) {
        estadoVisual = 'danger';
      } else if (row.cantidad <= 4) {
        estadoVisual = 'warn';
      }

      return {
        id: row.item?.id ?? row.id,
        item: itemCompleto,
        familia: familiaNombre,
        stock: row.cantidad,
        ubicacion,
        estado: estadoVisual
      };
    });

    const totalArticulos = articles.length;
    const escaneados = articles.filter(a => a.stock > 0).length;
    const restantes = totalArticulos - escaneados;
    const { data: movData, error: movError } = await supabase
      .from('report') 
      .select('fecha, tipo_movimiento, item, cantidad, almacen')
      .limit(10);

    if (movError) {
      console.error("⚠️ Error al traer movimientos:", movError);
    }

    const activityFeed = (movData || []).map((m, index) => {
      const signo = m.tipo_movimiento === 'RECEPCION' ? '+' : '';
      return {
        id: `M-${index}`,
        titulo: m.item,
        detalle: `${m.tipo_movimiento} de ${signo}${m.cantidad} unidades en ${m.almacen}`,
        tiempo: m.fecha
      };
    });

    res.json({
      companyName: "FAMECA",
      user: { nombre: "random", email: "random@fameca.pe" },
      stats: { totalArticulos, escaneados, restantes },
      articles: articles,
      activity: activityFeed
    });

  } catch (error) {
    console.error("❌ Error en /api/state:", error.message || error);
    res.status(500).json({ error: 'Error al compilar el estado del inventario' });
  }
});

// ==========================================
// GET: CARGA DE COMBOS Y FILTROS (RECEPCIÓN)
// ==========================================
app.get('/api/recepcion-data', async (req, res) => {
  try {
    const familiaId = req.query.familia_id ? Number(req.query.familia_id) : null;
    const subfamiliaId = req.query.subfamilia_id ? Number(req.query.subfamilia_id) : null;

    const { data: lastGuia, error: errLast } = await supabase
      .from('guia_recepcion')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (errLast) throw errLast;
    const proximoId = (lastGuia && lastGuia.length > 0) ? (Number(lastGuia[0].id) + 1) : 1;

    const { data: familias, error: errFam } = await supabase
      .from('familia')
      .select('id, nombre')
      .order('nombre');

    if (errFam) throw errFam;

    let subQuery = supabase.from('subfamilia').select('id, id_familia, nombre');
    if (familiaId) subQuery = subQuery.eq('id_familia', familiaId);

    const { data: subfamilias, error: errSub } = await subQuery.order('nombre');
    if (errSub) throw errSub;

    const { data: proveedores, error: errProv } = await supabase.from('proveedor').select('id, nombre').order('nombre');
    if (errProv) throw errProv;

    const { data: almacenes, error: errAlm } = await supabase.from('almacen').select('id, nombre').order('nombre');
    if (errAlm) throw errAlm;

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

    const mapByItemAlmacen = new Map();
    (invRows || []).forEach((r) => {
      const it = r.item;
      if (!it || it.id == null) return;

      const idItem = it.id;
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
          cantidad: r.cantidad ?? 0,
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

    return res.json({
      proximoId,
      familias: familias || [],
      subfamilias: subfamilias || [],
      proveedores: proveedores || [],
      almacenes: almacenes || [],
      items
    });

  } catch (error) {
    console.error('Error en /api/recepcion-data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno: ' + error.message
    });
  }
});

app.get('/api/retiro-data', async (req, res) => {
  try {
    // 1. Normalización de filtros de entrada
    const familiaId = req.query.familia_id ? Number(req.query.familia_id) : null;
    const subfamiliaId = req.query.subfamilia_id ? Number(req.query.subfamilia_id) : null;

    const { count: totalVales, error: errCount } = await supabase
      .from('vale_retiro')
      .select('*', { count: 'exact', head: true });
    
    if (errCount) throw errCount;
    const proximoId = (totalVales || 0) + 1;

    const { data: colaboradores, error: errColab } = await supabase
      .from('colaborador')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errColab) throw errColab;

    const { data: almacenes, error: errAlmacen } = await supabase
      .from('almacen')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errAlmacen) throw errAlmacen;

    const { data: familias, error: errFam } = await supabase
      .from('familia')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errFam) throw errFam;

    let subQuery = supabase.from('subfamilia').select('id, id_familia, nombre');
    if (familiaId) subQuery = subQuery.eq('id_familia', familiaId);

    const { data: subfamilias, error: errSubFam } = await subQuery.order('nombre', { ascending: true });
    if (errSubFam) throw errSubFam;

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

    const mapByItemAlmacen = new Map();
    (invRows || []).forEach((r) => {
      const it = r.item;
      if (!it || it.id == null) return;

      const idItem = it.id;
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
          cantidad: r.cantidad ?? 0,
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

    return res.status(200).json({
      success: true,
      proximoId,
      colaboradores, 
      almacenes,
      familias,
      subfamilias,
      items
    });

  } catch (error) {
    console.error('Error en /api/retiro-data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno: ' + error.message
    });
  }
});

// ==========================================
// POST: PROCESAR GUARDADO DE RECEPCIÓN
// ==========================================
app.post('/api/ajuste-recepcion', async (req, res) => {
  const { id_proveedor, id_almacen, observaciones, items } = req.body;

  if (!id_proveedor || !id_almacen || !items || !items.length) {
    return res.status(400).json({ success: false, message: 'Datos incompletos o carrito vacío.' });
  }

  let idGuiaCreada = null;

  try {
    const { data: cabecera, error: errorCabecera } = await supabase
      .from('guia_recepcion')
      .insert([
        {
          fecha_recepcion: new Date().toISOString(),
          id_proveedor: parseInt(id_proveedor, 10),
          id_almacen: parseInt(id_almacen, 10),
          observaciones: observaciones || null
        }
      ])
      .select('id')
      .single();

    if (errorCabecera) {
      throw new Error(`Error al crear la cabecera: ${errorCabecera.message}`);
    }

    idGuiaCreada = cabecera.id;

    const filasDetalle = items.map(item => {
      const cantidad = parseInt(item.cantidad, 10);
      
      if (cantidad <= 0) {
        throw new Error(`La cantidad para el ítem ID ${item.id} debe ser mayor a cero.`);
      }

      return {
        id_guia: idGuiaCreada,
        id_item: parseInt(item.id, 10),
        cantidad: cantidad
      };
    });

    const { error: errorDetalle } = await supabase
      .from('det_guia_recepcion')
      .insert(filasDetalle);

    if (errorDetalle) {
      throw new Error(`Error al insertar los detalles de la guía: ${errorDetalle.message}`);
    }

    return res.json({ 
      success: true, 
      message: `Recepción guardada con éxito. Guía N° ${idGuiaCreada}` 
    });

  } catch (error) {
    console.error('Error procesando la recepción:', error);
    
    if (idGuiaCreada) {
      await supabase.from('guia_recepcion').delete().eq('id', idGuiaCreada);
    }

    return res.status(500).json({ 
      success: false, 
      message: 'Error interno: ' + error.message 
    });
  }
});

// ==========================================
// POST: PROCESAR GUARDADO DE RETIRO
// ==========================================
app.post('/api/ajuste-retiro', async (req, res) => {
  const { id_colaborador, id_almacen, observaciones, items } = req.body;

  if (!id_colaborador || !id_almacen || !items || !items.length) {
    return res.status(400).json({ success: false, message: 'El ID de colaborador, almacén o carrito no válidos.' });
  }

  let idValeGenerado = null;

  try {
    const { data: cabecera, error: errCabecera } = await supabase
      .from('vale_retiro')
      .insert([
        {
          fecha_retiro: new Date().toISOString(),
          id_colaborador: Number(id_colaborador),
          id_almacen: Number(id_almacen),
          observaciones: observaciones || null
        }
      ])
      .select('id')
      .single();

    if (errCabecera) throw errCabecera;
    idValeGenerado = cabecera.id;

    const filasDetalle = items.map(item => ({
      id_vale: idValeGenerado,       
      id_item: Number(item.id),       
      cantidad: Number(item.cantidad) 
    }));

    const { error: errDetalle } = await supabase
      .from('det_vale_retiro')
      .insert(filasDetalle);

    if (errDetalle) throw errDetalle;

    return res.status(200).json({
      success: true,
      message: `Vale de Retiro N° ${idValeGenerado} registrado con éxito.`
    });

  } catch (error) {
    console.error('Error en /api/ajuste-retiro:', error);
    
    if (idValeGenerado) {
      await supabase.from('vale_retiro').delete().eq('id', idValeGenerado);
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Error de base de datos al procesar el retiro.'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor base de Invex listo en el puerto ${PORT}`);
});