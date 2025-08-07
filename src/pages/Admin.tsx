import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import { getUser, isUserAdmin } from '../lib/utils';

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        setLoading(true);
        const { data } = await getUser();
        
        if (!data?.user) {
          // No user logged in, redirect to main app
          navigate('/');
          return;
        }

        // Check if user is admin
        const { data: adminData } = await isUserAdmin(data.user.id);
        
        if (!adminData) {
          // User is not admin, redirect to main app
          navigate('/');
          return;
        }

        // User is admin, show admin dashboard
        setIsAdmin(true);
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white text-lg">Loading admin panel...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect to main app
  }

  return <AdminDashboard />;
};

export default Admin; 