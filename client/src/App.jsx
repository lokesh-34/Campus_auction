import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SocketProvider } from './contexts/SocketContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Footer } from './components/Footer.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

// Pages
import { Marketplace } from './pages/Marketplace.jsx';
import { AuctionDetails } from './pages/AuctionDetails.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { CreateListing } from './pages/CreateListing.jsx';
import { SellerDashboard } from './pages/SellerDashboard.jsx';
import { BuyerDashboard } from './pages/BuyerDashboard.jsx';
import { AiAssistantPage } from './pages/AiAssistantPage.jsx';
import { WatchlistPage } from './pages/WatchlistPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] transition-colors duration-200">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Public Browsing */}
                  <Route path="/" element={<Marketplace />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/auctions/:id" element={<AuctionDetails />} />
                  <Route path="/ai-assistant" element={<AiAssistantPage />} />

                  {/* Auth */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Protected Seller & Buyer Features */}
                  <Route
                    path="/create-listing"
                    element={
                      <ProtectedRoute>
                        <CreateListing />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seller-dashboard"
                    element={
                      <ProtectedRoute>
                        <SellerDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/buyer-dashboard"
                    element={
                      <ProtectedRoute>
                        <BuyerDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/watchlist"
                    element={
                      <ProtectedRoute>
                        <WatchlistPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
