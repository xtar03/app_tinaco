const API_URL = 'https://68bb0dec84055bce63f1058f.mockapi.io/api/v1/'; // URL Implementada

const tableBody = document.getElementById('devices-table-body');
const deviceForm = document.getElementById('deviceForm');
const modal = new bootstrap.Modal(document.getElementById('deviceModal'));

async function getDevices() {
    const response = await fetch(`${API_URL}/dispositivos`);
    const devices = await response.json();
    tableBody.innerHTML = '';
    devices.forEach(device => {
        tableBody.innerHTML += `
            <tr>
                <td>${device.nombre}</td>
                <td>${device.tipo}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteDevice('${device.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

async function saveDevice(e) {
    e.preventDefault();
    
    const device = {
        nombre: document.getElementById('deviceName').value,
        tipo: document.getElementById('deviceType').value,
        estado: false,
        valor: 0,
        ultimaactividad: Math.floor(Date.now() / 1000),
        ultimevento: 'Dispositivo Creado'
    };

    await fetch(`${API_URL}/dispositivos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device)
    });
    
    deviceForm.reset();
    modal.hide();
    getDevices();
}

async function deleteDevice(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este dispositivo?')) {
        await fetch(`${API_URL}/dispositivos/${id}`, { method: 'DELETE' });
        getDevices();
    }
}

deviceForm.addEventListener('submit', saveDevice);
getDevices();