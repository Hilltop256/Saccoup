import { supabase } from '@/lib/supabase';

// ===== DB HEALTH CHECK =====
// Returns a user-friendly error string if the table is missing, otherwise null
async function checkTable(table: string): Promise<string | null> {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (error && (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || (error as any).status === 404)) {
    return `Database table "${table}" not found. Please run the SQL schema in your Supabase project (see supabase_schema.sql).`;
  }
  return null;
}

// ===== GROUP OPERATIONS =====

export async function createGroup(params: {
  name: string;
  group_type: string;
  contribution_amount?: number;
  contribution_schedule?: string;
  description?: string;
  member_id: string;
  interest_rate?: number;
  late_fee?: number;
  grace_period_days?: number;
}) {
  // Generate a unique 8-char invite code
  const inviteCode = params.name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3)
    .padEnd(3, 'X') + Math.random().toString(36).toUpperCase().substring(2, 7);

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name: params.name,
      group_type: params.group_type,
      contribution_amount: params.contribution_amount || 0,
      contribution_schedule: params.contribution_schedule || 'monthly',
      description: params.description,
      invite_code: inviteCode,
      interest_rate: params.interest_rate || 5,
      late_fee: params.late_fee || 0,
      grace_period_days: params.grace_period_days || 3,
      // created_by omitted: the original groups table has a FK to auth.users
      // which we don't use. We track group creator via group_memberships (role=admin) instead.
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      throw new Error('Database not set up yet. Please run the SQL schema in your Supabase project dashboard.');
    }
    throw new Error(error.message);
  }

  // Auto-add creator as admin
  await supabase.from('group_memberships').insert({
    group_id: group.id,
    member_id: params.member_id,
    role: 'admin',
    is_active: true,
  });

  return { success: true, group };
}

export async function listGroups(member_id: string) {
  const { data, error } = await supabase
    .from('group_memberships')
    .select('group_id, role, groups(*)')
    .eq('member_id', member_id)
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return { success: true, groups: (data || []).map((r: any) => ({ ...r.groups, user_role: r.role })) };
}

export async function getGroupStats(group_id: string) {
  const [membersRes, membersCountRes, contribRes, loansRes] = await Promise.all([
    // head:true count (fast but may be blocked by some RLS configs)
    supabase.from('group_memberships').select('*', { count: 'exact', head: true }).eq('group_id', group_id).eq('is_active', true),
    // also fetch member_id list so we can count rows directly as a reliable fallback
    supabase.from('group_memberships').select('member_id').eq('group_id', group_id).eq('is_active', true),
    supabase.from('contributions').select('amount, status').eq('group_id', group_id),
    supabase.from('loans').select('amount, status').eq('group_id', group_id),
  ]);

  const contributions = contribRes.data || [];
  const loans = loansRes.data || [];

  const totalContributions = contributions.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const confirmedContributions = contributions.filter((c: any) => c.status === 'confirmed').reduce((s: number, c: any) => s + Number(c.amount), 0);
  const pendingContributions = contributions.filter((c: any) => c.status === 'pending').length;
  const failedContributions = contributions.filter((c: any) => c.status === 'failed').length;
  const confirmedCount = contributions.filter((c: any) => c.status === 'confirmed').length;
  // Use whichever count is larger (head count vs actual row count) for accuracy
  const memberCount = Math.max(membersRes.count || 0, (membersCountRes.data || []).length);
  const totalLoansOutstanding = loans
    .filter((l: any) => ['disbursed', 'repaying'].includes(l.status))
    .reduce((s: number, l: any) => s + Number(l.amount), 0);
  const pendingLoans = loans.filter((l: any) => ['pending', 'treasurer_approved'].includes(l.status)).length;
  const collectionRate = memberCount > 0 ? (confirmedCount / memberCount) * 100 : 0;

  return {
    success: true,
    stats: {
      member_count: memberCount,
      total_savings: confirmedContributions,
      total_contributions: totalContributions,
      confirmed_contributions: confirmedCount,
      pending_contributions: pendingContributions,
      failed_contributions: failedContributions,
      total_loans_outstanding: totalLoansOutstanding,
      pending_loans: pendingLoans,
      collection_rate: collectionRate,
    },
  };
}

