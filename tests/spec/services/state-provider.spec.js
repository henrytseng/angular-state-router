'use strict';

describe('$stateProvider', function() {

  beforeEach(angular.mock.module('angular-state-router'));

  describe('#state', function() {
    it('Should instantiate provider with state method', function() {
      angular.mock.module(function($stateProvider) {
        expect($stateProvider.state).not.toBeUndefined();
      });
    }); 

    it('Should define state without error', function() {
      angular.mock.module(function($stateProvider) {
        $stateProvider.state('locations.vendors', {
          url: '/locations/:vendor/:type',
          params: {
            vendor: 'Pizza Place',
            type: 'restaurant'
          }
        });
      });
    });
  });

  describe('#options', function() {
    it('Should instantiate provider with options method', function() {
      angular.mock.module(function($stateProvider) {
        expect($stateProvider.options).not.toBeUndefined();
      });
    });

    it('Should remove history beyond defined length', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          .options({
            historyLength: 2
          })

          .state('animals.listing', {
            url: '/animals'
          })

          .state('animals', {
            url: '/animals/:id'
          })

          .state('vets.listing', {
            url: '/vets'
          })

          .state('vets', {
            url: '/vets/:id'
          })

          .state('vets.policy', {
            url: '/vets/:id/policy/:id'
          })

          .state('owners.listing', {
            url: '/owners/:id'
          })

          .state('owners', {
            url: '/owners/:id'
          })

          .state('owners.animals.listing', {
            url: '/owners/:id/animals'
          })

          .state('owners.animals', {
            url: '/owners/:id/animals/:id'
          })

          .init('animals.listing');
      });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function ($rootScope, $state) {
        expect($state.options().historyLength).toBe(2);
        expect($state.current().name).toBe('animals.listing');

        $state.change('owners');
        $rootScope.$digest();
        expect($state.current().name).toBe('owners');
        expect($state.history().length).toBe(1);

        $state.change('vets.listing');
        $rootScope.$digest();
        expect($state.current().name).toBe('vets.listing');

        $state.change('vets.policy');
        $rootScope.$digest();
        expect($state.current().name).toBe('vets.policy');
        expect($state.history().length).toBe(2);

        done();
      });
    });
  });

  describe('#init', function() {

    it('Should emit "$stateInit" event after initialization', function(done) {
      var onInit = jasmine.createSpy('onInit');
      angular.mock.module(function($stateProvider) {
        $stateProvider
          .state('concert.tickets', {
            url: '/bigshow'
          })
          .init('concert.tickets');
      });

      angular.mock.inject(function ($rootScope) {
        $rootScope.$on('$stateInit', onInit);

        $rootScope.$digest();

        expect(onInit).toHaveBeenCalled();

        done();
      });
    });

    it('Should initialize and change to $location.url() when a location exists', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider
          .state('company', {
            url: '/company/profile/:company/employees/:employee/proxy',
            params: {
              trend: 'upwards'
            }
          })
          .state('stores', {
            url: '/stores/:store'
          })

          // Initialize, with default but uses location instead
          .init('stores', {store: 'cornerstore'});
      });

      angular.mock.inject(function ($rootScope, $location, $state) {
        var onInit = jasmine.createSpy('onInit');

        $location.url('/company/profile/xyco/employees/charliewells/proxy');
        $rootScope.$on('$stateInit', onInit);

        $rootScope.$digest();

        expect(onInit).toHaveBeenCalled();

        expect($state.current().params.company).toBe('xyco');
        expect($state.current().params.employee).toBe('charliewells');
        expect($state.current().params.trend).toBe('upwards');

        done();
      });
    });

    it('Should initialize to default location when a location does not exist', function(done) {
      var onInit = jasmine.createSpy('onInit');
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('company', {
            url: '/company/profile/:company',
            params: {
              lorem: 'ipsum'
            }
          })

          // Initialize
          .init('company', { company: 'abcco'});
      });

      angular.mock.inject(function ($rootScope, $location, $state) {
        $rootScope.$on('$stateInit', onInit);

        $rootScope.$digest();

        expect(onInit).toHaveBeenCalled();

        expect($location.url()).toBe('/company/profile/abcco?lorem=ipsum');
        expect($state.current().params.company).toBe('abcco');
        expect($state.current().params.lorem).toBe('ipsum');

        done();
      });
    });
  });

});
