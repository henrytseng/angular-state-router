'use strict';

xdescribe('$state', function() {
  var _fakeApp;

  beforeEach(function() {
    _fakeApp = angular.module('fakeApp', function() {});
  });

  beforeEach(function() {
    angular.mock.module('angular-state-router', 'fakeApp');
  });

  describe('#state', function() {
    it('Should define states without error', function() {
      angular.mock.inject(function($state) {
        $state

          // A state
          .state('dashboard', {
            url: '/dashboard'
          })

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
      });
    });

    it('Should use defined state heirarchy parameters inherit from parent chain', function() {
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

          // Underling state
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
    it('Should change state asynchronously', function(done) {
      angular.mock.inject(function($state) {
        var companyState;

        // Testing scope
        var _testScope = {
          onBegin: function() {
            expect($state.current().name).toEqual('company');
          },
          
          onEnd: function() {
            expect($state.current().name).toEqual('company');
            expect($state.current().url).toEqual(companyState.url);
          },

          onComplete: function() {
            expect(_testScope.onBegin).toHaveBeenCalled();
            expect(_testScope.onEnd).toHaveBeenCalled();
            expect(_testScope.onComplete).toHaveBeenCalled();

            done();
          }
        };

        spyOn(_testScope, 'onBegin').and.callThrough();
        spyOn(_testScope, 'onEnd').and.callThrough();
        spyOn(_testScope, 'onComplete').and.callThrough();

        $state

          // Define states
          .state('company', companyState = {
            url: '/company/profile'
          })

          // Initialize
          .$ready()

          // Assume asynchronous operation
          .change('company')

          // Begins before state change
          .on('change:begin', _testScope.onBegin)

          // Ends after change is made
          .on('change:end', _testScope.onEnd)

          .on('change:complete', _testScope.onComplete);

        expect(_testScope.onBegin).not.toHaveBeenCalled();
        expect(_testScope.onEnd).not.toHaveBeenCalled();
        expect(_testScope.onComplete).not.toHaveBeenCalled();

      });
    });

    it('Should change set parameters on state', function(done) {
      angular.mock.inject(function($state) {
        var companyState;

        // Testing scope
        var _testScope = {
          onBegin: function() {
            expect($state.current().name).toEqual('company');
          },
          
          onEnd: function() {
            expect($state.current().name).toEqual('company');
            expect($state.current().url).toEqual(companyState.url);
          },

          onComplete: function() {
            expect(_testScope.onBegin).toHaveBeenCalled();
            expect(_testScope.onEnd).toHaveBeenCalled();
            expect(_testScope.onComplete).toHaveBeenCalled();

            expect($state.current().params.lorem).toBe('ipsum');

            done();
          }
        };

        spyOn(_testScope, 'onBegin').and.callThrough();
        spyOn(_testScope, 'onEnd').and.callThrough();
        spyOn(_testScope, 'onComplete').and.callThrough();

        $state

          // Define states
          .state('company', companyState = {
            url: '/company/profile'
          })

          // Initialize
          .$ready()

          // Assume asynchronous operation
          .change('company', {
            lorem: 'ipsum'
          })

          // Begins before state change
          .on('change:begin', _testScope.onBegin)

          // Ends after change is made
          .on('change:end', _testScope.onEnd)

          .on('change:complete', _testScope.onComplete);

      });
    });

    it('Should not change state when next state is the same', function(done) {
      angular.mock.inject(function($state) {
        var companyState;

        // Testing scope
        var _testScope;
        _testScope = {
          onBegin: jasmine.createSpy('onBegin'),
          
          onEnd: jasmine.createSpy('onEnd'),

          onComplete: [
            
            function() {
              expect(_testScope.onBegin.calls.count()).toBe(1);
              expect(_testScope.onEnd.calls.count()).toBe(1);

              // No change
              $state.change('company');
            },

            function() {
              expect(_testScope.onBegin.calls.count()).toBe(1);
              expect(_testScope.onEnd.calls.count()).toBe(1);

              // Change with additional params
              $state.change('company', {
                lorem: 'ipsum'
              });
            },

            function() {
              expect(_testScope.onBegin.calls.count()).toBe(2);
              expect(_testScope.onEnd.calls.count()).toBe(2);

              // No change in parameters
              $state.change('company({lorem:"dolor"})');
            },

            function() {
              expect(_testScope.onBegin.calls.count()).toBe(3);
              expect(_testScope.onEnd.calls.count()).toBe(3);

              expect($state.current().params.lorem).toBe('dolor');
              
              done();
            }

          ]
        };

        $state

          // Define states
          .state('company', companyState = {
            url: '/company/profile',
            params: {
              lorem: 'sed ut'
            }
          })

          // Initialize
          .$ready()

          // First. change
          .change('company')

          .on('change:begin', _testScope.onBegin)

          .on('change:end', _testScope.onEnd)

          .on('change:complete', function() {
            _testScope.onComplete.shift().call();
          });

      });
    });

    it('Should emit "error:notfound" when requested state does not exist', function(done) {
      angular.mock.inject(function($state) {
        var onNotFoundError, onError;

        $state.on('error:notfound', onNotFoundError = jasmine.createSpy('Not found'));
        $state.on('error', onError = jasmine.createSpy('Error'));
        $state.on('change:complete', function() {

          expect(onNotFoundError).toHaveBeenCalled();
          expect(onError).toHaveBeenCalled();

          done();
        });

        $state
          .$ready()
          .change('somestatethatdoesntexist');
      });
    });

    it('Should define a state and initialize to it automatically', function(done) {
      angular.mock.inject(function($state) {
        $state
          .state('employees', {
            url: '/employees/:id/profile'
          })
          .$ready();

        // Assume asynchronous operation
        $state.change('employees');

        $state.on('change:complete', function() {
          done();
        });
      });
    });
  });

  describe('#$use', function() {
    it('Should add call middleware during render phase', function(done) {
      angular.mock.inject(function($state) {
        var _testScope = {
          onMiddle: function(request, next) {
            next();
          },
          onComplete: function() {
            expect(_testScope.onMiddle.calls.count()).toEqual(1);

            done();
          }
        };

        spyOn(_testScope, 'onMiddle').and.callThrough();

        $state
          .$ready()

          .state('product.shoes', {
            params: {
              sku: '2937-UAE321',
              colors: [ 'blue', 'green ']
            }
          })

          .$use(function(request, next) {
            _testScope.onMiddle(request, next);
          })

          .change('product.shoes')

          .on('change:complete', function() {
            _testScope.onComplete.call();
          });
      });
    });

    it('Should require middleware to be function', function() {
      angular.mock.inject(function($state) {
        expect(function() {
          
          $state.$use(null);

        }).toThrow(new Error('Middleware must be a function.'));
      });
    });
  });


  describe('#current', function() {
    it('Should retrieve copy of current state', function(done) {
      angular.mock.inject(function($state) {
        var companyLobbyState;

        $state

          // Create state
          .state('company.lobby', companyLobbyState = {
            url: '/main',
            params: {
              a: 11
            }
          })

          // Initialize
          .$ready()

          // Change
          .change('company.lobby')

          // Completion event is always fired even on error
          .on('change:complete', function() {

            // Not same reference
            expect($state.current()).not.toBe(companyLobbyState);

            expect($state.current().name).toBe('company.lobby');
            expect($state.current().url).toBe(companyLobbyState.url);
            expect($state.current().params).toEqual(companyLobbyState.params);

            done();
          });
      });
    });
  });

  describe('#active', function() {
    it('Should check for active state using query with state notation', function(done) {
      angular.mock.inject(function($state) {
        $state

          // Define
          .state('company.lobby', {
            url: '/main/atrium'
          })
          .state('company.lobby.personel', {
            url: '/persons'
          })

          // Initialize
          .$ready()

          .change('company.lobby.personel')

          // Empty should not throw error
          .on('init', function() {
            expect($state.active('company.lobby.personel')).toBeFalsy();
          })

          // Completion event is always fired even on error
          .on('change:complete', function() {

            // Parent
            expect($state.active('company.lobby.personel')).toBeTruthy();
            expect($state.active('company.lobby')).toBeTruthy();
            expect($state.active('company')).toBeTruthy();

            // RegExp
            expect($state.active(/.*/)).toBeTruthy();
            expect($state.active('/.*/')).toBeTruthy();

            // Wildcards
            expect($state.active('company.*.personel')).toBeTruthy();
            expect($state.active('company.*.*')).toBeTruthy();
            expect($state.active('*.lobby')).toBeTruthy();
            expect($state.active('*.lobby.*')).toBeTruthy();
            expect($state.active('*.lobby.*.doesnotexist')).toBeFalsy();
            expect($state.active('*.lobby.doesnotexist.*')).toBeFalsy();
            expect($state.active('doesnotexist.*.lobby.*')).toBeFalsy();

            // Double wildcards
            expect($state.active('company.**')).toBeTruthy();
            expect($state.active('company.lobby.**')).toBeTruthy();
            expect($state.active('company.**.personel')).toBeTruthy();
            expect($state.active('company.**.doesnotexist')).toBeFalsy();
            expect($state.active('doesnotexist.**.lobby.*')).toBeFalsy();

            // Invalid
            expect($state.active('doesnotexist')).toBeFalsy();

            // Validate
            expect($state.current().name).toBe('company.lobby.personel');

            done();
          });
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
