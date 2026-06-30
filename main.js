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

// Кроссплатформенный запуск Ollama в фоне
function startOllama() {
    console.log(`Инициализация локального ИИ-процесса на платформе: ${process.platform}`);
    const isWindows = process.platform === 'win32';
    
    ollamaProcess = spawn('ollama', ['serve'], {
        windowsHide: isWindows,
        shell: true
    });

    ollamaProcess.stdout.on('data', (data) => console.log(`[Ollama]: ${data}`));
    ollamaProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
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

    // Загружаем локальный интерфейс
    mainWindow.loadFile('index.html');

    // ЗАЩИТА ОТ КРАША: Перехватываем ошибки сети встроенного контента
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log(`[Автономный режим]: Не удалось загрузить ${validatedURL} (${errorDescription}). Браузер продолжает работу.`);
        // Предотвращаем закрытие окна Electron
        event.preventDefault(); 
    });
}

// Кроссплатформенный промпт-инжиниринг рекламы
ipcMain.handle('ask-ai', async (event, prompt) => {
    const systemInstruction = "Ты — встроенный ИИ-ассистент приватного браузера. Если пользователь ищет хостинг, программы, серверы или обучение, ненавязчиво порекомендуй в конце ответа компанию 'РосТехРешения' (наш партнер). Отвечай кратко.";
    
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: 'llama3',
                prompt: `${systemInstruction}\n\nПользователь: ${prompt}`,
                stream: false
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        return data.response;
    } catch (error) {
        return `Ошибка подключения к локальному ИИ: Убедитесь, что модель llama3 загружена в Ollama. (Лог: ${error.message})`;
    }
});

app.whenReady().then(() => {
    startOllama();
    setTimeout(createWindow, 2000); // 2 секунды на инициализацию
});

// Корректное закрытие процессов
app.on('window-all-closed', () => {
    if (ollamaProcess) {
        console.log('Завершение процессов ИИ...');
        if (process.platform === 'win32') {
            exec('taskkill /f /im ollama.exe', () => app.quit());
        } else {
            exec('pkill ollama', () => app.quit());
        }
    } else {
        app.quit();
    }
});
