const API_URL = 'https://68bb0dec84055bce63f1058f.mockapi.io/api/v1/';

const controlContainer = document.getElementById('control-container');
const alertContainer = document.getElementById('alert-container');

async function fetchDevices() {
    const response = await fetch(`${API_URL}/dispositivos`);
    const allItems = await response.json();
    return allItems.filter(item => item.tipo && item.tipo.toLowerCase() !== 'log');
}

async function updateDevice(id, data) {
    await fetch(`${API_URL}/dispositivos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function createHistoryLog(logData) {
    const logObject = {
        nombre: logData.nombreDispositivo,
        tipo: 'log',
        ultimevento: logData.evento,
        valor: logData.valor,
        ultimaactividad: Math.floor(Date.now() / 1000),
        estado: null
    };
    await fetch(`${API_URL}/dispositivos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logObject)
    });
}

// ==================================================================
// NUEVA FUNCIÓN AUXILIAR PARA REGISTRAR LOS CAMBIOS DE NIVEL
// ==================================================================
/**
 * Compara el valor antiguo y nuevo de un sensor y registra si se cruzó un umbral del 10%.
 * @param {object} device - El objeto del dispositivo sensor.
 * @param {number} oldValue - El valor de nivel antes del cambio.
 * @param {number} newValue - El valor de nivel después del cambio.
 */
function checkAndLogThresholds(device, oldValue, newValue) {
    const thresholds = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    thresholds.forEach(th => {
        // Revisa si se cruzó un umbral hacia arriba (llenándose)
        if (oldValue < th && newValue >= th) {
            createHistoryLog({
                nombreDispositivo: device.nombre,
                evento: 'Nivel ha llegado al',
                valor: `${th}% de capacidad`
            });
        }
        // Revisa si se cruzó un umbral hacia abajo (vaciándose)
        if (oldValue > th && newValue <= th) {
            createHistoryLog({
                nombreDispositivo: device.nombre,
                evento: 'Nivel ha disminuido al',
                valor: `${th}% de capacidad`
            });
        }
    });
}


function showAlert(message, type = 'info') {
    const alertHtml = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
    alertContainer.innerHTML = alertHtml;
}

function renderControls(devices) {
    controlContainer.innerHTML = '';
    devices.forEach(device => {
        let cardHtml = '';
        if (device.tipo.toLowerCase() === 'actuador') {
            cardHtml = `<div class="col-md-6 col-lg-3 mb-3"><div class="card"><div class="card-body text-center"><h5 class="card-title">${device.nombre}</h5><div class="form-check form-switch fs-3 d-inline-block"><input class="form-check-input" type="checkbox" role="switch" id="switch-${device.id}" data-device-id="${device.id}" ${device.estado ? 'checked' : ''}></div></div></div></div>`;
        } else if (device.tipo.toLowerCase() === 'sensor') {
            const buttonHtml = device.nombre.toLowerCase().includes("principal") ? `<button class="btn btn-danger btn-sm mt-2" data-device-id="${device.id}" data-current-value="${device.valor}">Simular Consumo (-5%)</button>` : '';
            cardHtml = `<div class="col-md-6 col-lg-3 mb-3"><div class="card"><div class="card-body"><h5 class="card-title">${device.nombre}</h5><div class="progress" style="height: 30px;"><div class="progress-bar" role="progressbar" style="width: ${device.valor}%;">${device.valor}%</div></div>${buttonHtml}</div></div></div>`;
        }
        controlContainer.innerHTML += cardHtml;
    });
    addEventListeners(devices);
}

function addEventListeners(devices) {
    const pumpSwitches = document.querySelectorAll('input[id^="switch-"]');
    pumpSwitches.forEach(pumpSwitch => {
        pumpSwitch.addEventListener('change', async (event) => {
            const deviceId = event.target.dataset.deviceId;
            const device = devices.find(d => d.id === deviceId);
            const newState = event.target.checked;
            const eventText = newState ? 'Encendido Manual' : 'Apagado Manual';
            
            await updateDevice(device.id, { estado: newState, ultimaactividad: Math.floor(Date.now() / 1000), ultimevento: eventText });
            await createHistoryLog({ nombreDispositivo: device.nombre, evento: eventText, valor: newState ? 'Encendido' : 'Apagado' });
            await mainCycle();
        });
    });

    const consumeButton = document.querySelector('button[data-device-id]');
    if (consumeButton) {
        consumeButton.addEventListener('click', async () => {
            const deviceId = consumeButton.dataset.deviceId;
            const device = devices.find(d => d.id === deviceId);
            const oldValue = parseInt(consumeButton.dataset.currentValue);
            const newValue = Math.max(0, oldValue - 10); // Aumentado a 10% para cruzar umbrales
            
            await updateDevice(deviceId, { valor: newValue, ultimaactividad: Math.floor(Date.now() / 1000), ultimevento: "Consumo de agua simulado" });
            
            // AÑADIDO: Se llama a la función para registrar el cambio de umbral
            checkAndLogThresholds(device, oldValue, newValue);
            
            await mainCycle();
        });
    }
}

