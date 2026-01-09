import axios from 'axios';

// Replace with your computer's local IP address
const API_URL = 'http://169.233.132.123:8000';

export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

export const getFilters = async (currentFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
    });
    const response = await api.get(`/api/filters?${params}`);
    return response.data;
};

export const getPrices = async (filters = {}, limit = 50, days = null) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
    });
    params.append('limit', limit.toString());
    if (days) {
        params.append('days', days.toString());
    }
    const response = await api.get(`/api/prices?${params}`);
    return response.data;
};
