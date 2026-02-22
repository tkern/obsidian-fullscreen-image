import { Plugin } from "obsidian";

export default class ImageFullscreenPlugin extends Plugin {
  private overlay: HTMLDivElement | null = null;
  private boundClickHandler: (evt: MouseEvent) => void;
  private boundKeyHandler: (evt: KeyboardEvent) => void;

  async onload() {
    this.boundClickHandler = this.handleImageClick.bind(this);
    this.boundKeyHandler = this.handleKeydown.bind(this);

    this.registerDomEvent(document, "click", this.boundClickHandler);
    this.registerDomEvent(document, "keydown", this.boundKeyHandler);
  }

  onunload() {
    this.removeOverlay();
  }

  private handleImageClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;

    // Check if the clicked element is an image inside editor, preview, or canvas
    if (
      target.tagName !== "IMG" ||
      !target.closest(".cm-editor, .markdown-preview-view, .canvas-node-content")
    ) {
      return;
    }

    const img = target as HTMLImageElement;
    if (!img.src) return;

    evt.preventDefault();
    evt.stopPropagation();
    this.showFullscreen(img.src, img.alt || "");
  }

  private handleKeydown(evt: KeyboardEvent) {
    if (!this.overlay) return;

    if (evt.key === "Escape") {
      this.removeOverlay();
    } else if (evt.key === "+" || evt.key === "=") {
      this.zoomIn();
    } else if (evt.key === "-") {
      this.zoomOut();
    } else if (evt.key === "0") {
      this.resetZoom();
    }
  }

  private scale = 1;
  private translateX = 0;
  private translateY = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastTranslateX = 0;
  private lastTranslateY = 0;
  private fullscreenImg: HTMLImageElement | null = null;

  private showFullscreen(src: string, alt: string) {
    this.removeOverlay();
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;

    // Create overlay
    this.overlay = document.createElement("div");
    this.overlay.addClass("image-fullscreen-overlay");

    // Create image container (for transforms)
    const container = document.createElement("div");
    container.addClass("image-fullscreen-container");

    // Create image
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.addClass("image-fullscreen-img");
    this.fullscreenImg = img;

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.addClass("image-fullscreen-close");
    closeBtn.innerHTML = "×";
    closeBtn.setAttribute("aria-label", "Close fullscreen");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeOverlay();
    });

    // Zoom controls
    const controls = document.createElement("div");
    controls.addClass("image-fullscreen-controls");

    const zoomInBtn = document.createElement("button");
    zoomInBtn.textContent = "+";
    zoomInBtn.setAttribute("aria-label", "Zoom in");
    zoomInBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.zoomIn();
    });

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.textContent = "−";
    zoomOutBtn.setAttribute("aria-label", "Zoom out");
    zoomOutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.zoomOut();
    });

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.setAttribute("aria-label", "Reset zoom");
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.resetZoom();
    });

    controls.append(zoomOutBtn, zoomInBtn, resetBtn);

    // Hint text
    const hint = document.createElement("div");
    hint.addClass("image-fullscreen-hint");
    hint.textContent = "Scroll to zoom · Drag to pan · Esc to close";

    // Click overlay background to close
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay || e.target === container) {
        this.removeOverlay();
      }
    });

    // Wheel zoom
    this.overlay.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.scale = Math.max(0.1, Math.min(10, this.scale + delta));
        this.applyTransform();
      },
      { passive: false }
    );

    // Drag to pan
    img.addEventListener("mousedown", (e) => {
      if (this.scale > 1) {
        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.lastTranslateX = this.translateX;
        this.lastTranslateY = this.translateY;
        img.style.cursor = "grabbing";
      }
    });

    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);

    container.appendChild(img);
    this.overlay.append(closeBtn, container, controls, hint);
    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => {
      this.overlay?.addClass("image-fullscreen-visible");
    });
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    this.translateX = this.lastTranslateX + (e.clientX - this.dragStartX);
    this.translateY = this.lastTranslateY + (e.clientY - this.dragStartY);
    this.applyTransform();
  };

  private onMouseUp = () => {
    this.isDragging = false;
    if (this.fullscreenImg) {
      this.fullscreenImg.style.cursor = this.scale > 1 ? "grab" : "default";
    }
  };

  private applyTransform() {
    if (!this.fullscreenImg) return;
    this.fullscreenImg.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    this.fullscreenImg.style.cursor = this.scale > 1 ? "grab" : "default";
  }

  private zoomIn() {
    this.scale = Math.min(10, this.scale + 0.25);
    this.applyTransform();
  }

  private zoomOut() {
    this.scale = Math.max(0.1, this.scale - 0.25);
    if (this.scale <= 1) {
      this.translateX = 0;
      this.translateY = 0;
    }
    this.applyTransform();
  }

  private resetZoom() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.applyTransform();
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.fullscreenImg = null;
      this.isDragging = false;
    }
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
  }
}