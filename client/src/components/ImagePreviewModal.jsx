import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

/**
 * High-definition, responsive image preview & inspection lightbox modal
 */
export function ImagePreviewModal({
  images = [],
  initialIndex = 0,
  title = 'Item Image Preview',
  condition = '',
  isOpen = false,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Sync index when initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setIsZoomed(false);
      setRotation(0);
    }
  }, [isOpen, initialIndex, images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setIsZoomed(false);
    setRotation(0);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setIsZoomed(false);
    setRotation(0);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleToggleZoom = () => {
    setIsZoomed((prev) => !prev);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        setIsZoomed(true);
      } else if (e.key === '-') {
        setIsZoomed(false);
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    // Prevent body background scroll while preview is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen || !images.length) return null;

  const currentImage = images[currentIndex];
  const imageUrl = typeof currentImage === 'string' ? currentImage : currentImage?.secureUrl;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 backdrop-blur-md text-white select-none animate-in fade-in duration-200"
      onClick={(e) => {
        // Close if clicked on dark backdrop outside of image or controls
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {/* TOP HEADER CONTROLS */}
      <div className="flex items-center justify-between p-4 sm:px-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-10">
        <div className="flex items-center gap-3 max-w-[60%] sm:max-w-[70%]">
          <div className="space-y-0.5 truncate">
            <h2 className="text-sm sm:text-base font-extrabold truncate text-white" title={title}>
              {title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                Photo {currentIndex + 1} of {images.length}
              </span>
              {condition && (
                <>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-300 uppercase">
                    {condition}
                  </span>
                </>
              )}
              <span className="hidden md:inline-block text-[11px] text-slate-500">
                (Press ← → to navigate, Esc to close)
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom toggle button */}
          <button
            type="button"
            onClick={handleToggleZoom}
            className={`p-2 sm:p-2.5 rounded-xl border transition ${
              isZoomed
                ? 'bg-brand-600 border-brand-500 text-white shadow-lg'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isZoomed ? 'Zoom Out (-)' : 'Zoom In (+)'}
          >
            {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>

          {/* Rotate 90° button */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Rotate 90° (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Fullscreen button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="hidden sm:inline-flex p-2 sm:p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* External Full Size Link */}
          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Open Raw Original in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white shadow-md transition ml-1"
            title="Close Preview (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN PREVIEW STAGE */}
      <div
        className="relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose?.();
          }
        }}
      >
        {/* Previous Image Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 sm:left-6 z-20 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-brand-600 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md transition hover:scale-105 active:scale-95"
            title="Previous Photo (←)"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Displayed Image */}
        <div
          className={`relative max-w-full max-h-[75vh] flex items-center justify-center transition-transform duration-300 ease-out cursor-pointer ${
            isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
          }`}
          style={{
            transform: `rotate(${rotation}deg) scale(${isZoomed ? 1.6 : 1})`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleZoom();
          }}
          title={isZoomed ? 'Click to zoom out' : 'Click to zoom in'}
        >
          <img
            src={imageUrl}
            alt={`${title} - Photo ${currentIndex + 1}`}
            className="max-h-[72vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-xl shadow-2xl transition-all duration-200"
            draggable={false}
          />
        </div>

        {/* Next Image Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 sm:right-6 z-20 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-brand-600 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md transition hover:scale-105 active:scale-95"
            title="Next Photo (→)"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* BOTTOM THUMBNAIL GALLERY STRIP */}
      {images.length > 1 && (
        <div className="p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto z-10 scrollbar-none">
          {images.map((img, idx) => {
            const thumbUrl = typeof img === 'string' ? img : img?.secureUrl;
            const isSelected = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                  setIsZoomed(false);
                  setRotation(0);
                }}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                  isSelected
                    ? 'border-brand-500 scale-105 shadow-lg ring-2 ring-brand-400/50'
                    : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                }`}
              >
                <img src={thumbUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                {isSelected && (
                  <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-brand-400 animate-pulse shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
