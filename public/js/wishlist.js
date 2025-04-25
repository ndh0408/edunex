/**
 * Wishlist functionality for Edunex
 */

// Initialize wishlist functionality
function initWishlist() {
  // Wishlist buttons on product listings
  const wishlistButtons = document.querySelectorAll('.wishlist-icon');
  
  wishlistButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get product info from data attributes
      const productId = this.dataset.productId;
      const isInWishlist = this.classList.contains('active');
      const isLoggedIn = this.getAttribute('data-logged-in') === 'true';
      
      // Redirect to login if not logged in
      if (!isLoggedIn) {
        window.location.href = '/users/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
      }
      
      // Disable button during request
      this.style.pointerEvents = 'none';
      this.style.opacity = '0.5';
      
      // Determine action
      const method = isInWishlist ? 'DELETE' : 'POST';
      const url = `/api/users/wishlist/${productId}`;
      
      // Get CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      
      // Make API request
      fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      })
      .then(response => {
        if (response.status === 401) {
          window.location.href = '/users/login?redirect=' + encodeURIComponent(window.location.pathname);
          throw new Error('Unauthorized');
        }
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Re-enable button
        this.style.pointerEvents = '';
        this.style.opacity = '';
        
        if (data.success) {
          // Find all wishlist icons for this product (in both grid and list views)
          const icons = document.querySelectorAll(`.wishlist-icon[data-product-id="${productId}"]`);
          
          icons.forEach(icon => {
            // Toggle active state
            icon.classList.toggle('active');
            
            // Update heart icon
            const heartIcon = icon.querySelector('i');
            if (heartIcon) {
              heartIcon.className = isInWishlist ? 'far fa-heart' : 'fas fa-heart';
            }
          });
          
          // Update wishlist count in header if exists
          const wishlistCountElement = document.querySelector('.wishlist-count');
          if (wishlistCountElement && data.wishlistCount !== undefined) {
            wishlistCountElement.textContent = data.wishlistCount;
          }
          
          // Show toast notification
          if (window.showToast) {
            window.showToast(data.message);
          }
        } else {
          if (window.showToast) {
            window.showToast(data.message, 'error');
          }
        }
      })
      .catch(error => {
        // Re-enable button
        this.style.pointerEvents = '';
        this.style.opacity = '';
        
        if (error.message !== 'Unauthorized') {
          console.error('Error:', error);
          if (window.showToast) {
            window.showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
          }
        }
      });
    });
  });

  // Wishlist button on product detail page
  const wishlistBtn = document.getElementById('add-to-wishlist');
  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', function() {
      const productId = this.dataset.productId;
      const icon = this.querySelector('i');
      const isInWishlist = icon.classList.contains('fas');
      const isLoggedIn = this.getAttribute('data-logged-in') === 'true';
      
      // Redirect to login if not logged in
      if (!isLoggedIn) {
        const currentPath = window.location.pathname;
        window.location.href = '/users/login?redirect=' + encodeURIComponent(currentPath);
        return;
      }
      
      // Disable button during request
      this.disabled = true;
      
      // Determine action
      const method = isInWishlist ? 'DELETE' : 'POST';
      const url = `/api/users/wishlist/${productId}`;
      
      // Get CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      
      // Make API request
      fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      })
      .then(response => {
        if (response.status === 401) {
          window.location.href = '/users/login?redirect=' + encodeURIComponent(window.location.pathname);
          throw new Error('Unauthorized');
        }
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Re-enable button
        this.disabled = false;
        
        if (data.success) {
          // Toggle icon class
          icon.classList.toggle('far');
          icon.classList.toggle('fas');
          
          // Update wishlist count in header if exists
          const wishlistCountElement = document.querySelector('.wishlist-count');
          if (wishlistCountElement && data.wishlistCount !== undefined) {
            wishlistCountElement.textContent = data.wishlistCount;
          }
          
          // Show toast notification
          if (window.showToast) {
            window.showToast(data.message);
          }
        } else {
          if (window.showToast) {
            window.showToast(data.message, 'error');
          }
        }
      })
      .catch(error => {
        // Re-enable button
        this.disabled = false;
        
        if (error.message !== 'Unauthorized') {
          console.error('Error:', error);
          if (window.showToast) {
            window.showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
          }
        }
      });
    });
  }

  // Remove button on wishlist page
  const removeButtons = document.querySelectorAll('.remove-wishlist');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const productId = this.dataset.productId;
      const productCard = this.closest('.product-item');
      
      // Disable button
      this.disabled = true;
      
      // Show confirmation
      if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này khỏi danh sách yêu thích?')) {
        this.disabled = false;
        return;
      }
      
      // Get CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      
      // Make API request
      fetch(`/api/users/wishlist/${productId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Animate removal
          productCard.style.transition = 'all 0.3s ease';
          productCard.style.opacity = '0';
          productCard.style.transform = 'scale(0.8)';
          
          // Update wishlist count in header if exists
          const wishlistCountElement = document.querySelector('.wishlist-count');
          if (wishlistCountElement && data.wishlistCount !== undefined) {
            wishlistCountElement.textContent = data.wishlistCount;
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
          
          // Show toast notification
          if (window.showToast) {
            window.showToast(data.message);
          }
        } else {
          // Re-enable button
          this.disabled = false;
          if (window.showToast) {
            window.showToast(data.message, 'error');
          }
        }
      })
      .catch(error => {
        // Re-enable button
        this.disabled = false;
        
        console.error('Error:', error);
        if (window.showToast) {
          window.showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
        }
      });
    });
  });
}

// Call the init function when DOM is ready
document.addEventListener('DOMContentLoaded', initWishlist); 