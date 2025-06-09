// src/App.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Import components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PrivateRoute from './components/auth/PrivateRoute';
import SessionManager from './components/auth/SessionManager';

// Import pages
import SubscriptionsPage from './pages/SubscriptionsPage';
import ProfilePage from './pages/ProfilePage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ApiDocsPage from './pages/ApiDocsPage';
import ApiExamplesPage from './pages/ApiExamplesPage';
import LandingPage from './pages/LandingPage';
import RequestsPage from './pages/RequestsPage';
import RequestPage from '../src/components/RequestPage';

// Import Redux selectors
import { selectUser, selectSession } from './store/authSlice';

import './App.css';

function App() {
  const user = useSelector(selectUser);
  const session = useSelector(selectSession);
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Close mobile nav when route changes
  useEffect(() => {
    setMobileNavOpen(false);
    document.body.style.overflow = '';
    document.body.classList.remove('menu-open');
    document.documentElement.classList.remove('menu-open');
  }, [location.pathname]);

  return (
    <div className="main-layout">
      <SessionManager />
      <Header 
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />
      
      <main className="content-container">
        {!user ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        ) : (
          <Routes>
            <Route 
              path="/" 
              element={<Navigate to="/requests" replace />} 
            />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/top-up" element={<Navigate to="/subscriptions" replace />} />
            <Route path="/requests/:id" element={<RequestPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/api-examples" element={<ApiExamplesPage />} />
            <Route path="/login" element={<Navigate to="/requests" replace />} />
            <Route path="/signup" element={<Navigate to="/requests" replace />} />
          </Routes>
        )}
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
