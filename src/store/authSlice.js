import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../supabaseClient'; // Adjust path as necessary

// Async Thunk for fetching the initial session
export const getSessionThunk = createAsyncThunk(
  'auth/getSession',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      console.log("Redux: Initial session fetched:", data.session);
      return data.session;
    } catch (error) {
      console.error("Redux: Error getting session:", error);
      return rejectWithValue(error.message);
    }
  }
);

// Async Thunk for OAuth Sign In
export const signInWithOAuthThunk = createAsyncThunk(
  'auth/signInWithOAuth',
  async ({ provider }, { rejectWithValue }) => {
    try {
      console.log(`Starting OAuth sign-in with ${provider}...`);
      
      // Get current URL for redirect
      const redirectUrl = window.location.origin;
      console.log(`Setting redirect URL to: ${redirectUrl}`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
        },
      });
      
      if (error) {
        console.error(`OAuth sign-in error:`, error);
        throw error;
      }
      
      console.log(`OAuth sign-in initiated:`, data);
      
      // If we get here, the user will be redirected to the OAuth provider
      return null;
    } catch (error) {
      console.error(`Redux: OAuth sign-in error (${provider}):`, error);
      return rejectWithValue(error.message);
    }
  }
);

// Async Thunk for Sign Out
export const signOutThunk = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log("Redux: Signed out successfully.");
      return null; // Indicates success
    } catch (error) {
      console.error("Redux: Sign out error:", error);
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  session: null,
  user: null, // Derived from session
  loading: 'idle', // 'idle' | 'pending' | 'succeeded' | 'failed'
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Action to directly set the session, useful for the onAuthStateChange listener
    setSession: (state, action) => {
      state.session = action.payload;
      state.user = action.payload?.user ?? null;
      state.error = null; // Clear error on successful session update
      state.loading = 'succeeded'; // Assume succeeded if listener provides session
      console.log("Redux: Session set via listener:", action.payload);
    },
    // Action to clear session state, e.g., after sign out confirmed by listener
    clearSession: (state) => {
      state.session = null;
      state.user = null;
      state.loading = 'idle';
      state.error = null;
      console.log("Redux: Session cleared.");
    },
    // Optional: Reducer to clear auth error manually if needed
    clearAuthError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // getSessionThunk
      .addCase(getSessionThunk.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(getSessionThunk.fulfilled, (state, action) => {
        state.session = action.payload;
        state.user = action.payload?.user ?? null;
        state.loading = 'succeeded';
      })
      .addCase(getSessionThunk.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload; // Error message from rejectWithValue
        state.session = null;
        state.user = null;
      })
      // signInWithOAuthThunk
      .addCase(signInWithOAuthThunk.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(signInWithOAuthThunk.fulfilled, (state) => {
        // State might not change immediately here as redirect is happening
        // The onAuthStateChange listener will likely update the state after redirect
        state.loading = 'succeeded'; // Or keep 'pending' until listener confirms? 'succeeded' seems ok.
      })
      .addCase(signInWithOAuthThunk.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload;
      })
      // signOutThunk
      .addCase(signOutThunk.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(signOutThunk.fulfilled, (state) => {
        // The listener (onAuthStateChange) should trigger setSession(null)
        // So we might not need to clear state here, but doing so is safe.
        state.session = null;
        state.user = null;
        state.loading = 'succeeded'; // Or 'idle'? 'succeeded' indicates the sign out *action* finished.
      })
      .addCase(signOutThunk.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload;
      });
  },
});

// Export actions
export const { setSession, clearSession, clearAuthError } = authSlice.actions;

// Export reducer
export default authSlice.reducer;

// Export selectors (optional but good practice)
export const selectSession = (state) => state.auth.session;
export const selectUser = (state) => state.auth.user;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error; 