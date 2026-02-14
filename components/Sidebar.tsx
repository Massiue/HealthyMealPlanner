import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../App';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', icon: 'fa-chart-pie', path: '/dashboard' },
    { name: 'Meal Planner', icon: 'fa-calendar-days', path: '/planner' },
    { name: 'Recommendations', icon: 'fa-utensils', path: '/recommendations' },
    { name: 'Progress', icon: 'fa-chart-line', path: '/progress' },
    { name: 'Profile', icon: 'fa-user', path: '/profile' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ name: 'Admin Panel', icon: 'fa-screwdriver-wrench', path: '/admin' });
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 bg-white border-r border-emerald-100 flex flex-col fixed top-0 left-0 bottom-0 z-50 h-screen overflow-hidden select-none">
      <div className="p-8 pb-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
            <i className="fa-solid fa-leaf text-xl"></i>
          </div>
          <span className="text-2xl font-bold text-emerald-900 tracking-tight">NutriPlan</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-6 overflow-hidden">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl ${
              isActive(item.path)
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-800 hover:bg-emerald-50 hover:text-emerald-600'
            }`}
          >
            <div className="w-5 flex justify-center">
              <i className={`fa-solid ${item.icon} text-lg`}></i>
            </div>
            <span className="font-bold text-[15px]">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-emerald-50">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-2xl"
        >
          <div className="w-5 flex justify-center">
            <i className="fa-solid fa-right-from-bracket text-lg"></i>
          </div>
          <span className="font-bold text-[15px]">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;