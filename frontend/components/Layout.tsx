
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, BarChart3, Bot, Settings, Menu, X, FileText, Users, Truck, ChevronLeft, ChevronRight, Languages, Sun, Moon } from 'lucide-react';
import { AIAgent } from './AIAgent';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { Bell, AlertTriangle } from 'lucide-react';
import { DEFAULT_PERMISSIONS } from '../constants/permissions';

const SidebarItem = ({ to, icon: Icon, label, collapsed }: { to: string, icon: any, label: string, collapsed: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
      } ${collapsed ? 'justify-center px-2' : ''}`
    }
    title={collapsed ? label : ''}
  >
    <Icon size={20} />
    {!collapsed && <span className="font-medium animate-in fade-in duration-200">{label}</span>}
  </NavLink>
);

export const Layout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { products, currentUser, logoutUser, theme, toggleTheme } = useApp();
  const [isUserSwitcherOpen, setIsUserSwitcherOpen] = useState(false);



  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  const hasAccess = (moduleId: string) => {
    if (!currentUser) return false;
    // Use explicit permissions if available and not empty, otherwise fallback to role defaults
    const perms = (currentUser.permissions && currentUser.permissions.length > 0)
      ? currentUser.permissions
      : DEFAULT_PERMISSIONS[currentUser.role];
    return perms ? perms.includes(moduleId) : false;
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-30 transform transition-all duration-300 ease-in-out flex flex-col ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
          } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className={`p-6 border-b border-slate-100 dark:border-slate-700 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="text-white" size={20} />
            </div>
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-slate-800 dark:text-white animate-in fade-in duration-200 whitespace-nowrap">Hanuman<span className="text-indigo-600 dark:text-indigo-400">Trader</span></h1>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {hasAccess('dashboard') && <SidebarItem to="/" icon={LayoutDashboard} label={t('nav.dashboard')} collapsed={isSidebarCollapsed} />}

          {hasAccess('inventory') && (
            <div className="relative">
              <SidebarItem to="/inventory" icon={Package} label={t('nav.inventory')} collapsed={isSidebarCollapsed} />
            </div>
          )}

          {hasAccess('sales') && <SidebarItem to="/sales" icon={ShoppingCart} label={t('nav.sales')} collapsed={isSidebarCollapsed} />}
          {hasAccess('customers') && <SidebarItem to="/customers" icon={Users} label={t('nav.customers')} collapsed={isSidebarCollapsed} />}
          {hasAccess('suppliers') && <SidebarItem to="/suppliers" icon={Truck} label={t('nav.suppliers')} collapsed={isSidebarCollapsed} />}
          {hasAccess('reports') && <SidebarItem to="/gst-report" icon={FileText} label={t('nav.reports')} collapsed={isSidebarCollapsed} />}
          {hasAccess('analytics') && <SidebarItem to="/analytics" icon={BarChart3} label={t('nav.analytics')} collapsed={isSidebarCollapsed} />}

          {hasAccess('users') && (
            <SidebarItem to="/users" icon={Users} label="Users" collapsed={isSidebarCollapsed} />
          )}

          {hasAccess('settings') && <SidebarItem to="/settings" icon={Settings} label={t('nav.settings')} collapsed={isSidebarCollapsed} />}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className={`w-full flex items-center mb-2 p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3 px-4'}`}
            title="Switch Language"
          >
            <Languages size={20} className="text-indigo-600 dark:text-indigo-400" />
            {!isSidebarCollapsed && (
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {language === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center mb-4 p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${isSidebarCollapsed ? 'justify-center' : 'space-x-3 px-4'}`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600 dark:text-indigo-400" />}
            {!isSidebarCollapsed && (
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>

          <div className="relative">
            {/* Logout Button */}
            {isUserSwitcherOpen && !isSidebarCollapsed && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => { logoutUser(); setIsUserSwitcherOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  Sign Out
                </button>
              </div>
            )}

            <button
              onClick={() => setIsUserSwitcherOpen(!isUserSwitcherOpen)}
              className={`flex items-center w-full hover:bg-slate-100 rounded-lg transition-colors ${isSidebarCollapsed ? 'justify-center' : 'space-x-3 px-4 py-2'}`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0 border border-indigo-200">
                {currentUser?.name?.charAt(0) || '?'}
              </div>
              {!isSidebarCollapsed && (
                <div className="text-left animate-in fade-in duration-200 overflow-hidden">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{currentUser?.name || 'Guest'}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{currentUser?.role?.replace('_', ' ') || ''}</p>
                </div>
              )}
            </button>
          </div>
          {/* Collapse Toggle (Desktop only) */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex w-full mt-4 items-center justify-center p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-md"
            >
              {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Package className="text-white" size={20} />
              </div>
              <span className="font-bold text-slate-800">Hanuman Trader</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-0">
          <div className="max-w-7xl mx-auto pb-20">
            <Outlet />
          </div>
        </main>

        {/* Floating AI Agent */}
        <AIAgent />
      </div>
    </div>
  );
};
