'use strict';

describe('$stateProvider', function() {
  var _fakeApp;

  beforeEach(function() {
    _fakeApp = angular.module('fakeApp', function() {});
  });

  beforeEach(angular.mock.module('angular-state-router', 'fakeApp'));

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
      var itrResponse;

      // Config phase
      _fakeApp
        .config(function($stateProvider) {

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

        })

        .run(function($state) {

          // Instance
          $state
          
            .change('vets.listing')
            .change('vets.policy')
            .change('owners.listing')
            .change('owners')
            .change('owners.animals')

            .on('change:complete', function() {
              itrResponse.shift().apply(null, arguments);
            });

          // Iterated responses
          itrResponse = [
            function() {
              expect($state.current().name).toBe('animals.listing');
              expect($state.history().length).toBe(0);
            },
            function() {
              expect($state.current().name).toBe('vets.listing');
              expect($state.history().length).toBe(1);
            },
            function() {
              expect($state.current().name).toBe('vets.policy');
              expect($state.history().length).toBe(2);
            },
            function() {
              expect($state.current().name).toBe('owners.listing');
              expect($state.history().length).toBe(2);
            },
            function() {
              expect($state.current().name).toBe('owners');
              expect($state.history().length).toBe(2);

              // Last two are saved
              expect($state.history()[0].name).toBe('vets.policy');
              expect($state.history()[1].name).toBe('owners.listing');

            },
            function() {
              expect($state.current().name).toBe('owners.animals');
              done();
            }
          ];
        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function () {});
    });
  });

  describe('#init', function() {

    it('Should instantiate provider with init method', function() {
      // Config phase
      _fakeApp
        .config(function($stateProvider) {

          expect($stateProvider.init).not.toBeUndefined();
        });

      // Kickstart the injectors previously registered 
      angular.mock.inject(function () {});
    });

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
      var companyState;

      // Mock $location
      angular.mock.module(function($provide) {
        $provide.provider('$location', function() {
          this.register = jasmine.createSpy('register');
          this.$get = function() {
            return {
              url: function() {
                return '/company/profile/xyco/employees/charliewells/proxy';
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

        })
        .run(function($state) {
          
          // Testing scope
          var _testScope = {
            onInit: function() {
              // URL to be correct according to state
              expect(_testScope.onInit).toHaveBeenCalled();

              // Parameters exist
              expect($state.current().params.company).toBe('xyco');
              expect($state.current().params.employee).toBe('charliewells');
              expect($state.current().params.trend).toBe('upwards');

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
