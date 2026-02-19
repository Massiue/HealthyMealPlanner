
import React, { useState, useEffect, createContext } from 'react';
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
import { calculateDailyCalories, calculateDailyProtein, calculateDailyWater } from './services/calorieCalculator';

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

interface StoredUser extends User {
  password?: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('nutriplan_token'));
  const [isLoading, setIsLoading] = useState(true);
  
  // Helper to get latest users from "DB"
  const getRegisteredUsers = (): StoredUser[] => {
    const saved = localStorage.getItem('nutriplan_registered_users');
    if (saved) return JSON.parse(saved);
    return [{
      id: 'admin-1',
      name: 'System Admin',
      email: 'madhang285@gmail.com',
      password: '123',
      role: 'admin',
      dailyCalories: 2500,
      dailyProtein: 150,
      dailyWater: 3.5,
      goal: FitnessGoal.MAINTAIN,
      activityLevel: ActivityLevel.MODERATE,
      gender: Gender.MALE,
      age: 30,
      weight: 80,
      height: 180,
      weightHistory: [{ date: new Date().toISOString().split('T')[0], weight: 80 }]
    }];
  };

  const [plans, setPlans] = useState<Record<string, Record<string, DailyPlan>>>(() => {
    const saved = localStorage.getItem('nutriplan_plans');
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      // If the stored shape is the old format (date -> DailyPlan), wrap it under a public key
      const firstKey = Object.keys(parsed)[0];
      if (firstKey && parsed[firstKey] && parsed[firstKey].date) {
        return { public: parsed } as Record<string, Record<string, DailyPlan>>;
      }
      return parsed as Record<string, Record<string, DailyPlan>>;
    } catch (e) {
      return {};
    }
  });

  const [meals, setMeals] = useState<Meal[]>(() => {
    const saved = localStorage.getItem('nutriplan_meals');
    return saved ? JSON.parse(saved) : MOCK_MEALS;
  });

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    localStorage.setItem('nutriplan_plans', JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem('nutriplan_meals', JSON.stringify(meals));
  }, [meals]);

  useEffect(() => {
    const initAuth = async () => {
      if (token === 'demo-token') {
        const savedUser = localStorage.getItem('nutriplan_user_data');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email: string, pass: string) => {
    const currentUsers = getRegisteredUsers();
    const foundUser = currentUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (foundUser && foundUser.password === pass) {
      const { password, ...userWithoutPassword } = foundUser;
      setToken('demo-token');
      setUser(userWithoutPassword);
      localStorage.setItem('nutriplan_token', 'demo-token');
      localStorage.setItem('nutriplan_user_data', JSON.stringify(userWithoutPassword));
      return;
    }
    
    throw new Error("Invalid email or password.");
  };

  const register = async (userData: Partial<User>, password: string) => {
    const currentUsers = getRegisteredUsers();
    const exists = currentUsers.some(u => u.email.toLowerCase() === userData.email?.toLowerCase());
    if (exists) {
      throw new Error("Email already registered.");
    }

    const newUser: StoredUser = {
      id: 'user-' + Date.now(),
      name: userData.name || 'New User',
      email: userData.email || '',
      password: password,
      role: 'user',
      age: 25,
      gender: Gender.MALE,
      weight: 70,
      height: 175,
      activityLevel: ActivityLevel.MODERATE,
      goal: FitnessGoal.MAINTAIN,
      dailyCalories: 2000,
      dailyProtein: 120,
      dailyWater: 2.5,
      weightHistory: []
    };

    const updatedUsers = [...currentUsers, newUser];
    localStorage.setItem('nutriplan_registered_users', JSON.stringify(updatedUsers));
    
    const { password: _, ...userContextData } = newUser;
    setToken('demo-token');
    setUser(userContextData);
    localStorage.setItem('nutriplan_token', 'demo-token');
    localStorage.setItem('nutriplan_user_data', JSON.stringify(userContextData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nutriplan_token');
    localStorage.removeItem('nutriplan_user_data');
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    const currentUsers = getRegisteredUsers();
    const updatedUsers = currentUsers.map(u => u.id === user.id ? { ...u, ...data } : u);
    localStorage.setItem('nutriplan_registered_users', JSON.stringify(updatedUsers));
    
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('nutriplan_user_data', JSON.stringify(updatedUser));
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

  const addMealToPlan = async (meal: Meal) => {
    const date = selectedDate;
    const userKey = user?.id || 'public';
    const userPlans = plans[userKey] || {};
    const plan = userPlans[date] || { date, waterIntake: 0 };
    const updatedPlan = { ...plan, [meal.mealType.toLowerCase()]: meal };
    setPlans(prev => ({ ...prev, [userKey]: { ...(prev[userKey] || {}), [date]: updatedPlan } }));
  };

  const removeMealFromPlan = async (type: MealType) => {
    const date = selectedDate;
    const userKey = user?.id || 'public';
    const userPlans = plans[userKey] || {};
    const plan = { ...(userPlans[date] || {}) };
    delete (plan as any)[type.toLowerCase()];
    setPlans(prev => ({ ...prev, [userKey]: { ...(prev[userKey] || {}), [date]: plan } }));
  };

  const updateWaterIntake = async (amount: number, date: string = selectedDate) => {
    const userKey = user?.id || 'public';
    const userPlans = plans[userKey] || {};
    const plan = userPlans[date] || { date, waterIntake: 0 };
    const updatedPlan = { ...plan, waterIntake: Math.max(0, amount) };
    setPlans(prev => ({ ...prev, [userKey]: { ...(prev[userKey] || {}), [date]: updatedPlan } }));
  };

  const addGlobalMeal = (meal: Meal) => {
    setMeals(prev => [meal, ...prev]);
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
