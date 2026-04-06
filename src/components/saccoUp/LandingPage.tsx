import React, { useState } from 'react';
import { IMAGES, formatUGX } from '@/lib/constants';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [email, setEmail] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { title: 'Mobile Money Integration', desc: 'Seamless MTN MoMo & Airtel Money payments with auto-reconciliation', icon: IMAGES.featureTransfer },
    { title: 'Savings Growth Tracking', desc: 'Watch your group savings grow with real-time dashboards and interest accrual', icon: IMAGES.featureGrowth },
    { title: 'Bank-Level Security', desc: 'End-to-end encryption, 2FA, and role-based access control for every transaction', icon: IMAGES.featureSecurity },
  ];

  const groupTypes = [
    { name: 'Savings Clubs', desc: 'Regular contributions with interest accrual. Perfect for community savings groups.', icon: (
      <svg className="w-10 h-10 text-[#0066CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
    )},
    { name: 'Investment Clubs', desc: 'Pool funds for collective investments with profit sharing and portfolio tracking.', icon: (
      <svg className="w-10 h-10 text-[#00CC99]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
    )},
    { name: 'SACCOs', desc: 'Full savings & credit cooperative with loans, interest, and member borrowing.', icon: (
      <svg className="w-10 h-10 text-[#0066CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
    )},
    { name: 'ROSCAs', desc: 'Merry-Go-Round rotating savings with automatic payouts each cycle.', icon: (
      <svg className="w-10 h-10 text-[#00CC99]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
    )},
    { name: 'Insurance', desc: 'Medical, death cover & targeted group savings for holidays, school fees, etc.', icon: (
      <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.068 1.593c-1.268.63-2.39.63-3.068 0a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-3.593-1.593c-.63-1.268-.63-2.39 0-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.068-1.593c1.268-.63 2.39-.63 3.068 0a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.593 3.593z" /></svg>
    )},
  ];

  const pricingTiers = [
    { name: 'Free', price: 0, members: 20, groups: 1, features: ['Basic contributions', 'Cash recording', 'Member management', 'Group chat'] },
    { name: 'Small Group', price: 30000, members: 50, groups: 3, features: ['Mobile Money integration', 'Loan management', 'SMS reminders', 'Basic reports', 'USSD access'] },
    { name: 'Medium SACCO', price: 100000, members: 200, groups: 10, features: ['Advanced reporting', 'Investment tracking', 'ROSCA module', 'PDF/Excel export', 'Priority support'] },
    { name: 'Large Cooperative', price: null, members: null, groups: null, features: ['Unlimited everything', 'Custom branding', 'API access', 'UMRA compliance', 'Dedicated support', 'Custom integrations'] },
  ];

  const stats = [
    { label: 'Active Groups', value: '2,500+' },
    { label: 'Members Served', value: '45,000+' },
    { label: 'Total Savings', value: 'UGX 12B+' },
    { label: 'Loans Disbursed', value: 'UGX 8B+' },
  ];

  const testimonials = [
    { name: 'Sarah Nakamya', role: 'Admin, Kampala Women Savings Club', avatar: IMAGES.avatars[0], text: 'SaccoUp transformed how we manage our savings group. No more paper records or confusion about who paid what. Everything is transparent and automatic.' },
    { name: 'James Ochieng', role: 'Treasurer, Jinja Investment Club', avatar: IMAGES.avatars[4], text: 'The mobile money integration is a game-changer. Members can contribute from anywhere, and I can reconcile payments in minutes instead of hours.' },
    { name: 'Grace Auma', role: 'Chairperson, Entebbe SACCO', avatar: IMAGES.avatars[1], text: 'Our SACCO has grown from 15 to 42 members since we started using SaccoUp. The loan management system is incredibly efficient.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0066CC] to-[#00CC99] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Sacco<span className="text-[#0066CC]">Up</span></span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-[#0066CC] transition-colors">Features</a>
              <a href="#groups" className="text-sm text-gray-600 hover:text-[#0066CC] transition-colors">Group Types</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-[#0066CC] transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm text-gray-600 hover:text-[#0066CC] transition-colors">Testimonials</a>
              <button onClick={onLogin} className="text-sm font-medium text-[#0066CC] hover:text-[#004C99] transition-colors">Sign In</button>
              <button onClick={onGetStarted} className="px-5 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors shadow-sm">Get Started Free</button>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              <div className="flex flex-col gap-3">
                <a href="#features" className="text-sm text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#groups" className="text-sm text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Group Types</a>
                <a href="#pricing" className="text-sm text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
                <button onClick={onLogin} className="text-sm font-medium text-[#0066CC] py-2 text-left">Sign In</button>
                <button onClick={onGetStarted} className="px-5 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg">Get Started Free</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0066CC]/5 via-white to-[#00CC99]/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0066CC]/10 rounded-full mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00CC99] animate-pulse" />
                <span className="text-xs font-medium text-[#0066CC]">Powered by Trust Fund Uganda</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Empower Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066CC] to-[#00CC99]">Savings Group</span> with Digital Transparency
              </h1>
              <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-lg">
                The all-in-one platform for managing SACCOs, savings clubs, investment groups, and ROSCAs across Uganda. Track contributions, manage loans, and grow together.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button onClick={onGetStarted} className="px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-[#0066CC] to-[#004C99] rounded-xl hover:shadow-lg hover:shadow-[#0066CC]/25 transition-all duration-300 transform hover:-translate-y-0.5">
                  Start Your Group Free
                </button>
                <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-3.5 text-base font-semibold text-[#0066CC] bg-[#0066CC]/10 rounded-xl hover:bg-[#0066CC]/20 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  See How It Works
                </button>
              </div>
              <div className="mt-10 flex items-center gap-6">
                <div className="flex -space-x-3">
                  {IMAGES.avatars.slice(0, 4).map((av, i) => (
                    <img key={i} src={av} alt="" className="w-10 h-10 rounded-full border-2 border-white object-cover" />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">45,000+ members</p>
                  <p className="text-xs text-gray-500">across 2,500+ groups in Uganda</p>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#0066CC]/20 to-[#00CC99]/20 rounded-3xl blur-3xl" />
              <img src={IMAGES.phoneMockup} alt="SaccoUp Dashboard" className="relative rounded-2xl shadow-2xl w-full max-w-md mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gradient-to-r from-[#0066CC] to-[#004C99] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl lg:text-4xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-sm text-blue-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything Your Group Needs</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">From mobile money payments to advanced reporting, SaccoUp handles it all so you can focus on growing together.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 group border border-gray-100">
                <div className="w-16 h-16 rounded-xl overflow-hidden mb-6">
                  <img src={f.icon} alt={f.title} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          {/* Additional feature grid */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>, title: 'USSD Access', desc: 'Feature phone users can check balances and contribute via *123#' },
              { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>, title: 'Group Chat', desc: 'Built-in messaging for group communication' },
              { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>, title: 'Reports & Export', desc: 'Generate PDF/Excel reports for audits' },
              { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>, title: 'Smart Reminders', desc: 'SMS & push notifications for due dates' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#0066CC]/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#0066CC]/10 flex items-center justify-center text-[#0066CC] mb-4">{f.icon}</div>
                <h4 className="font-semibold text-gray-900 mb-1">{f.title}</h4>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Group Types */}
      <section id="groups" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">One Platform, Every Group Type</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Whether you run a simple savings club or a full SACCO, SaccoUp adapts to your group's unique needs.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {groupTypes.map((g, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#0066CC] hover:shadow-lg transition-all duration-300 cursor-pointer group">
                <div className="mb-5">{g.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#0066CC] transition-colors">{g.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Get Started in Minutes</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Create Your Group', desc: 'Set up your savings group, define rules, contribution amounts, and schedules.' },
              { step: '2', title: 'Invite Members', desc: 'Share invite codes via SMS or WhatsApp. Members join with their phone number.' },
              { step: '3', title: 'Collect Contributions', desc: 'Members pay via MTN MoMo, Airtel Money, or cash. Auto-reconciliation included.' },
              { step: '4', title: 'Grow Together', desc: 'Track savings, manage loans, generate reports, and watch your group thrive.' },
            ].map((s, i) => (
              <div key={i} className="relative text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0066CC] to-[#00CC99] flex items-center justify-center text-white text-xl font-bold mx-auto mb-5">{s.step}</div>
                {i < 3 && <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-[#0066CC]/30 to-[#00CC99]/30" />}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Image Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img src={IMAGES.community} alt="Community savings group" className="w-full h-80 object-cover" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Built for Ugandan Communities</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">SaccoUp understands the unique needs of Ugandan savings groups. From feature phone USSD access to mobile money integration, every feature is designed for the local context.</p>
              <ul className="space-y-4">
                {['Works on 3G networks and feature phones via USSD', 'MTN MoMo & Airtel Money auto-reconciliation', 'English and Luganda language support', 'Offline-first mobile app with sync', 'UMRA compliance reporting for registered SACCOs'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-[#00CC99] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-gray-600">Start free and scale as your group grows. No hidden fees.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier, i) => (
              <div key={i} className={`bg-white rounded-2xl p-8 border-2 transition-all duration-300 hover:shadow-xl ${i === 2 ? 'border-[#0066CC] shadow-lg relative' : 'border-gray-100'}`}>
                {i === 2 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0066CC] text-white text-xs font-semibold rounded-full">Most Popular</div>}
                <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                <div className="mt-4 mb-6">
                  {tier.price !== null ? (
                    <><span className="text-3xl font-bold text-gray-900">{tier.price === 0 ? 'Free' : formatUGX(tier.price)}</span>{tier.price > 0 && <span className="text-sm text-gray-500">/month</span>}</>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900">Custom</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  {tier.members ? `Up to ${tier.members} members, ${tier.groups} group${tier.groups! > 1 ? 's' : ''}` : 'Unlimited members & groups'}
                </p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-[#00CC99] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onGetStarted} className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${i === 2 ? 'bg-[#0066CC] text-white hover:bg-[#004C99]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {tier.price === null ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Trusted by Groups Across Uganda</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#0066CC] to-[#004C99]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Ready to Transform Your Savings Group?</h2>
          <p className="text-lg text-blue-200 mb-8 max-w-2xl mx-auto">Join thousands of groups across Uganda already using SaccoUp to manage their finances transparently and efficiently.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onGetStarted} className="px-8 py-3.5 text-base font-semibold text-[#0066CC] bg-white rounded-xl hover:bg-gray-50 transition-colors">
              Create Your Group Now
            </button>
            <button onClick={onLogin} className="px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition-colors">
              Sign In to Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Stay Updated</h3>
          <p className="text-sm text-gray-600 mb-6">Get tips on managing your savings group and SaccoUp updates.</p>
          {newsletterSubmitted ? (
            <div className="flex items-center justify-center gap-2 text-[#00CC99] font-medium">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Thank you for subscribing!
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (email) setNewsletterSubmitted(true); }} className="flex gap-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none text-sm" required />
              <button type="submit" className="px-6 py-2.5 bg-[#0066CC] text-white rounded-lg text-sm font-semibold hover:bg-[#004C99] transition-colors">Subscribe</button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0066CC] to-[#00CC99] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <span className="text-lg font-bold text-white">SaccoUp</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">Powered by Trust Fund Uganda. Empowering savings groups with digital transparency.</p>
              <div className="flex gap-3">
                {['M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z', 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z'].map((d, i) => (
                  <a key={i} href="#" className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-[#0066CC] transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={d} /></svg>
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'Mobile App', 'USSD Gateway', 'API Documentation'].map((link) => (
                  <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                {['About Us', 'Careers', 'Blog', 'Press', 'Contact'].map((link) => (
                  <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                {['Help Center', 'Community', 'Privacy Policy', 'Terms of Service', 'UMRA Compliance'].map((link) => (
                  <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs">© 2026 SaccoUp by Trust Fund Uganda. All rights reserved.</p>
            <p className="text-xs">Made with care for Ugandan communities</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
