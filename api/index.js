import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const mongoUri = process.env.MONGODB_URI;
const suggestApiKey = process.env.YANDEX_SUGGEST_API_KEY;
const jwtSecret = process.env.JWT_SECRET;

// Используем один клиент для всех вызовов функции
const client = new MongoClient(mongoUri);

export default async function handler(request, response) {
    // Получаем конечную точку из URL (например, 'login', 'register', 'shifts')
    const endpoint = request.url.split('/').pop().split('?')[0];

    try {
        await client.connect();
        const db = client.db('courierApp');
        const usersCollection = db.collection('users');

        if (endpoint === 'register' && request.method === 'POST') {
            const { name, email, password } = request.body;
            if (!name || !email || !password) throw new Error('Имя, Email и пароль обязательны');
            const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
            if (existingUser) throw new Error('Пользователь с таким email уже существует');
            const hashedPassword = await bcrypt.hash(password, 10);
            await usersCollection.insertOne({ name, email: email.toLowerCase(), password: hashedPassword });
            return response.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
        }

        if (endpoint === 'login' && request.method === 'POST') {
            const { email, password } = request.body;
            const user = await usersCollection.findOne({ email: email.toLowerCase() });
            if (!user) throw new Error('Неверный email или пароль');
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) throw new Error('Неверный email или пароль');
            const token = jwt.sign({ userId: user._id, email: user.email, name: user.name || '' }, jwtSecret, { expiresIn: '30d' });
            return response.status(200).json({ token, email: user.email, name: user.name || '' });
        }
        
        if (endpoint === 'suggest' && request.method === 'GET') {
            if (!suggestApiKey) throw new Error("YANDEX_SUGGEST_API_KEY не установлен");
            const { text, lat, lon } = request.query;
            const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${suggestApiKey}&text=${encodeURIComponent(text)}&ll=${lon},${lat}&print_address=1`;
            const suggestResponse = await fetch(url);
            if (!suggestResponse.ok) throw new Error(`Ошибка API подсказок: ${suggestResponse.statusText}`);
            const data = await suggestResponse.json();
            return response.status(200).json(data.results || []);
        }
        
        // Все запросы ниже требуют авторизации
        const authHeader = request.headers.authorization;
        if (!authHeader) throw new Error('Требуется авторизация');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        const userId = decoded.userId;

        const shiftsCollection = db.collection('shifts');

        if (endpoint === 'shifts' && request.method === 'POST') {
            const shiftData = request.body;
            shiftData.userId = new ObjectId(userId);
            await shiftsCollection.insertOne(shiftData);
            return response.status(201).json({ message: 'Смена сохранена' });
        }
        
        if (endpoint === 'shifts' && request.method === 'GET') {
            const userShifts = await shiftsCollection.find({ userId: new ObjectId(userId) }).sort({ date: -1 }).toArray();
            return response.status(200).json(userShifts);
        }

        if (endpoint === 'shifts' && request.method === 'DELETE') {
            await shiftsCollection.deleteMany({ userId: new ObjectId(userId) });
            return response.status(200).json({ message: 'История очищена' });
        }
        
        if (endpoint === 'update-name' && request.method === 'POST') {
            const { name } = request.body;
            if (!name) throw new Error('Имя не может быть пустым');
            await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { name: name } });
            return response.status(200).json({ message: 'Имя обновлено' });
        }

        throw new Error('Неверный маршрут или метод');

    } catch (error) {
        console.error('Ошибка в функции:', error);
        return response.status(400).json({ error: error.message });
    } finally {
        // Важно: Vercel управляет подключениями, но лучше закрывать явно
        await client.close();
    }
}
