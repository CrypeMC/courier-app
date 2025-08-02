(function() {
    // --- БЛОК ОТЛАДКИ ---
    const debugLog = document.getElementById('debug-log');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const copyLogBtn = document.getElementById('copy-log-btn');
    function logToScreen(message) { if (debugLog) { const time = new Date().toLocaleTimeString(); debugLog.innerHTML += `[${time}] ${message}\n`; debugLog.scrollTop = debugLog.scrollHeight; } console.log(message); }
    logToScreen('app.js успешно загружен и готов к работе.');
    if (clearLogBtn) { clearLogBtn.addEventListener('click', () => { debugLog.innerHTML = ''; }); }
    if (copyLogBtn) { copyLogBtn.addEventListener('click', () => { navigator.clipboard.writeText(debugLog.innerText).then(() => alert('Лог скопирован!')).catch(err => alert('Ошибка копирования: ' + err)); }); }
    
    // --- ЭЛЕМЕНТЫ DOM ---
    const screens = document.querySelectorAll('.screen');
    const loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), loginEmailInput = document.getElementById('login-email'), loginPasswordInput = document.getElementById('login-password'), registerEmailInput = document.getElementById('register-email'), registerPasswordInput = document.getElementById('register-password'), loginBtn = document.getElementById('login-btn'), registerBtn = document.getElementById('register-btn'), showRegisterLink = document.getElementById('show-register-link'), showLoginLink = document.getElementById('show-login-link');
    const userEmailDisplay = document.getElementById('user-email-display'), openShiftBtn = document.getElementById('open-shift-btn'), historyBtn = document.getElementById('history-btn'), logoutBtn = document.getElementById('logout-btn');
    const addressInput = document.getElementById('address-input'), suggestContainer = document.getElementById('my-suggest-container'), newTripBtn = document.getElementById('new-trip-btn'), endShiftBtn = document.getElementById('end-shift-btn'), currentTripSection = document.getElementById('current-trip-section'), addOrderBtn = document.getElementById('add-order-btn'), currentOrdersList = document.getElementById('current-orders-list'), tripTotalSpan = document.getElementById('trip-total'), endTripBtn = document.getElementById('end-trip-btn');
    const shiftSummarySection = document.getElementById('shift-summary-section'), shiftTripsCount = document.getElementById('shift-trips-count'), shiftTotalEarnings = document.getElementById('shift-total-earnings'), goToStartScreenBtn = document.getElementById('go-to-start-screen-btn');
    const fullHistoryList = document.getElementById('full-history-list'), backToStartScreenBtn = document.getElementById('back-to-start-screen-btn');
    const historyList=document.getElementById('history-list');

    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let authToken = localStorage.getItem('courierAuthToken');
    let userEmail = localStorage.getItem('courierUserEmail');
    let userCoords = null, zonesGeoJSON, currentTrip = [], shiftHistory = [];
    let mapsInitialized = false;

    // --- УПРАВЛЕНИЕ ЭКРАНАМИ ---
    function showScreen(screenId) { screens.forEach(s => s.classList.add('hidden')); document.getElementById(screenId)?.classList.remove('hidden'); }

    // --- УПРАВЛЕНИЕ ФОРМАМИ ВХОДА/РЕГИСТРАЦИИ ---
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

    // --- СЕТЕВАЯ ЛОГИКА ---
    async function apiFetch(endpoint, options = {}) {
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (authToken) { defaultHeaders['Authorization'] = `Bearer ${authToken}`; }
        options.headers = { ...defaultHeaders, ...options.headers };
        const response = await fetch(`/.netlify/functions/api${endpoint}`, options);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Неизвестная ошибка сервера'); }
        if (response.status === 201 || response.status === 204) return null;
        return response.json();
    }

    // --- ЛОГИКА АВТОРИЗАЦИИ ---
    loginBtn.addEventListener('click', async () => {
        try {
            const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email: loginEmailInput.value, password: loginPasswordInput.value }) });
            authToken = data.token; userEmail = data.email;
            localStorage.setItem('courierAuthToken', authToken); localStorage.setItem('courierUserEmail', userEmail);
            initializeApp();
        } catch (error) { alert(`Ошибка входа: ${error.message}`); }
    });
    registerBtn.addEventListener('click', async () => {
        try {
            await apiFetch('/register', { method: 'POST', body: JSON.stringify({ email: registerEmailInput.value, password: registerPasswordInput.value }) });
            alert('Регистрация прошла успешно! Теперь вы можете войти.');
            showLoginLink.click();
        } catch (error) { alert(`Ошибка регистрации: ${error.message}`); }
    });
    logoutBtn.addEventListener('click', () => {
        authToken = null; userEmail = null;
        localStorage.removeItem('courierAuthToken'); localStorage.removeItem('courierUserEmail');
        showScreen('auth-screen');
        logToScreen('Пользователь вышел. Данные смены сохранены локально.');
    });

    // --- ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ---
    function saveState() {
        if (!userEmail) return;
        const state = { currentTrip: currentTrip, shiftHistory: shiftHistory };
        localStorage.setItem(`courierAppState_${userEmail}`, JSON.stringify(state));
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
    }

    // --- ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ ---
    function initMapsAndLogic() {
        if (mapsInitialized) { logToScreen("Карты уже инициализированы."); return; }
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
    async function loadZones(){ try { const response=await fetch('/data/zones.geojson'); if(!response.ok){throw new Error(`Статус: ${response.status}`);} zonesGeoJSON=await response.json(); logToScreen("Файл зон успешно загружен."); } catch(e) { logToScreen(`Ошибка загрузки зон: ${e.message}`); } }
    
    addressInput.addEventListener('input', async () => {
        const text = addressInput.value;
        if (text.length < 3) { suggestContainer.innerHTML = ''; return; }
        try {
            const endpoint = userCoords ? `/suggest?text=${text}&lat=${userCoords[0]}&lon=${userCoords[1]}` : `/suggest?text=${text}`;
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
    function updateShiftState(isStarting){newTripBtn.disabled=!isStarting;endShiftBtn.disabled=!isStarting;if(!isStarting){currentTripSection.classList.add('hidden');}}
    
    // --- ОБРАБОТЧИКИ КНОПОК ---
    openShiftBtn.addEventListener('click', () => {
        clearLocalShiftData();
        currentTrip = []; shiftHistory = [];
        renderCurrentTrip(); renderHistory();
        updateShiftState(true);
        showScreen('main-app');
    });

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
    
    newTripBtn.addEventListener('click',()=>{currentTrip=[];renderCurrentTrip();currentTripSection.classList.remove('hidden');newTripBtn.disabled=true;});
    
    addOrderBtn.addEventListener('click', async () => {
        const address = addressInput.value.trim();if (!address) return;
        suggestContainer.innerHTML = '';addOrderBtn.disabled = true; addOrderBtn.textContent = '...';
        try {
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
        if (shiftHistory.length === 0 && currentTrip.length === 0) { alert('Нельзя завершить пустую смену.');return; }
        if (currentTrip.length > 0) {
            shiftHistory.unshift({orders:[...currentTrip]});
            currentTrip = [];
        }
        if (shiftHistory.length === 0) { alert('Нельзя завершить смену без рейсов.');return; }
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
    function initializeApp() {
        if (authToken && userEmail) {
            userEmailDisplay.textContent = userEmail;
            initMapsAndLogic();
            loadState();
            if (currentTrip.length > 0 || shiftHistory.length > 0) {
                renderCurrentTrip(); renderHistory();
                updateShiftState(true);
                if(currentTrip.length > 0) {
                    currentTripSection.classList.remove('hidden');
                    newTripBtn.disabled = true;
                }
                showScreen('main-app');
            } else {
                showScreen('start-shift-screen');
            }
        } else {
            showScreen('auth-screen');
        }
    }

    initializeApp();

})();
