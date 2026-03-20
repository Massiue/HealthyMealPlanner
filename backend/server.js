// server.js (FULL UPDATED)
import express from "express";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const databasePath = path.join(__dirname, "nutriplan.db");

dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });
const sqlite = sqlite3.verbose();
const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "nutri-plan-secret-key-2024";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
const geminiClient = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

app.use(cors());
app.use(express.json());

// -------------------- DB --------------------
const db = new sqlite.Database(databasePath, (err) => {
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
  ensureColumn("meals", "createdAt", "TEXT DEFAULT CURRENT_TIMESTAMP");
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
  console.error("Create .env in the project root and restart.");
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

const getMacroProteinMultiplier = (goal) => {
  switch (goal) {
    case "Muscle Gain":
      return 1.8;
    case "Weight Loss":
      return 1.6;
    case "Weight Gain":
      return 1.5;
    default:
      return 1.2;
  }
};

const extractWeightFromMessage = (message) => {
  const regex = /(\d+(?:\.\d+)?)\s?(kg|kgs|kilograms?)\b/i;
  const match = message.match(regex);
  if (!match) return null;
  const weight = Number(match[1]);
  return Number.isFinite(weight) ? weight : null;
};

const getBmr = ({ weight, height, age, gender }) => {
  if (!weight || !height || !age || !gender) return null;
  if (gender === "male") return 10 * weight + 6.25 * height - 5 * age + 5;
  if (gender === "female") return 10 * weight + 6.25 * height - 5 * age - 161;
  return 10 * weight + 6.25 * height - 5 * age - 78;
};

const getActivityMultiplier = (activityLevel) => {
  const parsed = Number(activityLevel);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.2;
};

const getMealSlotFromMessage = (message) => {
  const text = String(message || "").toLowerCase();
  if (/breakfast|morning/.test(text)) return "breakfast";
  if (/lunch|afternoon/.test(text)) return "lunch";
  if (/dinner|supper|night/.test(text)) return "dinner";
  if (/snack/.test(text)) return "snack";
  return "meal";
};

const getMealShare = (slot) => {
  if (slot === "breakfast") return 0.25;
  if (slot === "lunch") return 0.35;
  if (slot === "dinner") return 0.3;
  if (slot === "snack") return 0.1;
  return 0.3;
};

const getDietPreferenceFromMessage = (message) => {
  const text = String(message || "").toLowerCase();
  if (/\b(non[-\s]?veg|non\sveg|nonveg|nonvegetarian|non-vegetarian)\b/.test(text)) {
    return "non_veg";
  }
  if (/\b(veg|vegetarian|vegan|plant[-\s]?based)\b/.test(text)) return "veg";
  return null;
};

const shuffle = (items) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const normalizeMealType = (value) => String(value || "").toLowerCase();

const isMealTypeMatch = (mealType, slot) => {
  const mt = normalizeMealType(mealType);
  if (slot === "meal") return true;
  return mt.includes(slot);
};

const buildFallbackOptions = (slot, goal, preference = null) => {
  const vegBySlot = {
    breakfast: [
      "oats with milk, nuts, and banana",
      "besan chilla with mint chutney",
      "Greek yogurt bowl with fruit and seeds",
    ],
    lunch: [
      "paneer tikka with brown rice and salad",
      "dal, chapati, mixed vegetables, and curd",
      "quinoa bowl with chickpeas and sauteed vegetables",
    ],
    dinner: [
      "grilled tofu with vegetables and soup",
      "paneer curry with a small serving of rice",
      "lentil soup with stir-fried vegetables and salad",
    ],
    snack: [
      "roasted chana with buttermilk",
      "fruit with peanut butter",
      "sprouts chaat with lemon",
    ],
    meal: [
      "grilled protein + whole grains + vegetables",
      "dal + chapati + salad + curd",
      "paneer/tofu bowl with rice and veggies",
    ],
  };

  const nonVegBySlot = {
    breakfast: [
      "egg omelette with whole-grain toast and fruit",
      "boiled eggs with oats and milk",
      "chicken sandwich on whole-grain bread",
    ],
    lunch: [
      "grilled chicken with brown rice and vegetables",
      "fish curry with rice and salad",
      "chicken wrap with yogurt dip",
    ],
    dinner: [
      "grilled fish with sauteed vegetables and soup",
      "chicken curry with a small serving of rice",
      "egg bhurji with chapati and salad",
    ],
    snack: [
      "boiled eggs and buttermilk",
      "tuna sandwich on whole-grain bread",
      "chicken soup cup",
    ],
    meal: [
      "grilled chicken/fish + whole grains + vegetables",
      "egg dish + chapati + salad",
      "chicken bowl with rice and veggies",
    ],
  };

  const source = preference === "non_veg" ? nonVegBySlot : vegBySlot;
  const options = source[slot] || source.meal;
  if (goal === "Muscle Gain") {
    return options.map((o) => `${o} (add extra protein portion)`);
  }
  if (goal === "Weight Loss") {
    return options.map((o) => `${o} (keep oil low and increase vegetables)`);
  }
  return options;
};

const mealMatchesPreference = (meal, preference) => {
  if (!preference) return true;
  const tag = String(meal?.dietTag || "").toLowerCase();
  const name = String(meal?.mealName || "").toLowerCase();
  const nonVegHint = /(chicken|fish|mutton|beef|pork|egg|prawn|shrimp|tuna|seafood|steak)/.test(
    `${tag} ${name}`
  );
  const vegHint = /(veg|vegetarian|vegan|plant|paneer|tofu|dal|lentil|chickpea|chole|idli|sambar)/.test(
    `${tag} ${name}`
  );

  if (preference === "veg") {
    if (nonVegHint) return false;
    if (tag.includes("non veg") || tag.includes("non-veg")) return false;
    return true;
  }

  if (preference === "non_veg") {
    if (nonVegHint || tag.includes("non veg") || tag.includes("non-veg")) return true;
    if (vegHint || tag.includes("veg") || tag.includes("vegetarian") || tag.includes("vegan")) {
      return false;
    }
    return false;
  }

  return true;
};

const pickMealsFromRecommendations = ({
  meals,
  slot,
  targetCalories,
  targetProtein,
  goal,
  preference = null,
  limit = 3,
}) => {
  const typed = (Array.isArray(meals) ? meals : []).filter((m) => isMealTypeMatch(m?.mealType, slot));
  const pool = typed.length ? typed : Array.isArray(meals) ? meals : [];
  const filtered = pool.filter((meal) => mealMatchesPreference(meal, preference));
  if (!filtered.length) return [];

  const scored = filtered
    .map((meal) => {
      const calories = Number(meal?.calories || 0);
      const protein = Number(meal?.protein || 0);
      const calorieScore = targetCalories ? Math.abs(calories - targetCalories) / Math.max(targetCalories, 1) : 0;
      const proteinGap = targetProtein ? Math.max(0, targetProtein - protein) / Math.max(targetProtein, 1) : 0;

      let goalAdjust = 0;
      if (goal === "Weight Loss" && targetCalories && calories > targetCalories * 1.2) goalAdjust += 0.6;
      if (goal === "Muscle Gain" && targetProtein) goalAdjust += Math.max(0, (targetProtein - protein) / Math.max(targetProtein, 1));
      if (goal === "Weight Gain" && targetCalories) goalAdjust += calories < targetCalories ? 0.4 : -0.1;

      return {
        meal,
        score: calorieScore + proteinGap + goalAdjust,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);

  return shuffle(scored)
    .slice(0, limit)
    .map((entry) => entry.meal);
};

const parseIntent = (message) => {
  const text = String(message || "").toLowerCase();

  if (/juice|smoothie|beverage|drink|drinks/.test(text)) return "beverage";
  if (/protein|proteins|gram.*protein|how much protein/.test(text)) return "protein";
  if (/calorie|calories|kcal|energy|maintenance/.test(text)) return "calories";
  if (/water|hydration|hydrate|liters|litres/.test(text)) return "hydration";
  if (/bmi|body mass index/.test(text)) return "bmi";
  if (/macro|carb|fat/.test(text)) return "macros";
  if (/meal plan|full day|whole day|today.?s plan|diet chart|plan for today/.test(text)) {
    return "daily_plan";
  }
  if (
    /what can i eat|what should i eat|what kind of food|which food|food.*consume|consume.*food|suggest|recommend|meal idea|diet plan|today.?s?\s+(breakfast|lunch|dinner)|for (breakfast|lunch|dinner|snack)|\b(breakfast|lunch|dinner|snack)\b|another food|different food|other food|give.*food|more options/.test(
      text
    )
  ) {
    return "meal_suggestion";
  }
  if (/meal|food|eat|eating|drink|drinks|beverage|beverages|juice|smoothie|dish|recipe|ingredient|diet|nutrition/.test(text)) {
    return "food_general";
  }
  return "general";
};

const isMealOrFoodQuestion = (message) => {
  const text = String(message || "").toLowerCase();
  if (!text) return false;

  return /(meal|food|eat|eating|drink|drinks|beverage|beverages|juice|smoothie|fruit juice|breakfast|lunch|dinner|snack|dish|recipe|ingredient|calorie|calories|kcal|protein|carb|carbs|fat|nutrition|diet|hydration|hydrate|water)/.test(
    text
  );
};

const toChatbotMeal = (meal) => ({
  id: String(meal?.id ?? ""),
  mealName: String(meal?.mealName ?? ""),
  mealType: String(meal?.mealType ?? ""),
  calories: Number(meal?.calories ?? 0),
  protein: Number(meal?.protein ?? 0),
  imageUrl: String(meal?.imageUrl ?? ""),
  dietTag: String(meal?.dietTag ?? "Vegetarian"),
});

const generateGeneralChatReply = async (message, user = {}, availableMeals = []) => {
  if (!geminiClient) {
    return {
      intent: "general",
      reply:
        "I can answer general questions once `GEMINI_API_KEY` is configured on the server. Right now I can still help with meals, calories, protein, hydration, BMI, and daily meal planning.",
    };
  }

  const profileSummary = [
    user?.goal ? `Goal: ${user.goal}` : null,
    user?.age ? `Age: ${user.age}` : null,
    user?.gender ? `Gender: ${user.gender}` : null,
    user?.height ? `Height: ${user.height} cm` : null,
    user?.weight ? `Weight: ${user.weight} kg` : null,
    user?.activityLevel ? `Activity level: ${user.activityLevel}` : null,
    user?.dailyCalories ? `Daily calorie target: ${user.dailyCalories} kcal` : null,
    user?.dailyProtein ? `Daily protein target: ${user.dailyProtein} g` : null,
    user?.dailyWater ? `Daily water target: ${user.dailyWater} L` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sampleMeals = (Array.isArray(availableMeals) ? availableMeals : [])
    .slice(0, 12)
    .map((meal) => {
      const calories = Number(meal?.calories || 0);
      const protein = Number(meal?.protein || 0);
      return `- ${meal?.mealName || "Meal"} (${meal?.mealType || "meal"}, ${calories} kcal, ${protein}g protein, ${meal?.dietTag || "Any"})`;
    })
    .join("\n");

  const prompt = `
You are NutriPlan's in-app chatbot.
Answer the user's question directly and clearly.
If the question is about food, nutrition, calories, protein, hydration, meal planning, or healthy habits, personalize the answer using the profile and meal catalog below.
If the question is outside nutrition, still answer helpfully in a concise way.
Do not claim you performed actions you did not perform.
Avoid diagnosis or emergency medical advice; for urgent or medical-risk questions, say to consult a licensed professional.
Prefer short paragraphs or short bullet points.

User profile:
${profileSummary || "No saved profile data."}

Available meals in app:
${sampleMeals || "No meal catalog available."}

User question:
${message}
`;

  const response = await geminiClient.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return {
    intent: "general",
    reply:
      String(response?.text || "").trim() ||
      "I couldn't generate a response right now. Please try again.",
  };
};

const buildNutritionReply = (message, user, availableMeals = []) => {
  const intent = parseIntent(message);
  const messageWeight = extractWeightFromMessage(message);
  const weight = messageWeight || Number(user?.weight || 0) || null;

  if (intent === "beverage") {
    const goal = String(user?.goal || "Maintain Weight");
    const dailyCalories = Number(user?.dailyCalories || 0);

    let suggestions = "orange juice, watermelon juice, and lemon-mint juice";
    let guidance = "Prefer 1 small glass (200-250 ml), no added sugar.";

    if (goal === "Weight Loss") {
      suggestions = "lemon water, cucumber-mint juice, and diluted amla juice";
      guidance = "Keep portions small and avoid packed or sweetened juices.";
    } else if (goal === "Muscle Gain") {
      suggestions = "banana smoothie with milk, mango yogurt smoothie, and dates-badam shake";
      guidance = "Use whole fruit and include a protein source like milk or yogurt.";
    } else if (goal === "Weight Gain") {
      suggestions = "banana-peanut smoothie, chikoo milkshake, and mango lassi";
      guidance = "Add calorie-dense ingredients like nuts or seeds.";
    }

    const calorieNote = dailyCalories
      ? `This fits your target of about ${dailyCalories} kcal/day.`
      : "Pair juice with a balanced meal for better satiety.";

    return {
      intent,
      reply: `You can choose: ${suggestions}. ${guidance} ${calorieNote}`,
    };
  }

  if (intent === "protein") {
    if (!weight) {
      return {
        intent,
        reply:
          "I can calculate your protein target if you share your weight in kg. Example: I weigh 70kg.",
      };
    }
    const multiplier = getMacroProteinMultiplier(user?.goal);
    const grams = Math.round(weight * multiplier);
    return {
      intent,
      reply: `Based on your weight (${weight}kg), you should consume about ${grams}g protein daily.`,
    };
  }

  if (intent === "calories") {
    const bmr = getBmr(user || {});
    if (!bmr) {
      return {
        intent,
        reply:
          "I can estimate calories if your profile has age, gender, height, and weight. Update your profile and ask again.",
      };
    }
    const tdee = Math.round(bmr * getActivityMultiplier(user?.activityLevel));
    return {
      intent,
      reply: `Your estimated maintenance intake is around ${tdee} kcal/day based on your profile.`,
    };
  }

  if (intent === "hydration") {
    if (!weight) {
      return {
        intent,
        reply:
          "General hydration target is 2.5-3.5L per day. Share your weight in kg for a personalized estimate.",
      };
    }
    const liters = Math.max(1.5, Math.min(6, Number((weight * 0.035).toFixed(1))));
    return {
      intent,
      reply: `A practical hydration target for ${weight}kg is about ${liters}L of water daily.`,
    };
  }

  if (intent === "bmi") {
    const w = weight || Number(user?.weight || 0) || null;
    const hCm = Number(user?.height || 0) || null;
    if (!w || !hCm) {
      return {
        intent,
        reply:
          "I can calculate BMI if your profile includes both height (cm) and weight (kg).",
      };
    }
    const hM = hCm / 100;
    const bmi = Number((w / (hM * hM)).toFixed(1));
    return {
      intent,
      reply: `Your estimated BMI is ${bmi}. For most adults, 18.5 to 24.9 is the typical healthy range.`,
    };
  }

  if (intent === "macros") {
    if (!weight) {
      return {
        intent,
        reply:
          "A simple macro split is 30% protein, 40% carbs, 30% fats. Share weight or calorie target for exact grams.",
      };
    }
    const protein = Math.round(weight * getMacroProteinMultiplier(user?.goal));
    return {
      intent,
      reply: `A good starting point is protein ${protein}g/day, then split remaining calories across carbs and fats based on preference.`,
    };
  }

  if (intent === "meal_suggestion") {
    const slot = getMealSlotFromMessage(message);
    const slotLabel = slot === "meal" ? "meal" : slot;
    const preference = getDietPreferenceFromMessage(message);
    const goal = String(user?.goal || "Maintain Weight");
    const totalCalories = Number(user?.dailyCalories || 0);
    const totalProtein = Number(user?.dailyProtein || 0);
    const share = getMealShare(slot);

    const fallbackProtein = weight
      ? Math.round(weight * getMacroProteinMultiplier(user?.goal))
      : 80;
    const targetCalories = totalCalories ? Math.round(totalCalories * share) : null;
    const targetProtein = Math.max(
      15,
      Math.round((totalProtein || fallbackProtein) * share)
    );

    const picks = pickMealsFromRecommendations({
      meals: availableMeals,
      slot,
      targetCalories,
      targetProtein,
      goal,
      preference,
      limit: 3,
    });
    const fallback = shuffle(buildFallbackOptions(slot, goal, preference)).slice(0, 3);

    const calorieLine = targetCalories
      ? `Target about ${targetCalories} kcal and ${targetProtein}g protein for this ${slotLabel}.`
      : `Aim for around ${targetProtein}g protein in this ${slotLabel} based on your profile.`;

    if (picks.length) {
      const options = picks
        .map(
          (meal, idx) =>
            `${idx + 1}. ${meal.mealName} (${Number(meal.calories || 0)} kcal, ${Number(
              meal.protein || 0
            )}g protein)`
        )
        .join(" ");
      return {
        intent,
        reply: `For today's ${slotLabel}, try: ${options} ${calorieLine}`,
        suggestedMeals: picks.map(toChatbotMeal),
      };
    }

    return {
      intent,
      reply: `For today's ${slotLabel}, try: 1. ${fallback[0]} 2. ${fallback[1]} 3. ${fallback[2]} ${calorieLine}`,
    };
  }

  if (intent === "daily_plan") {
    const goal = String(user?.goal || "Maintain Weight");
    const preference = getDietPreferenceFromMessage(message);
    const weightValue = Number(user?.weight || 0);
    const proteinDay =
      Number(user?.dailyProtein || 0) ||
      (weightValue ? Math.round(weightValue * getMacroProteinMultiplier(user?.goal)) : 80);

    const breakfast = pickMealsFromRecommendations({
      meals: availableMeals,
      slot: "breakfast",
      targetCalories: Number(user?.dailyCalories || 0) ? Math.round(Number(user.dailyCalories) * 0.25) : 0,
      targetProtein: Math.round(proteinDay * 0.25),
      goal,
      preference,
      limit: 1,
    })[0];
    const lunch = pickMealsFromRecommendations({
      meals: availableMeals,
      slot: "lunch",
      targetCalories: Number(user?.dailyCalories || 0) ? Math.round(Number(user.dailyCalories) * 0.35) : 0,
      targetProtein: Math.round(proteinDay * 0.35),
      goal,
      preference,
      limit: 1,
    })[0];
    const dinner = pickMealsFromRecommendations({
      meals: availableMeals,
      slot: "dinner",
      targetCalories: Number(user?.dailyCalories || 0) ? Math.round(Number(user.dailyCalories) * 0.3) : 0,
      targetProtein: Math.round(proteinDay * 0.3),
      goal,
      preference,
      limit: 1,
    })[0];

    const fbBreakfast = shuffle(buildFallbackOptions("breakfast", goal, preference))[0];
    const fbLunch = shuffle(buildFallbackOptions("lunch", goal, preference))[0];
    const fbDinner = shuffle(buildFallbackOptions("dinner", goal, preference))[0];

    return {
      intent,
      reply: `Today's plan: Breakfast - ${breakfast?.mealName || fbBreakfast}; Lunch - ${
        lunch?.mealName || fbLunch
      }; Dinner - ${dinner?.mealName || fbDinner}. This is personalized to your ${
        user?.goal || "health"
      } goal${availableMeals.length ? ` using ${availableMeals.length} meals from recommendations` : ""}.`,
      suggestedMeals: [breakfast, lunch, dinner].filter(Boolean).map(toChatbotMeal),
    };
  }

  if (intent === "food_general") {
    const goal = String(user?.goal || "Maintain Weight");
    const weight = Number(user?.weight || 0);
    const dailyCalories = Number(user?.dailyCalories || 0);
    const proteinTarget =
      Number(user?.dailyProtein || 0) ||
      (weight ? Math.round(weight * getMacroProteinMultiplier(user?.goal)) : 80);

    let focus =
      "build meals with lean protein, high-fiber carbs, vegetables, and healthy fats";
    if (goal === "Weight Loss") {
      focus =
        "prioritize high-protein, high-fiber, lower-calorie foods and avoid sugary drinks";
    } else if (goal === "Muscle Gain") {
      focus =
        "eat protein-rich meals with complex carbs and include a protein source in every meal";
    } else if (goal === "Weight Gain") {
      focus =
        "choose calorie-dense but nutritious foods like rice, dairy, nuts, and protein-rich meals";
    }

    const targetLine = dailyCalories
      ? `Your profile target is about ${dailyCalories} kcal/day and ${proteinTarget}g protein/day.`
      : `A good target for you is around ${proteinTarget}g protein/day with balanced meals.`;

    return {
      intent,
      reply: `Based on your profile, ${focus}. ${targetLine}`,
    };
  }

  return {
    intent,
    reply:
      "Ask me nutrition questions like: protein target, calorie needs, hydration, BMI, or macro planning.",
  };
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
    try {
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
        { id: user.id, email: user.email, role: user.role || "user" },
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
    } catch (loginErr) {
      console.error("LOGIN ERROR:", loginErr);
      res.status(500).json({ error: "Unable to process login right now." });
    }
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

app.post("/api/chatbot/nutrition", authenticate, (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message is required" });

  db.get(
    `SELECT age, gender, height, weight, activityLevel, goal, dailyCalories, dailyProtein, dailyWater
     FROM users
     WHERE id = ?`,
    [req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      db.all(
        `SELECT id, mealName, mealType, calories, protein, dietTag, imageUrl
         FROM meals`,
        async (mealErr, mealRows) => {
          if (mealErr) return res.status(500).json({ error: mealErr.message });
          try {
            const normalizedMessage = message.toLowerCase();
            const shouldUseLocalNutritionReply = isMealOrFoodQuestion(normalizedMessage);
            const result = shouldUseLocalNutritionReply
              ? buildNutritionReply(message, row || {}, mealRows || [])
              : await generateGeneralChatReply(message, row || {}, mealRows || []);

            res.json({
              success: true,
              reply: result.reply,
              intent: result.intent,
              suggestedMeals: Array.isArray(result.suggestedMeals) ? result.suggestedMeals : [],
            });
          } catch (chatErr) {
            console.error("CHATBOT ERROR:", chatErr);
            res.status(500).json({
              error: "Unable to generate a chatbot response right now.",
            });
          }
        }
      );
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
    `SELECT id, mealName, mealType, calories, protein, dietTag, imageUrl, createdAt
     FROM meals
     ORDER BY id DESC`,
    (err, rows) => {
      if (err && /no such column:\s*createdAt/i.test(err.message || "")) {
        db.all(
          `SELECT id, mealName, mealType, calories, protein, dietTag, imageUrl
           FROM meals
           ORDER BY id DESC`,
          (fallbackErr, fallbackRows) => {
            if (fallbackErr) return res.status(500).json({ error: fallbackErr.message });
            res.json(
              (fallbackRows || []).map((meal) => ({
                ...meal,
                createdAt: null,
              }))
            );
          }
        );
        return;
      }
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
      res.json({ success: true, mealId: this.lastID, createdAt: new Date().toISOString() });
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




