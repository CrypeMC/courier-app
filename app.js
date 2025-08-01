ymaps.ready(init);

function init() {
    // --- НАША КОНСОЛЬ ДЛЯ ОТЛАДКИ ---
    const debugLog = document.getElementById('debug-log');
    const clearLogBtn = document.getElementById('clear-log-btn');
    function logToScreen(message) {
        if (debugLog) {
            const time = new Date().toLocaleTimeString();
            debugLog.innerHTML += `[${time}] ${message}\n`;
            debugLog.scrollTop = debugLog.scrollHeight;
        }
        console.log(message);
    }
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => { debugLog.innerHTML = ''; });
    }
    // --- КОНЕЦ БЛОКА ОТЛАДКИ ---

    logToScreen("Приложение инициализировано. ymaps.ready сработал.");

    // --- УПРОЩЕННАЯ ИНИЦИАЛИЗАЦИЯ ПОДСКАЗОК ---
    try {
        logToScreen("Пытаюсь создать SuggestView в самом простом виде...");
        
        // Создаем подсказки БЕЗ КАКИХ-ЛИБО НАСТРОЕК.
        // Это самый базовый вызов, который только возможен.
        const suggestView = new ymaps.SuggestView('address-input');

        logToScreen("SuggestView УСПЕШНО СОЗДАН. Теперь слежу за выбором.");

        // Отслеживаем, когда пользователь выбирает адрес из списка
        suggestView.events.add('select', (e) => {
            const selectedAddress = e.get('item').value;
            logToScreen(`Пользователь выбрал из подсказок: "${selectedAddress}"`);
            addressInput.value = selectedAddress;
        });

    } catch (e) {
        logToScreen(`КРИТИЧЕСКАЯ ОШИБКА при создании SuggestView: ${e.message}`);
        alert("Не удалось создать компонент подсказок. Что-то пошло не так.");
    }
    // --- КОНЕЦ УПРОЩЕННОЙ ИНИЦИАЛИЗАЦИИ ---


    // Остальной код приложения остается здесь, чтобы кнопки работали
    let zonesGeoJSON;
    let currentTrip = [];
    let shiftHistory = [];
    const newTripBtn = document.getElementById('new-trip-btn');
    const endShiftBtn = document.getElementById('end-shift-btn');
    const currentTripSection = document.getElementById('current-trip-section');
    const addressInput = document.getElementById('address-input');
    const addOrderBtn = document.getElementById('add-order-btn');
    const currentOrdersList = document.getElementById('current-orders-list');
    const tripTotalSpan = document.getElementById('trip-total');
    const endTripBtn = document.getElementById('end-trip-btn');
    const historyList = document.getElementById('history-list');
    const shiftSummarySection = document.getElementById('shift-summary-section');
    const shiftTripsCount = document.getElementById('shift-trips-count');
    const shiftTotalEarnings = document.getElementById('shift-total-earnings');
    const startNewShiftBtn = document.getElementById('start-new-shift-btn');
    loadZones().catch(error => { logToScreen(`Ошибка загрузки зон: ${error.message}`); });
    
    // Функции (без изменений)
    async function loadZones(){logToScreen("Начинаю загрузку файла /data/zones.geojson...");const response=await fetch('/data/zones.geojson');if(!response.ok){throw new Error(`Не удалось загрузить файл, статус: ${response.status}`);}
    zonesGeoJSON=await response.json();logToScreen(`Файл зон успешно загружен. Найдено полигонов: ${zonesGeoJSON.features.length}`);}
    function getPriceForCoordinates(coords){if(!zonesGeoJSON){logToScreen("Ошибка: Попытка расчета цены до загрузки зон!");return{price:0};}
    const point={type:'Point',coordinates:coords};logToScreen("Начинаю проверку вхождения точки в полигоны...");for(const feature of zonesGeoJSON.features){const zoneName=feature.properties.description||'БЕЗ ИМЕНИ';logToScreen(`- Проверяю зону: "${zoneName}"`);const polygon=feature.geometry;if(isPointInPolygon(point,polygon)){logToScreen(`-- > ПОПАДАНИЕ! Точка находится внутри зоны "${zoneName}".`);return calculatePriceFromZoneName(zoneName);}}
    logToScreen("ПРОВЕРКА ЗАВЕРШЕНА: Точка не попала ни в одну из зон.");return{price:0};}
    function isPointInPolygon(point,polygon){const pointCoords=point.coordinates;const polygonCoords=polygon.coordinates[0];let isInside=!1;for(let i=0,j=polygonCoords.length-1;i<polygonCoords.length;j=i++){const xi=polygonCoords[i][0],yi=polygonCoords[i][1];const xj=polygonCoords[j][0],yj=polygonCoords[j][1];const intersect=((yi>pointCoords[1])!==(yj>pointCoords[1]))&&(pointCoords[0]<(xj-xi)*(pointCoords[1]-yi)/(yj-yi)+xi);if(intersect)isInside=!isInside;}
    return isInside;}
    function calculatePriceFromZoneName(zoneName){if(!zoneName)return{price:0};const parts=zoneName.split('_');if(parts[0]!=='zone')return{price:0};const basePrice=parseInt(parts[1],10);if(parts.length>2&&parts[2]==='plus'){const additionalPrice=parseInt(parts[3],10);return{price:basePrice+additionalPrice};}
    return{price:basePrice};}
    addOrderBtn.addEventListener('click', async () => {const address = addressInput.value.trim();if (!address) return;logToScreen(`------------------\nНачинаю поиск адреса: "${address}"`);addOrderBtn.disabled = true; addOrderBtn.textContent = '...';try {const geoResult = await ymaps.geocode(address);const firstGeoObject = geoResult.geoObjects.get(0);if (!firstGeoObject) {logToScreen(`ОШИБКА: Яндекс.Карты не смогли найти адрес "${address}"`);alert('Адрес не найден');return;}const coords = firstGeoObject.geometry.getCoordinates();logToScreen(`Яндекс нашел координаты: [${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}] (широта, долгота)`);const reversedCoords = [coords[1], coords[0]];logToScreen(`Меняю местами для проверки: [${reversedCoords[0].toFixed(6)}, ${reversedCoords[1].toFixed(6)}] (долгота, широта)`);const { price } = getPriceForCoordinates(reversedCoords);if (price === 0) {logToScreen("Итог: цена 0. Адрес считается вне зоны обслуживания.");alert('Не удалось определить стоимость для данного адреса. Возможно, он вне зоны обслуживания.');return;}logToScreen(`Итог: цена ${price} ₽. Добавляю заказ.`);currentTrip.push({ address, price });renderCurrentTrip();addressInput.value = '';} catch (error) {logToScreen(`КРИТИЧЕСКАЯ ОШИБКА геокодирования: ${error.message}`);alert('Произошла ошибка при поиске адреса.');} finally {addOrderBtn.disabled = false; addOrderBtn.textContent = '+';}});
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
