import { getData, storeData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Use 10.0.2.2 for Android emulator, localhost for iOS simulator
// For physical device, use your computer's actual IP address (e.g., 192.168.1.x)
const BASE_URL = 'http://192.168.1.8:5050/api/v1';

const getAuthHeaders = async () => {
  const token = await getData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
};

// Auth APIs
export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  login: async (email, password) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      await storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, data.token);
      await storeData(ASYNC_STORAGE_KEYS.USER_DATA, data.user);
    }
    return data;
  },

  logout: async () => {
    await removeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
    await removeData(ASYNC_STORAGE_KEYS.USER_DATA);
  },

  getMe: async () => {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Products APIs
export const productsAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/products?${queryString}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${BASE_URL}/products/${id}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Orders APIs
export const ordersAPI = {
  create: async (orderData) => {
    const response = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(orderData),
    });
    return handleResponse(response);
  },

  getMyOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/orders/my-orders?${queryString}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${BASE_URL}/orders/${id}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  cancel: async (id) => {
    const response = await fetch(`${BASE_URL}/orders/${id}/cancel`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Notifications APIs
export const notificationsAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/notifications?${queryString}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  markAsRead: async (id) => {
    const response = await fetch(`${BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  markAllAsRead: async () => {
    const response = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  registerToken: async (token, deviceType) => {
    const response = await fetch(`${BASE_URL}/notifications/token`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ token, deviceType }),
    });
    return handleResponse(response);
  },
};

// Users APIs
export const usersAPI = {
  updateProfile: async (userData) => {
    const response = await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  getAddresses: async () => {
    const response = await fetch(`${BASE_URL}/users/addresses`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  addAddress: async (addressData) => {
    const response = await fetch(`${BASE_URL}/users/addresses`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(addressData),
    });
    return handleResponse(response);
  },

  deleteAddress: async (id) => {
    const response = await fetch(`${BASE_URL}/users/addresses/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Areas API
export const areasAPI = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/areas`);
    return handleResponse(response);
  },
};

export default {
  auth: authAPI,
  products: productsAPI,
  orders: ordersAPI,
  notifications: notificationsAPI,
  users: usersAPI,
  areas: areasAPI,
};
