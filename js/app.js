const App = {
  currentPage: null,
  currentRoute: null,
  _lastHandledRoute: null,
  _lastHandledAt: 0,

  GUIDE_SECTIONS: ['how-it-works', 'safety', 'copyright', 'faq'],

  TOP_NAV_ITEMS: [
    { id: 'nfl', label: 'NFL', path: '/league/nfl' },
    { id: 'nba', label: 'NBA', path: '/league/nba' },
    { id: 'mlb', label: 'MLB', path: '/league/mlb' },
    { id: 'nhl', label: 'NHL', path: '/league/nhl' },
    { id: 'ufc', label: 'UFC', path: '/league/ufc' },
    { id: 'soccer', label: 'Soccer', path: '/category/football' },
    { id: 'f1', label: 'F1', path: '/league/f1' },
  ],

  SPORT_CATEGORIES: [
    { id: 'american-football', icon: '\uD83C\uDFC8', name: 'Football', image: 'img/sports/american-football.webp' },
    { id: 'basketball', icon: '\uD83C\uDFC0', name: 'Basketball', image: 'img/sports/basketball.webp' },
    { id: 'baseball', icon: '\u26BE', name: 'Baseball', image: 'img/sports/baseball.webp' },
    { id: 'hockey', icon: '\uD83C\uDFD2', name: 'Hockey', image: 'img/sports/hockey.webp' },
    { id: 'football', icon: '\u26BD', name: 'Soccer', image: 'img/sports/football.webp' },
    { id: 'fight', icon: '\uD83E\uDD4A', name: 'Fight', image: 'img/sports/fight.webp' },
    { id: 'motor-sports', icon: '\uD83C\uDFCE', name: 'Motor Sports', image: 'img/sports/motor-sports.webp' },
    { id: 'tennis', icon: '\uD83C\uDFBE', name: 'Tennis', image: 'img/sports/tennis.webp' },
    { id: 'golf', icon: '\u26F3', name: 'Golf', image: 'img/sports/golf.webp' },
  ],

  async init() {
    this.initImportantNotice();
    this.initDiscordInvite();
    this.setupChrome();
    this.setupNavigation();
    this.setupKeyboardNav();

    this.setMode(this.isWatchHash() ? 'watch' : 'guide');
    await this.handleRoute();

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('popstate', () => this.handleRoute());
  },

  DISCORD_GUILD_ID: '1422384816472457288',

  async initDiscordInvite() {
    const el = document.getElementById('discord-join-link');
    if (!el) return;

    const apply = (url) => {
      if (!url) return false;
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.title = 'Join our Discord';
      el.classList.add('discord-ready');
      return true;
    };

    const CACHE_KEY = 'gk_discord_invite';
    const TTL = 15 * 60 * 1000;

    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.url && Date.now() - cached.time < TTL) {
          if (apply(cached.url)) return;
        }
      }
    } catch (e) { /* ignore cache errors */ }

    try {
      const response = await fetch(
        `https://discord.com/api/guilds/${this.DISCORD_GUILD_ID}/widget.json`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const url = data.instant_invite || null;
      if (apply(url)) {
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ url, time: Date.now() })
          );
        } catch (e) { /* ignore quota */ }
      }
    } catch (e) {
      // Keep button inert if widget API fails
    }
  },

  initImportantNotice() {
    const el = document.getElementById('important-notice');
    const btn = document.getElementById('important-notice-close');
    if (!el) return;
    el.hidden = false;
    btn?.addEventListener('click', () => {
      el.hidden = true;
    });
    const reshow = () => {
      // Only bring the notice back when entering a match, not when moving
      // between guide sections.
      if (this.isWatchHash()) {
        el.hidden = false;
      }
    };
    window.addEventListener('hashchange', reshow);
    window.addEventListener('popstate', reshow);
  },

  isWatchHash(hash) {
    return (hash || window.location.hash || '').startsWith('#/match/');
  },

  /**
   * The stream site's homepage is a guide. Only match routes belong here;
   * other routes are redirected back to the main schedule site.
   */
  goBack() {
    window.location.href = SiteConfig.mainSite + '/';
  },

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // Escape only returns to the main site from a watch page.
      if (!this.isWatchHash()) return;
      const hash = window.location.hash;
      if (hash && hash !== '#/' && hash !== '#') {
        this.goBack();
      }
    });
  },

  /**
   * Persistent chrome that exists in both modes: the mobile menu.
   */
  setupChrome() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');
    if (!mobileMenuBtn || !mobileNav) return;

    mobileMenuBtn.addEventListener('click', () => {
      mobileMenuBtn.classList.toggle('open');
      mobileNav.classList.toggle('open');
    });

    // Event delegation so both static guide links and dynamically generated
    // league links close the menu.
    mobileNav.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        mobileMenuBtn.classList.remove('open');
        mobileNav.classList.remove('open');
      }
    });
  },

  /**
   * Watch-mode navigation (hidden on the guide homepage).
   */
  async setupNavigation() {
    const sportsToggle = document.getElementById('sports-toggle');
    const sportsDropdown = document.getElementById('sports-dropdown');
    const sportsMenu = document.getElementById('sports-menu');
    const mobileSportsList = document.getElementById('mobile-sports-list');

    if (sportsToggle && sportsDropdown && sportsMenu) {
      sportsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sportsDropdown.classList.toggle('open');
      });

      document.addEventListener('click', () => {
        sportsDropdown.classList.remove('open');
      });

      sportsMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    this.populateLeagueNavLinks();
    if (sportsMenu) this.populateLeaguesMenu(sportsMenu);
    if (mobileSportsList) this.populateMobileLeaguesList(mobileSportsList);
  },

  populateLeagueNavLinks() {
    const container = document.getElementById('league-nav-links');
    if (!container) return;
    container.innerHTML = '';

    for (const item of this.TOP_NAV_ITEMS) {
      const link = Utils.el('a', {
        className: 'league-nav-link',
        href: SiteConfig.mainHash(item.path)
      });
      link.textContent = item.label;
      container.appendChild(link);
    }
  },

  populateLeaguesMenu(container) {
    container.innerHTML = '';

    for (const cat of this.SPORT_CATEGORIES) {
      const link = Utils.el('a', {
        className: 'dropdown-item',
        href: SiteConfig.mainHash(`/category/${cat.id}`)
      });
      link.innerHTML = `${Utils.getSportImageHTML(cat.id)} ${cat.name}`;
      container.appendChild(link);
    }
  },

  populateMobileLeaguesList(container) {
    container.innerHTML = '';

    for (const item of this.TOP_NAV_ITEMS) {
      const link = Utils.el('a', {
        className: 'mobile-nav-link-league',
        href: SiteConfig.mainHash(item.path)
      });
      link.textContent = item.label;
      container.appendChild(link);
    }

    const divider = Utils.el('div', { className: 'mobile-nav-divider' });
    container.appendChild(divider);

    for (const cat of this.SPORT_CATEGORIES) {
      const link = Utils.el('a', {
        className: 'mobile-nav-link-league',
        href: SiteConfig.mainHash(`/category/${cat.id}`)
      });
      link.innerHTML = `${Utils.getSportImageHTML(cat.id)} ${cat.name}`;
      container.appendChild(link);
    }
  },

  setMode(mode) {
    const root = document.documentElement;
    root.classList.toggle('mode-guide', mode === 'guide');
    root.classList.toggle('mode-watch', mode === 'watch');

    const guideEl = document.getElementById('guide-main');
    const appEl = document.getElementById('app');

    if (mode === 'guide') {
      if (guideEl) guideEl.hidden = false;
      if (appEl) {
        appEl.hidden = true;
        appEl.innerHTML = '';
      }
    } else {
      if (guideEl) guideEl.hidden = true;
      if (appEl) appEl.hidden = false;
    }

    document.title = mode === 'watch'
      ? 'Watch live — GKStreams'
      : 'GKStreams Guide — Free Sports Streaming, Safety & Copyright';
  },

  /**
   * Returns '' for the guide homepage, a section id for a guide section,
   * or null when the hash is not a guide route.
   */
  getGuideSection(hash) {
    if (!hash || hash === '#' || hash === '#/' || hash === '#/guide' || hash === '#/guide/') {
      return '';
    }

    if (hash.startsWith('#/guide/')) {
      const section = hash.slice('#/guide/'.length);
      return this.GUIDE_SECTIONS.includes(section) ? section : '';
    }

    return null;
  },

  showGuide(section) {
    if (section) {
      const target = document.getElementById(section);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return;
      }
    }
    window.scrollTo(0, 0);
  },

  /**
   * Guard against browsers firing both hashchange and popstate for the
   * same navigation.
   */
  shouldHandleRoute(hash) {
    const now = Date.now();
    if (this._lastHandledRoute === hash && now - this._lastHandledAt < 150) {
      return false;
    }
    this._lastHandledRoute = hash;
    this._lastHandledAt = now;
    return true;
  },

  async handleRoute() {
    const hash = window.location.hash || '#/';
    if (!this.shouldHandleRoute(hash)) return;

    if (hash.startsWith('#/match/')) {
      this.setMode('watch');
      this.updateActiveNav(hash);
      window.scrollTo(0, 0);

      let matchId = '';
      try {
        matchId = decodeURIComponent(hash.replace('#/match/', '')).trim();
      } catch (e) {
        matchId = '';
      }

      if (!matchId) {
        window.location.replace(SiteConfig.mainSite + '/');
        return;
      }

      this.currentPage = `match-${matchId}`;
      this.currentRoute = hash;

      await Leagues.load();

      // Bail out if the visitor navigated away while leagues were loading.
      if ((window.location.hash || '#/') !== hash) return;

      Match.render(document.getElementById('app'), matchId);
      return;
    }

    const guideSection = this.getGuideSection(hash);
    if (guideSection !== null) {
      this.setMode('guide');
      this.currentPage = 'guide';
      this.currentRoute = hash;
      this.showGuide(guideSection);
      this.updateActiveNav(hash);
      return;
    }

    // This repository only serves the guide and watch pages. Everything else
    // belongs to the main schedule site.
    window.location.replace(SiteConfig.mainSite + '/' + hash);
  },

  updateActiveNav(hash) {
    document.querySelectorAll('.guide-nav-link').forEach(link => {
      const target = link.getAttribute('href');
      const isActive = target === hash;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    document.querySelectorAll('.league-nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === hash);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
