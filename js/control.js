const API_URL = 'https://68bb0dec84055bce63f1058f.mockapi.io/api/v1/';

const controlContainer = document.getElementById('control-container');
const alertContainer = document.getElementById('alert-container');

async function fetchDevices() {
    const response = await fetch(`${API_URL}/dispositivos`);
    return await response.json();
}

async function updateDevice(id, data) {
    await fetch(`${API_URL}/dispositivos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

// NUEVA FUNCIÓN: Crea un registro de tipo "log" en el endpoint de dispositivos
async function createHistoryLog(logData) {
    const logObject = {
        nombre: logData.nombreDispositivo,
        tipo: 'log', // Marcador especial para identificarlo como un registro
        ultimevento: logData.evento,
        valor: logData.valor, // Usaremos el campo 'valor' para el detalle
        ultimaactividad: Math.floor(Date.now() / 1000),
        estado: null
    };
    await fetch(`${API_URL}/dispositivos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logObject)
    });
}


function showAlert(message, type = 'info') {
    const alertHtml = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
    alertContainer.innerHTML = alertHtml;
}

function renderControls(devices) {
    controlContainer.innerHTML = '';
    const actualDevices = devices.filter(d => d.tipo.toLowerCase() !== 'log');
    actualDevices.forEach(device => {
        let cardHtml = '';
        if (device.tipo.toLowerCase() === 'actuador') {
            cardHtml = `<div class="col-md-6 col-lg-3 mb-3"><div class="card"><div class="card-body text-center"><h5 class="card-title">${device.nombre}</h5><div class="form-check form-switch fs-3 d-inline-block"><input class="form-check-input" type="checkbox" role="switch" id="switch-${device.id}" data-device-id="${device.id}" ${device.estado ? 'checked' : ''}></div></div></div></div>`;
        } else if (device.tipo.toLowerCase() === 'sensor') {
            const buttonHtml = device.nombre.toLowerCase().includes("principal") ? `<button class="btn btn-danger btn-sm mt-2" data-device-id="${device.id}" data-current-value="${device.valor}">Simular Consumo (-5%)</button>` : '';
            cardHtml = `<div class="col-md-6 col-lg-3 mb-3"><div class="card"><div class="card-body"><h5 class="card-title">${device.nombre}</h5><div class="progress" style="height: 30px;"><div class="progress-bar" role="progressbar" style="width: ${device.valor}%;">${device.valor}%</div></div>${buttonHtml}</div></div></div>`;
        }
        controlContainer.innerHTML += cardHtml;
    });
    addEventListeners(actualDevices);
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
            let currentValue = parseInt(consumeButton.dataset.currentValue);
            let newValue = Math.max(0, currentValue - 5);
            
            await updateDevice(deviceId, { valor: newValue, ultimaactividad: Math.floor(Date.now() / 1000), ultimevento: "Consumo de agua simulado" });
            await createHistoryLog({ nombreDispositivo: device.nombre, evento: 'Consumo simulado', valor: `${newValue}%` });
            await mainCycle();
        });
    }
}

function findDevices(devices) {
    const actualDevices = devices.filter(d => d.tipo.toLowerCase() !== 'log');
    const mainPump = actualDevices.find(d => d.tipo.toLowerCase() === 'actuador' && !d.nombre.toLowerCase().includes("respaldo"));
    const backupPump = actualDevices.find(d => d.tipo.toLowerCase() === 'actuador' && d.nombre.toLowerCase().includes("respaldo"));
    const mainSensor = actualDevices.find(d => d.tipo.toLowerCase() === 'sensor' && d.nombre.toLowerCase().includes("principal"));
    const backupSensor = actualDevices.find(d => d.tipo.toLowerCase() === 'sensor' && d.nombre.toLowerCase().includes("respaldo"));
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
    if (mainPump.estado && mainSensor.valor < 100 && backupSensor.valor > 0) {
        const newMainValue = Math.min(100, mainSensor.valor + 5);
        const newBackupValue = Math.max(0, backupSensor.valor - 10);
        await Promise.all([
            updateDevice(mainSensor.id, { valor: newMainValue, ultimaactividad: nowSeconds, ultimevento: "Recibiendo agua..." }),
            updateDevice(backupSensor.id, { valor: newBackupValue, ultimaactividad: nowSeconds, ultimevento: "Transfiriendo agua..." })
        ]);
    }
    if (backupPump.estado && backupSensor.valor < 100) {
        const newBackupValue = Math.min(100, backupSensor.valor + 10);
        await updateDevice(backupSensor.id, { valor: newBackupValue, ultimaactividad: nowSeconds, ultimevento: "Llenando..." });
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