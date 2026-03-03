import { supabase } from '@/lib/supabase';

// Generic edge function caller
async function callGroupOps(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('group-operations', {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || 'Edge function error');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ===== GROUP OPERATIONS =====

export async function createGroup(params: {
  name: string; group_type: string; contribution_amount?: number;
  contribution_schedule?: string; description?: string; member_id: string;
  interest_rate?: number; late_fee?: number; grace_period_days?: number;
}) {
  return callGroupOps('create_group', params);
}

export async function listGroups(member_id: string) {
  return callGroupOps('list_groups', { member_id });
}

export async function getGroupStats(group_id: string) {
  return callGroupOps('get_group_stats', { group_id });
}

// ===== MEMBER OPERATIONS =====

export async function addMemberToGroup(params: {
  group_id: string; full_name: string; phone: string;
  email?: string; national_id?: string; role?: string; added_by?: string;
}) {
  return callGroupOps('add_member_to_group', params);
}

export async function listMembers(group_id: string) {
  return callGroupOps('list_members', { group_id });
}

export async function removeMember(group_id: string, member_id: string, removed_by?: string) {
  return callGroupOps('remove_member', { group_id, member_id, removed_by });
}

export async function updateMemberRole(group_id: string, member_id: string, new_role: string) {
  return callGroupOps('update_member_role', { group_id, member_id, new_role });
}

// ===== CONTRIBUTION OPERATIONS =====

export async function recordContribution(params: {
  group_id: string; member_id: string; amount: number;
  payment_method: string; transaction_ref?: string;
  period_label?: string; recorded_by?: string; notes?: string;
}) {
  return callGroupOps('record_contribution', params);
}

export async function listContributions(group_id: string, filters?: { member_id?: string; status?: string; limit?: number }) {
  return callGroupOps('list_contributions', { group_id, ...filters });
}

export async function updateContributionStatus(contribution_id: string, new_status: string, updated_by?: string) {
  return callGroupOps('update_contribution_status', { contribution_id, new_status, updated_by });
}

// ===== LOAN OPERATIONS =====

export async function applyLoan(params: {
  group_id: string; member_id: string; amount: number;
  purpose: string; repayment_period_months?: number;
  guarantor_ids?: string[]; interest_rate?: number;
}) {
  return callGroupOps('apply_loan', params);
}

export async function listLoans(group_id: string, status?: string) {
  return callGroupOps('list_loans', { group_id, status });
}

export async function updateLoanStatus(loan_id: string, new_status: string, approved_by?: string) {
  return callGroupOps('update_loan_status', { loan_id, new_status, approved_by });
}

// ===== ANNOUNCEMENT OPERATIONS =====

export async function createAnnouncement(params: {
  group_id: string; author_id?: string; author_name?: string;
  title: string; content: string; is_pinned?: boolean;
}) {
  return callGroupOps('create_announcement', params);
}

export async function listAnnouncements(group_id: string) {
  return callGroupOps('list_announcements', { group_id });
}

export async function deleteAnnouncement(announcement_id: string) {
  return callGroupOps('delete_announcement', { announcement_id });
}

// ===== CHAT OPERATIONS =====

export async function sendMessage(group_id: string, sender_id: string, message: string) {
  return callGroupOps('send_message', { group_id, sender_id, message });
}

export async function listMessages(group_id: string, limit?: number) {
  return callGroupOps('list_messages', { group_id, limit });
}
