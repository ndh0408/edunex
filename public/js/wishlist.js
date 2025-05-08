/**
 * Enhanced Wishlist functionality for Edunex
 */

// Button processing state tracking
const processingButtons = new Set();

// Function to get a fresh CSRF token
async function refreshCsrfToken() {
  try {
    const response = await fetch('/users/refresh-csrf', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh CSRF token');
    }
    
    const data = await response.json();
    if (data.csrfToken) {
      // Update meta tag
      let metaTag = document.querySelector('meta[name="csrf-token"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'csrf-token');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', data.csrfToken);
      console.log('CSRF token refreshed');
      return data.csrfToken;
    }
    return null;
  } catch (error) {
    console.error('Error refreshing CSRF token:', error);
    return null;
  }
}

// Get CSRF token with potential refresh
async function getCsrfToken() {
  // First try to get the existing token
  const existingToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  
  // If no token exists or it's empty, try to refresh
  if (!existingToken) {
    return await refreshCsrfToken();
  }
  
  return existingToken;
}

// Check if user is logged in
function isUserLoggedIn(button) {
  const isLoggedIn = button.getAttribute('data-logged-in') === 'true';
  
  if (!isLoggedIn) {
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = '/users/login?redirect=' + encodeURIComponent(currentPath);
    return false;
  }
  
  return true;
}

