document.addEventListener('DOMContentLoaded', function() {
  // Add to Cart Quantity
  const quantityInput = document.querySelector('.quantity-input');
  if (quantityInput) {
    // Support both class-based and ID-based selectors
    const decreaseBtn = document.querySelector('.quantity-decrease') || document.getElementById('decrease-quantity');
    const increaseBtn = document.querySelector('.quantity-increase') || document.getElementById('increase-quantity');
    
    if (decreaseBtn) {
      decreaseBtn.addEventListener('click', function() {
        if (parseInt(quantityInput.value) > 1) {
          quantityInput.value = parseInt(quantityInput.value) - 1;
        }
      });
    }

    if (increaseBtn) {
      increaseBtn.addEventListener('click', function() {
        quantityInput.value = parseInt(quantityInput.value) + 1;
      });
    }
  }

  // Product Gallery
  const mainImage = document.getElementById('main-product-image');
  const thumbnails = document.querySelectorAll('.product-thumbnail');
  
  if (mainImage && thumbnails.length > 0) {
    thumbnails.forEach(thumb => {
      thumb.addEventListener('click', function() {
        // Update main image
        mainImage.src = this.dataset.image;
        
        // Update active state
        thumbnails.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      });
    });
  }

  // Wishlist functionality
  const wishlistButtons = document.querySelectorAll('.wishlist-btn, .wishlist-icon, #add-to-wishlist');
  
  if (wishlistButtons.length > 0) {
    wishlistButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        
        const productId = this.dataset.productId;
        const isInWishlist = this.classList.contains('active');
        const method = isInWishlist ? 'DELETE' : 'POST';
        
        fetch(`/api/users/wishlist/${productId}`, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Toggle active state
            this.classList.toggle('active');
            
            // Update icon
            const icon = this.querySelector('i');
            if (icon) {
              icon.className = isInWishlist ? 'far fa-heart' : 'fas fa-heart';
            }
            
            // Show toast notification
            showToast(data.message);
            
            // Update wishlist count in header if needed
            const wishlistCountBadge = document.querySelector('.wishlist-count');
            if (wishlistCountBadge) {
              wishlistCountBadge.textContent = data.wishlistCount;
              
              if (data.wishlistCount > 0) {
                wishlistCountBadge.classList.remove('d-none');
              } else {
                wishlistCountBadge.classList.add('d-none');
              }
            }
          } else {
            showToast(data.message, 'error');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showToast('Có lỗi xảy ra, vui lòng thử lại sau', 'error');
        });
      });
    });
  }

  // Cart item quantity update
  const cartQuantityInputs = document.querySelectorAll('.cart-quantity-input');
  
  if (cartQuantityInputs.length > 0) {
    cartQuantityInputs.forEach(input => {
      input.addEventListener('change', function() {
        if (parseInt(this.value) < 1) {
          this.value = 1;
        }
        
        const form = this.closest('form');
        form.submit();
      });
    });
  }

  // Toast notification
  window.showToast = function(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'position-fixed bottom-0 end-0 p-3';
      container.style.zIndex = '5';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center ${type === 'success' ? 'text-white bg-success' : 'text-white bg-danger'}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
      delay: 3000
    });
    
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', function() {
      this.remove();
    });
  }

  // Back to top button
  const backToTopButton = document.getElementById('back-to-top');
  if (backToTopButton) {
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTopButton.style.display = 'block';
      } else {
        backToTopButton.style.display = 'none';
      }
    });

    backToTopButton.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // Checkout form validation
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function(e) {
      if (!this.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      this.classList.add('was-validated');
    });
  }

  // Live search functionality
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  if (searchInput && searchResults) {
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
      const query = this.value.trim();
      
      clearTimeout(searchTimeout);
      
      if (query.length < 2) {
        searchResults.classList.add('d-none');
        return;
      }
      
      searchTimeout = setTimeout(() => {
        fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
          .then(response => response.json())
          .then(data => {
            if (data.success && data.data.length > 0) {
              searchResults.innerHTML = '';
              data.data.forEach(product => {
                searchResults.innerHTML += `
                  <div class="d-flex p-2 border-bottom">
                    <img src="/uploads/${product.images[0]}" alt="${product.name}" width="50" height="50" class="object-fit-cover me-2">
                    <div>
                      <a href="/products/${product.slug}" class="text-decoration-none">${product.name}</a>
                      <p class="mb-0 text-danger">${product.price.toLocaleString('vi-VN')} ₫</p>
                    </div>
                  </div>
                `;
              });
              searchResults.classList.remove('d-none');
            } else {
              searchResults.innerHTML = '<div class="p-2">Không tìm thấy sản phẩm</div>';
              searchResults.classList.remove('d-none');
            }
          })
          .catch(error => {
            console.error('Search error:', error);
          });
      }, 300);
    });
    
    // Hide search results when clicking outside
    document.addEventListener('click', function(event) {
      if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
        searchResults.classList.add('d-none');
      }
    });
  }
});

// Add Back to Top button if not already in the page
document.addEventListener('DOMContentLoaded', function() {
  if (!document.getElementById('back-to-top')) {
    const backToTopBtn = document.createElement('a');
    backToTopBtn.id = 'back-to-top';
    backToTopBtn.className = 'back-to-top';
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.style.display = 'none';
    document.body.appendChild(backToTopBtn);
  }
}); 