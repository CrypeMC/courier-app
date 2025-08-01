const { MongoClient } = require('mongodb');
const fetch = require('node-fetch'); // Добавляем зависимость для запросов

const mongoUri = process.env.MONGODB_URI;
const suggestApiKey = process.env.YANDEX_SUGGEST_API_KEY;

const client = new MongoClient(mongoUri);

async function handler(event) {
    // Определяем, это запрос на подсказки или на работу с базой
    if (event.path.includes('/suggest')) {
        // --- Логика для подсказок ---
        const { text, lat, lon } = event.queryStringParameters;
        const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${suggestApiKey}&text=${encodeURIComponent(text)}&ll=${lon},${lat}&print_address=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            return {
                statusCode: 200,
                body: JSON.stringify(data.results || []),
            };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Suggest API request failed' }) };
        }

    } else {
        // --- Логика для базы данных MongoDB ---
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
