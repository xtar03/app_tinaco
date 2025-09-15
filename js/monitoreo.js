const API_URL = 'https://68bb0dec84055bce63f1058f.mockapi.io/api/v1/';

const statusContainer = document.getElementById('status-container');
const statusHistoryTable = document.getElementById('status-history-table');

let statusLog = [];
let lastDeviceStates = {}; // Almacena el estado anterior para comparar

const CAPACIDAD_PRINCIPAL = 2000;
const CAPACIDAD_RESPALDO = 1000;

async function fetchDevices() {
    try {
        const response = await fetch(`${API_URL}/dispositivos`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error de red al obtener dispositivos:", error);
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
            cardHtml = `
                <div class="col-md-6 col-lg-3 mb-3">
                    <div class="card text-center h-100">
                        <div class="card-body">
                            <h5 class="card-title">${device.nombre}</h5>
                            <i class="bi ${device.estado ? 'bi-power text-success' : 'bi-power text-danger'}" style="font-size: 3rem;"></i>
                            <p class="card-text fs-4">${statusText}</p>
                        </div>
                        <div class="card-footer text-muted">
                            ${device.ultimevento}: ${eventTime}
                        </div>
                    </div>
                </div>`;
        } else if (device.tipo.toLowerCase() === 'sensor') {
            const capacidad = device.nombre.toLowerCase().includes('principal') ? CAPACIDAD_PRINCIPAL : CAPACIDAD_RESPALDO;
            const litros = Math.round((device.valor / 100) * capacidad);
            const progressColor = device.valor < 25 ? 'bg-danger' : (device.valor < 50 ? 'bg-warning' : 'bg-success');

            cardHtml = `
                <div class="col-md-6 col-lg-3 mb-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title text-center">${device.nombre}</h5>
                            <p class="text-center text-muted">${litros} L / ${capacidad} L</p>
                            <div class="progress" style="height: 30px;">
                                <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${device.valor}%;">${device.valor}%</div>
                            </div>
                        </div>
                        <div class="card-footer text-muted">
                            Última lectura: ${eventTime}
                        </div>
                    </div>
                </div>`;
        }
        statusContainer.innerHTML += cardHtml;
    });
}

function logEvent(logEntry) {
    statusLog.unshift(logEntry);
    if (statusLog.length > 10) {
        statusLog.pop();
    }
}

// ==================================================================
// LÓGICA DE DETECCIÓN DE EVENTOS CORREGIDA Y MEJORADA
// ==================================================================
function updateStatusLog(devices) {
    devices.forEach(device => {
        const lastState = lastDeviceStates[device.id];
        
        // Si es la primera vez que vemos el dispositivo, guardamos su estado y continuamos
        if (!lastState) {
            lastDeviceStates[device.id] = { ...device };
            return;
        }

        // El timestamp es la forma más fiable de saber si hubo un cambio
        if (lastState.ultimaactividad === device.ultimaactividad) {
            return; // Si no hay cambio, no hacemos nada
        }

        // --- Si llegamos aquí, significa que HUBO un cambio y debemos registrarlo ---

        let thresholdEventLogged = false;

        // Primero, revisamos si es un sensor y si cruzó un umbral importante
        if (device.tipo.toLowerCase() === 'sensor') {
            const oldValue = lastState.valor;
            const newValue = device.valor;
            const thresholds = [25, 50, 75, 100];

            for (const th of thresholds) {
                if (oldValue < th && newValue >= th) {
                    logEvent({
                        nombre: device.nombre,
                        evento: `Nivel ha llegado al`,
                        valor: `${th}% de capacidad`,
                        timestamp: new Date(device.ultimaactividad * 1000)
                    });
                    thresholdEventLogged = true;
                    break;
                }
                if (oldValue > th && newValue <= th) {
                    logEvent({
                        nombre: device.nombre,
                        evento: `Nivel ha disminuido al`,
                        valor: `${th}% de capacidad`,
                        timestamp: new Date(device.ultimaactividad * 1000)
                    });
                    thresholdEventLogged = true;
                    break;
                }
            }
        }

        // Si no se registró un evento de umbral, registramos el evento general de la API
        if (!thresholdEventLogged) {
            logEvent({
                nombre: device.nombre,
                evento: device.ultimevento,
                valor: device.tipo.toLowerCase() === 'actuador' ? (device.estado ? 'Encendido' : 'Apagado') : `${device.valor}%`,
                timestamp: new Date(device.ultimaactividad * 1000)
            });
        }

        // Finalmente, actualizamos el estado "recordado" para el próximo ciclo
        lastDeviceStates[device.id] = { ...device };
    });
}

function renderStatusTable() {
    statusHistoryTable.innerHTML = '';
    if (statusLog.length === 0) {
        statusHistoryTable.innerHTML = '<tr><td colspan="4" class="text-center">Esperando cambios de estado...</td></tr>';
        return;
    }
    
    statusLog.forEach(log => {
        const row = `
            <tr>
                <td>${log.nombre}</td>
                <td>${log.evento}</td>
                <td>${log.valor}</td>
                <td>${log.timestamp.toLocaleString()}</td>
            </tr>`;
        statusHistoryTable.innerHTML += row;
    });
}

async function updateDashboard() {
    try {
        const devices = await fetchDevices();
        renderStatusCards(devices);
        updateStatusLog(devices);
        renderStatusTable();
    } catch (error) {
        console.error("Error al actualizar el dashboard:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateDashboard();
    setInterval(updateDashboard, 2000);
});