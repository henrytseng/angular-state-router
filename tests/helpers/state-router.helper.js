'use strict';



// TODO add reset




var _provider = {

  // EventEmitter
  addListener: function() {},
  on: function() {},
  once: function() {},
  removeListener: function() {},
  removeAllListeners: function() {},
  listeners: function() {},
  emit: function() {},

  // Provider
  option: function() { },
  state: function() { },
  init: function() { },

};
var _service = {
  options: function() { },
  state: function() { },
  $use: function() { },
  $ready: function() { },

  parse: function() { },
  library: function() { },
  history: function() { },
  change: function() { },
  $location: function() { },

  current: function() {
    return {
      name: 'accounting.employees',
      url: '/accounting/employees/:employee',
      params: {
        employee: '283202aef00'
      }
    };
  },
  active: function() { }
};

module.exports = function(app) {

  app
    .provider('$state', function StateRouterProvider() {

      var _self = this;

      // Delegate method
      Object.keys(_provider).forEach(function(method) {
        _self[method] = function() {
          return _provider[method].apply(_provider, arguments);
        };
      });

      // Instance
      this.$get = function() {
        return _service;
      };
    });

};

module.exports.$provider = _provider;

module.exports.$service = _service;
