import React, { useState, useEffect } from 'react';
import { 
  getPendingApprovals, 
  approveUser, 
  rejectUser, 
  getAllApprovedUsers,
  getUser,
  signOut,
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addUserToGroup,
  removeUserFromGroup
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

interface UserGroup {
  id: string;
  name: string;
  description: string;
  image_limit: number;
  video_limit: number;
  created_at: string;
  created_by: string;
  member_count: number;
  image_usage: number;
  video_usage: number;
  image_remaining: number;
  video_remaining: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
  approved_users: {
    id: string;
    user_id: string;
    email: string;
    name: string;
    is_active: boolean;
  };
}

const AdminDashboard: React.FC = () => {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'tokens'>('pending');
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  
  // Group management states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: '',
    imageLimit: 100,
    videoLimit: 50
  });

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
      
      // Load groups if user is available
      if (userData.data?.user) {
        try {
          const groupsResult = await getGroups(userData.data.user.id);
          setUserGroups(groupsResult.data || []);
        } catch (error) {
          console.error('Error loading groups:', error);
        }
      }
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

  // Group management functions
  const handleCreateGroup = async () => {
    try {
      if (!currentUser) return;
      
      await createGroup(currentUser.id, newGroupData);
      await loadData(); // Reload data
      setShowCreateGroupModal(false);
      setNewGroupData({ name: '', description: '', imageLimit: 100, videoLimit: 50 });
      alert('Group created successfully!');
    } catch (error: any) {
      console.error('Error creating group:', error);
      alert(`Error creating group: ${error.message}`);
    }
  };

  const handleUpdateGroup = async () => {
    try {
      if (!currentUser || !selectedGroup) return;
      
      await updateGroup(currentUser.id, selectedGroup.id, {
        name: newGroupData.name,
        description: newGroupData.description,
        imageLimit: newGroupData.imageLimit,
        videoLimit: newGroupData.videoLimit
      });
      await loadData(); // Reload data
      setShowEditGroupModal(false);
      setSelectedGroup(null);
      alert('Group updated successfully!');
    } catch (error: any) {
      console.error('Error updating group:', error);
      alert(`Error updating group: ${error.message}`);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This will remove all members and usage data.')) {
      return;
    }

    try {
      if (!currentUser) return;
      
      await deleteGroup(currentUser.id, groupId);
      await loadData(); // Reload data
      alert('Group deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting group:', error);
      alert(`Error deleting group: ${error.message}`);
    }
  };

  const handleManageMembers = async (group: UserGroup) => {
    try {
      if (!currentUser) return;
      
      const membersResult = await getGroupMembers(currentUser.id, group.id);
      setGroupMembers(membersResult.data || []);
      setSelectedGroup(group);
      setShowManageMembersModal(true);
    } catch (error: any) {
      console.error('Error loading group members:', error);
      alert(`Error loading group members: ${error.message}`);
    }
  };

  const handleAddUserToGroup = async (userId: string) => {
    try {
      if (!currentUser || !selectedGroup) return;
      
      await addUserToGroup(currentUser.id, selectedGroup.id, userId);
      await handleManageMembers(selectedGroup); // Reload members
      alert('User added to group successfully!');
    } catch (error: any) {
      console.error('Error adding user to group:', error);
      alert(`Error adding user to group: ${error.message}`);
    }
  };

  const handleRemoveUserFromGroup = async (userId: string) => {
    try {
      if (!currentUser || !selectedGroup) return;
      
      await removeUserFromGroup(currentUser.id, selectedGroup.id, userId);
      await handleManageMembers(selectedGroup); // Reload members
      alert('User removed from group successfully!');
    } catch (error: any) {
      console.error('Error removing user from group:', error);
      alert(`Error removing user from group: ${error.message}`);
    }
  };

  const openEditGroupModal = (group: UserGroup) => {
    setSelectedGroup(group);
    setNewGroupData({
      name: group.name,
      description: group.description,
      imageLimit: group.image_limit,
      videoLimit: group.video_limit
    });
    setShowEditGroupModal(true);
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
              Main App
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
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'tokens'
                ? 'bg-[#E1FF00] text-[#181818]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Tokens ({userGroups.length})
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

        {activeTab === 'tokens' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Token Management</h2>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="px-4 py-2 bg-[#E1FF00] text-[#181818] rounded font-medium hover:bg-[#D1EF00] transition-colors"
              >
                Create New Group
              </button>
            </div>

            {userGroups.length === 0 ? (
              <div className="text-neutral-400 text-center py-8">
                <p className="text-lg mb-2">No groups created yet</p>
                <p className="text-sm">Create your first group to start managing user tokens and generation limits.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userGroups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-[#232323] border border-[#373737] rounded-lg p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-white">{group.name}</h3>
                        {group.description && (
                          <p className="text-neutral-400 text-sm mt-1">{group.description}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditGroupModal(group)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Member Count */}
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400">Members:</span>
                        <span className="text-white font-medium">{group.member_count}</span>
                      </div>

                      {/* Image Usage */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-neutral-400">Image Generations:</span>
                          <span className="text-white font-medium">
                            {group.image_usage} / {group.image_limit}
                          </span>
                        </div>
                        <div className="w-full bg-[#373737] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              group.image_remaining > 0 ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (group.image_usage / group.image_limit) * 100)}%`
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {group.image_remaining} remaining
                        </div>
                      </div>

                      {/* Video Usage */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-neutral-400">Video Generations:</span>
                          <span className="text-white font-medium">
                            {group.video_usage} / {group.video_limit}
                          </span>
                        </div>
                        <div className="w-full bg-[#373737] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              group.video_remaining > 0 ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (group.video_usage / group.video_limit) * 100)}%`
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {group.video_remaining} remaining
                        </div>
                      </div>

                      {/* Manage Members Button */}
                      <button
                        onClick={() => handleManageMembers(group)}
                        className="w-full mt-4 px-4 py-2 bg-[#373737] hover:bg-[#404040] rounded text-white font-medium transition-colors"
                      >
                        Manage Members
                      </button>
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

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#232323] border border-[#373737] rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create New Group</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Group Name</label>
                <input
                  type="text"
                  value={newGroupData.name}
                  onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                  className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white"
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Description (Optional)</label>
                <textarea
                  value={newGroupData.description}
                  onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                  className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white resize-none h-20"
                  placeholder="Enter group description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Image Limit</label>
                  <input
                    type="number"
                    value={newGroupData.imageLimit}
                    onChange={(e) => setNewGroupData({ ...newGroupData, imageLimit: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Video Limit</label>
                  <input
                    type="number"
                    value={newGroupData.videoLimit}
                    onChange={(e) => setNewGroupData({ ...newGroupData, videoLimit: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white"
                    min="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-[#E1FF00] text-[#181818] rounded font-medium hover:bg-[#D1EF00] transition-colors"
              >
                Create Group
              </button>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupData({ name: '', description: '', imageLimit: 100, videoLimit: 50 });
                }}
                className="px-4 py-2 bg-[#373737] hover:bg-[#404040] rounded text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#232323] border border-[#373737] rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Edit Group</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Group Name</label>
                <input
                  type="text"
                  value={newGroupData.name}
                  onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                  className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white"
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Description (Optional)</label>
                <textarea
                  value={newGroupData.description}
                  onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                  className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white resize-none h-20"
                  placeholder="Enter group description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Image Limit</label>
                  <input
                    type="number"
                    value={newGroupData.imageLimit}
                    onChange={(e) => setNewGroupData({ ...newGroupData, imageLimit: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Video Limit</label>
                  <input
                    type="number"
                    value={newGroupData.videoLimit}
                    onChange={(e) => setNewGroupData({ ...newGroupData, videoLimit: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 bg-[#181818] border border-[#373737] rounded text-white"
                    min="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleUpdateGroup}
                className="px-4 py-2 bg-[#E1FF00] text-[#181818] rounded font-medium hover:bg-[#D1EF00] transition-colors"
              >
                Update Group
              </button>
              <button
                onClick={() => {
                  setShowEditGroupModal(false);
                  setSelectedGroup(null);
                }}
                className="px-4 py-2 bg-[#373737] hover:bg-[#404040] rounded text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {showManageMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#232323] border border-[#373737] rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Manage Members - {selectedGroup.name}</h3>
              <button
                onClick={() => {
                  setShowManageMembersModal(false);
                  setSelectedGroup(null);
                  setGroupMembers([]);
                }}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Current Members */}
            <div className="mb-6">
              <h4 className="text-md font-medium mb-3">Current Members ({groupMembers.length})</h4>
              {groupMembers.length === 0 ? (
                <div className="text-neutral-400 text-center py-4">
                  No members in this group
                </div>
              ) : (
                <div className="space-y-2">
                  {groupMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex justify-between items-center bg-[#181818] border border-[#373737] rounded p-3"
                    >
                      <div>
                        <p className="text-white font-medium">{member.approved_users.name}</p>
                        <p className="text-neutral-400 text-sm">{member.approved_users.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveUserFromGroup(member.approved_users.user_id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Users */}
            <div>
              <h4 className="text-md font-medium mb-3">Add New Members</h4>
              {approvedUsers.length === 0 ? (
                <div className="text-neutral-400 text-center py-4">
                  No approved users available
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedUsers
                    .filter(user => !groupMembers.some(member => member.approved_users.user_id === user.user_id))
                    .map((user) => (
                      <div
                        key={user.id}
                        className="flex justify-between items-center bg-[#181818] border border-[#373737] rounded p-3"
                      >
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-neutral-400 text-sm">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handleAddUserToGroup(user.user_id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-sm transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 