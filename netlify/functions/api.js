const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');

const mongoUri = process.env.MONGODB_URI;
const suggestApiKey = process.env.YANDEX_SUGGEST_API_KEY;

const client = new MongoClient(mongoUri);

async function handler(event) {
    if (event.path.includes('/suggest')) {
        // --- Логика для подсказок ---
        try {
            // ПРОВЕРКА: есть ли у нас вообще ключ для подсказок?
            if (!suggestApiKey) {
                throw new Error("YANDEX_SUGGEST_API_KEY не установлен на Netlify!");
            }

            const { text, lat, lon } = event.queryStringParameters;
            const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${suggestApiKey}&text=${encodeURIComponent(text)}&ll=${lon},${lat}&print_address=1`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (response.status !== 200) {
                throw new Error(`Яндекс вернул ошибку: ${data.message || 'Неизвестная ошибка'}`);
            }

            return {
                statusCode: 200,
                body: JSON.stringify(data.results || []),
            };
        } catch (error) {
            // ВОТ ГЛАВНОЕ ИЗМЕНЕНИЕ!
            // Мы возвращаем клиенту точный текст ошибки.
            console.error('Функция подсказок сломалась:', error);
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: error.message }) // Возвращаем error.message
            };
        }

    } else {
        // --- Логика для базы данных MongoDB ---
        // (без изменений)
        await client.connect();
        const db = client.db('courierApp');
        const collection = db.collection('shifts');
        try {
            if (event.httpMethod === 'POST') {
                const shiftData = JSON.parse(event.body);
                await collection.insertOne(shiftData);
                return { statusCode: 201, body: JSON.stringify({ message: 'Shift saved' }) };
            }
            const shifts = await collection.find({}).sort({ _id: -1 }).limit(30).toArray();
            return { statusCode: 200, body: JSON.stringify(shifts) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        } finally {
            await client.close();
        }
    }
}

module.exports = { handler };
