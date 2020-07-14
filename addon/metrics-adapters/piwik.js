import { assert } from '@ember/debug';
import { get } from '@ember/object';
import removeFromDOM from '../utils/remove-from-dom';
import BaseAdapter from './base';

export default BaseAdapter.extend({
  toStringExtension() {
    return 'Piwik';
  },

  init() {
    const config = get(this, 'config');
    const { piwikUrl, siteId } = config;

    assert(`[ember-metrics] You must pass a \`piwikUrl\` and a \`siteId\` to the ${this.toString()} adapter`, piwikUrl && siteId);

    window._paq = window._paq || [];
    (function() {
      window._paq.push(['setTrackerUrl', `${piwikUrl}/piwik.php`]);
      window._paq.push(['setSiteId', siteId]);
      var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      g.type='text/javascript'; g.async=true; g.defer=true; g.src=`${piwikUrl}/piwik.js`; s.parentNode.insertBefore(g,s);
    })();
  },

  identify(options = {}) {
    window._paq.push(['setUserId', options.userId]);
  },

  trackEvent(options = {}) {
    window._paq.push(['trackEvent', options.category, options.action, options.name, options.value]);
  },

  trackPage(options = {}) {
    window._paq.push(['setCustomUrl', options.page]);
    window._paq.push(['trackPageView', options.title]);
  },

  willDestroy() {
    removeFromDOM('script[src*="piwik"]');

    delete window._paq;
  }
});
