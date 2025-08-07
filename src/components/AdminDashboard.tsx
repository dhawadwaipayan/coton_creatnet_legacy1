import React, { useState, useEffect } from 'react';
import { 
  getPendingApprovals, 
  approveUser, 
  rejectUser, 
  getAllApprovedUsers,
  getUser,
  signOut
} from '../lib/utils';

interface PendingApproval {
  id: string;
  email: string;
  name: string;
  requested_at: string;
  status: string;
}

interface ApprovedUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  approved_at: string;
  approved_by: string;
  is_active: boolean;
}

const AdminDashboard: React.FC = () => {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [approvals, users, userData] = await Promise.all([
        getPendingApprovals(),
        getAllApprovedUsers(),
        getUser()
      ]);
      
      setPendingApprovals(approvals || []);
      setApprovedUsers(users || []);
      setCurrentUser(userData.data?.user);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    try {
      if (!currentUser) return;
      
      await approveUser(approvalId, currentUser.id);
      await loadData(); // Reload data
      
      // Show success message
      alert('User approved successfully!');
    } catch (error: any) {
      console.error('Error approving user:', error);
      alert(`Error approving user: ${error.message}`);
    }
  };

  const handleReject = async (approvalId: string) => {
    try {
      if (!currentUser) return;
      
      await rejectUser(approvalId, currentUser.id, rejectNotes);
      setSelectedApproval(null);
      setRejectNotes('');
      await loadData(); // Reload data
      
      // Show success message
      alert('User rejected successfully!');
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      alert(`Error rejecting user: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.reload();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#181818] text-white">
      {/* Header */}
      <div className="bg-[#232323] border-b border-[#373737] px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#E1FF00]">Admin Dashboard</h1>
            <p className="text-neutral-400 text-sm">
              Welcome, {currentUser?.user_metadata?.name || currentUser?.email}
            </p>
          </div>
          <div className="flex space-x-3">
            <a
              href="/"
              className="px-4 py-2 bg-[#373737] hover:bg-[#404040] rounded text-white font-medium transition-colors"
            >
              Go to App
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 py-4 border-b border-[#373737]">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-[#E1FF00] text-[#181818]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Pending Approvals ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'approved'
                ? 'bg-[#E1FF00] text-[#181818]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Approved Users ({approvedUsers.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'pending' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Pending Approval Requests</h2>
            {pendingApprovals.length === 0 ? (
              <div className="text-neutral-400 text-center py-8">
                No pending approval requests
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="bg-[#232323] border border-[#373737] rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{approval.name}</h3>
                        <p className="text-neutral-400">{approval.email}</p>
                        <p className="text-neutral-500 text-sm">
                          Requested: {formatDate(approval.requested_at)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setSelectedApproval(approval.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'approved' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Approved Users</h2>
            {approvedUsers.length === 0 ? (
              <div className="text-neutral-400 text-center py-8">
                No approved users
              </div>
            ) : (
              <div className="space-y-4">
                {approvedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-[#232323] border border-[#373737] rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-lg">{user.name}</h3>
                        <p className="text-neutral-400">{user.email}</p>
                        <p className="text-neutral-500 text-sm">
                          Approved: {formatDate(user.approved_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-600 text-white' 
                            : 'bg-red-600 text-white'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#232323] border border-[#373737] rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Reject User</h3>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Enter rejection reason (optional)"
              className="w-full h-24 p-3 bg-[#181818] border border-[#373737] rounded text-white resize-none"
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => handleReject(selectedApproval)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setSelectedApproval(null);
                  setRejectNotes('');
                }}
                className="px-4 py-2 bg-[#373737] hover:bg-[#404040] rounded text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 