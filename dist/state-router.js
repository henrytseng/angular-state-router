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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9xdWV1ZS1oYW5kbGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFPLFVB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QUksS0FBSztFQUNoQixNQUFNLE9BQU87OztFQUdiLElBQUksUUFBUTs7Ozs7OztJQU9WLE1BQU0sV0FBVztNQUNmLE9BQU8sSUFBSSxRQUFRLFNBQVMsQ0FBQyxJQUFJLE1BQU0sSUFBSSxVQUFVLEdBQUcsSUFBSSxRQUFROzs7Ozs7OztJQVF0RSxhQUFhLFdBQVc7TUFDdEIsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxRQUFRLEtBQUs7Ozs7Ozs7O0lBUXZFLGFBQWEsV0FBVztNQUN0QixJQUFJLFFBQVEsTUFBTSxjQUFjLE1BQU07TUFDdEMsSUFBSSxTQUFTOztNQUViLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLFFBQVEsS0FBSztRQUNoQyxHQUFHLE1BQU0sT0FBTyxJQUFJO1FBQ3BCLElBQUksWUFBWSxNQUFNLEdBQUcsTUFBTTtRQUMvQixPQUFPLFVBQVUsTUFBTSxDQUFDLE9BQU8sVUFBVSxPQUFPLGVBQWUsVUFBVSxPQUFPLE1BQU0sT0FBTyxVQUFVOzs7TUFHekcsT0FBTzs7OztFQUlYLE9BQU87OztBQUdULE9BQU8sVUFBVTtBQUNqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGUnLCBmdW5jdGlvbiAoJHN0YXRlKSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdBJyxcbiAgICBzY29wZToge1xuICAgIH0sXG4gICAgbGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG4gICAgICBlbGVtZW50LmNzcygnY3Vyc29yJywgJ3BvaW50ZXInKTtcbiAgICAgIGVsZW1lbnQub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAkc3RhdGUuY2hhbmdlKGF0dHJzLnNyZWYpO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgfTtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgYW5ndWxhcjpmYWxzZSAqL1xuXG4vLyBDb21tb25KU1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIGV4cG9ydHMgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgPT09IGV4cG9ydHMpe1xuICBtb2R1bGUuZXhwb3J0cyA9ICdhbmd1bGFyLXN0YXRlLXJvdXRlcic7XG59XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLnByb3ZpZGVyKCckc3RhdGUnLCByZXF1aXJlKCcuL3NlcnZpY2VzL3N0YXRlLXJvdXRlcicpKVxuXG4gIC5mYWN0b3J5KCckdXJsTWFuYWdlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvdXJsLW1hbmFnZXInKSlcblxuICAuZmFjdG9yeSgnJHJlc29sdXRpb24nLCByZXF1aXJlKCcuL3NlcnZpY2VzL3Jlc29sdXRpb24nKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckc3RhdGUnLCAnJHVybE1hbmFnZXInLCAnJHJlc29sdXRpb24nLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkc3RhdGUsICR1cmxNYW5hZ2VyLCAkcmVzb2x1dGlvbikge1xuICAgIC8vIFVwZGF0ZSBsb2NhdGlvbiBjaGFuZ2VzXG4gICAgJHJvb3RTY29wZS4kb24oJyRsb2NhdGlvbkNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbigpIHtcbiAgICAgICR1cmxNYW5hZ2VyLmxvY2F0aW9uKGFyZ3VtZW50cyk7XG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWFsaXplXG4gICAgJHN0YXRlLiRyZWFkeSgpO1xuICB9XSlcblxuICAuZGlyZWN0aXZlKCdzcmVmJywgcmVxdWlyZSgnLi9kaXJlY3RpdmVzL3NyZWYnKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcScsICckaW5qZWN0b3InLCAnJHN0YXRlJywgZnVuY3Rpb24oJHEsICRpbmplY3RvciwgJHN0YXRlKSB7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFJlc29sdmVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gIHJlc29sdmUgQSBoYXNoIE9iamVjdCBvZiBpdGVtcyB0byByZXNvbHZlXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHRlbXBsYXRlcyByZXRpcmV2ZWRcbiAgICovXG4gIHZhciBfcmVzb2x2ZSA9IGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICB2YXIgcmVzb2x2ZXNQcm9taXNlcyA9IHt9O1xuXG4gICAgYW5ndWxhci5mb3JFYWNoKHJlc29sdmUsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgIHZhciByZXNvbHV0aW9uID0gYW5ndWxhci5pc1N0cmluZyh2YWx1ZSkgPyAkaW5qZWN0b3IuZ2V0KHZhbHVlKSA6ICRpbmplY3Rvci5pbnZva2UodmFsdWUsIG51bGwsIG51bGwsIGtleSk7XG4gICAgICByZXNvbHZlc1Byb21pc2VzW2tleV0gPSAkcS53aGVuKHJlc29sdXRpb24pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuICRxLmFsbChyZXNvbHZlc1Byb21pc2VzKTtcbiAgfTtcbiAgX3NlbGYucmVzb2x2ZSA9IF9yZXNvbHZlO1xuXG4gIC8qKlxuICAgKiBNaWRkbGV3YXJlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcmVxdWVzdCBBIGRhdGEgT2JqZWN0XG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBuZXh0ICAgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICovXG4gIHZhciBfcmVnaXN0ZXIgPSBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYoIWN1cnJlbnQpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfVxuXG4gICAgX3Jlc29sdmUoY3VycmVudC5yZXNvbHZlIHx8IHt9KS50aGVuKGZ1bmN0aW9uKGxvY2Fscykge1xuICAgICAgYW5ndWxhci5leHRlbmQocmVxdWVzdC5sb2NhbHMsIGxvY2Fscyk7XG4gICAgICBuZXh0KCk7XG5cbiAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIG5leHQobmV3IEVycm9yKCdFcnJvciByZXNvbHZpbmcgc3RhdGUnKSk7XG4gICAgfSk7XG4gIH07XG4gIF9yZWdpc3Rlci5wcmlvcml0eSA9IDEwMDtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZS4kdXNlKF9yZWdpc3Rlcik7XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcbnZhciBQYXJhbWV0ZXJzID0gcmVxdWlyZSgnLi4vdXRpbHMvcGFyYW1ldGVycycpO1xudmFyIFF1ZXVlSGFuZGxlciA9IHJlcXVpcmUoJy4uL3V0aWxzL3F1ZXVlLWhhbmRsZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbZnVuY3Rpb24gU3RhdGVSb3V0ZXJQcm92aWRlcigpIHtcbiAgLy8gUHJvdmlkZXJcbiAgdmFyIF9wcm92aWRlciA9IHRoaXM7XG5cbiAgLy8gQ29uZmlndXJhdGlvbiwgZ2xvYmFsIG9wdGlvbnNcbiAgdmFyIF9jb25maWd1cmF0aW9uID0ge1xuICAgIGhpc3RvcnlMZW5ndGg6IDVcbiAgfTtcblxuICAvLyBTdGF0ZSBkZWZpbml0aW9uIGxpYnJhcnlcbiAgdmFyIF9zdGF0ZUxpYnJhcnkgPSB7fTtcbiAgdmFyIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgLy8gVVJMIHRvIHN0YXRlIGRpY3Rpb25hcnlcbiAgdmFyIF91cmxEaWN0aW9uYXJ5ID0gbmV3IFVybERpY3Rpb25hcnkoKTtcblxuICAvLyBNaWRkbGV3YXJlIGxheWVyc1xuICB2YXIgX2xheWVyTGlzdCA9IFtdO1xuXG4gIC8qKlxuICAgKiBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgKiBcbiAgICogQXNzdW1lIGFsbCBwYXJhbWV0ZXIgdmFsdWVzIGFyZSBzdHJpbmdzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVQYXJhbXMgQSBuYW1lLXBhcmFtcyBzdHJpbmdcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIHZhciBfcGFyc2VOYW1lID0gZnVuY3Rpb24obmFtZVBhcmFtcykge1xuICAgIGlmKG5hbWVQYXJhbXMgJiYgbmFtZVBhcmFtcy5tYXRjaCgvXlthLXpBLVowLTlfXFwuXSpcXCguKlxcKSQvKSkge1xuICAgICAgdmFyIG5wYXJ0ID0gbmFtZVBhcmFtcy5zdWJzdHJpbmcoMCwgbmFtZVBhcmFtcy5pbmRleE9mKCcoJykpO1xuICAgICAgdmFyIHBwYXJ0ID0gUGFyYW1ldGVycyggbmFtZVBhcmFtcy5zdWJzdHJpbmcobmFtZVBhcmFtcy5pbmRleE9mKCcoJykrMSwgbmFtZVBhcmFtcy5sYXN0SW5kZXhPZignKScpKSApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBucGFydCxcbiAgICAgICAgcGFyYW1zOiBwcGFydFxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuYW1lUGFyYW1zLFxuICAgICAgICBwYXJhbXM6IG51bGxcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgZGVmYXVsdCB2YWx1ZXMgdG8gYSBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3NldFN0YXRlRGVmYXVsdHMgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgLy8gRGVmYXVsdCB2YWx1ZXNcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goL1thLXpBLVowLTlfXSsvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIHF1ZXJ5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHF1ZXJ5IEEgcXVlcnkgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBxdWVyeS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvKFxcKihcXCopP3xbYS16QS1aMC05X10rKS8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGFyZSB0d28gc3RhdGVzLCBjb21wYXJlcyB2YWx1ZXMuICBcbiAgICogXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3RhdGVzIGFyZSB0aGUgc2FtZSwgZmFsc2UgaWYgc3RhdGVzIGFyZSBkaWZmZXJlbnRcbiAgICovXG4gIHZhciBfY29tcGFyZVN0YXRlcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICBhID0gYSB8fCB7fTtcbiAgICBiID0gYiB8fCB7fTtcbiAgICByZXR1cm4gYS5uYW1lID09PSBiLm5hbWUgJiYgYW5ndWxhci5lcXVhbHMoYS5wYXJhbXMsIGIucGFyYW1zKTtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGEgbGlzdCBvZiBwYXJlbnQgc3RhdGVzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtBcnJheX0gICAgICAgICBBbiBBcnJheSBvZiBwYXJlbnQgc3RhdGVzXG4gICAqL1xuICB2YXIgX2dldE5hbWVDaGFpbiA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbmFtZUxpc3QgPSBuYW1lLnNwbGl0KCcuJyk7XG5cbiAgICByZXR1cm4gbmFtZUxpc3RcbiAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgICAgICByZXR1cm4gbGlzdC5zbGljZSgwLCBpKzEpLmpvaW4oJy4nKTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0gIT09IG51bGw7XG4gICAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNyYXdsIGxpYnJhcnkgaGVpcmFyY2h5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICB2YXIgc3RhdGUgPSBudWxsO1xuXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgcXVlcmllc1xuICAgIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIC8vIFVzZSBjYWNoZSBpZiBleGlzdHNcbiAgICB9IGVsc2UgaWYoX3N0YXRlQ2FjaGVbbmFtZV0pIHtcbiAgICAgIHJldHVybiBfc3RhdGVDYWNoZVtuYW1lXTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZUNoYWluID0gX2dldE5hbWVDaGFpbihuYW1lKTtcbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihuYW1lLCBpKSB7XG4gICAgICAgIHZhciBpdGVtID0gYW5ndWxhci5jb3B5KF9zdGF0ZUxpYnJhcnlbbmFtZV0pO1xuXG4gICAgICAgIGlmKGl0ZW0gJiYgaSAhPT0gbmFtZUNoYWluLmxlbmd0aC0xKSB7XG4gICAgICAgICAgZGVsZXRlKGl0ZW0ucmVzb2x2ZSk7XG4gICAgICAgICAgZGVsZXRlKGl0ZW0udGVtcGxhdGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICAgIHJldHVybiAhIXBhcmVudDtcbiAgICAgIH0pO1xuXG4gICAgLy8gV2FsayB1cCBjaGVja2luZyBpbmhlcml0YW5jZVxuICAgIGZvcih2YXIgaT1zdGF0ZUNoYWluLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKHN0YXRlQ2hhaW5baV0pIHtcbiAgICAgICAgdmFyIG5leHRTdGF0ZSA9IHN0YXRlQ2hhaW5baV07XG4gICAgICAgIHN0YXRlID0gYW5ndWxhci5tZXJnZShuZXh0U3RhdGUsIHN0YXRlIHx8IHt9KTtcbiAgICAgIH1cblxuICAgICAgaWYoc3RhdGUgJiYgc3RhdGUuaW5oZXJpdCA9PT0gZmFsc2UpIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFN0b3JlIGluIGNhY2hlXG4gICAgX3N0YXRlQ2FjaGVbbmFtZV0gPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHN0b3JlIGEgc3RhdGUgZGVmaW5pdGlvbi4gIFBhcmFtZXRlcnMgc2hvdWxkIGJlIGluY2x1ZGVkIGluIGRhdGEgT2JqZWN0IG5vdCBzdGF0ZSBuYW1lLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2RlZmluZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKG5hbWUgPT09IG51bGwgfHwgdHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05hbWUgY2Fubm90IGJlIG51bGwuJyk7XG4gICAgXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgbmFtZXNcbiAgICB9IGVsc2UgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0YXRlIG5hbWUuJyk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHN0YXRlXG4gICAgdmFyIHN0YXRlID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXG4gICAgLy8gVXNlIGRlZmF1bHRzXG4gICAgX3NldFN0YXRlRGVmYXVsdHMoc3RhdGUpO1xuXG4gICAgLy8gTmFtZWQgc3RhdGVcbiAgICBzdGF0ZS5uYW1lID0gbmFtZTtcblxuICAgIC8vIFNldCBkZWZpbml0aW9uXG4gICAgX3N0YXRlTGlicmFyeVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgLy8gUmVzZXQgY2FjaGVcbiAgICBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gICAgLy8gVVJMIG1hcHBpbmdcbiAgICBpZihzdGF0ZS51cmwpIHtcbiAgICAgIF91cmxEaWN0aW9uYXJ5LmFkZChzdGF0ZS51cmwsIHN0YXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGNvbmZpZ3VyYXRpb24gZGF0YSBwYXJhbWV0ZXJzIGZvciBTdGF0ZVJvdXRlclxuICAgKlxuICAgKiBJbmNsdWRpbmcgcGFyYW1ldGVyczpcbiAgICogXG4gICAqIC0gaGlzdG9yeUxlbmd0aCAgIHtOdW1iZXJ9IERlZmF1bHRzIHRvIDVcbiAgICogLSBpbml0aWFsTG9jYXRpb24ge09iamVjdH0gQW4gT2JqZWN0e25hbWU6U3RyaW5nLCBwYXJhbXM6T2JqZWN0fSBmb3IgaW5pdGlhbCBzdGF0ZSB0cmFuc2l0aW9uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBvcHRpb25zIEEgZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMub3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBhbmd1bGFyLmV4dGVuZChfY29uZmlndXJhdGlvbiwgb3B0aW9ucyB8fCB7fSk7XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0L2dldCBzdGF0ZVxuICAgKiBcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLnN0YXRlID0gZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICBpZighc3RhdGUpIHtcbiAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgfVxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGluaXRpYWxpemF0aW9uIHBhcmFtZXRlcnM7IGRlZmVycmVkIHRvICRyZWFkeSgpXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgbmFtZSAgIEEgaW5paXRhbCBzdGF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgcGFyYW1zIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIF9jb25maWd1cmF0aW9uLmluaXRpYWxMb2NhdGlvbiA9IHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGluc3RhbmNlXG4gICAqL1xuICB0aGlzLiRnZXQgPSBbJyRyb290U2NvcGUnLCAnJGxvY2F0aW9uJywgJyRxJywgZnVuY3Rpb24gU3RhdGVSb3V0ZXJGYWN0b3J5KCRyb290U2NvcGUsICRsb2NhdGlvbiwgJHEpIHtcblxuICAgIC8vIEN1cnJlbnQgc3RhdGVcbiAgICB2YXIgX2N1cnJlbnQ7XG5cbiAgICB2YXIgX29wdGlvbnM7XG4gICAgdmFyIF9pbml0YWxMb2NhdGlvbjtcbiAgICB2YXIgX2hpc3RvcnkgPSBbXTtcbiAgICB2YXIgX2lzSW5pdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9vcHRpb25zLmhpc3RvcnlMZW5ndGggfHwgNTtcblxuICAgICAgaWYoZGF0YSkge1xuICAgICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgbGVuZ3RoXG4gICAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBoaXN0b3J5TGVuZ3RoKSB7XG4gICAgICAgIF9oaXN0b3J5LnNwbGljZSgwLCBfaGlzdG9yeS5sZW5ndGggLSBoaXN0b3J5TGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSB0byBzdGF0ZS4gIFBhcmFtZXRlcnMgaW4gYHBhcmFtc2AgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHN0YXRlLW5vdGF0aW9uIGBuYW1lYCBleHByZXNzaW9uLiAgXG4gICAgICogXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSAgbmFtZSAgICAgICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uIGluY2x1ZGluZyBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zICAgICAgICBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgICAgQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIHN0YXRlIGNoYW5nZSBvY2N1cnNcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAkcm9vdFNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuICAgICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICAgIHZhciBuYW1lRXhwciA9IF9wYXJzZU5hbWUobmFtZSk7XG4gICAgICAgIG5hbWUgPSBuYW1lRXhwci5uYW1lO1xuICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgICAgdmFyIGVycm9yID0gbnVsbDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSB7XG4gICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgICBsb2NhbHM6IHt9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ29tcGlsZSBleGVjdXRpb24gcGhhc2VzXG4gICAgICAgIHZhciBxdWV1ZSA9IFF1ZXVlSGFuZGxlcigpLmRhdGEocmVxdWVzdCk7XG5cbiAgICAgICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShfZ2V0U3RhdGUobmFtZSkpO1xuICAgICAgICB2YXIgcHJldlN0YXRlID0gX2N1cnJlbnQ7XG5cbiAgICAgICAgaWYobmV4dFN0YXRlKSB7XG4gICAgICAgICAgLy8gU2V0IGxvY2Fsc1xuICAgICAgICAgIG5leHRTdGF0ZS5sb2NhbHMgPSByZXF1ZXN0LmxvY2FscztcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgICAgICAgIG5leHRTdGF0ZS5wYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuZXh0U3RhdGUucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRG9lcyBub3QgZXhpc3RcbiAgICAgICAgaWYobmV4dFN0YXRlID09PSBudWxsKSB7XG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3JOb3RGb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoZXJyb3IpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgICAgIH0gZWxzZSBpZihfY29tcGFyZVN0YXRlcyhwcmV2U3RhdGUsIG5leHRTdGF0ZSkpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgIC8vIFZhbGlkIHN0YXRlIGV4aXN0c1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgLy8gUHJvY2VzcyBzdGFydGVkXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlQmVnaW4nLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIE1ha2Ugc3RhdGUgY2hhbmdlXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgIGlmKHByZXZTdGF0ZSkgX3B1c2hIaXN0b3J5KHByZXZTdGF0ZSk7XG4gICAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRW5kJywgcmVxdWVzdCk7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSdW5cbiAgICAgICAgcXVldWUuZXhlY3V0ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3InLCBlcnIsIHJlcXVlc3QpO1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXF1ZXN0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUNvbXBsZXRlJywgcmVxdWVzdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICAvLyBJbnN0YW5jZVxuICAgIHZhciBfaW5zdDtcbiAgICBfaW5zdCA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBHZXQgb3B0aW9uc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBjb25maWd1cmVkIG9wdGlvbnNcbiAgICAgICAqL1xuICAgICAgb3B0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIEhhc24ndCBiZWVuIGluaXRpYWxpemVkXG4gICAgICAgIGlmKCFfb3B0aW9ucykge1xuICAgICAgICAgIF9vcHRpb25zID0gYW5ndWxhci5jb3B5KF9jb25maWd1cmF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfb3B0aW9ucztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0L2dldCBzdGF0ZVxuICAgICAgICovXG4gICAgICBzdGF0ZTogZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICAgICAgaWYoIXN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBhZGQgbWlkZGxld2FyZSwgZXhlY3V0aW5nIG5leHQoZXJyKTtcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIGhhbmRsZXIgQSBjYWxsYmFjaywgZnVuY3Rpb24ocmVxdWVzdCwgbmV4dClcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICR1c2U6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgICAgaWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pZGRsZXdhcmUgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgX2xheWVyTGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBwZXJmb3JtIGluaXRpYWxpemF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHJlYWR5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmKCFfaXNJbml0KSB7XG4gICAgICAgICAgICBfaXNJbml0ID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gQ29uZmlndXJhdGlvblxuICAgICAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgICAgIF9vcHRpb25zID0gYW5ndWxhci5jb3B5KF9jb25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgICAgICAgaWYoX29wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2luaXRpYWxMb2NhdGlvbicpKSB7XG4gICAgICAgICAgICAgIF9pbml0YWxMb2NhdGlvbiA9IGFuZ3VsYXIuY29weShfb3B0aW9ucy5pbml0aWFsTG9jYXRpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmVhZHlEZWZlcnJlZCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICAgIGlmKCRsb2NhdGlvbi51cmwoKSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgcmVhZHlEZWZlcnJlZCA9IF9pbnN0LiRsb2NhdGlvbigkbG9jYXRpb24udXJsKCkpO1xuXG4gICAgICAgICAgICAvLyBJbml0aWFsaXplIHdpdGggc3RhdGVcbiAgICAgICAgICAgIH0gZWxzZSBpZihfaW5pdGFsTG9jYXRpb24pIHtcbiAgICAgICAgICAgICAgcmVhZHlEZWZlcnJlZCA9IF9jaGFuZ2VTdGF0ZShfaW5pdGFsTG9jYXRpb24ubmFtZSwgX2luaXRhbExvY2F0aW9uLnBhcmFtcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICRxLndoZW4ocmVhZHlEZWZlcnJlZCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVJbml0Jyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAgICBwYXJzZTogX3BhcnNlTmFtZSxcblxuICAgICAgLy8gUmV0cmlldmUgZGVmaW5pdGlvbiBvZiBzdGF0ZXNcbiAgICAgIGxpYnJhcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX3N0YXRlTGlicmFyeTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFZhbGlkYXRpb25cbiAgICAgIHZhbGlkYXRlOiB7XG4gICAgICAgIG5hbWU6IF92YWxpZGF0ZVN0YXRlTmFtZSxcbiAgICAgICAgcXVlcnk6IF92YWxpZGF0ZVN0YXRlUXVlcnlcbiAgICAgIH0sXG5cbiAgICAgIC8vIFJldHJpZXZlIGhpc3RvcnlcbiAgICAgIGhpc3Rvcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX2hpc3Rvcnk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENoYW5nZSBzdGF0ZSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBjaGFuZ2U6IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlKG5hbWUsIHBhcmFtcyk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBjaGFuZ2Ugc3RhdGUgYmFzZWQgb24gJGxvY2F0aW9uLnVybCgpLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uIHVzaW5nIGludGVybmFsIG1ldGhvZHMsIHF1aWV0IGZhbGxiYWNrLiAgXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICB1cmwgICAgICAgIEEgdXJsIG1hdGNoaW5nIGRlZmluZCBzdGF0ZXNcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSAgICBbY2FsbGJhY2tdIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRsb2NhdGlvbjogZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHZhciBkYXRhID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICAgICAgaWYoc3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtcyBmcm9tIHVybFxuICAgICAgICAgICAgcmV0dXJuIF9jaGFuZ2VTdGF0ZShzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYoISF1cmwgJiYgdXJsICE9PSAnJykge1xuICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yTm90Rm91bmQnLCBlcnJvciwge1xuICAgICAgICAgICAgdXJsOiB1cmxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAkcS5yZWplY3QobmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBsb2NhdGlvbiBpbiBsaWJyYXJ5JykpO1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgLyoqXG4gICAgICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBjdXJyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICghX2N1cnJlbnQpID8gbnVsbCA6IGFuZ3VsYXIuY29weShfY3VycmVudCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENoZWNrIHF1ZXJ5IGFnYWluc3QgY3VycmVudCBzdGF0ZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgIEEgdHJ1ZSBpZiBzdGF0ZSBpcyBwYXJlbnQgdG8gY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBhY3RpdmU6IGZ1bmN0aW9uKHF1ZXJ5LCBwYXJhbXMpIHtcbiAgICAgICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICAgICAgXG4gICAgICAgIC8vIE5vIHN0YXRlXG4gICAgICAgIGlmKCFfY3VycmVudCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgICAgIH0gZWxzZSBpZihxdWVyeSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gocXVlcnkpO1xuXG4gICAgICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgICAgIH0gZWxzZSBpZih0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKSB7XG5cbiAgICAgICAgICAvLyBDYXN0IHN0cmluZyB0byBSZWdFeHBcbiAgICAgICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgICAgICB2YXIgY2FzdGVkID0gcXVlcnkuc3Vic3RyKDEsIHF1ZXJ5Lmxlbmd0aC0yKTtcbiAgICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cChjYXN0ZWQpKTtcblxuICAgICAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSBxdWVyeVxuICAgICAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtID09PSAnKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9dKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKGl0ZW0gPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9cXFxcLl0qJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKHRyYW5zZm9ybWVkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm9uLW1hdGNoaW5nXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIF9pbnN0O1xuICB9XTtcblxufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsICckbG9jYXRpb24nLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCRzdGF0ZSwgJGxvY2F0aW9uLCAkcm9vdFNjb3BlKSB7XG4gIHZhciBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgVVJMIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICB2YXIgX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKGN1cnJlbnQgJiYgY3VycmVudC51cmwpIHtcbiAgICAgIHZhciBwYXRoO1xuICAgICAgcGF0aCA9IGN1cnJlbnQudXJsO1xuXG4gICAgICAvLyBBZGQgcGFyYW1ldGVycyBvciB1c2UgZGVmYXVsdCBwYXJhbWV0ZXJzXG4gICAgICB2YXIgcGFyYW1zID0gY3VycmVudC5wYXJhbXMgfHwge307XG4gICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgIGZvcih2YXIgbmFtZSBpbiBwYXJhbXMpIHtcbiAgICAgICAgdmFyIHJlID0gbmV3IFJlZ0V4cCgnOicrbmFtZSwgJ2cnKTtcbiAgICAgICAgaWYocGF0aC5tYXRjaChyZSkpIHtcbiAgICAgICAgICBwYXRoID0gcGF0aC5yZXBsYWNlKHJlLCBwYXJhbXNbbmFtZV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHF1ZXJ5W25hbWVdID0gcGFyYW1zW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgICRsb2NhdGlvbi5wYXRoKHBhdGgpO1xuICAgICAgJGxvY2F0aW9uLnNlYXJjaChxdWVyeSk7XG4gICAgICBcbiAgICAgIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIERldGVjdCBVUkwgY2hhbmdlIGFuZCBkaXNwYXRjaCBzdGF0ZSBjaGFuZ2VcbiAgICovXG4gIF9zZWxmLmxvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxhc3RVcmwgPSBfdXJsO1xuICAgIHZhciBuZXh0VXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gICAgaWYobmV4dFVybCAhPT0gbGFzdFVybCkge1xuICAgICAgX3VybCA9IG5leHRVcmw7XG5cbiAgICAgICRzdGF0ZS4kbG9jYXRpb24oX3VybCk7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRsb2NhdGlvblN0YXRlVXBkYXRlJyk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIF91cGRhdGUoKTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBQYXJzZSBPYmplY3QgbGl0ZXJhbCBuYW1lLXZhbHVlIHBhaXJzXG52YXIgcmVQYXJzZU9iamVjdExpdGVyYWwgPSAvKFsse11cXHMqKChcInwnKSguKj8pXFwzfFxcdyopfCg6XFxzKihbKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/fHRydWV8ZmFsc2V8bnVsbHwoXCJ8JykoLio/KVxcN3xcXFtbXlxcXV0qXFxdKSkpL2c7XG5cbi8vIE1hdGNoIFN0cmluZ3NcbnZhciByZVN0cmluZyA9IC9eKFwifCcpKC4qPylcXDEkLztcblxuLy8gVE9ETyBBZGQgZXNjYXBlZCBzdHJpbmcgcXVvdGVzIFxcJyBhbmQgXFxcIiB0byBzdHJpbmcgbWF0Y2hlclxuXG4vLyBNYXRjaCBOdW1iZXIgKGludC9mbG9hdC9leHBvbmVudGlhbClcbnZhciByZU51bWJlciA9IC9eWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspPyQvO1xuXG4vKipcbiAqIFBhcnNlIHN0cmluZyB2YWx1ZSBpbnRvIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsLlxuICpcbiAqIFN0cmluZ3MgYXJlIHN1cnJvdW5kZWQgYnkgYSBwYWlyIG9mIG1hdGNoaW5nIHF1b3Rlc1xuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHZhbHVlIEEgU3RyaW5nIHZhbHVlIHRvIHBhcnNlXG4gKiBAcmV0dXJuIHtNaXhlZH0gICAgICAgIEEgQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGxcbiAqL1xudmFyIF9yZXNvbHZlVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXG4gIC8vIEJvb2xlYW46IHRydWVcbiAgaWYodmFsdWUgPT09ICd0cnVlJykge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIC8vIEJvb2xlYW46IGZhbHNlXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ2ZhbHNlJykge1xuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBOdWxsXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ251bGwnKSB7XG4gICAgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RyaW5nXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZVN0cmluZykpIHtcbiAgICByZXR1cm4gdmFsdWUuc3Vic3RyKDEsIHZhbHVlLmxlbmd0aC0yKTtcblxuICAvLyBOdW1iZXJcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlTnVtYmVyKSkge1xuICAgIHJldHVybiArdmFsdWU7XG5cbiAgLy8gTmFOXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ05hTicpIHtcbiAgICByZXR1cm4gTmFOO1xuXG4gIC8vIFRPRE8gYWRkIG1hdGNoaW5nIHdpdGggQXJyYXlzIGFuZCBwYXJzZVxuICBcbiAgfVxuXG4gIC8vIFVuYWJsZSB0byByZXNvbHZlXG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIEZpbmQgdmFsdWVzIGluIGFuIG9iamVjdCBsaXRlcmFsXG52YXIgX2xpc3RpZnkgPSBmdW5jdGlvbihzdHIpIHtcblxuICAvLyBUcmltXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcblxuICBpZihzdHIubWF0Y2goL15cXHMqey4qfVxccyokLykgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhcmFtZXRlcnMgZXhwZWN0cyBhbiBPYmplY3QnKTtcbiAgfVxuXG4gIHZhciBzYW5pdGl6ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvXltcXHssXT9cXHMqW1wiJ10/LywgJycpLnJlcGxhY2UoL1tcIiddP1xccyokLywgJycpO1xuICB9O1xuXG4gIHZhciBzYW5pdGl6ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc3RyID0gdmFsdWUucmVwbGFjZSgvXig6KT9cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuICAgIHJldHVybiBfcmVzb2x2ZVZhbHVlKHN0cik7XG4gIH07XG5cbiAgcmV0dXJuIHN0ci5tYXRjaChyZVBhcnNlT2JqZWN0TGl0ZXJhbCkubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICByZXR1cm4gaSUyID09PSAwID8gc2FuaXRpemVOYW1lKGl0ZW0pIDogc2FuaXRpemVWYWx1ZShpdGVtKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIHBhcmFtcyBPYmplY3QgZnJvbSBzdHJpbmdcbiAqIFxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBBIHN0cmluZ2lmaWVkIHZlcnNpb24gb2YgT2JqZWN0IGxpdGVyYWxcbiAqL1xudmFyIFBhcmFtZXRlcnMgPSBmdW5jdGlvbihzdHIpIHtcbiAgc3RyID0gc3RyIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIF9saXN0aWZ5KHN0cikuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgaWYoaSUyID09PSAwKSB7XG4gICAgICBfc2VsZltpdGVtXSA9IGxpc3RbaSsxXTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyYW1ldGVycztcblxubW9kdWxlLmV4cG9ydHMucmVzb2x2ZVZhbHVlID0gX3Jlc29sdmVWYWx1ZTtcbm1vZHVsZS5leHBvcnRzLmxpc3RpZnkgPSBfbGlzdGlmeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBFeGVjdXRlIGEgc2VyaWVzIG9mIGZ1bmN0aW9uczsgdXNlZCBpbiB0YW5kZW0gd2l0aCBtaWRkbGV3YXJlXG4gKi9cbnZhciBRdWV1ZUhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIF9saXN0ID0gW107XG4gIHZhciBfZGF0YSA9IG51bGw7XG5cbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogQWRkIGEgaGFuZGxlclxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7TWl4ZWR9ICAgICAgICAgaGFuZGxlciBBIEZ1bmN0aW9uIG9yIGFuIEFycmF5IG9mIEZ1bmN0aW9ucyB0byBhZGQgdG8gdGhlIHF1ZXVlXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgYWRkOiBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEYXRhIG9iamVjdFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIGRhdGEgb2JqZWN0IG1hZGUgYXZhaWxhYmxlIHRvIGVhY2ggaGFuZGxlclxuICAgICAqIEByZXR1cm4ge1F1ZXVlSGFuZGxlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAqL1xuICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBCZWdpbiBleGVjdXRpb24gYW5kIHRyaWdnZXIgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgZXhlY3V0ZTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgIHZhciBleGVjdXRpb25MaXN0ID0gX2xpc3Quc2xpY2UoMCkuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiAoYS5wcmlvdGl0eSB8fCAxKSA8IChiLnByaW90aXR5IHx8IDEpO1xuICAgICAgfSk7XG5cbiAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBoYW5kbGVyID0gZXhlY3V0aW9uTGlzdC5zaGlmdCgpO1xuXG4gICAgICAgIC8vIENvbXBsZXRlXG4gICAgICAgIGlmKCFoYW5kbGVyKSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgLy8gTmV4dCBoYW5kbGVyXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFuZGxlci5jYWxsKG51bGwsIF9kYXRhLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgfVxuXG4gIH07XG4gIFxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSGFuZGxlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmwgPSByZXF1aXJlKCcuL3VybCcpO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFVybERpY3Rpb25hcnkoKSB7XG4gIHRoaXMuX3BhdHRlcm5zID0gW107XG4gIHRoaXMuX3JlZnMgPSBbXTtcbiAgdGhpcy5fcGFyYW1zID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuICB2YXIgcGFyYW1zID0ge307XG5cbiAgaWYocGF0dGVybi5pbmRleE9mKCc/JykgPT09IC0xKSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuXG4gIH0gZWxzZSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuICB9XG5cbiAgLy8gU3RhcnRcbiAgdmFyIHNlYXJjaEV4cHIgPSAnXic7XG5cbiAgLy8gSXRlbXNcbiAgKHBhdGhDaGFpbi5mb3JFYWNoKGZ1bmN0aW9uKGNodW5rLCBpKSB7XG4gICAgaWYoaSE9PTApIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1xcXFwvJztcbiAgICB9XG5cbiAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdbXlxcXFwvP10qJztcbiAgICAgIHBhcmFtc1tjaHVuay5zdWJzdHJpbmcoMSldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZWFyY2hFeHByICs9IGNodW5rO1xuICAgIH1cbiAgfSkpO1xuXG4gIC8vIEVuZFxuICBzZWFyY2hFeHByICs9ICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbiAgdGhpcy5fcGFyYW1zW2ldID0gcGFyYW1zO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgcmVmZXJlbmNlIGFjY29yZGluZyB0byBhIFVSTCBwYXR0ZXJuIGFuZCByZXRyaWV2ZSBwYXJhbXMgZGVmaW5lZCBpbiBVUkxcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB1cmwgPSB1cmwgfHwgJyc7XG4gIHZhciBwID0gVXJsKHVybCkucGF0aCgpO1xuICB2YXIgcSA9IFVybCh1cmwpLnF1ZXJ5cGFyYW1zKCk7XG5cbiAgdmFyIF9zZWxmID0gdGhpcztcblxuICAvLyBDaGVjayBkaWN0aW9uYXJ5XG4gIHZhciBfZmluZFBhdHRlcm4gPSBmdW5jdGlvbihjaGVjaykge1xuICAgIGNoZWNrID0gY2hlY2sgfHwgJyc7XG4gICAgZm9yKHZhciBpPV9zZWxmLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihjaGVjay5tYXRjaChfc2VsZi5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgdmFyIGkgPSBfZmluZFBhdHRlcm4ocCk7XG4gIFxuICAvLyBNYXRjaGluZyBwYXR0ZXJuIGZvdW5kXG4gIGlmKGkgIT09IC0xKSB7XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcGF0dGVybiBtYXRjaFxuICAgIHZhciBwYXJhbXMgPSB7fTtcbiAgICBmb3IodmFyIG4gaW4gdGhpcy5fcGFyYW1zW2ldKSB7XG4gICAgICB2YXIgcGFyYW1QYXJzZXIgPSB0aGlzLl9wYXJhbXNbaV1bbl07XG4gICAgICB2YXIgdXJsTWF0Y2ggPSAodXJsLm1hdGNoKHBhcmFtUGFyc2VyKSB8fCBbXSkucG9wKCkgfHwgJyc7XG4gICAgICB2YXIgdmFyTWF0Y2ggPSB1cmxNYXRjaC5zcGxpdCgnLycpLnBvcCgpO1xuICAgICAgcGFyYW1zW25dID0gdmFyTWF0Y2g7XG4gICAgfVxuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHF1ZXJ5c3RyaW5nIG1hdGNoXG4gICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQocSwgcGFyYW1zKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIHJlZjogdGhpcy5fcmVmc1tpXSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcblxuICAvLyBOb3QgaW4gZGljdGlvbmFyeVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/IHVybCA6IHVybC5zdWJzdHJpbmcoMCwgdXJsLmluZGV4T2YoJz8nKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlzdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJycgOiB1cmwuc3Vic3RyaW5nKHVybC5pbmRleE9mKCc/JykrMSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkwgcGFyYW1ldGVycyBhcyBhIGhhc2hcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlwYXJhbXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhaXJzID0gX3NlbGYucXVlcnlzdHJpbmcoKS5zcGxpdCgnJicpO1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBmb3IodmFyIGk9MDsgaTxwYWlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihwYWlyc1tpXSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmFtZVZhbHVlID0gcGFpcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgcGFyYW1zW25hbWVWYWx1ZVswXV0gPSAodHlwZW9mIG5hbWVWYWx1ZVsxXSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmFtZVZhbHVlWzFdID09PSAnJykgPyB0cnVlIDogbmFtZVZhbHVlWzFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
