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
        this.dbName = 'Match3MakerDB';
        this.dbVersion = 1;
        this.db = null;
        this.galleryImages = []; // Store uploaded images
        this.titles = {
            'title-top': 'MATCH 3',
            'title-bottom': 'MATCH 3'
        };
        this.backgrounds = {
            'top': null,
            'bottom': null
        };
        // Quick Card Generation state (gallery indices)
        this.quickCards = {
            selected: new Set(),
            primary: null,
            adjustments: {}, // gallery index -> { zoom, offsetX, offsetY, image }
            busy: false
        };
        this.quickEditingIndex = null; // gallery index being adjusted for quick cards
        
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                this.init();
                resolve();
            };
            
            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                
                // Create object stores if they don't exist
                if (!this.db.objectStoreNames.contains('circles')) {
                    this.db.createObjectStore('circles', { keyPath: 'id' });
                }
                if (!this.db.objectStoreNames.contains('gallery')) {
                    this.db.createObjectStore('gallery', { keyPath: 'id' });
                }
                if (!this.db.objectStoreNames.contains('settings')) {
                    this.db.createObjectStore('settings', { keyPath: 'id' });
                }
            };
        });
    }

    async init() {
        await this.loadFromStorage();
        await this.loadTitles();
        await this.loadBackgrounds();
        await this.loadGalleryImages();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadFromStorage() {
        try {
            const transaction = this.db.transaction(['circles'], 'readonly');
            const objectStore = transaction.objectStore('circles');
            const request = objectStore.get('circlesData');
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result) {
                        this.circles = request.result.data;
                    }
                    resolve();
                };
                request.onerror = () => {
                    console.error('Error loading circles');
                    this.circles = Array(12).fill(null);
                    resolve();
                };
            });
        } catch (err) {
            console.error('Error loading from storage:', err);
            this.circles = Array(12).fill(null);
        }
    }

    async loadGalleryImages() {
        try {
            const transaction = this.db.transaction(['gallery'], 'readonly');
            const objectStore = transaction.objectStore('gallery');
            const request = objectStore.get('galleryData');
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result) {
                        const imageDataArray = request.result.data;
                        let settledCount = 0;
                        const onSettled = () => {
                            settledCount++;
                            if (settledCount === imageDataArray.length) {
                                this.renderGallery();
                            }
                        };
                        this.galleryImages = imageDataArray.map((dataUrl) => {
                            const img = new Image();
                            img.onload = onSettled;
                            img.onerror = onSettled;
                            img.src = dataUrl;
                            return { data: dataUrl, img: img };
                        });
                    }
                    // Always show gallery
                    document.getElementById('imageGallery').style.display = 'block';
                    resolve();
                };
                request.onerror = () => {
                    console.error('Error loading gallery');
                    this.galleryImages = [];
                    document.getElementById('imageGallery').style.display = 'block';
                    resolve();
                };
            });
        } catch (err) {
            console.error('Error loading gallery images:', err);
            this.galleryImages = [];
            document.getElementById('imageGallery').style.display = 'block';
        }
    }

    async saveGalleryImages() {
        try {
            const transaction = this.db.transaction(['gallery'], 'readwrite');
            const objectStore = transaction.objectStore('gallery');
            const imageDataArray = this.galleryImages.map(img => img.data);
            objectStore.put({ id: 'galleryData', data: imageDataArray });
            
            transaction.oncomplete = () => {
                this.showSaveStatus('saved');
            };
            transaction.onerror = () => {
                console.error('Error saving gallery');
                this.showSaveStatus('error');
            };
        } catch (err) {
            console.error('Error saving gallery images:', err);
            this.showSaveStatus('error');
        }
    }

    async saveToStorage() {
        try {
            const transaction = this.db.transaction(['circles'], 'readwrite');
            const objectStore = transaction.objectStore('circles');
            objectStore.put({ id: 'circlesData', data: this.circles });
            
            transaction.oncomplete = () => {
                this.showSaveStatus('saved');
            };
            transaction.onerror = () => {
                console.error('Error saving circles');
                this.showSaveStatus('error');
            };
        } catch (err) {
            console.error('Error saving to storage:', err);
            this.showSaveStatus('error');
        }
    }

    async loadTitles() {
        try {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const objectStore = transaction.objectStore('settings');
            const request = objectStore.get('titlesData');
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result) {
                        this.titles = request.result.data;
                        Object.keys(this.titles).forEach(key => {
                            const titleEl = document.querySelector(`[data-title-key="${key}"]`);
                            if (titleEl) {
                                titleEl.textContent = this.titles[key];
                            }
                        });
                    }
                    resolve();
                };
                request.onerror = () => {
                    console.error('Error loading titles');
                    resolve();
                };
            });
        } catch (err) {
            console.error('Error loading titles:', err);
        }
    }

    async saveTitles() {
        try {
            document.querySelectorAll('[data-title-key]').forEach(titleEl => {
                const key = titleEl.getAttribute('data-title-key');
                this.titles[key] = titleEl.textContent;
            });
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const objectStore = transaction.objectStore('settings');
            objectStore.put({ id: 'titlesData', data: this.titles });
            
            transaction.oncomplete = () => {
                this.showSaveStatus('saved');
            };
            transaction.onerror = () => {
                console.error('Error saving titles');
                this.showSaveStatus('error');
            };
        } catch (err) {
            console.error('Error saving titles:', err);
            this.showSaveStatus('error');
        }
    }

    async loadBackgrounds() {
        try {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const objectStore = transaction.objectStore('settings');
            const request = objectStore.get('backgroundsData');
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result) {
                        this.backgrounds = request.result.data;
                        this.applyBackgrounds();
                    }
                    resolve();
                };
                request.onerror = () => {
                    console.error('Error loading backgrounds');
                    resolve();
                };
            });
        } catch (err) {
            console.error('Error loading backgrounds:', err);
        }
    }

    async saveBackgrounds() {
        try {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const objectStore = transaction.objectStore('settings');
            objectStore.put({ id: 'backgroundsData', data: this.backgrounds });
            
            transaction.oncomplete = () => {
                this.showSaveStatus('saved');
            };
            transaction.onerror = () => {
                console.error('Error saving backgrounds');
                this.showSaveStatus('error');
            };
        } catch (err) {
            console.error('Error saving backgrounds:', err);
            this.showSaveStatus('error');
        }
    }

    applyBackgrounds() {
        const applyTo = (selector, url) => {
            if (!url) return;
            const el = document.querySelector(selector);
            if (!el) return;
            el.style.backgroundImage = `url(${url})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        };
        applyTo('.match3-top', this.backgrounds.top);
        applyTo('.match3-bottom', this.backgrounds.bottom);
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
        document.getElementById('quickCardsBtn').addEventListener('click', () => this.openQuickCardsModal());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());

        // Quick Card Generation modal
        const quickModal = document.getElementById('quickCardsModal');
        document.getElementById('quickCardsClose').addEventListener('click', () => this.closeQuickCardsModal());
        document.getElementById('quickCancelBtn').addEventListener('click', () => this.closeQuickCardsModal());
        document.getElementById('quickGenerateBtn').addEventListener('click', () => this.generateQuickCards());
        document.getElementById('quickPageCount').addEventListener('input', () => this.updateQuickCardsSummary());

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
            if (e.target === quickModal) {
                this.closeQuickCardsModal();
            }
        });

        // Background drag and drop
        document.querySelectorAll('.match3-page').forEach((page, index) => {
            const bgKey = index === 0 ? 'top' : 'bottom';
            
            page.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const galleryIndex = e.dataTransfer.getData('galleryImageIndex');
                if (galleryIndex !== '') {
                    e.dataTransfer.dropEffect = 'copy';
                    page.classList.add('drag-over-bg');
                }
            });
            
            page.addEventListener('dragleave', (e) => {
                if (e.target === page) {
                    page.classList.remove('drag-over-bg');
                }
            });
            
            page.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                page.classList.remove('drag-over-bg');
                
                // Check if dropping from gallery
                const galleryIndex = e.dataTransfer.getData('galleryImageIndex');
                if (galleryIndex !== '') {
                    const imgData = this.galleryImages[parseInt(galleryIndex)];
                    if (imgData) {
                        this.backgrounds[bgKey] = imgData.data;
                        this.applyBackgrounds();
                        this.saveBackgrounds();
                    }
                }
            });
            
            page.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (this.backgrounds[bgKey]) {
                    if (confirm('Remove background image?')) {
                        this.backgrounds[bgKey] = null;
                        page.style.backgroundImage = '';
                        this.saveBackgrounds();
                    }
                }
            });
        });

        // Gallery drop zone drag and drop
        const galleryDropZone = document.getElementById('galleryDropZone');
        if (galleryDropZone) {
            galleryDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                galleryDropZone.classList.add('drag-over');
            });

            galleryDropZone.addEventListener('dragleave', (e) => {
                if (e.target === galleryDropZone) {
                    galleryDropZone.classList.remove('drag-over');
                }
            });

            galleryDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                galleryDropZone.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    this.handleImageSelect({ target: { files: files } });
                }
            });

            // Click to upload
            galleryDropZone.addEventListener('click', () => {
                document.getElementById('imageInput').click();
            });
        }
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
        e.stopPropagation();
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
        const circleData = this.circles[index];
        const modal = document.getElementById('imageModal');
        const previewSection = document.getElementById('previewSection');
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomValue = document.getElementById('zoomValue');

        // Reset defaults
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        zoomSlider.value = 1;
        zoomValue.textContent = '100%';

        // Load existing image into the modal if present
        if (circleData && circleData.image) {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                // Restore saved transform if present
                this.zoom = circleData.zoom || 1;
                this.offsetX = circleData.offsetX || 0;
                this.offsetY = circleData.offsetY || 0;
                zoomSlider.value = this.zoom;
                zoomValue.textContent = Math.round(this.zoom * 100) + '%';
                this.updatePreview();
            };
            img.src = circleData.image;
            previewSection.style.display = 'flex';
        } else {
            // Nothing to edit
            this.currentImage = null;
            previewSection.style.display = 'none';
        }

        modal.style.display = 'block';
    }

    closeImageModal() {
        document.getElementById('imageModal').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';
        this.currentEditingIndex = null;
        this.quickEditingIndex = null;
        this.currentImage = null;
    }

    handleImageSelect(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Process all selected files (append to existing gallery)
        let settledCount = 0;
        const totalFiles = files.length;
        const onSettled = () => {
            settledCount++;
            // Refresh gallery once every file has loaded (or failed)
            if (settledCount === totalFiles) {
                this.renderGallery();
                this.saveGalleryImages();
                document.getElementById('imageGallery').style.display = 'block';
                document.getElementById('previewSection').style.display = 'none';
            }
        };
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    this.galleryImages.push({
                        data: event.target.result,
                        img: img
                    });
                    onSettled();
                };
                img.onerror = onSettled;
                img.src = event.target.result;
            };
            reader.onerror = onSettled;
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

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

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

    /**
     * Crop `img` into a circular PNG data URL using the same zoom/offset maths
     * as the adjustment modal preview. `size` is the output diameter in px.
     */
    renderCircleImage(img, zoom = 1, offsetX = 0, offsetY = 0, size = 600) {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = size;
        finalCanvas.height = size;
        const finalCtx = finalCanvas.getContext('2d');
        const radius = size / 2;

        // Enable high-quality image smoothing
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';

        // Draw only the circular portion
        finalCtx.save();
        finalCtx.beginPath();
        finalCtx.arc(radius, radius, radius, 0, Math.PI * 2);
        finalCtx.clip();

        // Calculate image dimensions maintaining aspect ratio
        const imgAspect = img.width / img.height;
        let drawWidth, drawHeight;
        const circleDiameter = size * zoom;
        
        if (imgAspect > 1) {
            drawHeight = circleDiameter;
            drawWidth = drawHeight * imgAspect;
        } else {
            drawWidth = circleDiameter;
            drawHeight = drawWidth / imgAspect;
        }

        const x = (size - drawWidth) / 2 + offsetX;
        const y = (size - drawHeight) / 2 + offsetY;

        finalCtx.drawImage(img, x, y, drawWidth, drawHeight);
        finalCtx.restore();

        return finalCanvas.toDataURL('image/png', 1.0);
    }

    confirmImage() {
        if (!this.currentImage) return;

        const canvas = document.getElementById('previewCanvas');
        const imageData = this.renderCircleImage(
            this.currentImage, this.zoom, this.offsetX, this.offsetY, canvas.width
        );

        // Adjusting a gallery image for Quick Cards: remember the crop instead
        // of writing to an editor circle.
        if (this.quickEditingIndex !== null) {
            this.quickCards.adjustments[this.quickEditingIndex] = {
                image: imageData,
                zoom: this.zoom,
                offsetX: this.offsetX,
                offsetY: this.offsetY
            };
            this.refreshQuickTile(this.quickEditingIndex);
            this.closeImageModal();
            return;
        }

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
        if (confirm('Are you sure you want to remove all images, backgrounds, and titles?')) {
            this.circles = Array(12).fill(null);
            this.galleryImages = [];
            this.backgrounds = { 'top': null, 'bottom': null };
            this.titles = {
                'title-top': 'MATCH 3',
                'title-bottom': 'MATCH 3'
            };
            this.quickCards.selected = new Set();
            this.quickCards.primary = null;
            this.quickCards.adjustments = {};
            document.getElementById('galleryContainer').innerHTML = '';
            document.getElementById('imageInput').value = '';
            document.querySelectorAll('.match3-page').forEach(page => {
                page.style.backgroundImage = '';
            });
            document.querySelectorAll('[data-title-key]').forEach(titleEl => {
                const key = titleEl.getAttribute('data-title-key');
                titleEl.textContent = this.titles[key];
            });
            this.updateUI();
            this.saveToStorage();
            this.saveGalleryImages();
            this.saveBackgrounds();
            this.saveTitles();
        }
    }

    updateUI() {
        // Update circle slots
        document.querySelectorAll('.circle-slot').forEach((slot, index) => {
            slot.innerHTML = '';
            if (this.circles[index]) {
                const img = document.createElement('img');
                img.src = this.circles[index].image;
                // Sizing/shape comes from the `.circle-slot img` CSS rule so the
                // scratch-sticker gap stays consistent on screen and in the PDF.
                slot.appendChild(img);
                slot.classList.remove('empty');
            } else {
                slot.classList.add('empty');
            }
        });
    }

    /** html2pdf options shared by every export. */
    getPdfExportOptions(filename) {
        return {
            margin: 0,
            filename: filename,
            image: { type: 'png', quality: 1.0 },
            html2canvas: { 
                scale: 3, 
                useCORS: true, 
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                letterRendering: true
            },
            // Lossless Flate compression keeps multi-page exports to a sane size
            jsPDF: { format: 'letter', orientation: 'portrait', unit: 'in', compress: true }
        };
    }

    /**
     * Put the document into export mode and force inline title styles that
     * html2canvas renders reliably. Returns a function that undoes it all.
     */
    beginExportMode(roots) {
        document.body.classList.add('exporting');
        const titles = [];
        roots.forEach(root => titles.push(...root.querySelectorAll('.match3-page h2')));
        const originalStyles = titles.map(title => title.style.cssText);
        titles.forEach(title => {
            title.style.cssText += 'color: #ff1493 !important; font-weight: bold !important; text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.3) !important; font-size: 40pt !important;';
        });
        return () => {
            titles.forEach((title, index) => {
                title.style.cssText = originalStyles[index];
            });
            document.body.classList.remove('exporting');
        };
    }

    exportToPDF() {
        const element = document.getElementById('pdfPreview');
        const restore = this.beginExportMode([element]);
        const opt = this.getPdfExportOptions('match3_circles.pdf');

        html2pdf().set(opt).from(element).save().then(restore).catch((err) => {
            console.error('PDF export failed', err);
            restore();
        });
    }

    // ------------------------------------------------------------------
    // Quick Card Generation (issue #2)
    // ------------------------------------------------------------------

    openQuickCardsModal() {
        const modal = document.getElementById('quickCardsModal');
        const emptyNotice = document.getElementById('quickCardsEmpty');
        const form = document.getElementById('quickCardsForm');
        const status = document.getElementById('quickCardsStatus');

        // Drop any selections that no longer exist in the gallery
        this.quickCards.selected = new Set(
            [...this.quickCards.selected].filter(i => i < this.galleryImages.length)
        );
        if (this.quickCards.primary !== null && !this.quickCards.selected.has(this.quickCards.primary)) {
            this.quickCards.primary = null;
        }
        Object.keys(this.quickCards.adjustments).forEach(key => {
            if (parseInt(key, 10) >= this.galleryImages.length) {
                delete this.quickCards.adjustments[key];
            }
        });

        const hasEnough = this.galleryImages.length >= 2;
        emptyNotice.hidden = hasEnough;
        form.hidden = !hasEnough;
        status.hidden = true;
        status.textContent = '';
        status.classList.remove('error');

        this.renderQuickImageGrid();
        this.updateQuickCardsSummary();
        modal.style.display = 'block';
    }

    closeQuickCardsModal() {
        if (this.quickCards.busy) return;
        document.getElementById('quickCardsModal').style.display = 'none';
    }

    renderQuickImageGrid() {
        const grid = document.getElementById('quickImageGrid');
        grid.innerHTML = '';

        this.galleryImages.forEach((imgData, index) => {
            const item = document.createElement('div');
            item.className = 'quick-image';
            item.dataset.galleryIndex = index;
            item.setAttribute('role', 'button');
            item.title = 'Click to select';

            const img = document.createElement('img');
            img.src = imgData.data;
            item.appendChild(img);

            const check = document.createElement('span');
            check.className = 'quick-check';
            check.textContent = '\u2713';
            item.appendChild(check);

            const tools = document.createElement('div');
            tools.className = 'quick-tools';

            const adjust = document.createElement('button');
            adjust.type = 'button';
            adjust.className = 'quick-tool quick-adjust';
            adjust.title = 'Adjust zoom and position';
            adjust.setAttribute('aria-label', 'Adjust zoom and position');
            adjust.textContent = '\u270E';
            adjust.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openQuickAdjustModal(index);
            });
            tools.appendChild(adjust);

            const star = document.createElement('button');
            star.type = 'button';
            star.className = 'quick-tool quick-star';
            star.title = 'Use as the match image on every card';
            star.setAttribute('aria-label', 'Use as the match image on every card');
            star.textContent = '\u2605';
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleQuickPrimary(index);
            });
            tools.appendChild(star);
            item.appendChild(tools);

            const badge = document.createElement('span');
            badge.className = 'quick-badge';
            badge.textContent = 'MATCH';
            item.appendChild(badge);

            item.addEventListener('click', () => this.toggleQuickSelection(index));
            grid.appendChild(item);
        });

        this.refreshQuickImageStates();
    }

    toggleQuickSelection(index) {
        if (this.quickCards.busy) return;
        if (this.quickCards.selected.has(index)) {
            this.quickCards.selected.delete(index);
            if (this.quickCards.primary === index) {
                this.quickCards.primary = null;
            }
        } else {
            this.quickCards.selected.add(index);
        }
        this.refreshQuickImageStates();
        this.updateQuickCardsSummary();
    }

    toggleQuickPrimary(index) {
        if (this.quickCards.busy) return;
        if (!this.quickCards.selected.has(index)) return;
        this.quickCards.primary = this.quickCards.primary === index ? null : index;
        this.refreshQuickImageStates();
        this.updateQuickCardsSummary();
    }

    refreshQuickImageStates() {
        document.querySelectorAll('#quickImageGrid .quick-image').forEach(item => {
            const index = parseInt(item.dataset.galleryIndex, 10);
            item.classList.toggle('selected', this.quickCards.selected.has(index));
            item.classList.toggle('primary', this.quickCards.primary === index);
            this.refreshQuickTile(index, item);
        });
    }

    /**
     * Show the circular crop that will be printed on selected tiles, and the
     * raw gallery image on unselected ones.
     */
    refreshQuickTile(index, item) {
        item = item || document.querySelector(`#quickImageGrid .quick-image[data-gallery-index="${index}"]`);
        if (!item) return;
        const img = item.querySelector('img');
        const crop = this.quickCards.selected.has(index) ? this.getQuickCrop(index) : null;
        item.classList.toggle('cropped', !!crop);
        img.src = crop || this.galleryImages[index].data;
    }

    /**
     * Cropped circle image for a gallery index, honouring any zoom/position
     * the user set via the adjust modal. Falls back to a centred, 100% crop.
     * Returns null if the gallery image hasn't finished loading yet.
     */
    getQuickCrop(index) {
        const existing = this.quickCards.adjustments[index];
        if (existing) return existing.image;
        const galleryImg = this.galleryImages[index];
        if (!galleryImg || !galleryImg.img.complete || !galleryImg.img.naturalWidth) return null;
        const image = this.renderCircleImage(galleryImg.img);
        this.quickCards.adjustments[index] = { image, zoom: 1, offsetX: 0, offsetY: 0 };
        return image;
    }

    /** Open the standard zoom/pan modal for a gallery image used in quick cards. */
    openQuickAdjustModal(index) {
        if (this.quickCards.busy) return;
        if (!this.quickCards.selected.has(index)) {
            this.quickCards.selected.add(index);
            this.refreshQuickImageStates();
            this.updateQuickCardsSummary();
        }
        const galleryImg = this.galleryImages[index];
        if (!galleryImg) return;

        const zoomSlider = document.getElementById('zoomSlider');
        const zoomValue = document.getElementById('zoomValue');
        const saved = this.quickCards.adjustments[index] || { zoom: 1, offsetX: 0, offsetY: 0 };

        this.quickEditingIndex = index;
        this.currentEditingIndex = null;
        this.currentImage = galleryImg.img;
        this.zoom = saved.zoom || 1;
        this.offsetX = saved.offsetX || 0;
        this.offsetY = saved.offsetY || 0;
        zoomSlider.value = this.zoom;
        zoomValue.textContent = Math.round(this.zoom * 100) + '%';

        this.updatePreview();
        document.getElementById('previewSection').style.display = 'flex';
        document.getElementById('imageModal').style.display = 'block';
    }

    getQuickPageCount() {
        const input = document.getElementById('quickPageCount');
        const min = parseInt(input.min, 10) || 1;
        const max = parseInt(input.max, 10) || 30;
        const value = parseInt(input.value, 10);
        if (isNaN(value)) return min;
        return Math.min(max, Math.max(min, value));
    }

    updateQuickCardsSummary() {
        const count = this.quickCards.selected.size;
        const pages = this.getQuickPageCount();
        document.getElementById('quickSelectedCount').textContent =
            `${count} selected`;
        document.getElementById('quickCardCount').textContent =
            `${pages * 2} card${pages * 2 === 1 ? '' : 's'}`;
        document.getElementById('quickPrimaryInfo').textContent =
            this.quickCards.primary === null
                ? 'Match image: random for each card'
                : 'Match image: the starred image on every card';
        document.getElementById('quickGenerateBtn').disabled = count < 2 || this.quickCards.busy;
    }

    setQuickCardsStatus(message, isError = false) {
        const status = document.getElementById('quickCardsStatus');
        status.hidden = !message;
        status.textContent = message || '';
        status.classList.toggle('error', isError);
    }

    /** Fisher–Yates shuffle (returns a new array). */
    shuffleArray(array) {
        const result = array.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Build one card: six gallery indices in random order. Exactly three slots
     * hold the match image; the other three are drawn from the remaining
     * selected images and never form a second triple when that's avoidable.
     */
    buildQuickCardLayout(selectedIndices, primaryIndex) {
        const match = primaryIndex !== null
            ? primaryIndex
            : selectedIndices[Math.floor(Math.random() * selectedIndices.length)];
        const others = selectedIndices.filter(i => i !== match);

        let fillers;
        if (others.length === 1) {
            // Two-image card: the other image simply fills the remaining slots
            fillers = [others[0], others[0], others[0]];
        } else {
            let attempts = 0;
            do {
                fillers = [0, 1, 2].map(() => others[Math.floor(Math.random() * others.length)]);
                attempts++;
            } while (fillers.every(i => i === fillers[0]) && attempts < 20);
            if (fillers.every(i => i === fillers[0])) {
                fillers = this.shuffleArray(others).slice(0, 3);
                while (fillers.length < 3) fillers.push(others[fillers.length % others.length]);
            }
        }

        return this.shuffleArray([match, match, match, ...fillers]);
    }

    /** Resolve once an <img> has finished loading (or failed). */
    waitForImage(img) {
        if (img.complete) return Promise.resolve(img);
        return new Promise(resolve => {
            img.addEventListener('load', () => resolve(img), { once: true });
            img.addEventListener('error', () => resolve(img), { once: true });
        });
    }

    /**
     * Create a printable page element (two cards) based on the editor's page
     * so titles and backgrounds carry over. `cards` holds two arrays of six
     * cropped image data URLs.
     */
    buildQuickPageElement(cards) {
        const template = document.querySelector('#pdfPreview .page');
        const page = template.cloneNode(true);
        page.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

        const sections = page.querySelectorAll('.match3-page');
        sections.forEach((section, cardIndex) => {
            section.classList.remove('drag-over-bg');
            const slots = section.querySelectorAll('.circle-slot');
            slots.forEach((slot, slotIndex) => {
                slot.innerHTML = '';
                slot.classList.remove('empty');
                slot.removeAttribute('draggable');
                slot.style.opacity = '';
                const img = document.createElement('img');
                img.src = cards[cardIndex][slotIndex];
                slot.appendChild(img);
            });
        });
        return page;
    }

    /**
     * Render each page element into a single multi-page PDF. Pages are
     * rasterised one at a time so large page counts don't exceed the
     * browser's maximum canvas size.
     */
    exportPagesToPDF(pages, filename, onProgress) {
        const opt = this.getPdfExportOptions(filename);
        const restore = this.beginExportMode(pages);

        let worker = html2pdf().set(opt).from(pages[0]).toPdf();
        pages.slice(1).forEach((page, i) => {
            worker = worker
                .get('pdf').then(pdf => {
                    if (onProgress) onProgress(i + 2, pages.length);
                    pdf.addPage();
                })
                .from(page).toContainer().toCanvas().toPdf();
        });

        return worker.save().then(restore, (err) => {
            restore();
            throw err;
        });
    }

    async generateQuickCards() {
        if (this.quickCards.busy) return;
        const selected = [...this.quickCards.selected].sort((a, b) => a - b);
        if (selected.length < 2) {
            this.setQuickCardsStatus('Select at least two images.', true);
            return;
        }
        const pageCount = this.getQuickPageCount();
        document.getElementById('quickPageCount').value = pageCount;

        this.quickCards.busy = true;
        this.updateQuickCardsSummary();
        this.setQuickCardsStatus('Preparing images…');

        try {
            // Crop every selected image into a circle once, using any
            // zoom/position the user set in the adjust modal
            const cropped = {};
            for (const index of selected) {
                const galleryImg = this.galleryImages[index];
                await this.waitForImage(galleryImg.img);
                cropped[index] = this.getQuickCrop(index);
                if (!cropped[index]) {
                    throw new Error('One of the selected images could not be loaded.');
                }
            }

            // Build every page
            const pages = [];
            for (let p = 0; p < pageCount; p++) {
                const cards = [0, 1].map(() =>
                    this.buildQuickCardLayout(selected, this.quickCards.primary).map(i => cropped[i])
                );
                pages.push(this.buildQuickPageElement(cards));
            }

            this.setQuickCardsStatus(`Rendering page 1 of ${pageCount}…`);
            await this.exportPagesToPDF(pages, 'match3_quick_cards.pdf', (current, total) => {
                this.setQuickCardsStatus(`Rendering page ${current} of ${total}…`);
            });

            this.setQuickCardsStatus(`Done — exported ${pageCount} page${pageCount === 1 ? '' : 's'} (${pageCount * 2} cards).`);
        } catch (err) {
            console.error('Quick card generation failed', err);
            this.setQuickCardsStatus('Sorry, generating the PDF failed. Please try again.', true);
        } finally {
            this.quickCards.busy = false;
            this.updateQuickCardsSummary();
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Match3Maker();
});
