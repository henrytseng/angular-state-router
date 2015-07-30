'use strict';

describe('$urlManager', function() {
  var _fakeApp;

  beforeEach(function() {
    _fakeApp = angular.module('fakeApp', function() {});

    // Load helpers
    require('../../helpers/state-router.helper')(_fakeApp);
  });

  beforeEach(angular.mock.module('angular-state-router', 'fakeApp'));

  describe('#update', function() {

    it('Should update URL location according to state', function() {
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
