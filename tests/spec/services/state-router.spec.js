'use strict';

describe('$state', function() {
  var _state;
  var $location;

  beforeEach(angular.mock.module('angular-state-router'));

  beforeEach(angular.mock.inject(function($state, _$location_) {
    _state = $state;
    $location = _$location_;
  }));

  describe('#state', function() {
    it('Should define states without error', function() {
      _state

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

    it('Should use defined state heirarchy parameters inherit from parent chain', function() {
      _state

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

      var organism = _state.state('organism');
      expect(organism).toBeTruthy();

      var plant = _state.state('organism.plant');
      expect(plant).toBeTruthy();

      var tree = _state.state('organism.plant.tree');
      expect(tree).toBeTruthy();

      var apple = _state.state('organism.plant.tree.apple');
      expect(apple).toBeTruthy();

      var fuji = _state.state('organism.plant.tree.apple.fuji');
      expect(fuji).toBeTruthy();

      var hybrid = _state.state('organism.plant.tree.hybrid');
      expect(hybrid).toBeTruthy();

      // Nonexisting with parents
      var nonexisting = _state.state('organism.plant.tree.nonexisting');
      expect(nonexisting).toBeTruthy();

      // Non-existing without parents
      var invalid = _state.state('does.not.exist.invalid');
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

    it('Should use cache until next update', function() {
      _state
        .state('organism.plant.tree', {
          url: '/trees',
          params: {
            bark: 1
          }
        });

      var tree1 = _state.state('organism.plant.tree');
      expect(tree1).toBeTruthy();
      expect(tree1).toBe(_state.state('organism.plant.tree'));

      _state
        .state('organism.plant.tree', {
          url: '/trees',
          params: {
            bark: 1,
            replacement: true
          }
        });

      var tree2 = _state.state('organism.plant.tree');
      expect(tree2).not.toBe(tree1);
    });
  });

  describe('#init', function() {
    it('Should pass-through EventEmitter methods', function() {
      expect(_state.addListener).toBeDefined();
      expect(_state.on).toBeDefined();
      expect(_state.once).toBeDefined();
      expect(_state.removeListener).toBeDefined();
      expect(_state.removeAllListeners).toBeDefined();
      expect(_state.emit).toBeDefined();
    });

    it('Should emit "init" event after initialization', function(done) {
      _state.on('init', done);
      _state.init();
    });

    it('Should init with $location.url()', function(done) {
      var companyState;

      // Set location
      expect($location.url()).not.toBe('/company/profile/xyco/employees/charliewells/proxy');
      $location.url('/company/profile/xyco/employees/charliewells/proxy');
      expect($location.url()).toBe('/company/profile/xyco/employees/charliewells/proxy');

      // Testing scope
      var _testScope = {
        onInit: function() {
          // URL to be correct according to state
          expect($location.url()).toBe('/company/profile/xyco/employees/charliewells/proxy');
          expect(_testScope.onInit).toHaveBeenCalled();

          // Parameters exist
          expect(_state.current().params.company).toBe('xyco');
          expect(_state.current().params.employee).toBe('charliewells');
          expect(_state.current().params.trend).toBe('upwards');

          done();
        }
      };

      spyOn(_testScope, 'onInit').and.callThrough();

      _state

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
        .init('stores', {store: 'cornerstore'})

        .on('init', _testScope.onInit);
    });

    it('Should fallback init to default initial location', function(done) {
      var companyState;

      expect($location.url()).not.toBe('/company/profile');

      // Testing scope
      var _testScope = {
        onInit: function() {
          expect($location.url()).toBe('/company/profile/abcco');
          expect(_testScope.onInit).toHaveBeenCalled();

          done();
        }
      };

      spyOn(_testScope, 'onInit').and.callThrough();

      _state

        // Define states
        .state('company', companyState = {
          url: '/company/profile/:company'
        })

        // Initialize
        .init('company', { company: 'abcco'})

        .on('init', _testScope.onInit);
    });
  });

  describe('#change', function() {
    it('Should change state asynchronously', function(done) {
      var companyState;

      // Testing scope
      var _testScope = {
        onBegin: function() {
          expect(_state.current()).toBe(null);
        },
        
        onEnd: function() {
          expect(_state.current().name).toEqual('company');
          expect(_state.current().url).toEqual(companyState.url);
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

      _state

        // Define states
        .state('company', companyState = {
          url: '/company/profile'
        })

        // Initialize
        .init()

        // Assume asynchronous operation
        .change('company')

        // Begins before state change
        .on('change:begin', _testScope.onBegin)

        // Ends after change is made
        .on('change:end', _testScope.onEnd)

        .on('change:complete', _testScope.onComplete);

    });

    it('Should change set parameters on state', function(done) {
      var companyState;

      // Testing scope
      var _testScope = {
        onBegin: function() {
          expect(_state.current()).toBe(null);
        },
        
        onEnd: function() {
          expect(_state.current().name).toEqual('company');
          expect(_state.current().url).toEqual(companyState.url);
        },

        onComplete: function() {
          expect(_testScope.onBegin).toHaveBeenCalled();
          expect(_testScope.onEnd).toHaveBeenCalled();
          expect(_testScope.onComplete).toHaveBeenCalled();

          expect(_state.current().params.lorem).toBe('ipsum');

          done();
        }
      };

      spyOn(_testScope, 'onBegin').and.callThrough();
      spyOn(_testScope, 'onEnd').and.callThrough();
      spyOn(_testScope, 'onComplete').and.callThrough();

      _state

        // Define states
        .state('company', companyState = {
          url: '/company/profile'
        })

        // Initialize
        .init()

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

    it('Should not change state when next state is the same', function(done) {
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
            _state.change('company');
          },

          function() {
            expect(_testScope.onBegin.calls.count()).toBe(1);
            expect(_testScope.onEnd.calls.count()).toBe(1);

            // Change with additional params
            _state.change('company', {
              lorem: 'ipsum'
            });
          },

          function() {
            expect(_testScope.onBegin.calls.count()).toBe(2);
            expect(_testScope.onEnd.calls.count()).toBe(2);







            // No change in parameters
            _state.change('company({lorem:"dolor"})');
          },

          function() {
            expect(_testScope.onBegin.calls.count()).toBe(3);
            expect(_testScope.onEnd.calls.count()).toBe(3);

            expect(_state.current().params.lorem).toBe('dolor');
            
            done();
          }

        ]
      };

      _state

        // Define states
        .state('company', companyState = {
          url: '/company/profile',
          params: {
            lorem: 'sed ut'
          }
        })

        // Initialize
        .init()

        // First. change
        .change('company')

        .on('change:begin', _testScope.onBegin)

        .on('change:end', _testScope.onEnd)

        .on('change:complete', function() {
          _testScope.onComplete.shift().call();
        });

    });

    it('Should emit "error:notfound" when requested state does not exist', function(done) {
      var onNotFoundError, onError;

      _state.on('error:notfound', onNotFoundError = jasmine.createSpy('Not found'));
      _state.on('error', onError = jasmine.createSpy('Error'));
      _state.on('change:complete', function() {

        expect(onNotFoundError).toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();

        done();
      });

      _state.init();
      _state.change('somestatethatdoesntexist');
    });

    it('Should define a state and initialize to it automatically', function(done) {
      _state
        .state('employees', {
          url: '/employees/:id/profile'
        })
        .init();

      // Assume asynchronous operation
      _state.change('employees');

      _state.on('change:complete', function() {
        done();
      });
    });
  });

  describe('#$use', function() {
    it('Should add call middleware during render phase', function(done) {
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

      _state
        .init()

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

    it('Should require middleware to be function', function() {
      expect(function() {
        
        _state.$use(null);

      }).toThrow(new Error('Middleware must be a function'));
    });
  });


  describe('#current', function() {
    it('Should retrieve copy of current state', function(done) {
      var companyLobbyState;

      _state

        // Create state
        .state('company.lobby', companyLobbyState = {
          url: '/main',
          params: {
            a: 11
          }
        })

        // Initialize
        .init()

        // Change
        .change('company.lobby')

        // Completion event is always fired even on error
        .on('change:complete', function() {

          // Not same reference
          expect(_state.current()).not.toBe(companyLobbyState);

          expect(_state.current().name).toBe('company.lobby');
          expect(_state.current().url).toBe(companyLobbyState.url);
          expect(_state.current().params).toEqual(companyLobbyState.params);

          done();
        });
    });
  });

  describe('#active', function() {
    it('Should check for active state using query with state notation', function(done) {
      _state

        // Define
        .state('company.lobby', {
          url: '/main/atrium'
        })
        .state('company.lobby.personel', {
          url: '/persons'
        })

        // Initialize
        .init()

        .change('company.lobby.personel')

        // Empty should not throw error
        .on('init', function() {
          expect(_state.active('company.lobby.personel')).toBeFalsy();
        })

        // Completion event is always fired even on error
        .on('change:complete', function() {

          // Parent
          expect(_state.active('company.lobby.personel')).toBeTruthy();
          expect(_state.active('company.lobby')).toBeTruthy();
          expect(_state.active('company')).toBeTruthy();

          // RegExp
          expect(_state.active(/.*/)).toBeTruthy();
          expect(_state.active('/.*/')).toBeTruthy();

          // Wildcards
          expect(_state.active('company.*.personel')).toBeTruthy();
          expect(_state.active('company.*.*')).toBeTruthy();
          expect(_state.active('*.lobby')).toBeTruthy();
          expect(_state.active('*.lobby.*')).toBeTruthy();
          expect(_state.active('*.lobby.*.doesnotexist')).toBeFalsy();
          expect(_state.active('*.lobby.doesnotexist.*')).toBeFalsy();
          expect(_state.active('doesnotexist.*.lobby.*')).toBeFalsy();

          // Double wildcards
          expect(_state.active('company.**')).toBeTruthy();
          expect(_state.active('company.lobby.**')).toBeTruthy();
          expect(_state.active('company.**.personel')).toBeTruthy();
          expect(_state.active('company.**.doesnotexist')).toBeFalsy();
          expect(_state.active('doesnotexist.**.lobby.*')).toBeFalsy();

          // Invalid
          expect(_state.active('doesnotexist')).toBeFalsy();

          // Validate
          expect(_state.current().name).toBe('company.lobby.personel');

          done();
        });
    });
  });

  describe('#library', function() {
    it('Should get defined states', function() {

      _state

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

      expect(_state.library()).toEqual({
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

  describe('#validate.name', function() {
    it('Should test for valid state names', function() {
      expect(_state.validate.name('lorem.ipsum.dolor.sed.ut')).toBe(true);
      expect(_state.validate.name('lorem.ipsum')).toBe(true);
      expect(_state.validate.name('lorem')).toBe(true);
      expect(_state.validate.name('lorem.0')).toBe(true);
      expect(_state.validate.name('Lorem.0')).toBe(true);
      expect(_state.validate.name('DOLOR.dolor')).toBe(true);
    });

    it('Should test for invalid state names', function() {
      expect(_state.validate.name('lorem..sed.ut')).toBe(false);
      expect(_state.validate.name('lorem.*.dolor.sed.ut')).toBe(false);
      expect(_state.validate.name('lorem.**.dolor.sed.ut')).toBe(false);
      expect(_state.validate.name('.lorem.dolor.ut')).toBe(false);
      expect(_state.validate.name('lorem.dolor.ut.')).toBe(false);
      expect(_state.validate.name('lorem..dolor.sed.ut')).toBe(false);
    });
  });

  describe('#validate.query', function() {
    it('Should test for valid state queries', function() {
      expect(_state.validate.query('lorem.ipsum.dolor.sed.ut')).toBe(true);
      expect(_state.validate.query('lorem.ipsum')).toBe(true);
      expect(_state.validate.query('lorem')).toBe(true);
      expect(_state.validate.query('lorem.0')).toBe(true);
      expect(_state.validate.query('Lorem.0')).toBe(true);
      expect(_state.validate.query('DOLOR.dolor')).toBe(true);
      expect(_state.validate.query('lorem.*.dolor.sed.ut')).toBe(true);
      expect(_state.validate.query('lorem.**.dolor.sed.ut')).toBe(true);
    });

    it('Should test for invalid state queries', function() {
      expect(_state.validate.query('lorem..sed.ut')).toBe(false);
      expect(_state.validate.query('.lorem.dolor.ut')).toBe(false);
      expect(_state.validate.query('lorem.dolor.ut.')).toBe(false);
      expect(_state.validate.query('lorem..dolor.sed.ut')).toBe(false);
    });
  });

  describe('#options', function() {
    it('Should define limit for history length', function() {
      _state.options({
        historyLength: 8
      });
    });

    it('Should remove history beyond defined length', function(done) {
      var itrResponse;

      _state
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

        .init('animals.listing')
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
          expect(_state.current().name).toBe('animals.listing');
          expect(_state.history().length).toBe(0);
        },
        function() {
          expect(_state.current().name).toBe('vets.listing');
          expect(_state.history().length).toBe(1);
        },
        function() {
          expect(_state.current().name).toBe('vets.policy');
          expect(_state.history().length).toBe(2);
        },
        function() {
          expect(_state.current().name).toBe('owners.listing');
          expect(_state.history().length).toBe(2);
        },
        function() {
          expect(_state.current().name).toBe('owners');
          expect(_state.history().length).toBe(2);

          // Last two are saved
          expect(_state.history()[0].name).toBe('vets.policy');
          expect(_state.history()[1].name).toBe('owners.listing');

        },
        function() {
          expect(_state.current().name).toBe('owners.animals');
          done();
        }
      ];
    });
  });

  describe('#parse', function() {

    it('Should parse name and params from name-params string', function() {
      expect(_state.parse("lorem.sed.ut({id:'lorem', solution:2.7329e-29})")).toEqual({ name:'lorem.sed.ut', params:{id:'lorem', solution:2.7329e-29}});
    });

    it('Should accept spacing around parameters', function() {
      expect(_state.parse("lorem.sed.ut( {id:'lorem', solution:2.7329e-29} )")).toEqual({ name:'lorem.sed.ut', params:{id:'lorem', solution:2.7329e-29}});
    });

  });


});
