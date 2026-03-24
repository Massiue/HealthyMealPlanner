import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const MYSQL_URI = process.env.MYSQL_URI || process.env.AIVEN_MYSQL_URI || process.env.DATABASE_URL || "";
const MYSQL_SSL_MODE = String(process.env.MYSQL_SSL_MODE || "REQUIRED").toUpperCase();
const MYSQL_SSL_CA_PATH = process.env.MYSQL_SSL_CA_PATH || "./backend/aiven-ca.pem";
const MYSQL_SSL_CA = process.env.MYSQL_SSL_CA || "";
const MYSQL_SSL_REJECT_UNAUTHORIZED =
  String(process.env.MYSQL_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false";
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "./backend/nutriplan.db";
const MIGRATE_TRUNCATE = String(process.env.MIGRATE_TRUNCATE || "false").toLowerCase() === "true";

const parseMysqlConfig = () => {
  let host = process.env.MYSQL_HOST || process.env.DB_HOST || "";
  let portRaw = process.env.MYSQL_PORT || process.env.DB_PORT || "";
  let user = process.env.MYSQL_USER || process.env.DB_USER || "";
  let password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
  let database = process.env.MYSQL_DATABASE || process.env.DB_NAME || "";

  if (!portRaw && host.includes(":") && !host.startsWith("[")) {
    const [hostOnly, portOnly] = host.split(":");
    if (hostOnly && portOnly && /^\d+$/.test(portOnly)) {
      host = hostOnly;
      portRaw = portOnly;
    }
  }

  if (MYSQL_URI) {
    let parsed;
    try {
      parsed = new URL(MYSQL_URI);
    } catch {
      throw new Error("MYSQL_URI is invalid. Expected mysql://user:pass@host:port/database");
    }

    if (parsed.protocol !== "mysql:") {
      throw new Error("MYSQL_URI protocol must be mysql:, got " + parsed.protocol);
    }

    host = parsed.hostname || host;
    portRaw = parsed.port || portRaw;
    user = parsed.username ? decodeURIComponent(parsed.username) : user;
    password = parsed.password ? decodeURIComponent(parsed.password) : password;
    const dbFromUri = parsed.pathname ? parsed.pathname.replace(/^\//, "") : "";
    database = dbFromUri || database;
  }

  const missing = [];
  if (!host) missing.push("MYSQL_HOST");
  if (!portRaw) missing.push("MYSQL_PORT");
  if (!user) missing.push("MYSQL_USER");
  if (!password) missing.push("MYSQL_PASSWORD");
  if (!database) missing.push("MYSQL_DATABASE");
  if (missing.length) throw new Error("Missing required MySQL environment variables: " + missing.join(", "));

  if (host.includes(":") && !host.startsWith("[")) {
    throw new Error("MYSQL_HOST must not contain a port. Put port in MYSQL_PORT.");
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Invalid MySQL port: " + portRaw);
  }

  return { host, port, user, password, database };
};

const resolveCaCandidates = () => {
  const raw = String(MYSQL_SSL_CA_PATH || "").trim();
  const candidates = [];

  if (raw) {
    if (path.isAbsolute(raw)) candidates.push(raw);
    else {
      candidates.push(path.resolve(root, raw));
      candidates.push(path.resolve(root, "backend/aiven-ca.pem"));
    }
  }

  candidates.push(path.resolve(root, "backend/aiven-ca.pem"));
  return [...new Set(candidates)];
};

const loadMysqlCa = () => {
  if (MYSQL_SSL_CA) return MYSQL_SSL_CA.replace(/\\n/g, "\n");
  for (const candidate of resolveCaCandidates()) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8");
  }
  return null;
};

const runPython = (sqlitePath) => {
  const py = [
    "import json, sqlite3, sys",
    "db_path = sys.argv[1]",
    "conn = sqlite3.connect(db_path)",
    "conn.row_factory = sqlite3.Row",
    "tables = ['users', 'meals', 'plans', 'mock_meal_meta']",
    "out = {}",
    "for t in tables:",
    "    try:",
    "        rows = conn.execute(f'SELECT * FROM {t}').fetchall()",
    "        out[t] = [dict(r) for r in rows]",
    "    except Exception:",
    "        out[t] = []",
    "print(json.dumps(out))",
  ].join("\n");

  const tryExec = (bin) => spawnSync(bin, ["-c", py, sqlitePath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });

  let res = tryExec("python");
  if (res.error || res.status !== 0) {
    const second = tryExec("python3");
    if (!second.error && second.status === 0) res = second;
  }

  if (res.error) {
    throw new Error(`Failed to run Python: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`Python export failed: ${res.stderr || "unknown error"}`);
  }

  return JSON.parse(res.stdout || "{}");
};

const ensureSchema = async (conn) => {
  await conn.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    age INT,
    gender VARCHAR(20),
    height FLOAT,
    weight FLOAT,
    activityLevel VARCHAR(50),
    goal VARCHAR(100),
    dailyCalories INT,
    dailyProtein INT,
    dailyWater FLOAT,
    weightHistory LONGTEXT
  )`);

  await conn.execute(`CREATE TABLE IF NOT EXISTS meals (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mealName TEXT,
    mealType VARCHAR(50),
    calories INT,
    protein INT,
    dietTag VARCHAR(100),
    imageUrl LONGTEXT,
    createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await conn.execute(`CREATE TABLE IF NOT EXISTS plans (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date VARCHAR(20) NOT NULL,
    breakfast_id VARCHAR(255),
    lunch_id VARCHAR(255),
    dinner_id VARCHAR(255),
    waterIntake FLOAT DEFAULT 0,
    breakfast_data LONGTEXT,
    lunch_data LONGTEXT,
    dinner_data LONGTEXT,
    UNIQUE KEY uniq_user_date (user_id, date),
    CONSTRAINT fk_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await conn.execute(`CREATE TABLE IF NOT EXISTS mock_meal_meta (
    mockId VARCHAR(255) PRIMARY KEY,
    deleted TINYINT(1) DEFAULT 0,
    convertedMealId INT,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
};

const upsertUsers = async (conn, rows) => {
  const sql = `INSERT INTO users (id, name, email, password, role, age, gender, height, weight, activityLevel, goal, dailyCalories, dailyProtein, dailyWater, weightHistory)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 name=VALUES(name), email=VALUES(email), password=VALUES(password), role=VALUES(role),
                 age=VALUES(age), gender=VALUES(gender), height=VALUES(height), weight=VALUES(weight),
                 activityLevel=VALUES(activityLevel), goal=VALUES(goal), dailyCalories=VALUES(dailyCalories),
                 dailyProtein=VALUES(dailyProtein), dailyWater=VALUES(dailyWater), weightHistory=VALUES(weightHistory)`;
  for (const r of rows) {
    await conn.execute(sql, [
      r.id ?? null,
      r.name ?? null,
      r.email ?? null,
      r.password ?? null,
      r.role ?? "user",
      r.age ?? null,
      r.gender ?? null,
      r.height ?? null,
      r.weight ?? null,
      r.activityLevel ?? null,
      r.goal ?? null,
      r.dailyCalories ?? null,
      r.dailyProtein ?? null,
      r.dailyWater ?? null,
      r.weightHistory ?? null,
    ]);
  }
};

const upsertMeals = async (conn, rows) => {
  const sql = `INSERT INTO meals (id, mealName, mealType, calories, protein, dietTag, imageUrl, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 mealName=VALUES(mealName), mealType=VALUES(mealType), calories=VALUES(calories),
                 protein=VALUES(protein), dietTag=VALUES(dietTag), imageUrl=VALUES(imageUrl), createdAt=VALUES(createdAt)`;
  for (const r of rows) {
    await conn.execute(sql, [
      r.id ?? null,
      r.mealName ?? null,
      r.mealType ?? null,
      r.calories ?? null,
      r.protein ?? null,
      r.dietTag ?? null,
      r.imageUrl ?? null,
      r.createdAt ?? null,
    ]);
  }
};

const upsertPlans = async (conn, rows) => {
  const sql = `INSERT INTO plans (id, user_id, date, breakfast_id, lunch_id, dinner_id, waterIntake, breakfast_data, lunch_data, dinner_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 user_id=VALUES(user_id), date=VALUES(date), breakfast_id=VALUES(breakfast_id),
                 lunch_id=VALUES(lunch_id), dinner_id=VALUES(dinner_id), waterIntake=VALUES(waterIntake),
                 breakfast_data=VALUES(breakfast_data), lunch_data=VALUES(lunch_data), dinner_data=VALUES(dinner_data)`;
  for (const r of rows) {
    await conn.execute(sql, [
      r.id ?? null,
      r.user_id ?? null,
      r.date ?? null,
      r.breakfast_id ?? null,
      r.lunch_id ?? null,
      r.dinner_id ?? null,
      r.waterIntake ?? 0,
      r.breakfast_data ?? null,
      r.lunch_data ?? null,
      r.dinner_data ?? null,
    ]);
  }
};

const upsertMockMeta = async (conn, rows) => {
  const sql = `INSERT INTO mock_meal_meta (mockId, deleted, convertedMealId, updatedAt)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 deleted=VALUES(deleted), convertedMealId=VALUES(convertedMealId), updatedAt=VALUES(updatedAt)`;
  for (const r of rows) {
    await conn.execute(sql, [
      r.mockId ?? null,
      r.deleted ?? 0,
      r.convertedMealId ?? null,
      r.updatedAt ?? null,
    ]);
  }
};

const main = async () => {
  const sqlitePath = path.resolve(root, SQLITE_DB_PATH);
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite file not found: ${sqlitePath}`);
  }

  const mysqlConfig = parseMysqlConfig();
  const mysqlCa = loadMysqlCa();

  if (MYSQL_SSL_MODE === "REQUIRED" && !mysqlCa) {
    throw new Error("MYSQL_SSL_MODE=REQUIRED but no CA certificate found.");
  }

  const pool = mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    ...(MYSQL_SSL_MODE === "REQUIRED"
      ? {
          ssl: {
            ca: mysqlCa,
            rejectUnauthorized: MYSQL_SSL_REJECT_UNAUTHORIZED,
          },
        }
      : {}),
  });

  console.log(`Reading SQLite from ${sqlitePath}`);
  const data = runPython(sqlitePath);
  console.log(`SQLite rows => users:${data.users?.length || 0}, meals:${data.meals?.length || 0}, plans:${data.plans?.length || 0}, mock_meal_meta:${data.mock_meal_meta?.length || 0}`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureSchema(conn);

    if (MIGRATE_TRUNCATE) {
      console.log("MIGRATE_TRUNCATE=true -> clearing target MySQL tables first");
      await conn.execute("SET FOREIGN_KEY_CHECKS=0");
      await conn.execute("TRUNCATE TABLE plans");
      await conn.execute("TRUNCATE TABLE mock_meal_meta");
      await conn.execute("TRUNCATE TABLE meals");
      await conn.execute("TRUNCATE TABLE users");
      await conn.execute("SET FOREIGN_KEY_CHECKS=1");
    }

    await upsertUsers(conn, data.users || []);
    await upsertMeals(conn, data.meals || []);
    await upsertPlans(conn, data.plans || []);
    await upsertMockMeta(conn, data.mock_meal_meta || []);

    await conn.commit();
    console.log("SQLite -> MySQL migration completed successfully.");
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
};

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
