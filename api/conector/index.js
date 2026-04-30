export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
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
        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .card-name { font-weight: bold; font-size: 15px; }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 10px; }
        .badge-pendiente { background: #ffa502; color: #000; }
        .badge-aceptada { background: #2ed573; color: #000; }
        .badge-rechazada { background: #ff4757; }
        .card-info { font-size: 12px; color: #aaa; margin: 3px 0; }
        .card-btns { display: flex; gap: 8px; margin-top: 12px; }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
        .btn-ok { background: #2ed573; color: #000; }
        .btn-no { background: #ff4757; color: #fff; }
        .empty { text-align: center; padding: 30px; color: #555; }
        .loading { text-align: center; padding: 30px; color: #aaa; }
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
        <button class="tab active" id="tabPendientes" onclick="cargar('pendiente')">⏳ Pendientes</button>
        <button class="tab" id="tabAceptadas" onclick="cargar('aceptada')">✅ Aceptadas</button>
        <button class="tab" id="tabRechazadas" onclick="cargar('rechazada')">❌ Rechazadas</button>
    </div>

    <div id="content"><div class="loading">Cargando...</div></div>

    <button class="refresh" onclick="recargar()">🔄 Actualizar</button>

    <script>
        const API = '/api/solicitudes';
        let tabActual = 'pendiente';

        async function loadStats() {
            try {
                const res = await fetch(API);
                const d = await res.json();
                document.getElementById('sPendientes').textContent = d.pendientes || 0;
                document.getElementById('sAceptadas').textContent = d.aceptadas || 0;
                document.getElementById('sRechazadas').textContent = d.rechazadas || 0;
            } catch(e) { console.error(e); }
        }

        async function cargar(tab) {
            tabActual = tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tab' + (tab === 'pendiente' ? 'Pendientes' : tab === 'aceptada' ? 'Aceptadas' : 'Rechazadas')).classList.add('active');

            try {
                const res = await fetch(API + '?estado=' + tab);
                const d = await res.json();
                const lista = d.solicitudes || [];
                const div = document.getElementById('content');

                if (!lista.length) {
                    div.innerHTML = '<div class="empty">No hay solicitudes ' + (tab === 'pendiente' ? 'pendientes' : tab + 's') + '</div>';
                    loadStats();
                    return;
                }

                div.innerHTML = lista.map(s => {
                    const fecha = new Date(s.fecha).toLocaleString('es-ES', { 
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                    
                    return '<div class="card">' +
                        '<div class="card-top">' +
                            '<div class="card-name">' + (s.grupo.nombre || 'Sin nombre') + '</div>' +
                            '<div class="badge badge-' + s.estado + '">' + s.estado + '</div>' +
                        '</div>' +
                        '<div class="card-info">👥 ' + (s.grupo.miembros || 0) + ' miembros</div>' +
                        '<div class="card-info">👤 Solicitante: ' + (s.solicitante.nombre || 'Usuario') + ' (' + (s.solicitante.numero || '') + ')</div>' +
                        '<div class="card-info">📅 ' + fecha + '</div>' +
                        (s.estado === 'pendiente' ? 
                        '<div class="card-btns">' +
                            '<button class="btn btn-ok" onclick="accion(\'' + s.id + '\',\'aceptada\')">✅ Aceptar</button>' +
                            '<button class="btn btn-no" onclick="accion(\'' + s.id + '\',\'rechazada\')">❌ Rechazar</button>' +
                        '</div>' : '') +
                    '</div>';
                }).join('');

                loadStats();
            } catch(e) { console.error(e); }
        }

        async function accion(id, estado) {
            const btn = event.target;
            btn.textContent = '...';
            btn.disabled = true;
            
            try {
                await fetch(API + '/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado })
                });
                cargar(tabActual);
            } catch(e) { 
                console.error(e);
                btn.textContent = estado === 'aceptada' ? '✅ Aceptar' : '❌ Rechazar';
                btn.disabled = false;
            }
        }

        function recargar() {
            loadStats();
            cargar(tabActual);
        }

        // Auto-refresh cada 10 segundos
        setInterval(loadStats, 10000);

        loadStats();
        cargar('pendiente');
    </script>
</body>
</html>`;

  return res.status(200).send(html);
}