// Make API request with retry for CSRF errors
async function makeWishlistRequest(url, method, csrfToken) {
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include'
    });
    
    if (response.status === 401) {
      window.location.href = '/users/login?redirect=' + encodeURIComponent(window.location.pathname);
      throw new Error('Unauthorized');
    }
    
    if (response.status === 403) {
      // CSRF token invalid, refresh token and retry
      const newToken = await refreshCsrfToken();
      if (!newToken) {
        throw new Error('Failed to refresh CSRF token');
      }
      
      // Retry with new token
      const retryResponse = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': newToken
        },
        credentials: 'include'
      });
      
      if (!retryResponse.ok) {
        throw new Error(`Network response error: ${retryResponse.status}`);
      }
      
      return await retryResponse.json();
    }
    
    if (!response.ok) {
      throw new Error(`Network response error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}

// Update wishlist UI after successful operation
function updateWishlistUI(productId, isRemoving, count) {
  // Update all related buttons for this product
  const icons = document.querySelectorAll(`.wishlist-icon[data-product-id="${productId}"]`);
  
  icons.forEach(icon => {
    // Toggle active state
    if (isRemoving) {
      icon.classList.remove('active');
    } else {
      icon.classList.add('active');
    }
    
    // Update heart icon
    const heartIcon = icon.querySelector('i');
    if (heartIcon) {
      heartIcon.className = isRemoving ? 'far fa-heart' : 'fas fa-heart';
    }
  });
  
  // Update wishlist count in header if exists
  const wishlistCountElements = document.querySelectorAll('.wishlist-count');
  if (wishlistCountElements.length > 0 && count !== undefined) {
    wishlistCountElements.forEach(el => {
      el.textContent = count;
    });
  }
}

// Handle wishlist button click (product listings)
async function handleWishlistButtonClick(button) {
  const productId = button.dataset.productId;
  
  // Prevent duplicate processing
  if (processingButtons.has(productId)) {
    console.log('Button click already being processed');
    return;
  }
  
  // Check login status
  if (!isUserLoggedIn(button)) {
    return;
  }
  
  // Add to processing set
  processingButtons.add(productId);
  
  // Visually disable button
  button.style.pointerEvents = 'none';
  button.style.opacity = '0.5';
  
  try {
    // Determine action based on current state
    const isInWishlist = button.classList.contains('active');
    const method = isInWishlist ? 'DELETE' : 'POST';
    const url = `/api/users/wishlist/${productId}`;
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Make API request
    const data = await makeWishlistRequest(url, method, csrfToken);
    
    if (data.success) {
      // Update UI
      updateWishlistUI(productId, isInWishlist, data.wishlistCount);
      
      // Show success message
      if (window.showToast) {
        window.showToast(data.message);
      }
    } else {
      if (window.showToast) {
        window.showToast(data.message || 'Không thể cập nhật danh sách yêu thích', 'error');
      }
    }
  } catch (error) {
    console.error('Error updating wishlist:', error);
    if (window.showToast) {
      window.showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
    }
  } finally {
    // Re-enable button
    button.style.pointerEvents = '';
    button.style.opacity = '';
    
    // Remove from processing set after a short delay to prevent rapid double-clicks
    setTimeout(() => {
      processingButtons.delete(productId);
    }, 500);
  }
}

// Handle wishlist button on product detail page
async function handleDetailPageWishlist(button) {
  const productId = button.dataset.productId;
  
  // Prevent duplicate processing
  if (processingButtons.has(productId)) {
    return;
  }
  
  // Check login status
  if (!isUserLoggedIn(button)) {
    return;
  }
  
  // Add to processing set
  processingButtons.add(productId);
  
  // Disable button
  button.disabled = true;
  
  try {
    const icon = button.querySelector('i');
    const isInWishlist = icon.classList.contains('fas');
    const method = isInWishlist ? 'DELETE' : 'POST';
    const url = `/api/users/wishlist/${productId}`;
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Make API request
    const data = await makeWishlistRequest(url, method, csrfToken);
    
    if (data.success) {
      // Toggle icon class
      if (isInWishlist) {
        icon.classList.remove('fas');
        icon.classList.add('far');
        button.classList.remove('btn-danger');
        button.classList.add('btn-outline-danger');
      } else {
        icon.classList.remove('far');
        icon.classList.add('fas');
        button.classList.remove('btn-outline-danger');
        button.classList.add('btn-danger');
      }
      
      // Update wishlist count in header
      const wishlistCountElements = document.querySelectorAll('.wishlist-count');
      if (wishlistCountElements.length > 0 && data.wishlistCount !== undefined) {
        wishlistCountElements.forEach(el => {
          el.textContent = data.wishlistCount;
        });
      }
      
      // Show toast notification
      if (window.showToast) {
        window.showToast(data.message);
      }
    } else {
      if (window.showToast) {
        window.showToast(data.message || 'Không thể cập nhật yêu thích', 'error');
      }
    }
  } catch (error) {
    console.error('Error updating wishlist:', error);
    if (window.showToast) {
      window.showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
    }
  } finally {
    // Re-enable button
    button.disabled = false;
    
    // Remove from processing set
    setTimeout(() => {
      processingButtons.delete(productId);
    }, 500);
  }
}

// Handle remove button on wishlist page
async function handleWishlistRemoveButton(button) {
  const productId = button.dataset.productId;
  
  // Prevent duplicate processing
  if (processingButtons.has(productId)) {
    return;
  }
  
  // Add to processing set
  processingButtons.add(productId);
  
  // Disable button
  button.disabled = true;
  
  try {
    const productCard = button.closest('.product-item');
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Make API request
    const data = await makeWishlistRequest(`/api/users/wishlist/${productId}`, 'DELETE', csrfToken);
    
    if (data.success) {
      // Animate removal
      productCard.style.transition = 'all 0.3s ease';
      productCard.style.opacity = '0';
      productCard.style.transform = 'scale(0.8)';
      
      // Update wishlist count in header
      const wishlistCountElements = document.querySelectorAll('.wishlist-count');
      if (wishlistCountElements.length > 0 && data.wishlistCount !== undefined) {
        wishlistCountElements.forEach(el => {
          el.textContent = data.wishlistCount;
        });
      }
      
      // Remove the element from DOM after animation
      setTimeout(() => {
        productCard.remove();
        
        // Show empty state if no more items
        const remainingItems = document.querySelectorAll('.product-item');
        if (remainingItems.length === 0) {
          const wishlistContainer = document.querySelector('.card-body');
          if (wishlistContainer) {
            wishlistContainer.innerHTML = `
              <div class="text-center py-5 empty-state">
                <img src="/img/empty-wishlist.svg" alt="Danh sách trống" class="img-fluid mb-4" style="max-width: 200px;">
                <h4 class="fw-bold text-muted mb-3">Danh sách yêu thích trống</h4>
                <p class="text-muted mb-4">Bạn chưa thêm sản phẩm nào vào danh sách yêu thích</p>
                <a href="/products" class="btn btn-primary rounded-pill px-4">Khám phá sản phẩm</a>
              </div>
            `;
          }
        }
      }, 300);
    } else {
      // Re-enable button
      button.disabled = false;
      if (window.showToast) {
        window.showToast(data.message || 'Không thể xóa sản phẩm', 'error');
      }
    }
  } catch (error) {
    // Re-enable button
    button.disabled = false;
    console.error('Error removing from wishlist:', error);
    if (window.showToast) {
      window.showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
    }
  } finally {
    // Remove from processing set after a delay
    setTimeout(() => {
      processingButtons.delete(productId);
    }, 500);
  }
}

// Initialize wishlist functionality
function initWishlist() {
  // Wishlist buttons on product listings
  const wishlistButtons = document.querySelectorAll('.wishlist-icon');
  wishlistButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      handleWishlistButtonClick(this);
    });
  });

  // Wishlist button on product detail page
  const wishlistBtn = document.getElementById('add-to-wishlist');
  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', function(e) {
      e.preventDefault();
      handleDetailPageWishlist(this);
    });
  }

  // Remove buttons on wishlist page
  const removeButtons = document.querySelectorAll('.remove-wishlist');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      handleWishlistRemoveButton(this);
    });
  });
}

// Call the init function when DOM is ready
document.addEventListener('DOMContentLoaded', initWishlist); 