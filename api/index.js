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

    const { action } = request.body; // <-- ГЛАВНОЕ ИЗМЕНЕНИЕ: мы получаем команду из тела запроса

    try {
        await client.connect();
        const db = client.db('courierApp');
        const usersCollection = db.collection('users');

        if (action === 'register') {
            const { name, email, password } = request.body.payload;
            // ... (вся логика регистрации)
            return response.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
        }

        if (action === 'login') {
            const { email, password } = request.body.payload;
            const user = await usersCollection.findOne({ email: email.toLowerCase() });
            if (!user) throw new Error('Неверный email или пароль');
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) throw new Error('Неверный email или пароль');
            const token = jwt.sign({ userId: user._id, email: user.email, name: user.name || '' }, jwtSecret, { expiresIn: '30d' });
            return response.status(200).json({ token, email: user.email, name: user.name || '' });
        }

        // Для GET запросов, как suggest, команда будет в query
        const { action: queryAction } = request.query;

        if (queryAction === 'suggest') {
             // ... (вся логика подсказок)
            return response.status(200).json(data.results || []);
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
             // ... (логика сохранения)
             return response.status(201).json({ message: 'Смена сохранена' });
        }
        
        // ... (остальные действия: update_name, delete_shifts)

        throw new Error('Неизвестное действие');

    } catch (error) {
        return response.status(400).json({ error: error.message });
    } finally {
        await client.close();
    }
};
