const env = import.meta.env || {};

export const API_URL = (env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
export const LEARN_URL = (env.VITE_LEARN_URL || 'http://localhost:5173').replace(/\/$/, '');
export const SPACE_URL = (env.VITE_SPACE_URL || 'http://localhost:5174').replace(/\/$/, '');
export const ADMIN_URL = (env.VITE_ADMIN_URL || 'http://localhost:5175').replace(/\/$/, '');
export const WHATSAPP = env.VITE_WHATSAPP || '2348165468975';
export const PHONE_DISPLAY = env.VITE_PHONE_DISPLAY || '0816 546 8975';
export const ADDRESS = '20A Etete Road, GRA, Benin City';
