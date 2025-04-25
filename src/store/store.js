import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice'; // Assuming authSlice.js is in the same directory

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Add other reducers here if you have more slices
  },
  // Optional: Configure middleware (e.g., for logging, thunk is included by default)
  // middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
}); 