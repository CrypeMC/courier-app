const { MongoClient, ObjectId } = require('mongodb'); // ObjectId нужен для поиска по userId
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mongoUri = process.env.MONGODB_URI;
const suggestApiKey = process.env.YANDEX_SUGGEST_API_KEY;
const jwtSecret = process.env.JWT_SECRET;

// Используем один клиент для всех вызовов функции
const client = new MongoClient(mongoUri);

async function handler(event) {
    const path = event.path.replace('/.netlify/functions/api', '');
    
    try {
        await client.connect();
        const db = client.db('courierApp');

        // --- МАРШРУТИЗАТОР ЗАПРОСОВ ---
        
        if (path.startsWith('/register') && event.httpMethod === 'POST') {
            const { email, password } = JSON.parse(event.body);
            if (!email || !password) throw new Error('Email и пароль обязательны');

            const usersCollection = db.collection('users');
            const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
            if (existingUser) throw new Error('Пользователь с таким email уже существует');

            const hashedPassword = await bcrypt.hash(password, 10);
            await usersCollection.insertOne({ email: email.toLowerCase(), password: hashedPassword });
            return { statusCode: 201, body: JSON.stringify({ message: 'Пользователь успешно зарегистрирован' }) };
        }

        if (path.startsWith('/login') && event.httpMethod === 'POST') {
            const { email, password } = JSON.parse(event.body);
            const usersCollection = db.collection('users');
            const user = await usersCollection.findOne({ email: email.toLowerCase() });
            if (!user) throw new Error('Неверный email или пароль');

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) throw new Error('Неверный email или пароль');

            const token = jwt.sign({ userId: user._id, email: user.email }, jwtSecret, { expiresIn: '30d' });
            return { statusCode: 200, body: JSON.stringify({ token, email: user.email }) };
        }
        
        if (path.startsWith('/suggest')) {
            if (!suggestApiKey) throw new Error("YANDEX_SUGGEST_API_KEY не установлен");
            const { text, lat, lon } = event.queryStringParameters;
            const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${suggestApiKey}&text=${encodeURIComponent(text)}&ll=${lon},${lat}&print_address=1`;
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Ошибка API подсказок');
            return { statusCode: 200, body: JSON.stringify(data.results || []) };
        }

        // --- ВСЕ ОСТАЛЬНЫЕ ЗАПРОСЫ ТРЕБУЮТ АВТОРИЗАЦИИ ---
        const authHeader = event.headers.authorization;
        if (!authHeader) throw new Error('Требуется авторизация');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        const userId = decoded.userId;

        const shiftsCollection = db.collection('shifts');

        if (path.startsWith('/shifts') && event.httpMethod === 'POST') {
            const shiftData = JSON.parse(event.body);
            shiftData.userId = new ObjectId(userId); // <-- ПРИВЯЗЫВАЕМ СМЕНУ К ПОЛЬЗОВАТЕЛЮ
            await shiftsCollection.insertOne(shiftData);
            return { statusCode: 201, body: JSON.stringify({ message: 'Смена сохранена' }) };
        }
        
        if (path.startsWith('/shifts') && event.httpMethod === 'GET') {
            const userShifts = await shiftsCollection.find({ userId: new ObjectId(userId) }).sort({ date: -1 }).toArray();
            return { statusCode: 200, body: JSON.stringify(userShifts) };
        }

        throw new Error('Неверный маршрут или метод');

    } catch (error) {
        console.error('Ошибка в функции:', error);
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    } finally {
        await client.close();
    }
}

module.exports = { handler };
