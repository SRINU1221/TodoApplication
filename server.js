const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key-change-this-in-production'; // In a real app, use env var

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const hash = bcrypt.hashSync(password, 10);

    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, username });
    });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'User not found' });

        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ token, user: { id: user.id, username: user.username } });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    });
});

// Get Todos
app.get('/api/todos', authenticateToken, (req, res) => {
    db.all('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create Todo
app.post('/api/todos', authenticateToken, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    db.run('INSERT INTO todos (user_id, text) VALUES (?, ?)', [req.user.id, text], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Return the created todo
        db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, row) => {
            res.json(row);
        });
    });
});

// Update Todo (Toggle Complete)
app.put('/api/todos/:id', authenticateToken, (req, res) => {
    const { completed } = req.body;
    const { id } = req.params;

    db.run('UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?', [completed ? 1 : 0, id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Delete Todo
app.delete('/api/todos/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
