'use strict';

describe('$urlManager', function() {
  var _fakeApp;
  var _stateRouterHelper = require('../../helpers/state-router.helper');

  beforeEach(function() {
    _fakeApp = angular.module('fakeApp', function() {});

    // Load helpers
    _stateRouterHelper.factory(_fakeApp).reset();
  });

  beforeEach(angular.mock.module('angular-state-router', 'fakeApp'));

  describe('#update', function() {

    it('Should update incorrect URL location according to state', function() {

      _stateRouterHelper.$service.current = function() {
        return {
          name: 'accounting.employees',
          url: '/accounting/employees/:employee',
          params: {
            employee: '283202aef00'
          }
        };
      };

      angular.mock.inject(function($urlManager, $location) {
        expect($location.url()).toBe('');

        $urlManager.update();

        expect($location.url()).toBe('/accounting/employees/283202aef00');
      });
    });

  });

  describe('#location', function() {

    it('Should set state according to URL location', function(done) {
      angular.mock.inject(function($urlManager, $location) {
        expect($location.url('/accounting/employees/283202aef00'));

        $urlManager.on('update:location', done);
        $urlManager.location();
      });
    });

  });
});
