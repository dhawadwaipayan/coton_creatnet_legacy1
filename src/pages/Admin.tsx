import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import { getUser, isUserAdmin } from '../lib/utils';

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkAdminStatus = async () => {
      try {
        const { data } = await getUser();
        
        if (!isMounted) return;
        
        if (!data?.user) {
          // No user logged in, redirect immediately
          navigate('/', { replace: true });
          return;
        }

        // Check if user is admin
        const { data: adminData } = await isUserAdmin(data.user.id);
        
        if (!isMounted) return;
        
        if (!adminData) {
          // User is not admin, redirect immediately
          navigate('/', { replace: true });
          return;
        }

        // User is admin, show admin dashboard
        setIsAdmin(true);
        setIsChecking(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (isMounted) {
          navigate('/', { replace: true });
        }
      }
    };

    checkAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Show nothing while checking - prevents any flash for non-admin users
  if (isChecking) {
    return null;
  }

  // Only render admin dashboard if user is confirmed admin
  if (isAdmin) {
    return <AdminDashboard />;
  }

  // Fallback - should never reach here, but just in case
  return null;
};

export default Admin; 