import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-white">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        ></div>
      )}

      {/* Sidebar Container - Permanently Fixed */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:block
      `}>
        <Sidebar onLogout={onLogout} />
      </div>

      <main className="flex-1 min-h-screen flex flex-col lg:ml-64 bg-emerald-50/10">
        {/* Top Header for Mobile only */}
        <header className="lg:hidden h-20 bg-white border-b border-emerald-100 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <i className="fa-solid fa-leaf text-sm"></i>
            </div>
            <span className="font-bold text-emerald-900 text-lg">NutriPlan</span>
          </div>
          <button 
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-800 rounded-xl focus:outline-none active:scale-95 transition-all"
          >
            <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars-staggered'} text-xl`}></i>
          </button>
        </header>

        {/* Content Area - Centered Wrapper */}
        <div className="flex-1 flex flex-col items-center">
          <div className="p-6 lg:p-12 w-full max-w-5xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;