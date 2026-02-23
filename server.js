// server.js (FULL UPDATED)
import express from "express";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const sqlite = sqlite3.verbose();
const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "nutri-plan-secret-key-2024";

app.use(cors());
app.use(express.json());

// -------------------- DB --------------------
const db = new sqlite.Database("./nutriplan.db", (err) => {
  if (err) console.error("Database error:", err.message);
  else console.log("Connected to NutriPlan Database");
});

const toStoredMealId = (meal) => {
  if (!meal || meal.id === undefined || meal.id === null) return null;
  const asNumber = Number(meal.id);
  return Number.isNaN(asNumber) ? String(meal.id) : asNumber;
};

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sanitizeUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    age: row.age,
    gender: row.gender,
    height: row.height,
    weight: row.weight,
    activityLevel: row.activityLevel,
    goal: row.goal,
    dailyCalories: row.dailyCalories,
    dailyProtein: row.dailyProtein,
    dailyWater: row.dailyWater,
    weightHistory: safeJsonParse(row.weightHistory, []),
  };
};

db.serialize(() => {
  const ensureColumn = (table, column, definition) => {
    db.all(`PRAGMA table_info(${table})`, (pragmaErr, columns) => {
      if (pragmaErr) return console.error(`Schema lookup failed for ${table}:`, pragmaErr.message);
      const exists = columns.some((col) => col.name === column);
      if (exists) return;
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (alterErr) => {
        if (alterErr) console.error(`Failed adding ${table}.${column}:`, alterErr.message);
      });
    });
  };

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

  db.run(`CREATE TABLE IF NOT EXISTS mock_meal_meta (
    mockId TEXT PRIMARY KEY,
    deleted INTEGER DEFAULT 0,
    convertedMealId INTEGER,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  ensureColumn("users", "dailyProtein", "INTEGER");
  ensureColumn("users", "dailyWater", "REAL");
  ensureColumn("users", "weightHistory", "TEXT");
  ensureColumn("plans", "breakfast_data", "TEXT");
  ensureColumn("plans", "lunch_data", "TEXT");
  ensureColumn("plans", "dinner_data", "TEXT");

  // Force Sync Admin Account
  const adminEmail = process.env.ADMIN_EMAIL || "madhang285@gmail.com";
  const adminPass = process.env.ADMIN_PASS || "123";

  db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], async (err, row) => {
    if (err) return console.error("Admin lookup error:", err);

    const hashedPw = await bcrypt.hash(adminPass, 10);
    if (!row) {
      db.run(
        `INSERT INTO users (name, email, password, role, dailyCalories) VALUES (?, ?, ?, ?, ?)`,
        ["System Admin", adminEmail, hashedPw, "admin", 2500],
        (e) => e && console.error("Admin insert error:", e)
      );
    } else {
      db.run(
        `UPDATE users SET password = ?, role = ? WHERE email = ?`,
        [hashedPw, "admin", adminEmail],
        (e) => e && console.error("Admin update error:", e)
      );
    }
  });
});

// -------------------- Email --------------------
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Hard stop if missing env (prevents silent failures)
if (!EMAIL_USER || !EMAIL_PASS) {
  console.error("EMAIL_USER or EMAIL_PASS missing in .env");
  console.error("Create .env in the same folder as server.js and restart.");
}

// Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS, // MUST be App Password (16-digit)
  },
});

// Verify SMTP on server start (prints FULL error)
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP VERIFY FAILED");
  } else {
    console.log("SMTP READY", success);
  }
});

// Helper to log full nodemailer errors
function logMailError(tag, err) {
  console.error(`${tag} `);
  console.error("message:", err?.message);
  console.error("code:", err?.code);
  console.error("response:", err?.response);
  console.error("responseCode:", err?.responseCode);
  console.error("command:", err?.command);
}

function sendConfirmationMail(email, name) {
  return transporter.sendMail({
    from: `"Healthy Meal Planner" <${EMAIL_USER}>`,
    replyTo: EMAIL_USER,
    to: email,
    subject: "Welcome to Healthy Meal Planner",
    html: `<h2>Hello ${name || "User"},</h2>
           <p>Your account has been successfully created.<br>
           Welcome to Healthy Meal Planner!</p>`,
  });
}

function sendLoginAlert(email, name) {
  return transporter.sendMail({
    from: `"Healthy Meal Planner" <${EMAIL_USER}>`,
    replyTo: EMAIL_USER,
    to: email,
    subject: "Healthy Meal Planner Login Alert",
    html: `<h2>Hello ${name || "User"},</h2>
           <p>Your account was just accessed. If this wasn't you, please reset your password.</p>`,
  });
}

function sendSecurityAlert(email, name) {
  return transporter.sendMail({
    from: `"Healthy Meal Planner" <${EMAIL_USER}>`,
    replyTo: EMAIL_USER,
    to: email,
    subject: "Healthy Meal Planner Security Alert",
    html: `<h2>Hello ${name || "User"},</h2>
           <p>There was a failed login attempt to your account. If this wasn't you, please reset your password.</p>`,
  });
}

