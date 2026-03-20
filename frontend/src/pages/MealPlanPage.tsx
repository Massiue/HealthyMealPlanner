
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { DailyPlan, MealType } from '../types';
import { DEFAULT_MEAL_IMAGE } from '../constants';

interface MealPlanPageProps {
  currentPlan: DailyPlan;
  onRemoveMeal: (type: MealType) => void;
}

const MealPlanPage: React.FC<MealPlanPageProps> = ({ currentPlan, onRemoveMeal }) => {
  const { user, selectedDate } = useContext(AuthContext);

  const totalCalories = (currentPlan.breakfast?.calories || 0) + 
                       (currentPlan.lunch?.calories || 0) + 
                       (currentPlan.dinner?.calories || 0);

  const totalProtein = (currentPlan.breakfast?.protein || 0) + 
                       (currentPlan.lunch?.protein || 0) + 
                       (currentPlan.dinner?.protein || 0);

  const mealSlots = [
    { type: MealType.BREAKFAST, meal: currentPlan.breakfast },
    { type: MealType.LUNCH, meal: currentPlan.lunch },
    { type: MealType.DINNER, meal: currentPlan.dinner },
  ];

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = DEFAULT_MEAL_IMAGE;
  };

  const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-8 animate-fadeIn flex flex-col items-center">
      <header className="w-full flex flex-col items-center text-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Daily Plan</h1>
          <p className="text-emerald-600 font-bold mt-1 uppercase tracking-wider text-sm">{formattedDate}</p>
        </div>
        <div className="bg-emerald-600 text-white px-8 py-4 rounded-3xl flex items-center gap-8 shadow-lg shadow-emerald-200">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Calories</p>
            <p className="text-2xl font-black">{totalCalories} <span className="text-sm font-normal">kcal</span></p>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Protein</p>
            <p className="text-2xl font-black">{totalProtein}<span className="text-sm font-normal">g</span></p>
          </div>
        </div>
      </header>

      <div className="space-y-6 w-full max-w-3xl">
        {mealSlots.map((slot) => (
          <div key={slot.type} className="bg-white rounded-[2rem] p-6 border border-emerald-50 relative group overflow-hidden transition-all hover:border-emerald-200 shadow-sm">
            <div className={`absolute top-0 left-0 bottom-0 w-2 ${slot.meal ? 'bg-emerald-500' : 'bg-slate-100'}`}></div>
            
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex flex-col items-center justify-center text-emerald-700 shrink-0 border border-emerald-100 mx-auto md:mx-0">
                <i className={`fa-solid ${
                  slot.type === MealType.BREAKFAST ? 'fa-mug-saucer' : 
                  slot.type === MealType.LUNCH ? 'fa-bowl-food' : 'fa-utensils'
                } text-xl mb-1`}></i>
                <span className="text-[10px] font-black uppercase tracking-tighter">{slot.type}</span>
              </div>

              {slot.meal ? (
                <>
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 mx-auto md:mx-0 shadow-inner">
                    <img 
                      src={slot.meal.imageUrl} 
                      alt={slot.meal.mealName} 
                      onError={handleImageError}
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900">{slot.meal.mealName}</h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-md tracking-wider border border-emerald-200">
                        {slot.meal.dietTag}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                      <span className="flex items-center gap-1.5 text-slate-600 text-sm font-bold bg-slate-50 px-2 py-1 rounded-lg">
                        <i className="fa-solid fa-fire-flame-curved text-orange-500"></i>
                        {slot.meal.calories} kcal
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600 text-sm font-bold bg-slate-50 px-2 py-1 rounded-lg">
                        <i className="fa-solid fa-dumbbell text-blue-500"></i>
                        {slot.meal.protein}g Protein
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onRemoveMeal(slot.type)}
                    className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all mx-auto md:mx-0"
                    title="Remove Meal"
                  >
                    <i className="fa-solid fa-trash-can text-lg"></i>
                  </button>
                </>
              ) : (
                <div className="flex-1 py-4 text-center md:text-left">
                  <p className="text-slate-400 font-medium italic">No meal added for {slot.type.toLowerCase()}.</p>
                  <Link to="/recommendations" className="text-emerald-600 font-bold text-sm mt-1 inline-block hover:underline">
                    Browse suggestions
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-900 text-emerald-50 p-8 rounded-[2.5rem] relative overflow-hidden w-full max-w-3xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <i className="fa-solid fa-seedling text-9xl"></i>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
          <div className="w-12 h-12 bg-emerald-800 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-700">
            <i className="fa-solid fa-lightbulb text-xl"></i>
          </div>
          <div>
            <h4 className="font-bold text-xl text-white mb-2">Pro Nutrition Tip</h4>
            <p className="text-emerald-200/80 text-sm leading-relaxed">
              Consistency is better than perfection. If you go over your calorie target for one meal, don't worry! 
              Just focus on making your next choice a healthy one.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealPlanPage;