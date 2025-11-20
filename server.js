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
    const { username, password, recoveryPhrase } = req.body;
    if (!username || !password || !recoveryPhrase) {
        return res.status(400).json({ error: 'Username, password, and recovery phrase required' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const recoveryHash = bcrypt.hashSync(recoveryPhrase, 10);

    db.run('INSERT INTO users (username, password_hash, recovery_phrase_hash) VALUES (?, ?, ?)',
        [username, hash, recoveryHash],
        function (err) {
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

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
    const { username, recoveryPhrase, newPassword } = req.body;
    if (!username || !recoveryPhrase || !newPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'User not found' });

        if (!user.recovery_phrase_hash) {
            return res.status(400).json({ error: 'No recovery phrase set for this user' });
        }

        if (bcrypt.compareSync(recoveryPhrase, user.recovery_phrase_hash)) {
            const newHash = bcrypt.hashSync(newPassword, 10);
            db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Password reset successfully' });
            });
        } else {
            res.status(401).json({ error: 'Invalid recovery phrase' });
        }
    });
});

// Get Todos
app.get('/api/todos', authenticateToken, (req, res) => {
    db.all('SELECT * FROM todos WHERE user_id = ? ORDER BY is_priority DESC, created_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create Todo
app.post('/api/todos', authenticateToken, (req, res) => {
    const { text, isPriority } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    db.run('INSERT INTO todos (user_id, text, is_priority) VALUES (?, ?, ?)',
        [req.user.id, text, isPriority ? 1 : 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, row) => {
                res.json(row);
            });
        });
});

// Update Todo
app.put('/api/todos/:id', authenticateToken, (req, res) => {
    const { completed, isPriority } = req.body;
    const todoId = req.params.id;

    // Build dynamic query based on provided fields
    let updates = [];
    let params = [];

    if (completed !== undefined) {
        updates.push('completed = ?');
        params.push(completed ? 1 : 0);
    }
    if (isPriority !== undefined) {
        updates.push('is_priority = ?');
        params.push(isPriority ? 1 : 0);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(todoId);
    params.push(req.user.id);

    const sql = `UPDATE todos SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Todo not found' });
        res.json({ message: 'Updated successfully' });
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
