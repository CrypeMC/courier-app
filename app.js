(function() {
    // --- ТЕМА (ВЫПОЛНЯЕТСЯ НЕМЕДЛЕННО) ---
    const themeColorMeta = document.getElementById('theme-color-meta');
    function applyTheme(theme) {
        document.body.dataset.theme = theme;
        localStorage.setItem('theme', theme);
        const themeColor = theme === 'dark' ? '#18191a' : '#ffffff';
        if (themeColorMeta) themeColorMeta.content = themeColor;
    }
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(initialTheme);
    // --- КОНЕЦ БЛОКА ТЕМЫ ---

    // --- БЛОК ОТЛАДКИ ---
    const debugLog = document.getElementById('debug-log');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const copyLogBtn = document.getElementById('copy-log-btn');
    let logContent = localStorage.getItem('courierAppLog') || '';
    if(debugLog) debugLog.innerHTML = logContent;
    function logToScreen(message) { 
        if (debugLog) { 
            const time = new Date().toLocaleTimeString(); 
            const newLog = `[${time}] ${message}\n`;
            debugLog.innerHTML += newLog; 
            logContent += newLog;
            localStorage.setItem('courierAppLog', logContent);
            debugLog.scrollTop = debugLog.scrollHeight; 
        } 
        console.log(message); 
    }
    if (clearLogBtn) { clearLogBtn.addEventListener('click', () => { debugLog.innerHTML = ''; logContent = ''; localStorage.removeItem('courierAppLog'); }); }
    if (copyLogBtn) { copyLogBtn.addEventListener('click', () => { navigator.clipboard.writeText(debugLog.innerText).then(() => alert('Лог скопирован!')).catch(err => alert('Ошибка копирования: ' + err)); }); }
    
    // --- ЭЛЕМЕНТЫ DOM ---
    const splashScreen = document.getElementById('splash-screen');
    const appContainer = document.querySelector('.app-container');
    const screens = document.querySelectorAll('.screen');
    const loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), registerNameInput = document.getElementById('register-name'), loginEmailInput = document.getElementById('login-email'), loginPasswordInput = document.getElementById('login-password'), registerEmailInput = document.getElementById('register-email'), registerPasswordInput = document.getElementById('register-password'), loginBtn = document.getElementById('login-btn'), registerBtn = document.getElementById('register-btn'), showRegisterLink = document.getElementById('show-register-link'), showLoginLink = document.getElementById('show-login-link');
    const updateNameScreen = document.getElementById('update-name-screen'), updateNameInput = document.getElementById('update-name-input'), saveNameBtn = document.getElementById('save-name-btn');
    const userNameDisplay = document.getElementById('user-name-display'), userEmailDisplay = document.getElementById('user-email-display'), openShiftBtn = document.getElementById('open-shift-btn'), historyBtn = document.getElementById('history-btn'), logoutBtn = document.getElementById('logout-btn');
    const globalThemeToggle = document.getElementById('global-theme-toggle');
    const addressInput = document.getElementById('address-input'), suggestContainer = document.getElementById('my-suggest-container'), newTripBtn = document.getElementById('new-trip-btn'), endShiftBtn = document.getElementById('end-shift-btn'), currentTripSection = document.getElementById('current-trip-section'), addOrderBtn = document.getElementById('add-order-btn'), currentOrdersList = document.getElementById('current-orders-list'), tripTotalSpan = document.getElementById('trip-total'), endTripBtn = document.getElementById('end-trip-btn');
    const shiftSummarySection = document.getElementById('shift-summary-section'), shiftTripsCount = document.getElementById('shift-trips-count'), shiftTotalEarnings = document.getElementById('shift-total-earnings'), goToStartScreenBtn = document.getElementById('go-to-start-screen-btn');
    const fullHistoryList = document.getElementById('full-history-list'), backToStartScreenBtn = document.getElementById('back-to-start-screen-btn'), clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyList=document.getElementById('history-list');

    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let authToken = localStorage.getItem('courierAuthToken');
    let userEmail = localStorage.getItem('courierUserEmail');
    let userName = localStorage.getItem('courierUserName');
    let userCoords = null, zonesGeoJSON, currentTrip = [], shiftHistory = [];
    let mapsInitialized = false;

    // --- УПРАВЛЕНИЕ ЭКРАНАМИ ---
    function showScreen(screenId) {
        logToScreen(`Переключаюсь на экран: ${screenId}`);
        screens.forEach(s => s.classList.add('hidden'));
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) {
            screenToShow.classList.remove('hidden');
            if (screenId !== 'auth-screen' && screenId !== 'update-name-screen') localStorage.setItem('lastActiveScreen', screenId);
        }
    }

    // --- УПРАВЛЕНИЕ ФОРМАМИ ВХОДА/РЕГИСТРАЦИИ ---
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

    // --- СЕТЕВАЯ ЛОГИКА ---
    async function apiFetch(endpoint, options = {}) {
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (authToken) { defaultHeaders['Authorization'] = `Bearer ${authToken}`; }
        options.headers = { ...defaultHeaders, ...options.headers };
        logToScreen(`Отправляю запрос на: ${endpoint}`);
        const response = await fetch(`/.netlify/functions/api${endpoint}`, options);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Неизвестная ошибка сервера (статус ${response.status})`); }
        if (response.status === 201 || response.status === 204) { logToScreen("Запрос успешен (без тела ответа)."); return null; }
        const data = await response.json();
        logToScreen("Получен успешный ответ от сервера.");
        return data;
    }

    // --- ЛОГИКА АВТОРИЗАЦИИ ---
    loginBtn.addEventListener('click', async () => {
        try {
            const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email: loginEmailInput.value, password: loginPasswordInput.value }) });
            authToken = data.token; userEmail = data.email; userName = data.name;
            localStorage.setItem('courierAuthToken', authToken);
            localStorage.setItem('courierUserEmail', userEmail);
            localStorage.setItem('courierUserName', userName);
            initializeApp();
        } catch (error) { alert(`Ошибка входа: ${error.message}`); logToScreen(`Ошибка входа: ${error.message}`);}
    });
    registerBtn.addEventListener('click', async () => {
        try {
            await apiFetch('/register', { method: 'POST', body: JSON.stringify({ name: registerNameInput.value, email: registerEmailInput.value, password: registerPasswordInput.value }) });
            alert('Регистрация прошла успешно! Теперь вы можете войти.');
            showLoginLink.click();
        } catch (error) { alert(`Ошибка регистрации: ${error.message}`); logToScreen(`Ошибка регистрации: ${error.message}`);}
    });
    logoutBtn.addEventListener('click', () => {
        authToken = null; userEmail = null; userName = null;
        localStorage.removeItem('courierAuthToken');
        localStorage.removeItem('courierUserEmail');
        localStorage.removeItem('courierUserName');
        localStorage.removeItem('lastActiveScreen');
        localStorage.removeItem('shiftInProgress');
        sessionStorage.removeItem('splashShown'); // <-- Важно!
        showScreen('auth-screen');
        logToScreen('Пользователь вышел. Все локальные данные очищены.');
    });
    
    saveNameBtn.addEventListener('click', async () => {
        const newName = updateNameInput.value.trim();
        if (!newName) { alert('Имя не может быть пустым'); return; }
        try {
            await apiFetch('/update-name', { method: 'POST', body: JSON.stringify({ name: newName }) });
            userName = newName;
            localStorage.setItem('courierUserName', userName);
            alert('Имя успешно сохранено!');
            initializeApp();
        } catch (error) { alert(`Ошибка сохранения имени: ${error.message}`); logToScreen(`Ошибка сохранения имени: ${error.message}`); }
    });

    // --- ЛОГИКА ТЕМЫ ---
    globalThemeToggle.addEventListener('click', () => {
        const currentTheme = document.body.dataset.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        logToScreen(`Тема переключена на: ${newTheme}`);
    });

    // --- ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ---
    function saveState() {
        if (!userEmail) return;
        const state = { currentTrip: currentTrip, shiftHistory: shiftHistory };
        localStorage.setItem(`courierAppState_${userEmail}`, JSON.stringify(state));
        logToScreen(`Состояние для ${userEmail} сохранено.`);
    }
    function loadState() {
        if (!userEmail) return;
        const savedState = localStorage.getItem(`courierAppState_${userEmail}`);
        if (savedState) {
            logToScreen(`Найдено состояние для ${userEmail}.`);
            const state = JSON.parse(savedState);
            currentTrip = state.currentTrip || [];
            shiftHistory = state.shiftHistory || [];
        }
    }
    function clearLocalShiftData() {
        if (userEmail) localStorage.removeItem(`courierAppState_${userEmail}`);
        localStorage.removeItem('shiftInProgress');
        logToScreen(`Локальные данные смены для ${userEmail} очищены.`);
    }

    // --- ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ ---
    function initMapsAndLogic() {
        if (mapsInitialized) return; 
        if (typeof ymaps === 'undefined') { logToScreen('ОШИБКА: `ymaps` не найден.'); return; }
        ymaps.ready(async () => {
            logToScreen("API Карт готово.");
            mapsInitialized = true;
            try {
                await loadZones();
                const location = await ymaps.geolocation.get({ provider: 'browser' });
                userCoords = location.geoObjects.get(0).geometry.getCoordinates();
                logToScreen(`Местоположение определено.`);
            } catch (e) {
                logToScreen(`Ошибка геолокации или загрузки зон: ${e.message}`);
            }
        });
    }
    async function loadZones(){ try { const response = await fetch('/data/zones.geojson'); if (!response.ok) { throw new Error(`Статус: ${response.status}`); } zonesGeoJSON = await response.json(); logToScreen("Файл зон успешно загружен."); } catch (e) { logToScreen(`Ошибка загрузки зон: ${e.message}`); } }
    
    addressInput.addEventListener('input', async () => {
        const text = addressInput.value;
        if (text.length < 3) { suggestContainer.innerHTML = ''; return; }
        try {
            const endpoint = userCoords ? `/suggest?text=${encodeURIComponent(text)}&lat=${userCoords[0]}&lon=${userCoords[1]}` : `/suggest?text=${encodeURIComponent(text)}`;
            const suggestions = await apiFetch(endpoint);
            renderOurOwnSuggestions(suggestions);
        } catch (e) {
            logToScreen(`Ошибка при получении подсказок: ${e.message}`);
        }
    });

    function renderOurOwnSuggestions(items) {
        suggestContainer.innerHTML = ''; if (items.length === 0) return;
        const list = document.createElement('div'); list.id = 'my-suggest-list';
        items.forEach(item => {
            const div = document.createElement('div'); div.className = 'my-suggest-item';
            div.textContent = item.address.formatted_address;
            div.addEventListener('click', () => { addressInput.value = item.address.formatted_address; suggestContainer.innerHTML = ''; });
            list.appendChild(div);
        });
        suggestContainer.appendChild(list);
    }
    function getPriceForCoordinates(coords){if(!zonesGeoJSON){return{price:0};} const point={type:'Point',coordinates:coords};for(const feature of zonesGeoJSON.features){const zoneName=feature.properties.description||'БЕЗ ИМЕНИ';const polygon=feature.geometry;if(isPointInPolygon(point,polygon)){return calculatePriceFromZoneName(zoneName);}} return{price:0};}
    function isPointInPolygon(point,polygon){const pointCoords=point.coordinates;const polygonCoords=polygon.coordinates[0];let isInside=!1;for(let i=0,j=polygonCoords.length-1;i<polygonCoords.length;j=i++){const xi=polygonCoords[i][0],yi=polygonCoords[i][1];const xj=polygonCoords[j][0],yj=polygonCoords[j][1];const intersect=((yi>pointCoords[1])!==(yj>pointCoords[1]))&&(pointCoords[0]<(xj-xi)*(pointCoords[1]-yi)/(yj-yi)+xi);if(intersect)isInside=!isInside;} return isInside;}
    function calculatePriceFromZoneName(zoneName){if(!zoneName)return{price:0};const parts=zoneName.split('_');if(parts[0]!=='zone')return{price:0};const basePrice=parseInt(parts[1],10);if(parts.length>2&&parts[2]==='plus'){const additionalPrice=parseInt(parts[3],10);return{price:basePrice+additionalPrice};} return{price:basePrice};}
    function renderCurrentTrip(){currentOrdersList.innerHTML='';let total=0;currentTrip.forEach(order=>{const li=document.createElement('li');li.textContent=`${order.address} - ${order.price} ₽`;total+=order.price;currentOrdersList.appendChild(li);});tripTotalSpan.textContent=total;}
    function renderHistory(){historyList.innerHTML='';shiftHistory.forEach((trip,index)=>{const details=document.createElement('details');const summary=document.createElement('summary');const tripTotal=trip.orders.reduce((sum,order)=>sum+order.price,0);summary.textContent=`Рейс #${shiftHistory.length-index} - ${tripTotal} ₽`;const ul=document.createElement('ul');trip.orders.forEach(order=>{const li=document.createElement('li');li.textContent=`${order.address} - ${order.price} ₽`;ul.appendChild(li);});details.appendChild(summary);details.appendChild(ul);historyList.appendChild(details);});}
    function updateShiftState(isStarting){logToScreen(`Обновляю состояние кнопок смены: ${isStarting}`);newTripBtn.disabled=!isStarting;endShiftBtn.disabled=!isStarting;if(!isStarting){currentTripSection.classList.add('hidden');}}
    
    // --- ОБРАБОТЧИКИ КНОПОК ---
    openShiftBtn.addEventListener('click', () => {
        clearLocalShiftData();
        localStorage.setItem('shiftInProgress', 'true');
        currentTrip = []; shiftHistory = [];
        renderCurrentTrip(); renderHistory();
        updateShiftState(true);
        showScreen('main-app');
    });

    async function fetchAndRenderFullHistory() {
        try {
            logToScreen('Запрашиваю историю всех смен...');
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
                    
                    const tripsList = document.createElement('div');
                    shift.trips.reverse().forEach((trip, index) => {
                        const tripDetails = document.createElement('details');
                        tripDetails.style.marginLeft = "15px";
                        const tripSummary = document.createElement('summary');
                        const tripTotal = trip.orders.reduce((sum, order) => sum + order.price, 0);
                        tripSummary.textContent = `  Рейс #${index + 1}: ${tripTotal} ₽ (${trip.orders.length} зак.)`;
                        
                        const ordersList = document.createElement('ul');
                        trip.orders.forEach(order => {
                            const orderLi = document.createElement('li');
                            orderLi.style.marginLeft = "20px";
                            orderLi.style.background = "var(--list-item-hover-bg)";
                            orderLi.textContent = `${order.address} (${order.price} ₽)`;
                            ordersList.appendChild(orderLi);
                        });

                        tripDetails.appendChild(tripSummary);
                        tripDetails.appendChild(ordersList);
                        tripsList.appendChild(tripDetails);
                    });

                    shiftDetails.appendChild(shiftSummary);
                    shiftDetails.appendChild(tripsList);
                    fullHistoryList.appendChild(shiftDetails);
                });
            }
        } catch (error) {
            alert(`Не удалось загрузить историю: ${error.message}`);
            logToScreen(`Ошибка загрузки истории: ${error.message}`);
        }
    }

    historyBtn.addEventListener('click', () => { fetchAndRenderFullHistory(); showScreen('history-screen'); });
    
    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('ВЫ УВЕРЕНЫ? Это действие удалит ВСЮ вашу историю смен без возможности восстановления.')) {
            try {
                await apiFetch('/shifts', { method: 'DELETE' });
                alert('История успешно очищена.');
                fetchAndRenderFullHistory();
            } catch (error) {
                alert(`Не удалось очистить историю: ${error.message}`);
                logToScreen(`Ошибка очистки истории: ${error.message}`);
            }
        }
    });

    backToStartScreenBtn.addEventListener('click', () => showScreen('start-shift-screen'));
    
    newTripBtn.addEventListener('click',()=>{currentTrip=[];renderCurrentTrip();currentTripSection.classList.remove('hidden');newTripBtn.disabled=true;});
    
    addOrderBtn.addEventListener('click', async () => {
        const address = addressInput.value.trim();if (!address) return;
        suggestContainer.innerHTML = '';addOrderBtn.disabled = true; addOrderBtn.textContent = '...';
        try {
            if (!ymaps.geocode) throw new Error("Функция геокодирования не готова.");
            const geoResult = await ymaps.geocode(address);
            const firstGeoObject = geoResult.geoObjects.get(0);
            if (!firstGeoObject) { alert('Адрес не найден'); return; }
            const coords = firstGeoObject.geometry.getCoordinates();
            const reversedCoords = [coords[1], coords[0]];
            const { price } = getPriceForCoordinates(reversedCoords);
            if (price === 0) { alert('Не удалось определить стоимость.'); return; }
            currentTrip.push({ address, price });
            renderCurrentTrip();
            saveState();
            addressInput.value = '';
        } catch (error) {
            logToScreen(`КРИТИЧЕСКАЯ ОШИБКА геокодирования: ${error.message}`);
            alert('Произошла ошибка при поиске адреса.');
        } finally {
            addOrderBtn.disabled = false; addOrderBtn.textContent = '+';
        }
    });

    endTripBtn.addEventListener('click',()=>{
        if(currentTrip.length===0)return;
        shiftHistory.unshift({orders:[...currentTrip]});
        currentTrip=[];
        renderHistory(); renderCurrentTrip();
        saveState();
        currentTripSection.classList.add('hidden'); newTripBtn.disabled=false;
    });

    endShiftBtn.addEventListener('click', async () => {
        if (currentTrip.length > 0) {
            shiftHistory.unshift({orders:[...currentTrip]});
            currentTrip = [];
        }
        if (shiftHistory.length === 0) {
            if (confirm('Смена пуста. Вы уверены, что хотите ее закрыть (она не будет сохранена)?')) {
                clearLocalShiftData();
                showScreen('start-shift-screen');
            }
            return;
        }
        const shiftData = { date: new Date().toISOString(), trips: shiftHistory, totalEarnings: shiftHistory.reduce((total, trip) => total + trip.orders.reduce((tripSum, order) => tripSum + order.price, 0), 0), tripCount: shiftHistory.length };
        try {
            await apiFetch('/shifts', { method: 'POST', body: JSON.stringify(shiftData) });
            logToScreen("Смена успешно сохранена!");
            shiftTripsCount.textContent = shiftData.tripCount;
            shiftTotalEarnings.textContent = shiftData.totalEarnings;
            historyList.innerHTML = '';
            shiftSummarySection.classList.remove('hidden');
            currentTripSection.classList.add('hidden');
            updateShiftState(false);
            clearLocalShiftData();
        } catch (error) {
            logToScreen(`ОШИБКА СОХРАНЕНИЯ: ${error.message}`);
            alert(`Не удалось сохранить смену:\n\n${error.message}`);
        }
    });

    goToStartScreenBtn.addEventListener('click', () => {
        shiftSummarySection.classList.add('hidden');
        showScreen('start-shift-screen');
    });

    // --- НАЧАЛЬНАЯ ЗАГРУЗКА ПРИЛОЖЕНИЯ ---
    async function initializeApp() {
        if (authToken && userEmail) {
            if (!userName) { showScreen('update-name-screen'); return; }
            userNameDisplay.textContent = userName; userEmailDisplay.textContent = userEmail;
            initMapsAndLogic();
            const lastScreen = localStorage.getItem('lastActiveScreen');
            
            if (lastScreen === 'history-screen') {
                await fetchAndRenderFullHistory();
                showScreen('history-screen');
            } else if (localStorage.getItem('shiftInProgress') === 'true') {
                loadState();
                renderCurrentTrip(); renderHistory();
                updateShiftState(true);
                if(currentTrip.length > 0) { currentTripSection.classList.remove('hidden'); newTripBtn.disabled = true; }
                showScreen('main-app');
            } else {
                showScreen('start-shift-screen');
            }
        } else {
            showScreen('auth-screen');
        }
    }

    // ЛОГИКА СПЛЭШ-СКРИНА
    if (sessionStorage.getItem('splashShown')) {
        splashScreen.style.display = 'none';
        appContainer.classList.remove('hidden');
        logToScreen('Пропускаю сплэш-скрин (обновление страницы).');
        initializeApp();
    } else {
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            sessionStorage.setItem('splashShown', 'true');
            logToScreen('Загрузка завершена. Инициализация приложения...');
            initializeApp();
        }, 3000); // 3 секунды
    }

})();
