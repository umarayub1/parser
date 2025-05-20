import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ApiClient from '../components/ApiClient';

// Initial state
const initialState = {
  user: null,
  session: null,
  loading: false,
  error: null,
  credits: 0,
  authLoading: null // 'pending', 'fulfilled', 'rejected'
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await ApiClient.login(email, password);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signup = createAsyncThunk(
  'auth/signup',
  async ({ email, password, fullName }, { rejectWithValue }) => {
    try {
      const data = await ApiClient.signup(email, password, fullName);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await ApiClient.logout();
      return null;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUser = createAsyncThunk(
  'auth/fetchUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await ApiClient.getCurrentUser();
      return user;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCredits = createAsyncThunk(
  'auth/fetchCredits',
  async (_, { rejectWithValue }) => {
    try {
      const credits = await ApiClient.getCredits();
      return credits;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Updated thunks for session management
export const getSessionThunk = createAsyncThunk(
  'auth/getSession',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const response = await ApiClient.getSession();
      
      if (response.success && response.session) {
        // Set session first
        dispatch(setSession(response.session));
        
        // If session contains user or we can extract user details, set the user
        if (response.session?.user) {
          dispatch(setUser(response.session.user));
        } else {
          // Try to fetch user details if session exists but user info is missing
          try {
            const userData = await ApiClient.getCurrentUser();
            if (userData) {
              dispatch(setUser(userData));
            }
          } catch (userError) {
            console.error("Failed to fetch user details:", userError);
          }
        }
        
        return response.session;
      } else {
        // If no valid session, ensure user state is cleared
        dispatch(setSession(null));
        dispatch(setUser(null));
        return null;
      }
    } catch (error) {
      console.error("Session retrieval error:", error);
      // On error, ensure user state is cleared
      dispatch(setSession(null));
      dispatch(setUser(null));
      return rejectWithValue(error.message);
    }
  }
);

export const signInWithOAuthThunk = createAsyncThunk(
  'auth/signInWithOAuth',
  async ({ provider }, { rejectWithValue }) => {
    try {
      // Get OAuth URL from our backend
      const response = await ApiClient.googleSignIn();
      
      if (response.success && response.url) {
        // Redirect to the OAuth provider
        window.location.href = response.url;
        return { redirected: true };
      } else {
        throw new Error('Failed to initiate OAuth sign in');
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOutThunk = createAsyncThunk(
  'auth/signOut',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const response = await ApiClient.logout();
      
      // Clear local state regardless of API success
      dispatch(setSession(null));
      dispatch(setUser(null));
      
      return null;
    } catch (error) {
      // Still clear local state even if API call fails
      dispatch(setSession(null));
      dispatch(setUser(null));
      return rejectWithValue(error.message);
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setSession: (state, action) => {
      state.session = action.payload;
      // If session is null, also clear user
      if (!action.payload) {
        state.user = null;
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Signup
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state) => {
        state.loading = false;
        // Note: We don't set user here because the user needs to verify email
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Logout
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.session = null;
        state.credits = 0;
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        // Still reset user state even if logout failed on server
        state.user = null;
        state.session = null;
        state.credits = 0;
      })
      
      // Fetch User
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        if (action.payload?.credits_remaining) {
          state.credits = action.payload.credits_remaining;
        }
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch Credits
      .addCase(fetchCredits.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCredits.fulfilled, (state, action) => {
        state.loading = false;
        state.credits = action.payload;
      })
      .addCase(fetchCredits.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Session
      .addCase(getSessionThunk.pending, (state) => {
        state.authLoading = 'pending';
      })
      .addCase(getSessionThunk.fulfilled, (state) => {
        state.authLoading = 'fulfilled';
      })
      .addCase(getSessionThunk.rejected, (state, action) => {
        state.authLoading = 'rejected';
        state.error = action.payload;
      })
      
      // Sign In with OAuth
      .addCase(signInWithOAuthThunk.pending, (state) => {
        state.authLoading = 'pending';
      })
      .addCase(signInWithOAuthThunk.fulfilled, (state) => {
        state.authLoading = 'fulfilled';
      })
      .addCase(signInWithOAuthThunk.rejected, (state, action) => {
        state.authLoading = 'rejected';
        state.error = action.payload;
      })
      
      // Sign Out
      .addCase(signOutThunk.pending, (state) => {
        state.authLoading = 'pending';
      })
      .addCase(signOutThunk.fulfilled, (state) => {
        state.authLoading = 'fulfilled';
      })
      .addCase(signOutThunk.rejected, (state, action) => {
        state.authLoading = 'rejected';
        state.error = action.payload;
      });
  }
});

// Export actions
export const { setUser, setSession, clearError } = authSlice.actions;

// Export selectors
export const selectUser = (state) => state.auth.user;
export const selectSession = (state) => state.auth.session;
export const selectAuthLoading = (state) => state.auth.authLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectCredits = (state) => state.auth.credits;
export const selectIsAuthenticated = (state) => !!state.auth.user;

// Export reducer
export default authSlice.reducer; 