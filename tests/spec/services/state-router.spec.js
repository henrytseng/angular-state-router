'use strict';

describe('$stateRouter', function() {
  var _stateRouter;

  beforeEach(module('angular-state-router'));

  beforeEach(inject(function($stateRouter) {
    _stateRouter = $stateRouter;
  }));

  describe('#state', function() {
    it('Should define states without error', function() {
      _stateRouter

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
        .state('terms.legal.', {
          url: '/legal'
        });
    });

    it('Should use defined state heirarchy', function() {
      //throw new Error('left off here');
    });
  });

  describe('#init', function() {
    it('Should pass-through EventEmitter methods', function() {
      expect(_stateRouter.addListener).toBeDefined();
      expect(_stateRouter.on).toBeDefined();
      expect(_stateRouter.once).toBeDefined();
      expect(_stateRouter.removeListener).toBeDefined();
      expect(_stateRouter.removeAllListeners).toBeDefined();
      expect(_stateRouter.emit).toBeDefined();
    });

    it('Should emit "init" event after initialization', function(done) {
      _stateRouter.on('init', done);
      _stateRouter.init();
    });
  });

  describe('#change', function() {
    it('Should change state asynchronously', function(done) {
      var companyState;

      // Testing scope
      var _testScope = {
        onBegin: function() {
          expect(_stateRouter.current()).toBe(null);
        },
        
        onEnd: function() {
          expect(_stateRouter.current().name).toEqual('company');
          expect(_stateRouter.current().url).toEqual(companyState.url);
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

      _stateRouter

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

    it('Should emit "error:notfound" when requested state does not exist', function(done) {
      var onNotFoundError, onError;

      _stateRouter.on('error:notfound', onNotFoundError = jasmine.createSpy('Not found'));
      _stateRouter.on('error', onError = jasmine.createSpy('Error'));
      _stateRouter.on('change:complete', function() {

        expect(onNotFoundError).toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();

        done();
      });

      _stateRouter.init();
      _stateRouter.change('somestatethatdoesntexist');
    });

    it('Should define a state and initialize to it automatically', function(done) {
      _stateRouter
        .state('employees', {
          url: '/employees/:id/profile'
        })
        .init();

      // Assume asynchronous operation
      _stateRouter.change('employees');

      _stateRouter.on('change:complete', function() {
        done();
      });
    });
  });

  describe('#current', function() {
    it('Should retrieve copy of current state', function(done) {
      var companyLobbyState;

      _stateRouter

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
          expect(_stateRouter.current()).not.toBe(companyLobbyState);

          expect(_stateRouter.current().name).toBe('company.lobby');
          expect(_stateRouter.current().url).toBe(companyLobbyState.url);
          expect(_stateRouter.current().params).toEqual(companyLobbyState.params);

          done();
        });
    });

    it('Should retrieve state according to parent data', function() {
    });
  });

  describe('#active', function() {
    it('Should check for active state using query with state notation', function(done) {
      _stateRouter

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
          expect(_stateRouter.active('company.lobby.personel')).toBeFalsy();
        })

        // Completion event is always fired even on error
        .on('change:complete', function() {

          // Parent
          expect(_stateRouter.active('company.lobby.personel')).toBeTruthy();
          expect(_stateRouter.active('company.lobby')).toBeTruthy();
          expect(_stateRouter.active('company')).toBeTruthy();

          // RegExp
          expect(_stateRouter.active(/.*/)).toBeTruthy();
          expect(_stateRouter.active('/.*/')).toBeTruthy();

          // Wildcards
          expect(_stateRouter.active('company.*.personel')).toBeTruthy();
          expect(_stateRouter.active('company.*.*')).toBeTruthy();
          expect(_stateRouter.active('*.lobby')).toBeTruthy();
          expect(_stateRouter.active('*.lobby.*')).toBeTruthy();
          expect(_stateRouter.active('*.lobby.*.doesnotexist')).toBeFalsy();
          expect(_stateRouter.active('*.lobby.doesnotexist.*')).toBeFalsy();
          expect(_stateRouter.active('doesnotexist.*.lobby.*')).toBeFalsy();

          // Double wildcards
          expect(_stateRouter.active('company.**')).toBeTruthy();
          expect(_stateRouter.active('company.lobby.**')).toBeTruthy();
          expect(_stateRouter.active('company.**.personel')).toBeTruthy();
          expect(_stateRouter.active('company.**.doesnotexist')).toBeFalsy();
          expect(_stateRouter.active('doesnotexist.**.lobby.*')).toBeFalsy();

          // Invalid
          expect(_stateRouter.active('doesnotexist')).toBeFalsy();

          // Validate
          expect(_stateRouter.current().name).toBe('company.lobby.personel');

          done();
        });
    });
  });

  describe('#library', function() {
    it('Should get defined states', function() {

      _stateRouter

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

      expect(_stateRouter.library()).toEqual({
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

  describe('#options', function() {
    it('Should define limit for history length', function() {
      _stateRouter.options({
        historyLength: 8
      });
    });

    it('Should remove history beyond defined length', function(done) {
      var itrResponse;

      _stateRouter
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
          expect(_stateRouter.current().name).toBe('animals.listing');
          expect(_stateRouter.history().length).toBe(0);
        },
        function() {
          expect(_stateRouter.current().name).toBe('vets.listing');
          expect(_stateRouter.history().length).toBe(1);
        },
        function() {
          expect(_stateRouter.current().name).toBe('vets.policy');
          expect(_stateRouter.history().length).toBe(2);
        },
        function() {
          expect(_stateRouter.current().name).toBe('owners.listing');
          expect(_stateRouter.history().length).toBe(2);
        },
        function() {
          expect(_stateRouter.current().name).toBe('owners');
          expect(_stateRouter.history().length).toBe(2);

          // Last two are saved
          expect(_stateRouter.history()[0].name).toBe('vets.policy');
          expect(_stateRouter.history()[1].name).toBe('owners.listing');

        },
        function() {
          expect(_stateRouter.current().name).toBe('owners.animals');
          done();
        }
      ];
    });
  });

});
