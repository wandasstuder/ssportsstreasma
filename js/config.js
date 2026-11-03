/**
 * Cross-site configuration.
 * The stream site is a standalone watch page; its navigation links back to the main site.
 */
const SiteConfig = {
  mainSite: 'https://gkstreams.shop',
  streamSite: 'https://wandasstuder.github.io/ssportsstreasma/',
  isStreamSite: true,

  /**
   * Build a link to a page on the main site.
   * On the stream site this is always an absolute main-site URL.
   */
  mainHash(path) {
    const hash = '#' + path;
    return this.isStreamSite ? this.mainSite + '/' + hash : hash;
  },

  /**
   * Build a link to the watch page.
   * On the stream site this stays local.
   */
  matchUrl(matchId) {
    const hash = '#/match/' + encodeURIComponent(matchId);
    return this.isStreamSite ? hash : this.streamSite + hash;
  }
};
