
import React, { useContext, useState } from 'react';
import { AuthContext } from '../App';
import { MealType, FitnessGoal } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_MEAL_IMAGE } from '../constants';

const Dashboard: React.FC = () => {
  const { user, plans, selectedDate, setSelectedDate } = useContext(AuthContext);
  const navigate = useNavigate();

  // Calculate current Monday for initial state
  const getInitialMonday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const [viewWeekStart, setViewWeekStart] = useState<Date>(getInitialMonday());

  const currentPlan = plans[selectedDate];

  const totalCalories = currentPlan 
    ? (currentPlan.breakfast?.calories || 0) + 
      (currentPlan.lunch?.calories || 0) + 
      (currentPlan.dinner?.calories || 0)
    : 0;

  const totalProtein = currentPlan
    ? (currentPlan.breakfast?.protein || 0) +
      (currentPlan.lunch?.protein || 0) +
      (currentPlan.dinner?.protein || 0)
    : 0;
  
  const dailyTarget = user?.dailyCalories || 2000;
  const proteinTarget = user?.dailyProtein || 120;
  
  const calorieProgress = Math.min((totalCalories / dailyTarget) * 100, 100);
  const proteinProgress = Math.min((totalProtein / proteinTarget) * 100, 100);

  const getWeeklyDates = (baseDate: Date) => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  };

  const shiftWeek = (days: number) => {
    const newDate = new Date(viewWeekStart);
    newDate.setDate(viewWeekStart.getDate() + days);
    setViewWeekStart(newDate);
  };

  const weeklyDates = getWeeklyDates(viewWeekStart);
  const todayISO = new Date().toISOString().split('T')[0];
  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];

  const getGoalColor = (goal?: FitnessGoal) => {
    switch (goal) {
      case FitnessGoal.LOSS: return 'bg-blue-50 text-blue-600 border-blue-100';
      case FitnessGoal.GAIN: return 'bg-orange-50 text-orange-600 border-orange-100';
      default: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    }
  };

  const formatSelectedDate = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const weekEndStr = new Date(viewWeekStart);
  weekEndStr.setDate(viewWeekStart.getDate() + 6);

  return (
    <div className="space-y-8 animate-fadeIn text-slate-800">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Health Overview, {user?.name.split(' ')[0]}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500">Planning for <span className="font-bold text-emerald-600">{formatSelectedDate()}</span></p>
            {user?.goal && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getGoalColor(user.goal)}`}>
                {user.goal}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-emerald-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-slate-900">Nutritional Intake</h2>
              <Link to="/profile" className="text-emerald-600 font-bold text-sm hover:underline">Update Profile</Link>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12">
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className="fill-none stroke-emerald-50 stroke-[8]" />
                    <circle 
                      cx="50" cy="50" r="45" 
                      className="fill-none stroke-emerald-500 stroke-[8] transition-all duration-1000 ease-out"
                      strokeDasharray={`${calorieProgress * 2.827} 282.7`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-slate-900 leading-none">{totalCalories}</span>
                    <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mt-1">kcal</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Calories Target</p>
                  <p className="text-2xl font-black text-emerald-700">{dailyTarget} <span className="text-xs font-normal text-emerald-600/60">kcal</span></p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className="fill-none stroke-blue-50 stroke-[8]" />
                    <circle 
                      cx="50" cy="50" r="45" 
                      className="fill-none stroke-blue-500 stroke-[8] transition-all duration-1000 ease-out"
                      strokeDasharray={`${proteinProgress * 2.827} 282.7`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-slate-900 leading-none">{totalProtein}</span>
                    <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mt-1">grams</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Protein Target</p>
                  <p className="text-2xl font-black text-blue-700">{proteinTarget} <span className="text-xs font-normal text-blue-600/60">grams</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-blue-50 relative overflow-hidden flex flex-col justify-center text-center">
           <div className="absolute bottom-0 left-0 right-0 bg-blue-500/5 h-full"></div>
           <div className="relative z-10">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Hydration</h2>
            <div className="py-4">
              <div className="flex flex-col items-center">
                <p className="text-4xl font-black text-slate-900">{user?.dailyWater || 3} <span className="text-lg font-normal text-slate-400">Liters</span></p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Recommended Daily Target</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-[2.5rem] p-8 border border-emerald-50 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Weekly Planner</h2>
                <p className="text-xs text-slate-400 font-medium">{viewWeekStart.toLocaleDateString()} - {weekEndStr.toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => shiftWeek(-7)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                >
                    <i className="fa-solid fa-chevron-left"></i>
                </button>
                <button 
                    onClick={() => setViewWeekStart(getInitialMonday())}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all"
                >
                    Current Week
                </button>
                <button 
                    onClick={() => shiftWeek(7)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                >
                    <i className="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        </div>

        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
          {weeklyDates.map((dateStr) => {
            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const isToday = dateStr === todayISO;
            const isSelected = dateStr === selectedDate;
            const dayPlan = plans[dateStr] || {};

            return (
              <div 
                key={dateStr} 
                className={`flex-1 min-w-[160px] rounded-3xl p-4 border transition-all cursor-pointer ${
                    isSelected 
                    ? 'bg-emerald-100/50 border-emerald-400 scale-105 z-10' 
                    : isToday 
                        ? 'bg-emerald-50/50 border-emerald-200' 
                        : 'bg-slate-50/30 border-emerald-50/50'
                }`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex flex-col">
                    <p className={`font-bold text-sm ${isSelected || isToday ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {dayLabel}
                    </p>
                    <p className="text-[10px] opacity-50 font-bold">{dateStr.split('-').slice(1).reverse().join('/')}</p>
                  </div>
                  {isToday && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
                </div>
                <div className="space-y-3">
                  {mealTypes.map((type) => {
                    const mealKey = type.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                    const meal = dayPlan[mealKey];
                    
                    return (
                      <div 
                        key={type}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(dateStr);
                            navigate(meal ? "/planner" : "/recommendations");
                        }}
                        className={`group block h-24 w-full rounded-2xl overflow-hidden relative transition-all duration-200 ${
                          meal 
                          ? 'border-0 ring-1 ring-black/5' 
                          : 'border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {meal ? (
                          <>
                            <img 
                              src={meal.imageUrl || DEFAULT_MEAL_IMAGE} 
                              alt={meal.mealName}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2">
                              <p className="text-[8px] text-white/70 font-black uppercase tracking-tighter leading-none mb-0.5">{type}</p>
                              <p className="text-white text-[10px] font-bold truncate leading-tight">{meal.mealName}</p>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <i className="fa-solid fa-circle-plus text-lg text-slate-200 group-hover:text-emerald-400"></i>
                            <span className="text-[8px] font-black uppercase text-slate-300 group-hover:text-emerald-500">{type}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
