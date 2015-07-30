'use strict';

module.exports = function(app) {

  app
    .provider('$state', function StateRouterProvider() {
      // EventEmitter
      this.addListener = function() {};
      this.on = function() {};
      this.once = function() {};
      this.removeListener = function() {};
      this.removeAllListeners = function() {};
      this.listeners = function() {};
      this.emit = function() {};

      // Provider
      this.option = function() { };
      this.state = function() { };
      this.init = function() { };

      // Instance
      this.$get = function() {
        return {
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
      };
    });

};
