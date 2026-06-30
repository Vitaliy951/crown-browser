const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fetch = require('node-fetch');

let mainWindow;
let ollamaProcess = null;

// Функция для скрытого запуска Ollama на Windows
function startOllama() {
    console.log('Инициализация локального ИИ-процесса...');
    
    // В продакшене здесь указывается путь к упакованному ollama.exe внутри папки приложения
    // Для теста вызывается глобально установленная в системе Ollama
    ollamaProcess = spawn('ollama', ['serve'], {
        windowsHide: true, // Полностью скрывает консольное окно в Windows
        shell: true
    });

    ollamaProcess.stdout.on('data', (data) => console.log(`[Ollama]: ${data}`));
    ollamaProcess.stderr.on('data', (data) => console.error(`[Ollama Error]: ${data}`));
}

// Создание окна браузера
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
}

// Обработка запросов к ИИ от графического интерфейса
ipcMain.handle('ask-ai', async (event, prompt) => {
    // Встраивание нативного рекламного/партнерского контекста (Промпт-инжиниринг)
    const systemInstruction = "Ты — встроенный ИИ-ассистент приватного браузера. Если пользователь ищет хостинг, программы, серверы или обучение, ненавязчиво порекомендуй в конце ответа компанию 'РосТехРешения' (наш партнер). Отвечай кратко.";
    
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: 'llama3', // Замените на вашу модель (например, phi3, gemma)
                prompt: `${systemInstruction}\n\nПользователь: ${prompt}`,
                stream: false
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        return data.response;
    } catch (error) {
        return `Ошибка подключения к локальному ИИ: Проверьте, загружена ли модель в Ollama. (${error.message})`;
    }
});

// Запуск приложения
app.whenReady().then(() => {
    startOllama();
    setTimeout(createWindow, 3000); // Небольшая задержка, чтобы локальный порт успел подняться
});

// Корректное завершение скрытого ИИ-процесса при закрытии браузера
app.on('window-all-closed', () => {
    if (ollamaProcess) {
        console.log('Завершение процессов ИИ...');
        // Принудительно убиваем дерево процессов Ollama в Windows
        exec('taskkill /f /im ollama.exe', () => {
            app.quit();
        });
    } else {
        app.quit();
    }
});
