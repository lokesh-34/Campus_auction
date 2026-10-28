import React from 'react';
import { Link } from 'react-router-dom';
import { Gavel, ShieldCheck, Heart, Sparkles, BookOpen, Clock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
                <Gavel className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white">
                Campus<span className="text-brand-400">Bid</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Transparent, student-first auction marketplace for verified campus community members to buy and sell pre-loved campus essentials safely.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">Marketplace</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/marketplace" className="hover:text-white transition-colors">All Auctions</Link>
              </li>
              <li>
                <Link to="/marketplace?category=CYCLES" className="hover:text-white transition-colors">Bicycles</Link>
              </li>
              <li>
                <Link to="/marketplace?category=TEXTBOOKS" className="hover:text-white transition-colors">Textbooks</Link>
              </li>
              <li>
                <Link to="/marketplace?category=CALCULATORS" className="hover:text-white transition-colors">Scientific Calculators</Link>
              </li>
              <li>
                <Link to="/ai-assistant" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  AI Campus Assistant
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Safety */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">Trust & Rules</h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Anti-sniping auto-extensions</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-400 shrink-0" />
                <span>Private AutoBid proxies</span>
              </li>
              <li className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>In-person campus handovers</span>
              </li>
            </ul>
          </div>

          {/* Developer & API */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">Developer Tools</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="http://localhost:5000/api-docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Interactive Swagger Docs
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:5000/api-docs.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  OpenAPI 3.0 JSON Spec
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:5000/api/v1/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Backend Health Status
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} CampusBid. Built with pure JavaScript, MongoDB, Firebase & Gemini.</p>
          <p className="flex items-center gap-1 text-slate-400">
            Crafted for campus students <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
          </p>
        </div>
      </div>
    </footer>
  );
}
