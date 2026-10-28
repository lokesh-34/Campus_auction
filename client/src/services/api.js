import { auth } from './firebase.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn('Failed to get Firebase token:', e);
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    const errorMsg = json?.error?.message || response.statusText || 'Request failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = json?.error?.code;
    err.details = json?.error?.details;
    throw err;
  }

  return json.data;
}

export const api = {
  // Users
  syncUser: (data) => request('/users/sync', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/users/me'),
  updateProfile: (data) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getPublicProfile: (id) => request(`/users/${id}/public`),

  // Listings
  getListings: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v != null && v !== '')
    ).toString();
    return request(`/listings${qs ? `?${qs}` : ''}`);
  },
  getListing: (id) => request(`/listings/${id}`),
  createListing: (data) => request('/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id, data) => request(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancelListing: (id, reason) => request(`/listings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getMyListings: () => request('/listings/seller/me'),

  // Bidding
  placeBid: (listingId, amountPaise) =>
    request(`/listings/${listingId}/bids`, { method: 'POST', body: JSON.stringify({ amountPaise }) }),
  getBidHistory: (listingId) => request(`/listings/${listingId}/bids`),
  getMyActiveBids: () => request('/bids/my/active'),
  setAutoBid: (listingId, maxAmountPaise) =>
    request(`/listings/${listingId}/autobid`, { method: 'POST', body: JSON.stringify({ maxAmountPaise }) }),
  getMyAutoBid: (listingId) => request(`/listings/${listingId}/autobid`),
  disableAutoBid: (listingId) => request(`/listings/${listingId}/autobid`, { method: 'DELETE' }),

  // Sales & Handovers
  getSale: (id) => request(`/sales/${id}`),
  approveSale: (id) => request(`/sales/${id}/approve`, { method: 'POST' }),
  rejectSale: (id) => request(`/sales/${id}/reject`, { method: 'POST' }),
  confirmHandover: (id) => request(`/sales/${id}/confirm-handover`, { method: 'POST' }),
  cancelSale: (id, reason) => request(`/sales/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getMySales: (role = 'all') => request(`/sales/my?role=${role}`),

  // Questions
  getQuestions: (listingId) => request(`/listings/${listingId}/questions`),
  askQuestion: (listingId, questionText) =>
    request(`/listings/${listingId}/questions`, { method: 'POST', body: JSON.stringify({ questionText }) }),
  answerQuestion: (questionId, answerText) =>
    request(`/questions/${questionId}/answer`, { method: 'POST', body: JSON.stringify({ answerText }) }),

  // Watchlist & Notifications
  getWatchlist: () => request('/watchlist'),
  toggleWatchlist: (listingId) => request(`/watchlist/${listingId}`, { method: 'POST' }),
  getNotifications: (page = 1) => request(`/notifications?page=${page}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // Saved Searches
  getSavedSearches: () => request('/saved-searches'),
  createSavedSearch: (data) => request('/saved-searches', { method: 'POST', body: JSON.stringify(data) }),
  deleteSavedSearch: (id) => request(`/saved-searches/${id}`, { method: 'DELETE' }),

  // AI Assistant
  queryAi: (query) => request('/ai/query', { method: 'POST', body: JSON.stringify({ query }) }),
  proposeAiBid: (data) => request('/ai/propose-bid', { method: 'POST', body: JSON.stringify(data) }),

  // Uploads
  getSignParameters: () => request('/uploads/sign', { method: 'POST' }),
};
