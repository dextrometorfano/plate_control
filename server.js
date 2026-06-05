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

app.get('/api/retiro-data', async (req, res) => {
  try {
    const { familia_id, subfamilia_id } = req.query;

    // 1. Obtener el próximo ID aproximado para el vale de retiro (conteo rápido)
    const { count: totalVales, error: errCount } = await supabase
      .from('vale_retiro')
      .select('*', { count: 'exact', head: true });
    
    if (errCount) throw errCount;
    const proximoId = (totalVales || 0) + 1;

    // 2. Traer colaboradores activos (Alineado a tu FK)
    const { data: colaboradores, error: errColab } = await supabase
      .from('colaborador')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errColab) throw errColab;

    // 3. Traer almacenes
    const { data: almacenes, error: errAlmacen } = await supabase
      .from('almacen')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errAlmacen) throw errAlmacen;

    // 4. Traer familias (Tipos de planchas)
    const { data: familias, error: errFam } = await supabase
      .from('familia')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errFam) throw errFam;

    // 5. Traer subfamilias (Subtipos)
    const { data: subfamilias, error: errSubFam } = await supabase
      .from('subfamilia')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    
    if (errSubFam) throw errSubFam;

    // 6. Consultar Items mapeando las propiedades exactas que busca el frontend
    let queryItems = supabase
      .from('item')
      .select(`
        itemId:id,
        itemNombre:nombre,
        familiaId:id_familia,
        subfamiliaId:id_subfamilia,
        sugeridoAlmacenId:id_almacen_sugerido
      `);

    if (subfamilia_id) {
      queryItems = queryItems.eq('id_subfamilia', subfamilia_id);
    } else if (familia_id) {
      queryItems = queryItems.eq('id_familia', familia_id);
    }

    const { data: items, error: errItems } = await queryItems.order('nombre', { ascending: true });
    if (errItems) throw errItems;

    // Respuesta idéntica al formato que mapea el frontend
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
      message: error.message || 'Error interno al cargar datos de retiro.'
    });
  }
});

app.post('/api/ajuste-retiro', async (req, res) => {
  try {
    const { id_colaborador, id_almacen, observaciones, items } = req.body;

    // Validaciones de seguridad en el servidor
    if (!id_colaborador) return res.status(400).json({ success: false, message: 'El ID de colaborador es requerido.' });
    if (!id_almacen) return res.status(400).json({ success: false, message: 'El ID de almacén es requerido.' });
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'El carrito no contiene ítems para retirar.' });
    }

    // 1. Insertar la Cabecera en vale_retiro
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
    const idValeGenerado = cabecera.id;

    // 2. Mapear el carrito enviado por el Front al esquema det_vale_retiro
    const filasDetalle = items.map(item => ({
      id_vale: idValeGenerado,       
      id_item: Number(item.id),       
      cantidad: Number(item.cantidad) 
    }));

    // 3. Insertar los detalles en bloque
    const { error: errDetalle } = await supabase
      .from('det_vale_retiro')
      .insert(filasDetalle);

    if (errDetalle) {
      // Rollback manual si el detalle falla
      await supabase.from('vale_retiro').delete().eq('id', idValeGenerado);
      throw errDetalle;
    }

    // Nota: El trigger tg_ajuste_retiro_inv_after_insert restará el inventario automáticamente en Supabase ahora mismo.
    return res.status(200).json({
      success: true,
      message: `Vale de Retiro N° ${idValeGenerado} registrado con éxito.`
    });

  } catch (error) {
    console.error('Error en /api/ajuste-retiro:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error de base de datos al procesar el retiro.'
    });
  }
});

app.post('/api/ajuste-recepcion', async (req, res) => {
  const { id_proveedor, id_almacen, observaciones, items } = req.body;

  // Validaciones de seguridad iniciales
  if (!id_proveedor || !id_almacen || !items || !items.length) {
    return res.status(400).json({ success: false, message: 'Datos incompletos o carrito vacío.' });
  }

  let idGuiaCreada = null;

  try {
    // 1. PASO 1: Insertar la cabecera en 'guia_recepcion'
    // .select('id').single() nos devuelve inmediatamente el ID generado de esa fila
    const { data: cabecera, error: errorCabecera } = await supabase
      .from('guia_recepcion')
      .insert([
        {
          fecha_recepcion: new Date().toISOString(), // Formato timestamptz para Postgres
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

    idGuiaCreada = cabecera.id; // Guardamos el ID por si necesitamos borrarlo en el catch

    // 2. PASO 2: Preparar el array de detalles para meterlos TODOS de un solo golpe (Bulk Insert)
    const filasDetalle = items.map(item => {
      const cantidad = parseInt(item.cantidad, 10);
      
      // Validamos el check de cantidad antes de enviarlo a Postgres
      if (cantidad <= 0) {
        throw new Error(`La cantidad para el ítem ID ${item.id} debe ser mayor a cero.`);
      }

      return {
        id_guia: idGuiaCreada,
        id_item: parseInt(item.id, 10),
        cantidad: cantidad
      };
    });

    // 3. PASO 3: Insertar los detalles en bloque en 'det_guia_recepcion'
    const { error: errorDetalle } = await supabase
      .from('det_guia_recepcion')
      .insert(filasDetalle);

    if (errorDetalle) {
      throw new Error(`Error al insertar los detalles de la guía: ${errorDetalle.message}`);
    }

    // Si todo salió bien, respondemos éxito
    return res.json({ 
      success: true, 
      message: `Recepción guardada con éxito. Guía N° ${idGuiaCreada}` 
    });

  } catch (error) {
    console.error('Error procesando la recepción:', error);
    
    if (idGuiaCreada) {
      await supabase
        .from('guia_recepcion')
        .delete()
        .eq('id', idGuiaCreada);
    }

    return res.status(500).json({ 
      success: false, 
      message: 'Error interno: ' + error.message 
    });
  }
});