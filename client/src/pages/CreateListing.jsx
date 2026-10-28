import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Upload,
  X,
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Layers,
  Sparkles,
  MapPin,
  Phone,
} from 'lucide-react';
import { api } from '../services/api.js';
import { rupeesToPaise } from '../utils/formatCurrency.js';

const CATEGORIES = [
  { id: 'CYCLES', label: 'Cycles & Mobility' },
  { id: 'TEXTBOOKS', label: 'Textbooks & Notes' },
  { id: 'ELECTRONICS', label: 'Electronics & Gadgets' },
  { id: 'CALCULATORS', label: 'Scientific Calculators' },
  { id: 'LAB_EQUIPMENT', label: 'Lab & Engineering Gears' },
  { id: 'FURNITURE', label: 'Dorm & Hostel Furniture' },
  { id: 'OTHER', label: 'Other Essentials' },
];

export function CreateListing() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CYCLES');
  const [condition, setCondition] = useState('GOOD');
  const [description, setDescription] = useState('');
  const [startingPriceRupees, setStartingPriceRupees] = useState('');
  const [minIncrementRupees, setMinIncrementRupees] = useState('50');
  const [pickupPoint, setPickupPoint] = useState('Campus Central Library / Student Center');
  const [sellerPhone, setSellerPhone] = useState('');

  // Default closing time: 48 hours from now formatted for datetime-local
  const defaultClose = new Date(Date.now() + 48 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [closingAt, setClosingAt] = useState(defaultClose);

  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');

  const handleImageFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setImageError('');

    if (images.length + files.length > 5) {
      setImageError('Maximum 5 photos allowed per listing.');
      e.target.value = '';
      return;
    }

    setUploadingImage(true);

    try {
      const signParams = await api.getSignParameters();

      for (const file of files) {
        // Validate image format
        if (!file.type.startsWith('image/')) {
          setImageError(`File "${file.name}" is not an image. Only image files (JPG, PNG, WebP) are allowed.`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          setImageError(`File "${file.name}" exceeds the 5MB size limit.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        let uploaded = null;

        if (signParams.isMock) {
          // Upload to mock endpoint
          const res = await fetch('/api/v1/uploads/mock-upload', {
            method: 'POST',
            body: formData,
          });
          uploaded = await res.json();
        } else {
          formData.append('api_key', signParams.apiKey);
          formData.append('timestamp', signParams.timestamp);
          formData.append('signature', signParams.signature);
          formData.append('folder', signParams.folder);

          const res = await fetch(signParams.uploadUrl, {
            method: 'POST',
            body: formData,
          });
          uploaded = await res.json();
        }

        if (uploaded?.secure_url && uploaded?.public_id) {
          setImages((prev) => [
            ...prev,
            {
              publicId: uploaded.public_id,
              secureUrl: uploaded.secure_url,
              order: prev.length,
            },
          ]);
        }
      }
    } catch (err) {
      setImageError(err.message || 'Image upload failed. Please try again.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setImageError('');

    const startingPaise = rupeesToPaise(startingPriceRupees);
    const incrementPaise = rupeesToPaise(minIncrementRupees);

    if (startingPaise < 100) {
      return setError('Starting price must be at least ₹1.00.');
    }
    if (incrementPaise < 100) {
      return setError('Minimum bid increment must be at least ₹1.00.');
    }

    const closeDate = new Date(closingAt);
    if (closeDate.getTime() <= Date.now() + 5 * 60 * 1000) {
      return setError('Closing time must be at least 5 minutes in the future.');
    }

    setSubmitting(true);

    try {
      const newListing = await api.createListing({
        title: title.trim(),
        category,
        condition,
        description: description.trim(),
        startingPricePaise: startingPaise,
        minBidIncrementPaise: incrementPaise,
        closingAt: closeDate.toISOString(),
        images,
        pickupPoint: pickupPoint.trim(),
        sellerPhone: sellerPhone.trim(),
      });

      navigate(`/auctions/${newListing._id}`);
    } catch (err) {
      setError(err.message || 'Failed to publish auction listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="glass-panel p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/90 space-y-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase mb-2">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Campus Auction</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">List Item for Auction</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reach hundreds of students on campus. Transparent bidding with verified campus handover.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Item Title *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Firefox Target 21-Speed Mountain Bike with Disc Brakes"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Category & Condition Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Item Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="NEW">Brand New (Unopened/Unused)</option>
                <option value="LIKE_NEW">Like New (Barely used, pristine)</option>
                <option value="GOOD">Good (Functional with minor wear)</option>
                <option value="FAIR">Fair (Noticeable wear, fully working)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description & Specifications *
            </label>
            <textarea
              required
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe age, included accessories (chargers, stands), semester notes, defects, or reasons for selling..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Starting Bid Price (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  required
                  step="1"
                  min="1"
                  value={startingPriceRupees}
                  onChange={(e) => setStartingPriceRupees(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Minimum Bid Increment (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  required
                  step="1"
                  min="1"
                  value={minIncrementRupees}
                  onChange={(e) => setMinIncrementRupees(e.target.value)}
                  placeholder="Default: 50"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Closing Time */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Auction Closing Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={closingAt}
              onChange={(e) => setClosingAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              If any bid arrives in the final 30 seconds, anti-sniping protection automatically extends closing time by 60 seconds.
            </p>
          </div>

          {/* Campus Handover & Seller Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-600" />
                <span>Campus Pickup Point *</span>
              </label>
              <input
                type="text"
                required
                value={pickupPoint}
                onChange={(e) => setPickupPoint(e.target.value)}
                placeholder="e.g. Hostel 4 Common Room, Central Library"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Designated campus location to meet the buyer for in-person item inspection and handover.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Seller Contact Phone *</span>
              </label>
              <input
                type="tel"
                required
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Sent directly to the highest winning bidder after the deadline ends to coordinate handover.
              </p>
            </div>
          </div>

          {/* Photos Upload Section */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Upload Item Photos ({images.length}/5)
            </label>

            {/* Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative h-24 rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={img.secureUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center text-xs hover:bg-rose-600 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < 5 && (
              <label className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/20 transition-all text-center">
                <Upload className="w-8 h-8 text-brand-600 mb-2" />
                <span className="text-xs font-bold text-slate-800">
                  {uploadingImage ? 'Uploading securely to Cloudinary...' : 'Click to select photos'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  JPG, PNG, WebP up to 5MB (Direct Cloudinary signed upload)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingImage}
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
            )}

            {/* Image Error Alert - displayed directly after photos upload */}
            {imageError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{imageError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImageError('')}
                  className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-100 transition"
                  title="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Form Submit Error */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-100 transition"
                title="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              <span>{submitting ? 'Publishing Auction...' : 'Publish Auction Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
