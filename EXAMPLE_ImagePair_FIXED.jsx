import React, { useState, useCallback } from 'react';

/**
 * ImagePair.jsx — FIXED EXAMPLE
 *
 * Demonstrates all image rendering fixes applied:
 * ✅ Valid Unsplash photo IDs (from images.unsplash.com)
 * ✅ React-safe onError handler (not onerror)
 * ✅ Double-guard error handling (prevents loops)
 * ✅ Proxied URLs via /api/image endpoint
 * ✅ Proper alt text on all images
 * ✅ Safe array handling with default params
 *
 * This is the EXPECTED OUTPUT after sanitization.
 */

function ImagePair({ images = [], title = 'Image Gallery' }) {
  const [errors, setErrors] = useState({});

  const handleImageError = useCallback((id) => {
    setErrors((prev) => ({
      ...prev,
      [id]: true,
    }));
  }, []);

  // Safe array guard: default to empty array
  const safeImages = (images || []).filter((img) => img != null);

  // Fallback images with valid Unsplash IDs
  const FALLBACK_IMAGES = [
    {
      id: 'beach',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
      alt: 'Beach wave at sunset',
    },
    {
      id: 'mountain',
      url: 'https://images.unsplash.com/photo-1516321318423-f06f70504b6f',
      alt: 'Mountain landscape',
    },
  ];

  const displayImages = safeImages.length > 0 ? safeImages : FALLBACK_IMAGES;

  return (
    <div
      style={{
        padding: '3rem 2rem',
        maxWidth: 1200,
        margin: '0 auto',
        background: '#030712',
      }}
    >
      <h2
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#F9FAFB',
          marginBottom: '2rem',
          fontFamily: 'Syne, sans-serif',
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
        }}
      >
        {(displayImages || []).map((image, index) => {
          const imageId = image.id ?? index;
          const hasError = errors[imageId];

          return (
            <div
              key={image.id ?? index}
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.3s',
              }}
            >
              {/* IMAGE WITH ALL FIXES APPLIED */}
              {!hasError ? (
                <img
                  src={`/api/image?url=${encodeURIComponent(image.url)}`}
                  alt={image.alt || 'Generated image'}
                  onError={(e) => {
                    // DOUBLE-GUARD: Prevent infinite loop
                    e.currentTarget.onerror = null;
                    // FALLBACK: Show curated Unsplash image through proxy
                    e.currentTarget.src = '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1507525428034-b723cf961d3e');
                    // TRACK: Mark image as failed
                    handleImageError(imageId);
                  }}
                  style={{
                    width: '100%',
                    height: 250,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                // PLACEHOLDER: Show when image fails
                <div
                  style={{
                    width: '100%',
                    height: 250,
                    background:
                      'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6B7280',
                    fontSize: '0.875rem',
                  }}
                >
                  Image unavailable
                </div>
              )}

              {/* CAPTION */}
              <div style={{ padding: '1rem' }}>
                <p
                  style={{
                    color: '#F9FAFB',
                    fontWeight: 500,
                    margin: '0 0 0.5rem 0',
                  }}
                >
                  {image.title || `Image ${index + 1}`}
                </p>
                <p
                  style={{
                    color: '#6B7280',
                    fontSize: '0.875rem',
                    margin: 0,
                  }}
                >
                  {image.description || image.alt || 'Gallery image'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* EMPTY STATE */}
      {!displayImages || displayImages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
          <p>No images to display</p>
        </div>
      ) : null}
    </div>
  );
}

export default ImagePair;
