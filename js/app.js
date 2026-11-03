const App = {
  currentPage: null,

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
    await Leagues.load();
    this.setupNavigation();
    this.setupKeyboardNav();
    this.handleRoute();

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
      el.hidden = false;
    };
    window.addEventListener('hashchange', reshow);
    window.addEventListener('popstate', reshow);
  },

  /**
   * The stream site has no homepage, so Back always returns to the main site.
   */
  goBack() {
    window.location.href = SiteConfig.mainSite + '/';
  },

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const hash = window.location.hash;
        if (hash && hash !== '#/' && hash !== '#') {
          this.goBack();
        }
      }
    });
  },

  async setupNavigation() {
    const sportsToggle = document.getElementById('sports-toggle');
    const sportsDropdown = document.getElementById('sports-dropdown');
    const sportsMenu = document.getElementById('sports-menu');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');
    const mobileSportsList = document.getElementById('mobile-sports-list');

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

    mobileMenuBtn.addEventListener('click', () => {
      mobileMenuBtn.classList.toggle('open');
      mobileNav.classList.toggle('open');
    });

    this.populateLeagueNavLinks();
    this.populateLeaguesMenu(sportsMenu);
    this.populateMobileLeaguesList(mobileSportsList);
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
      link.addEventListener('click', () => {
        document.getElementById('sports-dropdown').classList.remove('open');
      });
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
      link.addEventListener('click', () => {
        document.getElementById('mobile-menu-btn').classList.remove('open');
        document.getElementById('mobile-nav').classList.remove('open');
      });
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
      link.addEventListener('click', () => {
        document.getElementById('mobile-menu-btn').classList.remove('open');
        document.getElementById('mobile-nav').classList.remove('open');
      });
      container.appendChild(link);
    }
  },

  handleRoute() {
    const hash = window.location.hash || '#/';
    const app = document.getElementById('app');

    window.scrollTo(0, 0);
    this.updateActiveNav(hash);

    if (hash.startsWith('#/match/')) {
      const matchId = decodeURIComponent(hash.replace('#/match/', ''));
      this.currentPage = `match-${matchId}`;
      Match.render(app, matchId);
    } else {
      // This repository only serves the watch page. Everything else belongs to
      // the main site.
      window.location.replace(SiteConfig.mainSite + '/' + hash);
    }
  },

  updateActiveNav(hash) {
    document.querySelectorAll('.league-nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === hash);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
