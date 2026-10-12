(() => {
  "use strict";

  // ── CONFIG ────────────────────────────────────────────────
  const API_URL = "http://127.0.0.1:5000";
  const HISTORY_KEY = "pixable_history";
  const MAX_HISTORY = 50;

  // ── AUTH & SESSION LOGIC ──────────────────────────────────
  let supabaseClient = null;
  let sessionToken = null;
  
  if (typeof window.supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        sessionToken = session.access_token;
        updateUserUI(session.user);
      } else {
        updateUserUI(null);
      }
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionToken = null;
        window.location.replace("login.html");
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        sessionToken = session.access_token;
        updateUserUI(session.user);
      }
    });
  }

  function updateUserUI(user) {
    const nameDisplay = document.getElementById("user-name-display");
    const dropName = document.getElementById("user-dropdown-name");
    const dropEmail = document.getElementById("user-dropdown-email");
    
    if (user) {
      const name = user.user_metadata?.full_name || "User";
      if (nameDisplay) nameDisplay.textContent = name;
      if (dropName) dropName.textContent = name;
      if (dropEmail) dropEmail.textContent = user.email;
    } else {
      if (nameDisplay) nameDisplay.textContent = "Guest";
      if (dropName) dropName.textContent = "Guest User";
      if (dropEmail) dropEmail.textContent = "Log in to save images";
    }
  }

  const userProfileBtn = document.getElementById("user-profile-btn");
  const userDropdownMenu = document.getElementById("user-dropdown-menu");
  const btnSignout = document.getElementById("btn-signout");

  if (userProfileBtn && userDropdownMenu) {
    userProfileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle("hidden");
    });
    
    document.addEventListener("click", (e) => {
      if (!userProfileBtn.contains(e.target) && !userDropdownMenu.contains(e.target)) {
        userDropdownMenu.classList.add("hidden");
      }
    });
  }
  
  if (btnSignout) {
    btnSignout.addEventListener("click", async () => {
      sessionStorage.removeItem("guest_mode");
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      } else {
        window.location.replace("login.html");
      }
    });
  }

  // ── THEME LOGIC ───────────────────────────────────────────
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (themeToggleBtn) {
      const sunIcon = themeToggleBtn.querySelector(".sun-icon");
      const moonIcon = themeToggleBtn.querySelector(".moon-icon");
      if (sunIcon && moonIcon) {
        if (theme === "light") {
          sunIcon.style.display = "block";
          moonIcon.style.display = "none";
        } else {
          sunIcon.style.display = "none";
          moonIcon.style.display = "block";
        }
      }
    }
  }

  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(currentTheme === "light" ? "dark" : "light");
    });
  }

  // ── AUTOCORRECT DICTIONARY ────────────────────────────────
  // Common misspellings → correct spellings (focused on general
  // English + image-generation / art terms)
  const AUTOCORRECT_MAP = {
    // ── General common misspellings ──
    "teh": "the", "thier": "their", "thsi": "this", "taht": "that",
    "adn": "and", "wiht": "with", "hte": "the", "nto": "not",
    "waht": "what", "whta": "what", "becuase": "because", "beacuse": "because",
    "becasue": "because", "definately": "definitely", "definatly": "definitely",
    "definitly": "definitely", "defintely": "definitely",
    "seperate": "separate", "occured": "occurred", "occuring": "occurring",
    "recieve": "receive", "acheive": "achieve", "beleive": "believe",
    "wierd": "weird", "freind": "friend", "untill": "until",
    "accross": "across", "adress": "address", "agressive": "aggressive",
    "apparantly": "apparently", "basicly": "basically", "begining": "beginning",
    "belive": "believe", "buisness": "business", "calender": "calendar",
    "carefull": "careful", "carribean": "caribbean", "cemetary": "cemetery",
    "changeable": "changeable", "collegue": "colleague", "comming": "coming",
    "commitee": "committee", "completly": "completely", "concious": "conscious",
    "curiousity": "curiosity", "decieve": "deceive", "desparate": "desperate",
    "develope": "develop", "dissapear": "disappear", "dissapoint": "disappoint",
    "embarass": "embarrass", "enviroment": "environment", "exagerate": "exaggerate",
    "exersice": "exercise", "experiance": "experience", "facinated": "fascinated",
    "familar": "familiar", "finaly": "finally", "flourescent": "fluorescent",
    "foriegn": "foreign", "fourty": "forty", "freindly": "friendly",
    "goverment": "government", "grammer": "grammar", "gaurd": "guard",
    "happend": "happened", "harrass": "harass", "heighth": "height",
    "immediatly": "immediately", "independant": "independent",
    "interupt": "interrupt", "jewlery": "jewelry", "judgement": "judgment",
    "knowlege": "knowledge", "liason": "liaison", "libary": "library",
    "liscense": "license", "maintenence": "maintenance", "millenium": "millennium",
    "mispell": "misspell", "necesary": "necessary", "neccessary": "necessary",
    "noticable": "noticeable", "occassion": "occasion", "occurence": "occurrence",
    "orignal": "original", "parliment": "parliament", "pasttime": "pastime",
    "perseverence": "perseverance", "personell": "personnel",
    "posession": "possession", "potatos": "potatoes", "precede": "precede",
    "privelege": "privilege", "profesional": "professional",
    "publically": "publicly", "realy": "really", "refered": "referred",
    "relevent": "relevant", "religous": "religious", "repitition": "repetition",
    "resistence": "resistance", "shedule": "schedule", "sieze": "seize",
    "succesful": "successful", "supercede": "supersede", "suprise": "surprise",
    "tommorow": "tomorrow", "tommorrow": "tomorrow", "tomorow": "tomorrow",
    "tounge": "tongue", "truely": "truly", "unforseen": "unforeseen",
    "unfortunatly": "unfortunately", "useing": "using", "usally": "usually",
    "vaccuum": "vacuum", "vegetable": "vegetable", "wether": "whether",
    "wich": "which", "writting": "writing",

    // ── Art / Image generation terms ──
    "landsacpe": "landscape", "landscpae": "landscape", "landcsape": "landscape",
    "landscaep": "landscape", "portriat": "portrait", "portait": "portrait",
    "portrat": "portrait", "potrait": "portrait", "portriate": "portrait",
    "abstact": "abstract", "abstarct": "abstract",
    "realsitic": "realistic", "realisitc": "realistic", "realitsic": "realistic",
    "reaslistic": "realistic", "relistic": "realistic",
    "cinematc": "cinematic", "cinemtaic": "cinematic", "cinmatiec": "cinematic",
    "cinamatic": "cinematic", "cinemeatic": "cinematic",
    "fantsy": "fantasy", "fatnasy": "fantasy", "fantacy": "fantasy",
    "surreal": "surreal", "surreal": "surreal", "surrealsim": "surrealism",
    "photorealisitc": "photorealistic", "photorealstic": "photorealistic",
    "photorealsitic": "photorealistic", "photorealitsic": "photorealistic",
    "illustartion": "illustration", "illustraiton": "illustration",
    "illlustration": "illustration", "illustation": "illustration",
    "watercollor": "watercolor", "watercolour": "watercolor",
    "watercoulor": "watercolor", "watercolro": "watercolor",
    "backgorund": "background", "backgroud": "background",
    "backround": "background", "backgruond": "background",
    "forground": "foreground", "foregroud": "foreground",
    "foregournd": "foreground",
    "lighitng": "lighting", "lighing": "lighting", "ligthing": "lighting",
    "lightnig": "lighting", "litghting": "lighting",
    "texutre": "texture", "textrue": "texture", "texure": "texture",
    "shadwos": "shadows", "shadwows": "shadows", "shaodws": "shadows",
    "reflecton": "reflection", "reflcetion": "reflection",
    "atmospher": "atmosphere", "atmospheer": "atmosphere",
    "atmopshere": "atmosphere",
    "compsition": "composition", "compostion": "composition",
    "compositon": "composition",
    "virbant": "vibrant", "vibarnt": "vibrant", "vibrantt": "vibrant",
    "coloful": "colorful", "colourful": "colorful", "colorfull": "colorful",
    "colorul": "colorful",
    "detaield": "detailed", "deatiled": "detailed", "detaild": "detailed",
    "beautfiul": "beautiful", "beauitful": "beautiful", "beutiful": "beautiful",
    "beatiful": "beautiful", "beautifull": "beautiful", "beautuful": "beautiful",
    "mysteirous": "mysterious", "mystrious": "mysterious",
    "mysteriosu": "mysterious",
    "majesitc": "majestic", "majestci": "majestic", "majsetic": "majestic",
    "etherel": "ethereal", "etherial": "ethereal", "etheral": "ethereal",
    "dramtic": "dramatic", "dramatci": "dramatic", "drmatic": "dramatic",
    "minmalist": "minimalist", "minimalsit": "minimalist",
    "minimalst": "minimalist",
    "futuristc": "futuristic", "futurisitc": "futuristic",
    "futurstic": "futuristic",
    "cyberpnuk": "cyberpunk", "cybrpunk": "cyberpunk", "cybrepunk": "cyberpunk",
    "steampnuk": "steampunk", "steampukn": "steampunk",
    "astronuat": "astronaut", "astornaut": "astronaut", "astronaunt": "astronaut",
    "galaxxy": "galaxy", "galazy": "galaxy", "galxay": "galaxy",
    "nebual": "nebula", "neblua": "nebula", "nebulae": "nebula",
    "mountian": "mountain", "moutain": "mountain", "montain": "mountain",
    "mountans": "mountains", "moutains": "mountains",
    "oceaan": "ocean", "ocaen": "ocean",
    "sunet": "sunset", "sunest": "sunset", "sunste": "sunset",
    "sunrsie": "sunrise", "sunirse": "sunrise",
    "gloiwng": "glowing", "glowign": "glowing", "golwing": "glowing",
    "floaitng": "floating", "floting": "floating", "flaoting": "floating",
    "enchaned": "enchanted", "enchantd": "enchanted", "encahnted": "enchanted",
    "mediveal": "medieval", "medeival": "medieval", "medievl": "medieval",
    "renassiance": "renaissance", "rennaissance": "renaissance",
    "renaissanec": "renaissance",
    "hyperrealisitc": "hyperrealistic", "hyper-realstic": "hyper-realistic",
    "anceint": "ancient", "acnient": "ancient", "anicent": "ancient",
    "architecutre": "architecture", "architectrue": "architecture",
    "scultpure": "sculpture", "sculputre": "sculpture",
    "noen": "neon", "noen": "neon",
    "charecter": "character", "charcter": "character", "charachter": "character",
    "craeture": "creature", "cretaure": "creature", "crature": "creature",
    "dimesnion": "dimension", "dimenison": "dimension",
    "intriacte": "intricate", "intircate": "intricate", "intracate": "intricate",
    "ornametal": "ornamental", "ornamentel": "ornamental",
    "symmetircal": "symmetrical", "symettrical": "symmetrical",
    "asthetic": "aesthetic", "aestehtic": "aesthetic", "aestheic": "aesthetic",
    "styilzed": "stylized", "stylzied": "stylized", "stlyized": "stylized",
    "rendred": "rendered", "renderd": "rendered", "rendreed": "rendered",
    "luminuos": "luminous", "luminos": "luminous", "luminious": "luminous",
    "iridescnet": "iridescent", "iridecent": "iridescent",
    "trasparent": "transparent", "transparnet": "transparent",
    "transluecnt": "translucent", "translucnet": "translucent",
    "holographc": "holographic", "holgraphic": "holographic",
    "psychedlic": "psychedelic", "psychedleic": "psychedelic",
    "whismical": "whimsical", "whimsicle": "whimsical",
    "apocalypitc": "apocalyptic", "apocolyptic": "apocalyptic",
    "dystopain": "dystopian", "dystpoian": "dystopian",
    "utopinan": "utopian", "utpoian": "utopian",
  };

  // ── AUTOCORRECT ENGINE ────────────────────────────────────

  /** Show a small toast notification for autocorrected words */
  function showAutocorrectToast(original, corrected) {
    // Remove any existing toast
    const existing = document.getElementById("autocorrect-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "autocorrect-toast";
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>
      </svg>
      <span>Corrected "<strong>${original}</strong>" → "<strong>${corrected}</strong>"</span>
    `;
    document.body.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /**
   * Autocorrect the last typed word in a textarea.
   * Called on space/Enter keypress. Returns true if a correction was made.
   */
  function autocorrectLastWord(textarea) {
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Find the start of the last word (search backwards from cursor - 1)
    let wordEnd = cursorPos;
    let wordStart = cursorPos;

    // Move back past trailing spaces/newlines
    while (wordEnd > 0 && /[\s]/.test(text[wordEnd - 1])) {
      wordEnd--;
    }

    // Find word start
    wordStart = wordEnd;
    while (wordStart > 0 && /[^\s]/.test(text[wordStart - 1])) {
      wordStart--;
    }

    if (wordStart === wordEnd) return false;

    const word = text.substring(wordStart, wordEnd);
    const lower = word.toLowerCase();

    // Look up in dictionary
    const corrected = AUTOCORRECT_MAP[lower];
    if (!corrected || corrected === lower) return false;

    // Preserve original casing pattern
    let replacement;
    if (word === word.toUpperCase()) {
      // ALL CAPS → ALL CAPS
      replacement = corrected.toUpperCase();
    } else if (word[0] === word[0].toUpperCase()) {
      // Title Case → Title Case
      replacement = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    } else {
      replacement = corrected;
    }

    // Replace in text
    const newText = text.substring(0, wordStart) + replacement + text.substring(wordEnd);
    const newCursorPos = cursorPos + (replacement.length - word.length);

    textarea.value = newText;
    textarea.selectionStart = textarea.selectionEnd = newCursorPos;

    showAutocorrectToast(word, replacement);
    return true;
  }

  // ── MODEL DATA ────────────────────────────────────────────
  const MODEL_LABELS = {
    "flux-schnell": "FLUX Schnell",
    "flux-dev":     "FLUX Dev",
    "sd3.5":        "Stable Diffusion 3.5",
    "sdxl":         "Stable Diffusion XL",
  };

  // Reverse lookup: label → model key
  const MODEL_KEYS = {};
  for (const [key, label] of Object.entries(MODEL_LABELS)) {
    MODEL_KEYS[label] = key;
  }

  // ── DOM REFS ──────────────────────────────────────────────
  const sidebar        = document.getElementById("sidebar");
  const toggleSidebar  = document.getElementById("toggle-sidebar");
  const newChatBtn     = document.getElementById("new-chat-btn");
  const chatMessages   = document.getElementById("chat-messages");
  const chatScroll     = document.getElementById("chat-scroll");
  const welcomeScreen  = document.getElementById("welcome-screen");
  const creditsEl      = document.getElementById("credits-remaining");
  const creditsBadge   = document.getElementById("credits-badge");
  const sidebarHistory = document.getElementById("sidebar-history");
  const sidebarMeta    = document.querySelector(".sidebar-meta strong");

  // Welcome (centered) input
  const promptInput      = document.getElementById("prompt-input");
  const sendBtn          = document.getElementById("send-btn");
  const charCount        = document.getElementById("char-count");
  const modelPickerBtn   = document.getElementById("model-picker-btn");
  const modelPickerLabel = document.getElementById("model-picker-label");

  // Bottom (chat active) input
  const inputBarBottom        = document.getElementById("input-bar-bottom");
  const promptInputBottom     = document.getElementById("prompt-input-bottom");
  const sendBtnBottom         = document.getElementById("send-btn-bottom");
  const charCountBottom       = document.getElementById("char-count-bottom");
  const modelPickerBtnBottom  = document.getElementById("model-picker-btn-bottom");
  const modelPickerLabelBtm   = document.getElementById("model-picker-label-bottom");

  // Modal
  const modalOverlay   = document.getElementById("model-modal-overlay");
  const modalClose     = document.getElementById("model-modal-close");
  const modelCards     = document.querySelectorAll(".model-card");

  // Preset buttons (sidebar + welcome chips)
  const presets = document.querySelectorAll("[data-prompt]");

  // Tab system
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabGenerate = document.getElementById("tab-generate");
  const tabEdit = document.getElementById("tab-edit");
  const tabGallery = document.getElementById("tab-gallery");
  const tabContentGenerate = document.getElementById("tab-content-generate");
  const tabContentEdit = document.getElementById("tab-content-edit");
  const tabContentGallery = document.getElementById("tab-content-gallery");
  const galleryCountEl = document.getElementById("gallery-count");
  
  // Global Toast
  const globalToast = document.getElementById("global-toast");
  const globalToastMessage = document.getElementById("global-toast-message");
  let toastTimeout;
  
  window.showToast = function(message) {
    if (!globalToast) return;
    globalToastMessage.textContent = message;
    globalToast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      globalToast.classList.remove("show");
    }, 3000);
  };

  // Gallery
  const galleryGrid = document.getElementById("gallery-grid");
  const galleryEmpty = document.getElementById("gallery-empty");
  const galleryFilterBtns = document.querySelectorAll(".gallery-filter-btn");
  const galleryClearBtn = document.getElementById("gallery-clear-btn");
  const galleryEmptyGenerateBtn = document.getElementById("gallery-empty-generate-btn");

  // Lightbox
  const lightboxOverlay = document.getElementById("lightbox-overlay");
  const lightboxModal = document.getElementById("lightbox-modal");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxPrompt = document.getElementById("lightbox-prompt");
  const lightboxNegPrompt = document.getElementById("lightbox-neg-prompt");
  const lightboxNegSection = document.getElementById("lightbox-neg-section");
  const lightboxModel = document.getElementById("lightbox-model");
  const lightboxStyle = document.getElementById("lightbox-style");
  const lightboxSize = document.getElementById("lightbox-size");
  const lightboxReuseBtn = document.getElementById("lightbox-reuse-btn");
  const lightboxDownloadBtn = document.getElementById("lightbox-download-btn");
  const lightboxFavBtn = document.getElementById("lightbox-fav-btn");
  const lightboxDeleteBtn = document.getElementById("lightbox-delete-btn");

  // Confirm dialog
  const confirmOverlay = document.getElementById("confirm-overlay");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmExtra = document.getElementById("confirm-extra");
  const confirmCancel = document.getElementById("confirm-cancel");
  const confirmOk = document.getElementById("confirm-ok");

  // ── STATE ─────────────────────────────────────────────────
  let isGenerating = false;
  let selectedModel = localStorage.getItem('default_model') || "flux-schnell";
  let isChatActive = false;   // tracks whether we're in chat mode
  let activeTab = "generate"; // "generate" or "gallery"
  let galleryFilter = "all";  // "all" or "favorites"
  let currentLightboxRecord = null; // the record currently shown in lightbox
  let _confirmResolve = null; // for the confirm dialog promise

  // ── INIT ──────────────────────────────────────────────────
  fetchCredits();
  autoResizeInput(promptInput);
  loadHistory();
  syncModelUI();

  // ── HELPERS: get active input/button refs ─────────────────
  function getActivePromptInput() {
    return isChatActive ? promptInputBottom : promptInput;
  }
  function getActiveSendBtn() {
    return isChatActive ? sendBtnBottom : sendBtn;
  }
  function getActiveCharCount() {
    return isChatActive ? charCountBottom : charCount;
  }

  // ── SIDEBAR TOGGLE (MOBILE) ───────────────────────────────
  toggleSidebar?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.getElementById("chat-main")?.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open") && !sidebar.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });

  // ── OPTIONS PANEL ─────────────────────────────────────────
  const optionsToggleBtns = document.querySelectorAll(".options-toggle-btn");
  const optionsPanel = document.getElementById("generation-options");
  const stylePresetsBtns = document.querySelectorAll("#style-presets .preset-btn");
  const aspectRatioBtns = document.querySelectorAll("#aspect-ratios .preset-btn");
  const negativePromptInput = document.getElementById("negative-prompt");

  let isOptionsOpen = false;
  let activeStyle = localStorage.getItem('default_style') || "none";
  let activeRatio = localStorage.getItem('default_aspect') || "1024x1024";

  // Pre-select options based on loaded preferences
  stylePresetsBtns.forEach(b => b.classList.toggle("active", b.dataset.style === activeStyle));
  aspectRatioBtns.forEach(b => b.classList.toggle("active", b.dataset.ratio === activeRatio));

  optionsToggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      isOptionsOpen = !isOptionsOpen;
      if (isOptionsOpen) {
        optionsPanel.classList.remove("hidden");
        optionsToggleBtns.forEach(b => b.classList.add("active"));
      } else {
        optionsPanel.classList.add("hidden");
        optionsToggleBtns.forEach(b => b.classList.remove("active"));
      }
    });
  });

  stylePresetsBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      stylePresetsBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeStyle = btn.dataset.style;
    });
  });

  aspectRatioBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      aspectRatioBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeRatio = btn.dataset.ratio;
    });
  });

  // ── TAB NAVIGATION ───────────────────────────────────────
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  function switchTab(tabName) {
    activeTab = tabName;

    // Update tab button states
    tabBtns.forEach(b => b.classList.remove("active"));
    
    // Hide all contents
    tabContentGenerate.classList.remove("active");
    tabContentEdit.classList.remove("active");
    tabContentGallery.classList.remove("active");

    if (tabName === "generate") {
      tabGenerate.classList.add("active");
      tabContentGenerate.classList.add("active");
    } else if (tabName === "edit") {
      tabEdit.classList.add("active");
      tabContentEdit.classList.add("active");
      // Force canvas resize if needed
      if (typeof window.resizeEditCanvas === 'function') window.resizeEditCanvas();
    } else {
      tabGallery.classList.add("active");
      tabContentGallery.classList.add("active");
      renderGallery();
    }
  }

  // "Start Creating" button in empty gallery
  galleryEmptyGenerateBtn?.addEventListener("click", () => {
    switchTab("generate");
    resetChat();
  });

  // ── NEW CHAT ──────────────────────────────────────────────
  newChatBtn?.addEventListener("click", () => {
    switchTab("generate");
    resetChat();
  });

  function resetChat() {
    chatMessages.innerHTML = "";
    chatMessages.appendChild(welcomeScreen);
    welcomeScreen.classList.remove("hidden");

    // Switch back to centered input
    isChatActive = false;
    inputBarBottom.classList.add("hidden");
    
    // Move options panel back to welcome screen
    if (optionsPanel) {
      const welcomeInputArea = document.getElementById("welcome-input-area");
      welcomeInputArea.insertBefore(optionsPanel, welcomeInputArea.querySelector('.input-bar-inner'));
    }

    promptInput.value = "";
    promptInput.style.height = "auto";
    promptInputBottom.value = "";
    promptInputBottom.style.height = "auto";

    updateCharCount(charCount, promptInput);
    updateCharCount(charCountBottom, promptInputBottom);
    updateSendBtn(sendBtn, promptInput);
    updateSendBtn(sendBtnBottom, promptInputBottom);

    fetchCredits();
    promptInput.focus();
    sidebar.classList.remove("open");
  }

  // ── SWITCH TO CHAT MODE ───────────────────────────────────
  function activateChatMode() {
    if (isChatActive) return;
    isChatActive = true;
    inputBarBottom.classList.remove("hidden");
    
    // Move options panel to bottom input bar
    if (optionsPanel) {
      inputBarBottom.insertBefore(optionsPanel, inputBarBottom.firstChild);
    }
    
    // Transfer any text from welcome input to bottom input
    promptInputBottom.value = promptInput.value;
    promptInput.value = "";
    autoResizeInput(promptInputBottom);
    updateCharCount(charCountBottom, promptInputBottom);
    updateSendBtn(sendBtnBottom, promptInputBottom);
    promptInputBottom.focus();
  }

  // ── PRESET PROMPTS ────────────────────────────────────────
  presets.forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      if (prompt && !isGenerating) {
        // Make sure we're on the Generate tab
        if (activeTab !== "generate") switchTab("generate");

        const input = getActivePromptInput();
        input.value = prompt;
        autoResizeInput(input);
        updateCharCount(getActiveCharCount(), input);
        updateSendBtn(getActiveSendBtn(), input);
        handleGenerate();
        sidebar.classList.remove("open");
      }
    });
  });

  // ── INPUT HANDLING (both inputs) ──────────────────────────
  function wireInput(input, charEl, btnEl) {
    input.addEventListener("input", () => {
      autoResizeInput(input);
      updateCharCount(charEl, input);
      updateSendBtn(btnEl, input);
    });

    input.addEventListener("keydown", (e) => {
      // Run autocorrect on space
      if (e.key === " ") {
        // Use setTimeout so the space character is inserted first
        setTimeout(() => {
          autocorrectLastWord(input);
          updateCharCount(charEl, input);
        }, 0);
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Autocorrect the last word before sending
        autocorrectLastWord(input);
        if (!btnEl.disabled) handleGenerate();
      }
    });

    btnEl.addEventListener("click", () => {
      // Autocorrect one final time before generating
      autocorrectLastWord(input);
      if (!btnEl.disabled) handleGenerate();
    });
  }

  wireInput(promptInput, charCount, sendBtn);
  wireInput(promptInputBottom, charCountBottom, sendBtnBottom);

  function autoResizeInput(input) {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  }

  function updateCharCount(el, input) {
    const len = input.value.length;
    el.textContent = `${len} / 500`;
    el.classList.toggle("near-limit", len >= 400 && len < 500);
    el.classList.toggle("at-limit", len >= 500);
  }

  function updateSendBtn(btn, input) {
    btn.disabled = isGenerating || input.value.trim().length === 0;
  }

  // ── MODEL PICKER MODAL ───────────────────────────────────
  function openModelModal() {
    modalOverlay.classList.remove("hidden");
  }

  function closeModelModal() {
    modalOverlay.classList.add("hidden");
  }

  modelPickerBtn?.addEventListener("click", openModelModal);
  modelPickerBtnBottom?.addEventListener("click", openModelModal);
  modalClose?.addEventListener("click", closeModelModal);

  // Close on overlay click (outside modal)
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModelModal();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!lightboxOverlay.classList.contains("hidden")) {
        closeLightbox();
      } else if (!confirmOverlay.classList.contains("hidden")) {
        resolveConfirm(false);
      } else if (!modalOverlay.classList.contains("hidden")) {
        closeModelModal();
      }
    }
  });

  // Model card selection
  modelCards.forEach(card => {
    card.addEventListener("click", () => {
      const modelKey = card.dataset.model;
      if (!modelKey) return;

      selectedModel = modelKey;

      // Update active state on cards
      modelCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      syncModelUI();
      closeModelModal();

      // Focus the active prompt input
      getActivePromptInput().focus();
    });
  });

  function syncModelUI() {
    const name = MODEL_LABELS[selectedModel] || selectedModel;
    if (modelPickerLabel) modelPickerLabel.textContent = name;
    if (modelPickerLabelBtm) modelPickerLabelBtm.textContent = name;
    if (sidebarMeta) sidebarMeta.textContent = name;
  }

  // ── CREDITS ───────────────────────────────────────────────
  async function fetchCredits() {
    try {
      const headers = {};
      if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`;
      const res = await fetch(`${API_URL}/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        updateCreditsUI(data.remaining, data.daily_limit);
      }
    } catch {
      if (creditsEl) creditsEl.textContent = "Backend offline";
    }
  }

  function updateCreditsUI(remaining, total) {
    if (!creditsEl) return;
    creditsEl.textContent = `${remaining}/${total} left today`;
    creditsBadge.classList.remove("low", "depleted");
    if (remaining === 0) {
      creditsBadge.classList.add("depleted");
    } else if (remaining <= 1) {
      creditsBadge.classList.add("low");
    }
  }

  // ── SIDEBAR HISTORY (from IndexedDB) ─────────────────────
  async function loadHistory() {
    sidebarHistory.innerHTML = "";
    try {
      const records = await Storage.getAllGenerations();
      records.forEach(record => {
        addToSidebarHistory(record.prompt, record.image, record.createdAt);
      });
      updateGalleryCount(records.length);
    } catch {
      // Storage unavailable — sidebar stays empty
    }
  }

  // ── MESSAGE RENDERING ────────────────────────────────────
  function addMessage(role, content, opts = {}) {
    welcomeScreen.classList.add("hidden");

    const msg = document.createElement("div");
    msg.classList.add("message");

    const avatar = document.createElement("div");
    avatar.classList.add("msg-avatar", role);

    if (role === "ai") {
      const logoImg = document.createElement("img");
      logoImg.src = "assets/logo.png";
      logoImg.alt = "AI";
      logoImg.classList.add("avatar-logo");
      avatar.appendChild(logoImg);
    } else {
      avatar.textContent = "Y";
    }

    const body = document.createElement("div");
    body.classList.add("msg-body");

    const label = document.createElement("div");
    label.classList.add("msg-label");
    label.textContent = role === "user" ? "You" : "Pixabel";

    body.appendChild(label);

    if (opts.loading) {
      const loadWrap = document.createElement("div");
      loadWrap.classList.add("loading-shimmer");
      
      // Determine aspect ratio if provided in prompt content, otherwise default 1:1
      loadWrap.style.aspectRatio = "1 / 1";
      loadWrap.style.display = "flex";
      loadWrap.style.alignItems = "center";
      loadWrap.style.justifyContent = "center";
      
      const svgLoader = document.createElement("div");
      svgLoader.style.width = "48px";
      svgLoader.style.height = "48px";
      svgLoader.innerHTML = `
        <img src="assets/logo.png" alt="Loading" class="loader-pulse-anim" style="width: 100%; height: 100%; object-fit: contain;" />
      `;

      loadWrap.appendChild(svgLoader);

      const statusText = document.createElement("div");
      statusText.classList.add("loading-shimmer-text");
      statusText.style.position = "absolute";
      statusText.style.bottom = "16px";
      statusText.style.left = "0";
      statusText.style.right = "0";
      statusText.style.zIndex = "2";
      statusText.textContent = content || "GENERATING...";

      loadWrap.appendChild(statusText);
      body.appendChild(loadWrap);
    } else if (opts.error) {
      const err = document.createElement("div");
      err.classList.add("msg-error");
      err.textContent = content;
      body.appendChild(err);
    } else {
      const text = document.createElement("div");
      text.classList.add("msg-text");
      text.textContent = content;
      body.appendChild(text);
    }

    if (opts.image) {
      appendImageToBody(body, opts.image, content);
    }

    msg.appendChild(avatar);
    msg.appendChild(body);
    chatMessages.appendChild(msg);

    requestAnimationFrame(() => {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    });

    return msg;
  }

  function appendImageToBody(body, imageSrc, altText) {
    const wrap = document.createElement("div");
    wrap.classList.add("msg-image-wrap");
    const img = document.createElement("img");
    img.src = imageSrc;
    img.alt = altText || "Generated image";
    wrap.appendChild(img);
    body.appendChild(wrap);

    const actions = document.createElement("div");
    actions.classList.add("msg-actions");

    const dlBtn = document.createElement("button");
    dlBtn.classList.add("msg-action-btn");
    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download`;
    dlBtn.addEventListener("click", () => downloadImage(imageSrc, altText));
    actions.appendChild(dlBtn);
    
    const editBtn = document.createElement("button");
    editBtn.classList.add("msg-action-btn");
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg> Edit this image`;
    editBtn.addEventListener("click", () => {
       if (typeof window.loadIntoEditor === 'function') {
           window.loadIntoEditor(imageSrc);
       }
    });
    actions.appendChild(editBtn);

    body.appendChild(actions);
  }

  function replaceMessage(msgEl, role, content, opts = {}) {
    const body = msgEl.querySelector(".msg-body");
    if (!body) return;

    const label = body.querySelector(".msg-label");
    body.innerHTML = "";
    if (label) body.appendChild(label);

    if (opts.error) {
      const err = document.createElement("div");
      err.classList.add("msg-error");
      err.textContent = content;
      body.appendChild(err);
    } else {
      const text = document.createElement("div");
      text.classList.add("msg-text");
      text.textContent = content;
      body.appendChild(text);
    }

    if (opts.image) {
      appendImageToBody(body, opts.image, content);
    }

    requestAnimationFrame(() => {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    });
  }

  // ── CORE GENERATION LOGIC ─────────────────────────────────
  async function handleGenerate() {
    const input = getActivePromptInput();
    const prompt = input.value.trim();
    if (!prompt || isGenerating) return;

    isGenerating = true;

    // Make sure we're on the Generate tab
    if (activeTab !== "generate") switchTab("generate");

    // Switch to chat mode (shows bottom input, hides welcome)
    activateChatMode();

    // Disable both send buttons
    sendBtn.disabled = true;
    sendBtnBottom.disabled = true;

    // Add user message
    addMessage("user", prompt);

    // Clear both inputs
    promptInput.value = "";
    promptInput.style.height = "auto";
    promptInputBottom.value = "";
    promptInputBottom.style.height = "auto";
    updateCharCount(charCount, promptInput);
    updateCharCount(charCountBottom, promptInputBottom);

    // Determine model
    const modelName = MODEL_LABELS[selectedModel] || selectedModel;

    // ── Apply Phase 1 Options ──
    let finalPrompt = prompt;
    
    // Apply style modifier
    if (activeStyle !== "none") {
      const styleModifiers = {
        "Realistic Photo": ", photorealistic, professional photography, sharp focus, natural lighting, 8k",
        "Anime": ", anime style, vibrant colors, cel shading, Studio Ghibli inspired",
        "3D Render": ", 3D render, octane render, unreal engine, highly detailed, cinematic lighting",
        "Digital Art": ", digital art, concept art, trending on artstation, highly detailed",
        "Oil Painting": ", oil painting, textured brushstrokes, classical art style, museum quality"
      };
      if (styleModifiers[activeStyle]) {
        finalPrompt += styleModifiers[activeStyle];
      }
    }

    const [width, height] = activeRatio.split("x").map(Number);
    const negativePrompt = negativePromptInput.value.trim();

    // Add loading AI message with model name and style
    const styleText = activeStyle !== "none" ? ` (${activeStyle} style)` : "";
    const aiMsg = addMessage("ai", `Generating with ${modelName}${styleText}…`, { loading: true });

    try {
      const headers = { "Content-Type": "application/json" };
      if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`;
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ 
          prompt: finalPrompt, 
          model: selectedModel,
          negative_prompt: negativePrompt,
          width: width,
          height: height
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        replaceMessage(aiMsg, "ai", "Server returned an invalid response.", { error: true });
        return;
      }

      if (res.status === 429 || data.code === "TOKEN_EXPIRED") {
        updateCreditsUI(0, data.daily_limit || 4);
        replaceMessage(aiMsg, "ai", "🔒 Your daily free generations are used up. Please come back tomorrow!", { error: true });
        return;
      }

      if (!res.ok) {
        replaceMessage(aiMsg, "ai", data.error || `Server error (HTTP ${res.status})`, { error: true });
        return;
      }

      if (!data.image) {
        replaceMessage(aiMsg, "ai", "Server returned a response with no image data.", { error: true });
        return;
      }

      // Success!
      if (data.remaining !== undefined) {
        updateCreditsUI(data.remaining, data.daily_limit || 4);
      }

      const shortPrompt = prompt.slice(0, 60) + (prompt.length > 60 ? "…" : "");
      replaceMessage(aiMsg, "ai", `Here's your image for "${shortPrompt}"`, { image: data.image });

      // ── Auto-save to IndexedDB ──
      const savedRecord = await Storage.saveGeneration({
        image: data.image,
        prompt: prompt,
        negativePrompt: negativePrompt,
        model: selectedModel,
        style: activeStyle,
        width: width,
        height: height,
      });

      // Update sidebar history
      addToSidebarHistory(prompt, data.image, Date.now(), true);

      // Update gallery count
      const allRecords = await Storage.getAllGenerations();
      updateGalleryCount(allRecords.length);

    } catch (err) {
      if (err instanceof TypeError) {
        replaceMessage(aiMsg, "ai", "Cannot reach the backend server. Make sure Flask is running on http://127.0.0.1:5000", { error: true });
      } else {
        replaceMessage(aiMsg, "ai", `Unexpected error: ${err.message}`, { error: true });
      }
    } finally {
      isGenerating = false;
      updateSendBtn(sendBtn, promptInput);
      updateSendBtn(sendBtnBottom, promptInputBottom);
      getActivePromptInput().focus();
    }
  }

  // ── SIDEBAR HISTORY ───────────────────────────────────────
  function addToSidebarHistory(prompt, imageSrc, timestamp, prepend = true) {
    const el = document.createElement("button");
    el.classList.add("sidebar-item", "history-item");

    const shortText = prompt.length > 30 ? prompt.slice(0, 30) + "…" : prompt;
    const timeStr = timestamp ? formatTime(timestamp) : "";

    el.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      <div class="history-text">
        <span class="history-prompt">${shortText}</span>
        ${timeStr ? `<span class="history-time">${timeStr}</span>` : ""}
      </div>
    `;

    // Clicking a history item shows it in chat
    el.addEventListener("click", () => {
      // Make sure we're on the Generate tab
      if (activeTab !== "generate") switchTab("generate");

      // Clear chat and show this conversation
      chatMessages.innerHTML = "";
      chatMessages.appendChild(welcomeScreen);
      welcomeScreen.classList.add("hidden");

      // Switch to chat mode
      activateChatMode();

      addMessage("user", prompt);
      if (imageSrc) {
        const shortP = prompt.slice(0, 60) + (prompt.length > 60 ? "…" : "");
        addMessage("ai", `Here's your image for "${shortP}"`, { image: imageSrc });
      }
      sidebar.classList.remove("open");
    });

    if (prepend) {
      sidebarHistory.prepend(el);
    } else {
      sidebarHistory.appendChild(el);
    }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  }

  // ── GALLERY ───────────────────────────────────────────────

  function updateGalleryCount(count) {
    if (galleryCountEl) {
      galleryCountEl.textContent = count > 0 ? `(${count})` : "";
    }
  }

  // Filter buttons
  galleryFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      galleryFilter = btn.dataset.filter;
      galleryFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderGallery();
    });
  });

  // Clear all button
  galleryClearBtn?.addEventListener("click", async () => {
    const records = await Storage.getAllGenerations();
    const favCount = records.filter(r => r.favorite).length;
    const total = records.length;

    if (total === 0) return;

    let extraHTML = "";
    if (favCount > 0) {
      extraHTML = `
        <label class="confirm-checkbox-label">
          <input type="checkbox" id="confirm-include-favs" />
          <span>Also delete ${favCount} favorited image${favCount > 1 ? "s" : ""}</span>
        </label>
      `;
    }

    const confirmed = await showConfirm(
      "Clear All History",
      `This will delete ${total - favCount} image${total - favCount !== 1 ? "s" : ""} from your history.${favCount > 0 ? " Favorites are kept by default." : ""}`,
      "Delete",
      extraHTML
    );

    if (!confirmed) return;

    const includeFavs = favCount > 0 && document.getElementById("confirm-include-favs")?.checked;
    await Storage.clearAll(includeFavs);

    renderGallery();
    loadHistory();
  });

  async function renderGallery() {
    const records = await Storage.getAllGenerations();
    let filtered = records;

    if (galleryFilter === "favorites") {
      filtered = records.filter(r => r.favorite);
    } else if (galleryFilter === "edits") {
      filtered = records.filter(r => r.type === "edit");
    }

    updateGalleryCount(records.length);

    galleryGrid.innerHTML = "";

    if (filtered.length === 0) {
      galleryGrid.classList.add("hidden");
      galleryEmpty.classList.remove("hidden");

      if (galleryFilter === "favorites") {
        galleryEmpty.querySelector("h3").textContent = "No favorites yet";
        galleryEmpty.querySelector("p").textContent = "Star some images to find them here.";
        galleryEmptyGenerateBtn.classList.add("hidden");
      } else if (galleryFilter === "edits") {
        galleryEmpty.querySelector("h3").textContent = "No edits yet";
        galleryEmpty.querySelector("p").textContent = "Use the Edit tab to modify an image.";
        galleryEmptyGenerateBtn.classList.add("hidden");
      } else {
        galleryEmpty.querySelector("h3").textContent = "No images yet";
        galleryEmpty.querySelector("p").textContent = "Go generate something amazing! Your creations will appear here.";
        galleryEmptyGenerateBtn.classList.remove("hidden");
      }
      return;
    }

    galleryGrid.classList.remove("hidden");
    galleryEmpty.classList.add("hidden");

    filtered.forEach(record => {
      const card = createGalleryCard(record);
      galleryGrid.appendChild(card);
    });
  }

  function createGalleryCard(record) {
    const card = document.createElement("div");
    card.classList.add("gallery-card");
    card.dataset.id = record.id;

    const truncatedPrompt = record.prompt.length > 60
      ? record.prompt.slice(0, 60) + "…"
      : record.prompt;

    const modelLabel = MODEL_LABELS[record.model] || record.model || "Unknown";
    const styleLabel = record.style && record.style !== "none" ? record.style : "";

    card.innerHTML = `
      <div class="gallery-card-image">
        <img src="${record.image}" alt="${escapeHtml(record.prompt)}" loading="lazy" />
        ${record.type === "edit" ? '<span class="model-card-badge quality" style="position:absolute; top:8px; left:8px; z-index:10; background:rgba(168,85,247,0.8); border:none; color:white;">Edited</span>' : ''}
        <div class="gallery-card-overlay">
          <button class="gallery-card-action fav-btn ${record.favorite ? "active" : ""}" data-action="fav" title="Favorite">
            <svg viewBox="0 0 24 24" fill="${record.favorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button class="gallery-card-action" data-action="edit-img" title="Edit this image">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button class="gallery-card-action" data-action="download" title="Download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </button>
          <button class="gallery-card-action danger" data-action="delete" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="gallery-card-info">
        <div class="gallery-card-prompt">${escapeHtml(truncatedPrompt)}</div>
        <div class="gallery-card-meta">
          <span class="gallery-card-model">${escapeHtml(modelLabel)}</span>
          ${styleLabel ? `<span class="gallery-card-style">${escapeHtml(styleLabel)}</span>` : ""}
        </div>
      </div>
    `;

    // Click on image → open lightbox
    const imgEl = card.querySelector(".gallery-card-image img");
    imgEl.addEventListener("click", () => openLightbox(record));

    // Action buttons
    card.querySelector('[data-action="fav"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      const newState = await Storage.toggleFavorite(record.id);
      if (newState !== null) {
        record.favorite = newState;
        renderGallery(); // re-render to update icons
      }
    });

    card.querySelector('[data-action="edit-img"]').addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof window.loadIntoEditor === 'function') {
        window.loadIntoEditor(record.image, record.id);
      }
    });

    card.querySelector('[data-action="download"]').addEventListener("click", (e) => {
      e.stopPropagation();
      downloadImage(record.image, record.prompt);
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = await showConfirm(
        "Delete Image",
        "Are you sure you want to delete this image? This cannot be undone.",
        "Delete"
      );
      if (confirmed) {
        await Storage.deleteGeneration(record.id);
        renderGallery();
        loadHistory();
      }
    });

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── LIGHTBOX ──────────────────────────────────────────────

  function openLightbox(record) {
    currentLightboxRecord = record;

    lightboxImage.src = record.image;
    lightboxPrompt.textContent = record.prompt;

    if (record.negativePrompt) {
      lightboxNegPrompt.textContent = record.negativePrompt;
      lightboxNegSection.classList.remove("hidden");
    } else {
      lightboxNegSection.classList.add("hidden");
    }

    lightboxModel.textContent = MODEL_LABELS[record.model] || record.model || "Unknown";
    lightboxStyle.textContent = record.style && record.style !== "none" ? record.style : "None";
    lightboxSize.textContent = `${record.width} × ${record.height}`;
    
    const editPromptEl = document.getElementById("lightbox-edit-prompt-val");
    if (record.type === "edit" && record.editPrompt) {
      if (!editPromptEl) {
        const div = document.createElement("div");
        div.className = "lightbox-detail-section";
        div.id = "lightbox-edit-prompt-sec";
        div.innerHTML = `<div class="lightbox-detail-label">Edit Prompt</div><div class="lightbox-detail-value" id="lightbox-edit-prompt-val">${escapeHtml(record.editPrompt)}</div>`;
        document.querySelector(".lightbox-details").insertBefore(div, document.getElementById("lightbox-neg-section"));
      } else {
        editPromptEl.textContent = record.editPrompt;
        document.getElementById("lightbox-edit-prompt-sec").classList.remove("hidden");
      }
    } else if (editPromptEl) {
      document.getElementById("lightbox-edit-prompt-sec").classList.add("hidden");
    }

    // Update fav button state
    updateLightboxFavBtn(record.favorite);

    lightboxOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightboxOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    currentLightboxRecord = null;
  }

  function updateLightboxFavBtn(isFav) {
    const svgEl = lightboxFavBtn.querySelector("svg");
    const spanEl = lightboxFavBtn.querySelector("span");
    if (isFav) {
      lightboxFavBtn.classList.add("active");
      svgEl.setAttribute("fill", "currentColor");
      spanEl.textContent = "Favorited";
    } else {
      lightboxFavBtn.classList.remove("active");
      svgEl.setAttribute("fill", "none");
      spanEl.textContent = "Favorite";
    }
  }

  lightboxClose?.addEventListener("click", closeLightbox);

  // Close on overlay click
  lightboxOverlay?.addEventListener("click", (e) => {
    if (e.target === lightboxOverlay) closeLightbox();
  });

  // Reuse settings
  lightboxReuseBtn?.addEventListener("click", () => {
    if (!currentLightboxRecord) return;
    const rec = currentLightboxRecord;

    closeLightbox();
    switchTab("generate");
    resetChat();

    // Fill in the prompt
    const input = getActivePromptInput();
    input.value = rec.prompt;
    autoResizeInput(input);
    updateCharCount(getActiveCharCount(), input);
    updateSendBtn(getActiveSendBtn(), input);

    // Set negative prompt
    if (negativePromptInput) {
      negativePromptInput.value = rec.negativePrompt || "";
    }

    // Set model
    if (rec.model && MODEL_LABELS[rec.model]) {
      selectedModel = rec.model;
      modelCards.forEach(c => {
        c.classList.toggle("active", c.dataset.model === selectedModel);
      });
      syncModelUI();
    }

    // Set style
    if (rec.style) {
      activeStyle = rec.style;
      stylePresetsBtns.forEach(b => {
        b.classList.toggle("active", b.dataset.style === activeStyle);
      });
    }

    // Set aspect ratio
    const ratioStr = `${rec.width}x${rec.height}`;
    activeRatio = ratioStr;
    aspectRatioBtns.forEach(b => {
      b.classList.toggle("active", b.dataset.ratio === ratioStr);
    });

    // Show options panel if there are non-default settings
    const hasCustomSettings = rec.style !== "none" || rec.negativePrompt || ratioStr !== "1024x1024";
    if (hasCustomSettings && !isOptionsOpen) {
      isOptionsOpen = true;
      optionsPanel.classList.remove("hidden");
      optionsToggleBtns.forEach(b => b.classList.add("active"));
    }

    input.focus();
  });

  // Download from lightbox
  lightboxDownloadBtn?.addEventListener("click", () => {
    if (currentLightboxRecord) {
      downloadImage(currentLightboxRecord.image, currentLightboxRecord.prompt);
    }
  });

  // Favorite from lightbox
  lightboxFavBtn?.addEventListener("click", async () => {
    if (!currentLightboxRecord) return;
    const newState = await Storage.toggleFavorite(currentLightboxRecord.id);
    if (newState !== null) {
      currentLightboxRecord.favorite = newState;
      updateLightboxFavBtn(newState);
    }
  });

  // Edit from lightbox
  const lightboxEditBtn = document.getElementById("lightbox-edit-btn");
  lightboxEditBtn?.addEventListener("click", () => {
    if (currentLightboxRecord && typeof window.loadIntoEditor === 'function') {
      window.loadIntoEditor(currentLightboxRecord.image, currentLightboxRecord.id);
      closeLightbox();
    }
  });

  // Delete from lightbox
  lightboxDeleteBtn?.addEventListener("click", async () => {
    if (!currentLightboxRecord) return;
    const confirmed = await showConfirm(
      "Delete Image",
      "Are you sure you want to delete this image? This cannot be undone.",
      "Delete"
    );
    if (confirmed) {
      await Storage.deleteGeneration(currentLightboxRecord.id);
      closeLightbox();
      renderGallery();
      loadHistory();
    }
  });

  // ── CONFIRM DIALOG ───────────────────────────────────────

  function showConfirm(title, message, okText = "OK", extraHTML = "") {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOk.textContent = okText;

    if (extraHTML) {
      confirmExtra.innerHTML = extraHTML;
      confirmExtra.classList.remove("hidden");
    } else {
      confirmExtra.innerHTML = "";
      confirmExtra.classList.add("hidden");
    }

    confirmOverlay.classList.remove("hidden");

    return new Promise(resolve => {
      _confirmResolve = resolve;
    });
  }

  function resolveConfirm(value) {
    confirmOverlay.classList.add("hidden");
    if (_confirmResolve) {
      _confirmResolve(value);
      _confirmResolve = null;
    }
  }

  confirmOk?.addEventListener("click", () => resolveConfirm(true));
  confirmCancel?.addEventListener("click", () => resolveConfirm(false));
  confirmOverlay?.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) resolveConfirm(false);
  });

  // ── DOWNLOAD (saves to Downloads folder) ──────────────────
  function downloadImage(dataUri, promptText) {
    if (!dataUri) return;

    // Create a proper filename
    const safeName = (promptText || "Pixabel_image")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "Pixabel_image";
    const fileName = `Pixabel_${safeName}.png`;

    // For data URIs, convert to blob for a cleaner download
    if (dataUri.startsWith("data:")) {
      const byteString = atob(dataUri.split(",")[1]);
      const mimeString = dataUri.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      window.showToast("Image downloaded successfully!");
    } else {
      const link = document.createElement("a");
      link.href = dataUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.showToast("Image downloaded successfully!");
    }
  }

  // ── EDIT TAB LOGIC ────────────────────────────────────────

  const editDropZone = document.getElementById("edit-drop-zone");
  const editFileInput = document.getElementById("edit-file-input");
  const editUploadBtn = document.getElementById("edit-upload-btn");
  const editCanvas = document.getElementById("edit-canvas");
  const editCtx = editCanvas.getContext("2d");
  const editEmptyState = document.getElementById("edit-empty-state");
  const editImageActions = document.getElementById("edit-image-actions");
  
  const editPromptInput = document.getElementById("edit-prompt-input");
  const editModelSelect = document.getElementById("edit-model-select");
  const editAiApplyBtn = document.getElementById("edit-ai-apply-btn");
  const editLoadingMsg = document.getElementById("edit-loading-msg");
  const editChips = document.querySelectorAll(".edit-chip");
  
  const editUndoBtn = document.getElementById("edit-undo-btn");
  const editResetBtn = document.getElementById("edit-reset-btn");
  const editCompareBtn = document.getElementById("edit-compare-btn");
  const editCompareOverlay = document.getElementById("edit-compare-overlay");
  const editCompareImg = document.getElementById("edit-compare-img");
  
  const toolRotLeft = document.getElementById("tool-rot-left");
  const toolRotRight = document.getElementById("tool-rot-right");
  const toolFlipH = document.getElementById("tool-flip-h");
  const toolFlipV = document.getElementById("tool-flip-v");
  
  const sliderBrightness = document.getElementById("slider-brightness");
  const sliderContrast = document.getElementById("slider-contrast");
  const sliderSaturation = document.getElementById("slider-saturation");
  const sliderBlur = document.getElementById("slider-blur");
  
  const filterGrayscale = document.getElementById("filter-grayscale");
  const filterSepia = document.getElementById("filter-sepia");
  const filterInvert = document.getElementById("filter-invert");
  
  const editSaveGalleryBtn = document.getElementById("edit-save-gallery-btn");
  const editDownloadBtn = document.getElementById("edit-download-btn");
  
  let sourceImage = null;
  let originalImageSrc = null;
  let editHistory = [];
  let currentParentId = null;
  
  let baseEdits = {
    brightness: 100, contrast: 100, saturation: 100, blur: 0,
    grayscale: false, sepia: false, invert: false,
    rotation: 0, flipH: 1, flipV: 1
  };
  
  function resetBaseEdits() {
    baseEdits = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: false, sepia: false, invert: false, rotation: 0, flipH: 1, flipV: 1 };
    sliderBrightness.value = 100;
    sliderContrast.value = 100;
    sliderSaturation.value = 100;
    sliderBlur.value = 0;
    updateSliderLabels();
  }
  
  function updateSliderLabels() {
    document.getElementById("val-brightness").textContent = sliderBrightness.value + "%";
    document.getElementById("val-contrast").textContent = sliderContrast.value + "%";
    document.getElementById("val-saturation").textContent = sliderSaturation.value + "%";
    document.getElementById("val-blur").textContent = sliderBlur.value + "px";
  }
  
  window.loadIntoEditor = (imageSrc, parentId = null) => {
    switchTab("edit");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      sourceImage = img;
      originalImageSrc = imageSrc;
      editCompareImg.src = originalImageSrc;
      currentParentId = parentId;
      resetBaseEdits();
      editHistory = [imageSrc];
      
      editEmptyState.classList.add("hidden");
      editCanvas.classList.remove("hidden");
      editImageActions.classList.remove("hidden");
      editAiApplyBtn.disabled = false;
      editSaveGalleryBtn.disabled = false;
      editDownloadBtn.disabled = false;
      
      drawCanvas();
    };
    img.src = imageSrc;
  };
  
  window.resizeEditCanvas = () => {
    if (sourceImage) drawCanvas();
  };
  
  editUploadBtn.addEventListener("click", () => editFileInput.click());
  editFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleEditFile(e.target.files[0]);
  });
  
  editDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    editDropZone.classList.add("drag-over");
  });
  editDropZone.addEventListener("dragleave", () => {
    editDropZone.classList.remove("drag-over");
  });
  editDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    editDropZone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleEditFile(e.dataTransfer.files[0]);
  });
  
  function handleEditFile(file) {
    if (!file.type.match(/image\/(png|jpeg|webp)/)) {
      alert("Invalid file type. Please upload a PNG, JPEG, or WEBP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("File is too large (max 8 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      window.loadIntoEditor(e.target.result);
    };
    reader.readAsDataURL(file);
  }
  
  function drawCanvas() {
    if (!sourceImage) return;
    
    let rad = baseEdits.rotation * Math.PI / 180;
    let cos = Math.abs(Math.cos(rad));
    let sin = Math.abs(Math.sin(rad));
    let w = sourceImage.width * cos + sourceImage.height * sin;
    let h = sourceImage.width * sin + sourceImage.height * cos;
    
    const containerW = editDropZone.clientWidth - 40;
    const containerH = editDropZone.clientHeight - 40;
    
    let scale = Math.min(containerW / w, containerH / h);
    if (scale > 1) scale = 1;
    
    editCanvas.width = w * scale;
    editCanvas.height = h * scale;
    
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    editCtx.save();
    
    editCtx.translate(editCanvas.width / 2, editCanvas.height / 2);
    editCtx.rotate(rad);
    editCtx.scale(baseEdits.flipH * scale, baseEdits.flipV * scale);
    
    let filterStr = `brightness(${baseEdits.brightness}%) contrast(${baseEdits.contrast}%) saturate(${baseEdits.saturation}%) blur(${baseEdits.blur}px)`;
    if (baseEdits.grayscale) filterStr += " grayscale(100%)";
    if (baseEdits.sepia) filterStr += " sepia(100%)";
    if (baseEdits.invert) filterStr += " invert(100%)";
    editCtx.filter = filterStr;
    
    editCtx.drawImage(sourceImage, -sourceImage.width / 2, -sourceImage.height / 2);
    editCtx.restore();
  }
  
  toolRotLeft.addEventListener("click", () => { baseEdits.rotation -= 90; drawCanvas(); });
  toolRotRight.addEventListener("click", () => { baseEdits.rotation += 90; drawCanvas(); });
  toolFlipH.addEventListener("click", () => { baseEdits.flipH *= -1; drawCanvas(); });
  toolFlipV.addEventListener("click", () => { baseEdits.flipV *= -1; drawCanvas(); });
  
  [sliderBrightness, sliderContrast, sliderSaturation, sliderBlur].forEach(el => {
    el.addEventListener("input", () => {
      baseEdits[el.id.replace("slider-", "")] = parseInt(el.value);
      updateSliderLabels();
      drawCanvas();
    });
  });
  
  filterGrayscale.addEventListener("click", () => { baseEdits.grayscale = !baseEdits.grayscale; drawCanvas(); });
  filterSepia.addEventListener("click", () => { baseEdits.sepia = !baseEdits.sepia; drawCanvas(); });
  filterInvert.addEventListener("click", () => { baseEdits.invert = !baseEdits.invert; drawCanvas(); });
  
  editResetBtn.addEventListener("click", () => { resetBaseEdits(); drawCanvas(); });
  
  editCompareBtn.addEventListener("mousedown", () => editCompareOverlay.classList.remove("hidden"));
  editCompareBtn.addEventListener("mouseup", () => editCompareOverlay.classList.add("hidden"));
  editCompareBtn.addEventListener("mouseleave", () => editCompareOverlay.classList.add("hidden"));
  editCompareBtn.addEventListener("touchstart", () => editCompareOverlay.classList.remove("hidden"));
  editCompareBtn.addEventListener("touchend", () => editCompareOverlay.classList.add("hidden"));
  
  editUndoBtn.addEventListener("click", () => {
    if (editHistory.length > 1) {
      editHistory.pop();
      const lastState = editHistory[editHistory.length - 1];
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        resetBaseEdits();
        drawCanvas();
      };
      img.src = lastState;
    }
  });
  
  editPromptInput.addEventListener("input", () => {
    editPromptInput.style.height = "auto";
    editPromptInput.style.height = Math.min(editPromptInput.scrollHeight, 100) + "px";
  });
  
  editChips.forEach(chip => {
    chip.addEventListener("click", () => {
      editPromptInput.value = chip.dataset.edit;
    });
  });
  
  // Custom Select Logic for Edit Model
  const editModelTrigger = document.getElementById("edit-model-trigger");
  const editModelOptions = document.getElementById("edit-model-options");
  const editModelLabel = document.getElementById("edit-model-label");
  const editModelOpts = document.querySelectorAll(".custom-select-option");
  
  editModelTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    editModelOptions.classList.toggle("hidden");
  });
  
  document.addEventListener("click", (e) => {
    if (!editModelTrigger.contains(e.target) && !editModelOptions.contains(e.target)) {
      editModelOptions.classList.add("hidden");
    }
  });
  
  editModelOpts.forEach(opt => {
    opt.addEventListener("click", () => {
      editModelOpts.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      editModelLabel.textContent = opt.textContent;
      editModelSelect.value = opt.dataset.value;
      editModelOptions.classList.add("hidden");
    });
  });
  
  editAiApplyBtn.addEventListener("click", async () => {
    const prompt = editPromptInput.value.trim();
    if (!prompt || !sourceImage) return;
    
    const dataUrl = editCanvas.toDataURL("image/png");
    
    editLoadingMsg.classList.remove("hidden");
    editAiApplyBtn.disabled = true;
    
    try {
      const headers = { "Content-Type": "application/json" };
      if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`;
      const res = await fetch(`${API_URL}/edit`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          image: dataUrl,
          prompt: prompt,
          model: editModelSelect.value
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to edit image");
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        resetBaseEdits();
        drawCanvas();
        editHistory.push(data.image);
        if (editHistory.length > 10) editHistory.shift();
      };
      img.src = data.image;
      
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      editLoadingMsg.classList.add("hidden");
      editAiApplyBtn.disabled = false;
    }
  });
  
  editDownloadBtn.addEventListener("click", () => {
    const dataUrl = editCanvas.toDataURL("image/png");
    downloadImage(dataUrl, editPromptInput.value.trim() || "EditedImage");
  });
  
  editSaveGalleryBtn.addEventListener("click", async () => {
    const dataUrl = editCanvas.toDataURL("image/png");
    const prompt = editPromptInput.value.trim();
    const savedRecord = await Storage.saveGeneration({
      image: dataUrl,
      prompt: prompt || "Edited Image",
      model: editModelSelect.value,
      type: "edit",
      parentId: currentParentId,
      editPrompt: prompt
    });
    
    if (savedRecord) {
      loadHistory();
      renderGallery();
      window.showToast("Saved to gallery successfully!");
    }
  });

})();
