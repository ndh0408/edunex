document.addEventListener('DOMContentLoaded', function() {
  // Chart initialization if the element exists
  const salesChartCanvas = document.getElementById('salesChart');
  
  if (salesChartCanvas) {
    const monthlyRevenueData = JSON.parse(salesChartCanvas.dataset.revenue || '[]');
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    
    new Chart(salesChartCanvas, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Doanh thu (VNĐ)',
          data: monthlyRevenueData,
          backgroundColor: 'rgba(78, 115, 223, 0.05)',
          borderColor: 'rgba(78, 115, 223, 1)',
          pointBackgroundColor: 'rgba(78, 115, 223, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(78, 115, 223, 1)',
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 10,
            right: 25,
            top: 25,
            bottom: 0
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            ticks: {
              callback: function(value) {
                return value.toLocaleString('vi-VN') + ' ₫';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.raw.toLocaleString('vi-VN') + ' ₫';
              }
            }
          }
        }
      }
    });
  }
  
  // Product distribution chart
  const productChartCanvas = document.getElementById('productChart');
  
  if (productChartCanvas) {
    const categories = JSON.parse(productChartCanvas.dataset.categories || '[]');
    const productCounts = JSON.parse(productChartCanvas.dataset.counts || '[]');
    const backgroundColors = [
      '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796',
      '#5a5c69', '#6f42c1', '#fd7e14', '#20c9a6', '#84c33c', '#d4dce7'
    ];
    
    new Chart(productChartCanvas, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: productCounts,
          backgroundColor: backgroundColors.slice(0, categories.length),
          hoverBackgroundColor: backgroundColors.slice(0, categories.length).map(color => color + 'd0'),
          hoverBorderColor: 'rgba(234, 236, 244, 1)',
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        },
        cutout: '70%'
      }
    });
  }
  
  // Image preview for file uploads
  const imageUpload = document.querySelector('.image-upload');
  const previewContainer = document.querySelector('.image-preview-container');
  
  if (imageUpload && previewContainer) {
    imageUpload.addEventListener('change', function() {
      previewContainer.innerHTML = '';
      
      if (this.files) {
        Array.from(this.files).forEach(file => {
          if (!file.type.match('image.*')) return;
          
          const reader = new FileReader();
          
          reader.onload = function(e) {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview';
            previewDiv.innerHTML = `
              <img src="${e.target.result}" alt="Preview">
              <div class="remove-image"><i class="fas fa-times"></i></div>
            `;
            
            // Add remove functionality
            previewDiv.querySelector('.remove-image').addEventListener('click', function() {
              previewDiv.remove();
              // Note: This only removes the preview, not the actual file in input
            });
            
            previewContainer.appendChild(previewDiv);
          };
          
          reader.readAsDataURL(file);
        });
      }
    });
  }
  
  // Delete confirmations
  const deleteButtons = document.querySelectorAll('.delete-btn');
  
  if (deleteButtons.length > 0) {
    deleteButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        if (!confirm('Bạn có chắc chắn muốn xóa?')) {
          e.preventDefault();
        }
      });
    });
  }
  
  // Order status update
  const statusSelect = document.getElementById('orderStatus');
  const statusForm = document.getElementById('statusForm');
  
  if (statusSelect && statusForm) {
    statusSelect.addEventListener('change', function() {
      if (confirm('Bạn có chắc chắn muốn cập nhật trạng thái đơn hàng?')) {
        statusForm.submit();
      } else {
        // Reset to previous value if canceled
        this.value = this.getAttribute('data-original');
      }
    });
    
    // Store original value for cancellation
    statusSelect.setAttribute('data-original', statusSelect.value);
  }
  
  // Display current year in footer
  const yearEl = document.querySelector('.current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
  
  // DataTables initialization
  const dataTables = document.querySelectorAll('.datatable:not(.no-datatable)');
  if (dataTables.length > 0 && typeof $.fn.DataTable !== 'undefined') {
    console.log('Admin.js: Found tables for DataTables:', dataTables);
    dataTables.forEach(table => {
      console.log('Admin.js: Attempting to initialize DataTable on table:', table.id || table.className);
      $(table).DataTable({
        language: {
          search: "Tìm kiếm:",
          lengthMenu: "Hiển thị _MENU_ mục",
          info: "Hiển thị _START_ đến _END_ của _TOTAL_ mục",
          infoEmpty: "Hiển thị 0 đến 0 của 0 mục",
          infoFiltered: "(lọc từ _MAX_ mục)",
          paginate: {
            first: "Đầu",
            last: "Cuối",
            next: "Sau",
            previous: "Trước"
          }
        }
      });
    });
  }
  
  // Order payment update
  const markAsPaidButtons = document.querySelectorAll('.mark-as-paid');
  const paymentUpdateModal = document.getElementById('paymentUpdateModal');
  const confirmPaymentBtn = document.getElementById('confirm-payment-update');
  
  if (markAsPaidButtons.length > 0 && paymentUpdateModal && confirmPaymentBtn) {
    // Initialize the Bootstrap modal if available
    const paymentModal = new bootstrap.Modal(paymentUpdateModal);
    
    markAsPaidButtons.forEach(button => {
      button.addEventListener('click', function() {
        const orderId = this.getAttribute('data-order-id');
        confirmPaymentBtn.setAttribute('data-order-id', orderId);
        paymentModal.show();
      });
    });
    
    confirmPaymentBtn.addEventListener('click', function() {
      const orderId = this.getAttribute('data-order-id');
      const transactionId = document.getElementById('transaction-id').value;
      const note = document.getElementById('payment-note').value;
      
      // Send AJAX request to update payment status
      fetch(`/admin/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          transactionId,
          note
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Show success message and reload page
          alert(data.message || 'Cập nhật trạng thái thanh toán thành công');
          location.reload();
        } else {
          // Show error message
          alert(data.message || 'Có lỗi xảy ra khi cập nhật trạng thái thanh toán');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Có lỗi xảy ra khi xử lý yêu cầu');
      })
      .finally(() => {
        // Hide modal
        paymentModal.hide();
      });
    });
  }
  
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Initialize popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
  
  // Setup search if search input exists
  const searchInput = document.querySelector('.search-box input');
  const table = document.querySelector('table');
  if (searchInput && table) {
    setupSearch(searchInput, table);
  }
  
  // Setup file upload preview if file input exists
  const fileInput = document.querySelector('input[type="file"]');
  const preview = document.querySelector('.image-preview');
  if (fileInput && preview) {
    setupFileUploadPreview(fileInput, preview);
  }
});

// Toast notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Confirm delete
function confirmDelete(type, id) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirm Delete</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        Are you sure you want to delete this ${type}? This action cannot be undone.
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.querySelector('#confirmDeleteBtn').addEventListener('click', () => {
            bsModal.hide();
            resolve(true);
        });
        
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            resolve(false);
        });
    });
}

// Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('is-invalid');
            isValid = false;
        } else {
            input.classList.remove('is-invalid');
        }
    });
    
    return isValid;
}

// File upload preview
function setupFileUploadPreview(input, preview) {
    input.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            
            reader.readAsDataURL(this.files[0]);
        }
    });
}

// Search functionality
function setupSearch(input, table) {
    input.addEventListener('keyup', function() {
        const searchText = this.value.toLowerCase();
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchText) ? '' : 'none';
        });
    });
} 