
import React, { useContext, useState } from 'react';
import { AuthContext } from '../App';

const ProgressPage: React.FC = () => {
  const { user, plans, logWeight } = useContext(AuthContext);
  const [weightInput, setWeightInput] = useState(user?.weight?.toString() || '');
  const [isLogging, setIsLogging] = useState(false);

  const getWeeklyDates = () => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
  };

  const weeklyDates = getWeeklyDates();

  const userKey = user?.id || 'public';
  const userPlans = plans[userKey] || {};

  const weeklyData = weeklyDates.map(date => {
    const plan = userPlans[date];
    const cals = plan 
      ? (plan.breakfast?.calories || 0) + (plan.lunch?.calories || 0) + (plan.dinner?.calories || 0) 
      : 0;
    
    const protein = plan
      ? (plan.breakfast?.protein || 0) + (plan.lunch?.protein || 0) + (plan.dinner?.protein || 0)
      : 0;

    const dateObj = new Date(date + 'T12:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    
    return { date, dayName, cals, protein };
  });

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightInput || isNaN(parseFloat(weightInput))) return;
    setIsLogging(true);
    await logWeight(parseFloat(weightInput));
    setTimeout(() => setIsLogging(false), 500);
  };

  const maxCals = Math.max(...weeklyData.map(d => d.cals), user?.dailyCalories || 2000);

  return (
    <div className="space-y-10 animate-fadeIn flex flex-col items-center">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Progress Tracking</h1>
        <p className="text-slate-500 mt-1">Visualize your health journey over time.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8 w-full">
        {/* Weight Logger */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-emerald-50 flex flex-col items-center">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 mx-auto">
              <i className="fa-solid fa-weight-scale text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Weight</h2>
          </div>
          
          <form onSubmit={handleLogWeight} className="w-full">
            <div className="flex flex-col gap-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Current Weight (kg)</label>
              <input 
                type="number" 
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-bold text-slate-700"
                placeholder="70.5"
              />
              <button 
                type="submit"
                disabled={isLogging}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-900/10"
              >
                {isLogging ? <i className="fa-solid fa-circle-notch animate-spin"></i> : "Enter"}
              </button>
            </div>
          </form>

          <div className="mt-8 space-y-4 w-full">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider text-center">Recent History</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide text-center">
              {user?.weightHistory?.length ? user.weightHistory.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">{new Date(entry.date + 'T12:00:00').toLocaleDateString()}</span>
                  <span className="font-bold text-slate-900">{entry.weight} kg</span>
                </div>
              )) : (
                <p className="text-sm text-slate-400 italic text-center">No weight records yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Weekly Calorie Report */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-emerald-50">
          <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-chart-simple text-blue-600"></i>
              Weekly Calorie Intake
            </div>
            <span className="text-xs font-normal text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Past 7 days</span>
          </h2>

          <div className="flex items-end justify-between h-64 gap-2 md:gap-4 px-4">
            {weeklyData.map((day, idx) => {
              const height = (day.cals / maxCals) * 100;
              const isOver = day.cals > (user?.dailyCalories || 2000);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-3 h-full">
                  <div className="flex-1 w-full flex flex-col justify-end">
                    <div 
                      className={`w-full rounded-t-xl transition-all duration-1000 relative group ${isOver ? 'bg-orange-400' : 'bg-emerald-500'}`}
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                        {day.cals} kcal
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase">{day.dayName}</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-bullseye"></i>
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Daily Goal</p>
                <p className="text-lg font-black text-emerald-900">{user?.dailyCalories} kcal</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-blue-50 rounded-[2rem] border border-blue-100">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-dumbbell"></i>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Avg Protein</p>
                <p className="text-lg font-black text-blue-900">{(weeklyData.reduce((acc, d) => acc + d.protein, 0) / 7).toFixed(0)} g</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Daily History Table - Centered Table */}
      <div className="bg-white rounded-[2.5rem] border border-emerald-50 overflow-hidden w-full">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h2 className="text-xl font-bold text-slate-900">Detailed Daily History</h2>
          <span className="text-xs font-bold text-emerald-600 bg-white px-4 py-1.5 rounded-full border border-emerald-100">Last 7 entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Calories</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Protein</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {weeklyData.slice().reverse().map((day, idx) => {
                const target = user?.dailyCalories || 2000;
                const diff = day.cals - target;
                const dateObj = new Date(day.date + 'T12:00:00');
                return (
                  <tr key={idx} className="hover:bg-emerald-50/10 transition-colors">
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-700">{dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-bold text-slate-900">{day.cals}</span>
                      <span className="text-xs text-slate-400 ml-1">kcal</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-bold text-slate-900">{day.protein}</span>
                      <span className="text-xs text-slate-400 ml-1">g</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {day.cals === 0 ? (
                        <span className="text-[10px] font-bold text-slate-300 uppercase">No Data</span>
                      ) : Math.abs(diff) < 100 ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-lg border border-emerald-200">Perfect</span>
                      ) : diff > 0 ? (
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase rounded-lg border border-orange-200">Over by {diff}</span>
                      ) : (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-lg border border-blue-200">Under by {Math.abs(diff)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProgressPage;
