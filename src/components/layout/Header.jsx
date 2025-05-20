import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import UserCredits from '../UserCredits';

// Import Redux actions and selectors
import {
  signOutThunk,
  selectUser,
  selectAuthLoading
} from '../../store/authSlice';

const Header = ({ mobileNavOpen, setMobileNavOpen }) => {
  const user = useSelector(selectUser);
  const authLoading = useSelector(selectAuthLoading);
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  
  // Add click outside listener to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownOpen && !event.target.closest('.profile-dropdown-container')) {
        setProfileDropdownOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Toggle mobile navigation
  const toggleMobileNav = () => {
    setMobileNavOpen(!mobileNavOpen);
    // When opening menu, also prevent body scrolling and add menu-open class
    document.body.style.overflow = !mobileNavOpen ? 'hidden' : '';
    
    if (!mobileNavOpen) {
      document.body.classList.add('menu-open');
      document.documentElement.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
      document.documentElement.classList.remove('menu-open');
    }
  };

  // --- Sign Out Handler -> Dispatch Thunk ---
  const handleSignOut = async () => {
    console.log("Sign out button clicked...");
    try {
      console.log("Dispatching signOutThunk...");
      // Dispatch the async thunk
      await dispatch(signOutThunk());
      console.log("Sign out thunk dispatched successfully");
    } catch (err) {
      console.error(`Error during sign-out dispatch: ${err.message}`);
    }
  };

  // Determine active link
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/new-request') {
      return location.pathname === '/new-request';
    }
    if (path === '/history') {
      return location.pathname === '/history';
    }
    if (path === '/subscriptions') {
      return location.pathname === '/subscriptions';
    }
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    if (path === '/contact') {
      return location.pathname === '/contact';
    }
    if (path === '/login') {
      return location.pathname === '/login';
    }
    if (path === '/signup') {
      return location.pathname === '/signup';
    }
    if (path === '/api-docs') {
      return location.pathname === '/api-docs';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <Link to="/" className="logo-link">
              <img src="/logo.png" alt="Logo" className="header-logo" />
              <h1>Bank Parser</h1>
            </Link>
          </div>
          
          <div className="header-controls">
            {user && (
              <div className="nav-links">
                <Link to="/new-request" className={`nav-link ${isActive('/new-request') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span className="nav-text">New Request</span>
                </Link>
                <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span className="nav-text">History</span>
                </Link>
                <Link to="/subscriptions" className={`nav-link ${isActive('/subscriptions') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                  </svg>
                  <span className="nav-text">Subscriptions</span>
                </Link>
                <Link to="/api-docs" className={`nav-link ${isActive('/api-docs') || isActive('/api-examples') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span className="nav-text">API</span>
                </Link>
                <Link to="/contact" className={`nav-link ${isActive('/contact') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  <span className="nav-text">Contact</span>
                </Link>
              </div>
            )}
            
            {/* Add hamburger menu for mobile */}
            <div 
              className={`hamburger-menu ${mobileNavOpen ? 'active' : ''}`} 
              onClick={toggleMobileNav}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </div>

            <div className="auth-section">
              {user ? (
                <div className="user-info">
                  <UserCredits />
                  <div className="profile-dropdown-container">
                    <div 
                      className="profile-dropdown-trigger"
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    >
                      {user.user_metadata?.avatar_url ? (
                        <img 
                          src={user.user_metadata.avatar_url} 
                          alt="Profile" 
                          className="user-avatar" 
                        />
                      ) : (
                        <div className="user-avatar-placeholder">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    {profileDropdownOpen && (
                      <div className="profile-dropdown-menu">
                        <div className="dropdown-user-info">
                          {user.user_metadata?.avatar_url && (
                            <img 
                              src={user.user_metadata.avatar_url} 
                              alt="Profile" 
                              className="dropdown-user-avatar" 
                            />
                          )}
                          <div className="dropdown-user-details">
                            <span className="dropdown-user-name">
                              {user.user_metadata?.full_name || user.email?.split('@')[0]}
                            </span>
                            <span className="dropdown-user-email">{user.email}</span>
                          </div>
                        </div>
                        <div className="dropdown-divider"></div>
                        <Link 
                          to="/profile"
                          className="dropdown-item profile-item"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          My Profile
                        </Link>
                        <div className="dropdown-divider"></div>
                        <button 
                          className="dropdown-item sign-out-item" 
                          onClick={(e) => {
                            e.preventDefault();
                            handleSignOut();
                            setProfileDropdownOpen(false);
                          }} 
                          disabled={authLoading === 'pending'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="auth-buttons">
                  <Link to="/login" className="auth-button login">
                    Log In
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <div 
        className={`mobile-nav-overlay ${mobileNavOpen ? 'active' : ''}`} 
        onClick={toggleMobileNav}
      ></div>
      
      <div className={`mobile-nav ${mobileNavOpen ? 'active' : ''}`}>
        <div className="mobile-nav-header">
          <h3>Menu</h3>
          <button className="mobile-nav-close" onClick={toggleMobileNav}>&times;</button>
        </div>
        
        {/* Add credits display in mobile menu when user is logged in */}
        {user && (
          <div className="mobile-credits-display">
            <UserCredits />
          </div>
        )}
        
        <div className="mobile-nav-links">
          <Link to="/new-request" className={`mobile-nav-link ${isActive('/new-request') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Request
          </Link>
          
          <Link to="/history" className={`mobile-nav-link ${isActive('/history') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            History
          </Link>
          
          <Link to="/subscriptions" className={`mobile-nav-link ${isActive('/subscriptions') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            Subscriptions
          </Link>
          
          <Link to="/api-docs" className={`mobile-nav-link ${isActive('/api-docs') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            API
          </Link>
          
          <Link to="/contact" className={`mobile-nav-link ${isActive('/contact') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            Contact
          </Link>
        </div>
        
        {/* Mobile user info and auth */}
        {user ? (
          <div className="mobile-user-info">
            <div className="mobile-user-avatar">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="User Avatar" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
            
            <div className="mobile-user-details">
              <div>{user.email}</div>
              <button className="auth-button sign-out" onClick={handleSignOut}>Sign Out</button>
            </div>
          </div>
        ) : (
          <div className="mobile-auth-buttons">
            <Link 
              to="/login" 
              className="auth-button login" 
              onClick={toggleMobileNav}
            >
              Log In
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default Header; 