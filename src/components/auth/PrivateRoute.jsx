import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectSession } from '../../store/authSlice';

// Component to wrap protected routes requiring authentication
const PrivateRoute = ({ children }) => {
  const session = useSelector(selectSession);
  const location = useLocation();
  
  if (!session) {
    // Redirect to login if not authenticated, saving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

export default PrivateRoute; 