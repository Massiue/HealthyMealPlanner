import React, { useContext, useState } from 'react';
import { AuthContext } from '../App';
import { Gender, ActivityLevel, FitnessGoal } from '../types';
import { calculateDailyCalories, calculateDailyProtein, calculateDailyWater } from '../services/calorieCalculator';

const ProfilePage: React.FC = () => {
  const { user, updateProfile } = useContext(AuthContext);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: user?.age || 25,
    gender: user?.gender || Gender.MALE,
    weight: user?.weight || 70,
    height: user?.height || 175,
    activityLevel: user?.activityLevel || ActivityLevel.MODERATE,
    goal: user?.goal || FitnessGoal.MAINTAIN,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelect = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Calculate all three metrics
    const dailyCalories = calculateDailyCalories(
      Number(formData.age),
      formData.gender,
      Number(formData.weight),
      Number(formData.height),
      formData.activityLevel,
      formData.goal as FitnessGoal
    );

    const dailyProtein = calculateDailyProtein(
      Number(formData.weight),
      formData.goal as FitnessGoal
    );

    const dailyWater = calculateDailyWater(
      Number(formData.weight)
    );

    // Save all to profile
    await updateProfile({
      ...formData,
      age: Number(formData.age),
      weight: Number(formData.weight),
      height: Number(formData.height),
      dailyCalories,
      dailyProtein,
      dailyWater,
    });
    
    setTimeout(() => {
        setIsSaving(false);
    }, 600);
  };

  const OptionButton = ({ active, onClick, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 px-2 rounded-xl font-bold text-sm transition-all border ${
        active 
          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
          : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 animate-fadeIn">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Your Profile</h1>
        <p className="text-slate-500 mt-2">Manage your personal metrics and goals.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-xl shadow-emerald-900/5 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2 ml-1">
              <i className="fa-solid fa-user text-slate-400"></i> Full Name
            </label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 font-medium text-center md:text-left"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2 ml-1">
              <i className="fa-solid fa-calendar-days text-slate-400"></i> Age
            </label>
            <input 
              type="number" 
              name="age"
              value={formData.age}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 font-medium text-center md:text-left"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2 ml-1">
              <i className="fa-solid fa-weight-hanging text-slate-400"></i> Weight (kg)
            </label>
            <input 
              type="number" 
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 font-medium text-center md:text-left"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2 ml-1">
              <i className="fa-solid fa-ruler-combined text-slate-400"></i> Height (cm)
            </label>
            <input 
              type="number" 
              name="height"
              value={formData.height}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 font-medium text-center md:text-left"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[15px] font-bold text-slate-800 block text-center">Gender</label>
          <div className="flex gap-3">
            <OptionButton active={formData.gender === Gender.MALE} onClick={() => handleSelect('gender', Gender.MALE)}>Male</OptionButton>
            <OptionButton active={formData.gender === Gender.FEMALE} onClick={() => handleSelect('gender', Gender.FEMALE)}>Female</OptionButton>
            <OptionButton active={formData.gender === Gender.OTHER} onClick={() => handleSelect('gender', Gender.OTHER)}>Other</OptionButton>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[15px] font-bold text-slate-800 flex items-center justify-center gap-2">
            <i className="fa-solid fa-wave-square text-slate-400"></i> Activity Level
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <OptionButton active={formData.activityLevel === ActivityLevel.SEDENTARY} onClick={() => handleSelect('activityLevel', ActivityLevel.SEDENTARY)}>Sedentary</OptionButton>
            <OptionButton active={formData.activityLevel === ActivityLevel.LIGHT} onClick={() => handleSelect('activityLevel', ActivityLevel.LIGHT)}>Lightly Active</OptionButton>
            <OptionButton active={formData.activityLevel === ActivityLevel.MODERATE} onClick={() => handleSelect('activityLevel', ActivityLevel.MODERATE)}>Moderately Active</OptionButton>
            <OptionButton active={formData.activityLevel === ActivityLevel.ACTIVE} onClick={() => handleSelect('activityLevel', ActivityLevel.ACTIVE)}>Very Active</OptionButton>
            <OptionButton active={formData.activityLevel === ActivityLevel.VERY_ACTIVE} onClick={() => handleSelect('activityLevel', ActivityLevel.VERY_ACTIVE)}>Extra Active</OptionButton>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[15px] font-bold text-slate-800 flex items-center justify-center gap-2">
            <i className="fa-solid fa-bullseye text-slate-400"></i> What's your primary goal?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OptionButton active={formData.goal === FitnessGoal.LOSS} onClick={() => handleSelect('goal', FitnessGoal.LOSS)}>Weight Loss</OptionButton>
            <OptionButton active={formData.goal === FitnessGoal.MAINTAIN} onClick={() => handleSelect('goal', FitnessGoal.MAINTAIN)}>Maintain Weight</OptionButton>
            <OptionButton active={formData.goal === FitnessGoal.GAIN} onClick={() => handleSelect('goal', FitnessGoal.GAIN)}>Weight Gain</OptionButton>
            <OptionButton active={formData.goal === FitnessGoal.MUSCLE_GAIN} onClick={() => handleSelect('goal', FitnessGoal.MUSCLE_GAIN)}>Muscle Gain</OptionButton>
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit"
            disabled={isSaving}
            className="w-full py-5 bg-slate-900 text-white rounded-[1.75rem] font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-70 shadow-lg shadow-slate-200"
          >
            {isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;