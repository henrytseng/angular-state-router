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

        // Special name notation
        if(name === '.' && _current) {
          name = _current.name;
        }

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
        params[nameValue[0]] = (typeof nameValue[1] === 'undefined' || nameValue[1] === '') ? true : decodeURIComponent(nameValue[1]);
      }

      return params;
    }
  };

  return _self;
}

module.exports = Url;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL2VuYWN0LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvcXVldWUtaGFuZGxlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMv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LFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxVQUFVLElBQUksUUFBUSxLQUFLOzs7Ozs7OztJQVF2RSxhQUFhLFdBQVc7TUFDdEIsSUFBSSxRQUFRLE1BQU0sY0FBYyxNQUFNO01BQ3RDLElBQUksU0FBUzs7TUFFYixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxRQUFRLEtBQUs7UUFDaEMsR0FBRyxNQUFNLE9BQU8sSUFBSTtRQUNwQixJQUFJLFlBQVksTUFBTSxHQUFHLE1BQU07UUFDL0IsT0FBTyxVQUFVLE1BQU0sQ0FBQyxPQUFPLFVBQVUsT0FBTyxlQUFlLFVBQVUsT0FBTyxNQUFNLE9BQU8sbUJBQW1CLFVBQVU7OztNQUc1SCxPQUFPOzs7O0VBSVgsT0FBTzs7O0FBR1QsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsIGZ1bmN0aW9uICgkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZS5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gSW5zdGFudGlhdGUgbW9kdWxlXG5hbmd1bGFyLm1vZHVsZSgnYW5ndWxhci1zdGF0ZS1yb3V0ZXInLCBbXSlcblxuICAucHJvdmlkZXIoJyRzdGF0ZScsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5mYWN0b3J5KCckcmVzb2x1dGlvbicsIHJlcXVpcmUoJy4vc2VydmljZXMvcmVzb2x1dGlvbicpKVxuXG4gIC5mYWN0b3J5KCckZW5hY3QnLCByZXF1aXJlKCcuL3NlcnZpY2VzL2VuYWN0JykpXG4gIFxuICAuZmFjdG9yeSgnJHF1ZXVlSGFuZGxlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvcXVldWUtaGFuZGxlcicpKVxuXG4gIC5ydW4oWyckcm9vdFNjb3BlJywgJyRzdGF0ZScsICckdXJsTWFuYWdlcicsICckcmVzb2x1dGlvbicsICckZW5hY3QnLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkc3RhdGUsICR1cmxNYW5hZ2VyLCAkcmVzb2x1dGlvbiwgJGVuYWN0KSB7XG4gICAgLy8gVXBkYXRlIGxvY2F0aW9uIGNoYW5nZXNcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcblxuICAgICR1cmxNYW5hZ2VyLiRyZWFkeSgpO1xuICAgICRyZXNvbHV0aW9uLiRyZWFkeSgpO1xuICAgICRlbmFjdC4kcmVhZHkoKTtcblxuICAgIC8vIEluaXRpYWxpemVcbiAgICAkc3RhdGUuJHJlYWR5KCk7XG5cbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHEnLCAnJGluamVjdG9yJywgJyRzdGF0ZScsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHEsICRpbmplY3RvciwgJHN0YXRlLCAkcm9vdFNjb3BlKSB7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYWN0aW9uc1xuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgYWN0aW9ucyBBbiBhcnJheSBvZiBhY3Rpb25zIGl0ZW1zXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIGFjdGlvbnMgcHJvY2Vzc2VkXG4gICAqL1xuICB2YXIgX2FjdCA9IGZ1bmN0aW9uKGFjdGlvbnMpIHtcbiAgICB2YXIgYWN0aW9uUHJvbWlzZXMgPSBbXTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChhY3Rpb25zLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIGFjdGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlKTtcbiAgICAgIGFjdGlvblByb21pc2VzLnB1c2goJHEud2hlbihhY3Rpb24pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwoYWN0aW9uUHJvbWlzZXMpO1xuICB9O1xuICBfc2VsZi5wcm9jZXNzID0gX2FjdDtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAgKi9cbiAgX3NlbGYuJHJlYWR5ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgICB9XG5cbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQWN0aW9uQmVnaW4nKTtcblxuICAgICAgX2FjdChjdXJyZW50LmFjdGlvbnMgfHwgW10pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQWN0aW9uRW5kJyk7XG4gICAgICAgIG5leHQoKTtcblxuICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQWN0aW9uRXJyb3InLCBlcnIpO1xuICAgICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcHJvY2Vzc2luZyBzdGF0ZSBhY3Rpb25zJykpO1xuICAgICAgfSk7XG4gICAgfSwgMTAwKTtcblxuICB9O1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCRyb290U2NvcGUpIHtcblxuICAvKipcbiAgICogRXhlY3V0ZSBhIHNlcmllcyBvZiBmdW5jdGlvbnM7IHVzZWQgaW4gdGFuZGVtIHdpdGggbWlkZGxld2FyZVxuICAgKi9cbiAgdmFyIFF1ZXVlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIF9saXN0ID0gW107XG4gICAgdmFyIF9kYXRhID0gbnVsbDtcblxuICAgIHZhciBfc2VsZiA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBBZGQgYSBoYW5kbGVyXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSB7TWl4ZWR9ICBoYW5kbGVyIEEgRnVuY3Rpb24gb3IgYW4gQXJyYXkgb2YgRnVuY3Rpb25zIHRvIGFkZCB0byB0aGUgcXVldWVcbiAgICAgICAqIEByZXR1cm4ge1F1ZXVlfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGFkZDogZnVuY3Rpb24oaGFuZGxlciwgcHJpb3JpdHkpIHtcbiAgICAgICAgaWYoaGFuZGxlciAmJiBoYW5kbGVyLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgIGhhbmRsZXIuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgICAgICAgbGF5ZXIucHJpb3JpdHkgPSB0eXBlb2YgbGF5ZXIucHJpb3JpdHkgPT09ICd1bmRlZmluZWQnID8gMSA6IGxheWVyLnByaW9yaXR5O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhbmRsZXIucHJpb3JpdHkgPSBwcmlvcml0eSB8fCAodHlwZW9mIGhhbmRsZXIucHJpb3JpdHkgPT09ICd1bmRlZmluZWQnID8gMSA6IGhhbmRsZXIucHJpb3JpdHkpO1xuICAgICAgICAgIF9saXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIERhdGEgb2JqZWN0XG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIGRhdGEgb2JqZWN0IG1hZGUgYXZhaWxhYmxlIHRvIGVhY2ggaGFuZGxlclxuICAgICAgICogQHJldHVybiB7UXVldWV9ICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgX2RhdGEgPSBkYXRhO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQmVnaW4gZXhlY3V0aW9uIGFuZCB0cmlnZ2VyIGNhbGxiYWNrIGF0IHRoZSBlbmRcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgICAqIEByZXR1cm4ge1F1ZXVlfSAgICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB2YXIgbmV4dEhhbmRsZXI7XG4gICAgICAgIHZhciBleGVjdXRpb25MaXN0ID0gX2xpc3Quc2xpY2UoMCkuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBuZXh0SGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBoYW5kbGVyID0gZXhlY3V0aW9uTGlzdC5zaGlmdCgpO1xuXG4gICAgICAgICAgICAvLyBDb21wbGV0ZVxuICAgICAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgICAgIC8vIE5leHQgaGFuZGxlclxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaGFuZGxlci5jYWxsKG51bGwsIF9kYXRhLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBFcnJvclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTdGFydFxuICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgfVxuXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLy8gSW5zdGFuY2VcbiAgcmV0dXJuIHtcblxuICAgIC8qKlxuICAgICAqIEZhY3RvcnkgbWV0aG9kXG4gICAgICogXG4gICAgICogQHJldHVybiB7UXVldWV9IEEgcXVldWVcbiAgICAgKi9cbiAgICBjcmVhdGU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIFF1ZXVlKCk7XG4gICAgfVxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcScsICckaW5qZWN0b3InLCAnJHN0YXRlJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbigkcSwgJGluamVjdG9yLCAkc3RhdGUsICRyb290U2NvcGUpIHtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICAvKipcbiAgICogUmVzb2x2ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcmVzb2x2ZSBBIGhhc2ggT2JqZWN0IG9mIGl0ZW1zIHRvIHJlc29sdmVcbiAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gdGVtcGxhdGVzIHJldGlyZXZlZFxuICAgKi9cbiAgdmFyIF9yZXNvbHZlID0gZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIHZhciByZXNvbHZlc1Byb21pc2VzID0ge307XG5cbiAgICBhbmd1bGFyLmZvckVhY2gocmVzb2x2ZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgdmFyIHJlc29sdXRpb24gPSBhbmd1bGFyLmlzU3RyaW5nKHZhbHVlKSA/ICRpbmplY3Rvci5nZXQodmFsdWUpIDogJGluamVjdG9yLmludm9rZSh2YWx1ZSwgbnVsbCwgbnVsbCwga2V5KTtcbiAgICAgIHJlc29sdmVzUHJvbWlzZXNba2V5XSA9ICRxLndoZW4ocmVzb2x1dGlvbik7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gJHEuYWxsKHJlc29sdmVzUHJvbWlzZXMpO1xuICB9O1xuICBfc2VsZi5yZXNvbHZlID0gX3Jlc29sdmU7XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgICovXG4gIF9zZWxmLiRyZWFkeSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgJHN0YXRlLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgICBpZighY3VycmVudCkge1xuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuXG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZVJlc29sdmVCZWdpbicpO1xuXG4gICAgICBfcmVzb2x2ZShjdXJyZW50LnJlc29sdmUgfHwge30pLnRoZW4oZnVuY3Rpb24obG9jYWxzKSB7XG4gICAgICAgIGFuZ3VsYXIuZXh0ZW5kKHJlcXVlc3QubG9jYWxzLCBsb2NhbHMpO1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZVJlc29sdmVFbmQnKTtcbiAgICAgICAgbmV4dCgpO1xuXG4gICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVSZXNvbHZlRXJyb3InLCBlcnIpO1xuICAgICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcmVzb2x2aW5nIHN0YXRlJykpO1xuICAgICAgfSk7XG4gICAgfSwgMTAxKTtcbiAgICBcbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xudmFyIFBhcmFtZXRlcnMgPSByZXF1aXJlKCcuLi91dGlscy9wYXJhbWV0ZXJzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIFByb3ZpZGVyXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIENvbmZpZ3VyYXRpb24sIGdsb2JhbCBvcHRpb25zXG4gIHZhciBfY29uZmlndXJhdGlvbiA9IHtcbiAgICBoaXN0b3J5TGVuZ3RoOiA1XG4gIH07XG5cbiAgLy8gU3RhdGUgZGVmaW5pdGlvbiBsaWJyYXJ5XG4gIHZhciBfc3RhdGVMaWJyYXJ5ID0ge307XG4gIHZhciBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCB0byBzdGF0ZSBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lUGFyYW1zIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgQSBuYW1lIHN0cmluZyBhbmQgcGFyYW0gT2JqZWN0XG4gICAqL1xuICB2YXIgX3BhcnNlTmFtZSA9IGZ1bmN0aW9uKG5hbWVQYXJhbXMpIHtcbiAgICBpZihuYW1lUGFyYW1zICYmIG5hbWVQYXJhbXMubWF0Y2goL15bYS16QS1aMC05X1xcLl0qXFwoLipcXCkkLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWVQYXJhbXMuc3Vic3RyaW5nKDAsIG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWVQYXJhbXMuc3Vic3RyaW5nKG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKzEsIG5hbWVQYXJhbXMubGFzdEluZGV4T2YoJyknKSkgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbnBhcnQsXG4gICAgICAgIHBhcmFtczogcHBhcnRcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbmFtZVBhcmFtcyxcbiAgICAgICAgcGFyYW1zOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgYSA9IGEgfHwge307XG4gICAgYiA9IGIgfHwge307XG4gICAgcmV0dXJuIGEubmFtZSA9PT0gYi5uYW1lICYmIGFuZ3VsYXIuZXF1YWxzKGEucGFyYW1zLCBiLnBhcmFtcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9zdGF0ZUNhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX3N0YXRlQ2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24obmFtZSwgaSkge1xuICAgICAgICB2YXIgaXRlbSA9IGFuZ3VsYXIuY29weShfc3RhdGVMaWJyYXJ5W25hbWVdKTtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihwYXJlbnQpIHtcbiAgICAgICAgcmV0dXJuICEhcGFyZW50O1xuICAgICAgfSk7XG5cbiAgICAvLyBXYWxrIHVwIGNoZWNraW5nIGluaGVyaXRhbmNlXG4gICAgZm9yKHZhciBpPXN0YXRlQ2hhaW4ubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoc3RhdGVDaGFpbltpXSkge1xuICAgICAgICB2YXIgbmV4dFN0YXRlID0gc3RhdGVDaGFpbltpXTtcbiAgICAgICAgc3RhdGUgPSBhbmd1bGFyLm1lcmdlKG5leHRTdGF0ZSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiBzdGF0ZS5pbmhlcml0ID09PSBmYWxzZSkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfc3RhdGVDYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uLiAgUGFyYW1ldGVycyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gZGF0YSBPYmplY3Qgbm90IHN0YXRlIG5hbWUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfc3RhdGVMaWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICAvLyBSZXNldCBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgICAvLyBVUkwgbWFwcGluZ1xuICAgIGlmKHN0YXRlLnVybCkge1xuICAgICAgX3VybERpY3Rpb25hcnkuYWRkKHN0YXRlLnVybCwgc3RhdGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBkYXRhIHBhcmFtZXRlcnMgZm9yIFN0YXRlUm91dGVyXG4gICAqXG4gICAqIEluY2x1ZGluZyBwYXJhbWV0ZXJzOlxuICAgKiBcbiAgICogLSBoaXN0b3J5TGVuZ3RoICAge051bWJlcn0gRGVmYXVsdHMgdG8gNVxuICAgKiAtIGluaXRpYWxMb2NhdGlvbiB7T2JqZWN0fSBBbiBPYmplY3R7bmFtZTpTdHJpbmcsIHBhcmFtczpPYmplY3R9IGZvciBpbml0aWFsIHN0YXRlIHRyYW5zaXRpb25cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIG9wdGlvbnMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5vcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGFuZ3VsYXIuZXh0ZW5kKF9jb25maWd1cmF0aW9uLCBvcHRpb25zIHx8IHt9KTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgLy8gR2V0XG4gICAgaWYoIXN0YXRlKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cblxuICAgIC8vIFNldFxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG5cbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgaW5pdGlhbGl6YXRpb24gcGFyYW1ldGVyczsgZGVmZXJyZWQgdG8gJHJlYWR5KClcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBuYW1lICAgQSBpbmlpdGFsIHN0YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBwYXJhbXMgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgX2NvbmZpZ3VyYXRpb24uaW5pdGlhbExvY2F0aW9uID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgaW5zdGFuY2VcbiAgICovXG4gIHRoaXMuJGdldCA9IFsnJHJvb3RTY29wZScsICckbG9jYXRpb24nLCAnJHEnLCAnJHF1ZXVlSGFuZGxlcicsIGZ1bmN0aW9uIFN0YXRlUm91dGVyRmFjdG9yeSgkcm9vdFNjb3BlLCAkbG9jYXRpb24sICRxLCAkcXVldWVIYW5kbGVyKSB7XG5cbiAgICAvLyBTdGF0ZVxuICAgIHZhciBfY3VycmVudDtcbiAgICB2YXIgX3RyYW5zaXRpb25RdWV1ZSA9IFtdO1xuICAgIHZhciBfaXNSZWFkeSA9IHRydWU7XG5cbiAgICB2YXIgX29wdGlvbnM7XG4gICAgdmFyIF9pbml0YWxMb2NhdGlvbjtcbiAgICB2YXIgX2hpc3RvcnkgPSBbXTtcbiAgICB2YXIgX2lzSW5pdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9vcHRpb25zLmhpc3RvcnlMZW5ndGggfHwgNTtcblxuICAgICAgaWYoZGF0YSkge1xuICAgICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgbGVuZ3RoXG4gICAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBoaXN0b3J5TGVuZ3RoKSB7XG4gICAgICAgIF9oaXN0b3J5LnNwbGljZSgwLCBfaGlzdG9yeS5sZW5ndGggLSBoaXN0b3J5TGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGZ1bGZpbGwgY2hhbmdlIHN0YXRlIHJlcXVlc3QuICBQYXJhbWV0ZXJzIGluIGBwYXJhbXNgIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBzdGF0ZS1ub3RhdGlvbiBgbmFtZWAgZXhwcmVzc2lvbi4gIFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgIHBhcmFtcyAgIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICovXG4gICAgdmFyIF9jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG5cbiAgICAgICAgLy8gUGFyc2Ugc3RhdGUtbm90YXRpb24gZXhwcmVzc2lvblxuICAgICAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgICAgICBuYW1lID0gbmFtZUV4cHIubmFtZTtcbiAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQobmFtZUV4cHIucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuXG4gICAgICAgIC8vIFNwZWNpYWwgbmFtZSBub3RhdGlvblxuICAgICAgICBpZihuYW1lID09PSAnLicgJiYgX2N1cnJlbnQpIHtcbiAgICAgICAgICBuYW1lID0gX2N1cnJlbnQubmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgICAgIHZhciByZXF1ZXN0ID0ge1xuICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgICAgbG9jYWxzOiB7fSxcbiAgICAgICAgICBwcm9taXNlOiBkZWZlcnJlZC5wcm9taXNlXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ29tcGlsZSBleGVjdXRpb24gcGhhc2VzXG4gICAgICAgIHZhciBxdWV1ZSA9ICRxdWV1ZUhhbmRsZXIuY3JlYXRlKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgICAgICB2YXIgbmV4dFN0YXRlID0gYW5ndWxhci5jb3B5KF9nZXRTdGF0ZShuYW1lKSk7XG4gICAgICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgICAgICBpZihuZXh0U3RhdGUpIHtcbiAgICAgICAgICAvLyBTZXQgbG9jYWxzXG4gICAgICAgICAgbmV4dFN0YXRlLmxvY2FscyA9IHJlcXVlc3QubG9jYWxzO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNldCBwYXJhbWV0ZXJzXG4gICAgICAgICAgbmV4dFN0YXRlLnBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5leHRTdGF0ZS5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgICAgICBpZihuZXh0U3RhdGUgPT09IG51bGwpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvck5vdEZvdW5kJywgZXJyb3IsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dChlcnJvcik7XG4gICAgICAgICAgfSwgMjAwKTtcblxuICAgICAgICAvLyBTdGF0ZSBub3QgY2hhbmdlZFxuICAgICAgICB9IGVsc2UgaWYoX2NvbXBhcmVTdGF0ZXMocHJldlN0YXRlLCBuZXh0U3RhdGUpKSB7XG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0sIDIwMCk7XG4gICAgICAgICAgXG4gICAgICAgIC8vIFZhbGlkIHN0YXRlIGV4aXN0c1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgLy8gUHJvY2VzcyBzdGFydGVkXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlQmVnaW4nLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9LCAyMDEpO1xuXG4gICAgICAgICAgLy8gTWFrZSBzdGF0ZSBjaGFuZ2VcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgaWYocHJldlN0YXRlKSBfcHVzaEhpc3RvcnkocHJldlN0YXRlKTtcbiAgICAgICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSwgMjAwKTtcblxuICAgICAgICAgIC8vIEFkZCBtaWRkbGV3YXJlXG4gICAgICAgICAgcXVldWUuYWRkKF9sYXllckxpc3QpO1xuXG4gICAgICAgICAgLy8gUHJvY2VzcyBlbmRlZFxuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVuZCcsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0sIC0yMDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUnVuXG4gICAgICAgIHF1ZXVlLmV4ZWN1dGUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yJywgZXJyLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSB0byBzdGF0ZSBhbmQgYnJvYWRjYXN0IGNvbXBsZXRpb25cbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvbiBpbmNsdWRpbmcgb3B0aW9uYWwgcGFyYW1ldGVyc1xuICAgICAqIEBwYXJhbSAge09iamVjdH0gIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIG9jY3Vyc1xuICAgICAqL1xuICAgIHZhciBfY2hhbmdlU3RhdGVBbmRCcm9hZGNhc3RDb21wbGV0ZSA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgICAgcmV0dXJuIF9jaGFuZ2VTdGF0ZShuYW1lLCBwYXJhbXMpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlQ29tcGxldGUnLCBudWxsLCBfY3VycmVudCk7XG4gICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VDb21wbGV0ZScsIGVyciwgX2N1cnJlbnQpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJlbG9hZHMgdGhlIGN1cnJlbnQgc3RhdGVcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIG9jY3Vyc1xuICAgICAqL1xuICAgIHZhciBfcmVsb2FkU3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG4gPSBfY3VycmVudC5uYW1lO1xuICAgICAgICB2YXIgcCA9IGFuZ3VsYXIuY29weShfY3VycmVudC5wYXJhbXMpO1xuICAgICAgICBpZighX2N1cnJlbnQucGFyYW1zKSB7XG4gICAgICAgICAgX2N1cnJlbnQucGFyYW1zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgX2N1cnJlbnQucGFyYW1zLmRlcHJlY2F0ZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIE5vdGlmeVxuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZVJlbG9hZCcsIG51bGwsIF9jdXJyZW50KTtcblxuICAgICAgICBfY2hhbmdlU3RhdGVBbmRCcm9hZGNhc3RDb21wbGV0ZShuLCBwKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICAvLyBJbnN0YW5jZVxuICAgIHZhciBfaW5zdDtcbiAgICBfaW5zdCA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBHZXQgb3B0aW9uc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBjb25maWd1cmVkIG9wdGlvbnNcbiAgICAgICAqL1xuICAgICAgb3B0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIEhhc24ndCBiZWVuIGluaXRpYWxpemVkXG4gICAgICAgIGlmKCFfb3B0aW9ucykge1xuICAgICAgICAgIF9vcHRpb25zID0gYW5ndWxhci5jb3B5KF9jb25maWd1cmF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfb3B0aW9ucztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0L2dldCBzdGF0ZS4gUmVsb2FkcyBzdGF0ZSBpZiBjdXJyZW50IHN0YXRlIGlzIGFmZmVjdGVkIGJ5IGRlZmluZWQgXG4gICAgICAgKiBzdGF0ZSAod2hlbiByZWRlZmluaW5nIHBhcmVudCBvciBjdXJyZW50IHN0YXRlKVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9ICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgc3RhdGU6IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgICAgIC8vIEdldFxuICAgICAgICBpZighc3RhdGUpIHtcbiAgICAgICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0XG4gICAgICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIG1pZGRsZXdhcmU7IGNhbGxlZCBkdXJpbmcgc3RhdGUgdHJhbnNpdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gaGFuZGxlciAgQSBjYWxsYmFjaywgZnVuY3Rpb24ocmVxdWVzdCwgbmV4dClcbiAgICAgICAqIEBwYXJhbSAge051bWJlcn0gICBwcmlvcml0eSBBIG51bWJlciBkZW5vdGluZyBwcmlvcml0eVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICR1c2U6IGZ1bmN0aW9uKGhhbmRsZXIsIHByaW9yaXR5KSB7XG4gICAgICAgIGlmKHR5cGVvZiBoYW5kbGVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaWRkbGV3YXJlIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiBwcmlvcml0eSAhPT0gJ3VuZGVmaW5lZCcpIGhhbmRsZXIucHJpb3JpdHkgPSBwcmlvcml0eTtcbiAgICAgICAgX2xheWVyTGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBwZXJmb3JtIGluaXRpYWxpemF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHJlYWR5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmKCFfaXNJbml0KSB7XG4gICAgICAgICAgICBfaXNJbml0ID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gQ29uZmlndXJhdGlvblxuICAgICAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgICAgIF9vcHRpb25zID0gYW5ndWxhci5jb3B5KF9jb25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgICAgICAgaWYoX29wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2luaXRpYWxMb2NhdGlvbicpKSB7XG4gICAgICAgICAgICAgIF9pbml0YWxMb2NhdGlvbiA9IGFuZ3VsYXIuY29weShfb3B0aW9ucy5pbml0aWFsTG9jYXRpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmVhZHlEZWZlcnJlZCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICAgIGlmKCRsb2NhdGlvbi51cmwoKSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgcmVhZHlEZWZlcnJlZCA9IF9pbnN0LiRsb2NhdGlvbigkbG9jYXRpb24udXJsKCkpO1xuXG4gICAgICAgICAgICAvLyBJbml0aWFsaXplIHdpdGggc3RhdGVcbiAgICAgICAgICAgIH0gZWxzZSBpZihfaW5pdGFsTG9jYXRpb24pIHtcbiAgICAgICAgICAgICAgcmVhZHlEZWZlcnJlZCA9IF9jaGFuZ2VTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlKF9pbml0YWxMb2NhdGlvbi5uYW1lLCBfaW5pdGFsTG9jYXRpb24ucGFyYW1zKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJHEud2hlbihyZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUluaXQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLy8gUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICAgIHBhcnNlOiBfcGFyc2VOYW1lLFxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIGFsbCBkZWZpbmVkIHN0YXRlc1xuICAgICAgICovXG4gICAgICBsaWJyYXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9zdGF0ZUxpYnJhcnk7XG4gICAgICB9LFxuXG4gICAgICAvLyBWYWxpZGF0aW9uXG4gICAgICB2YWxpZGF0ZToge1xuICAgICAgICBuYW1lOiBfdmFsaWRhdGVTdGF0ZU5hbWUsXG4gICAgICAgIHF1ZXJ5OiBfdmFsaWRhdGVTdGF0ZVF1ZXJ5XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGhpc3RvcnlcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXG4gICAgICAgKi9cbiAgICAgIGhpc3Rvcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX2hpc3Rvcnk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlcXVlc3Qgc3RhdGUgdHJhbnNpdGlvbiwgYXN5bmNocm9ub3VzIG9wZXJhdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIGNvbXBsZXRlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBfY2hhbmdlU3RhdGVBbmRCcm9hZGNhc3RDb21wbGV0ZShuYW1lLCBwYXJhbXMpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZWxvYWRzIHRoZSBjdXJyZW50IHN0YXRlXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICAgKi9cbiAgICAgIHJlbG9hZDogX3JlbG9hZFN0YXRlLFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBjaGFuZ2Ugc3RhdGUgYmFzZWQgb24gJGxvY2F0aW9uLnVybCgpLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uIHVzaW5nIGludGVybmFsIG1ldGhvZHMsIHF1aWV0IGZhbGxiYWNrLiAgXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICB1cmwgICAgICAgIEEgdXJsIG1hdGNoaW5nIGRlZmluZCBzdGF0ZXNcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSAgICBbY2FsbGJhY2tdIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRsb2NhdGlvbjogZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHZhciBkYXRhID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICAgICAgaWYoc3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtcyBmcm9tIHVybFxuICAgICAgICAgICAgcmV0dXJuIF9jaGFuZ2VTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlKHN0YXRlLm5hbWUsIGRhdGEucGFyYW1zKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZighIXVybCAmJiB1cmwgIT09ICcnKSB7XG4gICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3JOb3RGb3VuZCcsIGVycm9yLCB7XG4gICAgICAgICAgICB1cmw6IHVybFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICRxLnJlamVjdChuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIGxvY2F0aW9uIGluIGxpYnJhcnknKSk7XG4gICAgICB9LFxuICAgICAgXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGN1cnJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7TWl4ZWR9ICAgcXVlcnkgIEEgc3RyaW5nIHVzaW5nIHN0YXRlIG5vdGF0aW9uIG9yIGEgUmVnRXhwXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGFjdGl2ZTogZnVuY3Rpb24ocXVlcnksIHBhcmFtcykge1xuICAgICAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgLy8gTm8gc3RhdGVcbiAgICAgICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICAgICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAgICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICAgICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X10qJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gX2luc3Q7XG4gIH1dO1xuXG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyRsb2NhdGlvbicsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24sICRyb290U2NvcGUpIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYoY3VycmVudCAmJiBjdXJyZW50LnVybCkge1xuICAgICAgdmFyIHBhdGg7XG4gICAgICBwYXRoID0gY3VycmVudC51cmw7XG5cbiAgICAgIC8vIEFkZCBwYXJhbWV0ZXJzIG9yIHVzZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAgICAgIHZhciBwYXJhbXMgPSBjdXJyZW50LnBhcmFtcyB8fCB7fTtcbiAgICAgIHZhciBxdWVyeSA9IHt9O1xuICAgICAgZm9yKHZhciBuYW1lIGluIHBhcmFtcykge1xuICAgICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKCc6JytuYW1lLCAnZycpO1xuICAgICAgICBpZihwYXRoLm1hdGNoKHJlKSkge1xuICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UocmUsIHBhcmFtc1tuYW1lXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcXVlcnlbbmFtZV0gPSBwYXJhbXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgJGxvY2F0aW9uLnBhdGgocGF0aCk7XG4gICAgICAkbG9jYXRpb24uc2VhcmNoKHF1ZXJ5KTtcbiAgICAgIFxuICAgICAgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgX3NlbGYubG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgJHN0YXRlLiRsb2NhdGlvbihfdXJsKTtcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvY2F0aW9uU3RhdGVVcGRhdGUnKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgICovXG4gIF9zZWxmLiRyZWFkeSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgJHN0YXRlLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgICAgX3VwZGF0ZSgpO1xuICAgICAgbmV4dCgpO1xuICAgIH0pO1xuICAgIFxuICB9O1xuXG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBhcnNlIE9iamVjdCBsaXRlcmFsIG5hbWUtdmFsdWUgcGFpcnNcbnZhciByZVBhcnNlT2JqZWN0TGl0ZXJhbCA9IC8oWyx7XVxccyooKFwifCcpKC4qPylcXDN8XFx3Kil8KDpcXHMqKFsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT98dHJ1ZXxmYWxzZXxudWxsfChcInwnKSguKj8pXFw3fFxcW1teXFxdXSpcXF0pKSkvZztcblxuLy8gTWF0Y2ggU3RyaW5nc1xudmFyIHJlU3RyaW5nID0gL14oXCJ8JykoLio/KVxcMSQvO1xuXG4vLyBUT0RPIEFkZCBlc2NhcGVkIHN0cmluZyBxdW90ZXMgXFwnIGFuZCBcXFwiIHRvIHN0cmluZyBtYXRjaGVyXG5cbi8vIE1hdGNoIE51bWJlciAoaW50L2Zsb2F0L2V4cG9uZW50aWFsKVxudmFyIHJlTnVtYmVyID0gL15bKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/JC87XG5cbi8qKlxuICogUGFyc2Ugc3RyaW5nIHZhbHVlIGludG8gQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGwuXG4gKlxuICogU3RyaW5ncyBhcmUgc3Vycm91bmRlZCBieSBhIHBhaXIgb2YgbWF0Y2hpbmcgcXVvdGVzXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdmFsdWUgQSBTdHJpbmcgdmFsdWUgdG8gcGFyc2VcbiAqIEByZXR1cm4ge01peGVkfSAgICAgICAgQSBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbFxuICovXG52YXIgX3Jlc29sdmVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cbiAgLy8gQm9vbGVhbjogdHJ1ZVxuICBpZih2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgLy8gQm9vbGVhbjogZmFsc2VcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE51bGxcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnbnVsbCcpIHtcbiAgICByZXR1cm4gbnVsbDtcblxuICAvLyBTdHJpbmdcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlU3RyaW5nKSkge1xuICAgIHJldHVybiB2YWx1ZS5zdWJzdHIoMSwgdmFsdWUubGVuZ3RoLTIpO1xuXG4gIC8vIE51bWJlclxuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVOdW1iZXIpKSB7XG4gICAgcmV0dXJuICt2YWx1ZTtcblxuICAvLyBOYU5cbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnTmFOJykge1xuICAgIHJldHVybiBOYU47XG5cbiAgLy8gVE9ETyBhZGQgbWF0Y2hpbmcgd2l0aCBBcnJheXMgYW5kIHBhcnNlXG4gIFxuICB9XG5cbiAgLy8gVW5hYmxlIHRvIHJlc29sdmVcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gRmluZCB2YWx1ZXMgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbnZhciBfbGlzdGlmeSA9IGZ1bmN0aW9uKHN0cikge1xuXG4gIC8vIFRyaW1cbiAgc3RyID0gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuXG4gIGlmKHN0ci5tYXRjaCgvXlxccyp7Lip9XFxzKiQvKSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVycyBleHBlY3RzIGFuIE9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHNhbml0aXplTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9eW1xceyxdP1xccypbXCInXT8vLCAnJykucmVwbGFjZSgvW1wiJ10/XFxzKiQvLCAnJyk7XG4gIH07XG5cbiAgdmFyIHNhbml0aXplVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzdHIgPSB2YWx1ZS5yZXBsYWNlKC9eKDopP1xccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgcmV0dXJuIF9yZXNvbHZlVmFsdWUoc3RyKTtcbiAgfTtcblxuICByZXR1cm4gc3RyLm1hdGNoKHJlUGFyc2VPYmplY3RMaXRlcmFsKS5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIHJldHVybiBpJTIgPT09IDAgPyBzYW5pdGl6ZU5hbWUoaXRlbSkgOiBzYW5pdGl6ZVZhbHVlKGl0ZW0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFyYW1zIE9iamVjdCBmcm9tIHN0cmluZ1xuICogXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5naWZpZWQgdmVyc2lvbiBvZiBPYmplY3QgbGl0ZXJhbFxuICovXG52YXIgUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHN0cikge1xuICBzdHIgPSBzdHIgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgX2xpc3RpZnkoc3RyKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICBpZihpJTIgPT09IDApIHtcbiAgICAgIF9zZWxmW2l0ZW1dID0gbGlzdFtpKzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYXJhbWV0ZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5yZXNvbHZlVmFsdWUgPSBfcmVzb2x2ZVZhbHVlO1xubW9kdWxlLmV4cG9ydHMubGlzdGlmeSA9IF9saXN0aWZ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsID0gcmVxdWlyZSgnLi91cmwnKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBVcmxEaWN0aW9uYXJ5KCkge1xuICB0aGlzLl9wYXR0ZXJucyA9IFtdO1xuICB0aGlzLl9yZWZzID0gW107XG4gIHRoaXMuX3BhcmFtcyA9IFtdO1xufVxuXG4vKipcbiAqIEFzc29jaWF0ZSBhIFVSTCBwYXR0ZXJuIHdpdGggYSByZWZlcmVuY2VcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSBwYXR0ZXJuIEEgVVJMIHBhdHRlcm5cbiAqIEBwYXJhbSAge09iamVjdH0gcmVmICAgICBBIGRhdGEgT2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHBhdHRlcm4sIHJlZikge1xuICBwYXR0ZXJuID0gcGF0dGVybiB8fCAnJztcbiAgdmFyIF9zZWxmID0gdGhpcztcbiAgdmFyIGkgPSB0aGlzLl9wYXR0ZXJucy5sZW5ndGg7XG5cbiAgdmFyIHBhdGhDaGFpbjtcbiAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gIGlmKHBhdHRlcm4uaW5kZXhPZignPycpID09PSAtMSkge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcblxuICB9IGVsc2Uge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcbiAgfVxuXG4gIC8vIFN0YXJ0XG4gIHZhciBzZWFyY2hFeHByID0gJ14nO1xuXG4gIC8vIEl0ZW1zXG4gIChwYXRoQ2hhaW4uZm9yRWFjaChmdW5jdGlvbihjaHVuaywgaSkge1xuICAgIGlmKGkhPT0wKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdcXFxcLyc7XG4gICAgfVxuXG4gICAgaWYoY2h1bmtbMF0gPT09ICc6Jykge1xuICAgICAgc2VhcmNoRXhwciArPSAnW15cXFxcLz9dKic7XG4gICAgICBwYXJhbXNbY2h1bmsuc3Vic3RyaW5nKDEpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc2VhcmNoRXhwciArPSBjaHVuaztcbiAgICB9XG4gIH0pKTtcblxuICAvLyBFbmRcbiAgc2VhcmNoRXhwciArPSAnW1xcXFwvXT8kJztcblxuICB0aGlzLl9wYXR0ZXJuc1tpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG4gIHRoaXMuX3JlZnNbaV0gPSByZWY7XG4gIHRoaXMuX3BhcmFtc1tpXSA9IHBhcmFtcztcbn07XG5cbi8qKlxuICogRmluZCBhIHJlZmVyZW5jZSBhY2NvcmRpbmcgdG8gYSBVUkwgcGF0dGVybiBhbmQgcmV0cmlldmUgcGFyYW1zIGRlZmluZWQgaW4gVVJMXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdXJsICAgICAgQSBVUkwgdG8gdGVzdCBmb3JcbiAqIEBwYXJhbSAge09iamVjdH0gZGVmYXVsdHMgQSBkYXRhIE9iamVjdCBvZiBkZWZhdWx0IHBhcmFtZXRlciB2YWx1ZXNcbiAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgQSByZWZlcmVuY2UgdG8gYSBzdG9yZWQgb2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uKHVybCwgZGVmYXVsdHMpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuICB2YXIgcCA9IFVybCh1cmwpLnBhdGgoKTtcbiAgdmFyIHEgPSBVcmwodXJsKS5xdWVyeXBhcmFtcygpO1xuXG4gIHZhciBfc2VsZiA9IHRoaXM7XG5cbiAgLy8gQ2hlY2sgZGljdGlvbmFyeVxuICB2YXIgX2ZpbmRQYXR0ZXJuID0gZnVuY3Rpb24oY2hlY2spIHtcbiAgICBjaGVjayA9IGNoZWNrIHx8ICcnO1xuICAgIGZvcih2YXIgaT1fc2VsZi5fcGF0dGVybnMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoY2hlY2subWF0Y2goX3NlbGYuX3BhdHRlcm5zW2ldKSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIHZhciBpID0gX2ZpbmRQYXR0ZXJuKHApO1xuICBcbiAgLy8gTWF0Y2hpbmcgcGF0dGVybiBmb3VuZFxuICBpZihpICE9PSAtMSkge1xuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHBhdHRlcm4gbWF0Y2hcbiAgICB2YXIgcGFyYW1zID0ge307XG4gICAgZm9yKHZhciBuIGluIHRoaXMuX3BhcmFtc1tpXSkge1xuICAgICAgdmFyIHBhcmFtUGFyc2VyID0gdGhpcy5fcGFyYW1zW2ldW25dO1xuICAgICAgdmFyIHVybE1hdGNoID0gKHVybC5tYXRjaChwYXJhbVBhcnNlcikgfHwgW10pLnBvcCgpIHx8ICcnO1xuICAgICAgdmFyIHZhck1hdGNoID0gdXJsTWF0Y2guc3BsaXQoJy8nKS5wb3AoKTtcbiAgICAgIHBhcmFtc1tuXSA9IHZhck1hdGNoO1xuICAgIH1cblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBxdWVyeXN0cmluZyBtYXRjaFxuICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHEsIHBhcmFtcyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdXJsOiB1cmwsXG4gICAgICByZWY6IHRoaXMuX3JlZnNbaV0sXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG5cbiAgLy8gTm90IGluIGRpY3Rpb25hcnlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcmxEaWN0aW9uYXJ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBVcmwodXJsKSB7XG4gIHVybCA9IHVybCB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBhdGggb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyB1cmwgOiB1cmwuc3Vic3RyaW5nKDAsIHVybC5pbmRleE9mKCc/JykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5c3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICcnIDogdXJsLnN1YnN0cmluZyh1cmwuaW5kZXhPZignPycpKzEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMIHBhcmFtZXRlcnMgYXMgYSBoYXNoXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5cGFyYW1zOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYWlycyA9IF9zZWxmLnF1ZXJ5c3RyaW5nKCkuc3BsaXQoJyYnKTtcbiAgICAgIHZhciBwYXJhbXMgPSB7fTtcblxuICAgICAgZm9yKHZhciBpPTA7IGk8cGFpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYocGFpcnNbaV0gPT09ICcnKSBjb250aW51ZTtcbiAgICAgICAgdmFyIG5hbWVWYWx1ZSA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgIHBhcmFtc1tuYW1lVmFsdWVbMF1dID0gKHR5cGVvZiBuYW1lVmFsdWVbMV0gPT09ICd1bmRlZmluZWQnIHx8IG5hbWVWYWx1ZVsxXSA9PT0gJycpID8gdHJ1ZSA6IGRlY29kZVVSSUNvbXBvbmVudChuYW1lVmFsdWVbMV0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
