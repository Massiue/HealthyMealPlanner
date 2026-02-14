
import React, { useState, useContext } from 'react';
import { AuthContext } from '../App';
import { Meal, MealType, DailyPlan } from '../types';
import { DEFAULT_MEAL_IMAGE } from '../constants';

interface MealRecommendationsProps {
  onAddMeal: (meal: Meal) => void;
  currentPlan: DailyPlan;
}

type DietFilter = 'All' | 'Veg' | 'Non-Veg' | 'High Protein';

const MealRecommendations: React.FC<MealRecommendationsProps> = ({ onAddMeal, currentPlan }) => {
  const { meals } = useContext(AuthContext);
  const [activeFilter, setActiveFilter] = useState<MealType | 'All'>('All');
  const [dietFilter, setDietFilter] = useState<DietFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = DEFAULT_MEAL_IMAGE;
  };

  // Filter and ensure new global meals (usually admin added) are easily discoverable
  const filteredMeals = meals.filter(meal => {
    const matchesType = activeFilter === 'All' || meal.mealType === activeFilter;
    const matchesSearch = meal.mealName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Exact Diet Tag Logic Matching Admin Options
    const isVeg = meal.dietTag === 'Vegetarian' || meal.dietTag === 'Vegan';
    let matchesDiet = true;
    if (dietFilter === 'Veg') matchesDiet = isVeg;
    else if (dietFilter === 'Non-Veg') matchesDiet = !isVeg;
    else if (dietFilter === 'High Protein') matchesDiet = meal.dietTag === 'High Protein';

    return matchesType && matchesSearch && matchesDiet;
  });

  const isMealInPlan = (meal: Meal) => {
    const key = meal.mealType.toLowerCase() as keyof DailyPlan;
    const plannedMeal = currentPlan[key];
    return plannedMeal && (plannedMeal as Meal).id === meal.id;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDietFilter('All');
    setActiveFilter('All');
  };

  return (
    <div className="space-y-10 animate-fadeIn flex flex-col items-center">
      <header className="w-full flex flex-col items-center text-center gap-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Recommended for You</h1>
          <p className="text-slate-500 mt-1">Discover fresh healthy choices added by our nutrition experts.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full max-w-3xl">
          <div className="relative group flex-1 w-full">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600"></i>
            <input 
              type="text" 
              placeholder="Search by meal name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-emerald-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium shadow-sm"
            />
          </div>

          <div className="relative shrink-0 w-full md:w-56">
            <i className="fa-solid fa-filter absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            <select
              value={dietFilter}
              onChange={(e) => setDietFilter(e.target.value as DietFilter)}
              className="w-full pl-11 pr-10 py-3 bg-white border border-emerald-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer shadow-sm"
            >
              <option value="All">All Diets</option>
              <option value="Veg">Vegetarian Only</option>
              <option value="Non-Veg">Non-Vegetarian</option>
              <option value="High Protein">High Protein Focus</option>
            </select>
            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-xs"></i>
          </div>
        </div>
      </header>

      <div className="flex justify-center gap-2 overflow-x-auto pb-2 w-full">
        {['All', MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER].map(type => (
          <button
            key={type}
            onClick={() => setActiveFilter(type as any)}
            className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all shadow-sm ${
              activeFilter === type 
                ? 'bg-emerald-600 text-white' 
                : 'bg-white text-emerald-800 border border-emerald-100 hover:bg-emerald-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
        {filteredMeals.map((meal) => {
          const added = isMealInPlan(meal);
          const isCustom = !meal.id.startsWith('b') && !meal.id.startsWith('l') && !meal.id.startsWith('d');
          
          return (
            <div key={meal.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-emerald-50 group transition-all duration-300 flex flex-col shadow-sm hover:shadow-md relative">
              {isCustom && (
                <div className="absolute top-4 left-4 z-10 bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md shadow-sm">
                  New Addition
                </div>
              )}
              
              <div className="relative h-52 overflow-hidden bg-slate-100">
                <img 
                  src={meal.imageUrl || DEFAULT_MEAL_IMAGE} 
                  alt={meal.mealName} 
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
                <div className="absolute top-4 right-4 bg-emerald-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                  {meal.mealType}
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col items-center text-center">
                <div className="mb-4 w-full">
                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border border-emerald-100">
                    {meal.dietTag}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight mt-3 line-clamp-2 min-h-[3rem]">{meal.mealName}</h3>
                </div>

                <div className="flex items-center gap-4 text-slate-500 mb-6 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-fire-flame-curved text-orange-500 text-xs"></i>
                    <span className="text-sm font-bold text-slate-700">{meal.calories} kcal</span>
                  </div>
                  <div className="w-px h-3 bg-slate-200"></div>
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-dumbbell text-blue-500 text-xs"></i>
                    <span className="text-sm font-bold text-slate-700">{meal.protein}g protein</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => onAddMeal(meal)}
                  disabled={added}
                  className={`mt-auto w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all ${
                    added 
                      ? 'bg-emerald-600 text-white cursor-default' 
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-100'
                  }`}
                >
                  <i className={`fa-solid ${added ? 'fa-check' : 'fa-plus'}`}></i>
                  {added ? 'In Your Plan' : 'Add to Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMeals.length === 0 && (
        <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-emerald-100 w-full max-w-xl">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-4">
             <i className="fa-solid fa-utensils text-2xl"></i>
          </div>
          <p className="text-slate-600 font-bold text-lg">No matches found</p>
          <p className="text-slate-400 font-medium text-sm mt-1">Try broadening your filters to see more expert-added meals.</p>
          <button 
            onClick={clearFilters}
            className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-md"
          >
            Show All Meals
          </button>
        </div>
      )}
    </div>
  );
};

export default MealRecommendations;
