const { MongoClient, ObjectId } = require('mongodb');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mongoUri = process.env.MONGODB_URI;
const suggestApiKey = process.env.YANDEX_SUGGEST_API_KEY;
const jwtSecret = process.env.JWT_SECRET;

const client = new MongoClient(mongoUri);

module.exports = async (request, response) => {
    // Проверяем, что все секреты на месте
    if (!mongoUri || !suggestApiKey || !jwtSecret) {
        return response.status(500).json({ error: 'Серверная ошибка: отсутствуют переменные окружения.' });
    }

    try {
        await client.connect();
        const db = client.db('courierApp');
        const usersCollection = db.collection('users');

        // Для GET запросов, действие и payload в параметрах URL
        if (request.method === 'GET') {
            const { action, payload } = request.query;

            if (action === 'suggest') {
                if (!suggestApiKey) throw new Error("YANDEX_SUGGEST_API_KEY не установлен");
                const { text, lat, lon } = request.query;
                const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${suggestApiKey}&text=${encodeURIComponent(text)}&ll=${lon},${lat}&print_address=1`;
                const suggestResponse = await fetch(url);
                if (!suggestResponse.ok) throw new Error(`Ошибка API подсказок: ${suggestResponse.statusText}`);
                const data = await suggestResponse.json();
                return response.status(200).json(data.results || []);
            }
        }
        
        // Для POST запросов, действие и payload в теле
        if (request.method === 'POST') {
            const { action, payload } = request.body;

            if (action === 'register') {
                const { name, email, password } = payload;
                if (!name || !email || !password) throw new Error('Имя, Email и пароль обязательны');
                const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
                if (existingUser) throw new Error('Пользователь с таким email уже существует');
                const hashedPassword = await bcrypt.hash(password, 10);
                await usersCollection.insertOne({ name, email: email.toLowerCase(), password: hashedPassword });
                return response.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
            }

            if (action === 'login') {
                const { email, password } = payload;
                const user = await usersCollection.findOne({ email: email.toLowerCase() });
                if (!user) throw new Error('Неверный email или пароль');
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) throw new Error('Неверный email или пароль');
                const token = jwt.sign({ userId: user._id, email: user.email, name: user.name || '' }, jwtSecret, { expiresIn: '30d' });
                return response.status(200).json({ token, email: user.email, name: user.name || '' });
            }

            // Все действия ниже требуют авторизации
            const authHeader = request.headers.authorization;
            if (!authHeader) throw new Error('Требуется авторизация');
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, jwtSecret);
            const userId = decoded.userId;

            if (action === 'get_shifts') {
                const shiftsCollection = db.collection('shifts');
                const userShifts = await shiftsCollection.find({ userId: new ObjectId(userId) }).sort({ date: -1 }).toArray();
                return response.status(200).json(userShifts);
            }

            if (action === 'save_shift') {
                const shiftsCollection = db.collection('shifts');
                const shiftData = payload;
                shiftData.userId = new ObjectId(userId);
                await shiftsCollection.insertOne(shiftData);
                return response.status(201).json({ message: 'Смена сохранена' });
            }

            if (action === 'delete_shifts') {
                const shiftsCollection = db.collection('shifts');
                await shiftsCollection.deleteMany({ userId: new ObjectId(userId) });
                return response.status(200).json({ message: 'История очищена' });
            }

            if (action === 'update_name') {
                const { name } = payload;
                if (!name) throw new Error('Имя не может быть пустым');
                await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { name: name } });
                return response.status(200).json({ message: 'Имя обновлено' });
            }
        }

        // Если ни один маршрут не совпал, возвращаем ошибку 404
        return response.status(404).json({ error: 'Неверное действие или метод запроса' });

    } catch (error) {
        console.error('Ошибка в функции:', error);
        return response.status(400).json({ error: error.message });
    } finally {
        await client.close();
    }
};
