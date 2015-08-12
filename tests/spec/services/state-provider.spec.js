'use strict';

xdescribe('$stateProvider', function() {
  var _fakeApp;
  var process = require('../../../src/utils/process');

  beforeEach(function() {
    _fakeApp = angular.module('fakeApp', function() {
      console.log('module');
    });
  });

  beforeEach(function() {
    angular.mock.module('angular-state-router', 'fakeApp');
  });

  describe('#state', function() {
    it('Should instantiate provider with state method', function() {
      // Config phase
      _fakeApp
        .config(function($stateProvider) {

          expect($stateProvider.state).not.toBeUndefined();
        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function () {});
    });
  });

  describe('#options', function() {
    it('Should instantiate provider with options method', function() {
      // Config phase
      _fakeApp
        .config(function($stateProvider) {
          expect($stateProvider.options).not.toBeUndefined();
        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function () {});
    });

    it('Should remove history beyond defined length', function(done) {
      // Config phase
      _fakeApp
        .config(function($stateProvider) {

          console.log('config');
      

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

        console.log('inject');
      
        // Instance
        $state
        
          .change('vets.listing')
          .change('vets.policy')
          .change('owners.listing')
          .change('owners')
          .change('owners.animals')

          .on('change:complete', function() {
            console.log('change:complete');

            expect($state.current().name).toBe('owners.animals');

            expect($state.history().length).toBe(2);
            done();
          });

        process.nextTick(function() {
          $rootScope.$apply();
        });
      });
    });
  });

  describe('#init', function() {

    it('Should pass-through EventEmitter methods', function() {
      // Config phase
      _fakeApp
        .config(function($stateProvider) {

          expect($stateProvider.addListener).toBeDefined();
          expect($stateProvider.on).toBeDefined();
          expect($stateProvider.once).toBeDefined();
          expect($stateProvider.removeListener).toBeDefined();
          expect($stateProvider.removeAllListeners).toBeDefined();
          expect($stateProvider.emit).toBeDefined();
        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function () {});
    });

    it('Should emit "init" event after initialization', function(done) {
      // Config phase
      _fakeApp
        .config(function($stateProvider) {
          $stateProvider
            .on('init', done);
        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function () {});
    });

    it('Should init with $location.url()', function(done) {
      // Mock $location
      angular.mock.module(function($provide) {
        $provide.provider('$location', function() {
          this.register = jasmine.createSpy('register');
          this.$get = function() {
            return {
              url: function() {
                return ;
              }
            };
          };
        });
      });

      // Config phase
      _fakeApp.config(function($stateProvider) {

        // Testing scope
        var _testScope = {
          onInit: function() {
            // Parameters exist
            expect($stateProvider.current().params.company).toBe('xyco');
            expect($stateProvider.current().params.employee).toBe('charliewells');
            expect($stateProvider.current().params.trend).toBe('upwards');

            done();
          }
        };

        $stateProvider

          // Define states
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
          .init('stores', {store: 'cornerstore'})

          .on('init', _testScope.onInit);
      });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function($rootScope) {
        process.nextTick(function() {
          $rootScope.$apply();
        });
      });
    });

    it('Should fallback init to default initial location', function(done) {
      var companyState;

      // Mock $location
      angular.mock.module(function($provide) {
        $provide.provider('$location', function() {
          var _url = '';

          this.register = jasmine.createSpy('register');
          this.$get = function() {
            return {
              url: function(url) {
                if(url) {
                  _url = url;
                  return this;
                }
                return _url;
              }
            };
          };
        });
      });

      // Config phase
      _fakeApp
        .config(function($stateProvider) {
          $stateProvider

            // Define states
            .state('company', companyState = {
              url: '/company/profile/:company'
            })

            // Initialize
            .init('company', { company: 'abcco'});

        })
        .run(function($state, $location) {
          
          // Testing scope
          var _testScope = {
            onInit: function() {
              expect($location.url()).toBe('/company/profile/abcco');
              expect(_testScope.onInit).toHaveBeenCalled();

              done();
            }
          };

          spyOn(_testScope, 'onInit').and.callThrough();

          $state

            .on('init', _testScope.onInit);

        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function() { });
    });

  });

});
