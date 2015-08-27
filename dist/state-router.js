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
  
  .factory('$queueHandler', require('./services/queue-handler'))

  .run(['$rootScope', '$state', '$urlManager', '$resolution', function($rootScope, $state, $urlManager, $resolution) {
    // Update location changes
    $rootScope.$on('$locationChangeSuccess', function() {
      $urlManager.location(arguments);
    });

    // Initialize
    $state.$ready();
  }])

  .directive('sref', require('./directives/sref'));

},{"./directives/sref":1,"./services/queue-handler":3,"./services/resolution":4,"./services/state-router":5,"./services/url-manager":6}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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
  var _register = function(request, next) {
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
  _register.priority = 100;

  // Register middleware layer
  $state.$use(_register);

  return _self;
}];

},{}],5:[function(require,module,exports){
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

        if(item && i !== nameChain.length-1) {
          delete(item.resolve);
          delete(item.templates);
        }

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

    // Current state
    var _current;

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
     * Internal method to change to state.  Parameters in `params` takes precedence over state-notation `name` expression.  
     * 
     * @param  {String}  name   A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}  params A data object of params
     * @return {Promise}        A promise fulfilled when state change occurs
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
        queue.execute(function(err) {
          if(err) {
            $rootScope.$broadcast('$stateChangeError', err, request);
            deferred.reject(err);

          } else {
            deferred.resolve(request);
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

        // Reload
        if(_current) {
          var nameChain = _getNameChain(_current.name);
          if(nameChain.indexOf(name) !== -1) {
            _changeState(_current.name);
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

},{"../utils/parameters":7,"../utils/url-dictionary":8}],6:[function(require,module,exports){
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

},{"../utils/url-dictionary":8}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{"./url":9}],9:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3F1ZXVlLWhhbmRsZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9yZXNvbHV0aW9uLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvc3RhdGUtcm91dGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvdXJsLW1hbmFnZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9wYXJhbWV0ZXJzLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFP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QVM7O01BRWIsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sUUFBUSxLQUFLO1FBQ2hDLEdBQUcsTUFBTSxPQUFPLElBQUk7UUFDcEIsSUFBSSxZQUFZLE1BQU0sR0FBRyxNQUFNO1FBQy9CLE9BQU8sVUFBVSxNQUFNLENBQUMsT0FBTyxVQUFVLE9BQU8sZUFBZSxVQUFVLE9BQU8sTUFBTSxPQUFPLFVBQVU7OztNQUd6RyxPQUFPOzs7O0VBSVgsT0FBTzs7O0FBR1QsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsIGZ1bmN0aW9uICgkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZS5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gSW5zdGFudGlhdGUgbW9kdWxlXG5hbmd1bGFyLm1vZHVsZSgnYW5ndWxhci1zdGF0ZS1yb3V0ZXInLCBbXSlcblxuICAucHJvdmlkZXIoJyRzdGF0ZScsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5mYWN0b3J5KCckcmVzb2x1dGlvbicsIHJlcXVpcmUoJy4vc2VydmljZXMvcmVzb2x1dGlvbicpKVxuICBcbiAgLmZhY3RvcnkoJyRxdWV1ZUhhbmRsZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3F1ZXVlLWhhbmRsZXInKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckc3RhdGUnLCAnJHVybE1hbmFnZXInLCAnJHJlc29sdXRpb24nLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkc3RhdGUsICR1cmxNYW5hZ2VyLCAkcmVzb2x1dGlvbikge1xuICAgIC8vIFVwZGF0ZSBsb2NhdGlvbiBjaGFuZ2VzXG4gICAgJHJvb3RTY29wZS4kb24oJyRsb2NhdGlvbkNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbigpIHtcbiAgICAgICR1cmxNYW5hZ2VyLmxvY2F0aW9uKGFyZ3VtZW50cyk7XG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWFsaXplXG4gICAgJHN0YXRlLiRyZWFkeSgpO1xuICB9XSlcblxuICAuZGlyZWN0aXZlKCdzcmVmJywgcmVxdWlyZSgnLi9kaXJlY3RpdmVzL3NyZWYnKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHJvb3RTY29wZSkge1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgc2VyaWVzIG9mIGZ1bmN0aW9uczsgdXNlZCBpbiB0YW5kZW0gd2l0aCBtaWRkbGV3YXJlXG4gICAqL1xuICB2YXIgUXVldWUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2xpc3QgPSBbXTtcbiAgICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gICAgdmFyIF9zZWxmID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEFkZCBhIGhhbmRsZXJcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtIHtNaXhlZH0gIGhhbmRsZXIgQSBGdW5jdGlvbiBvciBhbiBBcnJheSBvZiBGdW5jdGlvbnMgdG8gYWRkIHRvIHRoZSBxdWV1ZVxuICAgICAgICogQHJldHVybiB7UXVldWV9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgYWRkOiBmdW5jdGlvbihoYW5kbGVyLCBwcmlvcml0eSkge1xuICAgICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgaGFuZGxlci5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICAgICAgICBsYXllci5wcmlvcml0eSA9IHR5cGVvZiBsYXllci5wcmlvcml0eSA9PT0gJ3VuZGVmaW5lZCcgPyAxIDogbGF5ZXIucHJpb3JpdHk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFuZGxlci5wcmlvcml0eSA9IHByaW9yaXR5IHx8ICh0eXBlb2YgaGFuZGxlci5wcmlvcml0eSA9PT0gJ3VuZGVmaW5lZCcgPyAxIDogaGFuZGxlci5wcmlvcml0eSk7XG4gICAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogRGF0YSBvYmplY3RcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgZGF0YSBvYmplY3QgbWFkZSBhdmFpbGFibGUgdG8gZWFjaCBoYW5kbGVyXG4gICAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgZGF0YTogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBfZGF0YSA9IGRhdGE7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBCZWdpbiBleGVjdXRpb24gYW5kIHRyaWdnZXIgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7UXVldWV9ICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgICAgdmFyIGV4ZWN1dGlvbkxpc3QgPSBfbGlzdC5zbGljZSgwKS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5KSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSBleGVjdXRpb25MaXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgICAgIC8vIENvbXBsZXRlXG4gICAgICAgICAgICBpZighaGFuZGxlcikge1xuICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcblxuICAgICAgICAgICAgLy8gTmV4dCBoYW5kbGVyXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN0YXJ0XG4gICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICB9XG5cbiAgICB9O1xuICAgIFxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvLyBJbnN0YW5jZVxuICByZXR1cm4ge1xuXG4gICAgLyoqXG4gICAgICogRmFjdG9yeSBtZXRob2RcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gQSBxdWV1ZVxuICAgICAqL1xuICAgIGNyZWF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gUXVldWUoKTtcbiAgICB9XG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRxJywgJyRpbmplY3RvcicsICckc3RhdGUnLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCRxLCAkaW5qZWN0b3IsICRzdGF0ZSwgJHJvb3RTY29wZSkge1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICByZXNvbHZlIEEgaGFzaCBPYmplY3Qgb2YgaXRlbXMgdG8gcmVzb2x2ZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0ZW1wbGF0ZXMgcmV0aXJldmVkXG4gICAqL1xuICB2YXIgX3Jlc29sdmUgPSBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgdmFyIHJlc29sdmVzUHJvbWlzZXMgPSB7fTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvbHZlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlLCBudWxsLCBudWxsLCBrZXkpO1xuICAgICAgcmVzb2x2ZXNQcm9taXNlc1trZXldID0gJHEud2hlbihyZXNvbHV0aW9uKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwocmVzb2x2ZXNQcm9taXNlcyk7XG4gIH07XG4gIF9zZWxmLnJlc29sdmUgPSBfcmVzb2x2ZTtcblxuICAvKipcbiAgICogTWlkZGxld2FyZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlcXVlc3QgQSBkYXRhIE9iamVjdFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gbmV4dCAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX3JlZ2lzdGVyID0gZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlKGN1cnJlbnQucmVzb2x2ZSB8fCB7fSkudGhlbihmdW5jdGlvbihsb2NhbHMpIHtcbiAgICAgIGFuZ3VsYXIuZXh0ZW5kKHJlcXVlc3QubG9jYWxzLCBsb2NhbHMpO1xuICAgICAgbmV4dCgpO1xuXG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yUmVzb2x2ZScsIGVycik7XG4gICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcmVzb2x2aW5nIHN0YXRlJykpO1xuICAgIH0pO1xuICB9O1xuICBfcmVnaXN0ZXIucHJpb3JpdHkgPSAxMDA7XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShfcmVnaXN0ZXIpO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbZnVuY3Rpb24gU3RhdGVSb3V0ZXJQcm92aWRlcigpIHtcbiAgLy8gUHJvdmlkZXJcbiAgdmFyIF9wcm92aWRlciA9IHRoaXM7XG5cbiAgLy8gQ29uZmlndXJhdGlvbiwgZ2xvYmFsIG9wdGlvbnNcbiAgdmFyIF9jb25maWd1cmF0aW9uID0ge1xuICAgIGhpc3RvcnlMZW5ndGg6IDVcbiAgfTtcblxuICAvLyBTdGF0ZSBkZWZpbml0aW9uIGxpYnJhcnlcbiAgdmFyIF9zdGF0ZUxpYnJhcnkgPSB7fTtcbiAgdmFyIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgLy8gVVJMIHRvIHN0YXRlIGRpY3Rpb25hcnlcbiAgdmFyIF91cmxEaWN0aW9uYXJ5ID0gbmV3IFVybERpY3Rpb25hcnkoKTtcblxuICAvLyBNaWRkbGV3YXJlIGxheWVyc1xuICB2YXIgX2xheWVyTGlzdCA9IFtdO1xuXG4gIC8qKlxuICAgKiBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgKiBcbiAgICogQXNzdW1lIGFsbCBwYXJhbWV0ZXIgdmFsdWVzIGFyZSBzdHJpbmdzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVQYXJhbXMgQSBuYW1lLXBhcmFtcyBzdHJpbmdcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIHZhciBfcGFyc2VOYW1lID0gZnVuY3Rpb24obmFtZVBhcmFtcykge1xuICAgIGlmKG5hbWVQYXJhbXMgJiYgbmFtZVBhcmFtcy5tYXRjaCgvXlthLXpBLVowLTlfXFwuXSpcXCguKlxcKSQvKSkge1xuICAgICAgdmFyIG5wYXJ0ID0gbmFtZVBhcmFtcy5zdWJzdHJpbmcoMCwgbmFtZVBhcmFtcy5pbmRleE9mKCcoJykpO1xuICAgICAgdmFyIHBwYXJ0ID0gUGFyYW1ldGVycyggbmFtZVBhcmFtcy5zdWJzdHJpbmcobmFtZVBhcmFtcy5pbmRleE9mKCcoJykrMSwgbmFtZVBhcmFtcy5sYXN0SW5kZXhPZignKScpKSApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBucGFydCxcbiAgICAgICAgcGFyYW1zOiBwcGFydFxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuYW1lUGFyYW1zLFxuICAgICAgICBwYXJhbXM6IG51bGxcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgZGVmYXVsdCB2YWx1ZXMgdG8gYSBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3NldFN0YXRlRGVmYXVsdHMgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgLy8gRGVmYXVsdCB2YWx1ZXNcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goL1thLXpBLVowLTlfXSsvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIHF1ZXJ5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHF1ZXJ5IEEgcXVlcnkgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBxdWVyeS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvKFxcKihcXCopP3xbYS16QS1aMC05X10rKS8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGFyZSB0d28gc3RhdGVzLCBjb21wYXJlcyB2YWx1ZXMuICBcbiAgICogXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3RhdGVzIGFyZSB0aGUgc2FtZSwgZmFsc2UgaWYgc3RhdGVzIGFyZSBkaWZmZXJlbnRcbiAgICovXG4gIHZhciBfY29tcGFyZVN0YXRlcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICBhID0gYSB8fCB7fTtcbiAgICBiID0gYiB8fCB7fTtcbiAgICByZXR1cm4gYS5uYW1lID09PSBiLm5hbWUgJiYgYW5ndWxhci5lcXVhbHMoYS5wYXJhbXMsIGIucGFyYW1zKTtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGEgbGlzdCBvZiBwYXJlbnQgc3RhdGVzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtBcnJheX0gICAgICAgICBBbiBBcnJheSBvZiBwYXJlbnQgc3RhdGVzXG4gICAqL1xuICB2YXIgX2dldE5hbWVDaGFpbiA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbmFtZUxpc3QgPSBuYW1lLnNwbGl0KCcuJyk7XG5cbiAgICByZXR1cm4gbmFtZUxpc3RcbiAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgICAgICByZXR1cm4gbGlzdC5zbGljZSgwLCBpKzEpLmpvaW4oJy4nKTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0gIT09IG51bGw7XG4gICAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNyYXdsIGxpYnJhcnkgaGVpcmFyY2h5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICB2YXIgc3RhdGUgPSBudWxsO1xuXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgcXVlcmllc1xuICAgIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIC8vIFVzZSBjYWNoZSBpZiBleGlzdHNcbiAgICB9IGVsc2UgaWYoX3N0YXRlQ2FjaGVbbmFtZV0pIHtcbiAgICAgIHJldHVybiBfc3RhdGVDYWNoZVtuYW1lXTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZUNoYWluID0gX2dldE5hbWVDaGFpbihuYW1lKTtcbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihuYW1lLCBpKSB7XG4gICAgICAgIHZhciBpdGVtID0gYW5ndWxhci5jb3B5KF9zdGF0ZUxpYnJhcnlbbmFtZV0pO1xuXG4gICAgICAgIGlmKGl0ZW0gJiYgaSAhPT0gbmFtZUNoYWluLmxlbmd0aC0xKSB7XG4gICAgICAgICAgZGVsZXRlKGl0ZW0ucmVzb2x2ZSk7XG4gICAgICAgICAgZGVsZXRlKGl0ZW0udGVtcGxhdGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICAgIHJldHVybiAhIXBhcmVudDtcbiAgICAgIH0pO1xuXG4gICAgLy8gV2FsayB1cCBjaGVja2luZyBpbmhlcml0YW5jZVxuICAgIGZvcih2YXIgaT1zdGF0ZUNoYWluLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKHN0YXRlQ2hhaW5baV0pIHtcbiAgICAgICAgdmFyIG5leHRTdGF0ZSA9IHN0YXRlQ2hhaW5baV07XG4gICAgICAgIHN0YXRlID0gYW5ndWxhci5tZXJnZShuZXh0U3RhdGUsIHN0YXRlIHx8IHt9KTtcbiAgICAgIH1cblxuICAgICAgaWYoc3RhdGUgJiYgc3RhdGUuaW5oZXJpdCA9PT0gZmFsc2UpIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFN0b3JlIGluIGNhY2hlXG4gICAgX3N0YXRlQ2FjaGVbbmFtZV0gPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHN0b3JlIGEgc3RhdGUgZGVmaW5pdGlvbi4gIFBhcmFtZXRlcnMgc2hvdWxkIGJlIGluY2x1ZGVkIGluIGRhdGEgT2JqZWN0IG5vdCBzdGF0ZSBuYW1lLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2RlZmluZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKG5hbWUgPT09IG51bGwgfHwgdHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05hbWUgY2Fubm90IGJlIG51bGwuJyk7XG4gICAgXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgbmFtZXNcbiAgICB9IGVsc2UgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0YXRlIG5hbWUuJyk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHN0YXRlXG4gICAgdmFyIHN0YXRlID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXG4gICAgLy8gVXNlIGRlZmF1bHRzXG4gICAgX3NldFN0YXRlRGVmYXVsdHMoc3RhdGUpO1xuXG4gICAgLy8gTmFtZWQgc3RhdGVcbiAgICBzdGF0ZS5uYW1lID0gbmFtZTtcblxuICAgIC8vIFNldCBkZWZpbml0aW9uXG4gICAgX3N0YXRlTGlicmFyeVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgLy8gUmVzZXQgY2FjaGVcbiAgICBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gICAgLy8gVVJMIG1hcHBpbmdcbiAgICBpZihzdGF0ZS51cmwpIHtcbiAgICAgIF91cmxEaWN0aW9uYXJ5LmFkZChzdGF0ZS51cmwsIHN0YXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGNvbmZpZ3VyYXRpb24gZGF0YSBwYXJhbWV0ZXJzIGZvciBTdGF0ZVJvdXRlclxuICAgKlxuICAgKiBJbmNsdWRpbmcgcGFyYW1ldGVyczpcbiAgICogXG4gICAqIC0gaGlzdG9yeUxlbmd0aCAgIHtOdW1iZXJ9IERlZmF1bHRzIHRvIDVcbiAgICogLSBpbml0aWFsTG9jYXRpb24ge09iamVjdH0gQW4gT2JqZWN0e25hbWU6U3RyaW5nLCBwYXJhbXM6T2JqZWN0fSBmb3IgaW5pdGlhbCBzdGF0ZSB0cmFuc2l0aW9uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBvcHRpb25zIEEgZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMub3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBhbmd1bGFyLmV4dGVuZChfY29uZmlndXJhdGlvbiwgb3B0aW9ucyB8fCB7fSk7XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0L2dldCBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuc3RhdGUgPSBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgIC8vIEdldFxuICAgIGlmKCFzdGF0ZSkge1xuICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICB9XG5cbiAgICAvLyBTZXRcbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuXG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGluaXRpYWxpemF0aW9uIHBhcmFtZXRlcnM7IGRlZmVycmVkIHRvICRyZWFkeSgpXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgbmFtZSAgIEEgaW5paXRhbCBzdGF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgcGFyYW1zIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIF9jb25maWd1cmF0aW9uLmluaXRpYWxMb2NhdGlvbiA9IHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGluc3RhbmNlXG4gICAqL1xuICB0aGlzLiRnZXQgPSBbJyRyb290U2NvcGUnLCAnJGxvY2F0aW9uJywgJyRxJywgJyRxdWV1ZUhhbmRsZXInLCBmdW5jdGlvbiBTdGF0ZVJvdXRlckZhY3RvcnkoJHJvb3RTY29wZSwgJGxvY2F0aW9uLCAkcSwgJHF1ZXVlSGFuZGxlcikge1xuXG4gICAgLy8gQ3VycmVudCBzdGF0ZVxuICAgIHZhciBfY3VycmVudDtcblxuICAgIHZhciBfb3B0aW9ucztcbiAgICB2YXIgX2luaXRhbExvY2F0aW9uO1xuICAgIHZhciBfaGlzdG9yeSA9IFtdO1xuICAgIHZhciBfaXNJbml0ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAgICogXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBfcHVzaEhpc3RvcnkgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgICAgIHZhciBoaXN0b3J5TGVuZ3RoID0gX29wdGlvbnMuaGlzdG9yeUxlbmd0aCB8fCA1O1xuXG4gICAgICBpZihkYXRhKSB7XG4gICAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IGhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIGhpc3RvcnlMZW5ndGgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHRvIHN0YXRlLiAgUGFyYW1ldGVycyBpbiBgcGFyYW1zYCB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgc3RhdGUtbm90YXRpb24gYG5hbWVgIGV4cHJlc3Npb24uICBcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvbiBpbmNsdWRpbmcgb3B0aW9uYWwgcGFyYW1ldGVyc1xuICAgICAqIEBwYXJhbSAge09iamVjdH0gIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIG9jY3Vyc1xuICAgICAqL1xuICAgIHZhciBfY2hhbmdlU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgICAgIC8vIFBhcnNlIHN0YXRlLW5vdGF0aW9uIGV4cHJlc3Npb25cbiAgICAgICAgdmFyIG5hbWVFeHByID0gX3BhcnNlTmFtZShuYW1lKTtcbiAgICAgICAgbmFtZSA9IG5hbWVFeHByLm5hbWU7XG4gICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5hbWVFeHByLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcblxuICAgICAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgICAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgICAgIGxvY2Fsczoge31cbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDb21waWxlIGV4ZWN1dGlvbiBwaGFzZXNcbiAgICAgICAgdmFyIHF1ZXVlID0gJHF1ZXVlSGFuZGxlci5jcmVhdGUoKS5kYXRhKHJlcXVlc3QpO1xuXG4gICAgICAgIHZhciBuZXh0U3RhdGUgPSBhbmd1bGFyLmNvcHkoX2dldFN0YXRlKG5hbWUpKTtcbiAgICAgICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgICAgIGlmKG5leHRTdGF0ZSkge1xuICAgICAgICAgIC8vIFNldCBsb2NhbHNcbiAgICAgICAgICBuZXh0U3RhdGUubG9jYWxzID0gcmVxdWVzdC5sb2NhbHM7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU2V0IHBhcmFtZXRlcnNcbiAgICAgICAgICBuZXh0U3RhdGUucGFyYW1zID0gYW5ndWxhci5leHRlbmQobmV4dFN0YXRlLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERvZXMgbm90IGV4aXN0XG4gICAgICAgIGlmKG5leHRTdGF0ZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuXG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yTm90Rm91bmQnLCBlcnJvciwgcmVxdWVzdCk7XG4gICAgICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgICAgICB9LCAyMDApO1xuXG4gICAgICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgICAgIH0gZWxzZSBpZihfY29tcGFyZVN0YXRlcyhwcmV2U3RhdGUsIG5leHRTdGF0ZSkpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSwgMjAwKTtcbiAgICAgICAgICBcbiAgICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VCZWdpbicsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0sIDIwMSk7XG5cbiAgICAgICAgICAvLyBNYWtlIHN0YXRlIGNoYW5nZVxuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBpZihwcmV2U3RhdGUpIF9wdXNoSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9LCAyMDApO1xuXG4gICAgICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRW5kJywgcmVxdWVzdCk7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSwgLTIwMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSdW5cbiAgICAgICAgcXVldWUuZXhlY3V0ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3InLCBlcnIsIHJlcXVlc3QpO1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXF1ZXN0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHRvIHN0YXRlIGFuZCBicm9hZGNhc3QgY29tcGxldGlvblxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICovXG4gICAgdmFyIF9jaGFuZ2VTdGF0ZUFuZEJyb2FkY2FzdENvbXBsZXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICByZXR1cm4gX2NoYW5nZVN0YXRlKG5hbWUsIHBhcmFtcykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VDb21wbGV0ZScsIG51bGwsIF9jdXJyZW50KTtcbiAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUNvbXBsZXRlJywgZXJyLCBfY3VycmVudCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gSW5zdGFuY2VcbiAgICB2YXIgX2luc3Q7XG4gICAgX2luc3QgPSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogR2V0IG9wdGlvbnNcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29uZmlndXJlZCBvcHRpb25zXG4gICAgICAgKi9cbiAgICAgIG9wdGlvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBIYXNuJ3QgYmVlbiBpbml0aWFsaXplZFxuICAgICAgICBpZighX29wdGlvbnMpIHtcbiAgICAgICAgICBfb3B0aW9ucyA9IGFuZ3VsYXIuY29weShfY29uZmlndXJhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX29wdGlvbnM7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldC9nZXQgc3RhdGUuIFJlbG9hZHMgc3RhdGUgaWYgY3VycmVudCBzdGF0ZSBpcyBhZmZlY3RlZCBieSBkZWZpbmVkIFxuICAgICAgICogc3RhdGUgKHdoZW4gcmVkZWZpbmluZyBwYXJlbnQgb3IgY3VycmVudCBzdGF0ZSlcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIHN0YXRlOiBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgICAgICAvLyBHZXRcbiAgICAgICAgaWYoIXN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldFxuICAgICAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuXG4gICAgICAgIC8vIFJlbG9hZFxuICAgICAgICBpZihfY3VycmVudCkge1xuICAgICAgICAgIHZhciBuYW1lQ2hhaW4gPSBfZ2V0TmFtZUNoYWluKF9jdXJyZW50Lm5hbWUpO1xuICAgICAgICAgIGlmKG5hbWVDaGFpbi5pbmRleE9mKG5hbWUpICE9PSAtMSkge1xuICAgICAgICAgICAgX2NoYW5nZVN0YXRlKF9jdXJyZW50Lm5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBtaWRkbGV3YXJlOyBjYWxsZWQgZHVyaW5nIHN0YXRlIHRyYW5zaXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259IGhhbmRsZXIgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpXG4gICAgICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICAgcHJpb3JpdHkgQSBudW1iZXIgZGVub3RpbmcgcHJpb3JpdHlcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkdXNlOiBmdW5jdGlvbihoYW5kbGVyLCBwcmlvcml0eSkge1xuICAgICAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgcHJpb3JpdHkgIT09ICd1bmRlZmluZWQnKSBoYW5kbGVyLnByaW9yaXR5ID0gcHJpb3JpdHk7XG4gICAgICAgIF9sYXllckxpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcGVyZm9ybSBpbml0aWFsaXphdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRyZWFkeTogZnVuY3Rpb24oKSB7XG4gICAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZighX2lzSW5pdCkge1xuICAgICAgICAgICAgX2lzSW5pdCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIENvbmZpZ3VyYXRpb25cbiAgICAgICAgICAgIGlmKCFfb3B0aW9ucykge1xuICAgICAgICAgICAgICBfb3B0aW9ucyA9IGFuZ3VsYXIuY29weShfY29uZmlndXJhdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICAgIGlmKF9vcHRpb25zLmhhc093blByb3BlcnR5KCdpbml0aWFsTG9jYXRpb24nKSkge1xuICAgICAgICAgICAgICBfaW5pdGFsTG9jYXRpb24gPSBhbmd1bGFyLmNvcHkoX29wdGlvbnMuaW5pdGlhbExvY2F0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlYWR5RGVmZXJyZWQgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgICBpZigkbG9jYXRpb24udXJsKCkgIT09ICcnKSB7XG4gICAgICAgICAgICAgIHJlYWR5RGVmZXJyZWQgPSBfaW5zdC4kbG9jYXRpb24oJGxvY2F0aW9uLnVybCgpKTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICAgICAgICB9IGVsc2UgaWYoX2luaXRhbExvY2F0aW9uKSB7XG4gICAgICAgICAgICAgIHJlYWR5RGVmZXJyZWQgPSBfY2hhbmdlU3RhdGVBbmRCcm9hZGNhc3RDb21wbGV0ZShfaW5pdGFsTG9jYXRpb24ubmFtZSwgX2luaXRhbExvY2F0aW9uLnBhcmFtcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICRxLndoZW4ocmVhZHlEZWZlcnJlZCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVJbml0Jyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAgICBwYXJzZTogX3BhcnNlTmFtZSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXRyaWV2ZSBkZWZpbml0aW9uIG9mIHN0YXRlc1xuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgaGFzaCBvZiBhbGwgZGVmaW5lZCBzdGF0ZXNcbiAgICAgICAqL1xuICAgICAgbGlicmFyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfc3RhdGVMaWJyYXJ5O1xuICAgICAgfSxcblxuICAgICAgLy8gVmFsaWRhdGlvblxuICAgICAgdmFsaWRhdGU6IHtcbiAgICAgICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgICAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXRyaWV2ZSBoaXN0b3J5XG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4ge1t0eXBlXX0gW2Rlc2NyaXB0aW9uXVxuICAgICAgICovXG4gICAgICBoaXN0b3J5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9oaXN0b3J5O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXF1ZXN0IHN0YXRlIHRyYW5zaXRpb24sIGFzeW5jaHJvbm91cyBvcGVyYXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBjb21wbGV0ZVxuICAgICAgICovXG4gICAgICBjaGFuZ2U6IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlQW5kQnJvYWRjYXN0Q29tcGxldGUobmFtZSwgcGFyYW1zKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgdmFyIHN0YXRlID0gZGF0YS5yZWY7XG5cbiAgICAgICAgICBpZihzdGF0ZSkge1xuICAgICAgICAgICAgLy8gUGFyc2UgcGFyYW1zIGZyb20gdXJsXG4gICAgICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlQW5kQnJvYWRjYXN0Q29tcGxldGUoc3RhdGUubmFtZSwgZGF0YS5wYXJhbXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmKCEhdXJsICYmIHVybCAhPT0gJycpIHtcbiAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvck5vdEZvdW5kJywgZXJyb3IsIHtcbiAgICAgICAgICAgIHVybDogdXJsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJHEucmVqZWN0KG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgbG9jYXRpb24gaW4gbGlicmFyeScpKTtcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8qKlxuICAgICAgICogUmV0cmlldmUgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqL1xuICAgICAgY3VycmVudDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoIV9jdXJyZW50KSA/IG51bGwgOiBhbmd1bGFyLmNvcHkoX2N1cnJlbnQpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBDaGVjayBxdWVyeSBhZ2FpbnN0IGN1cnJlbnQgc3RhdGVcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gIHtNaXhlZH0gICBxdWVyeSAgQSBzdHJpbmcgdXNpbmcgc3RhdGUgbm90YXRpb24gb3IgYSBSZWdFeHBcbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gIHBhcmFtcyBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICAgICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICBBIHRydWUgaWYgc3RhdGUgaXMgcGFyZW50IHRvIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqL1xuICAgICAgYWN0aXZlOiBmdW5jdGlvbihxdWVyeSwgcGFyYW1zKSB7XG4gICAgICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgICAgIFxuICAgICAgICAvLyBObyBzdGF0ZVxuICAgICAgICBpZighX2N1cnJlbnQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gVXNlIFJlZ0V4cCBtYXRjaGluZ1xuICAgICAgICB9IGVsc2UgaWYocXVlcnkgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKHF1ZXJ5KTtcblxuICAgICAgICAvLyBTdHJpbmc7IHN0YXRlIGRvdC1ub3RhdGlvblxuICAgICAgICB9IGVsc2UgaWYodHlwZW9mIHF1ZXJ5ID09PSAnc3RyaW5nJykge1xuXG4gICAgICAgICAgLy8gQ2FzdCBzdHJpbmcgdG8gUmVnRXhwXG4gICAgICAgICAgaWYocXVlcnkubWF0Y2goL15cXC8uKlxcLyQvKSkge1xuICAgICAgICAgICAgdmFyIGNhc3RlZCA9IHF1ZXJ5LnN1YnN0cigxLCBxdWVyeS5sZW5ndGgtMik7XG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAoY2FzdGVkKSk7XG5cbiAgICAgICAgICAvLyBUcmFuc2Zvcm0gdG8gc3RhdGUgbm90YXRpb25cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gcXVlcnlcbiAgICAgICAgICAgICAgLnNwbGl0KCcuJylcbiAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgaWYoaXRlbSA9PT0gJyonKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ1thLXpBLVowLTlfXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZihpdGVtID09PSAnKionKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ1thLXpBLVowLTlfXFxcXC5dKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLmpvaW4oJ1xcXFwuJyk7XG5cbiAgICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cCh0cmFuc2Zvcm1lZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5vbi1tYXRjaGluZ1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBfaW5zdDtcbiAgfV07XG5cbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGUnLCAnJGxvY2F0aW9uJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbigkc3RhdGUsICRsb2NhdGlvbiwgJHJvb3RTY29wZSkge1xuICB2YXIgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICAvKipcbiAgICogVXBkYXRlIFVSTCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgdmFyIF91cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZihjdXJyZW50ICYmIGN1cnJlbnQudXJsKSB7XG4gICAgICB2YXIgcGF0aDtcbiAgICAgIHBhdGggPSBjdXJyZW50LnVybDtcblxuICAgICAgLy8gQWRkIHBhcmFtZXRlcnMgb3IgdXNlIGRlZmF1bHQgcGFyYW1ldGVyc1xuICAgICAgdmFyIHBhcmFtcyA9IGN1cnJlbnQucGFyYW1zIHx8IHt9O1xuICAgICAgdmFyIHF1ZXJ5ID0ge307XG4gICAgICBmb3IodmFyIG5hbWUgaW4gcGFyYW1zKSB7XG4gICAgICAgIHZhciByZSA9IG5ldyBSZWdFeHAoJzonK25hbWUsICdnJyk7XG4gICAgICAgIGlmKHBhdGgubWF0Y2gocmUpKSB7XG4gICAgICAgICAgcGF0aCA9IHBhdGgucmVwbGFjZShyZSwgcGFyYW1zW25hbWVdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBxdWVyeVtuYW1lXSA9IHBhcmFtc1tuYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAkbG9jYXRpb24ucGF0aChwYXRoKTtcbiAgICAgICRsb2NhdGlvbi5zZWFyY2gocXVlcnkpO1xuICAgICAgXG4gICAgICBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlIHVybCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgX3NlbGYudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgX3VwZGF0ZSgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBEZXRlY3QgVVJMIGNoYW5nZSBhbmQgZGlzcGF0Y2ggc3RhdGUgY2hhbmdlXG4gICAqL1xuICBfc2VsZi5sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsYXN0VXJsID0gX3VybDtcbiAgICB2YXIgbmV4dFVybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAgIGlmKG5leHRVcmwgIT09IGxhc3RVcmwpIHtcbiAgICAgIF91cmwgPSBuZXh0VXJsO1xuXG4gICAgICAkc3RhdGUuJGxvY2F0aW9uKF91cmwpO1xuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckbG9jYXRpb25TdGF0ZVVwZGF0ZScpO1xuICAgIH1cbiAgfTtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZS4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICBfdXBkYXRlKCk7XG4gICAgbmV4dCgpO1xuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUGFyc2UgT2JqZWN0IGxpdGVyYWwgbmFtZS12YWx1ZSBwYWlyc1xudmFyIHJlUGFyc2VPYmplY3RMaXRlcmFsID0gLyhbLHtdXFxzKigoXCJ8JykoLio/KVxcM3xcXHcqKXwoOlxccyooWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspP3x0cnVlfGZhbHNlfG51bGx8KFwifCcpKC4qPylcXDd8XFxbW15cXF1dKlxcXSkpKS9nO1xuXG4vLyBNYXRjaCBTdHJpbmdzXG52YXIgcmVTdHJpbmcgPSAvXihcInwnKSguKj8pXFwxJC87XG5cbi8vIFRPRE8gQWRkIGVzY2FwZWQgc3RyaW5nIHF1b3RlcyBcXCcgYW5kIFxcXCIgdG8gc3RyaW5nIG1hdGNoZXJcblxuLy8gTWF0Y2ggTnVtYmVyIChpbnQvZmxvYXQvZXhwb25lbnRpYWwpXG52YXIgcmVOdW1iZXIgPSAvXlsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT8kLztcblxuLyoqXG4gKiBQYXJzZSBzdHJpbmcgdmFsdWUgaW50byBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbC5cbiAqXG4gKiBTdHJpbmdzIGFyZSBzdXJyb3VuZGVkIGJ5IGEgcGFpciBvZiBtYXRjaGluZyBxdW90ZXNcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB2YWx1ZSBBIFN0cmluZyB2YWx1ZSB0byBwYXJzZVxuICogQHJldHVybiB7TWl4ZWR9ICAgICAgICBBIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsXG4gKi9cbnZhciBfcmVzb2x2ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcblxuICAvLyBCb29sZWFuOiB0cnVlXG4gIGlmKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICAvLyBCb29sZWFuOiBmYWxzZVxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTnVsbFxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdudWxsJykge1xuICAgIHJldHVybiBudWxsO1xuXG4gIC8vIFN0cmluZ1xuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVTdHJpbmcpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnN1YnN0cigxLCB2YWx1ZS5sZW5ndGgtMik7XG5cbiAgLy8gTnVtYmVyXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZU51bWJlcikpIHtcbiAgICByZXR1cm4gK3ZhbHVlO1xuXG4gIC8vIE5hTlxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdOYU4nKSB7XG4gICAgcmV0dXJuIE5hTjtcblxuICAvLyBUT0RPIGFkZCBtYXRjaGluZyB3aXRoIEFycmF5cyBhbmQgcGFyc2VcbiAgXG4gIH1cblxuICAvLyBVbmFibGUgdG8gcmVzb2x2ZVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyBGaW5kIHZhbHVlcyBpbiBhbiBvYmplY3QgbGl0ZXJhbFxudmFyIF9saXN0aWZ5ID0gZnVuY3Rpb24oc3RyKSB7XG5cbiAgLy8gVHJpbVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG5cbiAgaWYoc3RyLm1hdGNoKC9eXFxzKnsuKn1cXHMqJC8pID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQYXJhbWV0ZXJzIGV4cGVjdHMgYW4gT2JqZWN0Jyk7XG4gIH1cblxuICB2YXIgc2FuaXRpemVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBuYW1lLnJlcGxhY2UoL15bXFx7LF0/XFxzKltcIiddPy8sICcnKS5yZXBsYWNlKC9bXCInXT9cXHMqJC8sICcnKTtcbiAgfTtcblxuICB2YXIgc2FuaXRpemVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHN0ciA9IHZhbHVlLnJlcGxhY2UoL14oOik/XFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbiAgICByZXR1cm4gX3Jlc29sdmVWYWx1ZShzdHIpO1xuICB9O1xuXG4gIHJldHVybiBzdHIubWF0Y2gocmVQYXJzZU9iamVjdExpdGVyYWwpLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgcmV0dXJuIGklMiA9PT0gMCA/IHNhbml0aXplTmFtZShpdGVtKSA6IHNhbml0aXplVmFsdWUoaXRlbSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBwYXJhbXMgT2JqZWN0IGZyb20gc3RyaW5nXG4gKiBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQSBzdHJpbmdpZmllZCB2ZXJzaW9uIG9mIE9iamVjdCBsaXRlcmFsXG4gKi9cbnZhciBQYXJhbWV0ZXJzID0gZnVuY3Rpb24oc3RyKSB7XG4gIHN0ciA9IHN0ciB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICBfbGlzdGlmeShzdHIpLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIGlmKGklMiA9PT0gMCkge1xuICAgICAgX3NlbGZbaXRlbV0gPSBsaXN0W2krMV07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcmFtZXRlcnM7XG5cbm1vZHVsZS5leHBvcnRzLnJlc29sdmVWYWx1ZSA9IF9yZXNvbHZlVmFsdWU7XG5tb2R1bGUuZXhwb3J0cy5saXN0aWZ5ID0gX2xpc3RpZnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmwgPSByZXF1aXJlKCcuL3VybCcpO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFVybERpY3Rpb25hcnkoKSB7XG4gIHRoaXMuX3BhdHRlcm5zID0gW107XG4gIHRoaXMuX3JlZnMgPSBbXTtcbiAgdGhpcy5fcGFyYW1zID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuICB2YXIgcGFyYW1zID0ge307XG5cbiAgaWYocGF0dGVybi5pbmRleE9mKCc/JykgPT09IC0xKSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuXG4gIH0gZWxzZSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuICB9XG5cbiAgLy8gU3RhcnRcbiAgdmFyIHNlYXJjaEV4cHIgPSAnXic7XG5cbiAgLy8gSXRlbXNcbiAgKHBhdGhDaGFpbi5mb3JFYWNoKGZ1bmN0aW9uKGNodW5rLCBpKSB7XG4gICAgaWYoaSE9PTApIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1xcXFwvJztcbiAgICB9XG5cbiAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdbXlxcXFwvP10qJztcbiAgICAgIHBhcmFtc1tjaHVuay5zdWJzdHJpbmcoMSldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZWFyY2hFeHByICs9IGNodW5rO1xuICAgIH1cbiAgfSkpO1xuXG4gIC8vIEVuZFxuICBzZWFyY2hFeHByICs9ICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbiAgdGhpcy5fcGFyYW1zW2ldID0gcGFyYW1zO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgcmVmZXJlbmNlIGFjY29yZGluZyB0byBhIFVSTCBwYXR0ZXJuIGFuZCByZXRyaWV2ZSBwYXJhbXMgZGVmaW5lZCBpbiBVUkxcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB1cmwgPSB1cmwgfHwgJyc7XG4gIHZhciBwID0gVXJsKHVybCkucGF0aCgpO1xuICB2YXIgcSA9IFVybCh1cmwpLnF1ZXJ5cGFyYW1zKCk7XG5cbiAgdmFyIF9zZWxmID0gdGhpcztcblxuICAvLyBDaGVjayBkaWN0aW9uYXJ5XG4gIHZhciBfZmluZFBhdHRlcm4gPSBmdW5jdGlvbihjaGVjaykge1xuICAgIGNoZWNrID0gY2hlY2sgfHwgJyc7XG4gICAgZm9yKHZhciBpPV9zZWxmLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihjaGVjay5tYXRjaChfc2VsZi5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgdmFyIGkgPSBfZmluZFBhdHRlcm4ocCk7XG4gIFxuICAvLyBNYXRjaGluZyBwYXR0ZXJuIGZvdW5kXG4gIGlmKGkgIT09IC0xKSB7XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcGF0dGVybiBtYXRjaFxuICAgIHZhciBwYXJhbXMgPSB7fTtcbiAgICBmb3IodmFyIG4gaW4gdGhpcy5fcGFyYW1zW2ldKSB7XG4gICAgICB2YXIgcGFyYW1QYXJzZXIgPSB0aGlzLl9wYXJhbXNbaV1bbl07XG4gICAgICB2YXIgdXJsTWF0Y2ggPSAodXJsLm1hdGNoKHBhcmFtUGFyc2VyKSB8fCBbXSkucG9wKCkgfHwgJyc7XG4gICAgICB2YXIgdmFyTWF0Y2ggPSB1cmxNYXRjaC5zcGxpdCgnLycpLnBvcCgpO1xuICAgICAgcGFyYW1zW25dID0gdmFyTWF0Y2g7XG4gICAgfVxuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHF1ZXJ5c3RyaW5nIG1hdGNoXG4gICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQocSwgcGFyYW1zKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIHJlZjogdGhpcy5fcmVmc1tpXSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcblxuICAvLyBOb3QgaW4gZGljdGlvbmFyeVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/IHVybCA6IHVybC5zdWJzdHJpbmcoMCwgdXJsLmluZGV4T2YoJz8nKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlzdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJycgOiB1cmwuc3Vic3RyaW5nKHVybC5pbmRleE9mKCc/JykrMSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkwgcGFyYW1ldGVycyBhcyBhIGhhc2hcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlwYXJhbXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhaXJzID0gX3NlbGYucXVlcnlzdHJpbmcoKS5zcGxpdCgnJicpO1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBmb3IodmFyIGk9MDsgaTxwYWlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihwYWlyc1tpXSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmFtZVZhbHVlID0gcGFpcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgcGFyYW1zW25hbWVWYWx1ZVswXV0gPSAodHlwZW9mIG5hbWVWYWx1ZVsxXSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmFtZVZhbHVlWzFdID09PSAnJykgPyB0cnVlIDogbmFtZVZhbHVlWzFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
