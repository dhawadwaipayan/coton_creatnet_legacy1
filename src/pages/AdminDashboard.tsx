import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import { getUser, isUserAdmin } from '../lib/utils';

const AdminDashboardPage: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data } = await getUser();
        
        if (!data?.user) {
          // No user logged in, redirect to admin login
          navigate('/admin', { replace: true });
          return;
        }

        // Check if user is admin
        const { data: adminData, error: adminError } = await isUserAdmin(data.user.id);
        
        if (adminError || !adminData) {
          // User is not admin, redirect to admin login
          navigate('/admin', { replace: true });
          return;
        }

        // User is admin, show admin dashboard
        setIsAdmin(true);
        setLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/admin', { replace: true });
      }
    };

    checkAdminStatus();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect to admin login
  }

  return <AdminDashboard />;
};

export default AdminDashboardPage; 