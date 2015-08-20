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

  .run(['$rootScope', '$state', '$urlManager', '$resolution', function($rootScope, $state, $urlManager, $resolution) {
    // Update location changes
    $rootScope.$on('$locationChangeSuccess', function() {
      $urlManager.location(arguments);
    });

    // Initialize
    $state.$ready();
  }])

  .directive('sref', require('./directives/sref'));

},{"./directives/sref":1,"./services/resolution":3,"./services/state-router":4,"./services/url-manager":5}],3:[function(require,module,exports){
'use strict';

module.exports = ['$q', '$injector', '$state', function($q, $injector, $state) {

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
      next(new Error('Error resolving state'));
    });
  };
  _register.priority = 100;

  // Register middleware layer
  $state.$use(_register);

  return _self;
}];

},{}],4:[function(require,module,exports){
'use strict';

var UrlDictionary = require('../utils/url-dictionary');
var Parameters = require('../utils/parameters');
var QueueHandler = require('../utils/queue-handler');

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
  this.$get = ['$rootScope', '$location', '$q', function StateRouterFactory($rootScope, $location, $q) {

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
        var queue = QueueHandler().data(request);

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
        } else {
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

},{"../utils/parameters":6,"../utils/queue-handler":7,"../utils/url-dictionary":8}],5:[function(require,module,exports){
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

},{"../utils/url-dictionary":8}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
'use strict';

/**
 * Execute a series of functions; used in tandem with middleware
 */
var QueueHandler = function() {
  var _list = [];
  var _data = null;

  var _self = {

    /**
     * Add a handler
     * 
     * @param {Mixed}         handler A Function or an Array of Functions to add to the queue
     * @return {QueueHandler}         Itself; chainable
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
     * @return {QueueHandler}         Itself; chainable
     */
    data: function(data) {
      _data = data;
      return this;
    },

    /**
     * Begin execution and trigger callback at the end
     * 
     * @param  {Function} callback A callback, function(err)
     * @return {QueueHandler}         Itself; chainable
     */
    execute: function(callback) {
      var nextHandler;
      var executionList = _list.slice(0).sort(function(a, b) {
        return (a.priotity || 1) < (b.priotity || 1);
      });

      nextHandler = function() {
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
      };

      nextHandler();
    }

  };
  
  return _self;
};

module.exports = QueueHandler;

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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9xdWV1ZS1oYW5kbGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFPLFVB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SUFBSSxRQUFROzs7Ozs7O0lBT1YsTUFBTSxXQUFXO01BQ2YsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDLElBQUksTUFBTSxJQUFJLFVBQVUsR0FBRyxJQUFJLFFBQVE7Ozs7Ozs7O0lBUXRFLGFBQWEsV0FBVztNQUN0QixPQUFPLElBQUksUUFBUSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLFFBQVEsS0FBSzs7Ozs7Ozs7SUFRdkUsYUFBYSxXQUFXO01BQ3RCLElBQUksUUFBUSxNQUFNLGNBQWMsTUFBTTtNQUN0QyxJQUFJLFNBQVM7O01BRWIsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sUUFBUSxLQUFLO1FBQ2hDLEdBQUcsTUFBTSxPQUFPLElBQUk7UUFDcEIsSUFBSSxZQUFZLE1BQU0sR0FBRyxNQUFNO1FBQy9CLE9BQU8sVUFBVSxNQUFNLENBQUMsT0FBTyxVQUFVLE9BQU8sZUFBZSxVQUFVLE9BQU8sTUFBTSxPQUFPLFVBQVU7OztNQUd6RyxPQUFPOzs7O0VBSVgsT0FBTzs7O0FBR1QsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsIGZ1bmN0aW9uICgkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZS5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gSW5zdGFudGlhdGUgbW9kdWxlXG5hbmd1bGFyLm1vZHVsZSgnYW5ndWxhci1zdGF0ZS1yb3V0ZXInLCBbXSlcblxuICAucHJvdmlkZXIoJyRzdGF0ZScsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5mYWN0b3J5KCckcmVzb2x1dGlvbicsIHJlcXVpcmUoJy4vc2VydmljZXMvcmVzb2x1dGlvbicpKVxuXG4gIC5ydW4oWyckcm9vdFNjb3BlJywgJyRzdGF0ZScsICckdXJsTWFuYWdlcicsICckcmVzb2x1dGlvbicsIGZ1bmN0aW9uKCRyb290U2NvcGUsICRzdGF0ZSwgJHVybE1hbmFnZXIsICRyZXNvbHV0aW9uKSB7XG4gICAgLy8gVXBkYXRlIGxvY2F0aW9uIGNoYW5nZXNcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWxpemVcbiAgICAkc3RhdGUuJHJlYWR5KCk7XG4gIH1dKVxuXG4gIC5kaXJlY3RpdmUoJ3NyZWYnLCByZXF1aXJlKCcuL2RpcmVjdGl2ZXMvc3JlZicpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRxJywgJyRpbmplY3RvcicsICckc3RhdGUnLCBmdW5jdGlvbigkcSwgJGluamVjdG9yLCAkc3RhdGUpIHtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICAvKipcbiAgICogUmVzb2x2ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcmVzb2x2ZSBBIGhhc2ggT2JqZWN0IG9mIGl0ZW1zIHRvIHJlc29sdmVcbiAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gdGVtcGxhdGVzIHJldGlyZXZlZFxuICAgKi9cbiAgdmFyIF9yZXNvbHZlID0gZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIHZhciByZXNvbHZlc1Byb21pc2VzID0ge307XG5cbiAgICBhbmd1bGFyLmZvckVhY2gocmVzb2x2ZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgdmFyIHJlc29sdXRpb24gPSBhbmd1bGFyLmlzU3RyaW5nKHZhbHVlKSA/ICRpbmplY3Rvci5nZXQodmFsdWUpIDogJGluamVjdG9yLmludm9rZSh2YWx1ZSwgbnVsbCwgbnVsbCwga2V5KTtcbiAgICAgIHJlc29sdmVzUHJvbWlzZXNba2V5XSA9ICRxLndoZW4ocmVzb2x1dGlvbik7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gJHEuYWxsKHJlc29sdmVzUHJvbWlzZXMpO1xuICB9O1xuICBfc2VsZi5yZXNvbHZlID0gX3Jlc29sdmU7XG5cbiAgLyoqXG4gICAqIE1pZGRsZXdhcmVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gICByZXF1ZXN0IEEgZGF0YSBPYmplY3RcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IG5leHQgICAgQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgKi9cbiAgdmFyIF9yZWdpc3RlciA9IGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZighY3VycmVudCkge1xuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9XG5cbiAgICBfcmVzb2x2ZShjdXJyZW50LnJlc29sdmUgfHwge30pLnRoZW4oZnVuY3Rpb24obG9jYWxzKSB7XG4gICAgICBhbmd1bGFyLmV4dGVuZChyZXF1ZXN0LmxvY2FscywgbG9jYWxzKTtcbiAgICAgIG5leHQoKTtcblxuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgbmV4dChuZXcgRXJyb3IoJ0Vycm9yIHJlc29sdmluZyBzdGF0ZScpKTtcbiAgICB9KTtcbiAgfTtcbiAgX3JlZ2lzdGVyLnByaW9yaXR5ID0gMTAwO1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoX3JlZ2lzdGVyKTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xudmFyIFBhcmFtZXRlcnMgPSByZXF1aXJlKCcuLi91dGlscy9wYXJhbWV0ZXJzJyk7XG52YXIgUXVldWVIYW5kbGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvcXVldWUtaGFuZGxlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFtmdW5jdGlvbiBTdGF0ZVJvdXRlclByb3ZpZGVyKCkge1xuICAvLyBQcm92aWRlclxuICB2YXIgX3Byb3ZpZGVyID0gdGhpcztcblxuICAvLyBDb25maWd1cmF0aW9uLCBnbG9iYWwgb3B0aW9uc1xuICB2YXIgX2NvbmZpZ3VyYXRpb24gPSB7XG4gICAgaGlzdG9yeUxlbmd0aDogNVxuICB9O1xuXG4gIC8vIFN0YXRlIGRlZmluaXRpb24gbGlicmFyeVxuICB2YXIgX3N0YXRlTGlicmFyeSA9IHt9O1xuICB2YXIgX3N0YXRlQ2FjaGUgPSB7fTtcblxuICAvLyBVUkwgdG8gc3RhdGUgZGljdGlvbmFyeVxuICB2YXIgX3VybERpY3Rpb25hcnkgPSBuZXcgVXJsRGljdGlvbmFyeSgpO1xuXG4gIC8vIE1pZGRsZXdhcmUgbGF5ZXJzXG4gIHZhciBfbGF5ZXJMaXN0ID0gW107XG5cbiAgLyoqXG4gICAqIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAqIFxuICAgKiBBc3N1bWUgYWxsIHBhcmFtZXRlciB2YWx1ZXMgYXJlIHN0cmluZ3NcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVBhcmFtcyBBIG5hbWUtcGFyYW1zIHN0cmluZ1xuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgIEEgbmFtZSBzdHJpbmcgYW5kIHBhcmFtIE9iamVjdFxuICAgKi9cbiAgdmFyIF9wYXJzZU5hbWUgPSBmdW5jdGlvbihuYW1lUGFyYW1zKSB7XG4gICAgaWYobmFtZVBhcmFtcyAmJiBuYW1lUGFyYW1zLm1hdGNoKC9eW2EtekEtWjAtOV9cXC5dKlxcKC4qXFwpJC8pKSB7XG4gICAgICB2YXIgbnBhcnQgPSBuYW1lUGFyYW1zLnN1YnN0cmluZygwLCBuYW1lUGFyYW1zLmluZGV4T2YoJygnKSk7XG4gICAgICB2YXIgcHBhcnQgPSBQYXJhbWV0ZXJzKCBuYW1lUGFyYW1zLnN1YnN0cmluZyhuYW1lUGFyYW1zLmluZGV4T2YoJygnKSsxLCBuYW1lUGFyYW1zLmxhc3RJbmRleE9mKCcpJykpICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5wYXJ0LFxuICAgICAgICBwYXJhbXM6IHBwYXJ0XG4gICAgICB9O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5hbWVQYXJhbXMsXG4gICAgICAgIHBhcmFtczogbnVsbFxuICAgICAgfTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBkZWZhdWx0IHZhbHVlcyB0byBhIHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBbiBPYmplY3RcbiAgICovXG4gIHZhciBfc2V0U3RhdGVEZWZhdWx0cyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAvLyBEZWZhdWx0IHZhbHVlc1xuICAgIGRhdGEuaW5oZXJpdCA9ICh0eXBlb2YgZGF0YS5pbmhlcml0ID09PSAndW5kZWZpbmVkJykgPyB0cnVlIDogZGF0YS5pbmhlcml0O1xuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIG5hbWVcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gbmFtZS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvW2EtekEtWjAtOV9dKy8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgcXVlcnlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcXVlcnkgQSBxdWVyeSBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlUXVlcnkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IHF1ZXJ5LnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC8oXFwqKFxcKik/fFthLXpBLVowLTlfXSspLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDb21wYXJlIHR3byBzdGF0ZXMsIGNvbXBhcmVzIHZhbHVlcy4gIFxuICAgKiBcbiAgICogQHJldHVybiB7Qm9vbGVhbn0gVHJ1ZSBpZiBzdGF0ZXMgYXJlIHRoZSBzYW1lLCBmYWxzZSBpZiBzdGF0ZXMgYXJlIGRpZmZlcmVudFxuICAgKi9cbiAgdmFyIF9jb21wYXJlU3RhdGVzID0gZnVuY3Rpb24oYSwgYikge1xuICAgIGEgPSBhIHx8IHt9O1xuICAgIGIgPSBiIHx8IHt9O1xuICAgIHJldHVybiBhLm5hbWUgPT09IGIubmFtZSAmJiBhbmd1bGFyLmVxdWFscyhhLnBhcmFtcywgYi5wYXJhbXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIHBhcmVudCBzdGF0ZXNcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgIEFuIEFycmF5IG9mIHBhcmVudCBzdGF0ZXNcbiAgICovXG4gIHZhciBfZ2V0TmFtZUNoYWluID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBuYW1lTGlzdCA9IG5hbWUuc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBuYW1lTGlzdFxuICAgICAgLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgICAgIHJldHVybiBsaXN0LnNsaWNlKDAsIGkrMSkuam9pbignLicpO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbnVsbDtcbiAgICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY3Jhd2wgbGlicmFyeSBoZWlyYXJjaHlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9nZXRTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIHZhciBzdGF0ZSA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBxdWVyaWVzXG4gICAgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgLy8gVXNlIGNhY2hlIGlmIGV4aXN0c1xuICAgIH0gZWxzZSBpZihfc3RhdGVDYWNoZVtuYW1lXSkge1xuICAgICAgcmV0dXJuIF9zdGF0ZUNhY2hlW25hbWVdO1xuICAgIH1cblxuICAgIHZhciBuYW1lQ2hhaW4gPSBfZ2V0TmFtZUNoYWluKG5hbWUpO1xuICAgIHZhciBzdGF0ZUNoYWluID0gbmFtZUNoYWluXG4gICAgICAubWFwKGZ1bmN0aW9uKG5hbWUsIGkpIHtcbiAgICAgICAgdmFyIGl0ZW0gPSBhbmd1bGFyLmNvcHkoX3N0YXRlTGlicmFyeVtuYW1lXSk7XG5cbiAgICAgICAgaWYoaXRlbSAmJiBpICE9PSBuYW1lQ2hhaW4ubGVuZ3RoLTEpIHtcbiAgICAgICAgICBkZWxldGUoaXRlbS5yZXNvbHZlKTtcbiAgICAgICAgICBkZWxldGUoaXRlbS50ZW1wbGF0ZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihwYXJlbnQpIHtcbiAgICAgICAgcmV0dXJuICEhcGFyZW50O1xuICAgICAgfSk7XG5cbiAgICAvLyBXYWxrIHVwIGNoZWNraW5nIGluaGVyaXRhbmNlXG4gICAgZm9yKHZhciBpPXN0YXRlQ2hhaW4ubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoc3RhdGVDaGFpbltpXSkge1xuICAgICAgICB2YXIgbmV4dFN0YXRlID0gc3RhdGVDaGFpbltpXTtcbiAgICAgICAgc3RhdGUgPSBhbmd1bGFyLm1lcmdlKG5leHRTdGF0ZSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiBzdGF0ZS5pbmhlcml0ID09PSBmYWxzZSkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfc3RhdGVDYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uLiAgUGFyYW1ldGVycyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gZGF0YSBPYmplY3Qgbm90IHN0YXRlIG5hbWUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfc3RhdGVMaWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICAvLyBSZXNldCBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgICAvLyBVUkwgbWFwcGluZ1xuICAgIGlmKHN0YXRlLnVybCkge1xuICAgICAgX3VybERpY3Rpb25hcnkuYWRkKHN0YXRlLnVybCwgc3RhdGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBkYXRhIHBhcmFtZXRlcnMgZm9yIFN0YXRlUm91dGVyXG4gICAqXG4gICAqIEluY2x1ZGluZyBwYXJhbWV0ZXJzOlxuICAgKiBcbiAgICogLSBoaXN0b3J5TGVuZ3RoICAge051bWJlcn0gRGVmYXVsdHMgdG8gNVxuICAgKiAtIGluaXRpYWxMb2NhdGlvbiB7T2JqZWN0fSBBbiBPYmplY3R7bmFtZTpTdHJpbmcsIHBhcmFtczpPYmplY3R9IGZvciBpbml0aWFsIHN0YXRlIHRyYW5zaXRpb25cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIG9wdGlvbnMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5vcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGFuZ3VsYXIuZXh0ZW5kKF9jb25maWd1cmF0aW9uLCBvcHRpb25zIHx8IHt9KTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAqIFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuc3RhdGUgPSBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgIGlmKCFzdGF0ZSkge1xuICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICB9XG4gICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgaW5pdGlhbGl6YXRpb24gcGFyYW1ldGVyczsgZGVmZXJyZWQgdG8gJHJlYWR5KClcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBuYW1lICAgQSBpbmlpdGFsIHN0YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBwYXJhbXMgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgX2NvbmZpZ3VyYXRpb24uaW5pdGlhbExvY2F0aW9uID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgaW5zdGFuY2VcbiAgICovXG4gIHRoaXMuJGdldCA9IFsnJHJvb3RTY29wZScsICckbG9jYXRpb24nLCAnJHEnLCBmdW5jdGlvbiBTdGF0ZVJvdXRlckZhY3RvcnkoJHJvb3RTY29wZSwgJGxvY2F0aW9uLCAkcSkge1xuXG4gICAgLy8gQ3VycmVudCBzdGF0ZVxuICAgIHZhciBfY3VycmVudDtcblxuICAgIHZhciBfb3B0aW9ucztcbiAgICB2YXIgX2luaXRhbExvY2F0aW9uO1xuICAgIHZhciBfaGlzdG9yeSA9IFtdO1xuICAgIHZhciBfaXNJbml0ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAgICogXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBfcHVzaEhpc3RvcnkgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgICAgIHZhciBoaXN0b3J5TGVuZ3RoID0gX29wdGlvbnMuaGlzdG9yeUxlbmd0aCB8fCA1O1xuXG4gICAgICBpZihkYXRhKSB7XG4gICAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IGhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIGhpc3RvcnlMZW5ndGgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHRvIHN0YXRlLiAgUGFyYW1ldGVycyBpbiBgcGFyYW1zYCB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgc3RhdGUtbm90YXRpb24gYG5hbWVgIGV4cHJlc3Npb24uICBcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb24gaW5jbHVkaW5nIG9wdGlvbmFsIHBhcmFtZXRlcnNcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgICAgICAgIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIG9jY3Vyc1xuICAgICAqL1xuICAgIHZhciBfY2hhbmdlU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgICRyb290U2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgICAgIC8vIFBhcnNlIHN0YXRlLW5vdGF0aW9uIGV4cHJlc3Npb25cbiAgICAgICAgdmFyIG5hbWVFeHByID0gX3BhcnNlTmFtZShuYW1lKTtcbiAgICAgICAgbmFtZSA9IG5hbWVFeHByLm5hbWU7XG4gICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5hbWVFeHByLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcblxuICAgICAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgICAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgICAgIGxvY2Fsczoge31cbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDb21waWxlIGV4ZWN1dGlvbiBwaGFzZXNcbiAgICAgICAgdmFyIHF1ZXVlID0gUXVldWVIYW5kbGVyKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgICAgICB2YXIgbmV4dFN0YXRlID0gYW5ndWxhci5jb3B5KF9nZXRTdGF0ZShuYW1lKSk7XG4gICAgICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgICAgICBpZihuZXh0U3RhdGUpIHtcbiAgICAgICAgICAvLyBTZXQgbG9jYWxzXG4gICAgICAgICAgbmV4dFN0YXRlLmxvY2FscyA9IHJlcXVlc3QubG9jYWxzO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNldCBwYXJhbWV0ZXJzXG4gICAgICAgICAgbmV4dFN0YXRlLnBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5leHRTdGF0ZS5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgICAgICBpZihuZXh0U3RhdGUgPT09IG51bGwpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvck5vdEZvdW5kJywgZXJyb3IsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dChlcnJvcik7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICAgICAgfSBlbHNlIGlmKF9jb21wYXJlU3RhdGVzKHByZXZTdGF0ZSwgbmV4dFN0YXRlKSkge1xuICAgICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VCZWdpbicsIHJlcXVlc3QpO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gTWFrZSBzdGF0ZSBjaGFuZ2VcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgaWYocHJldlN0YXRlKSBfcHVzaEhpc3RvcnkocHJldlN0YXRlKTtcbiAgICAgICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBBZGQgbWlkZGxld2FyZVxuICAgICAgICAgIHF1ZXVlLmFkZChfbGF5ZXJMaXN0KTtcblxuICAgICAgICAgIC8vIFByb2Nlc3MgZW5kZWRcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFbmQnLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJ1blxuICAgICAgICBxdWV1ZS5leGVjdXRlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvcicsIGVyciwgcmVxdWVzdCk7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlcXVlc3QpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlQ29tcGxldGUnLCByZXF1ZXN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIC8vIEluc3RhbmNlXG4gICAgdmFyIF9pbnN0O1xuICAgIF9pbnN0ID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBvcHRpb25zXG4gICAgICAgKlxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvbmZpZ3VyZWQgb3B0aW9uc1xuICAgICAgICovXG4gICAgICBvcHRpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gSGFzbid0IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9vcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIHN0YXRlOiBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgICAgICBpZighc3RhdGUpIHtcbiAgICAgICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBtaWRkbGV3YXJlLCBleGVjdXRpbmcgbmV4dChlcnIpO1xuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgaGFuZGxlciBBIGNhbGxiYWNrLCBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHVzZTogZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBfbGF5ZXJMaXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHBlcmZvcm0gaW5pdGlhbGl6YXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkcmVhZHk6IGZ1bmN0aW9uKCkge1xuICAgICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYoIV9pc0luaXQpIHtcbiAgICAgICAgICAgIF9pc0luaXQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBDb25maWd1cmF0aW9uXG4gICAgICAgICAgICBpZighX29wdGlvbnMpIHtcbiAgICAgICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgICBpZihfb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaW5pdGlhbExvY2F0aW9uJykpIHtcbiAgICAgICAgICAgICAgX2luaXRhbExvY2F0aW9uID0gYW5ndWxhci5jb3B5KF9vcHRpb25zLmluaXRpYWxMb2NhdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZWFkeURlZmVycmVkID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgICAgICAgaWYoJGxvY2F0aW9uLnVybCgpICE9PSAnJykge1xuICAgICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2luc3QuJGxvY2F0aW9uKCRsb2NhdGlvbi51cmwoKSk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpemUgd2l0aCBzdGF0ZVxuICAgICAgICAgICAgfSBlbHNlIGlmKF9pbml0YWxMb2NhdGlvbikge1xuICAgICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2NoYW5nZVN0YXRlKF9pbml0YWxMb2NhdGlvbi5uYW1lLCBfaW5pdGFsTG9jYXRpb24ucGFyYW1zKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJHEud2hlbihyZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUluaXQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLy8gUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICAgIHBhcnNlOiBfcGFyc2VOYW1lLFxuXG4gICAgICAvLyBSZXRyaWV2ZSBkZWZpbml0aW9uIG9mIHN0YXRlc1xuICAgICAgbGlicmFyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfc3RhdGVMaWJyYXJ5O1xuICAgICAgfSxcblxuICAgICAgLy8gVmFsaWRhdGlvblxuICAgICAgdmFsaWRhdGU6IHtcbiAgICAgICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgICAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICAgICAgfSxcblxuICAgICAgLy8gUmV0cmlldmUgaGlzdG9yeVxuICAgICAgaGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfaGlzdG9yeTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBfY2hhbmdlU3RhdGUobmFtZSwgcGFyYW1zKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgdmFyIHN0YXRlID0gZGF0YS5yZWY7XG5cbiAgICAgICAgICBpZihzdGF0ZSkge1xuICAgICAgICAgICAgLy8gUGFyc2UgcGFyYW1zIGZyb20gdXJsXG4gICAgICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlKHN0YXRlLm5hbWUsIGRhdGEucGFyYW1zKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3JOb3RGb3VuZCcsIGVycm9yLCB7XG4gICAgICAgICAgICB1cmw6IHVybFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICRxLnJlamVjdChuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIGxvY2F0aW9uIGluIGxpYnJhcnknKSk7XG4gICAgICB9LFxuICAgICAgXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGN1cnJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7TWl4ZWR9ICAgcXVlcnkgIEEgc3RyaW5nIHVzaW5nIHN0YXRlIG5vdGF0aW9uIG9yIGEgUmVnRXhwXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGFjdGl2ZTogZnVuY3Rpb24ocXVlcnksIHBhcmFtcykge1xuICAgICAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgLy8gTm8gc3RhdGVcbiAgICAgICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICAgICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAgICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICAgICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X10qJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gX2luc3Q7XG4gIH1dO1xuXG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyRsb2NhdGlvbicsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24sICRyb290U2NvcGUpIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYoY3VycmVudCAmJiBjdXJyZW50LnVybCkge1xuICAgICAgdmFyIHBhdGg7XG4gICAgICBwYXRoID0gY3VycmVudC51cmw7XG5cbiAgICAgIC8vIEFkZCBwYXJhbWV0ZXJzIG9yIHVzZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAgICAgIHZhciBwYXJhbXMgPSBjdXJyZW50LnBhcmFtcyB8fCB7fTtcbiAgICAgIHZhciBxdWVyeSA9IHt9O1xuICAgICAgZm9yKHZhciBuYW1lIGluIHBhcmFtcykge1xuICAgICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKCc6JytuYW1lLCAnZycpO1xuICAgICAgICBpZihwYXRoLm1hdGNoKHJlKSkge1xuICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UocmUsIHBhcmFtc1tuYW1lXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcXVlcnlbbmFtZV0gPSBwYXJhbXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgJGxvY2F0aW9uLnBhdGgocGF0aCk7XG4gICAgICAkbG9jYXRpb24uc2VhcmNoKHF1ZXJ5KTtcbiAgICAgIFxuICAgICAgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgX3NlbGYubG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgJHN0YXRlLiRsb2NhdGlvbihfdXJsKTtcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvY2F0aW9uU3RhdGVVcGRhdGUnKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgX3VwZGF0ZSgpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBhcnNlIE9iamVjdCBsaXRlcmFsIG5hbWUtdmFsdWUgcGFpcnNcbnZhciByZVBhcnNlT2JqZWN0TGl0ZXJhbCA9IC8oWyx7XVxccyooKFwifCcpKC4qPylcXDN8XFx3Kil8KDpcXHMqKFsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT98dHJ1ZXxmYWxzZXxudWxsfChcInwnKSguKj8pXFw3fFxcW1teXFxdXSpcXF0pKSkvZztcblxuLy8gTWF0Y2ggU3RyaW5nc1xudmFyIHJlU3RyaW5nID0gL14oXCJ8JykoLio/KVxcMSQvO1xuXG4vLyBUT0RPIEFkZCBlc2NhcGVkIHN0cmluZyBxdW90ZXMgXFwnIGFuZCBcXFwiIHRvIHN0cmluZyBtYXRjaGVyXG5cbi8vIE1hdGNoIE51bWJlciAoaW50L2Zsb2F0L2V4cG9uZW50aWFsKVxudmFyIHJlTnVtYmVyID0gL15bKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/JC87XG5cbi8qKlxuICogUGFyc2Ugc3RyaW5nIHZhbHVlIGludG8gQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGwuXG4gKlxuICogU3RyaW5ncyBhcmUgc3Vycm91bmRlZCBieSBhIHBhaXIgb2YgbWF0Y2hpbmcgcXVvdGVzXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdmFsdWUgQSBTdHJpbmcgdmFsdWUgdG8gcGFyc2VcbiAqIEByZXR1cm4ge01peGVkfSAgICAgICAgQSBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbFxuICovXG52YXIgX3Jlc29sdmVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cbiAgLy8gQm9vbGVhbjogdHJ1ZVxuICBpZih2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgLy8gQm9vbGVhbjogZmFsc2VcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE51bGxcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnbnVsbCcpIHtcbiAgICByZXR1cm4gbnVsbDtcblxuICAvLyBTdHJpbmdcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlU3RyaW5nKSkge1xuICAgIHJldHVybiB2YWx1ZS5zdWJzdHIoMSwgdmFsdWUubGVuZ3RoLTIpO1xuXG4gIC8vIE51bWJlclxuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVOdW1iZXIpKSB7XG4gICAgcmV0dXJuICt2YWx1ZTtcblxuICAvLyBOYU5cbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnTmFOJykge1xuICAgIHJldHVybiBOYU47XG5cbiAgLy8gVE9ETyBhZGQgbWF0Y2hpbmcgd2l0aCBBcnJheXMgYW5kIHBhcnNlXG4gIFxuICB9XG5cbiAgLy8gVW5hYmxlIHRvIHJlc29sdmVcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gRmluZCB2YWx1ZXMgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbnZhciBfbGlzdGlmeSA9IGZ1bmN0aW9uKHN0cikge1xuXG4gIC8vIFRyaW1cbiAgc3RyID0gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuXG4gIGlmKHN0ci5tYXRjaCgvXlxccyp7Lip9XFxzKiQvKSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVycyBleHBlY3RzIGFuIE9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHNhbml0aXplTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9eW1xceyxdP1xccypbXCInXT8vLCAnJykucmVwbGFjZSgvW1wiJ10/XFxzKiQvLCAnJyk7XG4gIH07XG5cbiAgdmFyIHNhbml0aXplVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzdHIgPSB2YWx1ZS5yZXBsYWNlKC9eKDopP1xccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgcmV0dXJuIF9yZXNvbHZlVmFsdWUoc3RyKTtcbiAgfTtcblxuICByZXR1cm4gc3RyLm1hdGNoKHJlUGFyc2VPYmplY3RMaXRlcmFsKS5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIHJldHVybiBpJTIgPT09IDAgPyBzYW5pdGl6ZU5hbWUoaXRlbSkgOiBzYW5pdGl6ZVZhbHVlKGl0ZW0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFyYW1zIE9iamVjdCBmcm9tIHN0cmluZ1xuICogXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5naWZpZWQgdmVyc2lvbiBvZiBPYmplY3QgbGl0ZXJhbFxuICovXG52YXIgUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHN0cikge1xuICBzdHIgPSBzdHIgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgX2xpc3RpZnkoc3RyKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICBpZihpJTIgPT09IDApIHtcbiAgICAgIF9zZWxmW2l0ZW1dID0gbGlzdFtpKzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYXJhbWV0ZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5yZXNvbHZlVmFsdWUgPSBfcmVzb2x2ZVZhbHVlO1xubW9kdWxlLmV4cG9ydHMubGlzdGlmeSA9IF9saXN0aWZ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEV4ZWN1dGUgYSBzZXJpZXMgb2YgZnVuY3Rpb25zOyB1c2VkIGluIHRhbmRlbSB3aXRoIG1pZGRsZXdhcmVcbiAqL1xudmFyIFF1ZXVlSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgX2xpc3QgPSBbXTtcbiAgdmFyIF9kYXRhID0gbnVsbDtcblxuICB2YXIgX3NlbGYgPSB7XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBoYW5kbGVyXG4gICAgICogXG4gICAgICogQHBhcmFtIHtNaXhlZH0gICAgICAgICBoYW5kbGVyIEEgRnVuY3Rpb24gb3IgYW4gQXJyYXkgb2YgRnVuY3Rpb25zIHRvIGFkZCB0byB0aGUgcXVldWVcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZUhhbmRsZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgKi9cbiAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgIGlmKGhhbmRsZXIgJiYgaGFuZGxlci5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfbGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIERhdGEgb2JqZWN0XG4gICAgICogXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgZGF0YSBvYmplY3QgbWFkZSBhdmFpbGFibGUgdG8gZWFjaCBoYW5kbGVyXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgZGF0YTogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgX2RhdGEgPSBkYXRhO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEJlZ2luIGV4ZWN1dGlvbiBhbmQgdHJpZ2dlciBjYWxsYmFjayBhdCB0aGUgZW5kXG4gICAgICogXG4gICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZUhhbmRsZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgKi9cbiAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgdmFyIG5leHRIYW5kbGVyO1xuICAgICAgdmFyIGV4ZWN1dGlvbkxpc3QgPSBfbGlzdC5zbGljZSgwKS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIChhLnByaW90aXR5IHx8IDEpIDwgKGIucHJpb3RpdHkgfHwgMSk7XG4gICAgICB9KTtcblxuICAgICAgbmV4dEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBleGVjdXRpb25MaXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgLy8gQ29tcGxldGVcbiAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsKTtcblxuICAgICAgICAvLyBOZXh0IGhhbmRsZXJcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgLy8gRXJyb3JcbiAgICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICAvLyBDb250aW51ZVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICB9XG5cbiAgfTtcbiAgXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVIYW5kbGVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybCA9IHJlcXVpcmUoJy4vdXJsJyk7XG5cbi8qKlxuICogQ29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVXJsRGljdGlvbmFyeSgpIHtcbiAgdGhpcy5fcGF0dGVybnMgPSBbXTtcbiAgdGhpcy5fcmVmcyA9IFtdO1xuICB0aGlzLl9wYXJhbXMgPSBbXTtcbn1cblxuLyoqXG4gKiBBc3NvY2lhdGUgYSBVUkwgcGF0dGVybiB3aXRoIGEgcmVmZXJlbmNlXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gcGF0dGVybiBBIFVSTCBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHJlZiAgICAgQSBkYXRhIE9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihwYXR0ZXJuLCByZWYpIHtcbiAgcGF0dGVybiA9IHBhdHRlcm4gfHwgJyc7XG4gIHZhciBfc2VsZiA9IHRoaXM7XG4gIHZhciBpID0gdGhpcy5fcGF0dGVybnMubGVuZ3RoO1xuXG4gIHZhciBwYXRoQ2hhaW47XG4gIHZhciBwYXJhbXMgPSB7fTtcblxuICBpZihwYXR0ZXJuLmluZGV4T2YoJz8nKSA9PT0gLTEpIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG5cbiAgfSBlbHNlIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG4gIH1cblxuICAvLyBTdGFydFxuICB2YXIgc2VhcmNoRXhwciA9ICdeJztcblxuICAvLyBJdGVtc1xuICAocGF0aENoYWluLmZvckVhY2goZnVuY3Rpb24oY2h1bmssIGkpIHtcbiAgICBpZihpIT09MCkge1xuICAgICAgc2VhcmNoRXhwciArPSAnXFxcXC8nO1xuICAgIH1cblxuICAgIGlmKGNodW5rWzBdID09PSAnOicpIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1teXFxcXC8/XSonO1xuICAgICAgcGFyYW1zW2NodW5rLnN1YnN0cmluZygxKV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gY2h1bms7XG4gICAgfVxuICB9KSk7XG5cbiAgLy8gRW5kXG4gIHNlYXJjaEV4cHIgKz0gJ1tcXFxcL10/JCc7XG5cbiAgdGhpcy5fcGF0dGVybnNbaV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuICB0aGlzLl9yZWZzW2ldID0gcmVmO1xuICB0aGlzLl9wYXJhbXNbaV0gPSBwYXJhbXM7XG59O1xuXG4vKipcbiAqIEZpbmQgYSByZWZlcmVuY2UgYWNjb3JkaW5nIHRvIGEgVVJMIHBhdHRlcm4gYW5kIHJldHJpZXZlIHBhcmFtcyBkZWZpbmVkIGluIFVSTFxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgIEEgVVJMIHRvIHRlc3QgZm9yXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRlZmF1bHRzIEEgZGF0YSBPYmplY3Qgb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIEEgcmVmZXJlbmNlIHRvIGEgc3RvcmVkIG9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbih1cmwsIGRlZmF1bHRzKSB7XG4gIHVybCA9IHVybCB8fCAnJztcbiAgdmFyIHAgPSBVcmwodXJsKS5wYXRoKCk7XG4gIHZhciBxID0gVXJsKHVybCkucXVlcnlwYXJhbXMoKTtcblxuICB2YXIgX3NlbGYgPSB0aGlzO1xuXG4gIC8vIENoZWNrIGRpY3Rpb25hcnlcbiAgdmFyIF9maW5kUGF0dGVybiA9IGZ1bmN0aW9uKGNoZWNrKSB7XG4gICAgY2hlY2sgPSBjaGVjayB8fCAnJztcbiAgICBmb3IodmFyIGk9X3NlbGYuX3BhdHRlcm5zLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKGNoZWNrLm1hdGNoKF9zZWxmLl9wYXR0ZXJuc1tpXSkgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICB2YXIgaSA9IF9maW5kUGF0dGVybihwKTtcbiAgXG4gIC8vIE1hdGNoaW5nIHBhdHRlcm4gZm91bmRcbiAgaWYoaSAhPT0gLTEpIHtcblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBwYXR0ZXJuIG1hdGNoXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xuICAgIGZvcih2YXIgbiBpbiB0aGlzLl9wYXJhbXNbaV0pIHtcbiAgICAgIHZhciBwYXJhbVBhcnNlciA9IHRoaXMuX3BhcmFtc1tpXVtuXTtcbiAgICAgIHZhciB1cmxNYXRjaCA9ICh1cmwubWF0Y2gocGFyYW1QYXJzZXIpIHx8IFtdKS5wb3AoKSB8fCAnJztcbiAgICAgIHZhciB2YXJNYXRjaCA9IHVybE1hdGNoLnNwbGl0KCcvJykucG9wKCk7XG4gICAgICBwYXJhbXNbbl0gPSB2YXJNYXRjaDtcbiAgICB9XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcXVlcnlzdHJpbmcgbWF0Y2hcbiAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChxLCBwYXJhbXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgcmVmOiB0aGlzLl9yZWZzW2ldLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuXG4gIC8vIE5vdCBpbiBkaWN0aW9uYXJ5XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsRGljdGlvbmFyeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVXJsKHVybCkge1xuICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwYXRoIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHBhdGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gdXJsIDogdXJsLnN1YnN0cmluZygwLCB1cmwuaW5kZXhPZignPycpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXN0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnJyA6IHVybC5zdWJzdHJpbmcodXJsLmluZGV4T2YoJz8nKSsxKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTCBwYXJhbWV0ZXJzIGFzIGEgaGFzaFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXBhcmFtczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGFpcnMgPSBfc2VsZi5xdWVyeXN0cmluZygpLnNwbGl0KCcmJyk7XG4gICAgICB2YXIgcGFyYW1zID0ge307XG5cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBhaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHBhaXJzW2ldID09PSAnJykgY29udGludWU7XG4gICAgICAgIHZhciBuYW1lVmFsdWUgPSBwYWlyc1tpXS5zcGxpdCgnPScpO1xuICAgICAgICBwYXJhbXNbbmFtZVZhbHVlWzBdXSA9ICh0eXBlb2YgbmFtZVZhbHVlWzFdID09PSAndW5kZWZpbmVkJyB8fCBuYW1lVmFsdWVbMV0gPT09ICcnKSA/IHRydWUgOiBuYW1lVmFsdWVbMV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBfc2VsZjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmw7XG4iXX0=
