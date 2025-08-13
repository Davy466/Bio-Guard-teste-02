// ===== VARIÁVEIS GLOBAIS =====
let bluetoothDevice = null;
let bluetoothServer = null;
let characteristic = null;
let isConnected = false;
let dataReadInterval = null; // Variável para armazenar o ID do intervalo de leitura

// UUIDs que devem coincidir com o ESP32
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const CHARACTERISTIC_UUID = '87654321-4321-4321-4321-cba987654321';

// Elementos do DOM
const connectBtn = document.getElementById('connectBtn');
const statusElement = document.getElementById('status');
const thermometerFill = document.getElementById('thermometerFill');
const rgbDataElement = document.getElementById('rgbData');
const ldrValueElement = document.getElementById('ldrValue');

// ===== FUNÇÃO PRINCIPAL DE CONEXÃO BLE =====
async function connectToBioGuard() {
    try {
        // Verifica se o navegador suporta Web Bluetooth
        if (!navigator.bluetooth) {
            alert('Web Bluetooth não é suportado neste navegador. Use Chrome ou Edge.');
            return;
        }

        // Mostra loading no botão
        connectBtn.innerHTML = '<span class="loading"></span> Conectando...';
        connectBtn.disabled = true;
        updateStatus('Procurando dispositivos...', 'disconnected');

        // Solicita dispositivo Bluetooth
        console.log('Solicitando dispositivo Bluetooth...');
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{
                name: 'ESP32-AguaAnalyzer'
            }],
            optionalServices: [SERVICE_UUID]
        });

        console.log('Dispositivo selecionado:', bluetoothDevice.name);
        updateStatus('Conectando ao ' + bluetoothDevice.name + '...', 'disconnected');

        // Adiciona listener para desconexão
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        // Conecta ao servidor GATT
        console.log('Conectando ao servidor GATT...');
        bluetoothServer = await bluetoothDevice.gatt.connect();

        console.log('Obtendo serviço primário...');
        const service = await bluetoothServer.getPrimaryService(SERVICE_UUID);

        console.log('Obtendo característica...');
        characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        // Inicia notificações
        console.log('Iniciando notificações...');
        await characteristic.startNotifications();

        // Adiciona listener para dados recebidos
        characteristic.addEventListener('characteristicvaluechanged', handleDataReceived);

        // Atualiza interface
        isConnected = true;
        connectBtn.innerHTML = 'Desconectar';
        connectBtn.disabled = false;
        connectBtn.onclick = disconnect;
        updateStatus('Conectado com sucesso!', 'connected');

        // Inicia a leitura de dados a cada 2 segundos
        dataReadInterval = setInterval(readCharacteristicValue, 2000);

        console.log('Conexão estabelecida com sucesso!');

    } catch (error) {
        console.error('Erro na conexão:', error);
        connectBtn.innerHTML = 'Conectar ao Bio-Guard via Bluetooth';
        connectBtn.disabled = false;
        connectBtn.onclick = connectToBioGuard;
        updateStatus('Erro na conexão: ' + error.message, 'disconnected');
    }
}

// ===== FUNÇÃO PARA PROCESSAR DADOS RECEBIDOS =====
function handleDataReceived(event) {
    try {
        // Decodifica os dados recebidos
        const value = new TextDecoder().decode(event.target.value);
        console.log('Dados recebidos:', value);

        // Parse dos dados no formato: "Cor: Vermelho Muito Escuro | Contaminação: Alta | Intensidade Luz: 45%"
        const parts = value.split(' | ');
        
        if (parts.length >= 3) {
            // Extrai informações da cor e contaminação
            const corInfo = parts[0]; // "Cor: Vermelho Muito Escuro"
            const contaminacaoInfo = parts[1]; // "Contaminação: Alta"
            const luzInfo = parts[2]; // "Intensidade Luz: 45%"

            // Atualiza os dados do RGB na interface
            rgbDataElement.innerHTML = `<div>${corInfo}</div><div>${contaminacaoInfo}</div>`;

            // Atualiza os dados do LDR na interface
            ldrValueElement.textContent = luzInfo.replace('Intensidade Luz: ', '');

            // Lógica para atualizar o termômetro (Ajustar conforme a análise)
            const contaminacaoNivel = contaminacaoInfo.replace('Contaminação: ', '').toLowerCase();
            thermometerFill.classList.remove('level-baixa', 'level-media', 'level-alta');

            let fillHeight = 0;
            if (contaminacaoNivel.includes('muito escuro')) {
                thermometerFill.classList.add('level-alta'); // Vermelho intenso
                fillHeight = 100; // 100% para muito escuro (alta contaminação)
            } else if (contaminacaoNivel.includes('normal')) {
                thermometerFill.classList.add('level-media'); // Laranja
                fillHeight = 66; // 66% para normal (média contaminação)
            } else if (contaminacaoNivel.includes('muito claro')) {
                thermometerFill.classList.add('level-baixa'); // Amarelo
                fillHeight = 33; // 33% para muito claro (baixa contaminação)
            }
            thermometerFill.style.height = `${fillHeight}%`;

        } else {
            console.warn('Formato de dados inesperado:', value);
        }

    } catch (error) {
        console.error('Erro ao processar dados recebidos:', error);
    }
}

// ===== FUNÇÃO PARA ATUALIZAR STATUS DA CONEXÃO =====
function updateStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
}

// ===== FUNÇÃO DE DESCONEXÃO =====
function onDisconnected() {
    isConnected = false;
    connectBtn.innerHTML = 'Conectar ao Bio-Guard via Bluetooth';
    connectBtn.disabled = false;
    connectBtn.onclick = connectToBioGuard;
    updateStatus('Desconectado - Clique para conectar', 'disconnected');
    console.log('Dispositivo Bluetooth desconectado.');

    // Limpa o intervalo de leitura de dados quando desconectado
    if (dataReadInterval) {
        clearInterval(dataReadInterval);
        dataReadInterval = null;
        console.log('Intervalo de leitura de dados parado.');
    }
}

// ===== FUNÇÃO PARA DESCONECTAR MANUALMENTE =====
async function disconnect() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        await bluetoothDevice.gatt.disconnect();
    }
}

// ===== FUNÇÃO PARA LER O VALOR DA CARACTERÍSTICA (PARA ATUALIZAÇÃO PERIÓDICA) =====
async function readCharacteristicValue() {
    if (characteristic && isConnected) {
        try {
            // readValue() aciona o evento characteristicvaluechanged, que chama handleDataReceived
            await characteristic.readValue(); 
        } catch (error) {
            console.error("Erro ao ler característica:", error);
        }
    }
}

