import express from 'express';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const sqlite = sqlite3.verbose();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'nutri-plan-secret-key-2024';

app.use(cors());
app.use(express.json());

const db = new sqlite.Database('./nutriplan.db', (err) => {
  if (err) console.error('Database error:', err.message);
  else console.log('Connected to NutriPlan Database.');
});


db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    age INTEGER,
    gender TEXT,
    height REAL,
    weight REAL,
    activityLevel TEXT,
    goal TEXT,
    dailyCalories INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mealName TEXT,
    mealType TEXT,
    calories INTEGER,
    protein INTEGER,
    dietTag TEXT,
    imageUrl TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    breakfast_id INTEGER,
    lunch_id INTEGER,
    dinner_id INTEGER,
    waterIntake REAL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
  )`);

  // Force Sync Admin Account
  const adminEmail = 'madhang285@gmail.com';
  const adminPass = '123';
  db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], async (err, row) => {
    const hashedPw = await bcrypt.hash(adminPass, 10);
    if (!row) {
      db.run(`INSERT INTO users (name, email, password, role, dailyCalories) VALUES (?, ?, ?, ?, ?)`, 
        ['System Admin', adminEmail, hashedPw, 'admin', 2500]);
    } else {
      db.run(`UPDATE users SET password = ?, role = ? WHERE email = ?`, [hashedPw, 'admin', adminEmail]);
    }
  });
});

// Auth Middlewares
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) { res.status(401).json({ error: 'Invalid Token' }); }
};

const adminOnly = (req, res, next) => {
  db.get(`SELECT role FROM users WHERE id = ?`, [req.user.id], (err, row) => {
    if (row && row.role === 'admin') next();
    else res.status(403).json({ error: 'Admin access required' });
  });
};

// Admin API
app.get('/api/admin/users', authenticate, adminOnly, (req, res) => {
  db.all(`SELECT id, name, email, role, goal, dailyCalories FROM users`, (err, rows) => res.json(rows));
});

app.post('/api/admin/users/role', authenticate, adminOnly, (req, res) => {
  const { userId, role } = req.body;
  db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, userId], () => res.json({ success: true }));
});

// REMOVE USER ENDPOINT (Preserved for backend connectivity)
app.delete('/api/admin/users/:id', authenticate, adminOnly, (req, res) => {
  const userId = req.params.id;
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete self" });
  }
  db.run(`DELETE FROM users WHERE id = ?`, [userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM plans WHERE user_id = ?`, [userId]);
    res.json({ success: true });
  });
});

app.get('/api/admin/stats', authenticate, adminOnly, (req, res) => {
  db.get(`SELECT 
    (SELECT COUNT(*) FROM users) as totalUsers,
    (SELECT COUNT(*) FROM plans) as totalPlans,
    (SELECT AVG(waterIntake) FROM plans) as avgWater`, (err, stats) => res.json(stats));
});

app.listen(PORT, () => console.log(`Backend Server: http://localhost:${PORT}`));