export async function joinGroupByInviteCode(invite_code: string, member_id: string) {
  const { data: group, error: grpErr } = await supabase
    .from('groups')
    .select('id, name, is_active')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .maybeSingle();

  if (grpErr || !group) return { success: false, error: 'Invalid invite code. Please check and try again.' };
  if (!group.is_active) return { success: false, error: 'This group is no longer active.' };

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_memberships')
    .select('id, is_active')
    .eq('group_id', group.id)
    .eq('member_id', member_id)
    .maybeSingle();

  if (existing?.is_active) return { success: false, error: 'You are already a member of this group.' };

  if (existing && !existing.is_active) {
    // Re-activate
    await supabase.from('group_memberships').update({ is_active: true }).eq('id', existing.id);
  } else {
    await supabase.from('group_memberships').insert({
      group_id: group.id,
      member_id,
      role: 'member',
      is_active: true,
    });
  }

  return { success: true, group };
}

// ===== MEMBER OPERATIONS =====

// Local phone normalizer (avoids circular import from AppContext)
function normalizePhone(ph: string): string {
  let c = ph.replace(/[\s\-()]/g, '');
  if (c.startsWith('0')) c = '+256' + c.substring(1);
  else if (c.startsWith('256') && !c.startsWith('+')) c = '+' + c;
  else if (!c.startsWith('+')) c = '+256' + c;
  return c;
}

