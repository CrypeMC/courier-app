ymaps.ready(init);

async function init() {
    // --- БЛОК ОТЛАДКИ ---
    const debugLog = document.getElementById('debug-log');
    const clearLogBtn = document.getElementById('clear-log-btn');
    function logToScreen(message) { if (debugLog) { const time = new Date().toLocaleTimeString(); debugLog.innerHTML += `[${time}] ${message}\n`; debugLog.scrollTop = debugLog.scrollHeight; } console.log(message); }
    if (clearLogBtn) { clearLogBtn.addEventListener('click', () => { debugLog.innerHTML = ''; }); } 
if (copyLogBtn) { // ДОБАВИЛИ ОБРАБОТЧИК
    copyLogBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(debugLog.innerText)
            .then(() => alert('Лог скопирован в буфер обмена!'))
            .catch(err => alert('Ошибка копирования: ', err));
    });
}
    logToScreen("Приложение инициализировано.");
    // --- КОНЕЦ БЛОКА ОТЛАДКИ ---

    const addressInput = document.getElementById('address-input');
    const suggestContainer = document.getElementById('my-suggest-container');
    let userCoords = null;
    
    // --- НОВАЯ ЛОГИКА ПОДСКАЗОК ЧЕРЕЗ СВОЙ СЕРВЕР ---
    try {
        logToScreen("Определяю местоположение...");
        const location = await ymaps.geolocation.get({ provider: 'browser' });
        userCoords = location.geoObjects.get(0).geometry.getCoordinates();
        logToScreen(`Местоположение определено: [${userCoords[0]}, ${userCoords[1]}]`);
        
        addressInput.addEventListener('input', async () => {
            const text = addressInput.value;
            if (text.length < 3 || !userCoords) {
                suggestContainer.innerHTML = ''; return;
            }

            logToScreen(`Запрашиваю подсказки у нашего сервера для "${text}"...`);
            try {
                // Запрос к нашей функции Netlify, а не напрямую к Яндексу
                const response = await fetch(`/.netlify/functions/api/suggest?text=${text}&lat=${userCoords[0]}&lon=${userCoords[1]}`);
                if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
                
                const suggestions = await response.json();
                logToScreen(`Получено ${suggestions.length} подсказок от нашего сервера.`);
                renderOurOwnSuggestions(suggestions);

            } catch (e) {
                logToScreen(`Ошибка при получении подсказок: ${e.message}`);
            }
        });
        
    } catch (e) {
        logToScreen(`КРИТИЧЕСКАЯ ОШИБКА геолокации: ${e.message}`);
    }

    function renderOurOwnSuggestions(items) {
        suggestContainer.innerHTML = ''; if (items.length === 0) return;
        const list = document.createElement('div'); list.id = 'my-suggest-list';
        items.forEach(item => {
            const div = document.createElement('div'); div.className = 'my-suggest-item';
            div.textContent = item.address.formatted_address; // Структура ответа API Геосаджеста
            div.addEventListener('click', () => {
                logToScreen(`Выбрано: "${item.address.formatted_address}"`);
                addressInput.value = item.address.formatted_address;
                suggestContainer.innerHTML = '';
            });
            list.appendChild(div);
        });
        suggestContainer.appendChild(list);
    }
    // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

    // Остальной код приложения (без изменений)
    let zonesGeoJSON; let currentTrip = []; let shiftHistory = [];
    const newTripBtn=document.getElementById('new-trip-btn'); const endShiftBtn=document.getElementById('end-shift-btn'); const currentTripSection=document.getElementById('current-trip-section'); const addOrderBtn=document.getElementById('add-order-btn'); const currentOrdersList=document.getElementById('current-orders-list'); const tripTotalSpan=document.getElementById('trip-total'); const endTripBtn=document.getElementById('end-trip-btn'); const historyList=document.getElementById('history-list'); const shiftSummarySection=document.getElementById('shift-summary-section'); const shiftTripsCount=document.getElementById('shift-trips-count'); const shiftTotalEarnings=document.getElementById('shift-total-earnings'); const startNewShiftBtn=document.getElementById('start-new-shift-btn'); loadZones().catch(error=>{logToScreen(`Ошибка загрузки зон: ${error.message}`);});
    async function loadZones(){logToScreen("Начинаю загрузку файла /data/zones.geojson...");const response=await fetch('/data/zones.geojson');if(!response.ok){throw new Error(`Не удалось загрузить файл, статус: ${response.status}`);}
    zonesGeoJSON=await response.json();logToScreen(`Файл зон успешно загружен. Найдено полигонов: ${zonesGeoJSON.features.length}`);}
    function getPriceForCoordinates(coords){if(!zonesGeoJSON){logToScreen("Ошибка: Попытка расчета цены до загрузки зон!");return{price:0};}
    const point={type:'Point',coordinates:coords};logToScreen("Начинаю проверку вхождения точки в полигоны...");for(const feature of zonesGeoJSON.features){const zoneName=feature.properties.description||'БЕЗ ИМЕНИ';const polygon=feature.geometry;if(isPointInPolygon(point,polygon)){logToScreen(`-- > ПОПАДАНИЕ! Точка находится внутри зоны "${zoneName}".`);return calculatePriceFromZoneName(zoneName);}}
    logToScreen("ПРОВЕРКА ЗАВЕРШЕНА: Точка не попала ни в одну из зон.");return{price:0};}
    function isPointInPolygon(point,polygon){const pointCoords=point.coordinates;const polygonCoords=polygon.coordinates[0];let isInside=!1;for(let i=0,j=polygonCoords.length-1;i<polygonCoords.length;j=i++){const xi=polygonCoords[i][0],yi=polygonCoords[i][1];const xj=polygonCoords[j][0],yj=polygonCoords[j][1];const intersect=((yi>pointCoords[1])!==(yj>pointCoords[1]))&&(pointCoords[0]<(xj-xi)*(pointCoords[1]-yi)/(yj-yi)+xi);if(intersect)isInside=!isInside;}
    return isInside;}
    function calculatePriceFromZoneName(zoneName){if(!zoneName)return{price:0};const parts=zoneName.split('_');if(parts[0]!=='zone')return{price:0};const basePrice=parseInt(parts[1],10);if(parts.length>2&&parts[2]==='plus'){const additionalPrice=parseInt(parts[3],10);return{price:basePrice+additionalPrice};}
    return{price:basePrice};}
    addOrderBtn.addEventListener('click', async () => {const address = addressInput.value.trim();if (!address) return;logToScreen(`------------------\nНачинаю поиск адреса: "${address}"`);suggestContainer.innerHTML = '';addOrderBtn.disabled = true; addOrderBtn.textContent = '...';try {const geoResult = await ymaps.geocode(address);const firstGeoObject = geoResult.geoObjects.get(0);if (!firstGeoObject) {logToScreen(`ОШИБКА: Яндекс.Карты не смогли найти адрес "${address}"`);alert('Адрес не найден');return;}const coords = firstGeoObject.geometry.getCoordinates();logToScreen(`Яндекс нашел координаты: [${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}] (широта, долгота)`);const reversedCoords = [coords[1], [0]];logToScreen(`Меняю местами для проверки: [${reversedCoords[0].toFixed(6)}, ${reversedCoords[1].toFixed(6)}] (долгота, широта)`);const { price } = getPriceForCoordinates(reversedCoords);if (price === 0) {logToScreen("Итог: цена 0. Адрес считается вне зоны обслуживания.");alert('Не удалось определить стоимость для данного адреса. Возможно, он вне зоны обслуживания.');return;}logToScreen(`Итог: цена ${price} ₽. Добавляю заказ.`);currentTrip.push({ address, price });renderCurrentTrip();addressInput.value = '';} catch (error) {logToScreen(`КРИТИЧЕСКАЯ ОШИБКА геокодирования: ${error.message}`);alert('Произошла ошибка при поиске адреса.');} finally {addOrderBtn.disabled = false; addOrderBtn.textContent = '+';}});
    function renderCurrentTrip(){currentOrdersList.innerHTML='';let total=0;currentTrip.forEach(order=>{const li=document.createElement('li');li.textContent=`${order.address} - ${order.price} ₽`;total+=order.price;currentOrdersList.appendChild(li);});tripTotalSpan.textContent=total;}
    function renderHistory(){historyList.innerHTML='';shiftHistory.forEach((trip,index)=>{const details=document.createElement('details');const summary=document.createElement('summary');const tripTotal=trip.orders.reduce((sum,order)=>sum+order.price,0);summary.textContent=`Рейс #${shiftHistory.length-index} - ${tripTotal} ₽`;const ul=document.createElement('ul');trip.orders.forEach(order=>{const li=document.createElement('li');li.textContent=`${order.address} - ${order.price} ₽`;ul.appendChild(li);});details.appendChild(summary);details.appendChild(ul);historyList.appendChild(details);});}
    function updateShiftState(isStarting){newTripBtn.disabled=!isStarting;endShiftBtn.disabled=!isStarting;if(!isStarting){currentTripSection.classList.add('hidden');}}
    newTripBtn.addEventListener('click',()=>{currentTrip=[];renderCurrentTrip();currentTripSection.classList.remove('hidden');newTripBtn.disabled=true;});
    endTripBtn.addEventListener('click',()=>{if(currentTrip.length===0)return;shiftHistory.unshift({orders:[...currentTrip]});currentTrip=[];renderHistory();currentTripSection.classList.add('hidden');newTripBtn.disabled=false;});
    endShiftBtn.addEventListener('click',async()=>{if(shiftHistory.length===0){alert('Нельзя завершить смену без выполненных рейсов.');return;}
    const shiftData={date:new Date().toISOString(),trips:shiftHistory,totalEarnings:shiftHistory.reduce((total,trip)=>total+trip.orders.reduce((tripSum,order)=>tripSum+order.price,0),0),tripCount:shiftHistory.length};
    try{const response=await fetch('/.netlify/functions/api',{method:'POST',body:JSON.stringify(shiftData)});if(!response.ok)throw new Error('Failed to save shift');
    shiftTripsCount.textContent=shiftData.tripCount;shiftTotalEarnings.textContent=shiftData.totalEarnings;shiftSummarySection.classList.remove('hidden');historyList.innerHTML='';updateShiftState(false);}catch(error){alert('Не удалось сохранить смену. Проверьте интернет-соединение.');}});
    startNewShiftBtn.addEventListener('click',()=>{shiftHistory=[];shiftSummarySection.classList.add('hidden');updateShiftState(true);});
    updateShiftState(true);
}
