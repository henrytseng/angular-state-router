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
      add: function(handler) {
        if(handler && handler.constructor === Array) {
          _list = _list.concat(handler);
        } else {
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
          return (a.priotity || 1) < (b.priotity || 1);
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
   * @return {$stateProvider} Itself; chainable
   */
  this.state = function(name, state) {
    if(!state) {
      return _getState(name);
    }
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
     * @param  {String}  name          A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}  params        A data object of params
     * @return {Promise}               A promise fulfilled when state change occurs
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
          });

        // State not changed
        } else if(_compareStates(prevState, nextState)) {
          queue.add(function(data, next) {
            _current = nextState;
            next();
          });
          
        // Valid state exists
        } else {

          // Process started
          queue.add(function(data, next) {
            $rootScope.$broadcast('$stateChangeBegin', request);
            next();
          });

          // Make state change
          queue.add(function(data, next) {
            if(prevState) _pushHistory(prevState);
            _current = nextState;
            
            next();
          });

          // Add middleware
          queue.add(_layerList);

          // Process ended
          queue.add(function(data, next) {
            $rootScope.$broadcast('$stateChangeEnd', request);
            next();
          });
        }

        // Run
        queue.execute(function(err) {
          if(err) {
            $rootScope.$broadcast('$stateChangeError', err, request);
            deferred.reject(err);

          } else {
            deferred.resolve(request);
          }

          $rootScope.$broadcast('$stateChangeComplete', request);
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
       * Set/get state
       */
      state: function(name, state) {
        if(!state) {
          return _getState(name);
        }
        _defineState(name, state);
        return _inst;
      },

      /**
       * Internal method to add middleware, executing next(err);
       * 
       * @param  {Function}    handler A callback, function(request, next)
       * @return {$state}              Itself; chainable
       */
      $use: function(handler) {
        if(typeof handler !== 'function') {
          throw new Error('Middleware must be a function.');
        }

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
              readyDeferred = _changeState(_initalLocation.name, _initalLocation.params);
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

      // Retrieve definition of states
      library: function() {
        return _stateLibrary;
      },

      // Validation
      validate: {
        name: _validateStateName,
        query: _validateStateQuery
      },

      // Retrieve history
      history: function() {
        return _history;
      },

      /**
       * Change state, asynchronous operation
       * 
       * @param  {String}      name     A unique identifier for the state; using dot-notation
       * @param  {Object}      [params] A parameters data object
       * @return {$state}               Itself; chainable
       */
      change: function(name, params) {
        return _changeState(name, params);
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
            return _changeState(state.name, data.params);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3F1ZXVlLWhhbmRsZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9yZXNvbHV0aW9uLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvc3RhdGUtcm91dGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvdXJsLW1hbmFnZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9wYXJhbWV0ZXJzLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFP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LEtBQUs7Ozs7SUFJZCxTQUFTLFFBQVEsT0FBTyxHQUFHOztJQUUzQixPQUFPO01BQ0wsS0FBSztNQUNMLEtBQUssS0FBSyxNQUFNO01BQ2hCLFFBQVE7Ozs7U0FJTDtJQUNMLE9BQU87Ozs7QUFJWCxPQUFPLFVBQVU7QUFDakI7O0FDbkhBOztBQUVBLFNBQVMsSUFBSSxLQUFLO0VBQ2hCLE1BQU0sT0FBTzs7O0VBR2IsSUFBSSxRQUFROzs7Ozs7O0lBT1YsTUFBTSxXQUFXO01BQ2YsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDLElBQUksTUFBTSxJQUFJLFVBQVUsR0FBRyxJQUFJLFFBQVE7Ozs7Ozs7O0lBUXRFLGFBQWEsV0FBVztNQUN0QixPQUFPLElBQUksUUFBUSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLFFBQVEsS0FBSzs7Ozs7Ozs7SUFRdkUsYUFBYSxXQUFXO01BQ3RCLElBQUksUUFBUSxNQUFNLGNBQWMsTUFBTTtNQUN0QyxJQUFJLFNBQVM7O01BRWIsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sUUFBUSxLQUFLO1FBQ2hDLEdBQUcsTUFBTSxPQUFPLElBQUk7UUFDcEIsSUFBSSxZQUFZLE1BQU0sR0FBRyxNQUFNO1FBQy9CLE9BQU8sVUFBVSxNQUFNLENBQUMsT0FBTyxVQUFVLE9BQU8sZUFBZSxVQUFVLE9BQU8sTUFBTSxPQUFPLFVBQVU7OztNQUd6RyxPQUFPOzs7O0VBSVgsT0FBTzs7O0FBR1QsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsIGZ1bmN0aW9uICgkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZS5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gSW5zdGFudGlhdGUgbW9kdWxlXG5hbmd1bGFyLm1vZHVsZSgnYW5ndWxhci1zdGF0ZS1yb3V0ZXInLCBbXSlcblxuICAucHJvdmlkZXIoJyRzdGF0ZScsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5mYWN0b3J5KCckcmVzb2x1dGlvbicsIHJlcXVpcmUoJy4vc2VydmljZXMvcmVzb2x1dGlvbicpKVxuICBcbiAgLmZhY3RvcnkoJyRxdWV1ZUhhbmRsZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3F1ZXVlLWhhbmRsZXInKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckc3RhdGUnLCAnJHVybE1hbmFnZXInLCAnJHJlc29sdXRpb24nLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkc3RhdGUsICR1cmxNYW5hZ2VyLCAkcmVzb2x1dGlvbikge1xuICAgIC8vIFVwZGF0ZSBsb2NhdGlvbiBjaGFuZ2VzXG4gICAgJHJvb3RTY29wZS4kb24oJyRsb2NhdGlvbkNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbigpIHtcbiAgICAgICR1cmxNYW5hZ2VyLmxvY2F0aW9uKGFyZ3VtZW50cyk7XG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWFsaXplXG4gICAgJHN0YXRlLiRyZWFkeSgpO1xuICB9XSlcblxuICAuZGlyZWN0aXZlKCdzcmVmJywgcmVxdWlyZSgnLi9kaXJlY3RpdmVzL3NyZWYnKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHJvb3RTY29wZSkge1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgc2VyaWVzIG9mIGZ1bmN0aW9uczsgdXNlZCBpbiB0YW5kZW0gd2l0aCBtaWRkbGV3YXJlXG4gICAqL1xuICB2YXIgUXVldWUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2xpc3QgPSBbXTtcbiAgICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gICAgdmFyIF9zZWxmID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEFkZCBhIGhhbmRsZXJcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtIHtNaXhlZH0gIGhhbmRsZXIgQSBGdW5jdGlvbiBvciBhbiBBcnJheSBvZiBGdW5jdGlvbnMgdG8gYWRkIHRvIHRoZSBxdWV1ZVxuICAgICAgICogQHJldHVybiB7UXVldWV9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgYWRkOiBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgICAgIGlmKGhhbmRsZXIgJiYgaGFuZGxlci5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgICBfbGlzdCA9IF9saXN0LmNvbmNhdChoYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBfbGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBEYXRhIG9iamVjdFxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBkYXRhIG9iamVjdCBtYWRlIGF2YWlsYWJsZSB0byBlYWNoIGhhbmRsZXJcbiAgICAgICAqIEByZXR1cm4ge1F1ZXVlfSAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBkYXRhOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEJlZ2luIGV4ZWN1dGlvbiBhbmQgdHJpZ2dlciBjYWxsYmFjayBhdCB0aGUgZW5kXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAgICAgKiBAcmV0dXJuIHtRdWV1ZX0gICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgZXhlY3V0ZTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIG5leHRIYW5kbGVyO1xuICAgICAgICB2YXIgZXhlY3V0aW9uTGlzdCA9IF9saXN0LnNsaWNlKDApLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIHJldHVybiAoYS5wcmlvdGl0eSB8fCAxKSA8IChiLnByaW90aXR5IHx8IDEpO1xuICAgICAgICB9KTtcblxuICAgICAgICBuZXh0SGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBoYW5kbGVyID0gZXhlY3V0aW9uTGlzdC5zaGlmdCgpO1xuXG4gICAgICAgICAgICAvLyBDb21wbGV0ZVxuICAgICAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgICAgIC8vIE5leHQgaGFuZGxlclxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaGFuZGxlci5jYWxsKG51bGwsIF9kYXRhLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBFcnJvclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTdGFydFxuICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgfVxuXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLy8gSW5zdGFuY2VcbiAgcmV0dXJuIHtcblxuICAgIC8qKlxuICAgICAqIEZhY3RvcnkgbWV0aG9kXG4gICAgICogXG4gICAgICogQHJldHVybiB7UXVldWV9IEEgcXVldWVcbiAgICAgKi9cbiAgICBjcmVhdGU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIFF1ZXVlKCk7XG4gICAgfVxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcScsICckaW5qZWN0b3InLCAnJHN0YXRlJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbigkcSwgJGluamVjdG9yLCAkc3RhdGUsICRyb290U2NvcGUpIHtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICAvKipcbiAgICogUmVzb2x2ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcmVzb2x2ZSBBIGhhc2ggT2JqZWN0IG9mIGl0ZW1zIHRvIHJlc29sdmVcbiAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gdGVtcGxhdGVzIHJldGlyZXZlZFxuICAgKi9cbiAgdmFyIF9yZXNvbHZlID0gZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIHZhciByZXNvbHZlc1Byb21pc2VzID0ge307XG5cbiAgICBhbmd1bGFyLmZvckVhY2gocmVzb2x2ZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgdmFyIHJlc29sdXRpb24gPSBhbmd1bGFyLmlzU3RyaW5nKHZhbHVlKSA/ICRpbmplY3Rvci5nZXQodmFsdWUpIDogJGluamVjdG9yLmludm9rZSh2YWx1ZSwgbnVsbCwgbnVsbCwga2V5KTtcbiAgICAgIHJlc29sdmVzUHJvbWlzZXNba2V5XSA9ICRxLndoZW4ocmVzb2x1dGlvbik7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gJHEuYWxsKHJlc29sdmVzUHJvbWlzZXMpO1xuICB9O1xuICBfc2VsZi5yZXNvbHZlID0gX3Jlc29sdmU7XG5cbiAgLyoqXG4gICAqIE1pZGRsZXdhcmVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gICByZXF1ZXN0IEEgZGF0YSBPYmplY3RcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IG5leHQgICAgQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgKi9cbiAgdmFyIF9yZWdpc3RlciA9IGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZighY3VycmVudCkge1xuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9XG5cbiAgICBfcmVzb2x2ZShjdXJyZW50LnJlc29sdmUgfHwge30pLnRoZW4oZnVuY3Rpb24obG9jYWxzKSB7XG4gICAgICBhbmd1bGFyLmV4dGVuZChyZXF1ZXN0LmxvY2FscywgbG9jYWxzKTtcbiAgICAgIG5leHQoKTtcblxuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvclJlc29sdmUnLCBlcnIpO1xuICAgICAgbmV4dChuZXcgRXJyb3IoJ0Vycm9yIHJlc29sdmluZyBzdGF0ZScpKTtcbiAgICB9KTtcbiAgfTtcbiAgX3JlZ2lzdGVyLnByaW9yaXR5ID0gMTAwO1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoX3JlZ2lzdGVyKTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xudmFyIFBhcmFtZXRlcnMgPSByZXF1aXJlKCcuLi91dGlscy9wYXJhbWV0ZXJzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIFByb3ZpZGVyXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIENvbmZpZ3VyYXRpb24sIGdsb2JhbCBvcHRpb25zXG4gIHZhciBfY29uZmlndXJhdGlvbiA9IHtcbiAgICBoaXN0b3J5TGVuZ3RoOiA1XG4gIH07XG5cbiAgLy8gU3RhdGUgZGVmaW5pdGlvbiBsaWJyYXJ5XG4gIHZhciBfc3RhdGVMaWJyYXJ5ID0ge307XG4gIHZhciBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCB0byBzdGF0ZSBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lUGFyYW1zIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgQSBuYW1lIHN0cmluZyBhbmQgcGFyYW0gT2JqZWN0XG4gICAqL1xuICB2YXIgX3BhcnNlTmFtZSA9IGZ1bmN0aW9uKG5hbWVQYXJhbXMpIHtcbiAgICBpZihuYW1lUGFyYW1zICYmIG5hbWVQYXJhbXMubWF0Y2goL15bYS16QS1aMC05X1xcLl0qXFwoLipcXCkkLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWVQYXJhbXMuc3Vic3RyaW5nKDAsIG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWVQYXJhbXMuc3Vic3RyaW5nKG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKzEsIG5hbWVQYXJhbXMubGFzdEluZGV4T2YoJyknKSkgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbnBhcnQsXG4gICAgICAgIHBhcmFtczogcHBhcnRcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbmFtZVBhcmFtcyxcbiAgICAgICAgcGFyYW1zOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgYSA9IGEgfHwge307XG4gICAgYiA9IGIgfHwge307XG4gICAgcmV0dXJuIGEubmFtZSA9PT0gYi5uYW1lICYmIGFuZ3VsYXIuZXF1YWxzKGEucGFyYW1zLCBiLnBhcmFtcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9zdGF0ZUNhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX3N0YXRlQ2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24obmFtZSwgaSkge1xuICAgICAgICB2YXIgaXRlbSA9IGFuZ3VsYXIuY29weShfc3RhdGVMaWJyYXJ5W25hbWVdKTtcblxuICAgICAgICBpZihpdGVtICYmIGkgIT09IG5hbWVDaGFpbi5sZW5ndGgtMSkge1xuICAgICAgICAgIGRlbGV0ZShpdGVtLnJlc29sdmUpO1xuICAgICAgICAgIGRlbGV0ZShpdGVtLnRlbXBsYXRlcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gISFwYXJlbnQ7XG4gICAgICB9KTtcblxuICAgIC8vIFdhbGsgdXAgY2hlY2tpbmcgaW5oZXJpdGFuY2VcbiAgICBmb3IodmFyIGk9c3RhdGVDaGFpbi5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihzdGF0ZUNoYWluW2ldKSB7XG4gICAgICAgIHZhciBuZXh0U3RhdGUgPSBzdGF0ZUNoYWluW2ldO1xuICAgICAgICBzdGF0ZSA9IGFuZ3VsYXIubWVyZ2UobmV4dFN0YXRlLCBzdGF0ZSB8fCB7fSk7XG4gICAgICB9XG5cbiAgICAgIGlmKHN0YXRlICYmIHN0YXRlLmluaGVyaXQgPT09IGZhbHNlKSBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbiBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlW25hbWVdID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBzdG9yZSBhIHN0YXRlIGRlZmluaXRpb24uICBQYXJhbWV0ZXJzIHNob3VsZCBiZSBpbmNsdWRlZCBpbiBkYXRhIE9iamVjdCBub3Qgc3RhdGUgbmFtZS4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9kZWZpbmVTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZihuYW1lID09PSBudWxsIHx8IHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOYW1lIGNhbm5vdCBiZSBudWxsLicpO1xuICAgIFxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIG5hbWVzXG4gICAgfSBlbHNlIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdGF0ZSBuYW1lLicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzdGF0ZVxuICAgIHZhciBzdGF0ZSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgIC8vIFVzZSBkZWZhdWx0c1xuICAgIF9zZXRTdGF0ZURlZmF1bHRzKHN0YXRlKTtcblxuICAgIC8vIE5hbWVkIHN0YXRlXG4gICAgc3RhdGUubmFtZSA9IG5hbWU7XG5cbiAgICAvLyBTZXQgZGVmaW5pdGlvblxuICAgIF9zdGF0ZUxpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIC8vIFJlc2V0IGNhY2hlXG4gICAgX3N0YXRlQ2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBjb25maWd1cmF0aW9uIGRhdGEgcGFyYW1ldGVycyBmb3IgU3RhdGVSb3V0ZXJcbiAgICpcbiAgICogSW5jbHVkaW5nIHBhcmFtZXRlcnM6XG4gICAqIFxuICAgKiAtIGhpc3RvcnlMZW5ndGggICB7TnVtYmVyfSBEZWZhdWx0cyB0byA1XG4gICAqIC0gaW5pdGlhbExvY2F0aW9uIHtPYmplY3R9IEFuIE9iamVjdHtuYW1lOlN0cmluZywgcGFyYW1zOk9iamVjdH0gZm9yIGluaXRpYWwgc3RhdGUgdHJhbnNpdGlvblxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgb3B0aW9ucyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLm9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgYW5ndWxhci5leHRlbmQoX2NvbmZpZ3VyYXRpb24sIG9wdGlvbnMgfHwge30pO1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldC9nZXQgc3RhdGVcbiAgICogXG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgaWYoIXN0YXRlKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBpbml0aWFsaXphdGlvbiBwYXJhbWV0ZXJzOyBkZWZlcnJlZCB0byAkcmVhZHkoKVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIG5hbWUgICBBIGluaWl0YWwgc3RhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLmluaXQgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBfY29uZmlndXJhdGlvbi5pbml0aWFsTG9jYXRpb24gPSB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBpbnN0YW5jZVxuICAgKi9cbiAgdGhpcy4kZ2V0ID0gWyckcm9vdFNjb3BlJywgJyRsb2NhdGlvbicsICckcScsICckcXVldWVIYW5kbGVyJywgZnVuY3Rpb24gU3RhdGVSb3V0ZXJGYWN0b3J5KCRyb290U2NvcGUsICRsb2NhdGlvbiwgJHEsICRxdWV1ZUhhbmRsZXIpIHtcblxuICAgIC8vIEN1cnJlbnQgc3RhdGVcbiAgICB2YXIgX2N1cnJlbnQ7XG5cbiAgICB2YXIgX29wdGlvbnM7XG4gICAgdmFyIF9pbml0YWxMb2NhdGlvbjtcbiAgICB2YXIgX2hpc3RvcnkgPSBbXTtcbiAgICB2YXIgX2lzSW5pdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9vcHRpb25zLmhpc3RvcnlMZW5ndGggfHwgNTtcblxuICAgICAgaWYoZGF0YSkge1xuICAgICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgbGVuZ3RoXG4gICAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBoaXN0b3J5TGVuZ3RoKSB7XG4gICAgICAgIF9oaXN0b3J5LnNwbGljZSgwLCBfaGlzdG9yeS5sZW5ndGggLSBoaXN0b3J5TGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSB0byBzdGF0ZS4gIFBhcmFtZXRlcnMgaW4gYHBhcmFtc2AgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHN0YXRlLW5vdGF0aW9uIGBuYW1lYCBleHByZXNzaW9uLiAgXG4gICAgICogXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSAgbmFtZSAgICAgICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zICAgICAgICBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuICAgICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICAgIHZhciBuYW1lRXhwciA9IF9wYXJzZU5hbWUobmFtZSk7XG4gICAgICAgIG5hbWUgPSBuYW1lRXhwci5uYW1lO1xuICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgICAgdmFyIGVycm9yID0gbnVsbDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSB7XG4gICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgICBsb2NhbHM6IHt9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ29tcGlsZSBleGVjdXRpb24gcGhhc2VzXG4gICAgICAgIHZhciBxdWV1ZSA9ICRxdWV1ZUhhbmRsZXIuY3JlYXRlKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgICAgICB2YXIgbmV4dFN0YXRlID0gYW5ndWxhci5jb3B5KF9nZXRTdGF0ZShuYW1lKSk7XG4gICAgICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgICAgICBpZihuZXh0U3RhdGUpIHtcbiAgICAgICAgICAvLyBTZXQgbG9jYWxzXG4gICAgICAgICAgbmV4dFN0YXRlLmxvY2FscyA9IHJlcXVlc3QubG9jYWxzO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNldCBwYXJhbWV0ZXJzXG4gICAgICAgICAgbmV4dFN0YXRlLnBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5leHRTdGF0ZS5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgICAgICBpZihuZXh0U3RhdGUgPT09IG51bGwpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvck5vdEZvdW5kJywgZXJyb3IsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dChlcnJvcik7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICAgICAgfSBlbHNlIGlmKF9jb21wYXJlU3RhdGVzKHByZXZTdGF0ZSwgbmV4dFN0YXRlKSkge1xuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VCZWdpbicsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gTWFrZSBzdGF0ZSBjaGFuZ2VcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgaWYocHJldlN0YXRlKSBfcHVzaEhpc3RvcnkocHJldlN0YXRlKTtcbiAgICAgICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBBZGQgbWlkZGxld2FyZVxuICAgICAgICAgIHF1ZXVlLmFkZChfbGF5ZXJMaXN0KTtcblxuICAgICAgICAgIC8vIFByb2Nlc3MgZW5kZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFbmQnLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJ1blxuICAgICAgICBxdWV1ZS5leGVjdXRlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvcicsIGVyciwgcmVxdWVzdCk7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlcXVlc3QpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlQ29tcGxldGUnLCByZXF1ZXN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIC8vIEluc3RhbmNlXG4gICAgdmFyIF9pbnN0O1xuICAgIF9pbnN0ID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBvcHRpb25zXG4gICAgICAgKlxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvbmZpZ3VyZWQgb3B0aW9uc1xuICAgICAgICovXG4gICAgICBvcHRpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gSGFzbid0IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9vcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIHN0YXRlOiBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgICAgICBpZighc3RhdGUpIHtcbiAgICAgICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBtaWRkbGV3YXJlLCBleGVjdXRpbmcgbmV4dChlcnIpO1xuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgaGFuZGxlciBBIGNhbGxiYWNrLCBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHVzZTogZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBfbGF5ZXJMaXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHBlcmZvcm0gaW5pdGlhbGl6YXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkcmVhZHk6IGZ1bmN0aW9uKCkge1xuICAgICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYoIV9pc0luaXQpIHtcbiAgICAgICAgICAgIF9pc0luaXQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBDb25maWd1cmF0aW9uXG4gICAgICAgICAgICBpZighX29wdGlvbnMpIHtcbiAgICAgICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgICBpZihfb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaW5pdGlhbExvY2F0aW9uJykpIHtcbiAgICAgICAgICAgICAgX2luaXRhbExvY2F0aW9uID0gYW5ndWxhci5jb3B5KF9vcHRpb25zLmluaXRpYWxMb2NhdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZWFkeURlZmVycmVkID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgICAgICAgaWYoJGxvY2F0aW9uLnVybCgpICE9PSAnJykge1xuICAgICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2luc3QuJGxvY2F0aW9uKCRsb2NhdGlvbi51cmwoKSk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpemUgd2l0aCBzdGF0ZVxuICAgICAgICAgICAgfSBlbHNlIGlmKF9pbml0YWxMb2NhdGlvbikge1xuICAgICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2NoYW5nZVN0YXRlKF9pbml0YWxMb2NhdGlvbi5uYW1lLCBfaW5pdGFsTG9jYXRpb24ucGFyYW1zKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJHEud2hlbihyZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUluaXQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLy8gUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICAgIHBhcnNlOiBfcGFyc2VOYW1lLFxuXG4gICAgICAvLyBSZXRyaWV2ZSBkZWZpbml0aW9uIG9mIHN0YXRlc1xuICAgICAgbGlicmFyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfc3RhdGVMaWJyYXJ5O1xuICAgICAgfSxcblxuICAgICAgLy8gVmFsaWRhdGlvblxuICAgICAgdmFsaWRhdGU6IHtcbiAgICAgICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgICAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICAgICAgfSxcblxuICAgICAgLy8gUmV0cmlldmUgaGlzdG9yeVxuICAgICAgaGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfaGlzdG9yeTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBfY2hhbmdlU3RhdGUobmFtZSwgcGFyYW1zKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgdmFyIHN0YXRlID0gZGF0YS5yZWY7XG5cbiAgICAgICAgICBpZihzdGF0ZSkge1xuICAgICAgICAgICAgLy8gUGFyc2UgcGFyYW1zIGZyb20gdXJsXG4gICAgICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlKHN0YXRlLm5hbWUsIGRhdGEucGFyYW1zKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZighIXVybCAmJiB1cmwgIT09ICcnKSB7XG4gICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3JOb3RGb3VuZCcsIGVycm9yLCB7XG4gICAgICAgICAgICB1cmw6IHVybFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICRxLnJlamVjdChuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIGxvY2F0aW9uIGluIGxpYnJhcnknKSk7XG4gICAgICB9LFxuICAgICAgXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGN1cnJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7TWl4ZWR9ICAgcXVlcnkgIEEgc3RyaW5nIHVzaW5nIHN0YXRlIG5vdGF0aW9uIG9yIGEgUmVnRXhwXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGFjdGl2ZTogZnVuY3Rpb24ocXVlcnksIHBhcmFtcykge1xuICAgICAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgLy8gTm8gc3RhdGVcbiAgICAgICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICAgICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAgICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICAgICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X10qJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gX2luc3Q7XG4gIH1dO1xuXG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyRsb2NhdGlvbicsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24sICRyb290U2NvcGUpIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYoY3VycmVudCAmJiBjdXJyZW50LnVybCkge1xuICAgICAgdmFyIHBhdGg7XG4gICAgICBwYXRoID0gY3VycmVudC51cmw7XG5cbiAgICAgIC8vIEFkZCBwYXJhbWV0ZXJzIG9yIHVzZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAgICAgIHZhciBwYXJhbXMgPSBjdXJyZW50LnBhcmFtcyB8fCB7fTtcbiAgICAgIHZhciBxdWVyeSA9IHt9O1xuICAgICAgZm9yKHZhciBuYW1lIGluIHBhcmFtcykge1xuICAgICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKCc6JytuYW1lLCAnZycpO1xuICAgICAgICBpZihwYXRoLm1hdGNoKHJlKSkge1xuICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UocmUsIHBhcmFtc1tuYW1lXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcXVlcnlbbmFtZV0gPSBwYXJhbXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgJGxvY2F0aW9uLnBhdGgocGF0aCk7XG4gICAgICAkbG9jYXRpb24uc2VhcmNoKHF1ZXJ5KTtcbiAgICAgIFxuICAgICAgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgX3NlbGYubG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgJHN0YXRlLiRsb2NhdGlvbihfdXJsKTtcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvY2F0aW9uU3RhdGVVcGRhdGUnKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgX3VwZGF0ZSgpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBhcnNlIE9iamVjdCBsaXRlcmFsIG5hbWUtdmFsdWUgcGFpcnNcbnZhciByZVBhcnNlT2JqZWN0TGl0ZXJhbCA9IC8oWyx7XVxccyooKFwifCcpKC4qPylcXDN8XFx3Kil8KDpcXHMqKFsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT98dHJ1ZXxmYWxzZXxudWxsfChcInwnKSguKj8pXFw3fFxcW1teXFxdXSpcXF0pKSkvZztcblxuLy8gTWF0Y2ggU3RyaW5nc1xudmFyIHJlU3RyaW5nID0gL14oXCJ8JykoLio/KVxcMSQvO1xuXG4vLyBUT0RPIEFkZCBlc2NhcGVkIHN0cmluZyBxdW90ZXMgXFwnIGFuZCBcXFwiIHRvIHN0cmluZyBtYXRjaGVyXG5cbi8vIE1hdGNoIE51bWJlciAoaW50L2Zsb2F0L2V4cG9uZW50aWFsKVxudmFyIHJlTnVtYmVyID0gL15bKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/JC87XG5cbi8qKlxuICogUGFyc2Ugc3RyaW5nIHZhbHVlIGludG8gQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGwuXG4gKlxuICogU3RyaW5ncyBhcmUgc3Vycm91bmRlZCBieSBhIHBhaXIgb2YgbWF0Y2hpbmcgcXVvdGVzXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdmFsdWUgQSBTdHJpbmcgdmFsdWUgdG8gcGFyc2VcbiAqIEByZXR1cm4ge01peGVkfSAgICAgICAgQSBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbFxuICovXG52YXIgX3Jlc29sdmVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cbiAgLy8gQm9vbGVhbjogdHJ1ZVxuICBpZih2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgLy8gQm9vbGVhbjogZmFsc2VcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE51bGxcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnbnVsbCcpIHtcbiAgICByZXR1cm4gbnVsbDtcblxuICAvLyBTdHJpbmdcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlU3RyaW5nKSkge1xuICAgIHJldHVybiB2YWx1ZS5zdWJzdHIoMSwgdmFsdWUubGVuZ3RoLTIpO1xuXG4gIC8vIE51bWJlclxuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVOdW1iZXIpKSB7XG4gICAgcmV0dXJuICt2YWx1ZTtcblxuICAvLyBOYU5cbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnTmFOJykge1xuICAgIHJldHVybiBOYU47XG5cbiAgLy8gVE9ETyBhZGQgbWF0Y2hpbmcgd2l0aCBBcnJheXMgYW5kIHBhcnNlXG4gIFxuICB9XG5cbiAgLy8gVW5hYmxlIHRvIHJlc29sdmVcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gRmluZCB2YWx1ZXMgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbnZhciBfbGlzdGlmeSA9IGZ1bmN0aW9uKHN0cikge1xuXG4gIC8vIFRyaW1cbiAgc3RyID0gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuXG4gIGlmKHN0ci5tYXRjaCgvXlxccyp7Lip9XFxzKiQvKSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVycyBleHBlY3RzIGFuIE9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHNhbml0aXplTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9eW1xceyxdP1xccypbXCInXT8vLCAnJykucmVwbGFjZSgvW1wiJ10/XFxzKiQvLCAnJyk7XG4gIH07XG5cbiAgdmFyIHNhbml0aXplVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzdHIgPSB2YWx1ZS5yZXBsYWNlKC9eKDopP1xccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgcmV0dXJuIF9yZXNvbHZlVmFsdWUoc3RyKTtcbiAgfTtcblxuICByZXR1cm4gc3RyLm1hdGNoKHJlUGFyc2VPYmplY3RMaXRlcmFsKS5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIHJldHVybiBpJTIgPT09IDAgPyBzYW5pdGl6ZU5hbWUoaXRlbSkgOiBzYW5pdGl6ZVZhbHVlKGl0ZW0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFyYW1zIE9iamVjdCBmcm9tIHN0cmluZ1xuICogXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5naWZpZWQgdmVyc2lvbiBvZiBPYmplY3QgbGl0ZXJhbFxuICovXG52YXIgUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHN0cikge1xuICBzdHIgPSBzdHIgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgX2xpc3RpZnkoc3RyKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICBpZihpJTIgPT09IDApIHtcbiAgICAgIF9zZWxmW2l0ZW1dID0gbGlzdFtpKzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYXJhbWV0ZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5yZXNvbHZlVmFsdWUgPSBfcmVzb2x2ZVZhbHVlO1xubW9kdWxlLmV4cG9ydHMubGlzdGlmeSA9IF9saXN0aWZ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsID0gcmVxdWlyZSgnLi91cmwnKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBVcmxEaWN0aW9uYXJ5KCkge1xuICB0aGlzLl9wYXR0ZXJucyA9IFtdO1xuICB0aGlzLl9yZWZzID0gW107XG4gIHRoaXMuX3BhcmFtcyA9IFtdO1xufVxuXG4vKipcbiAqIEFzc29jaWF0ZSBhIFVSTCBwYXR0ZXJuIHdpdGggYSByZWZlcmVuY2VcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSBwYXR0ZXJuIEEgVVJMIHBhdHRlcm5cbiAqIEBwYXJhbSAge09iamVjdH0gcmVmICAgICBBIGRhdGEgT2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHBhdHRlcm4sIHJlZikge1xuICBwYXR0ZXJuID0gcGF0dGVybiB8fCAnJztcbiAgdmFyIF9zZWxmID0gdGhpcztcbiAgdmFyIGkgPSB0aGlzLl9wYXR0ZXJucy5sZW5ndGg7XG5cbiAgdmFyIHBhdGhDaGFpbjtcbiAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gIGlmKHBhdHRlcm4uaW5kZXhPZignPycpID09PSAtMSkge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcblxuICB9IGVsc2Uge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcbiAgfVxuXG4gIC8vIFN0YXJ0XG4gIHZhciBzZWFyY2hFeHByID0gJ14nO1xuXG4gIC8vIEl0ZW1zXG4gIChwYXRoQ2hhaW4uZm9yRWFjaChmdW5jdGlvbihjaHVuaywgaSkge1xuICAgIGlmKGkhPT0wKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdcXFxcLyc7XG4gICAgfVxuXG4gICAgaWYoY2h1bmtbMF0gPT09ICc6Jykge1xuICAgICAgc2VhcmNoRXhwciArPSAnW15cXFxcLz9dKic7XG4gICAgICBwYXJhbXNbY2h1bmsuc3Vic3RyaW5nKDEpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc2VhcmNoRXhwciArPSBjaHVuaztcbiAgICB9XG4gIH0pKTtcblxuICAvLyBFbmRcbiAgc2VhcmNoRXhwciArPSAnW1xcXFwvXT8kJztcblxuICB0aGlzLl9wYXR0ZXJuc1tpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG4gIHRoaXMuX3JlZnNbaV0gPSByZWY7XG4gIHRoaXMuX3BhcmFtc1tpXSA9IHBhcmFtcztcbn07XG5cbi8qKlxuICogRmluZCBhIHJlZmVyZW5jZSBhY2NvcmRpbmcgdG8gYSBVUkwgcGF0dGVybiBhbmQgcmV0cmlldmUgcGFyYW1zIGRlZmluZWQgaW4gVVJMXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdXJsICAgICAgQSBVUkwgdG8gdGVzdCBmb3JcbiAqIEBwYXJhbSAge09iamVjdH0gZGVmYXVsdHMgQSBkYXRhIE9iamVjdCBvZiBkZWZhdWx0IHBhcmFtZXRlciB2YWx1ZXNcbiAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgQSByZWZlcmVuY2UgdG8gYSBzdG9yZWQgb2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uKHVybCwgZGVmYXVsdHMpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuICB2YXIgcCA9IFVybCh1cmwpLnBhdGgoKTtcbiAgdmFyIHEgPSBVcmwodXJsKS5xdWVyeXBhcmFtcygpO1xuXG4gIHZhciBfc2VsZiA9IHRoaXM7XG5cbiAgLy8gQ2hlY2sgZGljdGlvbmFyeVxuICB2YXIgX2ZpbmRQYXR0ZXJuID0gZnVuY3Rpb24oY2hlY2spIHtcbiAgICBjaGVjayA9IGNoZWNrIHx8ICcnO1xuICAgIGZvcih2YXIgaT1fc2VsZi5fcGF0dGVybnMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoY2hlY2subWF0Y2goX3NlbGYuX3BhdHRlcm5zW2ldKSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIHZhciBpID0gX2ZpbmRQYXR0ZXJuKHApO1xuICBcbiAgLy8gTWF0Y2hpbmcgcGF0dGVybiBmb3VuZFxuICBpZihpICE9PSAtMSkge1xuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHBhdHRlcm4gbWF0Y2hcbiAgICB2YXIgcGFyYW1zID0ge307XG4gICAgZm9yKHZhciBuIGluIHRoaXMuX3BhcmFtc1tpXSkge1xuICAgICAgdmFyIHBhcmFtUGFyc2VyID0gdGhpcy5fcGFyYW1zW2ldW25dO1xuICAgICAgdmFyIHVybE1hdGNoID0gKHVybC5tYXRjaChwYXJhbVBhcnNlcikgfHwgW10pLnBvcCgpIHx8ICcnO1xuICAgICAgdmFyIHZhck1hdGNoID0gdXJsTWF0Y2guc3BsaXQoJy8nKS5wb3AoKTtcbiAgICAgIHBhcmFtc1tuXSA9IHZhck1hdGNoO1xuICAgIH1cblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBxdWVyeXN0cmluZyBtYXRjaFxuICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHEsIHBhcmFtcyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdXJsOiB1cmwsXG4gICAgICByZWY6IHRoaXMuX3JlZnNbaV0sXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG5cbiAgLy8gTm90IGluIGRpY3Rpb25hcnlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcmxEaWN0aW9uYXJ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBVcmwodXJsKSB7XG4gIHVybCA9IHVybCB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBhdGggb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyB1cmwgOiB1cmwuc3Vic3RyaW5nKDAsIHVybC5pbmRleE9mKCc/JykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5c3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICcnIDogdXJsLnN1YnN0cmluZyh1cmwuaW5kZXhPZignPycpKzEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMIHBhcmFtZXRlcnMgYXMgYSBoYXNoXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5cGFyYW1zOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYWlycyA9IF9zZWxmLnF1ZXJ5c3RyaW5nKCkuc3BsaXQoJyYnKTtcbiAgICAgIHZhciBwYXJhbXMgPSB7fTtcblxuICAgICAgZm9yKHZhciBpPTA7IGk8cGFpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYocGFpcnNbaV0gPT09ICcnKSBjb250aW51ZTtcbiAgICAgICAgdmFyIG5hbWVWYWx1ZSA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgIHBhcmFtc1tuYW1lVmFsdWVbMF1dID0gKHR5cGVvZiBuYW1lVmFsdWVbMV0gPT09ICd1bmRlZmluZWQnIHx8IG5hbWVWYWx1ZVsxXSA9PT0gJycpID8gdHJ1ZSA6IG5hbWVWYWx1ZVsxXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIF9zZWxmO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVybDtcbiJdfQ==
