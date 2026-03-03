// SaccoUp Constants and Types

export const IMAGES = {
  heroBanner: 'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073021718_f07f47c8.jpg',
  phoneMockup: 'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073007640_111ce519.jpg',
  community: 'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073099136_188537fe.png',
  featureTransfer: 'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073118203_a0ff782a.jpg',
  featureGrowth: 'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073146955_88237d35.png',
  featureSecurity: 'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073166945_812d1205.png',
  avatars: [
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073048089_07a6d494.png',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073050056_25db0db4.png',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073046697_3301cb55.png',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073043151_56381492.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073063307_3bf70dd2.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073064889_e2051aa3.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073074930_ef58bed0.png',
    'https://d64gsuwffb70l.cloudfront.net/69906d7e0b1ac9e21435296d_1771073076393_ce21c29a.png',
  ],
};

export const COLORS = {
  primary: '#0066CC',
  accent: '#00CC99',
  primaryDark: '#004C99',
  accentDark: '#009973',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
};

export type GroupType = 'savings_club' | 'investment_club' | 'sacco' | 'rosca' | 'hybrid';
export type UserRole = 'member' | 'treasurer' | 'chairperson' | 'admin' | 'super_admin';
export type PaymentMethod = 'mtn_momo' | 'airtel_money' | 'cash' | 'bank_transfer';
export type ContributionStatus = 'pending' | 'confirmed' | 'failed' | 'reconciled';
export type LoanStatus = 'pending' | 'treasurer_approved' | 'approved' | 'disbursed' | 'repaying' | 'completed' | 'defaulted' | 'rejected';

export interface Member {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  national_id?: string;
  kyc_verified: boolean;
  photo_url?: string;
  role: UserRole;
  avatar: string;
  totalContributions: number;
  loanBalance: number;
  savingsBalance: number;
}

export interface Contribution {
  id: string;
  member_name: string;
  member_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: ContributionStatus;
  period_label: string;
  transaction_ref?: string;
  created_at: string;
}

export interface Loan {
  id: string;
  member_name: string;
  member_id: string;
  amount: number;
  interest_rate: number;
  purpose: string;
  repayment_period_months: number;
  status: LoanStatus;
  created_at: string;
  guarantors: string[];
}

export interface Group {
  id: string;
  name: string;
  group_type: GroupType;
  members_count: number;
  total_savings: number;
  contribution_amount: number;
  contribution_schedule: string;
  invite_code: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  is_pinned: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  sender_avatar: string;
  message: string;
  created_at: string;
  is_own: boolean;
}

// Mock data
export const MOCK_MEMBERS: Member[] = [
  { id: '1', full_name: 'Sarah Nakamya', phone: '+256701234567', email: 'sarah@example.com', national_id: 'CM12345678', kyc_verified: true, role: 'admin', avatar: IMAGES.avatars[0], totalContributions: 350000, loanBalance: 0, savingsBalance: 350000 },
  { id: '2', full_name: 'James Ochieng', phone: '+256702345678', email: 'james@example.com', national_id: 'CM23456789', kyc_verified: true, role: 'treasurer', avatar: IMAGES.avatars[4], totalContributions: 300000, loanBalance: 0, savingsBalance: 300000 },
  { id: '3', full_name: 'Grace Auma', phone: '+256703456789', email: 'grace@example.com', national_id: 'CM34567890', kyc_verified: true, role: 'chairperson', avatar: IMAGES.avatars[1], totalContributions: 250000, loanBalance: 0, savingsBalance: 250000 },
  { id: '4', full_name: 'Peter Mugisha', phone: '+256704567890', email: 'peter@example.com', national_id: 'CM45678901', kyc_verified: true, role: 'member', avatar: IMAGES.avatars[5], totalContributions: 200000, loanBalance: 200000, savingsBalance: 200000 },
  { id: '5', full_name: 'Florence Nambi', phone: '+256705678901', email: 'florence@example.com', national_id: 'CM56789012', kyc_verified: false, role: 'member', avatar: IMAGES.avatars[2], totalContributions: 150000, loanBalance: 150000, savingsBalance: 150000 },
  { id: '6', full_name: 'David Ssempijja', phone: '+256706789012', email: 'david@example.com', national_id: 'CM67890123', kyc_verified: true, role: 'member', avatar: IMAGES.avatars[6], totalContributions: 100000, loanBalance: 300000, savingsBalance: 100000 },
  { id: '7', full_name: 'Agnes Nabirye', phone: '+256707890123', email: 'agnes@example.com', national_id: 'CM78901234', kyc_verified: true, role: 'member', avatar: IMAGES.avatars[3], totalContributions: 200000, loanBalance: 100000, savingsBalance: 200000 },
  { id: '8', full_name: 'Robert Kizza', phone: '+256708901234', email: 'robert@example.com', national_id: 'CM89012345', kyc_verified: false, role: 'member', avatar: IMAGES.avatars[7], totalContributions: 50000, loanBalance: 0, savingsBalance: 50000 },
];

