console.log('Script tag executed.'); // Log 1: Script start

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired.'); // Log 2: DOM ready

    // References
    const categoryFilter = document.getElementById('category-filter');
    console.log('[Status Filter] Attempting to find element...'); // Log 3: Before getElementById
    const statusFilter = document.getElementById('status-filter');
    console.log('[Status Filter] Element found:', statusFilter); // Log 4: After getElementById

    const searchInput = document.querySelector('input[name="search"]');
    const searchForm = document.querySelector('form[action="/admin/products"]'); // Assuming form exists for search
    const resetFilterBtn = document.getElementById('reset-filter'); // Assuming reset button exists
    const productsTableBody = document.querySelector('#productsTable tbody'); // Ensure your table has id="productsTable"
    const paginationContainer = document.querySelector('.pagination'); // Ensure pagination container exists
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    // --- Fetch and Render Logic ---
    async function fetchProducts(page = 1) {
        const category = categoryFilter ? categoryFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';
        const search = searchInput ? searchInput.value : '';

        console.log('[fetchProducts] Params before fetch:', {category, status, search, page}); // <<< Added log

        const queryParams = new URLSearchParams();
        queryParams.set('page', page);
        if (category) queryParams.set('category', category);
        if (status) queryParams.set('status', status);
        if (search) queryParams.set('search', search);

        const url = `/admin/products?${queryParams.toString()}`;
        console.log('[Fetch Products] Fetching URL:', url);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[Fetch Products] Data received:', data);

            renderProductTable(data.products);
            renderPagination(data.currentPage, data.totalPages);
            history.pushState({ page: data.currentPage }, `Trang ${data.currentPage}`, url);

        } catch (error) {
            console.error('[Fetch Products] Error fetching products:', error);
            if(productsTableBody) productsTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Lỗi tải dữ liệu sản phẩm.</td></tr>'; // Updated colspan
            if(paginationContainer) paginationContainer.innerHTML = '';
        }
    }

    function renderProductTable(products) {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = ''; // Clear existing

        if (!products || products.length === 0) {
            productsTableBody.innerHTML = '<tr><td colspan="9" class="text-center">Không tìm thấy sản phẩm nào.</td></tr>'; // Updated colspan
            return;
        }

        products.forEach(product => {
            const imageUrl = product.images && product.images.length > 0 ? `/uploads/${product.images[0]}` : '/img/default-product.jpg';
            const row = `
                <tr>
                    <td class="text-center">
                        <img src="${imageUrl}" alt="${product.name}" class="img-thumbnail" style="width: 50px; height: 50px; object-fit: cover;">
                    </td>
                    <td>${product.name}</td>
                    <td>${product.category ? product.category.name : 'N/A'}</td>
                    <td>${(product.price || 0).toLocaleString('vi-VN')} ₫</td>
                    <td>${product.countInStock || 0}</td>
                    <td>
                        <span class="badge bg-${product.status === 'published' ? 'success' : product.status === 'draft' ? 'warning text-dark' : 'danger'}">
                            ${product.status === 'published' ? 'Đã xuất bản' : product.status === 'draft' ? 'Bản nháp' : 'Hết hàng'}
                        </span>
                    </td>
                    <td>${product.sold || 0}</td> <!-- Added Sold Column -->
                    <td>${new Date(product.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td>
                        <div class="btn-group">
                            <a href="/admin/products/${product._id}/edit" class="btn btn-sm btn-info" title="Sửa">
                                <i class="fas fa-edit"></i>
                            </a>
                             <a href="/products/${product.slug}" target="_blank" class="btn btn-sm btn-primary">
                                <i class="fas fa-eye"></i>
                             </a>
                            <button class="btn btn-sm btn-danger delete-product-btn" data-id="${product._id}" data-name="${product.name}" title="Xóa">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            productsTableBody.insertAdjacentHTML('beforeend', row);
        });

        attachDeleteListeners(); // Attach listeners to new delete buttons
    }

    // --- Render Pagination (Similar to orders) ---
    function renderPagination(currentPage, totalPages) {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        let paginationHTML = '';
        paginationHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}">&laquo;</a></li>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        paginationHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}">&raquo;</a></li>`;
        paginationContainer.innerHTML = paginationHTML;
    }

    // --- Delete Product Logic ---
    function attachDeleteListeners() {
        document.querySelectorAll('.delete-product-btn').forEach(button => {
            // Remove old listener before adding new
            button.removeEventListener('click', handleDeleteClick);
            button.addEventListener('click', handleDeleteClick);
        });
    }

    function handleDeleteClick() {
        const productId = this.dataset.id;
        const productName = this.dataset.name;

        if (!productId || !csrfToken) {
            alert('Lỗi: Không tìm thấy ID sản phẩm hoặc token bảo mật.');
            console.error('CSRF Token missing or Product ID missing', {productId, csrfToken});
            return;
        }

        if (confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${productName}" không? Hành động này không thể hoàn tác.`)) {
            fetch(`/admin/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.ok ? response.json() : response.json().then(err => Promise.reject(err)))
            .then(data => {
                if (data.success) {
                    // Consider using a less intrusive notification like a toast
                    // alert(data.message);
                    console.log('Product deleted successfully');
                    fetchProducts(document.querySelector('.pagination .active a')?.dataset.page || 1); // Refresh current page
                } else {
                    alert(`Lỗi: ${data.message || 'Không thể xóa sản phẩm.'}`);
                }
            })
            .catch(error => {
                console.error('Lỗi xóa sản phẩm:', error);
                alert(`Lỗi: ${error.message || 'Vui lòng thử lại.'}`);
            });
        }
    }

    // --- Event Listeners ---
    console.log('[Event Listeners] Setting up listeners...');
    if(categoryFilter) categoryFilter.addEventListener('change', () => fetchProducts(1));
    
    if(statusFilter) {
        console.log('[Status Filter] Attaching change listener.'); // Log 5: Before addEventListener
        statusFilter.addEventListener('change', () => {
            console.log('[Status Filter] Change event fired. Value:', statusFilter.value); // Log 6: Inside listener
            fetchProducts(1);
        });
        console.log('[Status Filter] Change listener attached.'); // Log 7: After addEventListener
    } else {
        console.log('[Status Filter] Element not found, cannot attach listener.'); // Log 8: If element is null
    }
    
    if(searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            fetchProducts(1);
        });
    }
    if(resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            if(categoryFilter) categoryFilter.value = '';
            if(statusFilter) statusFilter.value = '';
            if(searchInput) searchInput.value = '';
            fetchProducts(1);
        });
    }
    if(paginationContainer) {
        paginationContainer.addEventListener('click', (event) => {
            event.preventDefault();
            const target = event.target.closest('a.page-link');
            if (target && target.dataset.page) {
                const page = parseInt(target.dataset.page, 10);
                if (!isNaN(page)) {
                    fetchProducts(page);
                }
            }
        });
    }

    console.log('[Event Listeners] Listeners setup complete.');

    // Initial load
    console.log('[Initial Load] Calling fetchProducts...');
    fetchProducts();
    console.log('[Initial Load] fetchProducts call finished.');

}); 