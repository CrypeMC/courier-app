const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mongoUri = process.env.MONGODB_URI;
const suggestApiKey = process.env.YANDEX_SUGGEST_API_KEY;
const jwtSecret = process.env.JWT_SECRET;

const client = new MongoClient(mongoUri);

async function handler(event) {
    const path = event.path.replace('/.netlify/functions/api', '');
    await client.connect();
    const db = client.db('courierApp');

    // --- МАРШРУТИЗАТОР ЗАПРОСОВ ---
    
    if (path.startsWith('/register') && event.httpMethod === 'POST') {
        // --- РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ ---
        try {
            const { email, password } = JSON.parse(event.body);
            if (!email || !password) throw new Error('Email и пароль обязательны');

            const usersCollection = db.collection('users');
            const existingUser = await usersCollection.findOne({ email });
            if (existingUser) throw new Error('Пользователь с таким email уже существует');

            const hashedPassword = await bcrypt.hash(password, 10);
            await usersCollection.insertOne({ email, password: hashedPassword });

            return { statusCode: 201, body: JSON.stringify({ message: 'Пользователь успешно зарегистрирован' }) };
        } catch (error) {
            return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
        }
    }

    if (path.startsWith('/login') && event.httpMethod === 'POST') {
        // --- ВХОД ПОЛЬЗОВАТЕЛЯ ---
        try {
            const { email, password } = JSON.parse(event.body);
            const usersCollection = db.collection('users');
            const user = await usersCollection.findOne({ email });
            if (!user) throw new Error('Неверный email или пароль');

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) throw new Error('Неверный email или пароль');

            const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '30d' });
            return { statusCode: 200, body: JSON.stringify({ token }) };
        } catch (error) {
            return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
        }
    }

    if (path.startsWith('/suggest')) {
        // --- ПОДСКАЗКИ АДРЕСОВ (без изменений) ---
        // (Этот код остается прежним)
    }

    // --- ВСЕ ОСТАЛЬНЫЕ ЗАПРОСЫ ТРЕБУЮТ АВТОРИЗАЦИИ ---
    try {
        const token = event.headers.authorization.split(' ')[1];
        if (!token) throw new Error('Нет токена авторизации');
        
        const decoded = jwt.verify(token, jwtSecret);
        const userId = decoded.userId;

        if (path.startsWith('/shifts') && event.httpMethod === 'POST') {
            // --- СОХРАНЕНИЕ СМЕНЫ ---
            const shiftsCollection = db.collection('shifts');
            const shiftData = JSON.parse(event.body);
            shiftData.userId = userId; // <-- ПРИВЯЗЫВАЕМ СМЕНУ К ПОЛЬЗОВАТЕЛЮ
            await shiftsCollection.insertOne(shiftData);
            return { statusCode: 201, body: JSON.stringify({ message: 'Смена сохранена' }) };
        }

        // Если будет запрос на историю, он будет здесь

        throw new Error('Неверный маршрут');

    } catch (error) {
        return { statusCode: 401, body: JSON.stringify({ error: `Ошибка авторизации: ${error.message}` }) };
    }
}

module.exports = { handler };