// Email validation helper
function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// -------------------- Auth Middleware --------------------
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    res.status(401).json({ error: "Invalid Token" });
  }
};

const adminOnly = (req, res, next) => {
  db.get(`SELECT role FROM users WHERE id = ?`, [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row && row.role === "admin") next();
    else res.status(403).json({ error: "Admin access required" });
  });
};

// -------------------- ENV CHECK ROUTE --------------------
app.get("/api/env-check", (req, res) => {
  res.json({
    PORT,
    EMAIL_USER: EMAIL_USER || null,
    EMAIL_PASS_LENGTH: (EMAIL_PASS || "").length,
    JWT_SECRET_LENGTH: (process.env.JWT_SECRET || "").length,
  });
});

// -------------------- TEST EMAIL ROUTE --------------------
app.get("/api/test-email", async (req, res) => {
  try {
    const to = req.query.to || EMAIL_USER; // default send to yourself
    const info = await transporter.sendMail({
      from: `"Healthy Meal Planner" <${EMAIL_USER}>`,
      to,
      subject: "Test Email - Healthy Meal Planner",
      text: "If you got this email, Nodemailer + Gmail is working",
    });
    res.json({
      success: true,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
    });
  } catch (e) {
    console.error("TEST EMAIL ERROR FULL:", e);
    res.status(500).json({
      success: false,
      message: e.message,
      code: e.code,
      response: e.response,
      responseCode: e.responseCode,
      command: e.command,
    });
  }
});

