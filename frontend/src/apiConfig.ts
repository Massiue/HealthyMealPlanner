const PROD_API_BASE = 'https://healthymealplanner-1.onrender.com/api';

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD ? PROD_API_BASE : '/api');