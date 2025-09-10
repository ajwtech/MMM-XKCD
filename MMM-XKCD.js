/* Magic Mirror
 * Module: MMM-XKCD
 *
 * By jupadin (modded for alt placement & sizing)
 * MIT Licensed.
 */

Module.register("MMM-XKCD", {
  // Default module config.
  defaults: {
    header: "MMM-xkcd",
    dailyJSONURL: "https://xkcd.com/info.0.json",
    updateInterval: 10 * 60 * 60 * 1000, // 10 hours

    // appearance
    grayScale: false,
    invertColors: false,

    // image sizing (set as MAX when forceSize=false; exact when forceSize=true)
    limitComicWidth: 400,   // px; 0 = no limit
    limitComicHeight: 0,    // px; 0 = no limit
    forceSize: false,       // if true, set width/height exactly (may crop with objectFit)
    objectFit: "contain",   // "contain" | "cover" | "fill" | "none" | "scale-down"

    // alt/title handling
    showTitle: true,
    dailyTitleMaxLen: 15,   // trim title in header
    showAlt: true,          // render the xkcd "alt" text visibly
    altPlacement: "below",  // "below" | "above" | "left" | "right" | "tooltip"
    altTooltip: true,       // also put alt in image title= for hover
    altMaxLength: 0,        // 0 = no truncation
    gap: 8,                 // px gap between image and alt (for left/right/above/below)

    // selection
    randomComic: false,
    alwaysRandom: false
  },

  // Define start sequence.
  start: function () {
    Log.info("Starting module: " + this.name);

    this.dailyComic = "";
    this.dailyComicTitle = "";
    this.dailyComicAlt = "";

    this.numComic = null;
    this.comicYear = null;
    this.comicMonth = null;

    this.animationSpeed = 2000;
    this.loaded = false;
    this.sendSocketNotification("SET_CONFIG", this.config);
  },

  // Define required styles.
  getStyles: function () {
    return ["MMM-XKCD.css"];
  },

  // Define required scripts.
  getScripts: function () {
    return ["moment.js"];
  },

  // Helpers
  _maybeTruncate(str, max) {
    if (!max || max <= 0 || !str) return str || "";
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  },

  _isTooltipOnly() {
    return this.config.altPlacement === "tooltip";
  },

  // Define header.
  getHeader: function () {
    if (this.config.showTitle && this.dailyComicTitle !== "") {
      const title = document.createElement("div");
      title.className = "title";
      title.innerText = this.config.header;

      const text = document.createElement("div");
      text.className = "text";
      text.innerText = this.dailyComicTitle;

      const number = document.createElement("div");
      number.className = "number";
      number.innerText =
        "(" +
        this.numComic +
        ")" +
        " | " +
        String(this.comicMonth).padStart(2, "0") +
        "." +
        this.comicYear;

      return `${title.innerHTML} - ${text.innerHTML} ${number.innerHTML}`;
    } else {
      return this.config.header;
    }
  },

  // Override dom generator.
  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.id = "wrapper";

    if (!this.loaded) {
      wrapper.innerHTML = "Loading...";
      wrapper.className = "light small dimmed";
      return wrapper;
    }

    // Container to support flexible placement of alt text
    const container = document.createElement("div");
    container.className = "xkcd-container";
    container.style.display = "flex";
    container.style.alignItems = "flex-start";
    container.style.gap = (this.config.gap || 0) + "px";

    const place = this.config.altPlacement;
    if (place === "left" || place === "right") {
      container.style.flexDirection = "row";
    } else {
      // above | below | tooltip (default to column)
      container.style.flexDirection = "column";
    }

    // Comic image
    const comic = document.createElement("img");
    comic.id = "comic";
    comic.src = this.dailyComic;

    // alt text as accessibility + (optionally) tooltip
    if (this.dailyComicAlt) {
      comic.alt = this.dailyComicAlt;
      if (this.config.altTooltip) comic.title = this.dailyComicAlt;
    }

    // grayscale/invert filter
    if (this.config.grayScale || this.config.invertColors) {
      comic.style.webkitFilter =
        (this.config.grayScale ? "grayscale(100%) " : "") +
        (this.config.invertColors ? "invert(100%) " : "");
    }

    // sizing
    if (this.config.forceSize) {
      if (this.config.limitComicWidth > 0)
        comic.style.width = this.config.limitComicWidth + "px";
      if (this.config.limitComicHeight > 0)
        comic.style.height = this.config.limitComicHeight + "px";
      // if only one provided, keep aspect for the other
      if (this.config.limitComicWidth > 0 && this.config.limitComicHeight === 0)
        comic.style.height = "auto";
      if (this.config.limitComicHeight > 0 && this.config.limitComicWidth === 0)
        comic.style.width = "auto";
    } else {
      if (this.config.limitComicWidth > 0)
        comic.style.maxWidth = this.config.limitComicWidth + "px";
      if (this.config.limitComicHeight > 0)
        comic.style.maxHeight = this.config.limitComicHeight + "px";
      comic.style.width = "auto";
      comic.style.height = "auto";
    }
    comic.style.objectFit = this.config.objectFit || "contain";

    // Visible alt caption (unless tooltip-only)
    let altDiv = null;
    if (this.config.showAlt && !this._isTooltipOnly() && this.dailyComicAlt) {
      altDiv = document.createElement("div");
      altDiv.className = "xkcd-alt light small dimmed";
      altDiv.textContent = this._maybeTruncate(
        this.dailyComicAlt,
        this.config.altMaxLength
      );
      altDiv.style.lineHeight = "1.3";
    }

    // Order children based on placement
    // above: [alt, img], below: [img, alt], left: [alt, img], right: [img, alt]
    const add = (a, b) => {
      if (a) container.appendChild(a);
      if (b) container.appendChild(b);
    };

    if (place === "above") add(altDiv, comic);
    else if (place === "left") add(altDiv, comic);
    else if (place === "right") add(comic, altDiv);
    else if (place === "tooltip") add(comic, null);
    else /* below or default */ add(comic, altDiv);

    wrapper.appendChild(container);
    return wrapper;
  },

  // Override socket notification handler.
  socketNotificationReceived: function (notification, payload) {
    if (notification === "COMIC") {
      this.loaded = true;
      this.dailyComic = payload.img || "";
      const fullTitle = payload.title || payload.safe_title || "";
      this.dailyComicTitle = this._maybeTruncate(
        fullTitle,
        this.config.dailyTitleMaxLen
      );
      this.dailyComicAlt = payload.alt || "";
      this.numComic = payload.num;
      this.comicYear = payload.year;
      this.comicMonth = payload.month;
      this.updateDom(this.animationSpeed);
    }
  }
});