function findDevices(devices) {
    const mainPump = devices.find(d => d.tipo && d.tipo.toLowerCase() === 'actuador' && d.nombre.toLowerCase().includes("bombadeagua") && !d.nombre.toLowerCase().includes("respaldo"));
    const backupPump = devices.find(d => d.tipo && d.tipo.toLowerCase() === 'actuador' && d.nombre.toLowerCase().includes("respaldo"));
    const mainSensor = devices.find(d => d.tipo && d.tipo.toLowerCase() === 'sensor' && d.nombre.toLowerCase().includes("principal"));
    const backupSensor = devices.find(d => d.tipo && d.tipo.toLowerCase() === 'sensor' && d.nombre.toLowerCase().includes("respaldo"));
    return { mainPump, backupPump, mainSensor, backupSensor };
}

function checkSystemAlerts(devices) {
    const { mainPump, mainSensor, backupSensor } = findDevices(devices);
    if (!mainPump || !mainSensor || !backupSensor) return;
    
    alertContainer.innerHTML = '';
    if (mainSensor.valor <= 25) showAlert('<strong>Alerta:</strong> El tinaco principal tiene 25% o menos de capacidad.', 'warning');
    if (mainSensor.valor >= 95) showAlert('<strong>Información:</strong> El tinaco principal está lleno.', 'info');
    if (mainPump.estado && backupSensor.valor <= 0) {
        showAlert('<strong>¡PELIGRO!</strong> El tinaco de respaldo está vacío. La bomba principal se ha apagado para evitar daños.', 'danger');
        updateDevice(mainPump.id, { estado: false, ultimaactividad: Math.floor(Date.now() / 1000), ultimevento: 'Apagado de Seguridad' });
        createHistoryLog({ nombreDispositivo: mainPump.nombre, evento: 'Apagado de Seguridad', valor: 'Apagado' });
    }
    if (backupSensor.valor >= 95) showAlert('<strong>Información:</strong> El tinaco de respaldo está lleno.', 'success');
}

async function runSimulation(devices) {
    const { mainPump, backupPump, mainSensor, backupSensor } = findDevices(devices);
    if (!mainPump || !backupPump || !mainSensor || !backupSensor) return;

    const nowSeconds = Math.floor(Date.now() / 1000);

    // Lógica para la bomba principal
    if (mainPump.estado && mainSensor.valor < 100 && backupSensor.valor > 0) {
        const oldMainValue = mainSensor.valor;
        const oldBackupValue = backupSensor.valor;
        const newMainValue = Math.min(100, oldMainValue + 5);
        const newBackupValue = Math.max(0, oldBackupValue - 10);

        await Promise.all([
            updateDevice(mainSensor.id, { valor: newMainValue, ultimaactividad: nowSeconds, ultimevento: "Recibiendo agua..." }),
            updateDevice(backupSensor.id, { valor: newBackupValue, ultimaactividad: nowSeconds, ultimevento: "Transfiriendo agua..." })
        ]);

        // AÑADIDO: Se registran los cambios de umbral para ambos tinacos
        checkAndLogThresholds(mainSensor, oldMainValue, newMainValue);
        checkAndLogThresholds(backupSensor, oldBackupValue, newBackupValue);
    }

    // Lógica para la bomba de respaldo
    if (backupPump.estado && backupSensor.valor < 100) {
        const oldBackupValue = backupSensor.valor;
        const newBackupValue = Math.min(100, oldBackupValue + 10);
        await updateDevice(backupSensor.id, { valor: newBackupValue, ultimaactividad: nowSeconds, ultimevento: "Llenando..." });
        
        // AÑADIDO: Se registran los cambios de umbral para el tinaco de respaldo
        checkAndLogThresholds(backupSensor, oldBackupValue, newBackupValue);
    }
}

async function mainCycle() {
    try {
        let devices = await fetchDevices();
        await runSimulation(devices);
        let updatedDevices = await fetchDevices();
        renderControls(updatedDevices);
        checkSystemAlerts(updatedDevices);
    } catch (error) {
        console.error("Error en el ciclo principal:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    mainCycle();
    setInterval(mainCycle, 3000);
});