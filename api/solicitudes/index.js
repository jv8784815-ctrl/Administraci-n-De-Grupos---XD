const REDIS_URL = "https://viable-hornet-110487.upstash.io";
const REDIS_TOKEN = "gQAAAAAAAa-XAAIgcDI3MTE3NWI2MDc1MGU0MGRjYmJmOWMwMjkwMWE3MjY0MQ";

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join('/')}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { method } = req;

  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await parseBody(req);
    } catch {
      return res.status(400).json({ error: 'Body inválido' });
    }
  }

  try {
    // ─── POST - Nueva solicitud ───
    if (method === 'POST') {
      if (!body?.grupo?.id || !body?.solicitante?.jid) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      // Verificar duplicado
      const pendientes = await redis('SMEMBERS', 'pendientes');
      if (pendientes) {
        for (const id of pendientes) {
          const raw = await redis('GET', `sol:${id}`);
          if (raw) {
            const s = JSON.parse(raw);
            if (s.grupo.id === body.grupo.id) {
              return res.status(200).json({ mensaje: 'Ya existe una solicitud pendiente', solicitud: s });
            }
          }
        }
      }

      const id = `sol_${Date.now()}`;
      const solicitud = {
        id,
        grupo: body.grupo,
        solicitante: body.solicitante,
        estado: 'pendiente',
        fecha: new Date().toISOString()
      };

      await redis('SET', `sol:${id}`, JSON.stringify(solicitud));
      await redis('SADD', 'pendientes', id);

      return res.status(201).json({ mensaje: 'Solicitud enviada', solicitud });
    }

    // ─── GET - Obtener solicitudes ───
    if (method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const estado = url.searchParams.get('estado');
      const id = url.pathname.split('/').pop();

      // GET por ID
      if (id && id !== 'solicitudes') {
        const raw = await redis('GET', `sol:${id}`);
        if (!raw) return res.status(404).json({ error: 'No encontrada' });
        return res.status(200).json({ solicitud: JSON.parse(raw) });
      }

      // GET por estado o todas
      const clave = estado || 'pendientes';
      const ids = await redis('SMEMBERS', clave) || [];
      const solicitudes = [];

      for (const id of ids.slice(-50)) {
        const raw = await redis('GET', `sol:${id}`);
        if (raw) solicitudes.push(JSON.parse(raw));
      }

      // También buscar en aceptadas y rechazadas
      if (estado === 'aceptada') {
        const idsAceptadas = await redis('SMEMBERS', 'aceptadas') || [];
        for (const id of idsAceptadas.slice(-50)) {
          const raw = await redis('GET', `sol:${id}`);
          if (raw) solicitudes.push(JSON.parse(raw));
        }
      }

      if (estado === 'rechazada') {
        const idsRechazadas = await redis('SMEMBERS', 'rechazadas') || [];
        for (const id of idsRechazadas.slice(-50)) {
          const raw = await redis('GET', `sol:${id}`);
          if (raw) solicitudes.push(JSON.parse(raw));
        }
      }

      // Si no filtra, devolver pendientes
      if (!estado) {
        const totalPendientes = ids.length;
        const aceptadas = await redis('SCARD', 'aceptadas') || 0;
        const rechazadas = await redis('SCARD', 'rechazadas') || 0;

        return res.status(200).json({
          solicitudes,
          total: solicitudes.length,
          pendientes: totalPendientes,
          aceptadas,
          rechazadas
        });
      }

      return res.status(200).json({ solicitudes });
    }

    // ─── PUT - Actualizar estado ───
    if (method === 'PUT') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.pathname.split('/').pop();
      const { estado } = body;

      if (!id || !estado) {
        return res.status(400).json({ error: 'Faltan datos (id y estado)' });
      }

      const raw = await redis('GET', `sol:${id}`);
      if (!raw) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      const solicitud = JSON.parse(raw);
      const estadoAnterior = solicitud.estado;

      // Remover de la lista anterior
      await redis('SREM', estadoAnterior, id);

      // Actualizar
      solicitud.estado = estado;
      solicitud.fechaActualizacion = new Date().toISOString();
      await redis('SET', `sol:${id}`, JSON.stringify(solicitud));

      // Agregar a nueva lista
      await redis('SADD', estado, id);

      // Guardar en historial
      await redis('LPUSH', 'historial', JSON.stringify(solicitud));

      return res.status(200).json({ 
        mensaje: `Solicitud ${estado}`,
        solicitud 
      });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}
