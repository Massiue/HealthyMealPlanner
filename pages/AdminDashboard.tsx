import React, { useState, useContext, useEffect } from 'react';
import { User, Meal, MealType, FitnessGoal } from '../types';
import { AuthContext } from '../App';
import { DEFAULT_MEAL_IMAGE } from '../constants';

const API_BASE = '/api';
const EMPTY_MEAL: Partial<Meal> = {
  mealName: '',
  mealType: MealType.LUNCH,
  calories: 0,
  protein: 0,
  dietTag: 'Vegetarian',
  imageUrl: ''
};

const isDbMealId = (id: string) => /^\d+$/.test(String(id));

type MockMealMetaRow = {
  mockId: string;
  deleted: number;
  convertedMealId?: number | null;
};
const AdminDashboard: React.FC = () => {
  const getToken = () => localStorage.getItem('nutriplan_token') || '';
  const { user: currentUser, meals, addGlobalMeal, removeGlobalMeal } = useContext(AuthContext);

  const [deleteUserConfirmId, setDeleteUserConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editMealId, setEditMealId] = useState<string | null>(null);
  const [isEditingMeal, setIsEditingMeal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'meals'>('stats');
  const [notification, setNotification] = useState<string | null>(null);
  const [newMeal, setNewMeal] = useState<Partial<Meal>>(EMPTY_MEAL);
  const [convertedMealIds, setConvertedMealIds] = useState<string[]>([]);
  

  const stats = {
    userCount: users.length,
    mealCount: meals.length
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!response.ok) return;
      const rows = await response.json();
      const normalized: User[] = Array.isArray(rows)
        ? rows.map((row: any) => ({
            ...row,
            id: String(row.id),
            role: row.role === 'admin' ? 'admin' : 'user'
          }))
        : [];
      setUsers(normalized);
    } catch {
      // Keep current users list if request fails.
    }
  };

  const fetchMockMealMeta = async () => {
    try {
      const response = await fetch(`${API_BASE}/mock-meals/meta`);
      if (!response.ok) return;
      const rows: MockMealMetaRow[] = await response.json();
      const convertedIds = Array.isArray(rows)
        ? rows
            .filter((row) => row?.convertedMealId !== null && row?.convertedMealId !== undefined)
            .map((row) => String(row.convertedMealId))
        : [];
      setConvertedMealIds(convertedIds);
    } catch {
      // Keep current badge state if request fails.
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMockMealMeta();
  }, [activeTab]);

  const handleEditMeal = (meal: Meal) => {
    setEditMealId(meal.id);
    setNewMeal({ ...meal });
    setIsEditingMeal(true);
  };

  const handleCancelEdit = () => {
    setEditMealId(null);
    setNewMeal(EMPTY_MEAL);
    setIsEditingMeal(false);
  };

  const buildMealPayload = () => ({
    mealName: newMeal.mealName || 'Untitled Meal',
    mealType: newMeal.mealType || MealType.LUNCH,
    calories: Number(newMeal.calories) || 0,
    protein: Number(newMeal.protein) || 0,
    dietTag: newMeal.dietTag || 'Vegetarian',
    imageUrl: newMeal.imageUrl || DEFAULT_MEAL_IMAGE
  });

  const handleSaveMeal = async () => {
    if (!editMealId) return;
    const mealPayload = buildMealPayload();
    const dbMeal = isDbMealId(editMealId);

    if (!dbMeal) {
      try {
        const response = await fetch(`${API_BASE}/admin/meals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify(mealPayload)
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.mealId) {
          showNotification(data?.error || 'Failed to store meal in database.');
          return;
        }

        // Replace mock meal with a persisted DB meal so future edits use backend PUT.
        await fetch(`${API_BASE}/admin/mock-meals/convert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            mockId: editMealId,
            convertedMealId: Number(data.mealId)
          })
        });
        removeGlobalMeal(editMealId);
        const persistedMealId = String(data.mealId);
        setConvertedMealIds((prev) => (prev.includes(persistedMealId) ? prev : [persistedMealId, ...prev]));
        addGlobalMeal({ ...mealPayload, id: persistedMealId });
        showNotification('Meal updated and stored in database.');
        handleCancelEdit();
      } catch {
        showNotification('Error storing updated meal in database.');
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/meals/${editMealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(mealPayload)
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showNotification(data?.error || 'Failed to update meal.');
        return;
      }
      addGlobalMeal({ ...mealPayload, id: editMealId });
      showNotification('Meal updated successfully.');
      handleCancelEdit();
    } catch {
      showNotification('Error updating meal in database.');
    }
  };

  const removeUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      alert('Security Protocol: You cannot remove your own administrator account.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showNotification(data?.error || 'Failed to remove user.');
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      showNotification('User account removed.');
    } catch {
      showNotification('Error removing user.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    if (userId === currentUser?.id) {
      alert('Security Protocol: You cannot change your own access level.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/users/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ userId: Number(userId), role: newRole })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showNotification(data?.error || 'Failed to update role.');
        return;
      }
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      showNotification(`Access level updated to ${newRole.toUpperCase()}`);
    } catch {
      showNotification('Error updating role.');
    }
  };

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeal.mealName) return;
    const mealPayload = buildMealPayload();

    try {
      const response = await fetch(`${API_BASE}/admin/meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(mealPayload)
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.mealId) {
        showNotification(data?.error || 'Failed to store meal in database.');
        return;
      }
      addGlobalMeal({ ...mealPayload, id: String(data.mealId) });
      setNewMeal(EMPTY_MEAL);
      showNotification(`"${mealPayload.mealName}" published to library and stored in database.`);
    } catch {
      showNotification('Error storing meal in database.');
    }
  };

  const handleDeleteMeal = async (meal: Meal) => {
    if (!isDbMealId(meal.id)) {
      try {
        const response = await fetch(`${API_BASE}/admin/mock-meals/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({ mockId: meal.id })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          showNotification(data?.error || 'Failed to delete meal.');
          return;
        }
        removeGlobalMeal(meal.id);
        showNotification('Meal removed from database view.');
        setDeleteConfirmId(null);
      } catch {
        showNotification('Error deleting meal.');
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/meals/${meal.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showNotification(data?.error || 'Failed to delete meal.');
        return;
      }
      removeGlobalMeal(meal.id);
      setDeleteConfirmId(null);
      showNotification('Meal removed from database.');
    } catch {
      showNotification('Error deleting meal from database.');
    }
  };

  const getGoalBadge = (goal?: FitnessGoal) => {
    if (!goal) return <span className="text-slate-300 italic text-[10px]">No Goal Set</span>;
    let style = 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (goal === FitnessGoal.LOSS) style = 'bg-blue-50 text-blue-600 border-blue-100';
    if (goal === FitnessGoal.GAIN || goal === FitnessGoal.MUSCLE_GAIN) style = 'bg-orange-50 text-orange-600 border-orange-100';

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
            <p className="text-sm text-slate-500 font-medium">meals</p>
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
                        onClick={() => setDeleteUserConfirmId(u.id)}
                        className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-20"
                        disabled={u.id === currentUser?.id}
                      >
                        <i className="fa-solid fa-trash-can text-sm"></i>
                      </button>
                      {deleteUserConfirmId === u.id && (
                        <div className="absolute right-0 mt-2 bg-white border border-red-200 rounded-xl shadow-lg p-4 z-50">
                          <div className="mb-2 text-sm text-slate-700">Are you sure you want to delete <span className="font-bold">{u.name}</span>?</div>
                          <div className="flex gap-2">
                            <button className="bg-red-500 text-white px-3 py-1 rounded" onClick={() => { removeUser(u.id); setDeleteUserConfirmId(null); }}>Delete</button>
                            <button className="bg-slate-200 text-slate-700 px-3 py-1 rounded" onClick={() => setDeleteUserConfirmId(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
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
              <h2 className="text-xl font-bold text-slate-900 mb-6">{isEditingMeal ? 'Edit Database Meal' : 'Create Global Meal'}</h2>
              <form onSubmit={handleAddMeal} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Meal Title</label>
                  <input
                    type="text"
                    value={newMeal.mealName}
                    onChange={(e) => setNewMeal({ ...newMeal, mealName: e.target.value })}
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
                      onChange={(e) => setNewMeal({ ...newMeal, calories: parseInt(e.target.value, 10) })}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Protein (g)</label>
                    <input
                      type="number"
                      value={newMeal.protein}
                      onChange={(e) => setNewMeal({ ...newMeal, protein: parseInt(e.target.value, 10) })}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Diet Classification</label>
                  <select
                    value={newMeal.dietTag}
                    onChange={(e) => setNewMeal({ ...newMeal, dietTag: e.target.value })}
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
                    onChange={(e) => setNewMeal({ ...newMeal, mealType: e.target.value as MealType })}
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
                    onChange={(e) => setNewMeal({ ...newMeal, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
                {isEditingMeal ? (
                  <div className="flex gap-2 mt-4">
                    <button type="button" className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg" onClick={handleSaveMeal}>Save Changes</button>
                    <button type="button" className="w-full py-4 bg-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-300 transition-all shadow-lg" onClick={handleCancelEdit}>Cancel</button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
                  >
                    Publish to User Library
                  </button>
                )}
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
                    <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
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
                            {convertedMealIds.includes(String(m.id)) && (
                              <div className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
                                Converted from default meal
                              </div>
                            )}
                            <div className="text-[10px] text-emerald-600 font-bold uppercase">{m.dietTag} • {m.mealType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="text-sm font-bold text-slate-700">{m.calories} kcal / {m.protein}g P</div>
                      </td>
                      <td className="p-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleEditMeal(m)}
                          className="transition-all p-2 ml-2 text-blue-400 hover:text-blue-600"
                          title={isDbMealId(m.id) ? 'Edit database meal' : 'Edit meal'}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="transition-all p-2 text-red-400 hover:text-red-600"
                          title={isDbMealId(m.id) ? 'Delete database meal' : 'Delete meal'}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                        {deleteConfirmId === m.id && (
                          <div className="absolute right-0 mt-2 bg-white border border-red-200 rounded-xl shadow-lg p-4 z-50">
                            <div className="mb-2 text-sm text-slate-700">Are you sure you want to delete <span className="font-bold">{m.mealName}</span>?</div>
                            <div className="flex gap-2">
                              <button className="bg-red-500 text-white px-3 py-1 rounded" onClick={() => handleDeleteMeal(m)}>Delete</button>
                              <button className="bg-slate-200 text-slate-700 px-3 py-1 rounded" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
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




