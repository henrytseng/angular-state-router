(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = ['$state', function ($state) {
  return {
    restrict: 'A',
    scope: {
    },
    link: function(scope, element, attrs) {
      element.css('cursor', 'pointer');
      element.on('click', function(e) {
        $state.change(attrs.sref);
        e.preventDefault();
      });
    }

  };
}];

},{}],2:[function(require,module,exports){
'use strict';

/* global angular:false */

// CommonJS
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'angular-state-router';
}

// Instantiate module
angular.module('angular-state-router', [])

  .provider('$state', require('./services/state-router'))

  .factory('$urlManager', require('./services/url-manager'))

  .factory('$resolution', require('./services/resolution'))

  .factory('$enact', require('./services/enact'))
  
  .factory('$queueHandler', require('./services/queue-handler'))

  .run(['$rootScope', '$state', '$urlManager', '$resolution', '$enact', function($rootScope, $state, $urlManager, $resolution, $enact) {
    // Update location changes
    $rootScope.$on('$locationChangeSuccess', function() {
      $urlManager.location(arguments);
    });

    // Initialize
    $state.$ready();
  }])

  .directive('sref', require('./directives/sref'));

},{"./directives/sref":1,"./services/enact":3,"./services/queue-handler":4,"./services/resolution":5,"./services/state-router":6,"./services/url-manager":7}],3:[function(require,module,exports){
'use strict';

module.exports = ['$q', '$injector', '$state', '$rootScope', function($q, $injector, $state, $rootScope) {

  // Instance
  var _self = {};

  /**
   * Process actions
   * 
   * @param  {Object}  actions An array of actions items
   * @return {Promise}         A promise fulfilled when actions processed
   */
  var _act = function(actions) {
    var actionPromises = [];

    angular.forEach(actions, function(value) {
      var action = angular.isString(value) ? $injector.get(value) : $injector.invoke(value);
      actionPromises.push($q.when(action));
    });

    return $q.all(actionPromises);
  };
  _self.process = _act;

  /**
   * Middleware
   * 
   * @param  {Object}   request A data Object
   * @param  {Function} next    A callback, function(err)
   */
  var _handle = function(request, next) {
    var current = $state.current();

    if(!current) {
      return next();
    }

    _act(current.actions || []).then(function() {
      next();

    }, function(err) {
      $rootScope.$broadcast('$stateChangeErrorAction', err);
      next(new Error('Error processing state actions'));
    });
  };

  // Register middleware layer
  $state.$use(_handle, 100);

  return _self;
}];

},{}],4:[function(require,module,exports){
'use strict';

module.exports = ['$rootScope', function($rootScope) {

  /**
   * Execute a series of functions; used in tandem with middleware
   */
  var Queue = function() {
    var _list = [];
    var _data = null;

    var _self = {

      /**
       * Add a handler
       * 
       * @param {Mixed}  handler A Function or an Array of Functions to add to the queue
       * @return {Queue}         Itself; chainable
       */
      add: function(handler, priority) {
        if(handler && handler.constructor === Array) {
          handler.forEach(function(layer) {
            layer.priority = typeof layer.priority === 'undefined' ? 1 : layer.priority;
          });
          _list = _list.concat(handler);
        } else {
          handler.priority = priority || (typeof handler.priority === 'undefined' ? 1 : handler.priority);
          _list.push(handler);
        }
        return this;
      },

      /**
       * Data object
       * 
       * @param  {Object} data A data object made available to each handler
       * @return {Queue}       Itself; chainable
       */
      data: function(data) {
        _data = data;
        return this;
      },

      /**
       * Begin execution and trigger callback at the end
       * 
       * @param  {Function} callback A callback, function(err)
       * @return {Queue}             Itself; chainable
       */
      execute: function(callback) {
        var nextHandler;
        var executionList = _list.slice(0).sort(function(a, b) {
          return Math.max(-1, Math.min(1, b.priority - a.priority));
        });

        nextHandler = function() {
          $rootScope.$evalAsync(function() {
            var handler = executionList.shift();

            // Complete
            if(!handler) {
              callback(null);

            // Next handler
            } else {
              handler.call(null, _data, function(err) {
                // Error
                if(err) {
                  callback(err);

                // Continue
                } else {
                  nextHandler();
                }
              });
            }
          });
        };

        // Start
        nextHandler();
      }

    };
    
    return _self;
  };

  // Instance
  return {

    /**
     * Factory method
     * 
     * @return {Queue} A queue
     */
    create: function() {
      return Queue();
    }
  };
}];

},{}],5:[function(require,module,exports){
'use strict';

module.exports = ['$q', '$injector', '$state', '$rootScope', function($q, $injector, $state, $rootScope) {

  // Instance
  var _self = {};

  /**
   * Resolve
   * 
   * @param  {Object}  resolve A hash Object of items to resolve
   * @return {Promise}         A promise fulfilled when templates retireved
   */
  var _resolve = function(resolve) {
    var resolvesPromises = {};

    angular.forEach(resolve, function(value, key) {
      var resolution = angular.isString(value) ? $injector.get(value) : $injector.invoke(value, null, null, key);
      resolvesPromises[key] = $q.when(resolution);
    });

    return $q.all(resolvesPromises);
  };
  _self.resolve = _resolve;

  /**
   * Middleware
   * 
   * @param  {Object}   request A data Object
   * @param  {Function} next    A callback, function(err)
   */
  var _handle = function(request, next) {
    var current = $state.current();

    if(!current) {
      return next();
    }

    _resolve(current.resolve || {}).then(function(locals) {
      angular.extend(request.locals, locals);
      next();

    }, function(err) {
      $rootScope.$broadcast('$stateChangeErrorResolve', err);
      next(new Error('Error resolving state'));
    });
  };

  // Register middleware layer
  $state.$use(_handle, 101);

  return _self;
}];

},{}],6:[function(require,module,exports){
'use strict';

var UrlDictionary = require('../utils/url-dictionary');
var Parameters = require('../utils/parameters');

module.exports = [function StateRouterProvider() {
  // Provider
  var _provider = this;

  // Configuration, global options
  var _configuration = {
    historyLength: 5
  };

  // State definition library
  var _stateLibrary = {};
  var _stateCache = {};

  // URL to state dictionary
  var _urlDictionary = new UrlDictionary();

  // Middleware layers
  var _layerList = [];

  /**
   * Parse state notation name-params.  
   * 
   * Assume all parameter values are strings
   * 
   * @param  {String} nameParams A name-params string
   * @return {Object}             A name string and param Object
   */
  var _parseName = function(nameParams) {
    if(nameParams && nameParams.match(/^[a-zA-Z0-9_\.]*\(.*\)$/)) {
      var npart = nameParams.substring(0, nameParams.indexOf('('));
      var ppart = Parameters( nameParams.substring(nameParams.indexOf('(')+1, nameParams.lastIndexOf(')')) );

      return {
        name: npart,
        params: ppart
      };

    } else {
      return {
        name: nameParams,
        params: null
      };
    }
  };

  /**
   * Add default values to a state
   * 
   * @param  {Object} data An Object
   * @return {Object}      An Object
   */
  var _setStateDefaults = function(data) {
    // Default values
    data.inherit = (typeof data.inherit === 'undefined') ? true : data.inherit;

    return data;
  };

  /**
   * Validate state name
   * 
   * @param  {String} name A unique identifier for the state; using dot-notation
   * @return {Boolean}     True if name is valid, false if not
   */
  var _validateStateName = function(name) {
    name = name || '';

    // TODO optimize with RegExp

    var nameChain = name.split('.');
    for(var i=0; i<nameChain.length; i++) {
      if(!nameChain[i].match(/[a-zA-Z0-9_]+/)) {
        return false;
      }
    }

    return true;
  };

  /**
   * Validate state query
   * 
   * @param  {String} query A query for the state; using dot-notation
   * @return {Boolean}      True if name is valid, false if not
   */
  var _validateStateQuery = function(query) {
    query = query || '';
    
    // TODO optimize with RegExp

    var nameChain = query.split('.');
    for(var i=0; i<nameChain.length; i++) {
      if(!nameChain[i].match(/(\*(\*)?|[a-zA-Z0-9_]+)/)) {
        return false;
      }
    }

    return true;
  };

  /**
   * Compare two states, compares values.  
   * 
   * @return {Boolean} True if states are the same, false if states are different
   */
  var _compareStates = function(a, b) {
    a = a || {};
    b = b || {};
    return a.name === b.name && angular.equals(a.params, b.params);
  };

  /**
   * Get a list of parent states
   * 
   * @param  {String} name   A unique identifier for the state; using dot-notation
   * @return {Array}         An Array of parent states
   */
  var _getNameChain = function(name) {
    var nameList = name.split('.');

    return nameList
      .map(function(item, i, list) {
        return list.slice(0, i+1).join('.');
      })
      .filter(function(item) {
        return item !== null;
      });
  };

  /**
   * Internal method to crawl library heirarchy
   * 
   * @param  {String} name   A unique identifier for the state; using state-notation
   * @return {Object}        A state data Object
   */
  var _getState = function(name) {
    name = name || '';

    var state = null;

    // Only use valid state queries
    if(!_validateStateName(name)) {
      return null;
    
    // Use cache if exists
    } else if(_stateCache[name]) {
      return _stateCache[name];
    }

    var nameChain = _getNameChain(name);
    var stateChain = nameChain
      .map(function(name, i) {
        var item = angular.copy(_stateLibrary[name]);
        return item;
      })
      .filter(function(parent) {
        return !!parent;
      });

    // Walk up checking inheritance
    for(var i=stateChain.length-1; i>=0; i--) {
      if(stateChain[i]) {
        var nextState = stateChain[i];
        state = angular.merge(nextState, state || {});
      }

      if(state && state.inherit === false) break;
    }

    // Store in cache
    _stateCache[name] = state;

    return state;
  };

  /**
   * Internal method to store a state definition.  Parameters should be included in data Object not state name.  
   * 
   * @param  {String} name A unique identifier for the state; using state-notation
   * @param  {Object} data A state definition data Object
   * @return {Object}      A state data Object
   */
  var _defineState = function(name, data) {
    if(name === null || typeof name === 'undefined') {
      throw new Error('Name cannot be null.');
    
    // Only use valid state names
    } else if(!_validateStateName(name)) {
      throw new Error('Invalid state name.');
    }

    // Create state
    var state = angular.copy(data);

    // Use defaults
    _setStateDefaults(state);

    // Named state
    state.name = name;

    // Set definition
    _stateLibrary[name] = state;

    // Reset cache
    _stateCache = {};

    // URL mapping
    if(state.url) {
      _urlDictionary.add(state.url, state);
    }

    return data;
  };

  /**
   * Set configuration data parameters for StateRouter
   *
   * Including parameters:
   * 
   * - historyLength   {Number} Defaults to 5
   * - initialLocation {Object} An Object{name:String, params:Object} for initial state transition
   *
   * @param  {Object}         options A data Object
   * @return {$stateProvider}         Itself; chainable
   */
  this.options = function(options) {
    angular.extend(_configuration, options || {});
    return _provider;
  };

  /**
   * Set/get state
   * 
   * @param  {String} name A unique identifier for the state; using state-notation
   * @param  {Object} data A state definition data Object
   * @return {$stateProvider} Itself; chainable
   */
  this.state = function(name, state) {
    // Get
    if(!state) {
      return _getState(name);
    }

    // Set
    _defineState(name, state);

    return _provider;
  };

  /**
   * Set initialization parameters; deferred to $ready()
   * 
   * @param  {String}         name   A iniital state
   * @param  {Object}         params A data object of params
   * @return {$stateProvider}        Itself; chainable
   */
  this.init = function(name, params) {
    _configuration.initialLocation = {
      name: name,
      params: params
    };
    return _provider;
  };

  /**
   * Get instance
   */
  this.$get = ['$rootScope', '$location', '$q', '$queueHandler', function StateRouterFactory($rootScope, $location, $q, $queueHandler) {

    // State
    var _current;
    var _transitionQueue = [];
    var _isReady = true;

    var _options;
    var _initalLocation;
    var _history = [];
    var _isInit = false;

    /**
     * Internal method to add history and correct length
     * 
     * @param  {Object} data An Object
     */
    var _pushHistory = function(data) {
      // Keep the last n states (e.g. - defaults 5)
      var historyLength = _options.historyLength || 5;

      if(data) {
        _history.push(data);
      }

      // Update length
      if(_history.length > historyLength) {
        _history.splice(0, _history.length - historyLength);
      }
    };

    /**
     * Internal method to fulfill change state request.  Parameters in `params` takes precedence over state-notation `name` expression.  
     * 
     * @param  {String}   name     A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}   params   A data object of params
     * @param  {Function} callback A callback, function(err)
     * @return {Promise}           A promise fulfilled when state change occurs
     */
    var _changeState = function(name, params, callback) {
      $rootScope.$evalAsync(function() {
        params = params || {};

        // Parse state-notation expression
        var nameExpr = _parseName(name);
        name = nameExpr.name;
        params = angular.extend(nameExpr.params || {}, params);

        var error = null;
        var request = {
          name: name,
          params: params,
          locals: {}
        };

        // Compile execution phases
        var queue = $queueHandler.create().data(request);

        var nextState = angular.copy(_getState(name));
        var prevState = _current;

        if(nextState) {
          // Set locals
          nextState.locals = request.locals;
          
          // Set parameters
          nextState.params = angular.extend(nextState.params || {}, params);
        }

        // Does not exist
        if(nextState === null) {
          queue.add(function(data, next) {
            error = new Error('Requested state was not defined.');
            error.code = 'notfound';

            $rootScope.$broadcast('$stateChangeErrorNotFound', error, request);
            next(error);
          }, 200);

        // State not changed
        } else if(_compareStates(prevState, nextState)) {
          queue.add(function(data, next) {
            _current = nextState;
            next();
          }, 200);
          
        // Valid state exists
        } else {

          // Process started
          queue.add(function(data, next) {
            $rootScope.$broadcast('$stateChangeBegin', request);
            next();
          }, 201);

          // Make state change
          queue.add(function(data, next) {
            if(prevState) _pushHistory(prevState);
            _current = nextState;
            
            next();
          }, 200);

          // Add middleware
          queue.add(_layerList);

          // Process ended
          queue.add(function(data, next) {
            $rootScope.$broadcast('$stateChangeEnd', request);
            next();
          }, -200);
        }

        // Run
        queue.execute(callback);
      });
    };

    /**
     * Internal method to request change to state.  
     * 
     * @param  {String}  name   A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}  params A data object of params
     * @return {Promise}        A promise fulfilled when state change occurs
     */
    var _queueChange = function(name, params) {
      var deferred = $q.defer();
      var error;

      // Queue request
      _transitionQueue.push({
        name: name,
        params: params
      });

      // Handle next request
      var nextRequest;
      nextRequest = function() {
        if(!_isReady) return;
        var request = _transitionQueue.shift();

        // Continue
        if(request) {
          _isReady = false;

          _changeState(request.name, request.params, function(err) {
            _isReady = true;

            if(err) {
              $rootScope.$broadcast('$stateChangeError', err, request);
              error = err;
            }

            nextRequest();
          });

        // End
        } else {
          if(error) {
            deferred.reject(error);
          } else {
            deferred.resolve();
          }
        }

      };

      nextRequest();

      return deferred.promise;
    };

    /**
     * Internal method to change to state and broadcast completion
     * 
     * @param  {String}  name   A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}  params A data object of params
     * @return {Promise}        A promise fulfilled when state change occurs
     */
    var _queueStateAndBroadcastComplete = function(name, params) {
      return _queueChange(name, params).then(function() {
        $rootScope.$broadcast('$stateChangeComplete', null, _current);
      }, function(err) {
        $rootScope.$broadcast('$stateChangeComplete', err, _current);
      });
    };

    /**
     * Reloads the current state
     * 
     * @return {Promise} A promise fulfilled when state change occurs
     */
    var _reloadState = function() {
      var n = _current.name;
      var p = angular.copy(_current.params);
      if(!_current.params) {
        _current.params = {};
      }
      _current.params.deprecated = true;

      // Notify
      $rootScope.$broadcast('$stateReload', null, _current);

      return _queueStateAndBroadcastComplete(n, p);
    };

    // Instance
    var _inst;
    _inst = {

      /**
       * Get options
       *
       * @return {Object} A configured options
       */
      options: function() {
        // Hasn't been initialized
        if(!_options) {
          _options = angular.copy(_configuration);
        }

        return _options;
      },

      /**
       * Set/get state. Reloads state if current state is affected by defined 
       * state (when redefining parent or current state)
       *
       * @param  {String} name A unique identifier for the state; using state-notation
       * @param  {Object} data A state definition data Object
       * @return {$state}      Itself; chainable
       */
      state: function(name, state) {
        // Get
        if(!state) {
          return _getState(name);
        }

        // Set
        _defineState(name, state);

        // Reload when current affected
        if(!!_current) {
          var nameChain = _getNameChain(_current.name);
          if(nameChain.indexOf(name) !== -1) {
            _reloadState();
          }
        }

        return _inst;
      },

      /**
       * Internal method to add middleware; called during state transition
       * 
       * @param  {Function} handler  A callback, function(request, next)
       * @param  {Number}   priority A number denoting priority
       * @return {$state}            Itself; chainable
       */
      $use: function(handler, priority) {
        if(typeof handler !== 'function') {
          throw new Error('Middleware must be a function.');
        }

        if(typeof priority !== 'undefined') handler.priority = priority;
        _layerList.push(handler);
        return _inst;
      },

      /**
       * Internal method to perform initialization
       * 
       * @return {$state} Itself; chainable
       */
      $ready: function() {
        $rootScope.$evalAsync(function() {
          if(!_isInit) {
            _isInit = true;

            // Configuration
            if(!_options) {
              _options = angular.copy(_configuration);
            }

            // Initial location
            if(_options.hasOwnProperty('initialLocation')) {
              _initalLocation = angular.copy(_options.initialLocation);
            }

            var readyDeferred = null;

            // Initial location
            if($location.url() !== '') {
              readyDeferred = _inst.$location($location.url());

            // Initialize with state
            } else if(_initalLocation) {
              readyDeferred = _queueStateAndBroadcastComplete(_initalLocation.name, _initalLocation.params);
            }

            $q.when(readyDeferred).then(function() {
              $rootScope.$broadcast('$stateInit');
            });
          }
        });

        return _inst;
      },

      // Parse state notation name-params.  
      parse: _parseName,

      /**
       * Retrieve definition of states
       * 
       * @return {Object} A hash of all defined states
       */
      library: function() {
        return _stateLibrary;
      },

      // Validation
      validate: {
        name: _validateStateName,
        query: _validateStateQuery
      },

      /**
       * Retrieve history
       * 
       * @return {[type]} [description]
       */
      history: function() {
        return _history;
      },

      /**
       * Request state transition, asynchronous operation
       * 
       * @param  {String}      name     A unique identifier for the state; using dot-notation
       * @param  {Object}      [params] A parameters data object
       * @return {Promise}              A promise fulfilled when state change complete
       */
      change: function(name, params) {
        return _queueStateAndBroadcastComplete(name, params);
      },

      /**
       * Reloads the current state
       * 
       * @return {Promise} A promise fulfilled when state change occurs
       */
      reload: _reloadState,

      /**
       * Internal method to change state based on $location.url(), asynchronous operation using internal methods, quiet fallback.  
       * 
       * @param  {String}      url        A url matching defind states
       * @param  {Function}    [callback] A callback, function(err)
       * @return {$state}                 Itself; chainable
       */
      $location: function(url) {
        var data = _urlDictionary.lookup(url);

        if(data) {
          var state = data.ref;

          if(state) {
            // Parse params from url
            return _queueStateAndBroadcastComplete(state.name, data.params);
          }
        } else if(!!url && url !== '') {
          var error = new Error('Requested state was not defined.');
          error.code = 'notfound';
          $rootScope.$broadcast('$stateChangeErrorNotFound', error, {
            url: url
          });
        }

        return $q.reject(new Error('Unable to find location in library'));
      },
      
      /**
       * Retrieve copy of current state
       * 
       * @return {Object} A copy of current state
       */
      current: function() {
        return (!_current) ? null : angular.copy(_current);
      },

      /**
       * Check query against current state
       *
       * @param  {Mixed}   query  A string using state notation or a RegExp
       * @param  {Object}  params A parameters data object
       * @return {Boolean}        A true if state is parent to current state
       */
      active: function(query, params) {
        query = query || '';
        
        // No state
        if(!_current) {
          return false;

        // Use RegExp matching
        } else if(query instanceof RegExp) {
          return !!_current.name.match(query);

        // String; state dot-notation
        } else if(typeof query === 'string') {

          // Cast string to RegExp
          if(query.match(/^\/.*\/$/)) {
            var casted = query.substr(1, query.length-2);
            return !!_current.name.match(new RegExp(casted));

          // Transform to state notation
          } else {
            var transformed = query
              .split('.')
              .map(function(item) {
                if(item === '*') {
                  return '[a-zA-Z0-9_]*';
                } else if(item === '**') {
                  return '[a-zA-Z0-9_\\.]*';
                } else {
                  return item;
                }
              })
              .join('\\.');

            return !!_current.name.match(new RegExp(transformed));
          }
        }

        // Non-matching
        return false;
      }
    };

    return _inst;
  }];

}];

},{"../utils/parameters":8,"../utils/url-dictionary":9}],7:[function(require,module,exports){
'use strict';

var UrlDictionary = require('../utils/url-dictionary');

module.exports = ['$state', '$location', '$rootScope', function($state, $location, $rootScope) {
  var _url = $location.url();

  // Instance
  var _self = {};

  /**
   * Update URL based on state
   */
  var _update = function() {
    var current = $state.current();

    if(current && current.url) {
      var path;
      path = current.url;

      // Add parameters or use default parameters
      var params = current.params || {};
      var query = {};
      for(var name in params) {
        var re = new RegExp(':'+name, 'g');
        if(path.match(re)) {
          path = path.replace(re, params[name]);
        } else {
          query[name] = params[name];
        }
      }

      $location.path(path);
      $location.search(query);
      
      _url = $location.url();
    }
  };

  /**
   * Update url based on state
   */
  _self.update = function() {
    _update();
  };

  /**
   * Detect URL change and dispatch state change
   */
  _self.location = function() {
    var lastUrl = _url;
    var nextUrl = $location.url();

    if(nextUrl !== lastUrl) {
      _url = nextUrl;

      $state.$location(_url);
      $rootScope.$broadcast('$locationStateUpdate');
    }
  };

  // Register middleware layer
  $state.$use(function(request, next) {
    _update();
    next();
  });

  return _self;
}];

},{"../utils/url-dictionary":9}],8:[function(require,module,exports){
'use strict';

// Parse Object literal name-value pairs
var reParseObjectLiteral = /([,{]\s*(("|')(.*?)\3|\w*)|(:\s*([+-]?(?=\.\d|\d)(?:\d+)?(?:\.?\d*)(?:[eE][+-]?\d+)?|true|false|null|("|')(.*?)\7|\[[^\]]*\])))/g;

// Match Strings
var reString = /^("|')(.*?)\1$/;

// TODO Add escaped string quotes \' and \" to string matcher

// Match Number (int/float/exponential)
var reNumber = /^[+-]?(?=\.\d|\d)(?:\d+)?(?:\.?\d*)(?:[eE][+-]?\d+)?$/;

/**
 * Parse string value into Boolean/Number/Array/String/null.
 *
 * Strings are surrounded by a pair of matching quotes
 * 
 * @param  {String} value A String value to parse
 * @return {Mixed}        A Boolean/Number/Array/String/null
 */
var _resolveValue = function(value) {

  // Boolean: true
  if(value === 'true') {
    return true;

  // Boolean: false
  } else if(value === 'false') {
    return false;

  // Null
  } else if(value === 'null') {
    return null;

  // String
  } else if(value.match(reString)) {
    return value.substr(1, value.length-2);

  // Number
  } else if(value.match(reNumber)) {
    return +value;

  // NaN
  } else if(value === 'NaN') {
    return NaN;

  // TODO add matching with Arrays and parse
  
  }

  // Unable to resolve
  return value;
};

// Find values in an object literal
var _listify = function(str) {

  // Trim
  str = str.replace(/^\s*/, '').replace(/\s*$/, '');

  if(str.match(/^\s*{.*}\s*$/) === null) {
    throw new Error('Parameters expects an Object');
  }

  var sanitizeName = function(name) {
    return name.replace(/^[\{,]?\s*["']?/, '').replace(/["']?\s*$/, '');
  };

  var sanitizeValue = function(value) {
    var str = value.replace(/^(:)?\s*/, '').replace(/\s*$/, '');
    return _resolveValue(str);
  };

  return str.match(reParseObjectLiteral).map(function(item, i, list) {
    return i%2 === 0 ? sanitizeName(item) : sanitizeValue(item);
  });
};

/**
 * Create a params Object from string
 * 
 * @param {String} str A stringified version of Object literal
 */
var Parameters = function(str) {
  str = str || '';

  // Instance
  var _self = {};

  _listify(str).forEach(function(item, i, list) {
    if(i%2 === 0) {
      _self[item] = list[i+1];
    }
  });

  return _self;
};

module.exports = Parameters;

module.exports.resolveValue = _resolveValue;
module.exports.listify = _listify;

},{}],9:[function(require,module,exports){
'use strict';

var Url = require('./url');

/**
 * Constructor
 */
function UrlDictionary() {
  this._patterns = [];
  this._refs = [];
  this._params = [];
}

/**
 * Associate a URL pattern with a reference
 * 
 * @param  {String} pattern A URL pattern
 * @param  {Object} ref     A data Object
 */
UrlDictionary.prototype.add = function(pattern, ref) {
  pattern = pattern || '';
  var _self = this;
  var i = this._patterns.length;

  var pathChain;
  var params = {};

  if(pattern.indexOf('?') === -1) {
    pathChain = Url(pattern).path().split('/');

  } else {
    pathChain = Url(pattern).path().split('/');
  }

  // Start
  var searchExpr = '^';

  // Items
  (pathChain.forEach(function(chunk, i) {
    if(i!==0) {
      searchExpr += '\\/';
    }

    if(chunk[0] === ':') {
      searchExpr += '[^\\/?]*';
      params[chunk.substring(1)] = new RegExp(searchExpr);

    } else {
      searchExpr += chunk;
    }
  }));

  // End
  searchExpr += '[\\/]?$';

  this._patterns[i] = new RegExp(searchExpr);
  this._refs[i] = ref;
  this._params[i] = params;
};

/**
 * Find a reference according to a URL pattern and retrieve params defined in URL
 * 
 * @param  {String} url      A URL to test for
 * @param  {Object} defaults A data Object of default parameter values
 * @return {Object}          A reference to a stored object
 */
UrlDictionary.prototype.lookup = function(url, defaults) {
  url = url || '';
  var p = Url(url).path();
  var q = Url(url).queryparams();

  var _self = this;

  // Check dictionary
  var _findPattern = function(check) {
    check = check || '';
    for(var i=_self._patterns.length-1; i>=0; i--) {
      if(check.match(_self._patterns[i]) !== null) {
        return i;
      }
    }
    return -1;
  };

  var i = _findPattern(p);
  
  // Matching pattern found
  if(i !== -1) {

    // Retrieve params in pattern match
    var params = {};
    for(var n in this._params[i]) {
      var paramParser = this._params[i][n];
      var urlMatch = (url.match(paramParser) || []).pop() || '';
      var varMatch = urlMatch.split('/').pop();
      params[n] = varMatch;
    }

    // Retrieve params in querystring match
    params = angular.extend(q, params);

    return {
      url: url,
      ref: this._refs[i],
      params: params
    };

  // Not in dictionary
  } else {
    return null;
  }
};

module.exports = UrlDictionary;

},{"./url":10}],10:[function(require,module,exports){
'use strict';

function Url(url) {
  url = url || '';

  // Instance
  var _self = {

    /**
     * Get the path of a URL
     * 
     * @return {String}     A querystring from URL
     */
    path: function() {
      return url.indexOf('?') === -1 ? url : url.substring(0, url.indexOf('?'));
    },

    /**
     * Get the querystring of a URL
     * 
     * @return {String}     A querystring from URL
     */
    querystring: function() {
      return url.indexOf('?') === -1 ? '' : url.substring(url.indexOf('?')+1);
    },

    /**
     * Get the querystring of a URL parameters as a hash
     * 
     * @return {String}     A querystring from URL
     */
    queryparams: function() {
      var pairs = _self.querystring().split('&');
      var params = {};

      for(var i=0; i<pairs.length; i++) {
        if(pairs[i] === '') continue;
        var nameValue = pairs[i].split('=');
        params[nameValue[0]] = (typeof nameValue[1] === 'undefined' || nameValue[1] === '') ? true : nameValue[1];
      }

      return params;
    }
  };

  return _self;
}

module.exports = Url;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL2VuYWN0LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvcXVldWUtaGFuZGxlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMv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SUFBSSxNQUFNLElBQUksVUFBVSxHQUFHLElBQUksUUFBUTs7Ozs7Ozs7SUFRdEUsYUFBYSxXQUFXO01BQ3RCLE9BQU8sSUFBSSxRQUFRLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxVQUFVLElBQUksUUFBUSxLQUFLOzs7Ozs7OztJQVF2RSxhQUFhLFdBQVc7TUFDdEIsSUFBSSxRQUFRLE1BQU0sY0FBYyxNQUFNO01BQ3RDLElBQUksU0FBUzs7TUFFYixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxRQUFRLEtBQUs7UUFDaEMsR0FBRyxNQUFNLE9BQU8sSUFBSTtRQUNwQixJQUFJLFlBQVksTUFBTSxHQUFHLE1BQU07UUFDL0IsT0FBTyxVQUFVLE1BQU0sQ0FBQyxPQUFPLFVBQVUsT0FBTyxlQUFlLFVBQVUsT0FBTyxNQUFNLE9BQU8sVUFBVTs7O01BR3pHLE9BQU87Ozs7RUFJWCxPQUFPOzs7QUFHVCxPQUFPLFVBQVU7QUFDakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgZnVuY3Rpb24gKCRzdGF0ZSkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBJbnN0YW50aWF0ZSBtb2R1bGVcbmFuZ3VsYXIubW9kdWxlKCdhbmd1bGFyLXN0YXRlLXJvdXRlcicsIFtdKVxuXG4gIC5wcm92aWRlcignJHN0YXRlJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXInKSlcblxuICAuZmFjdG9yeSgnJHVybE1hbmFnZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3VybC1tYW5hZ2VyJykpXG5cbiAgLmZhY3RvcnkoJyRyZXNvbHV0aW9uJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9yZXNvbHV0aW9uJykpXG5cbiAgLmZhY3RvcnkoJyRlbmFjdCcsIHJlcXVpcmUoJy4vc2VydmljZXMvZW5hY3QnKSlcbiAgXG4gIC5mYWN0b3J5KCckcXVldWVIYW5kbGVyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9xdWV1ZS1oYW5kbGVyJykpXG5cbiAgLnJ1bihbJyRyb290U2NvcGUnLCAnJHN0YXRlJywgJyR1cmxNYW5hZ2VyJywgJyRyZXNvbHV0aW9uJywgJyRlbmFjdCcsIGZ1bmN0aW9uKCRyb290U2NvcGUsICRzdGF0ZSwgJHVybE1hbmFnZXIsICRyZXNvbHV0aW9uLCAkZW5hY3QpIHtcbiAgICAvLyBVcGRhdGUgbG9jYXRpb24gY2hhbmdlc1xuICAgICRyb290U2NvcGUuJG9uKCckbG9jYXRpb25DaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24oKSB7XG4gICAgICAkdXJsTWFuYWdlci5sb2NhdGlvbihhcmd1bWVudHMpO1xuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZVxuICAgICRzdGF0ZS4kcmVhZHkoKTtcbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHEnLCAnJGluamVjdG9yJywgJyRzdGF0ZScsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHEsICRpbmplY3RvciwgJHN0YXRlLCAkcm9vdFNjb3BlKSB7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYWN0aW9uc1xuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgYWN0aW9ucyBBbiBhcnJheSBvZiBhY3Rpb25zIGl0ZW1zXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIGFjdGlvbnMgcHJvY2Vzc2VkXG4gICAqL1xuICB2YXIgX2FjdCA9IGZ1bmN0aW9uKGFjdGlvbnMpIHtcbiAgICB2YXIgYWN0aW9uUHJvbWlzZXMgPSBbXTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChhY3Rpb25zLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIGFjdGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlKTtcbiAgICAgIGFjdGlvblByb21pc2VzLnB1c2goJHEud2hlbihhY3Rpb24pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwoYWN0aW9uUHJvbWlzZXMpO1xuICB9O1xuICBfc2VsZi5wcm9jZXNzID0gX2FjdDtcblxuICAvKipcbiAgICogTWlkZGxld2FyZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlcXVlc3QgQSBkYXRhIE9iamVjdFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gbmV4dCAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX2hhbmRsZSA9IGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZighY3VycmVudCkge1xuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9XG5cbiAgICBfYWN0KGN1cnJlbnQuYWN0aW9ucyB8fCBbXSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgIG5leHQoKTtcblxuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvckFjdGlvbicsIGVycik7XG4gICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcHJvY2Vzc2luZyBzdGF0ZSBhY3Rpb25zJykpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoX2hhbmRsZSwgMTAwKTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRyb290U2NvcGUnLCBmdW5jdGlvbigkcm9vdFNjb3BlKSB7XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSBzZXJpZXMgb2YgZnVuY3Rpb25zOyB1c2VkIGluIHRhbmRlbSB3aXRoIG1pZGRsZXdhcmVcbiAgICovXG4gIHZhciBRdWV1ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBfbGlzdCA9IFtdO1xuICAgIHZhciBfZGF0YSA9IG51bGw7XG5cbiAgICB2YXIgX3NlbGYgPSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogQWRkIGEgaGFuZGxlclxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0ge01peGVkfSAgaGFuZGxlciBBIEZ1bmN0aW9uIG9yIGFuIEFycmF5IG9mIEZ1bmN0aW9ucyB0byBhZGQgdG8gdGhlIHF1ZXVlXG4gICAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIsIHByaW9yaXR5KSB7XG4gICAgICAgIGlmKGhhbmRsZXIgJiYgaGFuZGxlci5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgICBoYW5kbGVyLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgICAgICAgIGxheWVyLnByaW9yaXR5ID0gdHlwZW9mIGxheWVyLnByaW9yaXR5ID09PSAndW5kZWZpbmVkJyA/IDEgOiBsYXllci5wcmlvcml0eTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBfbGlzdCA9IF9saXN0LmNvbmNhdChoYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoYW5kbGVyLnByaW9yaXR5ID0gcHJpb3JpdHkgfHwgKHR5cGVvZiBoYW5kbGVyLnByaW9yaXR5ID09PSAndW5kZWZpbmVkJyA/IDEgOiBoYW5kbGVyLnByaW9yaXR5KTtcbiAgICAgICAgICBfbGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBEYXRhIG9iamVjdFxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBkYXRhIG9iamVjdCBtYWRlIGF2YWlsYWJsZSB0byBlYWNoIGhhbmRsZXJcbiAgICAgICAqIEByZXR1cm4ge1F1ZXVlfSAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBkYXRhOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEJlZ2luIGV4ZWN1dGlvbiBhbmQgdHJpZ2dlciBjYWxsYmFjayBhdCB0aGUgZW5kXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgZXhlY3V0ZTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIG5leHRIYW5kbGVyO1xuICAgICAgICB2YXIgZXhlY3V0aW9uTGlzdCA9IF9saXN0LnNsaWNlKDApLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV4dEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlciA9IGV4ZWN1dGlvbkxpc3Quc2hpZnQoKTtcblxuICAgICAgICAgICAgLy8gQ29tcGxldGVcbiAgICAgICAgICAgIGlmKCFoYW5kbGVyKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuXG4gICAgICAgICAgICAvLyBOZXh0IGhhbmRsZXJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGhhbmRsZXIuY2FsbChudWxsLCBfZGF0YSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgLy8gRXJyb3JcbiAgICAgICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cbiAgICAgICAgICAgICAgICAvLyBDb250aW51ZVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3RhcnRcbiAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgIH1cblxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8vIEluc3RhbmNlXG4gIHJldHVybiB7XG5cbiAgICAvKipcbiAgICAgKiBGYWN0b3J5IG1ldGhvZFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1F1ZXVlfSBBIHF1ZXVlXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBRdWV1ZSgpO1xuICAgIH1cbiAgfTtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHEnLCAnJGluamVjdG9yJywgJyRzdGF0ZScsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHEsICRpbmplY3RvciwgJHN0YXRlLCAkcm9vdFNjb3BlKSB7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFJlc29sdmVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gIHJlc29sdmUgQSBoYXNoIE9iamVjdCBvZiBpdGVtcyB0byByZXNvbHZlXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHRlbXBsYXRlcyByZXRpcmV2ZWRcbiAgICovXG4gIHZhciBfcmVzb2x2ZSA9IGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICB2YXIgcmVzb2x2ZXNQcm9taXNlcyA9IHt9O1xuXG4gICAgYW5ndWxhci5mb3JFYWNoKHJlc29sdmUsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgIHZhciByZXNvbHV0aW9uID0gYW5ndWxhci5pc1N0cmluZyh2YWx1ZSkgPyAkaW5qZWN0b3IuZ2V0KHZhbHVlKSA6ICRpbmplY3Rvci5pbnZva2UodmFsdWUsIG51bGwsIG51bGwsIGtleSk7XG4gICAgICByZXNvbHZlc1Byb21pc2VzW2tleV0gPSAkcS53aGVuKHJlc29sdXRpb24pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuICRxLmFsbChyZXNvbHZlc1Byb21pc2VzKTtcbiAgfTtcbiAgX3NlbGYucmVzb2x2ZSA9IF9yZXNvbHZlO1xuXG4gIC8qKlxuICAgKiBNaWRkbGV3YXJlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcmVxdWVzdCBBIGRhdGEgT2JqZWN0XG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBuZXh0ICAgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICovXG4gIHZhciBfaGFuZGxlID0gZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlKGN1cnJlbnQucmVzb2x2ZSB8fCB7fSkudGhlbihmdW5jdGlvbihsb2NhbHMpIHtcbiAgICAgIGFuZ3VsYXIuZXh0ZW5kKHJlcXVlc3QubG9jYWxzLCBsb2NhbHMpO1xuICAgICAgbmV4dCgpO1xuXG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yUmVzb2x2ZScsIGVycik7XG4gICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcmVzb2x2aW5nIHN0YXRlJykpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoX2hhbmRsZSwgMTAxKTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xudmFyIFBhcmFtZXRlcnMgPSByZXF1aXJlKCcuLi91dGlscy9wYXJhbWV0ZXJzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIFByb3ZpZGVyXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIENvbmZpZ3VyYXRpb24sIGdsb2JhbCBvcHRpb25zXG4gIHZhciBfY29uZmlndXJhdGlvbiA9IHtcbiAgICBoaXN0b3J5TGVuZ3RoOiA1XG4gIH07XG5cbiAgLy8gU3RhdGUgZGVmaW5pdGlvbiBsaWJyYXJ5XG4gIHZhciBfc3RhdGVMaWJyYXJ5ID0ge307XG4gIHZhciBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCB0byBzdGF0ZSBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lUGFyYW1zIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgQSBuYW1lIHN0cmluZyBhbmQgcGFyYW0gT2JqZWN0XG4gICAqL1xuICB2YXIgX3BhcnNlTmFtZSA9IGZ1bmN0aW9uKG5hbWVQYXJhbXMpIHtcbiAgICBpZihuYW1lUGFyYW1zICYmIG5hbWVQYXJhbXMubWF0Y2goL15bYS16QS1aMC05X1xcLl0qXFwoLipcXCkkLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWVQYXJhbXMuc3Vic3RyaW5nKDAsIG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWVQYXJhbXMuc3Vic3RyaW5nKG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKzEsIG5hbWVQYXJhbXMubGFzdEluZGV4T2YoJyknKSkgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbnBhcnQsXG4gICAgICAgIHBhcmFtczogcHBhcnRcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbmFtZVBhcmFtcyxcbiAgICAgICAgcGFyYW1zOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgYSA9IGEgfHwge307XG4gICAgYiA9IGIgfHwge307XG4gICAgcmV0dXJuIGEubmFtZSA9PT0gYi5uYW1lICYmIGFuZ3VsYXIuZXF1YWxzKGEucGFyYW1zLCBiLnBhcmFtcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9zdGF0ZUNhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX3N0YXRlQ2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24obmFtZSwgaSkge1xuICAgICAgICB2YXIgaXRlbSA9IGFuZ3VsYXIuY29weShfc3RhdGVMaWJyYXJ5W25hbWVdKTtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihwYXJlbnQpIHtcbiAgICAgICAgcmV0dXJuICEhcGFyZW50O1xuICAgICAgfSk7XG5cbiAgICAvLyBXYWxrIHVwIGNoZWNraW5nIGluaGVyaXRhbmNlXG4gICAgZm9yKHZhciBpPXN0YXRlQ2hhaW4ubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoc3RhdGVDaGFpbltpXSkge1xuICAgICAgICB2YXIgbmV4dFN0YXRlID0gc3RhdGVDaGFpbltpXTtcbiAgICAgICAgc3RhdGUgPSBhbmd1bGFyLm1lcmdlKG5leHRTdGF0ZSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiBzdGF0ZS5pbmhlcml0ID09PSBmYWxzZSkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfc3RhdGVDYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uLiAgUGFyYW1ldGVycyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gZGF0YSBPYmplY3Qgbm90IHN0YXRlIG5hbWUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfc3RhdGVMaWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICAvLyBSZXNldCBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgICAvLyBVUkwgbWFwcGluZ1xuICAgIGlmKHN0YXRlLnVybCkge1xuICAgICAgX3VybERpY3Rpb25hcnkuYWRkKHN0YXRlLnVybCwgc3RhdGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBkYXRhIHBhcmFtZXRlcnMgZm9yIFN0YXRlUm91dGVyXG4gICAqXG4gICAqIEluY2x1ZGluZyBwYXJhbWV0ZXJzOlxuICAgKiBcbiAgICogLSBoaXN0b3J5TGVuZ3RoICAge051bWJlcn0gRGVmYXVsdHMgdG8gNVxuICAgKiAtIGluaXRpYWxMb2NhdGlvbiB7T2JqZWN0fSBBbiBPYmplY3R7bmFtZTpTdHJpbmcsIHBhcmFtczpPYmplY3R9IGZvciBpbml0aWFsIHN0YXRlIHRyYW5zaXRpb25cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIG9wdGlvbnMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5vcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGFuZ3VsYXIuZXh0ZW5kKF9jb25maWd1cmF0aW9uLCBvcHRpb25zIHx8IHt9KTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgLy8gR2V0XG4gICAgaWYoIXN0YXRlKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cblxuICAgIC8vIFNldFxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG5cbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgaW5pdGlhbGl6YXRpb24gcGFyYW1ldGVyczsgZGVmZXJyZWQgdG8gJHJlYWR5KClcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBuYW1lICAgQSBpbmlpdGFsIHN0YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBwYXJhbXMgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgX2NvbmZpZ3VyYXRpb24uaW5pdGlhbExvY2F0aW9uID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgaW5zdGFuY2VcbiAgICovXG4gIHRoaXMuJGdldCA9IFsnJHJvb3RTY29wZScsICckbG9jYXRpb24nLCAnJHEnLCAnJHF1ZXVlSGFuZGxlcicsIGZ1bmN0aW9uIFN0YXRlUm91dGVyRmFjdG9yeSgkcm9vdFNjb3BlLCAkbG9jYXRpb24sICRxLCAkcXVldWVIYW5kbGVyKSB7XG5cbiAgICAvLyBTdGF0ZVxuICAgIHZhciBfY3VycmVudDtcbiAgICB2YXIgX3RyYW5zaXRpb25RdWV1ZSA9IFtdO1xuICAgIHZhciBfaXNSZWFkeSA9IHRydWU7XG5cbiAgICB2YXIgX29wdGlvbnM7XG4gICAgdmFyIF9pbml0YWxMb2NhdGlvbjtcbiAgICB2YXIgX2hpc3RvcnkgPSBbXTtcbiAgICB2YXIgX2lzSW5pdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9vcHRpb25zLmhpc3RvcnlMZW5ndGggfHwgNTtcblxuICAgICAgaWYoZGF0YSkge1xuICAgICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgbGVuZ3RoXG4gICAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBoaXN0b3J5TGVuZ3RoKSB7XG4gICAgICAgIF9oaXN0b3J5LnNwbGljZSgwLCBfaGlzdG9yeS5sZW5ndGggLSBoaXN0b3J5TGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGZ1bGZpbGwgY2hhbmdlIHN0YXRlIHJlcXVlc3QuICBQYXJhbWV0ZXJzIGluIGBwYXJhbXNgIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBzdGF0ZS1ub3RhdGlvbiBgbmFtZWAgZXhwcmVzc2lvbi4gIFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgIHBhcmFtcyAgIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zLCBjYWxsYmFjaykge1xuICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG5cbiAgICAgICAgLy8gUGFyc2Ugc3RhdGUtbm90YXRpb24gZXhwcmVzc2lvblxuICAgICAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgICAgICBuYW1lID0gbmFtZUV4cHIubmFtZTtcbiAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQobmFtZUV4cHIucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuXG4gICAgICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgICAgIHZhciByZXF1ZXN0ID0ge1xuICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgICAgbG9jYWxzOiB7fVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENvbXBpbGUgZXhlY3V0aW9uIHBoYXNlc1xuICAgICAgICB2YXIgcXVldWUgPSAkcXVldWVIYW5kbGVyLmNyZWF0ZSgpLmRhdGEocmVxdWVzdCk7XG5cbiAgICAgICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShfZ2V0U3RhdGUobmFtZSkpO1xuICAgICAgICB2YXIgcHJldlN0YXRlID0gX2N1cnJlbnQ7XG5cbiAgICAgICAgaWYobmV4dFN0YXRlKSB7XG4gICAgICAgICAgLy8gU2V0IGxvY2Fsc1xuICAgICAgICAgIG5leHRTdGF0ZS5sb2NhbHMgPSByZXF1ZXN0LmxvY2FscztcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgICAgICAgIG5leHRTdGF0ZS5wYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuZXh0U3RhdGUucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRG9lcyBub3QgZXhpc3RcbiAgICAgICAgaWYobmV4dFN0YXRlID09PSBudWxsKSB7XG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3JOb3RGb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoZXJyb3IpO1xuICAgICAgICAgIH0sIDIwMCk7XG5cbiAgICAgICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICAgICAgfSBlbHNlIGlmKF9jb21wYXJlU3RhdGVzKHByZXZTdGF0ZSwgbmV4dFN0YXRlKSkge1xuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9LCAyMDApO1xuICAgICAgICAgIFxuICAgICAgICAvLyBWYWxpZCBzdGF0ZSBleGlzdHNcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgIC8vIFByb2Nlc3Mgc3RhcnRlZFxuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUJlZ2luJywgcmVxdWVzdCk7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSwgMjAxKTtcblxuICAgICAgICAgIC8vIE1ha2Ugc3RhdGUgY2hhbmdlXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgIGlmKHByZXZTdGF0ZSkgX3B1c2hIaXN0b3J5KHByZXZTdGF0ZSk7XG4gICAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0sIDIwMCk7XG5cbiAgICAgICAgICAvLyBBZGQgbWlkZGxld2FyZVxuICAgICAgICAgIHF1ZXVlLmFkZChfbGF5ZXJMaXN0KTtcblxuICAgICAgICAgIC8vIFByb2Nlc3MgZW5kZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFbmQnLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9LCAtMjAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJ1blxuICAgICAgICBxdWV1ZS5leGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcmVxdWVzdCBjaGFuZ2UgdG8gc3RhdGUuICBcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvbiBpbmNsdWRpbmcgb3B0aW9uYWwgcGFyYW1ldGVyc1xuICAgICAqIEBwYXJhbSAge09iamVjdH0gIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIG9jY3Vyc1xuICAgICAqL1xuICAgIHZhciBfcXVldWVDaGFuZ2UgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG4gICAgICB2YXIgZXJyb3I7XG5cbiAgICAgIC8vIFF1ZXVlIHJlcXVlc3RcbiAgICAgIF90cmFuc2l0aW9uUXVldWUucHVzaCh7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICB9KTtcblxuICAgICAgLy8gSGFuZGxlIG5leHQgcmVxdWVzdFxuICAgICAgdmFyIG5leHRSZXF1ZXN0O1xuICAgICAgbmV4dFJlcXVlc3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYoIV9pc1JlYWR5KSByZXR1cm47XG4gICAgICAgIHZhciByZXF1ZXN0ID0gX3RyYW5zaXRpb25RdWV1ZS5zaGlmdCgpO1xuXG4gICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgIGlmKHJlcXVlc3QpIHtcbiAgICAgICAgICBfaXNSZWFkeSA9IGZhbHNlO1xuXG4gICAgICAgICAgX2NoYW5nZVN0YXRlKHJlcXVlc3QubmFtZSwgcmVxdWVzdC5wYXJhbXMsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgX2lzUmVhZHkgPSB0cnVlO1xuXG4gICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvcicsIGVyciwgcmVxdWVzdCk7XG4gICAgICAgICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXh0UmVxdWVzdCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEVuZFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgIH07XG5cbiAgICAgIG5leHRSZXF1ZXN0KCk7XG5cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHRvIHN0YXRlIGFuZCBicm9hZGNhc3QgY29tcGxldGlvblxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICovXG4gICAgdmFyIF9xdWV1ZVN0YXRlQW5kQnJvYWRjYXN0Q29tcGxldGUgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgIHJldHVybiBfcXVldWVDaGFuZ2UobmFtZSwgcGFyYW1zKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUNvbXBsZXRlJywgbnVsbCwgX2N1cnJlbnQpO1xuICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlQ29tcGxldGUnLCBlcnIsIF9jdXJyZW50KTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZWxvYWRzIHRoZSBjdXJyZW50IHN0YXRlXG4gICAgICogXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgKi9cbiAgICB2YXIgX3JlbG9hZFN0YXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbiA9IF9jdXJyZW50Lm5hbWU7XG4gICAgICB2YXIgcCA9IGFuZ3VsYXIuY29weShfY3VycmVudC5wYXJhbXMpO1xuICAgICAgaWYoIV9jdXJyZW50LnBhcmFtcykge1xuICAgICAgICBfY3VycmVudC5wYXJhbXMgPSB7fTtcbiAgICAgIH1cbiAgICAgIF9jdXJyZW50LnBhcmFtcy5kZXByZWNhdGVkID0gdHJ1ZTtcblxuICAgICAgLy8gTm90aWZ5XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZVJlbG9hZCcsIG51bGwsIF9jdXJyZW50KTtcblxuICAgICAgcmV0dXJuIF9xdWV1ZVN0YXRlQW5kQnJvYWRjYXN0Q29tcGxldGUobiwgcCk7XG4gICAgfTtcblxuICAgIC8vIEluc3RhbmNlXG4gICAgdmFyIF9pbnN0O1xuICAgIF9pbnN0ID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBvcHRpb25zXG4gICAgICAgKlxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvbmZpZ3VyZWQgb3B0aW9uc1xuICAgICAgICovXG4gICAgICBvcHRpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gSGFzbid0IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9vcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQvZ2V0IHN0YXRlLiBSZWxvYWRzIHN0YXRlIGlmIGN1cnJlbnQgc3RhdGUgaXMgYWZmZWN0ZWQgYnkgZGVmaW5lZCBcbiAgICAgICAqIHN0YXRlICh3aGVuIHJlZGVmaW5pbmcgcGFyZW50IG9yIGN1cnJlbnQgc3RhdGUpXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBzdGF0ZTogZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICAgICAgLy8gR2V0XG4gICAgICAgIGlmKCFzdGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXRcbiAgICAgICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcblxuICAgICAgICAvLyBSZWxvYWQgd2hlbiBjdXJyZW50IGFmZmVjdGVkXG4gICAgICAgIGlmKCEhX2N1cnJlbnQpIHtcbiAgICAgICAgICB2YXIgbmFtZUNoYWluID0gX2dldE5hbWVDaGFpbihfY3VycmVudC5uYW1lKTtcbiAgICAgICAgICBpZihuYW1lQ2hhaW4uaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIF9yZWxvYWRTdGF0ZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBtaWRkbGV3YXJlOyBjYWxsZWQgZHVyaW5nIHN0YXRlIHRyYW5zaXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259IGhhbmRsZXIgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpXG4gICAgICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICAgcHJpb3JpdHkgQSBudW1iZXIgZGVub3RpbmcgcHJpb3JpdHlcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkdXNlOiBmdW5jdGlvbihoYW5kbGVyLCBwcmlvcml0eSkge1xuICAgICAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgcHJpb3JpdHkgIT09ICd1bmRlZmluZWQnKSBoYW5kbGVyLnByaW9yaXR5ID0gcHJpb3JpdHk7XG4gICAgICAgIF9sYXllckxpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcGVyZm9ybSBpbml0aWFsaXphdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRyZWFkeTogZnVuY3Rpb24oKSB7XG4gICAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZighX2lzSW5pdCkge1xuICAgICAgICAgICAgX2lzSW5pdCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIENvbmZpZ3VyYXRpb25cbiAgICAgICAgICAgIGlmKCFfb3B0aW9ucykge1xuICAgICAgICAgICAgICBfb3B0aW9ucyA9IGFuZ3VsYXIuY29weShfY29uZmlndXJhdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICAgIGlmKF9vcHRpb25zLmhhc093blByb3BlcnR5KCdpbml0aWFsTG9jYXRpb24nKSkge1xuICAgICAgICAgICAgICBfaW5pdGFsTG9jYXRpb24gPSBhbmd1bGFyLmNvcHkoX29wdGlvbnMuaW5pdGlhbExvY2F0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlYWR5RGVmZXJyZWQgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgICBpZigkbG9jYXRpb24udXJsKCkgIT09ICcnKSB7XG4gICAgICAgICAgICAgIHJlYWR5RGVmZXJyZWQgPSBfaW5zdC4kbG9jYXRpb24oJGxvY2F0aW9uLnVybCgpKTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICAgICAgICB9IGVsc2UgaWYoX2luaXRhbExvY2F0aW9uKSB7XG4gICAgICAgICAgICAgIHJlYWR5RGVmZXJyZWQgPSBfcXVldWVTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlKF9pbml0YWxMb2NhdGlvbi5uYW1lLCBfaW5pdGFsTG9jYXRpb24ucGFyYW1zKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJHEud2hlbihyZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUluaXQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLy8gUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICAgIHBhcnNlOiBfcGFyc2VOYW1lLFxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIGFsbCBkZWZpbmVkIHN0YXRlc1xuICAgICAgICovXG4gICAgICBsaWJyYXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9zdGF0ZUxpYnJhcnk7XG4gICAgICB9LFxuXG4gICAgICAvLyBWYWxpZGF0aW9uXG4gICAgICB2YWxpZGF0ZToge1xuICAgICAgICBuYW1lOiBfdmFsaWRhdGVTdGF0ZU5hbWUsXG4gICAgICAgIHF1ZXJ5OiBfdmFsaWRhdGVTdGF0ZVF1ZXJ5XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGhpc3RvcnlcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXG4gICAgICAgKi9cbiAgICAgIGhpc3Rvcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX2hpc3Rvcnk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlcXVlc3Qgc3RhdGUgdHJhbnNpdGlvbiwgYXN5bmNocm9ub3VzIG9wZXJhdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIGNvbXBsZXRlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBfcXVldWVTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlKG5hbWUsIHBhcmFtcyk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlbG9hZHMgdGhlIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgICAqL1xuICAgICAgcmVsb2FkOiBfcmVsb2FkU3RhdGUsXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgdmFyIHN0YXRlID0gZGF0YS5yZWY7XG5cbiAgICAgICAgICBpZihzdGF0ZSkge1xuICAgICAgICAgICAgLy8gUGFyc2UgcGFyYW1zIGZyb20gdXJsXG4gICAgICAgICAgICByZXR1cm4gX3F1ZXVlU3RhdGVBbmRCcm9hZGNhc3RDb21wbGV0ZShzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYoISF1cmwgJiYgdXJsICE9PSAnJykge1xuICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yTm90Rm91bmQnLCBlcnJvciwge1xuICAgICAgICAgICAgdXJsOiB1cmxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAkcS5yZWplY3QobmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBsb2NhdGlvbiBpbiBsaWJyYXJ5JykpO1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgLyoqXG4gICAgICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBjdXJyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICghX2N1cnJlbnQpID8gbnVsbCA6IGFuZ3VsYXIuY29weShfY3VycmVudCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENoZWNrIHF1ZXJ5IGFnYWluc3QgY3VycmVudCBzdGF0ZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgIEEgdHJ1ZSBpZiBzdGF0ZSBpcyBwYXJlbnQgdG8gY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBhY3RpdmU6IGZ1bmN0aW9uKHF1ZXJ5LCBwYXJhbXMpIHtcbiAgICAgICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICAgICAgXG4gICAgICAgIC8vIE5vIHN0YXRlXG4gICAgICAgIGlmKCFfY3VycmVudCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgICAgIH0gZWxzZSBpZihxdWVyeSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gocXVlcnkpO1xuXG4gICAgICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgICAgIH0gZWxzZSBpZih0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKSB7XG5cbiAgICAgICAgICAvLyBDYXN0IHN0cmluZyB0byBSZWdFeHBcbiAgICAgICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgICAgICB2YXIgY2FzdGVkID0gcXVlcnkuc3Vic3RyKDEsIHF1ZXJ5Lmxlbmd0aC0yKTtcbiAgICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cChjYXN0ZWQpKTtcblxuICAgICAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSBxdWVyeVxuICAgICAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtID09PSAnKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9dKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKGl0ZW0gPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9cXFxcLl0qJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKHRyYW5zZm9ybWVkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm9uLW1hdGNoaW5nXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIF9pbnN0O1xuICB9XTtcblxufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsICckbG9jYXRpb24nLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCRzdGF0ZSwgJGxvY2F0aW9uLCAkcm9vdFNjb3BlKSB7XG4gIHZhciBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgVVJMIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICB2YXIgX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKGN1cnJlbnQgJiYgY3VycmVudC51cmwpIHtcbiAgICAgIHZhciBwYXRoO1xuICAgICAgcGF0aCA9IGN1cnJlbnQudXJsO1xuXG4gICAgICAvLyBBZGQgcGFyYW1ldGVycyBvciB1c2UgZGVmYXVsdCBwYXJhbWV0ZXJzXG4gICAgICB2YXIgcGFyYW1zID0gY3VycmVudC5wYXJhbXMgfHwge307XG4gICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgIGZvcih2YXIgbmFtZSBpbiBwYXJhbXMpIHtcbiAgICAgICAgdmFyIHJlID0gbmV3IFJlZ0V4cCgnOicrbmFtZSwgJ2cnKTtcbiAgICAgICAgaWYocGF0aC5tYXRjaChyZSkpIHtcbiAgICAgICAgICBwYXRoID0gcGF0aC5yZXBsYWNlKHJlLCBwYXJhbXNbbmFtZV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHF1ZXJ5W25hbWVdID0gcGFyYW1zW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgICRsb2NhdGlvbi5wYXRoKHBhdGgpO1xuICAgICAgJGxvY2F0aW9uLnNlYXJjaChxdWVyeSk7XG4gICAgICBcbiAgICAgIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIERldGVjdCBVUkwgY2hhbmdlIGFuZCBkaXNwYXRjaCBzdGF0ZSBjaGFuZ2VcbiAgICovXG4gIF9zZWxmLmxvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxhc3RVcmwgPSBfdXJsO1xuICAgIHZhciBuZXh0VXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gICAgaWYobmV4dFVybCAhPT0gbGFzdFVybCkge1xuICAgICAgX3VybCA9IG5leHRVcmw7XG5cbiAgICAgICRzdGF0ZS4kbG9jYXRpb24oX3VybCk7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRsb2NhdGlvblN0YXRlVXBkYXRlJyk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIF91cGRhdGUoKTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBQYXJzZSBPYmplY3QgbGl0ZXJhbCBuYW1lLXZhbHVlIHBhaXJzXG52YXIgcmVQYXJzZU9iamVjdExpdGVyYWwgPSAvKFsse11cXHMqKChcInwnKSguKj8pXFwzfFxcdyopfCg6XFxzKihbKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/fHRydWV8ZmFsc2V8bnVsbHwoXCJ8JykoLio/KVxcN3xcXFtbXlxcXV0qXFxdKSkpL2c7XG5cbi8vIE1hdGNoIFN0cmluZ3NcbnZhciByZVN0cmluZyA9IC9eKFwifCcpKC4qPylcXDEkLztcblxuLy8gVE9ETyBBZGQgZXNjYXBlZCBzdHJpbmcgcXVvdGVzIFxcJyBhbmQgXFxcIiB0byBzdHJpbmcgbWF0Y2hlclxuXG4vLyBNYXRjaCBOdW1iZXIgKGludC9mbG9hdC9leHBvbmVudGlhbClcbnZhciByZU51bWJlciA9IC9eWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspPyQvO1xuXG4vKipcbiAqIFBhcnNlIHN0cmluZyB2YWx1ZSBpbnRvIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsLlxuICpcbiAqIFN0cmluZ3MgYXJlIHN1cnJvdW5kZWQgYnkgYSBwYWlyIG9mIG1hdGNoaW5nIHF1b3Rlc1xuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHZhbHVlIEEgU3RyaW5nIHZhbHVlIHRvIHBhcnNlXG4gKiBAcmV0dXJuIHtNaXhlZH0gICAgICAgIEEgQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGxcbiAqL1xudmFyIF9yZXNvbHZlVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXG4gIC8vIEJvb2xlYW46IHRydWVcbiAgaWYodmFsdWUgPT09ICd0cnVlJykge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIC8vIEJvb2xlYW46IGZhbHNlXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ2ZhbHNlJykge1xuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBOdWxsXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ251bGwnKSB7XG4gICAgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RyaW5nXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZVN0cmluZykpIHtcbiAgICByZXR1cm4gdmFsdWUuc3Vic3RyKDEsIHZhbHVlLmxlbmd0aC0yKTtcblxuICAvLyBOdW1iZXJcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlTnVtYmVyKSkge1xuICAgIHJldHVybiArdmFsdWU7XG5cbiAgLy8gTmFOXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ05hTicpIHtcbiAgICByZXR1cm4gTmFOO1xuXG4gIC8vIFRPRE8gYWRkIG1hdGNoaW5nIHdpdGggQXJyYXlzIGFuZCBwYXJzZVxuICBcbiAgfVxuXG4gIC8vIFVuYWJsZSB0byByZXNvbHZlXG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIEZpbmQgdmFsdWVzIGluIGFuIG9iamVjdCBsaXRlcmFsXG52YXIgX2xpc3RpZnkgPSBmdW5jdGlvbihzdHIpIHtcblxuICAvLyBUcmltXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcblxuICBpZihzdHIubWF0Y2goL15cXHMqey4qfVxccyokLykgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhcmFtZXRlcnMgZXhwZWN0cyBhbiBPYmplY3QnKTtcbiAgfVxuXG4gIHZhciBzYW5pdGl6ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvXltcXHssXT9cXHMqW1wiJ10/LywgJycpLnJlcGxhY2UoL1tcIiddP1xccyokLywgJycpO1xuICB9O1xuXG4gIHZhciBzYW5pdGl6ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc3RyID0gdmFsdWUucmVwbGFjZSgvXig6KT9cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuICAgIHJldHVybiBfcmVzb2x2ZVZhbHVlKHN0cik7XG4gIH07XG5cbiAgcmV0dXJuIHN0ci5tYXRjaChyZVBhcnNlT2JqZWN0TGl0ZXJhbCkubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICByZXR1cm4gaSUyID09PSAwID8gc2FuaXRpemVOYW1lKGl0ZW0pIDogc2FuaXRpemVWYWx1ZShpdGVtKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIHBhcmFtcyBPYmplY3QgZnJvbSBzdHJpbmdcbiAqIFxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBBIHN0cmluZ2lmaWVkIHZlcnNpb24gb2YgT2JqZWN0IGxpdGVyYWxcbiAqL1xudmFyIFBhcmFtZXRlcnMgPSBmdW5jdGlvbihzdHIpIHtcbiAgc3RyID0gc3RyIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIF9saXN0aWZ5KHN0cikuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgaWYoaSUyID09PSAwKSB7XG4gICAgICBfc2VsZltpdGVtXSA9IGxpc3RbaSsxXTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyYW1ldGVycztcblxubW9kdWxlLmV4cG9ydHMucmVzb2x2ZVZhbHVlID0gX3Jlc29sdmVWYWx1ZTtcbm1vZHVsZS5leHBvcnRzLmxpc3RpZnkgPSBfbGlzdGlmeTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybCA9IHJlcXVpcmUoJy4vdXJsJyk7XG5cbi8qKlxuICogQ29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVXJsRGljdGlvbmFyeSgpIHtcbiAgdGhpcy5fcGF0dGVybnMgPSBbXTtcbiAgdGhpcy5fcmVmcyA9IFtdO1xuICB0aGlzLl9wYXJhbXMgPSBbXTtcbn1cblxuLyoqXG4gKiBBc3NvY2lhdGUgYSBVUkwgcGF0dGVybiB3aXRoIGEgcmVmZXJlbmNlXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gcGF0dGVybiBBIFVSTCBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHJlZiAgICAgQSBkYXRhIE9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihwYXR0ZXJuLCByZWYpIHtcbiAgcGF0dGVybiA9IHBhdHRlcm4gfHwgJyc7XG4gIHZhciBfc2VsZiA9IHRoaXM7XG4gIHZhciBpID0gdGhpcy5fcGF0dGVybnMubGVuZ3RoO1xuXG4gIHZhciBwYXRoQ2hhaW47XG4gIHZhciBwYXJhbXMgPSB7fTtcblxuICBpZihwYXR0ZXJuLmluZGV4T2YoJz8nKSA9PT0gLTEpIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG5cbiAgfSBlbHNlIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG4gIH1cblxuICAvLyBTdGFydFxuICB2YXIgc2VhcmNoRXhwciA9ICdeJztcblxuICAvLyBJdGVtc1xuICAocGF0aENoYWluLmZvckVhY2goZnVuY3Rpb24oY2h1bmssIGkpIHtcbiAgICBpZihpIT09MCkge1xuICAgICAgc2VhcmNoRXhwciArPSAnXFxcXC8nO1xuICAgIH1cblxuICAgIGlmKGNodW5rWzBdID09PSAnOicpIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1teXFxcXC8/XSonO1xuICAgICAgcGFyYW1zW2NodW5rLnN1YnN0cmluZygxKV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gY2h1bms7XG4gICAgfVxuICB9KSk7XG5cbiAgLy8gRW5kXG4gIHNlYXJjaEV4cHIgKz0gJ1tcXFxcL10/JCc7XG5cbiAgdGhpcy5fcGF0dGVybnNbaV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuICB0aGlzLl9yZWZzW2ldID0gcmVmO1xuICB0aGlzLl9wYXJhbXNbaV0gPSBwYXJhbXM7XG59O1xuXG4vKipcbiAqIEZpbmQgYSByZWZlcmVuY2UgYWNjb3JkaW5nIHRvIGEgVVJMIHBhdHRlcm4gYW5kIHJldHJpZXZlIHBhcmFtcyBkZWZpbmVkIGluIFVSTFxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgIEEgVVJMIHRvIHRlc3QgZm9yXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRlZmF1bHRzIEEgZGF0YSBPYmplY3Qgb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIEEgcmVmZXJlbmNlIHRvIGEgc3RvcmVkIG9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbih1cmwsIGRlZmF1bHRzKSB7XG4gIHVybCA9IHVybCB8fCAnJztcbiAgdmFyIHAgPSBVcmwodXJsKS5wYXRoKCk7XG4gIHZhciBxID0gVXJsKHVybCkucXVlcnlwYXJhbXMoKTtcblxuICB2YXIgX3NlbGYgPSB0aGlzO1xuXG4gIC8vIENoZWNrIGRpY3Rpb25hcnlcbiAgdmFyIF9maW5kUGF0dGVybiA9IGZ1bmN0aW9uKGNoZWNrKSB7XG4gICAgY2hlY2sgPSBjaGVjayB8fCAnJztcbiAgICBmb3IodmFyIGk9X3NlbGYuX3BhdHRlcm5zLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKGNoZWNrLm1hdGNoKF9zZWxmLl9wYXR0ZXJuc1tpXSkgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICB2YXIgaSA9IF9maW5kUGF0dGVybihwKTtcbiAgXG4gIC8vIE1hdGNoaW5nIHBhdHRlcm4gZm91bmRcbiAgaWYoaSAhPT0gLTEpIHtcblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBwYXR0ZXJuIG1hdGNoXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xuICAgIGZvcih2YXIgbiBpbiB0aGlzLl9wYXJhbXNbaV0pIHtcbiAgICAgIHZhciBwYXJhbVBhcnNlciA9IHRoaXMuX3BhcmFtc1tpXVtuXTtcbiAgICAgIHZhciB1cmxNYXRjaCA9ICh1cmwubWF0Y2gocGFyYW1QYXJzZXIpIHx8IFtdKS5wb3AoKSB8fCAnJztcbiAgICAgIHZhciB2YXJNYXRjaCA9IHVybE1hdGNoLnNwbGl0KCcvJykucG9wKCk7XG4gICAgICBwYXJhbXNbbl0gPSB2YXJNYXRjaDtcbiAgICB9XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcXVlcnlzdHJpbmcgbWF0Y2hcbiAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChxLCBwYXJhbXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgcmVmOiB0aGlzLl9yZWZzW2ldLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuXG4gIC8vIE5vdCBpbiBkaWN0aW9uYXJ5XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsRGljdGlvbmFyeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVXJsKHVybCkge1xuICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwYXRoIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHBhdGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gdXJsIDogdXJsLnN1YnN0cmluZygwLCB1cmwuaW5kZXhPZignPycpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXN0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnJyA6IHVybC5zdWJzdHJpbmcodXJsLmluZGV4T2YoJz8nKSsxKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTCBwYXJhbWV0ZXJzIGFzIGEgaGFzaFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXBhcmFtczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGFpcnMgPSBfc2VsZi5xdWVyeXN0cmluZygpLnNwbGl0KCcmJyk7XG4gICAgICB2YXIgcGFyYW1zID0ge307XG5cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBhaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHBhaXJzW2ldID09PSAnJykgY29udGludWU7XG4gICAgICAgIHZhciBuYW1lVmFsdWUgPSBwYWlyc1tpXS5zcGxpdCgnPScpO1xuICAgICAgICBwYXJhbXNbbmFtZVZhbHVlWzBdXSA9ICh0eXBlb2YgbmFtZVZhbHVlWzFdID09PSAndW5kZWZpbmVkJyB8fCBuYW1lVmFsdWVbMV0gPT09ICcnKSA/IHRydWUgOiBuYW1lVmFsdWVbMV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBfc2VsZjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmw7XG4iXX0=
