// Этот лог сработает ВСЕГДА, как только скрипт загрузится.
console.log('app.js СТАРТОВАЛ');

(function() {
    // --- БЛОК ОТЛАДКИ ---
    const debugLog = document.getElementById('debug-log');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const copyLogBtn = document.getElementById('copy-log-btn');
    function logToScreen(message) { if (debugLog) { const time = new Date().toLocaleTimeString(); debugLog.innerHTML += `[${time}] ${message}\n`; debugLog.scrollTop = debugLog.scrollHeight; } console.log(message); }
    logToScreen('app.js успешно загружен и готов к работе.');
    if (clearLogBtn) { clearLogBtn.addEventListener('click', () => { debugLog.innerHTML = ''; }); }
    if (copyLogBtn) { copyLogBtn.addEventListener('click', () => { navigator.clipboard.writeText(debugLog.innerText).then(() => alert('Лог скопирован!')).catch(err => alert('Ошибка копирования: ' + err)); }); }
    // --- КОНЕЦ БЛОКА ОТЛАДКИ ---
    
    // --- ЭЛЕМЕНТЫ DOM ---
    // Экраны
    const screens = document.querySelectorAll('.screen');
    const authScreen = document.getElementById('auth-screen');
    const startShiftScreen = document.getElementById('start-shift-screen');
    const mainApp = document.getElementById('main-app');
    const historyScreen = document.getElementById('history-screen');
    // Формы авторизации
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    // Экран начала смены
    const userEmailDisplay = document.getElementById('user-email-display');
    const openShiftBtn = document.getElementById('open-shift-btn');
    const historyBtn = document.getElementById('history-btn');
    const logoutBtn = document.getElementById('logout-btn');
    // Основное приложение
    const addressInput = document.getElementById('address-input');
    const suggestContainer = document.getElementById('my-suggest-container');
    const newTripBtn=document.getElementById('new-trip-btn'); 
    const endShiftBtn=document.getElementById('end-shift-btn'); 
    const currentTripSection=document.getElementById('current-trip-section'); 
    const addOrderBtn=document.getElementById('add-order-btn'); 
    const currentOrdersList=document.getElementById('current-orders-list'); 
    const tripTotalSpan=document.getElementById('trip-total'); 
    const endTripBtn=document.getElementById('end-trip-btn'); 
    const shiftSummarySection=document.getElementById('shift-summary-section'); 
    const shiftTripsCount=document.getElementById('shift-trips-count'); 
    const shiftTotalEarnings=document.getElementById('shift-total-earnings');
    const goToStartScreenBtn = document.getElementById('go-to-start-screen-btn');
    const historyList=document.getElementById('history-list'); 
    // Экран истории
    const fullHistoryList = document.getElementById('full-history-list');
    const backToStartScreenBtn = document.getElementById('back-to-start-screen-btn');


    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let authToken = localStorage.getItem('courierAuthToken');
    let userEmail = localStorage.getItem('courierUserEmail');
    let userCoords = null;
    let zonesGeoJSON; 
    let currentTrip = []; 
    let shiftHistory = [];

    // --- УПРАВЛЕНИЕ ЭКРАНАМИ ---
    function showScreen(screenId) {
        screens.forEach(s => s.classList.add('hidden'));
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) {
            screenToShow.classList.remove('hidden');
        } else {
            logToScreen(`Ошибка: экран с id "${screenId}" не найден.`);
        }
    }

    // --- УПРАВЛЕНИЕ ФОРМАМИ ВХОДА/РЕГИСТРАЦИИ ---
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

    // --- ЛОГИКА АВТОРИЗАЦИИ ---
    async function apiFetch(endpoint, options = {}) {
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (authToken) {
            defaultHeaders['Authorization'] = `Bearer ${authToken}`;
        }
        options.headers = { ...defaultHeaders, ...options.headers };

        const response = await fetch(`/.netlify/functions/api${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Неизвестная ошибка сервера');
        }
        return data;
    }

    loginBtn.addEventListener('click', async () => {
        try {
            const data = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ email: loginEmailInput.value, password: loginPasswordInput.value })
            });
            authToken = data.token;
            userEmail = data.email;
            localStorage.setItem('courierAuthToken', authToken);
            localStorage.setItem('courierUserEmail', userEmail);
            userEmailDisplay.textContent = userEmail;
            showScreen('start-shift-screen');
        } catch (error) {
            alert(`Ошибка входа: ${error.message}`);
        }
    });

    registerBtn.addEventListener('click', async () => {
        try {
            await apiFetch('/register', {
                method: 'POST',
                body: JSON.stringify({ email: registerEmailInput.value, password: registerPasswordInput.value })
            });
            alert('Регистрация прошла успешно! Теперь вы можете войти.');
            showLoginLink.click(); // Переключаем на форму входа
        } catch (error) {
            alert(`Ошибка регистрации: ${error.message}`);
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите выйти? Незавершенная смена будет потеряна.')) {
            localStorage.clear(); // Очищаем всё
            authToken = null;
            userEmail = null;
            showScreen('auth-screen');
        }
    });

    // --- ЛОГИКА ИСТОРИИ ---
    historyBtn.addEventListener('click', async () => {
        try {
            const shifts = await apiFetch('/shifts');
            fullHistoryList.innerHTML = '';
            if (shifts.length === 0) {
                fullHistoryList.innerHTML = '<p>История смен пуста.</p>';
            } else {
                shifts.forEach(shift => {
                    const shiftDetails = document.createElement('details');
                    const shiftSummary = document.createElement('summary');
                    const shiftDate = new Date(shift.date).toLocaleString('ru-RU');
                    shiftSummary.innerHTML = `Смена от ${shiftDate} - <b>${shift.totalEarnings} ₽</b> (${shift.tripCount} рейсов)`;
                    
                    const tripList = document.createElement('ul');
                    shift.trips.forEach((trip, index) => {
                        const tripTotal = trip.orders.reduce((sum, order) => sum + order.price, 0);
                        const tripLi = document.createElement('li');
                        tripLi.innerHTML = `Рейс #${shift.trips.length - index}: ${tripTotal} ₽ (${trip.orders.length} зак.)`;
                        tripList.appendChild(tripLi);
                    });
                    shiftDetails.appendChild(shiftSummary);
                    shiftDetails.appendChild(tripList);
                    fullHistoryList.appendChild(shiftDetails);
                });
            }
            showScreen('history-screen');
        } catch (error) {
            alert(`Не удалось загрузить историю: ${error.message}`);
        }
    });
    backToStartScreenBtn.addEventListener('click', () => showScreen('start-shift-screen'));


    // --- ЛОГИКА РАБОТЫ СО СМЕНОЙ ---
    function saveState() { /*...*/ }
    function loadState() { /*...*/ }
    function clearState() { /*...*/ }
    // ... (Все эти функции и другие обработчики остаются здесь, но вызываются из нового контекста)
    
    // ПЕРЕНОСИМ ВСЮ ЛОГИКУ ПРИЛОЖЕНИЯ ВНИЗ

    // ... (Весь код из предыдущих шагов, который отвечает за рейсы, заказы, ymaps и т.д.)
    
    // --- НАЧАЛЬНАЯ ЗАГРУЗКА ПРИЛОЖЕНИЯ ---
    function initializeApp() {
        if (authToken) {
            logToScreen(`Найден токен, пользователь: ${userEmail}`);
            userEmailDisplay.textContent = userEmail;
            if (localStorage.getItem('shiftInProgress') === 'true') {
                logToScreen("Обнаружена активная смена, восстанавливаю...");
                loadState();
                if (typeof ymaps !== 'undefined') { ymaps.ready(init); }
                showScreen('main-app');
            } else {
                showScreen('start-shift-screen');
            }
        } else {
            logToScreen("Токен не найден, показываю экран входа.");
            showScreen('auth-screen');
        }
    }

    initializeApp();

})();