export const MOCK_CONTRIBUTIONS: Contribution[] = [
  { id: 'c1', member_name: 'Sarah Nakamya', member_id: '1', amount: 50000, payment_method: 'mtn_momo', status: 'confirmed', period_label: 'Feb 2026', transaction_ref: 'TXN002234', created_at: '2026-02-10' },
  { id: 'c2', member_name: 'James Ochieng', member_id: '2', amount: 50000, payment_method: 'airtel_money', status: 'confirmed', period_label: 'Feb 2026', transaction_ref: 'TXN002235', created_at: '2026-02-11' },
  { id: 'c3', member_name: 'Grace Auma', member_id: '3', amount: 50000, payment_method: 'mtn_momo', status: 'confirmed', period_label: 'Feb 2026', transaction_ref: 'TXN002236', created_at: '2026-02-12' },
  { id: 'c4', member_name: 'Peter Mugisha', member_id: '4', amount: 50000, payment_method: 'mtn_momo', status: 'pending', period_label: 'Feb 2026', transaction_ref: 'TXN002237', created_at: '2026-02-13' },
  { id: 'c5', member_name: 'Florence Nambi', member_id: '5', amount: 50000, payment_method: 'bank_transfer', status: 'pending', period_label: 'Feb 2026', transaction_ref: 'TXN002238', created_at: '2026-02-13' },
  { id: 'c6', member_name: 'David Ssempijja', member_id: '6', amount: 50000, payment_method: 'cash', status: 'confirmed', period_label: 'Feb 2026', created_at: '2026-02-09' },
  { id: 'c7', member_name: 'Agnes Nabirye', member_id: '7', amount: 50000, payment_method: 'mtn_momo', status: 'failed', period_label: 'Feb 2026', transaction_ref: 'TXN002239', created_at: '2026-02-14' },
  { id: 'c8', member_name: 'Robert Kizza', member_id: '8', amount: 50000, payment_method: 'mtn_momo', status: 'confirmed', period_label: 'Jan 2026', transaction_ref: 'TXN001238', created_at: '2026-01-19' },
  { id: 'c9', member_name: 'Sarah Nakamya', member_id: '1', amount: 50000, payment_method: 'mtn_momo', status: 'confirmed', period_label: 'Jan 2026', transaction_ref: 'TXN001234', created_at: '2026-01-15' },
  { id: 'c10', member_name: 'James Ochieng', member_id: '2', amount: 50000, payment_method: 'airtel_money', status: 'confirmed', period_label: 'Jan 2026', transaction_ref: 'TXN001235', created_at: '2026-01-15' },
];

export const MOCK_LOANS: Loan[] = [
  { id: 'l1', member_name: 'Peter Mugisha', member_id: '4', amount: 200000, interest_rate: 5, purpose: 'Business expansion - poultry farming', repayment_period_months: 6, status: 'disbursed', created_at: '2026-01-20', guarantors: ['Sarah Nakamya', 'James Ochieng'] },
  { id: 'l2', member_name: 'Florence Nambi', member_id: '5', amount: 150000, interest_rate: 5, purpose: 'School fees for children', repayment_period_months: 3, status: 'approved', created_at: '2026-02-01', guarantors: ['Grace Auma'] },
  { id: 'l3', member_name: 'David Ssempijja', member_id: '6', amount: 300000, interest_rate: 5, purpose: 'Purchase of market stall', repayment_period_months: 12, status: 'pending', created_at: '2026-02-10', guarantors: ['Peter Mugisha', 'Agnes Nabirye'] },
  { id: 'l4', member_name: 'Agnes Nabirye', member_id: '7', amount: 100000, interest_rate: 5, purpose: 'Medical emergency', repayment_period_months: 2, status: 'repaying', created_at: '2025-12-15', guarantors: ['Robert Kizza'] },
];

export const MOCK_GROUPS: Group[] = [
  { id: 'g1', name: 'Kampala Women Savings Club', group_type: 'savings_club', members_count: 8, total_savings: 1600000, contribution_amount: 50000, contribution_schedule: 'monthly', invite_code: 'KWS2026A' },
  { id: 'g2', name: 'Jinja Investment Club', group_type: 'investment_club', members_count: 15, total_savings: 4500000, contribution_amount: 100000, contribution_schedule: 'monthly', invite_code: 'JIC2026B' },
  { id: 'g3', name: 'Entebbe SACCO', group_type: 'sacco', members_count: 42, total_savings: 12800000, contribution_amount: 25000, contribution_schedule: 'weekly', invite_code: 'ESC2026C' },
  { id: 'g4', name: 'Mbarara Merry-Go-Round', group_type: 'rosca', members_count: 12, total_savings: 960000, contribution_amount: 30000, contribution_schedule: 'weekly', invite_code: 'MMG2026D' },
  { id: 'g5', name: 'Gulu Hybrid Cooperative', group_type: 'hybrid', members_count: 85, total_savings: 28500000, contribution_amount: 75000, contribution_schedule: 'monthly', invite_code: 'GHC2026E' },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a1', title: 'February Contributions Due', content: 'Dear members, please ensure your February contributions are made by the 15th. Late payments will attract a fine of UGX 5,000.', author: 'Sarah Nakamya', is_pinned: true, created_at: '2026-02-01' },
  { id: 'a2', title: 'Annual General Meeting', content: 'Our AGM is scheduled for March 1st, 2026 at Kampala Serena Hotel. All members must attend.', author: 'Grace Auma', is_pinned: true, created_at: '2026-02-05' },
  { id: 'a3', title: 'New Loan Policy Update', content: 'The committee has approved a new loan policy effective March 2026. Maximum loan amount increased to UGX 500,000.', author: 'Sarah Nakamya', is_pinned: false, created_at: '2026-02-10' },
];

