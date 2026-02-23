
import React, { useState, useEffect, createContext, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContextType, User, DailyPlan, Meal, MealType, FitnessGoal, ActivityLevel, Gender, WeightEntry } from './types';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import MealRecommendations from './pages/MealRecommendations';
import MealPlanPage from './pages/MealPlanPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import ProgressPage from './pages/ProgressPage';
import { MOCK_MEALS } from './constants';

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const API_BASE = '/api';
const MEAL_TYPES = new Set(Object.values(MealType));

const normalizeMealType = (value: any): MealType =>
  MEAL_TYPES.has(value) ? (value as MealType) : MealType.LUNCH;

const normalizeMeal = (raw: any): Meal => ({
  id: String(raw?.id ?? ''),
  mealName: String(raw?.mealName ?? ''),
  mealType: normalizeMealType(raw?.mealType),
  calories: Number(raw?.calories ?? 0),
  protein: Number(raw?.protein ?? 0),
  imageUrl: String(raw?.imageUrl ?? ''),
  dietTag: String(raw?.dietTag ?? 'Vegetarian'),
});

type MockMealMeta = {
  mockId: string;
  deleted: number;
  convertedMealId?: number | null;
};

const applyMockMealMeta = (mockMeals: Meal[], metaRows: MockMealMeta[]): Meal[] => {
  const excludedMockIds = new Set(
    (metaRows || [])
      .filter((row) => Number(row?.deleted) === 1 || row?.convertedMealId)
      .map((row) => String(row.mockId))
  );

  return mockMeals.filter((meal) => !excludedMockIds.has(meal.id));
};

const normalizeUser = (raw: any): User => ({
  id: String(raw?.id ?? ''),
  name: String(raw?.name ?? 'User'),
  email: String(raw?.email ?? ''),
  role: raw?.role === 'admin' ? 'admin' : 'user',
  age: raw?.age ?? undefined,
  gender: raw?.gender ?? undefined,
  height: raw?.height ?? undefined,
  weight: raw?.weight ?? undefined,
  activityLevel: raw?.activityLevel ?? undefined,
  goal: raw?.goal ?? undefined,
  dailyCalories: raw?.dailyCalories ?? undefined,
  dailyProtein: raw?.dailyProtein ?? undefined,
  dailyWater: raw?.dailyWater ?? undefined,
  weightHistory: Array.isArray(raw?.weightHistory) ? raw.weightHistory : [],
});

