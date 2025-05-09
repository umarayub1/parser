import React from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import UserCredits from '../components/UserCredits';
import '../App.css';

function ProfilePage() {
  const user = useSelector(selectUser);
  
  if (!user) {
    return (
      <div className="container">
        <p className="warning-message">Please <a href="/">Sign In</a> to view your profile.</p>
      </div>
    );
  }
  
  return (
    <div className="container profile-container">
      <div className="profile-header">
        <h2>My Profile</h2>
      </div>
      
      <div className="profile-content">
        <div className="profile-section user-profile-section">
          <div className="profile-avatar-section">
            {user.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="profile-avatar" 
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="profile-details">
            <h3>
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </h3>
            <p className="profile-email">{user.email}</p>
            <p className="profile-joined">
              Joined on {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="profile-section">
          <h3>Account Information</h3>
          <div className="profile-account-info">
            <div className="account-item">
              <span className="account-label">Email verified:</span>
              <span className="account-value">
                {user.email_confirmed_at ? (
                  <span className="verified-badge">Verified ✓</span>
                ) : 'Not verified'}
              </span>
            </div>
            <div className="account-item">
              <span className="account-label">Authentication Provider:</span>
              <span className="account-value">{user.app_metadata?.provider || 'Email'}</span>
            </div>
            <div className="account-item">
              <span className="account-label">Last sign in:</span>
              <span className="account-value">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="profile-section">
          <h3>Credits & Usage</h3>
          <div className="profile-account-info">
            <div className="account-item">
              <span className="account-label">Available Credits:</span>
              <span className="account-value">
                <UserCredits />
              </span>
            </div>
            <div className="account-item">
              <span className="account-label">Account Status:</span>
              <span className="account-value">
                {user.app_metadata?.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
        
        {user.user_metadata && (
          <div className="profile-section">
            <h3>User Preferences</h3>
            <div className="profile-account-info">
              {user.user_metadata.full_name && (
                <div className="account-item">
                  <span className="account-label">Full Name:</span>
                  <span className="account-value">{user.user_metadata.full_name}</span>
                </div>
              )}
              {user.user_metadata.preferred_language && (
                <div className="account-item">
                  <span className="account-label">Preferred Language:</span>
                  <span className="account-value">{user.user_metadata.preferred_language}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage; 