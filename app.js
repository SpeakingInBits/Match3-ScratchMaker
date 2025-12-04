class Match3Maker {
    constructor() {
        this.circles = Array(12).fill(null); // 12 circles total (2 games)
        this.currentEditingIndex = null;
        this.currentImage = null;
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0;
        this.storageKey = 'match3circles_data';
        this.galleryStorageKey = 'match3gallery_images';
        this.titlesStorageKey = 'match3titles_data';
        this.galleryImages = []; // Store uploaded images
        this.titles = {
            'title-top': 'MATCH 3',
            'title-bottom': 'MATCH 3'
        };
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.loadTitles();
        this.loadGalleryImages();
        this.setupEventListeners();
        this.updateUI();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.circles = JSON.parse(stored);
            }
        } catch (err) {
            console.error('Error loading from storage:', err);
            this.circles = Array(12).fill(null);
        }
    }

    loadGalleryImages() {
        try {
            const stored = localStorage.getItem(this.galleryStorageKey);
            if (stored) {
                const imageDataArray = JSON.parse(stored);
                let loadedCount = 0;
                this.galleryImages = imageDataArray.map((dataUrl, index) => {
                    const img = new Image();
                    img.onload = () => {
                        loadedCount++;
                        // Render gallery once all images are loaded
                        if (loadedCount === imageDataArray.length) {
                            this.renderGallery();
                            document.getElementById('imageGallery').style.display = 'block';
                        }
                    };
                    img.src = dataUrl;
                    return {
                        data: dataUrl,
                        img: img
                    };
                });
            }
        } catch (err) {
            console.error('Error loading gallery images:', err);
            this.galleryImages = [];
        }
    }

    saveGalleryImages() {
        try {
            const imageDataArray = this.galleryImages.map(img => img.data);
            localStorage.setItem(this.galleryStorageKey, JSON.stringify(imageDataArray));
        } catch (err) {
            console.error('Error saving gallery images:', err);
            if (err.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please remove some images and try again.');
            }
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.circles));
            this.showSaveStatus('saved');
        } catch (err) {
            console.error('Error saving to storage:', err);
            this.showSaveStatus('error');
            if (err.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please remove some images and try again.');
            }
        }
    }

    loadTitles() {
        try {
            const saved = localStorage.getItem(this.titlesStorageKey);
            if (saved) {
                this.titles = JSON.parse(saved);
                // Update DOM elements with saved titles
                Object.keys(this.titles).forEach(key => {
                    const titleEl = document.querySelector(`[data-title-key="${key}"]`);
                    if (titleEl) {
                        titleEl.textContent = this.titles[key];
                    }
                });
            }
        } catch (err) {
            console.error('Error loading titles:', err);
        }
    }

    saveTitles() {
        try {
            // Get current title values from DOM
            document.querySelectorAll('[data-title-key]').forEach(titleEl => {
                const key = titleEl.getAttribute('data-title-key');
                this.titles[key] = titleEl.textContent;
            });
            localStorage.setItem(this.titlesStorageKey, JSON.stringify(this.titles));
            this.showSaveStatus('saved');
        } catch (err) {
            console.error('Error saving titles:', err);
            this.showSaveStatus('error');
        }
    }

    showSaveStatus(status) {
        const statusEl = document.getElementById('saveStatus');
        if (!statusEl) return;
        
        if (status === 'saved') {
            statusEl.textContent = '✓ Saved';
            statusEl.className = 'save-status saved';
            setTimeout(() => {
                statusEl.textContent = 'Auto-saving...';
                statusEl.className = 'save-status';
            }, 2000);
        } else if (status === 'error') {
            statusEl.textContent = '✗ Save Error';
            statusEl.className = 'save-status error';
        }
    }

    setupEventListeners() {
        // Modal elements
        const modal = document.getElementById('imageModal');
        const imageInput = document.getElementById('imageInput');
        const fileLabel = document.querySelector('.file-label');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        const canvas = document.getElementById('previewCanvas');

        // Control elements
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportToPDF());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());

        // Editable titles
        document.querySelectorAll('[data-title-key]').forEach(titleEl => {
            titleEl.addEventListener('blur', () => this.saveTitles());
            titleEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    titleEl.blur();
                }
            });
        });

        // Circle slots
        document.querySelectorAll('.circle-slot').forEach((slot, index) => {
            slot.addEventListener('click', () => this.openImageModal(index));
            slot.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
            slot.addEventListener('dragover', (e) => this.handleDragOver(e));
            slot.addEventListener('drop', (e) => this.handleDrop(e, index));
            slot.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            slot.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        });

        // File input
        imageInput.addEventListener('change', (e) => this.handleImageSelect(e));

        // Modal controls
        closeBtn.addEventListener('click', () => this.closeImageModal());
        cancelBtn.addEventListener('click', () => this.closeImageModal());
        confirmBtn.addEventListener('click', () => this.confirmImage());

        // Zoom slider
        document.getElementById('zoomSlider').addEventListener('input', (e) => {
            this.zoom = parseFloat(e.target.value);
            document.getElementById('zoomValue').textContent = Math.round(this.zoom * 100) + '%';
            this.updatePreview();
        });

        // Canvas drag controls
        canvas.addEventListener('mousedown', (e) => this.startDrag(e));
        canvas.addEventListener('mousemove', (e) => this.drag(e));
        canvas.addEventListener('mouseup', () => this.endDrag());
        canvas.addEventListener('mouseleave', () => this.endDrag());
        canvas.addEventListener('wheel', (e) => this.handleScroll(e));

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeImageModal();
            }
        });
    }

    startDrag(e) {
        if (!this.currentImage) return;
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartOffsetX = this.offsetX;
        this.dragStartOffsetY = this.offsetY;
        document.getElementById('previewCanvas').style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging || !this.currentImage) return;
        
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;
        
        this.offsetX = this.dragStartOffsetX + deltaX;
        this.offsetY = this.dragStartOffsetY + deltaY;
        
        this.updatePreview();
    }

    endDrag() {
        this.isDragging = false;
        document.getElementById('previewCanvas').style.cursor = 'grab';
    }

    handleScroll(e) {
        if (!this.currentImage) return;
        e.preventDefault();
        
        const scrollSpeed = 0.1;
        const zoomChange = e.deltaY > 0 ? -scrollSpeed : scrollSpeed;
        const newZoom = Math.max(0.5, Math.min(3, this.zoom + zoomChange));
        
        document.getElementById('zoomSlider').value = newZoom;
        this.zoom = newZoom;
        document.getElementById('zoomValue').textContent = Math.round(this.zoom * 100) + '%';
        this.updatePreview();
    }

    handleDragStart(e, index) {
        if (!this.circles[index]) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify({
            zoom: this.circles[index].zoom,
            offsetX: this.circles[index].offsetX,
            offsetY: this.circles[index].offsetY,
            image: this.circles[index].image
        }));
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleDragEnter(e) {
        if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('galleryImageIndex')) {
            e.target.style.opacity = '0.7';
        }
    }

    handleDragLeave(e) {
        e.target.style.opacity = '1';
    }

    handleDrop(e, index) {
        e.preventDefault();
        e.target.style.opacity = '1';
        
        try {
            // Check if it's a gallery image
            const galleryIndex = e.dataTransfer.getData('galleryImageIndex');
            if (galleryIndex !== '') {
                const galleryImg = this.galleryImages[parseInt(galleryIndex)];
                if (galleryImg) {
                    this.currentEditingIndex = index;
                    this.currentImage = galleryImg.img;
                    // Reset zoom and position for new image
                    this.zoom = 1;
                    this.offsetX = 0;
                    this.offsetY = 0;
                    document.getElementById('zoomSlider').value = 1;
                    document.getElementById('zoomValue').textContent = '100%';
                    
                    // Render preview and show modal with preview section
                    this.updatePreview();
                    document.getElementById('previewSection').style.display = 'flex';
                    document.getElementById('imageModal').style.display = 'block';
                }
                return;
            }
            
            // Original circle-to-circle drag
            const data = e.dataTransfer.getData('application/json');
            if (!data) return;
            
            const circleData = JSON.parse(data);
            this.circles[index] = circleData;
            this.updateUI();
            this.saveToStorage();
        } catch (err) {
            console.error('Error dropping circle:', err);
        }
    }

    openImageModal(index) {
        this.currentEditingIndex = index;
        document.getElementById('imageModal').style.display = 'block';
        document.getElementById('previewSection').style.display = 'flex';
        
        // Reset position and zoom
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        document.getElementById('zoomSlider').value = 1;
        document.getElementById('zoomValue').textContent = '100%';
    }

    closeImageModal() {
        document.getElementById('imageModal').style.display = 'none';
        this.currentEditingIndex = null;
        this.currentImage = null;
    }

    handleImageSelect(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Clear previous gallery images
        this.galleryImages = [];

        // Process all selected files
        let loadedCount = 0;
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    this.galleryImages.push({
                        data: event.target.result,
                        img: img
                    });
                    loadedCount++;
                    
                    // Show gallery when all images are loaded
                    if (loadedCount === files.length) {
                        this.renderGallery();
                        this.saveGalleryImages();
                        document.getElementById('imageGallery').style.display = 'block';
                        document.getElementById('previewSection').style.display = 'none';
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    renderGallery() {
        const galleryContainer = document.getElementById('galleryContainer');
        galleryContainer.innerHTML = '';

        this.galleryImages.forEach((imgData, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-image';
            galleryItem.draggable = true;
            galleryItem.dataset.galleryIndex = index;

            const img = document.createElement('img');
            img.src = imgData.data;
            galleryItem.appendChild(img);

            // Drag event for gallery images
            galleryItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('galleryImageIndex', index.toString());
            });

            galleryContainer.appendChild(galleryItem);
        });
    }

    updatePreview() {
        if (!this.currentImage) return;

        const canvas = document.getElementById('previewCanvas');
        const ctx = canvas.getContext('2d');
        const radius = canvas.width / 2;

        // Clear canvas completely
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save context state
        ctx.save();

        // Draw circular clipping path
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.clip();

        // Calculate image dimensions maintaining aspect ratio
        const img = this.currentImage;
        const imgAspect = img.width / img.height;
        
        // Scale image to fit in circle while maintaining aspect ratio
        let drawWidth, drawHeight;
        const circleDiameter = canvas.width * this.zoom;
        
        if (imgAspect > 1) {
            // Image is wider than tall
            drawHeight = circleDiameter;
            drawWidth = drawHeight * imgAspect;
        } else {
            // Image is taller than wide
            drawWidth = circleDiameter;
            drawHeight = drawWidth / imgAspect;
        }

        // Center the image and apply offset
        const x = (canvas.width - drawWidth) / 2 + this.offsetX;
        const y = (canvas.height - drawHeight) / 2 + this.offsetY;

        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        
        // Restore context state
        ctx.restore();
        
        // Draw circle border
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    confirmImage() {
        if (!this.currentImage) return;

        const canvas = document.getElementById('previewCanvas');
        const imageData = canvas.toDataURL('image/png');

        this.circles[this.currentEditingIndex] = {
            image: imageData,
            zoom: this.zoom,
            offsetX: this.offsetX,
            offsetY: this.offsetY
        };

        this.updateUI();
        this.saveToStorage();
        this.closeImageModal();
    }

    addCircle() {
        const emptyIndex = this.circles.findIndex(c => c === null);
        if (emptyIndex !== -1) {
            this.openImageModal(emptyIndex);
        } else {
            alert('All 12 circles are filled!');
        }
    }

    removeCircle(index) {
        this.circles[index] = null;
        this.updateUI();
        this.saveToStorage();
    }

    resetAll() {
        if (confirm('Are you sure you want to remove all images?')) {
            this.circles = Array(12).fill(null);
            this.galleryImages = [];
            document.getElementById('imageGallery').style.display = 'none';
            document.getElementById('galleryContainer').innerHTML = '';
            document.getElementById('imageInput').value = '';
            this.updateUI();
            this.saveToStorage();
            this.saveGalleryImages();
        }
    }

    updateUI() {
        // Update circle slots
        document.querySelectorAll('.circle-slot').forEach((slot, index) => {
            slot.innerHTML = '';
            if (this.circles[index]) {
                const img = document.createElement('img');
                img.src = this.circles[index].image;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '50%';
                img.style.display = 'block';
                slot.appendChild(img);
                slot.classList.remove('empty');
            } else {
                slot.classList.add('empty');
            }
        });
    }

    exportToPDF() {
        const element = document.getElementById('pdfPreview');
        
        const opt = {
            margin: 0,
            filename: 'match3_circles.pdf',
            image: { type: 'png', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, allowTaint: true },
            jsPDF: { format: 'letter', orientation: 'portrait', unit: 'in' }
        };

        html2pdf().set(opt).from(element).save();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Match3Maker();
});
