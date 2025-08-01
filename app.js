document.addEventListener('DOMContentLoaded', () => {
    // Регистрация Service Worker для оффлайн работы
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service Worker registration failed:', err));
    }

    // --- Глобальные переменные и состояние ---
    let ymaps;
    let zonesGeoJSON;
    let currentTrip = [];
    let shiftHistory = [];
    let shiftInProgress = false;

    // --- Элементы DOM ---
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

    // --- Инициализация ---
    ymapsReady();

    async function ymapsReady() {
        try {
            await loadZones();
            ymaps = window.ymaps;
            if (ymaps) {
                new ymaps.SuggestView('address-input');
            } else {
                console.error('Yandex Maps API not loaded');
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            alert('Не удалось загрузить зоны. Проверьте файл zones.geojson');
        }
    }

    async function loadZones() {
        const response = await fetch('/data/zones.geojson');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        zonesGeoJSON = await response.json();
    }

    // --- Функции для расчета стоимости ---
    function getPriceForCoordinates(coords) {
        const point = { type: 'Point', coordinates: coords };
        for (const feature of zonesGeoJSON.features) {
            const polygon = feature.geometry;
            if (isPointInPolygon(point, polygon)) {
                return calculatePriceFromZoneName(feature.properties.description);
            }
        }
        return { price: 0, description: 'Зона не найдена' };
    }

    function isPointInPolygon(point, polygon) {
        const pointCoords = point.coordinates;
        const polygonCoords = polygon.coordinates[0];
        let isInside = false;
        for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
            const xi = polygonCoords[i][0], yi = polygonCoords[i][1];
            const xj = polygonCoords[j][0], yj = polygonCoords[j][1];
            const intersect = ((yi > pointCoords[1]) !== (yj > pointCoords[1]))
                && (pointCoords[0] < (xj - xi) * (pointCoords[1] - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    function calculatePriceFromZoneName(zoneName) {
        if (!zoneName) return { price: 0, description: 'Безымянная зона' };
        
        const parts = zoneName.split('_');
        if (parts[0] !== 'zone') return { price: 0, description: 'Неверный формат зоны' };

        const basePrice = parseInt(parts[1], 10);
        if (parts.length > 2 && parts[2] === 'plus') {
            const additionalPrice = parseInt(parts[3], 10);
            return { price: basePrice + additionalPrice, description: `Зона (${basePrice} + ${additionalPrice})` };
        }
        return { price: basePrice, description: `Зона (${basePrice})` };
    }


    // --- Функции для обновления UI ---
    function renderCurrentTrip() {
        currentOrdersList.innerHTML = '';
        let total = 0;
        currentTrip.forEach(order => {
            const li = document.createElement('li');
            li.textContent = `${order.address} - ${order.price} ₽`;
            total += order.price;
            currentOrdersList.appendChild(li);
        });
        tripTotalSpan.textContent = total;
    }
    
    function renderHistory() {
        historyList.innerHTML = '';
        shiftHistory.forEach((trip, index) => {
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            const tripTotal = trip.orders.reduce((sum, order) => sum + order.price, 0);
            summary.textContent = `Рейс #${shiftHistory.length - index} - ${tripTotal} ₽`;
            
            const ul = document.createElement('ul');
            trip.orders.forEach(order => {
                const li = document.createElement('li');
                li.textContent = `${order.address} - ${order.price} ₽`;
                ul.appendChild(li);
            });

            details.appendChild(summary);
            details.appendChild(ul);
            historyList.appendChild(details);
        });
    }

    function updateShiftState(isStarting) {
        shiftInProgress = isStarting;
        newTripBtn.disabled = !isStarting;
        endShiftBtn.disabled = !isStarting;
        if (!isStarting) {
            currentTripSection.classList.add('hidden');
        }
    }
    
    // --- Обработчики событий ---
    newTripBtn.addEventListener('click', () => {
        currentTrip = [];
        renderCurrentTrip();
        currentTripSection.classList.remove('hidden');
        newTripBtn.disabled = true;
    });

    addOrderBtn.addEventListener('click', async () => {
        const address = addressInput.value.trim();
        if (!address) return;

        addOrderBtn.disabled = true;
        addOrderBtn.textContent = '...';

        try {
            const geoObject = await ymaps.geocode(address);
            const firstGeoObject = geoObject.geoObjects.get(0);
            if (!firstGeoObject) {
                alert('Адрес не найден');
                return;
            }
            const coords = firstGeoObject.geometry.getCoordinates();
            const { price } = getPriceForCoordinates(coords);
            
            if (price === 0) {
                 alert('Не удалось определить стоимость для данного адреса. Возможно, он вне зоны обслуживания.');
                 return;
            }

            currentTrip.push({ address, price });
            renderCurrentTrip();
            addressInput.value = '';

        } catch (error) {
            console.error('Geocoding error:', error);
            alert('Произошла ошибка при поиске адреса.');
        } finally {
            addOrderBtn.disabled = false;
            addOrderBtn.textContent = '+';
        }
    });

    endTripBtn.addEventListener('click', () => {
        if (currentTrip.length === 0) return;
        shiftHistory.unshift({ orders: [...currentTrip] }); // Добавляем в начало
        currentTrip = [];
        renderHistory();
        currentTripSection.classList.add('hidden');
        newTripBtn.disabled = false;
    });

    endShiftBtn.addEventListener('click', async () => {
        if (shiftHistory.length === 0) {
            alert('Нельзя завершить смену без выполненных рейсов.');
            return;
        }

        const shiftData = {
            date: new Date().toISOString(),
            trips: shiftHistory,
            totalEarnings: shiftHistory.reduce((total, trip) => 
                total + trip.orders.reduce((tripSum, order) => tripSum + order.price, 0), 0),
            tripCount: shiftHistory.length
        };
        
        try {
            const response = await fetch('/.netlify/functions/api', {
                method: 'POST',
                body: JSON.stringify(shiftData)
            });
            if (!response.ok) throw new Error('Failed to save shift');

            // Показываем итоговый экран
            shiftTripsCount.textContent = shiftData.tripCount;
            shiftTotalEarnings.textContent = shiftData.totalEarnings;
            shiftSummarySection.classList.remove('hidden');

            // Сбрасываем все
            historyList.innerHTML = '';
            updateShiftState(false);

        } catch(error) {
            console.error('Error saving shift:', error);
            alert('Не удалось сохранить смену. Проверьте интернет-соединение.');
        }
    });
    
    startNewShiftBtn.addEventListener('click', () => {
        shiftHistory = [];
        shiftSummarySection.classList.add('hidden');
        updateShiftState(true);
    });

    // --- Начальное состояние ---
    updateShiftState(true); // Начинаем с активной смены
});