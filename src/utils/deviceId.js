// Generate a unique device ID (similar to backend nanoid)
const generateDeviceId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'device_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Cookie utility functions
const cookieUtils = {
  // Set a cookie
  set: (name, value, days = 365) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  },

  // Get a cookie value
  get: (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  },

  // Delete a cookie
  delete: (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
};

// Main device ID management
const deviceIdManager = {
  // Get existing device ID or create new one
  getDeviceId: () => {
    let deviceId = cookieUtils.get('deviceId');
    
    // Migration: Check localStorage for existing deviceId and migrate to cookies
    if (!deviceId) {
      const legacyDeviceId = localStorage.getItem('deviceId');
      if (legacyDeviceId) {
        console.log('Migrating device ID from localStorage to cookies:', legacyDeviceId);
        deviceId = legacyDeviceId;
        cookieUtils.set('deviceId', deviceId, 365);
        // Optionally remove from localStorage after migration
        localStorage.removeItem('deviceId');
      }
    }
    
    // If still no device ID, generate a new one
    if (!deviceId) {
      deviceId = generateDeviceId();
      cookieUtils.set('deviceId', deviceId, 365); // Set for 1 year
      console.log('Generated new device ID:', deviceId);
    } else {
      console.log('Using existing device ID:', deviceId);
    }
    
    return deviceId;
  },

  // Force regenerate device ID (useful for testing or user reset)
  regenerateDeviceId: () => {
    const newDeviceId = generateDeviceId();
    cookieUtils.set('deviceId', newDeviceId, 365);
    console.log('Regenerated device ID:', newDeviceId);
    return newDeviceId;
  },

  // Clear device ID
  clearDeviceId: () => {
    cookieUtils.delete('deviceId');
    // Also clear from localStorage if it exists
    localStorage.removeItem('deviceId');
    console.log('Device ID cleared');
  }
};

// API utility with automatic device ID inclusion
const apiUtils = {
  // Base API URL - update this to match your backend
//   baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',

  // Make API request with device ID automatically included
  request: async (endpoint, options = {}) => {
    const deviceId = deviceIdManager.getDeviceId();
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId, // Send as header as backup
      },
      credentials: 'include', // Include cookies in request
    };

    // Merge options
    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      }
    };

    // Add device ID to body for POST/PUT requests if not already present
    if (['POST', 'PUT', 'PATCH'].includes(finalOptions.method) && finalOptions.body) {
      try {
        const bodyData = JSON.parse(finalOptions.body);
        if (!bodyData.deviceId) {
          bodyData.deviceId = deviceId;
          finalOptions.body = JSON.stringify(bodyData);
        }
      } catch (e) {
        // Body is not JSON, skip adding deviceId
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${apiUtils.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  // Convenience methods for different HTTP verbs
  get: (endpoint, options = {}) => 
    apiUtils.request(endpoint, { ...options, method: 'GET' }),

  post: (endpoint, data = {}, options = {}) => 
    apiUtils.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }),

  put: (endpoint, data = {}, options = {}) => 
    apiUtils.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  delete: (endpoint, options = {}) => 
    apiUtils.request(endpoint, { ...options, method: 'DELETE' })
};

export {
  deviceIdManager,
  apiUtils,
  cookieUtils,
  generateDeviceId
};