const authHeaders = (authToken?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('nutriplan_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<Record<string, Record<string, DailyPlan>>>({});
  const [meals, setMeals] = useState<Meal[]>(MOCK_MEALS);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const loadMealsFromApi = useCallback(async () => {
    try {
      const [mealsResponse, metaResponse] = await Promise.all([
        fetch(`${API_BASE}/meals`),
        fetch(`${API_BASE}/mock-meals/meta`),
      ]);

      const mealsPayload = mealsResponse.ok ? await mealsResponse.json() : [];
      const metaPayload = metaResponse.ok ? await metaResponse.json() : [];

      const dbMeals = Array.isArray(mealsPayload) ? mealsPayload.map(normalizeMeal) : [];
      const filteredMockMeals = applyMockMealMeta(
        MOCK_MEALS,
        Array.isArray(metaPayload) ? (metaPayload as MockMealMeta[]) : []
      );

      const merged = [...dbMeals, ...filteredMockMeals].reduce((acc, meal) => {
        if (!meal?.id || acc.some((m) => m.id === meal.id)) return acc;
        acc.push(meal);
        return acc;
      }, [] as Meal[]);

      setMeals(merged);
    } catch {
      setMeals(MOCK_MEALS);
    }
  }, []);

  const hydrateSession = useCallback(async (authToken: string) => {
    const [meResponse, plansResponse] = await Promise.all([
      fetch(`${API_BASE}/me`, { headers: authHeaders(authToken) }),
      fetch(`${API_BASE}/plans`, { headers: authHeaders(authToken) }),
    ]);

    if (!meResponse.ok) {
      throw new Error('Session expired. Please log in again.');
    }

    const currentUser = normalizeUser(await meResponse.json());
    const plansPayload = plansResponse.ok ? await plansResponse.json() : [];
    const userPlans: Record<string, DailyPlan> = {};

    if (Array.isArray(plansPayload)) {
      plansPayload.forEach((entry: any) => {
        if (!entry?.date) return;
        userPlans[entry.date] = {
          date: entry.date,
          waterIntake: Number(entry.waterIntake || 0),
          breakfast: entry.breakfast ? normalizeMeal(entry.breakfast) : undefined,
          lunch: entry.lunch ? normalizeMeal(entry.lunch) : undefined,
          dinner: entry.dinner ? normalizeMeal(entry.dinner) : undefined,
        };
      });
    }

    setUser(currentUser);
    setPlans((prev) => ({ ...prev, [currentUser.id]: userPlans }));
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await loadMealsFromApi();
        if (token) {
          await hydrateSession(token);
        }
      } catch {
        localStorage.removeItem('nutriplan_token');
        setToken(null);
        setUser(null);
        setPlans({});
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, [token, hydrateSession, loadMealsFromApi]);

  const login = async (email: string, pass: string) => {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password: pass }),
    });

    const payload = await response.json();
    if (!response.ok || !payload?.token) {
      throw new Error(payload?.error || 'Invalid email or password.');
    }

    const authToken = payload.token;
    localStorage.setItem('nutriplan_token', authToken);
    setToken(authToken);
    await Promise.all([hydrateSession(authToken), loadMealsFromApi()]);
  };

  const register = async (userData: Partial<User>, password: string) => {
    const response = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        password,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Registration failed.');
    }

    await login(userData.email || '', password);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPlans({});
    localStorage.removeItem('nutriplan_token');
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user || !token) return;
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update profile.');
    }
    setUser(normalizeUser(payload));
  };

  const logWeight = async (weight: number) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const newEntry: WeightEntry = { date: today, weight };
    const history = user.weightHistory || [];
    const existingIdx = history.findIndex(h => h.date === today);
    
    let newHistory;
    if (existingIdx > -1) {
      newHistory = [...history];
      newHistory[existingIdx] = newEntry;
    } else {
      newHistory = [newEntry, ...history];
    }
    
    await updateProfile({ weight, weightHistory: newHistory });
  };

  const savePlan = useCallback(async (date: string, plan: DailyPlan) => {
    if (!token || !user) return;
    await fetch(`${API_BASE}/plans/${encodeURIComponent(date)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({
        date,
        breakfast: plan.breakfast || null,
        lunch: plan.lunch || null,
        dinner: plan.dinner || null,
        waterIntake: Number(plan.waterIntake || 0),
      }),
    });
  }, [token, user]);

  const addMealToPlan = async (meal: Meal) => {
    if (!user) return;
    const date = selectedDate;
    const userKey = user.id;
    const userPlans = plans[userKey] || {};
    const plan = userPlans[date] || { date, waterIntake: 0 };
    const updatedPlan = { ...plan, [meal.mealType.toLowerCase()]: meal };
    setPlans(prev => ({ ...prev, [userKey]: { ...(prev[userKey] || {}), [date]: updatedPlan } }));
    await savePlan(date, updatedPlan);
  };

  const removeMealFromPlan = async (type: MealType) => {
    if (!user) return;
    const date = selectedDate;
    const userKey = user.id;
    const userPlans = plans[userKey] || {};
    const plan = { ...(userPlans[date] || {}) };
    (plan as DailyPlan).date = date;
    delete (plan as any)[type.toLowerCase()];
    setPlans(prev => ({ ...prev, [userKey]: { ...(prev[userKey] || {}), [date]: plan } }));
    await savePlan(date, plan as DailyPlan);
  };

  const updateWaterIntake = async (amount: number, date: string = selectedDate) => {
    if (!user) return;
    const userKey = user.id;
    const userPlans = plans[userKey] || {};
    const plan = userPlans[date] || { date, waterIntake: 0 };
    const updatedPlan = { ...plan, waterIntake: Math.max(0, amount) };
    setPlans(prev => ({ ...prev, [userKey]: { ...(prev[userKey] || {}), [date]: updatedPlan } }));
    await savePlan(date, updatedPlan);
  };

  const addGlobalMeal = (meal: Meal) => {
    setMeals(prev => {
      const exists = prev.some(m => m.id === meal.id);
      if (exists) {
        return prev.map(m => (m.id === meal.id ? meal : m));
      }
      return [meal, ...prev];
    });
  };

  const removeGlobalMeal = (mealId: string) => {
    setMeals(prev => prev.filter(m => m.id !== mealId));
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-emerald-50">
        <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, login, register, logout, updateProfile, logWeight, isLoading, 
      plans, selectedDate, setSelectedDate, updateWaterIntake,
      meals, addGlobalMeal, removeGlobalMeal
    }}>
      <Router>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
          <Route path="/dashboard" element={user ? <Layout onLogout={logout}><Dashboard /></Layout> : <Navigate to="/login" replace />} />
          <Route path="/recommendations" element={user ? <Layout onLogout={logout}><MealRecommendations onAddMeal={addMealToPlan} currentPlan={(plans[user?.id || 'public'] && plans[user?.id || 'public'][selectedDate]) || {date:selectedDate,waterIntake:0}} /></Layout> : <Navigate to="/login" replace />} />
          <Route path="/planner" element={user ? <Layout onLogout={logout}><MealPlanPage currentPlan={(plans[user?.id || 'public'] && plans[user?.id || 'public'][selectedDate]) || {date:selectedDate,waterIntake:0}} onRemoveMeal={removeMealFromPlan} /></Layout> : <Navigate to="/login" replace />} />
          <Route path="/progress" element={user ? <Layout onLogout={logout}><ProgressPage /></Layout> : <Navigate to="/login" replace />} />
          <Route path="/profile" element={user ? <Layout onLogout={logout}><ProfilePage /></Layout> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={user?.role === 'admin' ? <Layout onLogout={logout}><AdminDashboard /></Layout> : <Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
