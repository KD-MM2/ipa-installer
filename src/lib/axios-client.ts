// lib/axios-client.ts
import axios from 'axios';

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    timeout: 0, // Disable timeout
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        // Add any auth headers here if needed
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);
