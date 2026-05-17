const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Инициализация базы данных SQLite
const db = new sqlite3.Database('./forum.db', (err) => {
    if (err) console.error('Ошибка базы данных: ', err);
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);
});

// Настройки модулей Express
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'super_secret_key_for_psychoteria',
    resave: false,
    saveUninitialized: false
}));

// Проверка: Залогинен пользователь или нет
function requireAuth(req, res, next) {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    next();
}

// Функция сборки страницы на основе шаблона index.html
function generatePage(username, content, error = null) {
    let htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    
    const userMenu = username ? `
        <li id="navprofile"><a href="#">Profile</a></li>
        <li id="navpm"><a href="#">PM</a></li>
        <li id="navbuy"><a href="/download-loader">Buy Psychoteria</a></li>
        <li id="navlogout"><a href="/logout">Logout</a></li>
    ` : `
        <li id="navlogin"><a href="/login">Login</a></li>
        <li id="navregister"><a href="/register">Register</a></li>
    `;

    const welcomeBox = username ? `
        <p class="conl">Logged in as: <b>${username}</b></p>
        <p><a href="#">Buy premium</a></p>
    ` : `
        <p class="conl">Welcome, Guest! Please log in or register to view the community.</p>
    `;

    const errorHTML = error ? `<div class="error-msg">${error}</div>` : '';

    // Подставляем данные в маркеры шаблона
    htmlTemplate = htmlTemplate.replace('{{USER_MENU}}', userMenu);
    htmlTemplate = htmlTemplate.replace('{{WELCOME_BOX}}', welcomeBox);
    htmlTemplate = htmlTemplate.replace('{{ERROR_MSG}}', errorHTML);
    htmlTemplate = htmlTemplate.replace('{{CONTENT}}', content);

    return htmlTemplate;
}

// Главная страница форума (Только для зарегистрированных)
app.get('/', requireAuth, (req, res) => {
    const username = req.session.username;
    
    let onlineUsers = ["art011313", "krest1k", "qwerty"];
    if (username && !onlineUsers.includes(username)) {
        onlineUsers.push(username);
    }

    const content = `
    <div id="brdmain">
        <div class="section">
            <div class="section-title">General</div>
            <div class="table-head">
                <div>Forum</div>
                <div>Last post</div>
            </div>

            <div class="forum-row">
                <div class="forum-left">
                    <div class="forum-icon"></div>
                    <div>
                        <div class="forum-title"><a href="#">Announcements</a></div>
                        <div class="forum-desc">Stay up to date with the latest news</div>
                    </div>
                </div>
                <div class="forum-last">
                    <div><a href="#">Psychoteria RELEASED</a></div>
                    <div class="date">17.05.2026, 14:34 / by art011313</div>
                </div>
            </div>

            <div class="forum-row">
                <div class="forum-left">
                    <div class="forum-icon"></div>
                    <div>
                        <div class="forum-title"><a href="#">General talk</a></div>
                        <div class="forum-desc">Talk about anything software related</div>
                    </div>
                </div>
                <div class="forum-last">
                    <div><a href="#">Welcome to Psychoteria</a></div>
                    <div class="date">Yesterday / by art011313</div>
                </div>
            </div>
            <div class="mark-read"><a href="#">Mark all topics as read</a></div>
        </div>

        <div class="stats">
            <div class="stats-title">Registered users online: ${onlineUsers.length}</div>
            <div class="stats-line"><b>Online:</b> ${onlineUsers.join(", ")}</div>
        </div>
    </div>
    `;

    res.send(generatePage(username, content));
});

// Страница Регистрации
app.get('/register', (req, res) => {
    if (req.session.username) return res.redirect('/');
    const content = `
    <div class="auth-box">
        <h2>Create Account</h2>
        <form method="POST" action="/register">
            <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" class="form-control" required autocomplete="off">
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn">Sign Up</button>
        </form>
        <div class="auth-switch">Already have an account? <a href="/login">Login here</a></div>
    </div>
    `;
    res.send(generatePage(null, content));
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const user = username ? username.trim() : '';
    const pass = password ? password.trim() : '';

    if (!user || !pass) return res.send(generatePage(null, '', 'Fields cannot be empty!'));

    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [user, pass], function(err) {
        if (err) {
            return res.send(generatePage(null, `
                <div class="auth-box">
                    <h2>Create Account</h2>
                    <form method="POST" action="/register">
                        <div class="form-group"><label>Username</label><input type="text" name="username" class="form-control" required></div>
                        <div class="form-group"><label>Password</label><input type="password" name="password" class="form-control" required></div>
                        <button type="submit" class="btn">Sign Up</button>
                    </form>
                </div>
            `, 'This username is already taken!'));
        }
        req.session.username = user;
        res.redirect('/');
    });
});

// Страница Входа
app.get('/login', (req, res) => {
    if (req.session.username) return res.redirect('/');
    const content = `
    <div class="auth-box">
        <h2>Sign In</h2>
        <form method="POST" action="/login">
            <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" class="form-control" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn">Login</button>
        </form>
        <div class="auth-switch">New here? <a href="/register">Create an account</a></div>
    </div>
    `;
    res.send(generatePage(null, content));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = username ? username.trim() : '';
    const pass = password ? password.trim() : '';

    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [user, pass], (err, row) => {
        if (err || !row) {
            return res.send(generatePage(null, `
                <div class="auth-box">
                    <h2>Sign In</h2>
                    <form method="POST" action="/login">
                        <div class="form-group"><label>Username</label><input type="text" name="username" class="form-control" required></div>
                        <div class="form-group"><label>Password</label><input type="password" name="password" class="form-control" required></div>
                        <button type="submit" class="btn">Login</button>
                    </form>
                </div>
            `, 'Invalid username or password!'));
        }
        req.session.username = row.username;
        res.redirect('/');
    });
});

// Выход из системы
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Отдача файла лоадера при скачивании
app.get('/download-loader', requireAuth, (req, res) => {
    const fileContent = Buffer.from('MZ... [Mock Executable Data for Psychoteria Loader] ...', 'utf8');
    res.setHeader('Content-disposition', 'attachment; filename=loader.exe');
    res.setHeader('Content-type', 'application/x-msdownload');
    res.send(fileContent);
});

app.listen(PORT, () => {
    console.log(`Сервер Psychoteria запущен: http://localhost:${PORT}`);
});
