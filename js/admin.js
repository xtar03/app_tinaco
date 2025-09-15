// ==================================================================
// Lógica para la página de Administración (admin.html)
// ==================================================================

const API_URL = 'https://68bb0dec84055bce63f1058f.mockapi.io/api/v1/';
const tableBody = document.getElementById('devices-table-body');
const deviceForm = document.getElementById('deviceForm');
const modal = new bootstrap.Modal(document.getElementById('deviceModal'));

/**
 * Obtiene y muestra la lista de dispositivos (excluyendo los logs).
 */
async function getDevices() {
    const response = await fetch(`${API_URL}/dispositivos`);
    const allItems = await response.json();
    
    const devices = allItems.filter(item => item.tipo && item.tipo.toLowerCase() !== 'log');
    
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

/**
 * Guarda un nuevo dispositivo en la API.
 * @param {Event} e - El evento del formulario.
 */
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

/**
 * Elimina un dispositivo de la API.
 * @param {string} id - El ID del dispositivo a eliminar.
 */
async function deleteDevice(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este dispositivo?')) {
        await fetch(`${API_URL}/dispositivos/${id}`, { method: 'DELETE' });
        getDevices();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    getDevices();
    deviceForm.addEventListener('submit', saveDevice);
});