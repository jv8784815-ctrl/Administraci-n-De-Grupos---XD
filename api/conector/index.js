export default async function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FrikiBot Panel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; padding: 15px; max-width: 600px; margin: 0 auto; }
        h1 { text-align: center; font-size: 20px; margin: 15px 0; }
        .stats { display: flex; gap: 8px; margin-bottom: 15px; }
        .stat { flex: 1; background: #1a1a1a; padding: 12px; border-radius: 10px; text-align: center; }
        .stat-num { font-size: 28px; font-weight: bold; }
        .stat-label { font-size: 11px; color: #aaa; margin-top: 3px; }
        .pend .stat-num { color: #ffa502; }
        .ok .stat-num { color: #2ed573; }
        .bad .stat-num { color: #ff4757; }
        .tabs { display: flex; gap: 5px; margin-bottom: 15px; }
        .tab { flex: 1; padding: 10px; background: #1a1a1a; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-size: 13px; }
        .tab.active { background: #667eea; }
        .card { background: #1a1a1a; border-radius: 12px; padding: 15px; margin-bottom: 10px; }
        .card-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .card-name { font-weight: bold; }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 10px; }
        .badge-pendiente { background: #ffa502; color: #000; }
        .badge-aceptada { background: #2ed573; color: #000; }
        .badge-rechazada { background: #ff4757; }
        .card-info { font-size: 12px; color: #aaa; margin: 3px 0; }
        .card-btns { display: flex; gap: 8px; margin-top: 12px; }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .btn-ok { background: #2ed573; color: #000; }
        .btn-no { background: #ff4757; color: #fff; }
        .empty { text-align: center; padding: 30px; color: #555; }
        .refresh { position: fixed; bottom: 20px; right: 20px; background: #667eea; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>🤖 FrikiBot Panel</h1>
    <div class="stats">
        <div class="stat pend"><div class="stat-num" id="sPendientes">0</div><div class="stat-label">Pendientes</div></div>
        <div class="stat ok"><div class="stat-num" id="sAceptadas">0</div><div class="stat-label">Aceptadas</div></div>
        <div class="stat bad"><div class="stat-num" id="sRechazadas">0</div><div class="stat-label">Rechazadas</div></div>
    </div>
    <div class="tabs">
        <button class="tab active" onclick="cargar('pendiente')">⏳ Pendientes</button>
        <button class="tab" onclick="cargar('aceptada')">✅ Aceptadas</button>
        <button class="tab" onclick="cargar('rechazada')">❌ Rechazadas</button>
    </div>
    <div id="content"><div class="empty">Cargando...</div></div>
    <button class="refresh" onclick="cargar(tabActual)">🔄 Actualizar</button>

    <script>
        const API = 'http://64.20.54.50:30278/api/solicitudes';
        let tabActual = 'pendiente';

        async function cargar(estado) {
            tabActual = estado;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');

            try {
                const res = await fetch(API + '?estado=' + estado);
                const d = await res.json();
                const lista = d.solicitudes || [];
                const div = document.getElementById('content');

                document.getElementById('sPendientes').textContent = d.pendientes || 0;
                document.getElementById('sAceptadas').textContent = d.aceptadas || 0;
                document.getElementById('sRechazadas').textContent = d.rechazadas || 0;

                if (!lista.length) {
                    div.innerHTML = '<div class="empty">No hay solicitudes</div>';
                    return;
                }

                div.innerHTML = lista.map(s => 
                    '<div class="card">' +
                    '<div class="card-top"><div class="card-name">' + (s.grupo.nombre || 'Sin nombre') + '</div><div class="badge badge-' + s.estado + '">' + s.estado + '</div></div>' +
                    '<div class="card-info">👥 ' + (s.grupo.miembros || 0) + ' miembros</div>' +
                    '<div class="card-info">👤 ' + (s.solicitante.nombre || '') + '</div>' +
                    '<div class="card-info">📅 ' + new Date(s.fecha).toLocaleString() + '</div>' +
                    (s.estado === 'pendiente' ? '<div class="card-btns"><button class="btn btn-ok" onclick="accion(\\'' + s.id + '\\',\\'aceptada\\')">✅ Aceptar</button><button class="btn btn-no" onclick="accion(\\'' + s.id + '\\',\\'rechazada\\')">❌ Rechazar</button></div>' : '') +
                    '</div>'
                ).join('');
            } catch(e) {
                document.getElementById('content').innerHTML = '<div class="empty">Error de conexión</div>';
            }
        }

        async function accion(id, estado) {
            await fetch(API + '/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });
            cargar(tabActual);
        }

        cargar('pendiente');
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
