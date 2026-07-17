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

    confirmImage() {
        if (!this.currentImage) return;

        const canvas = document.getElementById('previewCanvas');
        const ctx = canvas.getContext('2d');
        const radius = canvas.width / 2;

        // Create a new canvas for the final circular image
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height;
        const finalCtx = finalCanvas.getContext('2d');

        // Enable high-quality image smoothing
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';

        // Draw only the circular portion
        finalCtx.save();
        finalCtx.beginPath();
        finalCtx.arc(radius, radius, radius, 0, Math.PI * 2);
        finalCtx.clip();

        // Calculate image dimensions
        const img = this.currentImage;
        const imgAspect = img.width / img.height;
        let drawWidth, drawHeight;
        const circleDiameter = canvas.width * this.zoom;
        
        if (imgAspect > 1) {
            drawHeight = circleDiameter;
            drawWidth = drawHeight * imgAspect;
        } else {
            drawWidth = circleDiameter;
            drawHeight = drawWidth / imgAspect;
        }

        const x = (canvas.width - drawWidth) / 2 + this.offsetX;
        const y = (canvas.height - drawHeight) / 2 + this.offsetY;

        finalCtx.drawImage(img, x, y, drawWidth, drawHeight);
        finalCtx.restore();

        const imageData = finalCanvas.toDataURL('image/png', 1.0);

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

    exportToPDF() {
        const element = document.getElementById('pdfPreview');
        document.body.classList.add('exporting');
        
        // Temporarily force inline styles for better PDF rendering
        const titles = element.querySelectorAll('.match3-page h2');
        const originalStyles = [];
        titles.forEach((title, index) => {
            originalStyles[index] = title.style.cssText;
            title.style.cssText += 'color: #ff1493 !important; font-weight: bold !important; text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.3) !important; font-size: 40pt !important;';
        });
        
        const opt = {
            margin: 0,
            filename: 'match3_circles.pdf',
            image: { type: 'png', quality: 1.0 },
            html2canvas: { 
                scale: 3, 
                useCORS: true, 
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                letterRendering: true
            },
            jsPDF: { format: 'letter', orientation: 'portrait', unit: 'in' }
        };

        const restore = () => {
            titles.forEach((title, index) => {
                title.style.cssText = originalStyles[index];
            });
            document.body.classList.remove('exporting');
        };

        html2pdf().set(opt).from(element).save().then(restore).catch((err) => {
            console.error('PDF export failed', err);
            restore();
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Match3Maker();
});