export const MOCK_CHAT: ChatMessage[] = [
  { id: 'ch1', sender: 'Sarah Nakamya', sender_avatar: IMAGES.avatars[0], message: 'Good morning everyone! Reminder that contributions are due by the 15th.', created_at: '2026-02-14 08:00', is_own: false },
  { id: 'ch2', sender: 'James Ochieng', sender_avatar: IMAGES.avatars[4], message: 'I have already sent mine via Airtel Money. Transaction ref: TXN002235', created_at: '2026-02-14 08:15', is_own: false },
  { id: 'ch3', sender: 'Grace Auma', sender_avatar: IMAGES.avatars[1], message: 'Mine too! Sent via MTN MoMo this morning.', created_at: '2026-02-14 08:30', is_own: false },
  { id: 'ch4', sender: 'You', sender_avatar: IMAGES.avatars[5], message: 'Great to see everyone contributing on time! I will reconcile all payments this evening.', created_at: '2026-02-14 09:00', is_own: true },
  { id: 'ch5', sender: 'Peter Mugisha', sender_avatar: IMAGES.avatars[5], message: 'Can someone help me with the MTN MoMo process? I keep getting an error.', created_at: '2026-02-14 09:30', is_own: false },
  { id: 'ch6', sender: 'Sarah Nakamya', sender_avatar: IMAGES.avatars[0], message: 'Peter, dial *165*3# and follow the prompts. Make sure you have enough balance first.', created_at: '2026-02-14 09:35', is_own: false },
  { id: 'ch7', sender: 'Florence Nambi', sender_avatar: IMAGES.avatars[2], message: 'I will be sending mine via bank transfer today. Will upload the receipt.', created_at: '2026-02-14 10:00', is_own: false },
  { id: 'ch8', sender: 'Agnes Nabirye', sender_avatar: IMAGES.avatars[3], message: 'Has anyone checked the new loan policy? The increased limit is great news!', created_at: '2026-02-14 10:15', is_own: false },
];

export const MONTHLY_DATA = [
  { month: 'Sep', contributions: 320000, loans: 100000, savings: 220000 },
  { month: 'Oct', contributions: 380000, loans: 150000, savings: 450000 },
  { month: 'Nov', contributions: 350000, loans: 200000, savings: 600000 },
  { month: 'Dec', contributions: 400000, loans: 100000, savings: 900000 },
  { month: 'Jan', contributions: 450000, loans: 350000, savings: 1000000 },
  { month: 'Feb', contributions: 300000, loans: 300000, savings: 1000000 },
];

export const formatUGX = (amount: number): string => {
  return `UGX ${amount.toLocaleString()}`;
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'confirmed': case 'approved': case 'completed': case 'disbursed': return 'bg-emerald-100 text-emerald-700';
    case 'pending': case 'treasurer_approved': return 'bg-amber-100 text-amber-700';
    case 'failed': case 'rejected': case 'defaulted': return 'bg-red-100 text-red-700';
    case 'repaying': return 'bg-blue-100 text-blue-700';
    case 'reconciled': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  switch (method) {
    case 'mtn_momo': return 'MTN MoMo';
    case 'airtel_money': return 'Airtel Money';
    case 'cash': return 'Cash';
    case 'bank_transfer': return 'Bank Transfer';
  }
};

export const getRoleColor = (role: UserRole): string => {
  switch (role) {
    case 'admin': return 'bg-purple-100 text-purple-700';
    case 'treasurer': return 'bg-blue-100 text-blue-700';
    case 'chairperson': return 'bg-emerald-100 text-emerald-700';
    case 'member': return 'bg-gray-100 text-gray-600';
    case 'super_admin': return 'bg-red-100 text-red-700';
  }
};

export const getGroupTypeLabel = (type: GroupType): string => {
  switch (type) {
    case 'savings_club': return 'Savings Club';
    case 'investment_club': return 'Investment Club';
    case 'sacco': return 'SACCO';
    case 'rosca': return 'ROSCA';
    case 'hybrid': return 'Hybrid';
  }
};

export const getGroupTypeColor = (type: GroupType): string => {
  switch (type) {
    case 'savings_club': return 'bg-emerald-100 text-emerald-700';
    case 'investment_club': return 'bg-blue-100 text-blue-700';
    case 'sacco': return 'bg-purple-100 text-purple-700';
    case 'rosca': return 'bg-amber-100 text-amber-700';
    case 'hybrid': return 'bg-cyan-100 text-cyan-700';
  }
};
