
import { Gender, ActivityLevel, FitnessGoal } from '../types';

/**
 * Calculates daily calorie needs using the Mifflin-St Jeor Equation.
 */
export const calculateDailyCalories = (
  age: number,
  gender: Gender,
  weight: number,
  height: number,
  activityMultiplier: ActivityLevel,
  goal: FitnessGoal = FitnessGoal.MAINTAIN
): number => {
  // BMR Calculation
  let bmr = 0;
  if (gender === Gender.MALE) {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === Gender.FEMALE) {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  }

  // TDEE (Total Daily Energy Expenditure)
  const multiplier = parseFloat(activityMultiplier);
  const tdee = bmr * multiplier;

  // Adjust for Goal
  let target = tdee;
  if (goal === FitnessGoal.LOSS) {
    target = tdee - 500; 
  } else if (goal === FitnessGoal.GAIN || goal === FitnessGoal.MUSCLE_GAIN) {
    target = tdee + 400; 
  }

  return Math.round(target);
};

/**
 * Calculates recommended daily protein in grams.
 */
export const calculateDailyProtein = (weight: number, goal: FitnessGoal): number => {
  let multiplier = 1.2; // Default (g/kg)

  if (goal === FitnessGoal.LOSS) {
    multiplier = 2.0; // Higher protein during deficit
  } else if (goal === FitnessGoal.MUSCLE_GAIN || goal === FitnessGoal.GAIN) {
    multiplier = 1.8; 
  }

  return Math.round(weight * multiplier);
};

/**
 * Calculates daily water intake in liters.
 * 35ml per kg of body weight.
 */
export const calculateDailyWater = (weight: number): number => {
  const liters = weight * 0.035;
  return Math.round(liters * 10) / 10; // Round to 1 decimal place
};

export const getCalorieDistribution = (total: number) => {
  return {
    breakfast: Math.round(total * 0.3),
    lunch: Math.round(total * 0.4),
    dinner: Math.round(total * 0.3),
  };
}
