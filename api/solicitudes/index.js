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
    // ─── POST ───
    if (method === 'POST') {
      if (!body?.grupo?.id || !body?.solicitante?.jid) {
        return res.status(400).json({ error: 'Datos incompletos' });
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

    // ─── GET ───
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

      // GET todas - buscar en TODAS las listas
      if (!estado) {
        const todasIds = [];
        const pendientesIds = await redis('SMEMBERS', 'pendientes') || [];
        const aceptadasIds = await redis('SMEMBERS', 'aceptadas') || [];
        const rechazadasIds = await redis('SMEMBERS', 'rechazadas') || [];
        
        todasIds.push(...pendientesIds, ...aceptadasIds, ...rechazadasIds);
        
        const solicitudes = [];
        for (const id of [...new Set(todasIds)].slice(-50)) {
          const raw = await redis('GET', `sol:${id}`);
          if (raw) solicitudes.push(JSON.parse(raw));
        }

        return res.status(200).json({
          solicitudes,
          total: solicitudes.length,
          pendientes: pendientesIds.length,
          aceptadas: aceptadasIds.length,
          rechazadas: rechazadasIds.length
        });
      }

      // GET por estado específico
      const clave = estado === 'aceptada' ? 'aceptadas' :
                    estado === 'rechazada' ? 'rechazadas' : 'pendientes';

      const ids = await redis('SMEMBERS', clave) || [];
      const solicitudes = [];

      for (const id of ids.slice(-50)) {
        const raw = await redis('GET', `sol:${id}`);
        if (raw) solicitudes.push(JSON.parse(raw));
      }

      return res.status(200).json({
        solicitudes,
        total: solicitudes.length
      });
    }

    // ─── PUT ───
    if (method === 'PUT') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.pathname.split('/').pop();
      const { estado } = body;

      if (!id || !estado) return res.status(400).json({ error: 'Faltan datos' });

      const raw = await redis('GET', `sol:${id}`);
      if (!raw) return res.status(404).json({ error: 'No encontrada' });

      const solicitud = JSON.parse(raw);
      const estadoAnterior = solicitud.estado;

      // Remover de lista anterior
      const listaAnterior = estadoAnterior === 'pendiente' ? 'pendientes' :
                            estadoAnterior === 'aceptada' ? 'aceptadas' :
                            estadoAnterior === 'rechazada' ? 'rechazadas' : 'pendientes';
      
      await redis('SREM', listaAnterior, id);

      // Actualizar
      solicitud.estado = estado;
      solicitud.fechaActualizacion = new Date().toISOString();
      await redis('SET', `sol:${id}`, JSON.stringify(solicitud));

      // Agregar a nueva lista
      const listaNueva = estado === 'pendiente' ? 'pendientes' :
                         estado === 'aceptada' ? 'aceptadas' :
                         estado === 'rechazada' ? 'rechazadas' : 'pendientes';
      
      await redis('SADD', listaNueva, id);

      // Guardar en historial
      await redis('LPUSH', 'historial', JSON.stringify(solicitud));

      return res.status(200).json({ mensaje: `Solicitud ${estado}`, solicitud });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error interno' });
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
