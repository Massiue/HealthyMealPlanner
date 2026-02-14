import React, { useState, useContext, useEffect } from 'react';
import { User, Meal, MealType, FitnessGoal } from '../types';
import { AuthContext } from '../App';
import { DEFAULT_MEAL_IMAGE } from '../constants';

const AdminDashboard: React.FC = () => {
  const { user: currentUser, meals, addGlobalMeal, removeGlobalMeal } = useContext(AuthContext);
  
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'meals'>('stats');
  const [notification, setNotification] = useState<string | null>(null);

  const [newMeal, setNewMeal] = useState<Partial<Meal>>({
    mealName: '',
    mealType: MealType.LUNCH,
    calories: 0,
    protein: 0,
    dietTag: 'Vegetarian',
    imageUrl: ''
  });

  const fetchUsers = () => {
    const savedUsers = localStorage.getItem('nutriplan_registered_users');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const stats = {
    userCount: users.length,
    mealCount: meals.length
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const syncUsersToStorage = (updatedUsers: any[]) => {
    localStorage.setItem('nutriplan_registered_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
  };

  const removeUser = (userId: string) => {
    if (userId === currentUser?.id) {
      alert("Security Protocol: You cannot remove your own administrator account.");
      return;
    }
    const updated = users.filter(u => u.id !== userId);
    syncUsersToStorage(updated);
    showNotification(`User account removed.`);
  };

  const handleRoleChange = (userId: string, newRole: 'user' | 'admin') => {
    if (userId === currentUser?.id) {
        alert("Security Protocol: You cannot change your own access level.");
        return;
    }
    const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    syncUsersToStorage(updated);
    showNotification(`Access level updated to ${newRole.toUpperCase()}`);
  };

  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeal.mealName) return;

    const mealToAdd: Meal = {
      id: `m-${Date.now()}`,
      mealName: newMeal.mealName || 'Untitled Meal',
      mealType: newMeal.mealType || MealType.LUNCH,
      calories: Number(newMeal.calories) || 0,
      protein: Number(newMeal.protein) || 0,
      dietTag: newMeal.dietTag || 'Vegetarian',
      imageUrl: newMeal.imageUrl || DEFAULT_MEAL_IMAGE
    };

    addGlobalMeal(mealToAdd);
    showNotification(`"${mealToAdd.mealName}" published to library.`);
    setNewMeal({ mealName: '', mealType: MealType.LUNCH, calories: 0, protein: 0, dietTag: 'Vegetarian', imageUrl: '' });
  };

  const getGoalBadge = (goal?: FitnessGoal) => {
    if (!goal) return <span className="text-slate-300 italic text-[10px]">No Goal Set</span>;
    let style = "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (goal === FitnessGoal.LOSS) style = "bg-blue-50 text-blue-600 border-blue-100";
    if (goal === FitnessGoal.GAIN || goal === FitnessGoal.MUSCLE_GAIN) style = "bg-orange-50 text-orange-600 border-orange-100";
    
    return (
      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${style}`}>
        {goal}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-20 relative">
      {notification && (
        <div className="fixed top-24 right-8 z-[100] animate-fadeIn">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl border border-emerald-500/30">
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-[10px]"></i>
            </div>
            <span className="font-bold text-sm">{notification}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2rem] border border-emerald-50 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <i className="fa-solid fa-user-shield text-emerald-600"></i>
          Admin Control Center
        </h1>
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          {['stats', 'users', 'meals'].map(t => (
            <button 
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === t ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
          <div className="bg-white p-10 rounded-[3rem] border border-emerald-50 shadow-sm flex flex-col items-center text-center group hover:border-emerald-200 transition-all">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
              <i className="fa-solid fa-users text-3xl"></i>
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Registered Users</p>
            <div className="text-6xl font-black text-slate-900 mb-2">{stats.userCount}</div>
            <p className="text-sm text-slate-500 font-medium">Total persistent accounts</p>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-blue-50 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-all">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
              <i className="fa-solid fa-utensils text-3xl"></i>
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Recipe Library</p>
            <div className="text-6xl font-black text-slate-900 mb-2">{stats.mealCount}</div>
            <p className="text-sm text-slate-500 font-medium">Expert-curated meals</p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border border-emerald-50 overflow-hidden shadow-sm animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">User Profile</th>
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Health Metrics</th>
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Access Level</th>
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-emerald-50/10 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold border border-emerald-100 uppercase">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1">
                        {getGoalBadge(u.goal)}
                        {u.dailyCalories ? (
                          <span className="text-[10px] font-bold text-slate-500 px-1">
                            Target: <span className="text-emerald-600">{u.dailyCalories} kcal</span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="relative inline-block">
                        <select 
                          value={u.role}
                          disabled={u.id === currentUser?.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'user' | 'admin')}
                          className={`bg-white border border-slate-200 text-[11px] font-black uppercase tracking-wider rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer appearance-none pr-10 ${u.role === 'admin' ? 'text-purple-600' : 'text-slate-500'}`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 pointer-events-none"></i>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => removeUser(u.id)} 
                        className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-20"
                        disabled={u.id === currentUser?.id}
                      >
                        <i className="fa-solid fa-trash-can text-sm"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'meals' && (
        <div className="grid lg:grid-cols-3 gap-8 animate-fadeIn">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] border border-emerald-50 sticky top-24 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Create Global Meal</h2>
              <form onSubmit={handleAddMeal} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Meal Title</label>
                  <input 
                    type="text" 
                    value={newMeal.mealName}
                    onChange={(e) => setNewMeal({...newMeal, mealName: e.target.value})}
                    placeholder="e.g. Avocado Salmon Toast"
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kcal</label>
                    <input 
                      type="number" 
                      value={newMeal.calories}
                      onChange={(e) => setNewMeal({...newMeal, calories: parseInt(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Protein (g)</label>
                    <input 
                      type="number" 
                      value={newMeal.protein}
                      onChange={(e) => setNewMeal({...newMeal, protein: parseInt(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Diet Classification</label>
                  <select 
                    value={newMeal.dietTag}
                    onChange={(e) => setNewMeal({...newMeal, dietTag: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  >
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Non-Veg">Non-Vegetarian</option>
                    <option value="High Protein">High Protein</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Time of Day</label>
                  <select 
                    value={newMeal.mealType}
                    onChange={(e) => setNewMeal({...newMeal, mealType: e.target.value as MealType})}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  >
                    <option value={MealType.BREAKFAST}>Breakfast</option>
                    <option value={MealType.LUNCH}>Lunch</option>
                    <option value={MealType.DINNER}>Dinner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Photo URL</label>
                  <input 
                    type="text" 
                    value={newMeal.imageUrl}
                    onChange={(e) => setNewMeal({...newMeal, imageUrl: e.target.value})}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
                >
                  Publish to User Library
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] border border-emerald-50 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Library Item</th>
                    <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nutrients</th>
                    <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {meals.map(m => (
                    <tr key={m.id} className="hover:bg-emerald-50/10 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <img src={m.imageUrl || DEFAULT_MEAL_IMAGE} className="w-12 h-12 rounded-xl object-cover" alt="" />
                          <div>
                            <div className="font-bold text-slate-900">{m.mealName}</div>
                            <div className="text-[10px] text-emerald-600 font-bold uppercase">{m.dietTag} • {m.mealType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="text-sm font-bold text-slate-700">{m.calories} kcal / {m.protein}g P</div>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => removeGlobalMeal(m.id)} 
                          className="text-red-400 hover:text-red-600 transition-all p-2"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;