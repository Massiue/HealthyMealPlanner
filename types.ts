
export enum MealType {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum ActivityLevel {
  SEDENTARY = '1.2',
  LIGHT = '1.375',
  MODERATE = '1.55',
  ACTIVE = '1.725',
  VERY_ACTIVE = '1.9'
}

export enum FitnessGoal {
  LOSS = 'Weight Loss',
  MAINTAIN = 'Maintain Weight',
  GAIN = 'Weight Gain',
  MUSCLE_GAIN = 'Muscle Gain'
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  age?: number;
  gender?: Gender;
  height?: number;
  weight?: number;
  activityLevel?: ActivityLevel;
  goal?: FitnessGoal;
  dailyCalories?: number;
  dailyProtein?: number;
  dailyWater?: number;
  weightHistory?: WeightEntry[];
}

export interface Meal {
  id: string;
  mealName: string;
  mealType: MealType;
  calories: number;
  protein: number;
  imageUrl: string;
  dietTag: string;
}

export interface DailyPlan {
  date: string;
  breakfast?: Meal;
  lunch?: Meal;
  dinner?: Meal;
  waterIntake?: number;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: Partial<User>, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  logWeight: (weight: number) => Promise<void>;
  isLoading: boolean;
  plans: Record<string, DailyPlan>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  updateWaterIntake: (amount: number, date?: string) => void;
  meals: Meal[];
  addGlobalMeal: (meal: Meal) => void;
  removeGlobalMeal: (mealId: string) => void;
}
