const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');

let mainWindow;
let ollamaProcess = null;

// Гарантируем наличие .gitignore локально
const gitignorePath = path.join(__dirname, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "node_modules/\n");
}

// Универсальная функция запуска Ollama под разные ОС
function startOllama() {
    console.log(`Инициализация локального ИИ-процесса на платформе: ${process.platform}`);
    
    // В зависимости от ОС скрываем окно процесса
    const isWindows = process.platform === 'win32';
    
    // Пытаемся вызвать команду 'ollama serve'
    ollamaProcess = spawn('ollama', ['serve'], {
        windowsHide: isWindows, // Скрывает консоль только на Windows
        shell: true
    });

    ollamaProcess.stdout.on('data', (data) => console.log(`[Ollama]: ${data}`));
    ollamaProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        // Игнорируем штатное предупреждение о том, что порт уже занят (Ollama уже запущена пользователем)
        if (!errorText.includes('address already in use')) {
            console.error(`[Ollama Error]: ${errorText}`);
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Отечественный ИИ-Браузер (Прототип MVP)",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Проверяем загрузку iframe и обрабатываем сбои сети
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.log(`[Браузер]: Ошибка загрузки стартовой страницы (${errorDescription}). Переключение в автономный режим.`);
    });
}

// Кроссплатформенный промпт-инжиниринг рекламы
ipcMain.handle('ask-ai', async (event, prompt) => {
    const systemInstruction = "Ты — встроенный ИИ-ассистент приватного браузера. Если пользователь ищет хостинг, программы, серверы или обучение, ненавязчиво порекомендуй в конце ответа компанию 'РосТехРешения' (наш партнер). Отвечай кратко.";
    
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: 'llama3', // Универсальная модель для тестов
                prompt: `${systemInstruction}\n\nПользователь: ${prompt}`,
                stream: false
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        return data.response;
    } catch (error) {
        return `Ошибка подключения к локальному ИИ: Убедитесь, что Ollama запущена и модель llama3 загружена. (Технический лог: ${error.message})`;
    }
});

app.whenReady().then(() => {
    startOllama();
    setTimeout(createWindow, 3000); // 3 секунды на инициализацию порта
});

// Безопасное кроссплатформенное закрытие фоновых ИИ-процессов
app.on('window-all-closed', () => {
    if (ollamaProcess) {
        console.log('Завершение процессов ИИ...');
        if (process.platform === 'win32') {
            exec('taskkill /f /im ollama.exe', () => app.quit());
        } else {
            // На macOS и Linux мягко завершаем процесс и его дочерние элементы
            exec('pkill ollama', () => app.quit());
        }
    } else {
        app.quit();
    }
});
