// Shop This Frame - Content Script
(function() {
  'use strict';

  const API_ENDPOINT = 'http://localhost:3000/shop-frame';

  let panel = null;
  let button = null;
  let currentFrameBlob = null;

  // Initialize the extension
  function init() {
    if (document.getElementById('shop-frame-btn')) return;

    createButton();
    createPanel();

    console.log('[Shop This Frame] Extension initialized');
  }

  // Create the floating button
  function createButton() {
    button = document.createElement('button');
    button.id = 'shop-frame-btn';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      Shop this frame
    `;
    button.addEventListener('click', handleShopClick);
    document.body.appendChild(button);
  }

  // Create the side panel
  function createPanel() {
    panel = document.createElement('div');
    panel.id = 'shop-frame-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h2>Shop This Frame</h2>
        <button class="close-btn" aria-label="Close panel">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="frame-preview">
        <img id="frame-thumbnail" src="" alt="Captured frame"/>
        <p>Captured frame</p>
      </div>
      <div class="products-container">
        <h3>Found Products</h3>
        <div id="products-list"></div>
      </div>
    `;

    panel.querySelector('.close-btn').addEventListener('click', closePanel);
    document.body.appendChild(panel);
  }

  // Handle shop button click
  async function handleShopClick() {
    const video = document.querySelector('video');

    if (!video) {
      alert('No video found on this page');
      return;
    }

    if (video.paused || video.ended) {
      // Video is paused, good to capture
    }

    try {
      // Capture the frame
      const frameBlob = await captureFrame(video);
      currentFrameBlob = frameBlob;

      // Show the panel with preview
      showPanel(frameBlob);

      // Send to backend
      await sendToBackend(frameBlob);

    } catch (error) {
      console.error('[Shop This Frame] Error:', error);
      showError(error.message);
    }
  }

  // Capture current video frame
  function captureFrame(video) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to capture frame'));
          }
        }, 'image/jpeg', 0.9);

      } catch (error) {
        reject(error);
      }
    });
  }

  // Show the side panel
  function showPanel(frameBlob) {
    const thumbnail = panel.querySelector('#frame-thumbnail');
    thumbnail.src = URL.createObjectURL(frameBlob);

    // Show loading state
    showLoading();

    // Open panel
    panel.classList.add('open');
  }

  // Close the side panel
  function closePanel() {
    panel.classList.remove('open');
  }

  // Show loading spinner
  function showLoading() {
    const productsList = panel.querySelector('#products-list');
    productsList.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Finding shoppable items...</p>
      </div>
    `;
  }

  // Show error state
  function showError(message) {
    const productsList = panel.querySelector('#products-list');
    productsList.innerHTML = `
      <div class="error-container">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>${message}</p>
        <button class="retry-btn">Try Again</button>
      </div>
    `;

    productsList.querySelector('.retry-btn').addEventListener('click', () => {
      if (currentFrameBlob) {
        showLoading();
        sendToBackend(currentFrameBlob);
      }
    });
  }

  // Send frame to backend
  async function sendToBackend(frameBlob) {
    try {
      const formData = new FormData();
      formData.append('frame', frameBlob, 'frame.jpg');

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      renderProducts(data.products || []);

    } catch (error) {
      console.error('[Shop This Frame] API Error:', error);

      // For demo: show placeholder products on error
      if (error.message.includes('Failed to fetch')) {
        console.log('[Shop This Frame] Backend unavailable, showing demo products');
        renderProducts(getDemoProducts());
      } else {
        showError(error.message);
      }
    }
  }

  // Render product cards
  function renderProducts(products) {
    const productsList = panel.querySelector('#products-list');

    if (products.length === 0) {
      productsList.innerHTML = `
        <div class="empty-state">
          <p>No shoppable items found in this frame.</p>
          <p>Try a different frame with visible products.</p>
        </div>
      `;
      return;
    }

    productsList.innerHTML = products.map(product => `
      <div class="product-card" data-url="${product.url || '#'}">
        <img src="${product.image}" alt="${product.title}" onerror="this.src='https://via.placeholder.com/300x180?text=Product'"/>
        <div class="product-info">
          <h4>${product.title}</h4>
          <p class="vendor">${product.vendor || 'Shop'}</p>
          <p class="price">$${product.price}</p>
        </div>
      </div>
    `).join('');

    // Add click handlers to product cards
    productsList.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.dataset.url;
        if (url && url !== '#') {
          window.open(url, '_blank');
        }
      });
    });
  }

  // Demo products for testing without backend
  function getDemoProducts() {
    return [
      {
        title: 'Classic White T-Shirt',
        vendor: 'Fashion Co',
        price: '29.99',
        image: 'https://via.placeholder.com/300x180/1a1a1a/ffffff?text=White+Shirt',
        url: '#'
      },
      {
        title: 'Wireless Headphones',
        vendor: 'Tech Store',
        price: '149.99',
        image: 'https://via.placeholder.com/300x180/1a1a1a/ffffff?text=Headphones',
        url: '#'
      },
      {
        title: 'Minimalist Watch',
        vendor: 'Time Pieces',
        price: '89.99',
        image: 'https://via.placeholder.com/300x180/1a1a1a/ffffff?text=Watch',
        url: '#'
      },
      {
        title: 'Canvas Sneakers',
        vendor: 'Shoe Hub',
        price: '65.00',
        image: 'https://via.placeholder.com/300x180/1a1a1a/ffffff?text=Sneakers',
        url: '#'
      }
    ];
  }

  // Wait for page to be ready, then initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize on YouTube SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.href.includes('youtube.com/watch')) {
        setTimeout(init, 1000);
      }
    }
  }).observe(document.body, { subtree: true, childList: true });

})();
