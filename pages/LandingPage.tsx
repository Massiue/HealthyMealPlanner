
import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <i className="fa-solid fa-leaf text-xl"></i>
          </div>
          <span className="text-2xl font-bold text-emerald-900">NutriPlan</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-emerald-800 font-medium hover:text-emerald-600 transition">Login</Link>
          <Link to="/register" className="bg-emerald-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-emerald-700 transition">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider mb-6">
            Eat Better, Live Longer
          </span>
          <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 leading-[1.1] mb-8">
            The Smartest Way to <span className="text-emerald-600 underline decoration-emerald-200">Plan Your Meals</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
            Calculated nutrition, personalized recommendations, and a simple interface to manage your daily intake. Your journey to a healthier you starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/register" className="bg-emerald-600 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-emerald-700 transition-all text-center">
              Start Free Trial
            </Link>
            <a href="#features" className="bg-white border-2 border-slate-100 text-slate-700 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all text-center">
              Learn More
            </a>
          </div>
          <div className="mt-12 flex items-center gap-4 text-slate-500">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <img key={i} src={`https://picsum.photos/100/100?random=${i+20}`} className="w-10 h-10 rounded-full border-2 border-white" alt="user" />
              ))}
            </div>
            <p className="text-sm font-medium"><span className="text-emerald-600 font-bold">10,000+</span> happy healthy planners</p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-emerald-200/40 rounded-3xl blur-2xl"></div>
          <img 
            src="https://picsum.photos/800/600?random=10" 
            alt="Healthy Food" 
            className="relative rounded-[2.5rem] border-8 border-white object-cover aspect-[4/3]"
          />
          <div className="absolute top-10 -left-10 bg-white p-6 rounded-3xl animate-bounce duration-[3000ms] border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-fire text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Daily Goal</p>
                <p className="text-lg font-bold text-slate-800">2,400 kcal</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-10 -right-10 bg-white p-6 rounded-3xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-check text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Meals Planned</p>
                <p className="text-lg font-bold text-slate-800">7 Days Complete</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-emerald-50/50 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Built for your lifestyle</h2>
            <p className="text-slate-600 text-lg">NutriPlan handles the math and science of healthy eating so you can focus on the flavor.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Personalized Calorie Goal', desc: 'Custom calculations based on your age, weight, and activity level.', icon: 'fa-calculator', color: 'bg-blue-100 text-blue-600' },
              { title: 'Smart Meal Balancing', desc: 'Perfect 30/40/30 distribution for breakfast, lunch, and dinner.', icon: 'fa-balance-scale', color: 'bg-emerald-100 text-emerald-600' },
              { title: 'Healthy Recipes', desc: 'Discover new delicious recipes with clear calorie counts and diet tags.', icon: 'fa-carrot', color: 'bg-orange-100 text-orange-600' }
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-emerald-50 hover:-translate-y-2 transition-all duration-300">
                <div className={`w-14 h-14 ${f.color} rounded-2xl flex items-center justify-center mb-6`}>
                  <i className={`fa-solid ${f.icon} text-2xl`}></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-emerald-50 text-center">
        <p className="text-slate-400">&copy; 2024 NutriPlan App. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
