'use strict';

describe('$state', function() {
  
  beforeEach(angular.mock.module('angular-state-router'));
  
  describe('#state', function() {
    it('Should allow definition of states continually without error', function() {
      var myState;

      angular.mock.module(function($stateProvider) {
        $stateProvider

          // A state
          .state('dashboard', {
            url: '/dashboard'
          });

        myState = $stateProvider.state('dashboard');
      });

      angular.mock.inject(function($state) {
        $state

          // With parameters
          .state('profile', {
            url: '/profile?p&j&sd',
            params: {
              p: 0,
              j: 'lorem'
            }
          })

          // Detail view with required id
          .state('product', {
            url: '/product/:id'
          })

          // Index listing and detail view (optional "id")
          .state('catalog', {
            url: '/catelog/[:id]'
          })

          // Sub-state without parent state
          .state('terms.legal', {
            url: '/legal'
          });

        // Previously defined states exist
        expect($state.state('dashboard')).toEqual({
          name: 'dashboard',
          url: '/dashboard',
          inherit: true
        });

        // Cached was reset
        expect($state.state('dashboard')).not.toBe(myState);
      });
    });
    
    xit('Should return defined state heirarchy and not inherit templates from parent chain', function() {

    });
    
    xit('Should return defined state heirarchy and not inherit resolve promises from parent chain', function() {

    });
    
    it('Should return defined state heirarchy parameters inherit from parent chain', function() {
      angular.mock.inject(function($state) {
        $state

          // Parent state
          .state('organism', {
            url: '/organisms',
            params: {
              organic: true
            }
          })

          // Parent state
          .state('organism.plant', {
            url: '/plants',
            params: {
              chlorophyll: 'green'
            }
          })

          // Parent state
          .state('organism.plant.tree', {
            url: '/trees',
            params: {
              bark: 1
            }
          })

          // Child state
          .state('organism.plant.tree.apple', {
            url: '/trees/apples',
            params: {
              fruit: ['apple']
            }
          })

          // Child's child state
          .state('organism.plant.tree.apple.fuji', {
            params: {
              location: 'Japan'
            }
          })

          // Alienated state
          .state('organism.plant.tree.hybrid', {
            url: '/trees/hybrid',
            params: {
              organic: true
            },
            inherit: false
          });

        var organism = $state.state('organism');
        expect(organism).toBeTruthy();

        var plant = $state.state('organism.plant');
        expect(plant).toBeTruthy();

        var tree = $state.state('organism.plant.tree');
        expect(tree).toBeTruthy();

        var apple = $state.state('organism.plant.tree.apple');
        expect(apple).toBeTruthy();

        var fuji = $state.state('organism.plant.tree.apple.fuji');
        expect(fuji).toBeTruthy();

        var hybrid = $state.state('organism.plant.tree.hybrid');
        expect(hybrid).toBeTruthy();

        // Nonexisting with parents
        var nonexisting = $state.state('organism.plant.tree.nonexisting');
        expect(nonexisting).toBeTruthy();

        // Non-existing without parents
        var invalid = $state.state('does.not.exist.invalid');
        expect(invalid).toBe(null);

        // Inherit by default
        expect(organism.url).toBe('/organisms');
        expect(plant.url).toBe('/plants');
        expect(tree.url).toBe('/trees');
        expect(apple.url).toBe('/trees/apples');
        expect(fuji.url).toBe('/trees/apples');

        // Inherit properties by default
        expect(fuji.params.location).toBe('Japan');
        expect(fuji.params.chlorophyll).toBe('green');
        expect(fuji.params.bark).toBe(1);

        // Do not inherit
        expect(hybrid.url).toBe('/trees/hybrid');
        expect(hybrid.params).toEqual({
          organic: true
        });

      });
    });

    it('Should use cache until next update', function() {
      angular.mock.inject(function($state) {
        $state
          .state('organism.plant.tree', {
            url: '/trees',
            params: {
              bark: 1
            }
          });

        var tree1 = $state.state('organism.plant.tree');
        expect(tree1).toBeTruthy();
        expect(tree1).toBe($state.state('organism.plant.tree'));

        $state
          .state('organism.plant.tree', {
            url: '/trees',
            params: {
              bark: 1,
              replacement: true
            }
          });

        var tree2 = $state.state('organism.plant.tree');
        expect(tree2).not.toBe(tree1);
      });
    });
  });

  describe('#change', function() {
    
    it('Should change state with set parameters', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope) {
        $rootScope.$digest();

        expect($state.current()).toBeNull();

        $state.change('companies', {
          lorem: 'ipsum'
        });

        $rootScope.$digest();

        expect($state.current().params).toEqual({
          company: 'XYZ Co',
          lorem: 'ipsum'
        });

        done();
      });
    });

    it('Should dispatch events during state change', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });

      });

      angular.mock.inject(function($state, $rootScope) {
        $rootScope.$digest();

        // Spies
        var onBegin = jasmine.createSpy('onBegin');
        var onEnd = jasmine.createSpy('onEnd');
        var onError = jasmine.createSpy('onError');
        var onComplete = jasmine.createSpy('onComplete');

        $rootScope.$on('$stateChangeBegin', onBegin);
        $rootScope.$on('$stateChangeEnd', onEnd);
        $rootScope.$on('$stateChangeError', onError);
        $rootScope.$on('$stateChangeComplete', onComplete);
        
        $state.change('companies');

        $rootScope.$digest();

        expect(onBegin).toHaveBeenCalled();
        expect(onEnd).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();

        expect(onComplete.calls.count()).toEqual(1);

        done();
      });
    });

    it('Should not transition state when next state is the same but should still notify process is complete', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope) {
        $rootScope.$digest();

        var onBegin = jasmine.createSpy('onBegin');
        var onEnd = jasmine.createSpy('onEnd');
        var onComplete = jasmine.createSpy('onComplete');

        $rootScope.$on('$stateChangeBegin', onBegin);
        $rootScope.$on('$stateChangeEnd', onEnd);
        $rootScope.$on('$stateChangeComplete', onComplete);

        $state.change('companies', {
          lorem: 'ipsum'
        });

        $rootScope.$digest();

        $state.change('companies', {
          lorem: 'ipsum'
        });

        $rootScope.$digest();

        expect($state.current().params).toEqual({
          company: 'XYZ Co',
          lorem: 'ipsum'
        });

        expect(onBegin.calls.count()).toEqual(1);
        expect(onEnd.calls.count()).toEqual(1);
        expect(onComplete.calls.count()).toEqual(2);

        done();
      });
    });

    it('Should emit "$stateChangeErrorNotFound" when requested state does not exist', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope) {
        var onBegin = jasmine.createSpy('onBegin');
        var onEnd = jasmine.createSpy('onEnd');
        var onError = jasmine.createSpy('onError');
        var onComplete = jasmine.createSpy('onComplete');

        $rootScope.$on('$stateChangeBegin', onBegin);
        $rootScope.$on('$stateChangeEnd', onEnd);
        $rootScope.$on('$stateChangeErrorNotFound', onError);
        $rootScope.$on('$stateChangeComplete', onComplete);

        $state.change('missingstate');

        $rootScope.$digest();

        expect($state.current()).toBeNull();

        expect(onBegin.calls.count()).toEqual(0);
        expect(onEnd.calls.count()).toEqual(0);
        expect(onError.calls.count()).toEqual(1);
        expect(onComplete.calls.count()).toEqual(1);

        done();
      });
    });

    it('Should await all promises in resolve property and set as locals', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('employees', {
            url: '/employees/:employee', 
            params: {
              employee: '01321471448-3145-1'
            },
            resolve: {
              'slowService': function($timeout, $q) {
                return $q(function(resolve, reject) {
                  $timeout(function() {
                    console.log(1);
                    resolve('someSpecificValue');
                  }, 1000);
                });
              }
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope, $timeout) {
        var onBegin = jasmine.createSpy('onBegin');
        var onEnd = jasmine.createSpy('onEnd');
        var onError = jasmine.createSpy('onError');
        var onComplete = jasmine.createSpy('onComplete');

        $rootScope.$on('$stateChangeBegin', onBegin);
        $rootScope.$on('$stateChangeEnd', onEnd);
        $rootScope.$on('$stateChangeError', onError);
        $rootScope.$on('$stateChangeComplete', onComplete);

        // Initialize
        $rootScope.$digest();

        expect($state.current()).toBe(null);

        // Transition
        $state.change('employees');
        $rootScope.$digest();

        // Resolve everything immediately
        $timeout.flush();
        $rootScope.$digest();
        
        expect($state.current().name).toBe('employees');

        expect(onBegin).toHaveBeenCalled();
        expect(onEnd).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();

        expect($state.current().locals).toEqual({
          slowService: 'someSpecificValue'
        });

        done();
      });
    });

    it('Should broadcast "$stateChangeErrorResolve" if promise is rejected in resolve property', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('employees', {
            url: '/employees/:employee', 
            params: {
              employee: '01321471448-3145-1'
            },
            resolve: {
              'errorService': function($timeout, $q) {
                return $q(function(resolve, reject) {
                  $timeout(function() {
                    reject(new Error('Looks like we have a problem resolving.'));
                  }, 1000);
                });
              }
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope, $timeout) {
        $rootScope.$digest();

        var onBegin = jasmine.createSpy('onBegin');
        var onEnd = jasmine.createSpy('onEnd');
        var onError = jasmine.createSpy('onError');
        var onErrorResolve = jasmine.createSpy('onErrorResolve');
        var onComplete = jasmine.createSpy('onComplete');

        $rootScope.$on('$stateChangeBegin', onBegin);
        $rootScope.$on('$stateChangeEnd', onEnd);
        $rootScope.$on('$stateChangeError', onError);
        $rootScope.$on('$stateChangeErrorResolve', onErrorResolve);
        $rootScope.$on('$stateChangeComplete', onComplete);

        // Initialize
        $rootScope.$digest();

        expect($state.current()).toBe(null);

        // Transition
        $state.change('employees');
        $rootScope.$digest();

        // Resolve everything immediately
        $timeout.flush();
        
        expect($state.current().name).toBe('employees');

        // State transition begins
        expect(onBegin).toHaveBeenCalled();

        // But does not finish
        expect(onEnd).not.toHaveBeenCalled();

        // Error response
        expect(onError).toHaveBeenCalled();
        expect(onErrorResolve).toHaveBeenCalled();

        // Always called
        expect(onComplete).toHaveBeenCalled();

        expect($state.current().locals).toEqual({ });

        done();
      });
    });
  });

  describe('#$use', function() {
    it('Should call middleware during state transition', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope) {
        var _testLayer = {
          onMiddle: function(request, next) {
            next();
          }
        };
        spyOn(_testLayer, 'onMiddle').and.callThrough();

        $state

          .$use(_testLayer.onMiddle)

          .change('companies');

        $rootScope.$digest();

        expect(_testLayer.onMiddle).toHaveBeenCalled();

        done();
      });
    });

    it('Should require middleware to be function', function() {
      angular.mock.inject(function($state) {
        expect(function() {
          
          $state.$use(null);

        }).toThrow(new Error('Middleware must be a function.'));
      });
    });

    it('Should call middleware according to priority properties with higher first', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('companies', {
            url: '/companies/:company', 
            params: {
              company: 'XYZ Co'
            }
          })

          .state('rooms', {
            url: '/buildings/:building/rooms/:room',
            params: {
              building: 'f2',
              room: 'j203'
            }
          });
      });

      angular.mock.inject(function($state, $rootScope) {
        var order = [];
        var _createMiddlewareLayer = function(priority) {
          var _middleware;
          _middleware = {
            handle: function(data, next) {
              order.push(priority);
              next();
            }
          };

          spyOn(_middleware, 'handle').and.callThrough();

          _middleware.handle.priority = priority;

          return _middleware.handle;
        };

        var handler1;
        var handler2;
        var handler3;

        $state.$use(handler1 = _createMiddlewareLayer(400));
        $state.$use(handler2 = _createMiddlewareLayer(500));
        $state.$use(handler3 = _createMiddlewareLayer(10));

        $state.change('rooms');

        $rootScope.$digest();

        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        expect(handler3).toHaveBeenCalled();
        expect(order).toEqual([500, 400, 10]);

        done();
      });
    });
  });

  describe('#current', function() {
    it('Should retrieve copy of current state', function(done) {
      var companyLobbyState;
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define states
          .state('company.lobby', {
            url: '/main',
            params: {
              a: 11
            }
          });

        companyLobbyState = $stateProvider.state('company.lobby');
      });

      angular.mock.inject(function($state, $rootScope) {
        $rootScope.$digest();

        $state.change('company.lobby');

        $rootScope.$digest();

        // Not same instance
        expect($state.current()).not.toBe(companyLobbyState);

        // Same values
        expect($state.current().name).toBe('company.lobby');
        expect($state.current().url).toBe(companyLobbyState.url);
        expect($state.current().params).toEqual(companyLobbyState.params);

        done();
      });
    });
  });

  describe('#active', function() {
    it('Should check for active state using query with state notation', function(done) {
      angular.mock.module(function($stateProvider) {
        $stateProvider

          // Define
          .state('company.lobby', {
            url: '/main/atrium'
          })
          .state('company.lobby.personel', {
            url: '/persons'
          });
      });

      angular.mock.inject(function($state, $rootScope) {
        // Initial condition
        expect($state.active('company.lobby.personel')).toBe(false);

        $state.change('company.lobby.personel');

        $rootScope.$digest();

        expect($state.active('company.lobby.personel')).toBe(true);

        // Parent
        expect($state.active('company.lobby.personel')).toBe(true);
        expect($state.active('company.lobby')).toBe(true);
        expect($state.active('company')).toBe(true);

        // RegExp
        expect($state.active(/.*/)).toBe(true);
        expect($state.active('/.*/')).toBe(true);

        // Wildcards
        expect($state.active('company.*.personel')).toBe(true);
        expect($state.active('company.*.*')).toBe(true);
        expect($state.active('*.lobby')).toBe(true);
        expect($state.active('*.lobby.*')).toBe(true);
        expect($state.active('*.lobby.*.doesnotexist')).toBe(false);
        expect($state.active('*.lobby.doesnotexist.*')).toBe(false);
        expect($state.active('doesnotexist.*.lobby.*')).toBe(false);

        // Double wildcards
        expect($state.active('company.**')).toBe(true);
        expect($state.active('company.lobby.**')).toBe(true);
        expect($state.active('company.**.personel')).toBe(true);
        expect($state.active('company.**.doesnotexist')).toBe(false);
        expect($state.active('doesnotexist.**.lobby.*')).toBe(false);

        // Invalid
        expect($state.active('doesnotexist')).toBeFalsy();

        // Validate
        expect($state.current().name).toBe('company.lobby.personel');

        done();
      });
    });
  });

  describe('#library', function() {
    it('Should get defined states', function() {
      angular.mock.inject(function($state) {
        $state

          .state('students', {
            url: '/students/:id',
            params: {
              homeroom: 'Room 52'
            },
            inherit: false
          })

          .state('teachers', {
            url: '/teachers/:id',
            params: {
              payroll: 'B Stat'
            }
          })

          .state('classrooms', {
            url: '/classrooms/:id'
          });

        expect($state.library()).toEqual({
          'students': {
            name: 'students',
            url: '/students/:id',
            params: {
              homeroom: 'Room 52'
            },
            inherit: false
          },
          'teachers': {
            name: 'teachers',
            url: '/teachers/:id',
            params: {
              payroll: 'B Stat'
            },
            inherit: true
          },
          'classrooms': {
            name: 'classrooms',
            url: '/classrooms/:id',
            inherit: true
          }
        });

      });
    });
  });

  describe('#validate.name', function() {
    it('Should test for valid state names', function() {
      angular.mock.inject(function($state) {
        expect($state.validate.name('lorem.ipsum.dolor.sed.ut')).toBe(true);
        expect($state.validate.name('lorem.ipsum')).toBe(true);
        expect($state.validate.name('lorem')).toBe(true);
        expect($state.validate.name('lorem.0')).toBe(true);
        expect($state.validate.name('Lorem.0')).toBe(true);
        expect($state.validate.name('DOLOR.dolor')).toBe(true);
      });
    });

    it('Should test for invalid state names', function() {
      angular.mock.inject(function($state) {
        expect($state.validate.name('lorem..sed.ut')).toBe(false);
        expect($state.validate.name('lorem.*.dolor.sed.ut')).toBe(false);
        expect($state.validate.name('lorem.**.dolor.sed.ut')).toBe(false);
        expect($state.validate.name('.lorem.dolor.ut')).toBe(false);
        expect($state.validate.name('lorem.dolor.ut.')).toBe(false);
        expect($state.validate.name('lorem..dolor.sed.ut')).toBe(false);
      });
    });
  });

  describe('#validate.query', function() {
    it('Should test for valid state queries', function() {
      angular.mock.inject(function($state) {
        expect($state.validate.query('lorem.ipsum.dolor.sed.ut')).toBe(true);
        expect($state.validate.query('lorem.ipsum')).toBe(true);
        expect($state.validate.query('lorem')).toBe(true);
        expect($state.validate.query('lorem.0')).toBe(true);
        expect($state.validate.query('Lorem.0')).toBe(true);
        expect($state.validate.query('DOLOR.dolor')).toBe(true);
        expect($state.validate.query('lorem.*.dolor.sed.ut')).toBe(true);
        expect($state.validate.query('lorem.**.dolor.sed.ut')).toBe(true);
      });
    });

    it('Should test for invalid state queries', function() {
      angular.mock.inject(function($state) {
        expect($state.validate.query('lorem..sed.ut')).toBe(false);
        expect($state.validate.query('.lorem.dolor.ut')).toBe(false);
        expect($state.validate.query('lorem.dolor.ut.')).toBe(false);
        expect($state.validate.query('lorem..dolor.sed.ut')).toBe(false);
      });
    });
  });

  describe('#parse', function() {

    it('Should parse name and params from name-params string', function() {
      angular.mock.inject(function($state) {
        expect($state.parse("lorem.sed.ut({id:'lorem', solution:2.7329e-29})")).toEqual({ name:'lorem.sed.ut', params:{id:'lorem', solution:2.7329e-29}});
      });
    });

    it('Should accept spacing around parameters', function() {
      angular.mock.inject(function($state) {
        expect($state.parse("lorem.sed.ut( {id:'lorem', solution:2.7329e-29} )")).toEqual({ name:'lorem.sed.ut', params:{id:'lorem', solution:2.7329e-29}});
      });
    });

  });

});
