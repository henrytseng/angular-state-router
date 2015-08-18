'use strict';

describe('$urlManager', function() {

  beforeEach(angular.mock.module('angular-state-router'));

  describe('#update', function() {

    it('Should update incorrect URL location according to state', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          .state('accounting.employees', {
            url: '/accounting/employees/:employee',
            params: {
              employee: '283202aef00'
            }
          })

          .init('accounting.employees');
      });

      angular.mock.inject(function ($rootScope, $state, $location) {
        $rootScope.$digest();

        expect($location.url()).toBe('/accounting/employees/283202aef00');

        done();
      });
    });
  });

  describe('#location', function() {

    it('Should set state according to URL location', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          .state('accounting.employees', {
            url: '/accounting/employees/:employee',
            params: {
              employee: 'w94380043'
            }
          })

          .state('accounting.candidates', {
            url: '/accounting/candidates/:employee'
          })

          .init('accounting.employees');
      });

      angular.mock.inject(function ($rootScope, $state, $location) {

        expect($location.url('/accounting/employees/w94380043'));
        $state.change('accounting.candidates');

        $rootScope.$on('$locationStateUpdate', done);

        $rootScope.$digest();
        done();
      });
    });

  });
});
