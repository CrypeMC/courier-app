const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);

async function handler(event) {
    await client.connect();
    const db = client.db('courierApp'); // Можете назвать базу по-другому
    const collection = db.collection('shifts'); // Коллекция для хранения смен

    try {
        if (event.httpMethod === 'POST') {
            const shiftData = JSON.parse(event.body);
            await collection.insertOne(shiftData);
            return {
                statusCode: 201,
                body: JSON.stringify({ message: 'Shift saved successfully' }),
            };
        }
        
        // По умолчанию GET запрос, в будущем можно добавить фильтрацию
        const shifts = await collection.find({}).sort({ _id: -1 }).limit(30).toArray();
        return {
            statusCode: 200,
            body: JSON.stringify(shifts),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    } finally {
        // Важно закрывать соединение
        await client.close();
    }
}

module.exports = { handler };