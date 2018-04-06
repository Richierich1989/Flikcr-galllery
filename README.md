# Flickr Lightbox
Elegant flickr lightbox in vanilla Javascript.

## Run

```bash
Click on the index.html file to see Flickr Lightbox. It will show preselected images from a particular gallery.
```

## Components

### styles.css
Stylesheet for this app.

### app.js

Javascript associated with lightbox.
It has the following structure:
1) An event emitter to support event emission and listening among functions.
2) A BaseController to instantiate lightbox, photogrid and store. It also adds event listeners and subscribers.
3) LightboxStore which makes the XHR call to fetch photos and emits response in the format required by Photogrid and Lightbox.
4) Photogrid creates individual image cells with the response from the store.
5) Lightbox shows/hides the lightbox with photos.
