const API_URL = 'https://68bb0dec84055bce63f1058f.mockapi.io/api/v1/';

const statusContainer = document.getElementById('status-container');
const statusHistoryTable = document.getElementById('status-history-table');

const CAPACIDAD_PRINCIPAL = 2000;
const CAPACIDAD_RESPALDO = 1000;

async function fetchAllData() {
    try {
        const response = await fetch(`${API_URL}/dispositivos`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error de red al obtener datos:", error);
        return [];
    }
}

function renderStatusCards(devices) {
    statusContainer.innerHTML = '';
    if (!Array.isArray(devices) || devices.length === 0) {
        statusContainer.innerHTML = '<div class="alert alert-warning">No se encontraron dispositivos.</div>';
        return;
    }
    
    devices.forEach(device => {
        let cardHtml = '';
        const eventTime = new Date(device.ultimaactividad * 1000).toLocaleString();
        if (device.tipo.toLowerCase() === 'actuador') {
            const statusText = device.estado ? 'ENCENDIDA' : 'APAGADA';
            cardHtml = `<div class="col-md-6 col-lg-3 mb-3"><div class="card text-center h-100"><div class="card-body"><h5 class="card-title">${device.nombre}</h5><i class="bi ${device.estado ? 'bi-power text-success' : 'bi-power text-danger'}" style="font-size: 3rem;"></i><p class="card-text fs-4">${statusText}</p></div><div class="card-footer text-muted">${device.ultimevento}: ${eventTime}</div></div></div>`;
        } else if (device.tipo.toLowerCase() === 'sensor') {
            const capacidad = device.nombre.toLowerCase().includes('principal') ? CAPACIDAD_PRINCIPAL : CAPACIDAD_RESPALDO;
            const litros = Math.round((device.valor / 100) * capacidad);
            const progressColor = device.valor < 25 ? 'bg-danger' : (device.valor < 50 ? 'bg-warning' : 'bg-success');
            cardHtml = `<div class="col-md-6 col-lg-3 mb-3"><div class="card h-100"><div class="card-body"><h5 class="card-title text-center">${device.nombre}</h5><p class="text-center text-muted">${litros} L / ${capacidad} L</p><div class="progress" style="height: 30px;"><div class="progress-bar ${progressColor}" role="progressbar" style="width: ${device.valor}%;">${device.valor}%</div></div></div><div class="card-footer text-muted">Última lectura: ${eventTime}</div></div></div>`;
        }
        statusContainer.innerHTML += cardHtml;
    });
}

function renderStatusTable(historyLogs) {
    statusHistoryTable.innerHTML = '';
    if (!Array.isArray(historyLogs) || historyLogs.length === 0) {
        statusHistoryTable.innerHTML = '<tr><td colspan="4" class="text-center">No hay eventos en el historial.</td></tr>';
        return;
    }
    
    // Ordena por fecha (más reciente primero) y toma los últimos 10
    const sortedLogs = historyLogs.sort((a, b) => b.ultimaactividad - a.ultimaactividad).slice(0, 10);
    
    sortedLogs.forEach(log => {
        const row = `
            <tr>
                <td>${log.nombre}</td>
                <td>${log.ultimevento}</td>
                <td>${log.valor}</td>
                <td>${new Date(log.ultimaactividad * 1000).toLocaleString()}</td>
            </tr>`;
        statusHistoryTable.innerHTML += row;
    });
}

async function updateDashboard() {
    try {
        const allItems = await fetchAllData();
        
        // Separa los dispositivos reales de los registros de log
        const devices = allItems.filter(item => item.tipo.toLowerCase() !== 'log');
        const historyLogs = allItems.filter(item => item.tipo.toLowerCase() === 'log');
        
        renderStatusCards(devices);
        renderStatusTable(historyLogs);
    } catch (error) {
        console.error("Error al actualizar el dashboard:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateDashboard();
    setInterval(updateDashboard, 2000);
});