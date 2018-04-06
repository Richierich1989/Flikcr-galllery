(() => {
    const FLICKR_API_KEY = '5c6b571f65a49e7a190736b44b506ac3';
    const FLICKR_USER_ID = '142543240@N05';
    const FLICKR_GALLERY_ID = '72157623657298779';
    const FLICKR_HOST = 'https://api.flickr.com/services/rest/?method=flickr.galleries.getPhotos';
    const KEY_ESC = 27;
    const KEY_LEFT = 37;
    const KEY_RIGHT = 39;
    const MODAL_PADDING = 80;
    const WIN = window;
    const Emitter = class {
        constructor() {
            this.events = {};
        }
        emit(name, ...args) {
            this.events[name] = this.events[name] || [];
            return this.events[name].map(cb => {
                return cb.apply(this, args);
            });
        }
        subscribe(name, fn) {
            this.events[name] = this.events[name] || [];
            this.events[name].push(fn);
            return {
                release: () => {
                    this.events[name] = this.events[name] || [];
    				const index = this.events[name].indexOf(fn);
    				if (index !== -1) {
    					this.events[name].splice(index, 1);
    				}
                }
            }
        }
    }

    class BaseController {
        /**
         * constructor handles initial setup
         * @param {void}
         * @return {void}
         */
        constructor() {
            const url = `${FLICKR_HOST}&api_key=${FLICKR_API_KEY}&gallery_id=${FLICKR_GALLERY_ID}&format=json&nojsoncallback=1`;
            this.emitter = new Emitter();
            this.lightbox = new Lightbox(document.getElementById('lightbox'));
            this.photogrid = new PhotoGrid(document.getElementById('photo-grid'));
            this.store = new LightboxStore(url, this.emitter);
            this._init();
        }

        _init() {
            const self = this;
            const emitter = self.emitter;
            emitter.subscribe('photos-loaded', function(photos) {
                self.photogrid.render(photos);
                self.lightbox.populate(photos);
            });
            emitter.subscribe('photo-click', function(index) {
                self.lightbox.show(index);
            });
            self.photogrid.getElement().addEventListener('click', function (evt) {
                if (evt.target.tagName === 'IMG') {
                    let parent = evt.target.parentNode;
                    let index = parseInt(parent.getAttribute('data-index'));
                    self.lightbox.show(index);
                }
            });
        }
    }

    class LightboxStore {
        /**
         * constructor handles initial setup
         * @param {void}
         * @return {void}
         */
        constructor(url, emitter) {
            this.emitter = emitter;
            this._fetchPhotos(url, this._processPhotos.bind(this));
        }

        /**
         * fetch photos from flickr api
         * @param {String, callback} url to fetch photos from and callback
         * @return {callback}
         */
        _fetchPhotos(url, callback) {
            let xhr = new XMLHttpRequest();
            xhr.onload = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        var data = xhr.responseText;
                        try {
                            data = JSON.parse(data);
                        } catch (e) {
                            callback('Error', e);
                            return;
                        }
                        callback(null, data);
                    }
                } else {
                    callback(xhr);
                }
            }
            xhr.onerror = () => {
                callback(xhr);
            }
            xhr.open('GET', url, true);
            xhr.send();
        }

        /**
         * process photos in a format required by photo grid and lightbox
         * @param {err, res} error and response from the api
         * @return {void}
         */
        _processPhotos(err, res) {
            if (err) {
                throw new Error('Error fetching data from api');
                return;
            }
            const resultSet = [];
            if (res && res.photos) {
                const photos = res.photos.photo;
                photos.forEach(photo => {
                    resultSet.push({
                        src: 'https://c1.staticflickr.com/' + photo.farm + '/' + photo.server + '/' + photo.id + '_' + photo.secret + '_z.jpg',
                        title: photo.title
                    });
                });
            }
            this.emitter.emit('photos-loaded', resultSet);
        }
    }

    class PhotoGrid {
        /**
         * constructor handles initial setup
         * @param {void}
         * @return {void}
         */
        constructor(elem) {
            if (!(elem instanceof HTMLElement)) {
                throw new Error('elem must be an element');
            }
            this.element = elem;
        }

        /**
         * rendering photos in a grid and as image cells
         * @param {Object} An array of photos object
         * @return {void}
         */
        render(photos) {
            // Create a document fragment to put photos into it
            const docFragment = document.createDocumentFragment();
            // Loop through the photos, add styling and add them to document fragment
            for (let i = 0; i < photos.length; i++) {
                let el = document.createElement('div');
                el.classList.add('photo-cell');
                el.style.backgroundImage = 'url(' + photos[i].src + ')';
                el.setAttribute('data-index', i);
                let image = document.createElement('img');
                image.setAttribute('alt', photos[i].title);
                image.setAttribute('title', photos[i].title);
                el.appendChild(image);
                docFragment.appendChild(el);
            }
            // Add fragment to the element
            this.element.appendChild(docFragment);
            this.element.classList.add('photo-container');
        }

        /**
         * returns the photo grid element
         * @param {void}
         * @return {HTMLElement} photo grid element
         */
        getElement() {
            return this.element;
        }
    }

    class Lightbox {
        /**
         * constructor handles initial setup
         * @param {void}
         * @return {void}
         */
        constructor(elem) {
            if (!(elem instanceof HTMLElement)) {
                throw new Error('elem must be an element');
            }
            this.element = elem;
            this.index = 0;
            this.isVisible = false;
            this.sizeDebounce = null;
            this._init();
        }

        /**
         * Creates lightbox DOM structure and adds event listeners
         */
        _init() {
            let modalEl = this.modalEl = document.createElement('div');
            modalEl.className = 'modal';

            this.imageEl = document.createElement('img');
            modalEl.appendChild(this.imageEl);

            this.titleEl = document.createElement('h2');
            modalEl.appendChild(this.titleEl);

            this.backButtonEl = this._renderButton('<', 'back', this._onBackClick);
            modalEl.appendChild(this.backButtonEl);
            this.nextButtonEl = this._renderButton('>', 'next', this._onNextClick);
            modalEl.appendChild(this.nextButtonEl);
            this.closeButtonEl = this._renderButton('x', 'close', this._onCloseClick);
            modalEl.appendChild(this.closeButtonEl);

            this.element.appendChild(modalEl);

            this.element.addEventListener('click', this._onOverlayClick.bind(this));
            window.addEventListener('resize', this._onWindowResize.bind(this));
            window.addEventListener('keydown', this._onKeyPress.bind(this));
        }

        /**
         * Updates the photos and sets the index back to 0
         * @method populate
         * @param {Object[]} photos An array of photo objects
         */
        populate(photos) {
            this.photos = photos;
            this.index = 0;
        }

        /**
         * Creates a button element with a name and click event listeners
         * @private
         * @param {String} title The title of the button
         * @param {String} cls A class to add to the button
         * @param {Function} callback A callback to bind to the click event
         * @return {HTMLButtonElement} The generate button
         */
        _renderButton(title, cls, callback) {
            let button = document.createElement('button');
            button.className = cls;
            button.textContent = title;
            if (callback) {
                button.addEventListener('click', callback.bind(this));
            }
            return button;
        }

        /**
         * Image loader
         * @method _loadImage
         * @param {String} src The URL of the image to load
         */
        _loadImage(src, callback) {
            const img = new Image();
            img.src = src;
            img.onload = function() {
                callback(img);
            };
            img.onerror = function() {
                callback('Error');
            };
        }

        /**
         * Next button click handler
         */
        _onNextClick(e) {
            this.index += this.index + 1 < this.photos.length ? 1 : 0;
            this.show();
        }

        /**
         * Keyboard input handler
         */
        _onKeyPress(e) {
            var keyCode = e.keyCode || e.charCode;
            if (this.isVisible) {
                switch (keyCode) {
                    case KEY_LEFT:
                        this._onBackClick(e);
                        break;
                    case KEY_RIGHT:
                        this._onNextClick(e);
                        break;
                    case KEY_ESC:
                        this.hide();
                        break;
                }
            }
        }

        /**
         * onclick handler for Back button
         */
        _onBackClick(e) {
            this.index -= this.index - 1 >= 0 ? 1 : 0;
            this.show();
        }

        /**
         * Debounced window resize event handler
         */
        _onWindowResize() {
            clearTimeout(this.sizeDebounce);
            this.sizeDebounce = setTimeout(this._resizeLightbox.bind(this), 50);
        }

        /**
         * onclick handler for close button
         */
        _onCloseClick(e) {
            this.hide();
        }

        _resizeLightbox(img) {
            img = img || this.imageEl;
            var winWidth = window.innerWidth - MODAL_PADDING;
            var winHeight = window.innerHeight - MODAL_PADDING;
            var imgWidth = img.naturalWidth;
            var imgHeight = img.naturalHeight;

            // Resize
            if (imgWidth > winWidth || imgHeight > winHeight) {
                if (imgWidth > imgHeight) {
                    imgHeight = Math.round(imgHeight / imgWidth * winWidth);
                    imgWidth = winWidth;
                } else {
                    imgWidth = Math.round(imgWidth / imgHeight * winHeight);
                    imgHeight = winHeight;
                }

                // Resize using the other axis as the clamp, if its still too large
                if (imgWidth > winWidth) {
                    imgHeight = Math.round(imgHeight / imgWidth * winWidth);
                    imgWidth = winWidth;
                } else if (imgHeight > winHeight) {
                    imgWidth = Math.round(imgWidth / imgHeight * winHeight);
                    imgHeight = winHeight;
                }
            }
            this.modalEl.style.width = imgWidth + 'px';
            this.modalEl.style.height = imgHeight + 'px';
        }

        /**
         * Onclick handler for overlay. Hides the modal when clicked outside
         */
        _onOverlayClick(e) {
            if (e.target === this.element) {
                this.hide();
            }
        }

        /**
         * Displays the modal and shows an image
         * @method show
         * @param {Number} [index] The array index of the image to display
         */
        show(index) {
            let self = this;
            if (typeof index === 'undefined') {
                index = self.index;
            }
            const image = self.photos[index];
            if (image) {
                self._loadImage(image.src, function(img) {
                    if (img === 'Error') {
                        alert('That image is not loaded');
                    }
                    self.element.classList.add('visible');
                    self._resizeLightbox.bind(self, img);
                    self.imageEl.src = image.src;
                    self.titleEl.textContent = image.title;
                    self.backButtonEl.disabled = index === 0;
                    self.nextButtonEl.disabled = index === self.photos.length - 1;
                    self.index = index;
                    self.isVisible = true;
                });
            }
        }

        /**
         * Hides the modal
         * @method hide
         */
        hide() {
            let elem = this.element;
            let fadeoutEnd = function(evt) {
                elem.classList.remove('fadeout');
                elem.classList.remove('visible');
                this.isVisible = false;
                elem.removeEventListener('transitionend', fadeoutEnd);
            };
            elem.addEventListener('transitionend', fadeoutEnd);
            elem.classList.add('fadeout');
        }
    }

    const Base = new BaseController();
})();
