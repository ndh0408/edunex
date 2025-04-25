// Main JavaScript file

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  if (typeof bootstrap !== 'undefined') {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Back to top button
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('show');
      } else {
        backToTopBtn.classList.remove('show');
      }
    });

    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
  
  // Initialize star rating
  initStarRating();
  
  // Handle product image gallery
  initProductGallery();
  
  // Handle quantity input
  initQuantityControls();
});

// Star rating functionality
function initStarRating() {
  const stars = document.querySelectorAll('.star-rating-item');
  const ratingInput = document.getElementById('rating-input');
  
  if (stars.length === 0 || !ratingInput) return;
  
  stars.forEach(star => {
    // Mouse over effect
    star.addEventListener('mouseover', function() {
      const rating = this.dataset.rating;
      highlightStars(rating);
    });
    
    // Mouse out effect
    star.addEventListener('mouseout', function() {
      const currentRating = ratingInput.value;
      highlightStars(currentRating);
    });
    
    // Click to select rating
    star.addEventListener('click', function() {
      const rating = this.dataset.rating;
      ratingInput.value = rating;
      highlightStars(rating);
    });
  });
  
  // Helper function to highlight stars based on rating
  function highlightStars(rating) {
    stars.forEach(star => {
      const starRating = star.dataset.rating;
      if (starRating <= rating) {
        star.classList.remove('far');
        star.classList.add('fas');
      } else {
        star.classList.remove('fas');
        star.classList.add('far');
      }
    });
  }
}

// Product image gallery
function initProductGallery() {
  const mainImg = document.getElementById('main-product-image');
  const thumbnails = document.querySelectorAll('.product-thumbnail');
  
  if (!mainImg || thumbnails.length === 0) return;
  
  thumbnails.forEach(img => {
    img.addEventListener('click', function() {
      // Remove active class from all thumbnails
      thumbnails.forEach(thumb => thumb.classList.remove('active'));
      
      // Add active class to clicked thumbnail
      this.classList.add('active');
      
      // Update main image
      mainImg.src = this.src;
    });
  });
}

// Quantity controls for product
function initQuantityControls() {
  const qtyInput = document.getElementById('quantity');
  const qtyUp = document.getElementById('qty-up') || document.getElementById('increase-quantity');
  const qtyDown = document.getElementById('qty-down') || document.getElementById('decrease-quantity');
  
  if (!qtyInput || !qtyUp || !qtyDown) return;
  
  qtyUp.addEventListener('click', () => {
    const maxQty = parseInt(qtyInput.getAttribute('max')) || 100;
    const currentValue = parseInt(qtyInput.value);
    
    if (currentValue < maxQty) {
      qtyInput.value = currentValue + 1;
    }
  });
  
  qtyDown.addEventListener('click', () => {
    const minQty = parseInt(qtyInput.getAttribute('min')) || 1;
    const currentValue = parseInt(qtyInput.value);
    
    if (currentValue > minQty) {
      qtyInput.value = currentValue - 1;
    }
  });
}

// Toast notification
function showToast(message, type = 'success') {
  // Use custom toast if defined in the page
  if (window.showCustomToast) {
    window.showCustomToast(message, type);
    return;
  }
  
  // Create a simple toast if not already defined
  const existingToast = document.querySelector('.toast-container');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
  toastContainer.style.zIndex = '1080';
  
  const toastElement = document.createElement('div');
  toastElement.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
  toastElement.setAttribute('role', 'alert');
  toastElement.setAttribute('aria-live', 'assertive');
  toastElement.setAttribute('aria-atomic', 'true');
  
  toastElement.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  toastContainer.appendChild(toastElement);
  document.body.appendChild(toastContainer);
  
  const toast = new bootstrap.Toast(toastElement, {
    delay: 3000
  });
  
  toast.show();
}

// Expose the showToast function globally
window.showToast = showToast; 