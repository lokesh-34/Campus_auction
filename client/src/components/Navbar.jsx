import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Gavel,
  Search,
  Sparkles,
  PlusCircle,
  Bell,
  Heart,
  User,
  LogOut,
  LayoutDashboard,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSocket } from '../contexts/SocketContext.jsx';
import { api } from '../services/api.js';
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  sendTestDesktopNotification,
} from '../services/desktopNotifications.js';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mongoUser, isAuthenticated, logout } = useAuth();
  const { isConnected, socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    if (isAuthenticated) {
      api.getNotifications(1)
        .then((res) => setUnreadCount(res.unreadCount || 0))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (socket && isAuthenticated) {
      const handleNewNotification = () => {
        setUnreadCount((prev) => prev + 1);
      };
      socket.on('notification:new', handleNewNotification);
      return () => socket.off('notification:new', handleNewNotification);
    }
  }, [socket, isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform duration-200">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-brand-900 to-brand-700 bg-clip-text text-transparent">
                CampusBid
              </span>
              <span className={isConnected ? 'badge-live' : 'px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-600 font-semibold'}>
                {isConnected ? 'LIVE' : 'SYNCING'}
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 tracking-wider uppercase -mt-0.5">
              Campus Auction Hub
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/marketplace"
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isActive('/marketplace')
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            Marketplace
          </Link>
          <Link
            to="/ai-assistant"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isActive('/ai-assistant')
                ? 'bg-purple-50 text-purple-700'
                : 'text-slate-600 hover:text-purple-600 hover:bg-purple-50/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Assistant
          </Link>
          {isAuthenticated && (
            <Link
              to="/watchlist"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/watchlist')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Heart className="w-4 h-4 text-rose-500" />
              Watchlist
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/create-listing"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:from-brand-700 hover:to-indigo-700 hover:shadow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Sell Item</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="relative p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold uppercase">
                    {mongoUser?.displayName?.[0] || 'U'}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 max-w-[100px] truncate hidden sm:inline">
                    {mongoUser?.displayName}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel shadow-xl py-2 border border-slate-200 text-xs">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900 truncate">{mongoUser?.displayName}</p>
                      <p className="text-slate-500 truncate text-[11px]">{mongoUser?.email}</p>
                    </div>

                    <Link
                      to="/seller-dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 text-brand-600" />
                      <span>Seller Dashboard</span>
                    </Link>

                    <Link
                      to="/buyer-dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <PackageCheck className="w-4 h-4 text-emerald-600" />
                      <span>Buyer Dashboard</span>
                    </Link>

                    <Link
                      to="/notifications"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Bell className="w-4 h-4 text-amber-500" />
                      <span>Notification Centre</span>
                    </Link>

                    <button
                      onClick={async () => {
                        try {
                          await requestDesktopNotificationPermission();
                          sendTestDesktopNotification();
                        } catch (e) {
                          console.error(e);
                        }
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Desktop OS Alerts</span>
                      </span>
                      <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                        {getDesktopNotificationPermission() === 'granted' ? 'Active ✓' : 'Enable'}
                      </span>
                    </button>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 transition-colors font-semibold"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
