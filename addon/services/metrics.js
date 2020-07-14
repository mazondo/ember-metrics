import { assign } from '@ember/polyfills';
import Service from '@ember/service';
import { assert } from '@ember/debug';
import { set, get, getWithDefault } from '@ember/object';
import { A as emberArray, makeArray } from '@ember/array';
import { dasherize } from '@ember/string';
import { getOwner } from '@ember/application';
const { keys } = Object;

export default Service.extend({
  /**
   * Cached adapters to reduce multiple expensive lookups.
   *
   * @property _adapters
   * @private
   * @type Object
   * @default null
   */
  _adapters: null,

  /**
   * Contextual information attached to each call to an adapter. Often you'll
   * want to include things like `currentUser.name` with every event or page
   * view  that's tracked. Any properties that you bind to `metrics.context`
   * will be merged into the options for every service call.
   *
   * @property context
   * @type Object
   * @default null
   */
  context: null,

  /**
   * Indicates whether calls to the service will be forwarded to the adapters
   *
   * @property enabled
   * @type Boolean
   * @default true
   */
  enabled: true,

  /**
   * When the Service is created, activate adapters that were specified in the
   * configuration. This config is injected into the Service as
   * `options`.
   *
   * @method init
   * @param {Void}
   * @return {Void}
   */
  init() {
    const adapters = getWithDefault(this, 'options.metricsAdapters', emberArray());
    const owner = getOwner(this);
    owner.registerOptionsForType('ember-metrics@metrics-adapter', { instantiate: false });
    owner.registerOptionsForType('metrics-adapter', { instantiate: false });
    set(this, 'appEnvironment', getWithDefault(this, 'options.environment', 'development'));
    set(this, '_adapters', {});
    set(this, 'context', {});
    this.activateAdapters(adapters);
    this._super(...arguments);
  },

  identify(...args) {
    this.invoke('identify', ...args);
  },

  alias(...args) {
    this.invoke('alias', ...args);
  },

  trackEvent(...args) {
    this.invoke('trackEvent', ...args);
  },

  trackPage(...args) {
    this.invoke('trackPage', ...args);
  },

  /**
   * Instantiates the adapters specified in the configuration and caches them
   * for future retrieval.
   *
   * @method activateAdapters
   * @param {Array} adapterOptions
   * @return {Object} instantiated adapters
   */
  activateAdapters(adapterOptions = []) {
    const appEnvironment = get(this, 'appEnvironment');
    const cachedAdapters = get(this, '_adapters');
    const activatedAdapters = {};

    adapterOptions
      .filter((adapterOption) => this._filterEnvironments(adapterOption, appEnvironment))
      .forEach((adapterOption) => {
        const { name, config } = adapterOption;
        const adapterClass = this._lookupAdapter(name);

        if (typeof FastBoot === 'undefined' || get(adapterClass, 'supportsFastBoot')) {
          const adapter = cachedAdapters[name] || this._activateAdapter({ adapterClass, config });
          set(activatedAdapters, name, adapter);
        }
      });

    return set(this, '_adapters', activatedAdapters);
  },

  /**
   * Invokes a method on the passed adapter, or across all activated adapters if not passed.
   *
   * @method invoke
   * @param {String} methodName
   * @param {Rest} args
   * @return {Void}
   */
  invoke(methodName, ...args) {
    if (!get(this, 'enabled')) { return; }

    const cachedAdapters = get(this, '_adapters');
    const allAdapterNames = keys(cachedAdapters);
    const [selectedAdapterNames, options] = args.length > 1 ? [makeArray(args[0]), args[1]] : [allAdapterNames, args[0]];
    const context = assign({}, get(this, 'context'));
    const mergedOptions = assign(context, options);

    selectedAdapterNames
      .map((adapterName) => get(cachedAdapters, adapterName))
      .forEach((adapter) => adapter && adapter[methodName](mergedOptions));
  },

  /**
   * On teardown, destroy cached adapters together with the Service.
   *
   * @method willDestroy
   * @param {Void}
   * @return {Void}
   */
  willDestroy() {
    const cachedAdapters = get(this, '_adapters');

    for (let adapterName in cachedAdapters) {
      get(cachedAdapters, adapterName).destroy();
    }
  },

  /**
   * Instantiates an adapter.
   *
   * @method _activateAdapter
   * @param {Object}
   * @private
   * @return {Adapter}
   */
  _activateAdapter({ adapterClass, config }) {
    return adapterClass.create(getOwner(this).ownerInjection(), { this: this, config });
  },

  /**
   * Looks up the adapter from the container. Prioritizes the consuming app's
   * adapters over the addon's adapters.
   *
   * @method _lookupAdapter
   * @param {String} adapterName
   * @private
   * @return {Adapter} a local adapter or an adapter from the addon
   */
  _lookupAdapter(adapterName) {
    assert('[ember-metrics] Could not find metrics adapter without a name.', adapterName);

    const dasherizedAdapterName = dasherize(adapterName);
    const availableAdapter = getOwner(this).lookup(`ember-metrics@metrics-adapter:${dasherizedAdapterName}`);
    const localAdapter = getOwner(this).lookup(`metrics-adapter:${dasherizedAdapterName}`);

    const adapter = localAdapter || availableAdapter;
    assert(`[ember-metrics] Could not find metrics adapter ${adapterName}.`, adapter);

    return adapter;
  },

  /**
   * Predicate that Filters out adapters that should not be activated in the
   * current application environment. Defaults to all environments if the option
   * is `all` or undefined.
   *
   * @method _filterEnvironments
   * @param {Object} adapterOption
   * @param {String} appEnvironment
   * @private
   * @return {Boolean} should an adapter be activated
   */
  _filterEnvironments(adapterOption, appEnvironment) {
    let { environments } = adapterOption;
    environments = environments || ['all'];
    const wrappedEnvironments = emberArray(environments);

    return wrappedEnvironments.indexOf('all') > -1 || wrappedEnvironments.indexOf(appEnvironment) > -1;
  }
});
