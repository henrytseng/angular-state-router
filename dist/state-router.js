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

    $urlManager.$ready();
    $resolution.$ready();
    $enact.$ready();

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
   * Register middleware layer
   */
  _self.$ready = function() {

    $state.$use(function(request, next) {
      var current = $state.current();

      if(!current) {
        return next();
      }

      $rootScope.$broadcast('$stateActionBegin');

      _act(current.actions || []).then(function() {
        $rootScope.$broadcast('$stateActionEnd');
        next();

      }, function(err) {
        $rootScope.$broadcast('$stateActionError', err);
        next(new Error('Error processing state actions'));
      });
    }, 100);

  };

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
   * Register middleware layer
   */
  _self.$ready = function() {

    $state.$use(function(request, next) {
      var current = $state.current();

      if(!current) {
        return next();
      }

      $rootScope.$broadcast('$stateResolveBegin');

      _resolve(current.resolve || {}).then(function(locals) {
        angular.extend(request.locals, locals);
        $rootScope.$broadcast('$stateResolveEnd');
        next();

      }, function(err) {
        $rootScope.$broadcast('$stateResolveError', err);
        next(new Error('Error resolving state'));
      });
    }, 101);
    
  };

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
     * @return {Promise}           A promise fulfilled when state change occurs
     */
    var _changeState = function(name, params) {
      var deferred = $q.defer();

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
          locals: {},
          promise: deferred.promise
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
        queue.execute(function(err) {
          if(err) {
            $rootScope.$broadcast('$stateChangeError', err, request);
            deferred.reject(err);
          } else {
            deferred.resolve();
          }
        });
      });

      return deferred.promise;
    };

    /**
     * Internal method to change to state and broadcast completion
     * 
     * @param  {String}  name   A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}  params A data object of params
     * @return {Promise}        A promise fulfilled when state change occurs
     */
    var _changeStateAndBroadcastComplete = function(name, params) {
      return _changeState(name, params).then(function() {
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
      var deferred = $q.defer();

      $rootScope.$evalAsync(function() {
        var n = _current.name;
        var p = angular.copy(_current.params);
        if(!_current.params) {
          _current.params = {};
        }
        _current.params.deprecated = true;

        // Notify
        $rootScope.$broadcast('$stateReload', null, _current);

        _changeStateAndBroadcastComplete(n, p).then(function() {
          deferred.resolve();
        }, function(err) {
          deferred.reject(err);
        });
      });

      return deferred.promise;
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
              readyDeferred = _changeStateAndBroadcastComplete(_initalLocation.name, _initalLocation.params);
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
        return _changeStateAndBroadcastComplete(name, params);
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
            return _changeStateAndBroadcastComplete(state.name, data.params);
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

  /**
   * Register middleware layer
   */
  _self.$ready = function() {

    $state.$use(function(request, next) {
      _update();
      next();
    });
    
  };


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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL2VuYWN0LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvcXVldWUtaGFuZGxlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMv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Ozs7Ozs7OztJQVF2RSxhQUFhLFdBQVc7TUFDdEIsSUFBSSxRQUFRLE1BQU0sY0FBYyxNQUFNO01BQ3RDLElBQUksU0FBUzs7TUFFYixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxRQUFRLEtBQUs7UUFDaEMsR0FBRyxNQUFNLE9BQU8sSUFBSTtRQUNwQixJQUFJLFlBQVksTUFBTSxHQUFHLE1BQU07UUFDL0IsT0FBTyxVQUFVLE1BQU0sQ0FBQyxPQUFPLFVBQVUsT0FBTyxlQUFlLFVBQVUsT0FBTyxNQUFNLE9BQU8sVUFBVTs7O01BR3pHLE9BQU87Ozs7RUFJWCxPQUFPOzs7QUFHVCxPQUFPLFVBQVU7QUFDakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgZnVuY3Rpb24gKCRzdGF0ZSkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBJbnN0YW50aWF0ZSBtb2R1bGVcbmFuZ3VsYXIubW9kdWxlKCdhbmd1bGFyLXN0YXRlLXJvdXRlcicsIFtdKVxuXG4gIC5wcm92aWRlcignJHN0YXRlJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXInKSlcblxuICAuZmFjdG9yeSgnJHVybE1hbmFnZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3VybC1tYW5hZ2VyJykpXG5cbiAgLmZhY3RvcnkoJyRyZXNvbHV0aW9uJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9yZXNvbHV0aW9uJykpXG5cbiAgLmZhY3RvcnkoJyRlbmFjdCcsIHJlcXVpcmUoJy4vc2VydmljZXMvZW5hY3QnKSlcbiAgXG4gIC5mYWN0b3J5KCckcXVldWVIYW5kbGVyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9xdWV1ZS1oYW5kbGVyJykpXG5cbiAgLnJ1bihbJyRyb290U2NvcGUnLCAnJHN0YXRlJywgJyR1cmxNYW5hZ2VyJywgJyRyZXNvbHV0aW9uJywgJyRlbmFjdCcsIGZ1bmN0aW9uKCRyb290U2NvcGUsICRzdGF0ZSwgJHVybE1hbmFnZXIsICRyZXNvbHV0aW9uLCAkZW5hY3QpIHtcbiAgICAvLyBVcGRhdGUgbG9jYXRpb24gY2hhbmdlc1xuICAgICRyb290U2NvcGUuJG9uKCckbG9jYXRpb25DaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24oKSB7XG4gICAgICAkdXJsTWFuYWdlci5sb2NhdGlvbihhcmd1bWVudHMpO1xuICAgIH0pO1xuXG4gICAgJHVybE1hbmFnZXIuJHJlYWR5KCk7XG4gICAgJHJlc29sdXRpb24uJHJlYWR5KCk7XG4gICAgJGVuYWN0LiRyZWFkeSgpO1xuXG4gICAgLy8gSW5pdGlhbGl6ZVxuICAgICRzdGF0ZS4kcmVhZHkoKTtcblxuICB9XSlcblxuICAuZGlyZWN0aXZlKCdzcmVmJywgcmVxdWlyZSgnLi9kaXJlY3RpdmVzL3NyZWYnKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcScsICckaW5qZWN0b3InLCAnJHN0YXRlJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbigkcSwgJGluamVjdG9yLCAkc3RhdGUsICRyb290U2NvcGUpIHtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICAvKipcbiAgICogUHJvY2VzcyBhY3Rpb25zXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBhY3Rpb25zIEFuIGFycmF5IG9mIGFjdGlvbnMgaXRlbXNcbiAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gYWN0aW9ucyBwcm9jZXNzZWRcbiAgICovXG4gIHZhciBfYWN0ID0gZnVuY3Rpb24oYWN0aW9ucykge1xuICAgIHZhciBhY3Rpb25Qcm9taXNlcyA9IFtdO1xuXG4gICAgYW5ndWxhci5mb3JFYWNoKGFjdGlvbnMsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YXIgYWN0aW9uID0gYW5ndWxhci5pc1N0cmluZyh2YWx1ZSkgPyAkaW5qZWN0b3IuZ2V0KHZhbHVlKSA6ICRpbmplY3Rvci5pbnZva2UodmFsdWUpO1xuICAgICAgYWN0aW9uUHJvbWlzZXMucHVzaCgkcS53aGVuKGFjdGlvbikpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuICRxLmFsbChhY3Rpb25Qcm9taXNlcyk7XG4gIH07XG4gIF9zZWxmLnByb2Nlc3MgPSBfYWN0O1xuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICAqL1xuICBfc2VsZi4kcmVhZHkgPSBmdW5jdGlvbigpIHtcblxuICAgICRzdGF0ZS4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgICAgaWYoIWN1cnJlbnQpIHtcbiAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgIH1cblxuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVBY3Rpb25CZWdpbicpO1xuXG4gICAgICBfYWN0KGN1cnJlbnQuYWN0aW9ucyB8fCBbXSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVBY3Rpb25FbmQnKTtcbiAgICAgICAgbmV4dCgpO1xuXG4gICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVBY3Rpb25FcnJvcicsIGVycik7XG4gICAgICAgIG5leHQobmV3IEVycm9yKCdFcnJvciBwcm9jZXNzaW5nIHN0YXRlIGFjdGlvbnMnKSk7XG4gICAgICB9KTtcbiAgICB9LCAxMDApO1xuXG4gIH07XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHJvb3RTY29wZSkge1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgc2VyaWVzIG9mIGZ1bmN0aW9uczsgdXNlZCBpbiB0YW5kZW0gd2l0aCBtaWRkbGV3YXJlXG4gICAqL1xuICB2YXIgUXVldWUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2xpc3QgPSBbXTtcbiAgICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gICAgdmFyIF9zZWxmID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEFkZCBhIGhhbmRsZXJcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtIHtNaXhlZH0gIGhhbmRsZXIgQSBGdW5jdGlvbiBvciBhbiBBcnJheSBvZiBGdW5jdGlvbnMgdG8gYWRkIHRvIHRoZSBxdWV1ZVxuICAgICAgICogQHJldHVybiB7UXVldWV9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgYWRkOiBmdW5jdGlvbihoYW5kbGVyLCBwcmlvcml0eSkge1xuICAgICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgaGFuZGxlci5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICAgICAgICBsYXllci5wcmlvcml0eSA9IHR5cGVvZiBsYXllci5wcmlvcml0eSA9PT0gJ3VuZGVmaW5lZCcgPyAxIDogbGF5ZXIucHJpb3JpdHk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFuZGxlci5wcmlvcml0eSA9IHByaW9yaXR5IHx8ICh0eXBlb2YgaGFuZGxlci5wcmlvcml0eSA9PT0gJ3VuZGVmaW5lZCcgPyAxIDogaGFuZGxlci5wcmlvcml0eSk7XG4gICAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogRGF0YSBvYmplY3RcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgZGF0YSBvYmplY3QgbWFkZSBhdmFpbGFibGUgdG8gZWFjaCBoYW5kbGVyXG4gICAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgZGF0YTogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBfZGF0YSA9IGRhdGE7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBCZWdpbiBleGVjdXRpb24gYW5kIHRyaWdnZXIgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7UXVldWV9ICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgICAgdmFyIGV4ZWN1dGlvbkxpc3QgPSBfbGlzdC5zbGljZSgwKS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5KSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSBleGVjdXRpb25MaXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgICAgIC8vIENvbXBsZXRlXG4gICAgICAgICAgICBpZighaGFuZGxlcikge1xuICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcblxuICAgICAgICAgICAgLy8gTmV4dCBoYW5kbGVyXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN0YXJ0XG4gICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICB9XG5cbiAgICB9O1xuICAgIFxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvLyBJbnN0YW5jZVxuICByZXR1cm4ge1xuXG4gICAgLyoqXG4gICAgICogRmFjdG9yeSBtZXRob2RcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gQSBxdWV1ZVxuICAgICAqL1xuICAgIGNyZWF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gUXVldWUoKTtcbiAgICB9XG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRxJywgJyRpbmplY3RvcicsICckc3RhdGUnLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCRxLCAkaW5qZWN0b3IsICRzdGF0ZSwgJHJvb3RTY29wZSkge1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICByZXNvbHZlIEEgaGFzaCBPYmplY3Qgb2YgaXRlbXMgdG8gcmVzb2x2ZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0ZW1wbGF0ZXMgcmV0aXJldmVkXG4gICAqL1xuICB2YXIgX3Jlc29sdmUgPSBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgdmFyIHJlc29sdmVzUHJvbWlzZXMgPSB7fTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvbHZlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlLCBudWxsLCBudWxsLCBrZXkpO1xuICAgICAgcmVzb2x2ZXNQcm9taXNlc1trZXldID0gJHEud2hlbihyZXNvbHV0aW9uKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwocmVzb2x2ZXNQcm9taXNlcyk7XG4gIH07XG4gIF9zZWxmLnJlc29sdmUgPSBfcmVzb2x2ZTtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAgKi9cbiAgX3NlbGYuJHJlYWR5ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgICB9XG5cbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlUmVzb2x2ZUJlZ2luJyk7XG5cbiAgICAgIF9yZXNvbHZlKGN1cnJlbnQucmVzb2x2ZSB8fCB7fSkudGhlbihmdW5jdGlvbihsb2NhbHMpIHtcbiAgICAgICAgYW5ndWxhci5leHRlbmQocmVxdWVzdC5sb2NhbHMsIGxvY2Fscyk7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlUmVzb2x2ZUVuZCcpO1xuICAgICAgICBuZXh0KCk7XG5cbiAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZVJlc29sdmVFcnJvcicsIGVycik7XG4gICAgICAgIG5leHQobmV3IEVycm9yKCdFcnJvciByZXNvbHZpbmcgc3RhdGUnKSk7XG4gICAgICB9KTtcbiAgICB9LCAxMDEpO1xuICAgIFxuICB9O1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbZnVuY3Rpb24gU3RhdGVSb3V0ZXJQcm92aWRlcigpIHtcbiAgLy8gUHJvdmlkZXJcbiAgdmFyIF9wcm92aWRlciA9IHRoaXM7XG5cbiAgLy8gQ29uZmlndXJhdGlvbiwgZ2xvYmFsIG9wdGlvbnNcbiAgdmFyIF9jb25maWd1cmF0aW9uID0ge1xuICAgIGhpc3RvcnlMZW5ndGg6IDVcbiAgfTtcblxuICAvLyBTdGF0ZSBkZWZpbml0aW9uIGxpYnJhcnlcbiAgdmFyIF9zdGF0ZUxpYnJhcnkgPSB7fTtcbiAgdmFyIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgLy8gVVJMIHRvIHN0YXRlIGRpY3Rpb25hcnlcbiAgdmFyIF91cmxEaWN0aW9uYXJ5ID0gbmV3IFVybERpY3Rpb25hcnkoKTtcblxuICAvLyBNaWRkbGV3YXJlIGxheWVyc1xuICB2YXIgX2xheWVyTGlzdCA9IFtdO1xuXG4gIC8qKlxuICAgKiBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgKiBcbiAgICogQXNzdW1lIGFsbCBwYXJhbWV0ZXIgdmFsdWVzIGFyZSBzdHJpbmdzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVQYXJhbXMgQSBuYW1lLXBhcmFtcyBzdHJpbmdcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIHZhciBfcGFyc2VOYW1lID0gZnVuY3Rpb24obmFtZVBhcmFtcykge1xuICAgIGlmKG5hbWVQYXJhbXMgJiYgbmFtZVBhcmFtcy5tYXRjaCgvXlthLXpBLVowLTlfXFwuXSpcXCguKlxcKSQvKSkge1xuICAgICAgdmFyIG5wYXJ0ID0gbmFtZVBhcmFtcy5zdWJzdHJpbmcoMCwgbmFtZVBhcmFtcy5pbmRleE9mKCcoJykpO1xuICAgICAgdmFyIHBwYXJ0ID0gUGFyYW1ldGVycyggbmFtZVBhcmFtcy5zdWJzdHJpbmcobmFtZVBhcmFtcy5pbmRleE9mKCcoJykrMSwgbmFtZVBhcmFtcy5sYXN0SW5kZXhPZignKScpKSApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBucGFydCxcbiAgICAgICAgcGFyYW1zOiBwcGFydFxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuYW1lUGFyYW1zLFxuICAgICAgICBwYXJhbXM6IG51bGxcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgZGVmYXVsdCB2YWx1ZXMgdG8gYSBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3NldFN0YXRlRGVmYXVsdHMgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgLy8gRGVmYXVsdCB2YWx1ZXNcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goL1thLXpBLVowLTlfXSsvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIHF1ZXJ5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHF1ZXJ5IEEgcXVlcnkgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBxdWVyeS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvKFxcKihcXCopP3xbYS16QS1aMC05X10rKS8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGFyZSB0d28gc3RhdGVzLCBjb21wYXJlcyB2YWx1ZXMuICBcbiAgICogXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3RhdGVzIGFyZSB0aGUgc2FtZSwgZmFsc2UgaWYgc3RhdGVzIGFyZSBkaWZmZXJlbnRcbiAgICovXG4gIHZhciBfY29tcGFyZVN0YXRlcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICBhID0gYSB8fCB7fTtcbiAgICBiID0gYiB8fCB7fTtcbiAgICByZXR1cm4gYS5uYW1lID09PSBiLm5hbWUgJiYgYW5ndWxhci5lcXVhbHMoYS5wYXJhbXMsIGIucGFyYW1zKTtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGEgbGlzdCBvZiBwYXJlbnQgc3RhdGVzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtBcnJheX0gICAgICAgICBBbiBBcnJheSBvZiBwYXJlbnQgc3RhdGVzXG4gICAqL1xuICB2YXIgX2dldE5hbWVDaGFpbiA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbmFtZUxpc3QgPSBuYW1lLnNwbGl0KCcuJyk7XG5cbiAgICByZXR1cm4gbmFtZUxpc3RcbiAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgICAgICByZXR1cm4gbGlzdC5zbGljZSgwLCBpKzEpLmpvaW4oJy4nKTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0gIT09IG51bGw7XG4gICAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNyYXdsIGxpYnJhcnkgaGVpcmFyY2h5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICB2YXIgc3RhdGUgPSBudWxsO1xuXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgcXVlcmllc1xuICAgIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIC8vIFVzZSBjYWNoZSBpZiBleGlzdHNcbiAgICB9IGVsc2UgaWYoX3N0YXRlQ2FjaGVbbmFtZV0pIHtcbiAgICAgIHJldHVybiBfc3RhdGVDYWNoZVtuYW1lXTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZUNoYWluID0gX2dldE5hbWVDaGFpbihuYW1lKTtcbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihuYW1lLCBpKSB7XG4gICAgICAgIHZhciBpdGVtID0gYW5ndWxhci5jb3B5KF9zdGF0ZUxpYnJhcnlbbmFtZV0pO1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gISFwYXJlbnQ7XG4gICAgICB9KTtcblxuICAgIC8vIFdhbGsgdXAgY2hlY2tpbmcgaW5oZXJpdGFuY2VcbiAgICBmb3IodmFyIGk9c3RhdGVDaGFpbi5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihzdGF0ZUNoYWluW2ldKSB7XG4gICAgICAgIHZhciBuZXh0U3RhdGUgPSBzdGF0ZUNoYWluW2ldO1xuICAgICAgICBzdGF0ZSA9IGFuZ3VsYXIubWVyZ2UobmV4dFN0YXRlLCBzdGF0ZSB8fCB7fSk7XG4gICAgICB9XG5cbiAgICAgIGlmKHN0YXRlICYmIHN0YXRlLmluaGVyaXQgPT09IGZhbHNlKSBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbiBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlW25hbWVdID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBzdG9yZSBhIHN0YXRlIGRlZmluaXRpb24uICBQYXJhbWV0ZXJzIHNob3VsZCBiZSBpbmNsdWRlZCBpbiBkYXRhIE9iamVjdCBub3Qgc3RhdGUgbmFtZS4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9kZWZpbmVTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZihuYW1lID09PSBudWxsIHx8IHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOYW1lIGNhbm5vdCBiZSBudWxsLicpO1xuICAgIFxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIG5hbWVzXG4gICAgfSBlbHNlIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdGF0ZSBuYW1lLicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzdGF0ZVxuICAgIHZhciBzdGF0ZSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgIC8vIFVzZSBkZWZhdWx0c1xuICAgIF9zZXRTdGF0ZURlZmF1bHRzKHN0YXRlKTtcblxuICAgIC8vIE5hbWVkIHN0YXRlXG4gICAgc3RhdGUubmFtZSA9IG5hbWU7XG5cbiAgICAvLyBTZXQgZGVmaW5pdGlvblxuICAgIF9zdGF0ZUxpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIC8vIFJlc2V0IGNhY2hlXG4gICAgX3N0YXRlQ2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBjb25maWd1cmF0aW9uIGRhdGEgcGFyYW1ldGVycyBmb3IgU3RhdGVSb3V0ZXJcbiAgICpcbiAgICogSW5jbHVkaW5nIHBhcmFtZXRlcnM6XG4gICAqIFxuICAgKiAtIGhpc3RvcnlMZW5ndGggICB7TnVtYmVyfSBEZWZhdWx0cyB0byA1XG4gICAqIC0gaW5pdGlhbExvY2F0aW9uIHtPYmplY3R9IEFuIE9iamVjdHtuYW1lOlN0cmluZywgcGFyYW1zOk9iamVjdH0gZm9yIGluaXRpYWwgc3RhdGUgdHJhbnNpdGlvblxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgb3B0aW9ucyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLm9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgYW5ndWxhci5leHRlbmQoX2NvbmZpZ3VyYXRpb24sIG9wdGlvbnMgfHwge30pO1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldC9nZXQgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLnN0YXRlID0gZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICAvLyBHZXRcbiAgICBpZighc3RhdGUpIHtcbiAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgfVxuXG4gICAgLy8gU2V0XG4gICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcblxuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBpbml0aWFsaXphdGlvbiBwYXJhbWV0ZXJzOyBkZWZlcnJlZCB0byAkcmVhZHkoKVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIG5hbWUgICBBIGluaWl0YWwgc3RhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLmluaXQgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBfY29uZmlndXJhdGlvbi5pbml0aWFsTG9jYXRpb24gPSB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBpbnN0YW5jZVxuICAgKi9cbiAgdGhpcy4kZ2V0ID0gWyckcm9vdFNjb3BlJywgJyRsb2NhdGlvbicsICckcScsICckcXVldWVIYW5kbGVyJywgZnVuY3Rpb24gU3RhdGVSb3V0ZXJGYWN0b3J5KCRyb290U2NvcGUsICRsb2NhdGlvbiwgJHEsICRxdWV1ZUhhbmRsZXIpIHtcblxuICAgIC8vIFN0YXRlXG4gICAgdmFyIF9jdXJyZW50O1xuICAgIHZhciBfdHJhbnNpdGlvblF1ZXVlID0gW107XG4gICAgdmFyIF9pc1JlYWR5ID0gdHJ1ZTtcblxuICAgIHZhciBfb3B0aW9ucztcbiAgICB2YXIgX2luaXRhbExvY2F0aW9uO1xuICAgIHZhciBfaGlzdG9yeSA9IFtdO1xuICAgIHZhciBfaXNJbml0ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAgICogXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBfcHVzaEhpc3RvcnkgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgICAgIHZhciBoaXN0b3J5TGVuZ3RoID0gX29wdGlvbnMuaGlzdG9yeUxlbmd0aCB8fCA1O1xuXG4gICAgICBpZihkYXRhKSB7XG4gICAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IGhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIGhpc3RvcnlMZW5ndGgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gZnVsZmlsbCBjaGFuZ2Ugc3RhdGUgcmVxdWVzdC4gIFBhcmFtZXRlcnMgaW4gYHBhcmFtc2AgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHN0YXRlLW5vdGF0aW9uIGBuYW1lYCBleHByZXNzaW9uLiAgXG4gICAgICogXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSAgIG5hbWUgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb24gaW5jbHVkaW5nIG9wdGlvbmFsIHBhcmFtZXRlcnNcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcGFyYW1zICAgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuICAgICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICAgIHZhciBuYW1lRXhwciA9IF9wYXJzZU5hbWUobmFtZSk7XG4gICAgICAgIG5hbWUgPSBuYW1lRXhwci5uYW1lO1xuICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgICAgdmFyIGVycm9yID0gbnVsbDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSB7XG4gICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgICBsb2NhbHM6IHt9LFxuICAgICAgICAgIHByb21pc2U6IGRlZmVycmVkLnByb21pc2VcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDb21waWxlIGV4ZWN1dGlvbiBwaGFzZXNcbiAgICAgICAgdmFyIHF1ZXVlID0gJHF1ZXVlSGFuZGxlci5jcmVhdGUoKS5kYXRhKHJlcXVlc3QpO1xuXG4gICAgICAgIHZhciBuZXh0U3RhdGUgPSBhbmd1bGFyLmNvcHkoX2dldFN0YXRlKG5hbWUpKTtcbiAgICAgICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgICAgIGlmKG5leHRTdGF0ZSkge1xuICAgICAgICAgIC8vIFNldCBsb2NhbHNcbiAgICAgICAgICBuZXh0U3RhdGUubG9jYWxzID0gcmVxdWVzdC5sb2NhbHM7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU2V0IHBhcmFtZXRlcnNcbiAgICAgICAgICBuZXh0U3RhdGUucGFyYW1zID0gYW5ndWxhci5leHRlbmQobmV4dFN0YXRlLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERvZXMgbm90IGV4aXN0XG4gICAgICAgIGlmKG5leHRTdGF0ZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuXG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yTm90Rm91bmQnLCBlcnJvciwgcmVxdWVzdCk7XG4gICAgICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgICAgICB9LCAyMDApO1xuXG4gICAgICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgICAgIH0gZWxzZSBpZihfY29tcGFyZVN0YXRlcyhwcmV2U3RhdGUsIG5leHRTdGF0ZSkpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSwgMjAwKTtcbiAgICAgICAgICBcbiAgICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VCZWdpbicsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0sIDIwMSk7XG5cbiAgICAgICAgICAvLyBNYWtlIHN0YXRlIGNoYW5nZVxuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBpZihwcmV2U3RhdGUpIF9wdXNoSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9LCAyMDApO1xuXG4gICAgICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRW5kJywgcmVxdWVzdCk7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSwgLTIwMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSdW5cbiAgICAgICAgcXVldWUuZXhlY3V0ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3InLCBlcnIsIHJlcXVlc3QpO1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHRvIHN0YXRlIGFuZCBicm9hZGNhc3QgY29tcGxldGlvblxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICovXG4gICAgdmFyIF9jaGFuZ2VTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICByZXR1cm4gX2NoYW5nZVN0YXRlKG5hbWUsIHBhcmFtcykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VDb21wbGV0ZScsIG51bGwsIF9jdXJyZW50KTtcbiAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUNvbXBsZXRlJywgZXJyLCBfY3VycmVudCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmVsb2FkcyB0aGUgY3VycmVudCBzdGF0ZVxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICovXG4gICAgdmFyIF9yZWxvYWRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbiA9IF9jdXJyZW50Lm5hbWU7XG4gICAgICAgIHZhciBwID0gYW5ndWxhci5jb3B5KF9jdXJyZW50LnBhcmFtcyk7XG4gICAgICAgIGlmKCFfY3VycmVudC5wYXJhbXMpIHtcbiAgICAgICAgICBfY3VycmVudC5wYXJhbXMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBfY3VycmVudC5wYXJhbXMuZGVwcmVjYXRlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gTm90aWZ5XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlUmVsb2FkJywgbnVsbCwgX2N1cnJlbnQpO1xuXG4gICAgICAgIF9jaGFuZ2VTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlKG4sIHApLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIC8vIEluc3RhbmNlXG4gICAgdmFyIF9pbnN0O1xuICAgIF9pbnN0ID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBvcHRpb25zXG4gICAgICAgKlxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvbmZpZ3VyZWQgb3B0aW9uc1xuICAgICAgICovXG4gICAgICBvcHRpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gSGFzbid0IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9vcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQvZ2V0IHN0YXRlLiBSZWxvYWRzIHN0YXRlIGlmIGN1cnJlbnQgc3RhdGUgaXMgYWZmZWN0ZWQgYnkgZGVmaW5lZCBcbiAgICAgICAqIHN0YXRlICh3aGVuIHJlZGVmaW5pbmcgcGFyZW50IG9yIGN1cnJlbnQgc3RhdGUpXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBzdGF0ZTogZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICAgICAgLy8gR2V0XG4gICAgICAgIGlmKCFzdGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXRcbiAgICAgICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBhZGQgbWlkZGxld2FyZTsgY2FsbGVkIGR1cmluZyBzdGF0ZSB0cmFuc2l0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBoYW5kbGVyICBBIGNhbGxiYWNrLCBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KVxuICAgICAgICogQHBhcmFtICB7TnVtYmVyfSAgIHByaW9yaXR5IEEgbnVtYmVyIGRlbm90aW5nIHByaW9yaXR5XG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9ICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHVzZTogZnVuY3Rpb24oaGFuZGxlciwgcHJpb3JpdHkpIHtcbiAgICAgICAgaWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pZGRsZXdhcmUgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHByaW9yaXR5ICE9PSAndW5kZWZpbmVkJykgaGFuZGxlci5wcmlvcml0eSA9IHByaW9yaXR5O1xuICAgICAgICBfbGF5ZXJMaXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHBlcmZvcm0gaW5pdGlhbGl6YXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkcmVhZHk6IGZ1bmN0aW9uKCkge1xuICAgICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYoIV9pc0luaXQpIHtcbiAgICAgICAgICAgIF9pc0luaXQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBDb25maWd1cmF0aW9uXG4gICAgICAgICAgICBpZighX29wdGlvbnMpIHtcbiAgICAgICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgICBpZihfb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaW5pdGlhbExvY2F0aW9uJykpIHtcbiAgICAgICAgICAgICAgX2luaXRhbExvY2F0aW9uID0gYW5ndWxhci5jb3B5KF9vcHRpb25zLmluaXRpYWxMb2NhdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZWFkeURlZmVycmVkID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgICAgICAgaWYoJGxvY2F0aW9uLnVybCgpICE9PSAnJykge1xuICAgICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2luc3QuJGxvY2F0aW9uKCRsb2NhdGlvbi51cmwoKSk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpemUgd2l0aCBzdGF0ZVxuICAgICAgICAgICAgfSBlbHNlIGlmKF9pbml0YWxMb2NhdGlvbikge1xuICAgICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2NoYW5nZVN0YXRlQW5kQnJvYWRjYXN0Q29tcGxldGUoX2luaXRhbExvY2F0aW9uLm5hbWUsIF9pbml0YWxMb2NhdGlvbi5wYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAkcS53aGVuKHJlYWR5RGVmZXJyZWQpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlSW5pdCcpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvLyBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgICAgcGFyc2U6IF9wYXJzZU5hbWUsXG5cbiAgICAgIC8qKlxuICAgICAgICogUmV0cmlldmUgZGVmaW5pdGlvbiBvZiBzdGF0ZXNcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGhhc2ggb2YgYWxsIGRlZmluZWQgc3RhdGVzXG4gICAgICAgKi9cbiAgICAgIGxpYnJhcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX3N0YXRlTGlicmFyeTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFZhbGlkYXRpb25cbiAgICAgIHZhbGlkYXRlOiB7XG4gICAgICAgIG5hbWU6IF92YWxpZGF0ZVN0YXRlTmFtZSxcbiAgICAgICAgcXVlcnk6IF92YWxpZGF0ZVN0YXRlUXVlcnlcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogUmV0cmlldmUgaGlzdG9yeVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cbiAgICAgICAqL1xuICAgICAgaGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfaGlzdG9yeTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogUmVxdWVzdCBzdGF0ZSB0cmFuc2l0aW9uLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2UgY29tcGxldGVcbiAgICAgICAqL1xuICAgICAgY2hhbmdlOiBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIF9jaGFuZ2VTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlKG5hbWUsIHBhcmFtcyk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlbG9hZHMgdGhlIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgICAqL1xuICAgICAgcmVsb2FkOiBfcmVsb2FkU3RhdGUsXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgdmFyIHN0YXRlID0gZGF0YS5yZWY7XG5cbiAgICAgICAgICBpZihzdGF0ZSkge1xuICAgICAgICAgICAgLy8gUGFyc2UgcGFyYW1zIGZyb20gdXJsXG4gICAgICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlQW5kQnJvYWRjYXN0Q29tcGxldGUoc3RhdGUubmFtZSwgZGF0YS5wYXJhbXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmKCEhdXJsICYmIHVybCAhPT0gJycpIHtcbiAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvck5vdEZvdW5kJywgZXJyb3IsIHtcbiAgICAgICAgICAgIHVybDogdXJsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJHEucmVqZWN0KG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgbG9jYXRpb24gaW4gbGlicmFyeScpKTtcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8qKlxuICAgICAgICogUmV0cmlldmUgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqL1xuICAgICAgY3VycmVudDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoIV9jdXJyZW50KSA/IG51bGwgOiBhbmd1bGFyLmNvcHkoX2N1cnJlbnQpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBDaGVjayBxdWVyeSBhZ2FpbnN0IGN1cnJlbnQgc3RhdGVcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gIHtNaXhlZH0gICBxdWVyeSAgQSBzdHJpbmcgdXNpbmcgc3RhdGUgbm90YXRpb24gb3IgYSBSZWdFeHBcbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gIHBhcmFtcyBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICAgICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICBBIHRydWUgaWYgc3RhdGUgaXMgcGFyZW50IHRvIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqL1xuICAgICAgYWN0aXZlOiBmdW5jdGlvbihxdWVyeSwgcGFyYW1zKSB7XG4gICAgICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgICAgIFxuICAgICAgICAvLyBObyBzdGF0ZVxuICAgICAgICBpZighX2N1cnJlbnQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gVXNlIFJlZ0V4cCBtYXRjaGluZ1xuICAgICAgICB9IGVsc2UgaWYocXVlcnkgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKHF1ZXJ5KTtcblxuICAgICAgICAvLyBTdHJpbmc7IHN0YXRlIGRvdC1ub3RhdGlvblxuICAgICAgICB9IGVsc2UgaWYodHlwZW9mIHF1ZXJ5ID09PSAnc3RyaW5nJykge1xuXG4gICAgICAgICAgLy8gQ2FzdCBzdHJpbmcgdG8gUmVnRXhwXG4gICAgICAgICAgaWYocXVlcnkubWF0Y2goL15cXC8uKlxcLyQvKSkge1xuICAgICAgICAgICAgdmFyIGNhc3RlZCA9IHF1ZXJ5LnN1YnN0cigxLCBxdWVyeS5sZW5ndGgtMik7XG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAoY2FzdGVkKSk7XG5cbiAgICAgICAgICAvLyBUcmFuc2Zvcm0gdG8gc3RhdGUgbm90YXRpb25cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gcXVlcnlcbiAgICAgICAgICAgICAgLnNwbGl0KCcuJylcbiAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgaWYoaXRlbSA9PT0gJyonKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ1thLXpBLVowLTlfXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZihpdGVtID09PSAnKionKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ1thLXpBLVowLTlfXFxcXC5dKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLmpvaW4oJ1xcXFwuJyk7XG5cbiAgICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cCh0cmFuc2Zvcm1lZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5vbi1tYXRjaGluZ1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBfaW5zdDtcbiAgfV07XG5cbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGUnLCAnJGxvY2F0aW9uJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbigkc3RhdGUsICRsb2NhdGlvbiwgJHJvb3RTY29wZSkge1xuICB2YXIgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICAvKipcbiAgICogVXBkYXRlIFVSTCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgdmFyIF91cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZihjdXJyZW50ICYmIGN1cnJlbnQudXJsKSB7XG4gICAgICB2YXIgcGF0aDtcbiAgICAgIHBhdGggPSBjdXJyZW50LnVybDtcblxuICAgICAgLy8gQWRkIHBhcmFtZXRlcnMgb3IgdXNlIGRlZmF1bHQgcGFyYW1ldGVyc1xuICAgICAgdmFyIHBhcmFtcyA9IGN1cnJlbnQucGFyYW1zIHx8IHt9O1xuICAgICAgdmFyIHF1ZXJ5ID0ge307XG4gICAgICBmb3IodmFyIG5hbWUgaW4gcGFyYW1zKSB7XG4gICAgICAgIHZhciByZSA9IG5ldyBSZWdFeHAoJzonK25hbWUsICdnJyk7XG4gICAgICAgIGlmKHBhdGgubWF0Y2gocmUpKSB7XG4gICAgICAgICAgcGF0aCA9IHBhdGgucmVwbGFjZShyZSwgcGFyYW1zW25hbWVdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBxdWVyeVtuYW1lXSA9IHBhcmFtc1tuYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAkbG9jYXRpb24ucGF0aChwYXRoKTtcbiAgICAgICRsb2NhdGlvbi5zZWFyY2gocXVlcnkpO1xuICAgICAgXG4gICAgICBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlIHVybCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgX3NlbGYudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgX3VwZGF0ZSgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBEZXRlY3QgVVJMIGNoYW5nZSBhbmQgZGlzcGF0Y2ggc3RhdGUgY2hhbmdlXG4gICAqL1xuICBfc2VsZi5sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsYXN0VXJsID0gX3VybDtcbiAgICB2YXIgbmV4dFVybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAgIGlmKG5leHRVcmwgIT09IGxhc3RVcmwpIHtcbiAgICAgIF91cmwgPSBuZXh0VXJsO1xuXG4gICAgICAkc3RhdGUuJGxvY2F0aW9uKF91cmwpO1xuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckbG9jYXRpb25TdGF0ZVVwZGF0ZScpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAgKi9cbiAgX3NlbGYuJHJlYWR5ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgICBfdXBkYXRlKCk7XG4gICAgICBuZXh0KCk7XG4gICAgfSk7XG4gICAgXG4gIH07XG5cblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUGFyc2UgT2JqZWN0IGxpdGVyYWwgbmFtZS12YWx1ZSBwYWlyc1xudmFyIHJlUGFyc2VPYmplY3RMaXRlcmFsID0gLyhbLHtdXFxzKigoXCJ8JykoLio/KVxcM3xcXHcqKXwoOlxccyooWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspP3x0cnVlfGZhbHNlfG51bGx8KFwifCcpKC4qPylcXDd8XFxbW15cXF1dKlxcXSkpKS9nO1xuXG4vLyBNYXRjaCBTdHJpbmdzXG52YXIgcmVTdHJpbmcgPSAvXihcInwnKSguKj8pXFwxJC87XG5cbi8vIFRPRE8gQWRkIGVzY2FwZWQgc3RyaW5nIHF1b3RlcyBcXCcgYW5kIFxcXCIgdG8gc3RyaW5nIG1hdGNoZXJcblxuLy8gTWF0Y2ggTnVtYmVyIChpbnQvZmxvYXQvZXhwb25lbnRpYWwpXG52YXIgcmVOdW1iZXIgPSAvXlsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT8kLztcblxuLyoqXG4gKiBQYXJzZSBzdHJpbmcgdmFsdWUgaW50byBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbC5cbiAqXG4gKiBTdHJpbmdzIGFyZSBzdXJyb3VuZGVkIGJ5IGEgcGFpciBvZiBtYXRjaGluZyBxdW90ZXNcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB2YWx1ZSBBIFN0cmluZyB2YWx1ZSB0byBwYXJzZVxuICogQHJldHVybiB7TWl4ZWR9ICAgICAgICBBIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsXG4gKi9cbnZhciBfcmVzb2x2ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcblxuICAvLyBCb29sZWFuOiB0cnVlXG4gIGlmKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICAvLyBCb29sZWFuOiBmYWxzZVxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTnVsbFxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdudWxsJykge1xuICAgIHJldHVybiBudWxsO1xuXG4gIC8vIFN0cmluZ1xuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVTdHJpbmcpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnN1YnN0cigxLCB2YWx1ZS5sZW5ndGgtMik7XG5cbiAgLy8gTnVtYmVyXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZU51bWJlcikpIHtcbiAgICByZXR1cm4gK3ZhbHVlO1xuXG4gIC8vIE5hTlxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdOYU4nKSB7XG4gICAgcmV0dXJuIE5hTjtcblxuICAvLyBUT0RPIGFkZCBtYXRjaGluZyB3aXRoIEFycmF5cyBhbmQgcGFyc2VcbiAgXG4gIH1cblxuICAvLyBVbmFibGUgdG8gcmVzb2x2ZVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyBGaW5kIHZhbHVlcyBpbiBhbiBvYmplY3QgbGl0ZXJhbFxudmFyIF9saXN0aWZ5ID0gZnVuY3Rpb24oc3RyKSB7XG5cbiAgLy8gVHJpbVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG5cbiAgaWYoc3RyLm1hdGNoKC9eXFxzKnsuKn1cXHMqJC8pID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQYXJhbWV0ZXJzIGV4cGVjdHMgYW4gT2JqZWN0Jyk7XG4gIH1cblxuICB2YXIgc2FuaXRpemVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBuYW1lLnJlcGxhY2UoL15bXFx7LF0/XFxzKltcIiddPy8sICcnKS5yZXBsYWNlKC9bXCInXT9cXHMqJC8sICcnKTtcbiAgfTtcblxuICB2YXIgc2FuaXRpemVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHN0ciA9IHZhbHVlLnJlcGxhY2UoL14oOik/XFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbiAgICByZXR1cm4gX3Jlc29sdmVWYWx1ZShzdHIpO1xuICB9O1xuXG4gIHJldHVybiBzdHIubWF0Y2gocmVQYXJzZU9iamVjdExpdGVyYWwpLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgcmV0dXJuIGklMiA9PT0gMCA/IHNhbml0aXplTmFtZShpdGVtKSA6IHNhbml0aXplVmFsdWUoaXRlbSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBwYXJhbXMgT2JqZWN0IGZyb20gc3RyaW5nXG4gKiBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQSBzdHJpbmdpZmllZCB2ZXJzaW9uIG9mIE9iamVjdCBsaXRlcmFsXG4gKi9cbnZhciBQYXJhbWV0ZXJzID0gZnVuY3Rpb24oc3RyKSB7XG4gIHN0ciA9IHN0ciB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICBfbGlzdGlmeShzdHIpLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIGlmKGklMiA9PT0gMCkge1xuICAgICAgX3NlbGZbaXRlbV0gPSBsaXN0W2krMV07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcmFtZXRlcnM7XG5cbm1vZHVsZS5leHBvcnRzLnJlc29sdmVWYWx1ZSA9IF9yZXNvbHZlVmFsdWU7XG5tb2R1bGUuZXhwb3J0cy5saXN0aWZ5ID0gX2xpc3RpZnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmwgPSByZXF1aXJlKCcuL3VybCcpO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFVybERpY3Rpb25hcnkoKSB7XG4gIHRoaXMuX3BhdHRlcm5zID0gW107XG4gIHRoaXMuX3JlZnMgPSBbXTtcbiAgdGhpcy5fcGFyYW1zID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuICB2YXIgcGFyYW1zID0ge307XG5cbiAgaWYocGF0dGVybi5pbmRleE9mKCc/JykgPT09IC0xKSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuXG4gIH0gZWxzZSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuICB9XG5cbiAgLy8gU3RhcnRcbiAgdmFyIHNlYXJjaEV4cHIgPSAnXic7XG5cbiAgLy8gSXRlbXNcbiAgKHBhdGhDaGFpbi5mb3JFYWNoKGZ1bmN0aW9uKGNodW5rLCBpKSB7XG4gICAgaWYoaSE9PTApIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1xcXFwvJztcbiAgICB9XG5cbiAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdbXlxcXFwvP10qJztcbiAgICAgIHBhcmFtc1tjaHVuay5zdWJzdHJpbmcoMSldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZWFyY2hFeHByICs9IGNodW5rO1xuICAgIH1cbiAgfSkpO1xuXG4gIC8vIEVuZFxuICBzZWFyY2hFeHByICs9ICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbiAgdGhpcy5fcGFyYW1zW2ldID0gcGFyYW1zO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgcmVmZXJlbmNlIGFjY29yZGluZyB0byBhIFVSTCBwYXR0ZXJuIGFuZCByZXRyaWV2ZSBwYXJhbXMgZGVmaW5lZCBpbiBVUkxcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB1cmwgPSB1cmwgfHwgJyc7XG4gIHZhciBwID0gVXJsKHVybCkucGF0aCgpO1xuICB2YXIgcSA9IFVybCh1cmwpLnF1ZXJ5cGFyYW1zKCk7XG5cbiAgdmFyIF9zZWxmID0gdGhpcztcblxuICAvLyBDaGVjayBkaWN0aW9uYXJ5XG4gIHZhciBfZmluZFBhdHRlcm4gPSBmdW5jdGlvbihjaGVjaykge1xuICAgIGNoZWNrID0gY2hlY2sgfHwgJyc7XG4gICAgZm9yKHZhciBpPV9zZWxmLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihjaGVjay5tYXRjaChfc2VsZi5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgdmFyIGkgPSBfZmluZFBhdHRlcm4ocCk7XG4gIFxuICAvLyBNYXRjaGluZyBwYXR0ZXJuIGZvdW5kXG4gIGlmKGkgIT09IC0xKSB7XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcGF0dGVybiBtYXRjaFxuICAgIHZhciBwYXJhbXMgPSB7fTtcbiAgICBmb3IodmFyIG4gaW4gdGhpcy5fcGFyYW1zW2ldKSB7XG4gICAgICB2YXIgcGFyYW1QYXJzZXIgPSB0aGlzLl9wYXJhbXNbaV1bbl07XG4gICAgICB2YXIgdXJsTWF0Y2ggPSAodXJsLm1hdGNoKHBhcmFtUGFyc2VyKSB8fCBbXSkucG9wKCkgfHwgJyc7XG4gICAgICB2YXIgdmFyTWF0Y2ggPSB1cmxNYXRjaC5zcGxpdCgnLycpLnBvcCgpO1xuICAgICAgcGFyYW1zW25dID0gdmFyTWF0Y2g7XG4gICAgfVxuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHF1ZXJ5c3RyaW5nIG1hdGNoXG4gICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQocSwgcGFyYW1zKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIHJlZjogdGhpcy5fcmVmc1tpXSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcblxuICAvLyBOb3QgaW4gZGljdGlvbmFyeVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/IHVybCA6IHVybC5zdWJzdHJpbmcoMCwgdXJsLmluZGV4T2YoJz8nKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlzdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJycgOiB1cmwuc3Vic3RyaW5nKHVybC5pbmRleE9mKCc/JykrMSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkwgcGFyYW1ldGVycyBhcyBhIGhhc2hcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlwYXJhbXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhaXJzID0gX3NlbGYucXVlcnlzdHJpbmcoKS5zcGxpdCgnJicpO1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBmb3IodmFyIGk9MDsgaTxwYWlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihwYWlyc1tpXSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmFtZVZhbHVlID0gcGFpcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgcGFyYW1zW25hbWVWYWx1ZVswXV0gPSAodHlwZW9mIG5hbWVWYWx1ZVsxXSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmFtZVZhbHVlWzFdID09PSAnJykgPyB0cnVlIDogbmFtZVZhbHVlWzFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