// -------------------- Sign Up API --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    if (!isValidEmail(email))
      return res.status(400).json({ error: "Invalid email format" });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(409).json({ error: "Email already registered" });

      const hashedPw = await bcrypt.hash(password, 10);

      db.run(
        `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
        [name || "User", email, hashedPw],
        async function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });

          // Send confirmation email
          try {
            const info = await sendConfirmationMail(email, name || "User");
            console.log("CONFIRMATION EMAIL SENT", info.response, "to", email);
          } catch (mailErr) {
            logMailError("CONFIRM MAIL ERROR", mailErr);
          }

          res.json({ success: true });
        }
      );
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------- Login API --------------------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      // Respond immediately; email notifications must not block auth.
      res.status(401).json({ error: "Invalid email or password" });
      setImmediate(async () => {
        try {
          const info = await sendSecurityAlert(email, user.name);
          console.log("SECURITY ALERT EMAIL SENT", info.response, "to", email);
        } catch (mailErr) {
          logMailError("SECURITY MAIL ERROR", mailErr);
        }
      });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });

    // Send login alert in background after response is sent.
    setImmediate(async () => {
      try {
        const info = await sendLoginAlert(email, user.name);
        console.log("LOGIN ALERT EMAIL SENT", info.response, "to", email);
      } catch (mailErr) {
        logMailError("LOGIN MAIL ERROR", mailErr);
      }
    });
  });
});

app.get("/api/me", authenticate, (req, res) => {
  db.get(
    `SELECT id, name, email, role, age, gender, height, weight, activityLevel, goal, dailyCalories, dailyProtein, dailyWater, weightHistory
     FROM users
     WHERE id = ?`,
    [req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "User not found" });
      res.json(sanitizeUser(row));
    }
  );
});

app.put("/api/profile", authenticate, (req, res) => {
  const allowed = [
    "name",
    "age",
    "gender",
    "height",
    "weight",
    "activityLevel",
    "goal",
    "dailyCalories",
    "dailyProtein",
    "dailyWater",
    "weightHistory",
  ];

  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (key === "weightHistory") {
      updates.push(`${key} = ?`);
      values.push(JSON.stringify(Array.isArray(req.body[key]) ? req.body[key] : []));
    } else {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  const sendUpdatedUser = () => {
    db.get(
      `SELECT id, name, email, role, age, gender, height, weight, activityLevel, goal, dailyCalories, dailyProtein, dailyWater, weightHistory
       FROM users
       WHERE id = ?`,
      [req.user.id],
      (selectErr, row) => {
        if (selectErr) return res.status(500).json({ error: selectErr.message });
        res.json(sanitizeUser(row));
      }
    );
  };

  if (!updates.length) {
    return sendUpdatedUser();
  }

  values.push(req.user.id);
  db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    sendUpdatedUser();
  });
});

app.get("/api/meals", (req, res) => {
  db.all(
    `SELECT id, mealName, mealType, calories, protein, dietTag, imageUrl
     FROM meals
     ORDER BY id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/api/mock-meals/meta", (req, res) => {
  db.all(
    `SELECT mockId, deleted, convertedMealId
     FROM mock_meal_meta`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.get("/api/plans", authenticate, (req, res) => {
  db.all(
    `SELECT date, waterIntake, breakfast_data, lunch_data, dinner_data
     FROM plans
     WHERE user_id = ?
     ORDER BY date DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const plans = rows.map((row) => ({
        date: row.date,
        waterIntake: Number(row.waterIntake || 0),
        breakfast: safeJsonParse(row.breakfast_data, null) || undefined,
        lunch: safeJsonParse(row.lunch_data, null) || undefined,
        dinner: safeJsonParse(row.dinner_data, null) || undefined,
      }));
      res.json(plans);
    }
  );
});

app.put("/api/plans/:date", authenticate, (req, res) => {
  const date = req.params.date;
  const breakfast = req.body.breakfast || null;
  const lunch = req.body.lunch || null;
  const dinner = req.body.dinner || null;
  const waterIntake = Math.max(0, Number(req.body.waterIntake || 0));

  if (!date) return res.status(400).json({ error: "Date is required" });

  db.run(
    `INSERT INTO plans (user_id, date, breakfast_id, lunch_id, dinner_id, waterIntake, breakfast_data, lunch_data, dinner_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       breakfast_id = excluded.breakfast_id,
       lunch_id = excluded.lunch_id,
       dinner_id = excluded.dinner_id,
       waterIntake = excluded.waterIntake,
       breakfast_data = excluded.breakfast_data,
       lunch_data = excluded.lunch_data,
       dinner_data = excluded.dinner_data`,
    [
      req.user.id,
      date,
      toStoredMealId(breakfast),
      toStoredMealId(lunch),
      toStoredMealId(dinner),
      waterIntake,
      breakfast ? JSON.stringify(breakfast) : null,
      lunch ? JSON.stringify(lunch) : null,
      dinner ? JSON.stringify(dinner) : null,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// -------------------- Admin APIs --------------------
// Add meal to meals table
app.post("/api/admin/meals", authenticate, adminOnly, (req, res) => {
  const { mealName, mealType, calories, protein, dietTag, imageUrl } = req.body;
  db.run(
    `INSERT INTO meals (mealName, mealType, calories, protein, dietTag, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`,
    [mealName, mealType, calories, protein, dietTag, imageUrl],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, mealId: this.lastID });
    }
  );
});

app.put("/api/admin/meals/:id", authenticate, adminOnly, (req, res) => {
  const mealId = req.params.id;
  const { mealName, mealType, calories, protein, dietTag, imageUrl } = req.body;
  db.run(
    `UPDATE meals
     SET mealName = ?, mealType = ?, calories = ?, protein = ?, dietTag = ?, imageUrl = ?
     WHERE id = ?`,
    [mealName, mealType, calories, protein, dietTag, imageUrl, mealId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Meal not found" });
      res.json({ success: true });
    }
  );
});

app.delete("/api/admin/meals/:id", authenticate, adminOnly, (req, res) => {
  const mealId = req.params.id;
  db.run(`DELETE FROM meals WHERE id = ?`, [mealId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Meal not found" });
    res.json({ success: true });
  });
});

app.get("/api/admin/users", authenticate, adminOnly, (req, res) => {
  db.all(
    `SELECT id, name, email, role, goal, dailyCalories FROM users`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/admin/users/role", authenticate, adminOnly, (req, res) => {
  const { userId, role } = req.body;
  db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post("/api/admin/mock-meals/convert", authenticate, adminOnly, (req, res) => {
  const { mockId, convertedMealId } = req.body;
  if (!mockId || !convertedMealId) {
    return res.status(400).json({ error: "mockId and convertedMealId are required" });
  }

  db.run(
    `INSERT INTO mock_meal_meta (mockId, deleted, convertedMealId, updatedAt)
     VALUES (?, 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(mockId) DO UPDATE SET
       deleted = 1,
       convertedMealId = excluded.convertedMealId,
       updatedAt = CURRENT_TIMESTAMP`,
    [String(mockId), Number(convertedMealId)],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/mock-meals/delete", authenticate, adminOnly, (req, res) => {
  const { mockId } = req.body;
  if (!mockId) {
    return res.status(400).json({ error: "mockId is required" });
  }

  db.run(
    `INSERT INTO mock_meal_meta (mockId, deleted, convertedMealId, updatedAt)
     VALUES (?, 1, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(mockId) DO UPDATE SET
       deleted = 1,
       convertedMealId = NULL,
       updatedAt = CURRENT_TIMESTAMP`,
    [String(mockId)],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete("/api/admin/users/:id", authenticate, adminOnly, (req, res) => {
  const userId = req.params.id;

  if (parseInt(userId, 10) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete self" });
  }

  db.run(`DELETE FROM users WHERE id = ?`, [userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM plans WHERE user_id = ?`, [userId]);
    res.json({ success: true });
  });
});

app.get("/api/admin/stats", authenticate, adminOnly, (req, res) => {
  db.get(
    `SELECT 
      (SELECT COUNT(*) FROM users) as totalUsers,
      (SELECT COUNT(*) FROM plans) as totalPlans,
      (SELECT AVG(waterIntake) FROM plans) as avgWater`,
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(stats);
    }
  );
});

// -------------------- Health Check --------------------
app.get("/", (req, res) => res.send("Healthy Meal Planner Backend Running"));

app.listen(PORT, () => {
  console.log(`Backend Server: http://localhost:${PORT}`);
});
