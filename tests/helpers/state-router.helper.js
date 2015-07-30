'use strict';

var _template = {

  provider: {
    // EventEmitter
    addListener: function() { },
    on: function() { },
    once: function() { },
    removeListener: function() { },
    removeAllListeners: function() { },
    listeners: function() { },
    emit: function() { },

    // Provider
    option: function() { },
    state: function() { },
    init: function() { },
  },

  service: {
    options: function() { },
    state: function() { },
    $use: function() { },
    $ready: function() { },

    parse: function() { },
    library: function() { },
    history: function() { },
    change: function() { },
    $location: function() { },

    current: function() { },
    active: function() { }
  }
};

var _provider;
var _service;
var _reset = function() {
  var entity = angular.copy(_template);

  _provider = entity.provider;
  _service = entity.service;

  module.exports.$provider = _provider;
  module.exports.$service = _service;
};

module.exports = {

  factory: function(app) {
    if(!_provider || !_service) _reset();

    app
      .provider('$state', function StateRouterProvider() {

        var _self = this;

        Object.keys(_provider).forEach(function(method) {
          // Delegate method
          if(typeof _provider[method] === 'function') {
            _self[method] = function() {
              return _provider[method].apply(_provider, arguments);
            };

          // Set property
          } else {
            _self[method] = _provider[method];
          }
        });

        // Instance
        this.$get = function() {
          return _service;
        };
      });

    return this;
  },

  reset: function() {
    _reset();
    return this;
  }

};