export async function addMemberToGroup(params: {
  group_id: string;
  full_name: string;
  phone: string;
  email?: string;
  national_id?: string;
  role?: string;
  added_by?: string;
}) {
  const normalizedPhone = normalizePhone(params.phone);

  // Check if member already exists by phone
  let { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (!member) {
    const { data: newMember, error } = await supabase
      .from('members')
      .insert({
        full_name: params.full_name,
        phone: normalizedPhone,
        email: params.email,
        national_id: params.national_id,
        kyc_verified: false,
        is_active: true,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    member = newMember;
  }

  // Check if already a group member
  const { data: existing } = await supabase
    .from('group_memberships')
    .select('id, is_active')
    .eq('group_id', params.group_id)
    .eq('member_id', member!.id)
    .maybeSingle();

  if (existing?.is_active) throw new Error('This member is already in the group.');

  if (existing) {
    await supabase.from('group_memberships').update({ is_active: true, role: params.role || 'member' }).eq('id', existing.id);
  } else {
    const { error } = await supabase.from('group_memberships').insert({
      group_id: params.group_id,
      member_id: member!.id,
      role: params.role || 'member',
      is_active: true,
    });
    if (error) throw new Error(error.message);
  }

  if (params.added_by) {
    await supabase.from('audit_logs').insert({
      actor_id: params.added_by,
      action: 'add_member',
      entity_type: 'group_membership',
      entity_id: params.group_id,
      details: { phone: normalizedPhone, full_name: params.full_name, role: params.role || 'member' },
    });
  }

  return { success: true };
}

export async function listMembers(group_id: string) {
  const { data, error } = await supabase
    .from('group_memberships')
    .select(`
      member_id,
      role,
      members (
        id,
        full_name,
        phone,
        email,
        national_id,
        kyc_verified,
        photo_url
      )
    `)
    .eq('group_id', group_id)
    .eq('is_active', true);

  if (error) throw new Error(error.message);

  const members = await Promise.all(
    (data || []).map(async (row: any) => {
      const m = row.members;
      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount')
        .eq('group_id', group_id)
        .eq('member_id', m.id)
        .eq('status', 'confirmed');
      const totalContributions = (contribs || []).reduce((s: number, c: any) => s + Number(c.amount), 0);

      const { data: activeLoans } = await supabase
        .from('loans')
        .select('amount')
        .eq('group_id', group_id)
        .eq('member_id', m.id)
        .in('status', ['disbursed', 'repaying']);
      const loanBalance = (activeLoans || []).reduce((s: number, l: any) => s + Number(l.amount), 0);

      return {
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        email: m.email,
        national_id: m.national_id,
        kyc_verified: m.kyc_verified,
        photo_url: m.photo_url,
        role: row.role,
        totalContributions,
        savingsBalance: totalContributions,
        loanBalance,
      };
    })
  );

  return { success: true, members };
}

export async function removeMember(group_id: string, member_id: string, removed_by?: string) {
  const { error } = await supabase
    .from('group_memberships')
    .update({ is_active: false })
    .eq('group_id', group_id)
    .eq('member_id', member_id);

  if (error) throw new Error(error.message);

  if (removed_by) {
    await supabase.from('audit_logs').insert({
      actor_id: removed_by,
      action: 'remove_member',
      entity_type: 'group_membership',
      entity_id: group_id,
      details: { member_id },
    });
  }

  return { success: true };
}

export async function updateMemberRole(group_id: string, member_id: string, new_role: string) {
  const { error } = await supabase
    .from('group_memberships')
    .update({ role: new_role })
    .eq('group_id', group_id)
    .eq('member_id', member_id);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ===== CONTRIBUTION OPERATIONS =====

export async function recordContribution(params: {
  group_id: string;
  member_id: string;
  amount: number;
  payment_method: string;
  transaction_ref?: string;
  period_label?: string;
  recorded_by?: string;
  notes?: string;
}) {
  // Fetch member name for denormalization
  const { data: member } = await supabase
    .from('members')
    .select('full_name, phone')
    .eq('id', params.member_id)
    .single();

  const { data, error } = await supabase
    .from('contributions')
    .insert({
      group_id: params.group_id,
      member_id: params.member_id,
      member_name: member?.full_name || 'Unknown',
      amount: params.amount,
      payment_method: params.payment_method,
      transaction_ref: params.transaction_ref,
      period_label: params.period_label,
      notes: params.notes,
      status: params.payment_method === 'cash' ? 'confirmed' : 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  if (params.recorded_by) {
    await supabase.from('audit_logs').insert({
      actor_id: params.recorded_by,
      action: 'record_contribution',
      entity_type: 'contribution',
      entity_id: data.id,
      details: { amount: params.amount, method: params.payment_method, member_id: params.member_id },
    });
  }

  return { success: true, contribution: data };
}

export async function listContributions(group_id: string, filters?: { member_id?: string; status?: string; limit?: number }) {
  let query = supabase
    .from('contributions')
    .select('*')
    .eq('group_id', group_id)
    .order('created_at', { ascending: false });

  if (filters?.member_id) query = query.eq('member_id', filters.member_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return { success: true, contributions: data || [] };
}

export async function updateContributionStatus(contribution_id: string, new_status: string, updated_by?: string) {
  const { error } = await supabase
    .from('contributions')
    .update({ status: new_status, updated_at: new Date().toISOString() })
    .eq('id', contribution_id);

  if (error) throw new Error(error.message);

  if (updated_by) {
    await supabase.from('audit_logs').insert({
      actor_id: updated_by,
      action: 'update_contribution_status',
      entity_type: 'contribution',
      entity_id: contribution_id,
      details: { new_status },
    });
  }

  return { success: true };
}

// ===== MOBILE MONEY PAYMENT INITIATION (Uganda: MTN MoMo & Airtel Money) =====

export async function initiateMoMoPayment(params: {
  group_id: string;
  member_id: string;
  phone: string;
  amount: number;
  period_label: string;
  provider: 'mtn_momo' | 'airtel_money';
  recorded_by?: string;
}) {
  // Create a pending contribution record first
  const { data: member } = await supabase
    .from('members')
    .select('full_name')
    .eq('id', params.member_id)
    .single();

  const { data: contrib, error } = await supabase
    .from('contributions')
    .insert({
      group_id: params.group_id,
      member_id: params.member_id,
      member_name: member?.full_name || 'Unknown',
      amount: params.amount,
      payment_method: params.provider,
      period_label: params.period_label,
      status: 'pending',
      notes: `Mobile money payment initiated for ${params.phone}`,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // In production this would call the MTN MoMo API or Airtel Money API
  // For now we return the contribution ID for tracking
  // MTN MoMo Uganda: Uses MTN MoMo Collections API (OAuth2 + STK Push)
  // Airtel Money Uganda: Uses Airtel Money API (OAuth2 + Debit Request)
  return {
    success: true,
    contribution_id: contrib.id,
    message: `Payment request sent to ${params.phone}. Please approve the prompt on your phone.`,
    // In production: external_reference from MTN/Airtel API
  };
}

// ===== LOAN OPERATIONS =====

export async function applyLoan(params: {
  group_id: string;
  member_id: string;
  amount: number;
  purpose: string;
  repayment_period_months?: number;
  guarantor_ids?: string[];
  interest_rate?: number;
}) {
  // Fetch member name
  const { data: member } = await supabase
    .from('members')
    .select('full_name')
    .eq('id', params.member_id)
    .single();

  // Fetch guarantor names
  let guarantorNames: string[] = [];
  if (params.guarantor_ids && params.guarantor_ids.length > 0) {
    const { data: guarantors } = await supabase
      .from('members')
      .select('full_name')
      .in('id', params.guarantor_ids);
    guarantorNames = (guarantors || []).map((g: any) => g.full_name);
  }

  // Get group interest rate
  const { data: group } = await supabase.from('groups').select('interest_rate').eq('id', params.group_id).single();

  const { data, error } = await supabase
    .from('loans')
    .insert({
      group_id: params.group_id,
      member_id: params.member_id,
      member_name: member?.full_name || 'Unknown',
      amount: params.amount,
      purpose: params.purpose,
      repayment_period_months: params.repayment_period_months || 6,
      interest_rate: params.interest_rate || group?.interest_rate || 5,
      guarantors: guarantorNames,
      guarantor_ids: params.guarantor_ids || [],
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, loan: data };
}

export async function listLoans(group_id: string, status?: string) {
  let query = supabase
    .from('loans')
    .select('*')
    .eq('group_id', group_id)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return { success: true, loans: data || [] };
}

export async function updateLoanStatus(loan_id: string, new_status: string, approved_by?: string) {
  const updateData: Record<string, any> = {
    status: new_status,
    updated_at: new Date().toISOString(),
  };

  if (new_status === 'approved') updateData.approved_at = new Date().toISOString();
  if (new_status === 'disbursed') updateData.disbursed_at = new Date().toISOString();

  const { error } = await supabase.from('loans').update(updateData).eq('id', loan_id);
  if (error) throw new Error(error.message);

  if (approved_by) {
    await supabase.from('audit_logs').insert({
      actor_id: approved_by,
      action: `loan_${new_status}`,
      entity_type: 'loan',
      entity_id: loan_id,
      details: { new_status },
    });
  }

  return { success: true };
}

// ===== ANNOUNCEMENT OPERATIONS =====

export async function createAnnouncement(params: {
  group_id: string;
  author_id?: string;
  author_name?: string;
  title: string;
  content: string;
  is_pinned?: boolean;
}) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      group_id: params.group_id,
      author_id: params.author_id,
      author: params.author_name || 'Admin',
      title: params.title,
      content: params.content,
      is_pinned: params.is_pinned || false,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, announcement: data };
}

export async function listAnnouncements(group_id: string) {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('group_id', group_id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return { success: true, announcements: data || [] };
}

export async function deleteAnnouncement(announcement_id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', announcement_id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ===== CHAT OPERATIONS =====

export async function sendMessage(group_id: string, sender_id: string, message: string) {
  const { data: member } = await supabase.from('members').select('full_name, photo_url').eq('id', sender_id).single();

  const { data, error } = await supabase
    .from('messages')
    .insert({
      group_id,
      sender_id,
      sender_name: member?.full_name || 'Unknown',
      sender_photo: member?.photo_url,
      message,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, message: data };
}

export async function listMessages(group_id: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('group_id', group_id)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return { success: true, messages: data || [] };
}

// ===== ROSCA (Merry-Go-Round) OPERATIONS ================================

export interface RoscaCycleRow {
  id: string;
  group_id: string;
  cycle_number: number;
  cycle_name: string;
  status: 'upcoming' | 'active' | 'completed';
  start_date: string;
  end_date: string | null;
  total_draws: number;
  pot_amount_per_draw: number;
  member_count: number;
  security_deposit: number;
  notes: string | null;
}

export interface RoscaDrawRow {
  id: string;
  cycle_id: string;
  draw_number: number;
  winner_slot: '1' | '2';
  winner_name: string | null;
  winner_id: string | null;
  amount_received: number;
  draw_date: string;
  savings: number | null;
  paid_out: number | null;
  deductions: number | null;
  balance: number | null;
  status: 'pending' | 'won' | 'skipped' | 'forfeited';
  notes: string | null;
}

export async function listRoscaCycles(group_id: string) {
  const { data, error } = await supabase
    .from('rosca_cycles')
    .select('*')
    .eq('group_id', group_id)
    .order('cycle_number', { ascending: true });

  if (error) throw new Error(error.message);
  return { success: true, cycles: data || [] };
}

export async function getRoscaCycle(cycle_id: string) {
  const { data, error } = await supabase
    .from('rosca_cycles')
    .select('*')
    .eq('id', cycle_id)
    .single();

  if (error) throw new Error(error.message);
  return { success: true, cycle: data };
}

export async function createRoscaCycle(params: {
  group_id: string;
  cycle_number: number;
  cycle_name: string;
  status?: 'upcoming' | 'active' | 'completed';
  start_date: string;
  end_date?: string;
  total_draws?: number;
  pot_amount_per_draw?: number;
  member_count?: number;
  security_deposit?: number;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('rosca_cycles')
    .insert({
      group_id: params.group_id,
      cycle_number: params.cycle_number,
      cycle_name: params.cycle_name,
      status: params.status || 'upcoming',
      start_date: params.start_date,
      end_date: params.end_date || null,
      total_draws: params.total_draws || 10,
      pot_amount_per_draw: params.pot_amount_per_draw || 5000000,
      member_count: params.member_count || 20,
      security_deposit: params.security_deposit || 0,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { success: true, cycle: data };
}

export async function updateRoscaCycle(cycle_id: string, updates: Partial<RoscaCycleRow>) {
  const { error } = await supabase
    .from('rosca_cycles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', cycle_id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function listRoscaDraws(cycle_id: string) {
  const { data, error } = await supabase
    .from('rosca_draws')
    .select('*')
    .eq('cycle_id', cycle_id)
    .order('draw_number', { ascending: true })
    .order('winner_slot', { ascending: true });

  if (error) throw new Error(error.message);
  return { success: true, draws: data || [] };
}

export async function createRoscaDraw(params: {
  cycle_id: string;
  draw_number: number;
  winner_slot: '1' | '2';
  winner_name?: string;
  winner_id?: string;
  amount_received?: number;
  draw_date?: string;
  savings?: number;
  paid_out?: number;
  deductions?: number;
  balance?: number;
  status?: 'pending' | 'won' | 'skipped' | 'forfeited';
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('rosca_draws')
    .insert({
      cycle_id: params.cycle_id,
      draw_number: params.draw_number,
      winner_slot: params.winner_slot,
      winner_name: params.winner_name || null,
      winner_id: params.winner_id || null,
      amount_received: params.amount_received || 5000000,
      draw_date: params.draw_date || new Date().toISOString().split('T')[0],
      savings: params.savings || null,
      paid_out: params.paid_out || null,
      deductions: params.deductions || null,
      balance: params.balance || null,
      status: params.status || 'pending',
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { success: true, draw: data };
}

export async function updateRoscaDraw(draw_id: string, updates: Partial<RoscaDrawRow>) {
  const { error } = await supabase
    .from('rosca_draws')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', draw_id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteRoscaDraw(draw_id: string) {
  const { error } = await supabase
    .from('rosca_draws')
    .delete()
    .eq('id', draw_id);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ===== ROSCA MONTHLY CONTRIBUTIONS ===========================================

export interface RoscaMonthlyContribRow {
  id: string;
  cycle_id: string;
  group_id: string;
  draw_number: number;
  draw_date: string;
  member_id: string;
  member_name: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  payment_method: string;
  transaction_ref: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** List all monthly contributions for a given cycle (optionally filtered by draw_number) */
export async function listRoscaMonthlyContributions(
  cycle_id: string,
  draw_number?: number
) {
  let query = supabase
    .from('rosca_monthly_contributions')
    .select('*')
    .eq('cycle_id', cycle_id)
    .order('draw_number', { ascending: true })
    .order('member_name',  { ascending: true });

  if (draw_number !== undefined) query = query.eq('draw_number', draw_number);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { success: true, contributions: (data || []) as RoscaMonthlyContribRow[] };
}

/** Upsert (insert or update) a single member's monthly contribution for a draw */
export async function upsertRoscaMonthlyContribution(params: {
  cycle_id: string;
  group_id: string;
  draw_number: number;
  draw_date: string;
  member_id: string;
  member_name: string;
  amount?: number;
  status?: 'pending' | 'confirmed' | 'failed';
  payment_method?: string;
  transaction_ref?: string;
  notes?: string;
  recorded_by?: string;
}) {
  const { data, error } = await supabase
    .from('rosca_monthly_contributions')
    .upsert(
      {
        cycle_id:        params.cycle_id,
        group_id:        params.group_id,
        draw_number:     params.draw_number,
        draw_date:       params.draw_date,
        member_id:       params.member_id,
        member_name:     params.member_name,
        amount:          params.amount ?? 250000,
        status:          params.status ?? 'pending',
        payment_method:  params.payment_method ?? 'cash',
        transaction_ref: params.transaction_ref ?? null,
        notes:           params.notes ?? null,
        recorded_by:     params.recorded_by ?? null,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'cycle_id,draw_number,member_id' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { success: true, contribution: data };
}

/** Bulk-seed empty "pending" rows for every member in a draw (idempotent) */
export async function seedRoscaMonthlyContributions(params: {
  cycle_id: string;
  group_id: string;
  draw_number: number;
  draw_date: string;
  members: { id: string; full_name: string }[];
  amount?: number;
}) {
  const rows = params.members.map(m => ({
    cycle_id:    params.cycle_id,
    group_id:    params.group_id,
    draw_number: params.draw_number,
    draw_date:   params.draw_date,
    member_id:   m.id,
    member_name: m.full_name,
    amount:      params.amount ?? 250000,
    status:      'pending' as const,
    payment_method: 'cash',
  }));

  const { error } = await supabase
    .from('rosca_monthly_contributions')
    .upsert(rows, { onConflict: 'cycle_id,draw_number,member_id', ignoreDuplicates: true });

  if (error) throw new Error(error.message);
  return { success: true };
}

// ===== WELFARE CONTRIBUTIONS =================================================

export interface WelfareContribRow {
  id: string;
  cycle_id: string;
  group_id: string;
  draw_number: number;
  draw_date: string;
  member_id: string;
  member_name: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  payment_method: string;
  transaction_ref: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** List all welfare contributions for a cycle (optionally filtered by draw_number) */
export async function listWelfareContributions(
  cycle_id: string,
  draw_number?: number
) {
  let query = supabase
    .from('welfare_contributions')
    .select('*')
    .eq('cycle_id', cycle_id)
    .order('draw_number', { ascending: true })
    .order('member_name',  { ascending: true });

  if (draw_number !== undefined) query = query.eq('draw_number', draw_number);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { success: true, contributions: (data || []) as WelfareContribRow[] };
}

/** Upsert a single member's welfare contribution for a draw */
export async function upsertWelfareContribution(params: {
  cycle_id: string;
  group_id: string;
  draw_number: number;
  draw_date: string;
  member_id: string;
  member_name: string;
  amount?: number;
  status?: 'pending' | 'confirmed' | 'failed';
  payment_method?: string;
  transaction_ref?: string;
  notes?: string;
  recorded_by?: string;
}) {
  const { data, error } = await supabase
    .from('welfare_contributions')
    .upsert(
      {
        cycle_id:        params.cycle_id,
        group_id:        params.group_id,
        draw_number:     params.draw_number,
        draw_date:       params.draw_date,
        member_id:       params.member_id,
        member_name:     params.member_name,
        amount:          params.amount ?? 50000,
        status:          params.status ?? 'pending',
        payment_method:  params.payment_method ?? 'cash',
        transaction_ref: params.transaction_ref ?? null,
        notes:           params.notes ?? null,
        recorded_by:     params.recorded_by ?? null,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'cycle_id,draw_number,member_id' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { success: true, contribution: data };
}

/** Bulk-seed empty "pending" welfare rows for every member in a draw (idempotent) */
export async function seedWelfareContributions(params: {
  cycle_id: string;
  group_id: string;
  draw_number: number;
  draw_date: string;
  members: { id: string; full_name: string }[];
}) {
  const rows = params.members.map(m => ({
    cycle_id:    params.cycle_id,
    group_id:    params.group_id,
    draw_number: params.draw_number,
    draw_date:   params.draw_date,
    member_id:   m.id,
    member_name: m.full_name,
    amount:      50000,
    status:      'pending' as const,
    payment_method: 'cash',
  }));

  const { error } = await supabase
    .from('welfare_contributions')
    .upsert(rows, { onConflict: 'cycle_id,draw_number,member_id', ignoreDuplicates: true });

  if (error) throw new Error(error.message);
  return { success: true };
}
