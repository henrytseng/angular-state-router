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
      .map(function(name) {
        return _stateLibrary[name];
      })
      .filter(function(parent) {
        return !!parent;
      });

    // Walk up checking inheritance
    for(var i=stateChain.length-1; i>=0; i--) {
      if(stateChain[i]) {
        var nextState = angular.copy(stateChain[i]);
        delete(nextState.resolve);
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

        // Make state change
        queue.add(function(data, next) {
          if(prevState) _pushHistory(prevState);
          _current = nextState;
          
          next();
        });

        // Process started
        queue.add(function(data, next) {
          $rootScope.$broadcast('$stateChangeBegin', request);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9xdWV1ZS1oYW5kbGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFPLFVBQVUsQ0FBQyxVQUFVLFVBQVUsUUFBUTtFQUM1QyxPQUFPO0lBQ0wsVUFBVTtJQUNWLE9BQU87O0lBRVAsTUFBTSxTQUFTLE9BQU8sU0FBUyxPQUFPO01BQ3BDLFFBQVEsSUFBSSxVQUFVO01BQ3RCLFFBQVEsR0FBRyxTQUFTLFNBQVMsR0FBRztRQUM5QixPQUFPLE9BQU8sTUFBTTtRQUNwQixFQUFFOzs7Ozs7QUFNVjs7QUNqQkE7Ozs7O0FBS0EsSUFBSSxPQUFPLFdBQVcsZUFBZSxPQUFPLFlBQVksZUFBZSxPQUFPLFlBQVksUUFBUTtFQUNoRyxPQUFPLFVBQVU7Ozs7QUFJbkIsUUFBUSxPQUFPLHdCQUF3Qjs7R0FFcEMsU0FBUyxVQUFVLFFBQVE7O0dBRTNCLFFBQVEsZUFBZSxRQUFROztHQUUvQixRQUFRLGVBQWUsUUFBUTs7R0FFL0IsSUFBSSxDQUFDLGNBQWMsVUFBVSxlQUFlLGVBQWUsU0FBUyxZQUFZLFFBQVEsYUFBYSxhQUFhOztJQUVqSCxXQUFXLElBQUksMEJBQTBCLFdBQVc7TUFDbEQsWUFBWSxTQUFTOzs7O0lBSXZCLE9BQU87OztHQUdSLFVBQVUsUUFBUSxRQUFRO0FBQzdCOztBQzdCQTs7QUFFQSxPQUFPLFVBQVUsQ0FBQyxNQUFNLGFBQWEsVUFBVSxTQUFTLElBQUksV0FBVyxRQUFROzs7RUFHN0UsSUFBSSxRQUFROzs7Ozs7OztFQVFaLElBQUksV0FBVyxTQUFTLFNBQVM7SUFDL0IsSUFBSSxtQkFBbUI7O0lBRXZCLFFBQVEsUUFBUSxTQUFTLFNBQVMsT0FBTyxLQUFLO01BQzVDLElBQUksYUFBYSxRQUFRLFNBQVMsU0FBUyxVQUFVLElBQUksU0FBUyxVQUFVLE9BQU8sT0FBTyxNQUFNLE1BQU07TUFDdEcsaUJBQWlCLE9BQU8sR0FBRyxLQUFLOzs7SUFHbEMsT0FBTyxHQUFHLElBQUk7O0VBRWhCLE1BQU0sVUFBVTs7Ozs7Ozs7RUFRaEIsSUFBSSxZQUFZLFNBQVMsU0FBUyxNQUFNO0lBQ3RDLElBQUksVUFBVSxPQUFPOztJQUVyQixHQUFHLENBQUMsU0FBUztNQUNYLE9BQU87OztJQUdULFNBQVMsUUFBUSxXQUFXLElBQUksS0FBSyxTQUFTLFFBQVE7TUFDcEQsUUFBUSxPQUFPLFFBQVEsUUFBUTtNQUMvQjs7T0FFQyxTQUFTLEtBQUs7TUFDZixLQUFLLElBQUksTUFBTTs7O0VBR25CLFVBQVUsV0FBVzs7O0VBR3JCLE9BQU8sS0FBSzs7RUFFWixPQUFPOztBQUVUOztBQ3JEQTs7QUFFQSxJQUFJLGdCQUFnQixRQUFRO0FBQzVCLElBQUksYUFBYSxRQUFRO0FBQ3pCLElBQUksZUFBZSxRQUFROztBQUUzQixPQUFPLFVBQVUsQ0FBQyxTQUFTLHNCQUFzQjs7RUFFL0MsSUFBSSxZQUFZOzs7RUFHaEIsSUFBSSxpQkFBaUI7SUFDbkIsZUFBZTs7OztFQUlqQixJQUFJLGdCQUFnQjtFQUNwQixJQUFJLGNBQWM7OztFQUdsQixJQUFJLGlCQUFpQixJQUFJOzs7RUFHekIsSUFBSSxhQUFhOzs7Ozs7Ozs7O0VBVWpCLElBQUksYUFBYSxTQUFTLFlBQVk7SUFDcEMsR0FBRyxjQUFjLFdBQVcsTUFBTSw0QkFBNEI7TUFDNUQsSUFBSSxRQUFRLFdBQVcsVUFBVSxHQUFHLFdBQVcsUUFBUTtNQUN2RCxJQUFJLFFBQVEsWUFBWSxXQUFXLFVBQVUsV0FBVyxRQUFRLEtBQUssR0FBRyxXQUFXLFlBQVk7O01BRS9GLE9BQU87UUFDTCxNQUFNO1FBQ04sUUFBUTs7O1dBR0w7TUFDTCxPQUFPO1FBQ0wsTUFBTTtRQUNOLFFBQVE7Ozs7Ozs7Ozs7O0VBV2QsSUFBSSxvQkFBb0IsU0FBUyxNQUFNOztJQUVyQyxLQUFLLFVBQVUsQ0FBQyxPQUFPLEtBQUssWUFBWSxlQUFlLE9BQU8sS0FBSzs7SUFFbkUsT0FBTzs7Ozs7Ozs7O0VBU1QsSUFBSSxxQkFBcUIsU0FBUyxNQUFNO0lBQ3RDLE9BQU8sUUFBUTs7OztJQUlmLElBQUksWUFBWSxLQUFLLE1BQU07SUFDM0IsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLFVBQVUsUUFBUSxLQUFLO01BQ3BDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsTUFBTSxrQkFBa0I7UUFDdkMsT0FBTzs7OztJQUlYLE9BQU87Ozs7Ozs7OztFQVNULElBQUksc0JBQXNCLFNBQVMsT0FBTztJQUN4QyxRQUFRLFNBQVM7Ozs7SUFJakIsSUFBSSxZQUFZLE1BQU0sTUFBTTtJQUM1QixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxRQUFRLEtBQUs7TUFDcEMsR0FBRyxDQUFDLFVBQVUsR0FBRyxNQUFNLDRCQUE0QjtRQUNqRCxPQUFPOzs7O0lBSVgsT0FBTzs7Ozs7Ozs7RUFRVCxJQUFJLGlCQUFpQixTQUFTLEdBQUcsR0FBRztJQUNsQyxJQUFJLEtBQUs7SUFDVCxJQUFJLEtBQUs7SUFDVCxPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsUUFBUSxPQUFPLEVBQUUsUUFBUSxFQUFFOzs7Ozs7Ozs7RUFTekQsSUFBSSxnQkFBZ0IsU0FBUyxNQUFNO0lBQ2pDLElBQUksV0FBVyxLQUFLLE1BQU07O0lBRTFCLE9BQU87T0FDSixJQUFJLFNBQVMsTUFBTSxHQUFHLE1BQU07UUFDM0IsT0FBTyxLQUFLLE1BQU0sR0FBRyxFQUFFLEdBQUcsS0FBSzs7T0FFaEMsT0FBTyxTQUFTLE1BQU07UUFDckIsT0FBTyxTQUFTOzs7Ozs7Ozs7O0VBVXRCLElBQUksWUFBWSxTQUFTLE1BQU07SUFDN0IsT0FBTyxRQUFROztJQUVmLElBQUksUUFBUTs7O0lBR1osR0FBRyxDQUFDLG1CQUFtQixPQUFPO01BQzVCLE9BQU87OztXQUdGLEdBQUcsWUFBWSxPQUFPO01BQzNCLE9BQU8sWUFBWTs7O0lBR3JCLElBQUksWUFBWSxjQUFjOztJQUU5QixJQUFJLGFBQWE7T0FDZCxJQUFJLFNBQVMsTUFBTTtRQUNsQixPQUFPLGNBQWM7O09BRXRCLE9BQU8sU0FBUyxRQUFRO1FBQ3ZCLE9BQU8sQ0FBQyxDQUFDOzs7O0lBSWIsSUFBSSxJQUFJLEVBQUUsV0FBVyxPQUFPLEdBQUcsR0FBRyxHQUFHLEtBQUs7TUFDeEMsR0FBRyxXQUFXLElBQUk7UUFDaEIsSUFBSSxZQUFZLFFBQVEsS0FBSyxXQUFXO1FBQ3hDLE9BQU8sVUFBVTtRQUNqQixRQUFRLFFBQVEsTUFBTSxXQUFXLFNBQVM7OztNQUc1QyxHQUFHLFNBQVMsTUFBTSxZQUFZLE9BQU87Ozs7SUFJdkMsWUFBWSxRQUFROztJQUVwQixPQUFPOzs7Ozs7Ozs7O0VBVVQsSUFBSSxlQUFlLFNBQVMsTUFBTSxNQUFNO0lBQ3RDLEdBQUcsU0FBUyxRQUFRLE9BQU8sU0FBUyxhQUFhO01BQy9DLE1BQU0sSUFBSSxNQUFNOzs7V0FHWCxHQUFHLENBQUMsbUJBQW1CLE9BQU87TUFDbkMsTUFBTSxJQUFJLE1BQU07Ozs7SUFJbEIsSUFBSSxRQUFRLFFBQVEsS0FBSzs7O0lBR3pCLGtCQUFrQjs7O0lBR2xCLE1BQU0sT0FBTzs7O0lBR2IsY0FBYyxRQUFROzs7SUFHdEIsY0FBYzs7O0lBR2QsR0FBRyxNQUFNLEtBQUs7TUFDWixlQUFlLElBQUksTUFBTSxLQUFLOzs7SUFHaEMsT0FBTzs7Ozs7Ozs7Ozs7Ozs7RUFjVCxLQUFLLFVBQVUsU0FBUyxTQUFTO0lBQy9CLFFBQVEsT0FBTyxnQkFBZ0IsV0FBVztJQUMxQyxPQUFPOzs7Ozs7OztFQVFULEtBQUssUUFBUSxTQUFTLE1BQU0sT0FBTztJQUNqQyxHQUFHLENBQUMsT0FBTztNQUNULE9BQU8sVUFBVTs7SUFFbkIsYUFBYSxNQUFNO0lBQ25CLE9BQU87Ozs7Ozs7Ozs7RUFVVCxLQUFLLE9BQU8sU0FBUyxNQUFNLFFBQVE7SUFDakMsZUFBZSxrQkFBa0I7TUFDL0IsTUFBTTtNQUNOLFFBQVE7O0lBRVYsT0FBTzs7Ozs7O0VBTVQsS0FBSyxPQUFPLENBQUMsY0FBYyxhQUFhLE1BQU0sU0FBUyxtQkFBbUIsWUFBWSxXQUFXLElBQUk7OztJQUduRyxJQUFJOztJQUVKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSSxXQUFXO0lBQ2YsSUFBSSxVQUFVOzs7Ozs7O0lBT2QsSUFBSSxlQUFlLFNBQVMsTUFBTTs7TUFFaEMsSUFBSSxnQkFBZ0IsU0FBUyxpQkFBaUI7O01BRTlDLEdBQUcsTUFBTTtRQUNQLFNBQVMsS0FBSzs7OztNQUloQixHQUFHLFNBQVMsU0FBUyxlQUFlO1FBQ2xDLFNBQVMsT0FBTyxHQUFHLFNBQVMsU0FBUzs7Ozs7Ozs7Ozs7SUFXekMsSUFBSSxlQUFlLFNBQVMsTUFBTSxRQUFRO01BQ3hDLElBQUksV0FBVyxHQUFHOztNQUVsQixTQUFTLFVBQVU7OztNQUduQixJQUFJLFdBQVcsV0FBVztNQUMxQixPQUFPLFNBQVM7TUFDaEIsU0FBUyxRQUFRLE9BQU8sU0FBUyxVQUFVLElBQUk7O01BRS9DLElBQUksUUFBUTtNQUNaLElBQUksVUFBVTtRQUNaLE1BQU07UUFDTixRQUFRO1FBQ1IsUUFBUTs7OztNQUlWLElBQUksUUFBUSxlQUFlLEtBQUs7O01BRWhDLElBQUksWUFBWSxRQUFRLEtBQUssVUFBVTtNQUN2QyxJQUFJLFlBQVk7O01BRWhCLEdBQUcsV0FBVzs7UUFFWixVQUFVLFNBQVMsUUFBUTs7O1FBRzNCLFVBQVUsU0FBUyxRQUFRLE9BQU8sVUFBVSxVQUFVLElBQUk7Ozs7TUFJNUQsR0FBRyxjQUFjLE1BQU07UUFDckIsTUFBTSxJQUFJLFNBQVMsTUFBTSxNQUFNO1VBQzdCLFFBQVEsSUFBSSxNQUFNO1VBQ2xCLE1BQU0sT0FBTzs7VUFFYixXQUFXLFdBQVcsNkJBQTZCLE9BQU87VUFDMUQsS0FBSzs7OzthQUlGLEdBQUcsZUFBZSxXQUFXLFlBQVk7UUFDOUMsTUFBTSxJQUFJLFNBQVMsTUFBTSxNQUFNO1VBQzdCLFdBQVc7VUFDWDs7OzthQUlHOzs7UUFHTCxNQUFNLElBQUksU0FBUyxNQUFNLE1BQU07VUFDN0IsR0FBRyxXQUFXLGFBQWE7VUFDM0IsV0FBVzs7VUFFWDs7OztRQUlGLE1BQU0sSUFBSSxTQUFTLE1BQU0sTUFBTTtVQUM3QixXQUFXLFdBQVcscUJBQXFCO1VBQzNDOzs7O1FBSUYsTUFBTSxJQUFJOzs7UUFHVixNQUFNLElBQUksU0FBUyxNQUFNLE1BQU07VUFDN0IsV0FBVyxXQUFXLG1CQUFtQjtVQUN6Qzs7Ozs7TUFLSixNQUFNLFFBQVEsU0FBUyxLQUFLO1FBQzFCLEdBQUcsS0FBSztVQUNOLFdBQVcsV0FBVyxxQkFBcUIsS0FBSztVQUNoRCxTQUFTLE9BQU87O2VBRVg7VUFDTCxTQUFTLFFBQVE7OztRQUduQixXQUFXLFdBQVcsd0JBQXdCOzs7TUFHaEQsT0FBTyxTQUFTOzs7O0lBSWxCLElBQUk7SUFDSixRQUFROzs7Ozs7O01BT04sU0FBUyxXQUFXOztRQUVsQixHQUFHLENBQUMsVUFBVTtVQUNaLFdBQVcsUUFBUSxLQUFLOzs7UUFHMUIsT0FBTzs7Ozs7O01BTVQsT0FBTyxTQUFTLE1BQU0sT0FBTztRQUMzQixHQUFHLENBQUMsT0FBTztVQUNULE9BQU8sVUFBVTs7UUFFbkIsYUFBYSxNQUFNO1FBQ25CLE9BQU87Ozs7Ozs7OztNQVNULE1BQU0sU0FBUyxTQUFTO1FBQ3RCLEdBQUcsT0FBTyxZQUFZLFlBQVk7VUFDaEMsTUFBTSxJQUFJLE1BQU07OztRQUdsQixXQUFXLEtBQUs7UUFDaEIsT0FBTzs7Ozs7Ozs7TUFRVCxRQUFRLFdBQVc7UUFDakIsR0FBRyxDQUFDLFNBQVM7VUFDWCxVQUFVOzs7VUFHVixHQUFHLENBQUMsVUFBVTtZQUNaLFdBQVcsUUFBUSxLQUFLOzs7O1VBSTFCLEdBQUcsU0FBUyxlQUFlLG9CQUFvQjtZQUM3QyxrQkFBa0IsUUFBUSxLQUFLLFNBQVM7OztVQUcxQyxJQUFJLGdCQUFnQjs7O1VBR3BCLEdBQUcsVUFBVSxVQUFVLElBQUk7WUFDekIsZ0JBQWdCLE1BQU0sVUFBVSxVQUFVOzs7aUJBR3JDLEdBQUcsaUJBQWlCO1lBQ3pCLGdCQUFnQixhQUFhLGdCQUFnQixNQUFNLGdCQUFnQjs7O1VBR3JFLEdBQUcsS0FBSyxlQUFlLEtBQUssV0FBVztZQUNyQyxXQUFXLFdBQVc7Ozs7UUFJMUIsT0FBTzs7OztNQUlULE9BQU87OztNQUdQLFNBQVMsV0FBVztRQUNsQixPQUFPOzs7O01BSVQsVUFBVTtRQUNSLE1BQU07UUFDTixPQUFPOzs7O01BSVQsU0FBUyxXQUFXO1FBQ2xCLE9BQU87Ozs7Ozs7Ozs7TUFVVCxRQUFRLFNBQVMsTUFBTSxRQUFRO1FBQzdCLE9BQU8sYUFBYSxNQUFNOzs7Ozs7Ozs7O01BVTVCLFdBQVcsU0FBUyxLQUFLO1FBQ3ZCLElBQUksT0FBTyxlQUFlLE9BQU87O1FBRWpDLEdBQUcsTUFBTTtVQUNQLElBQUksUUFBUSxLQUFLOztVQUVqQixHQUFHLE9BQU87O1lBRVIsT0FBTyxhQUFhLE1BQU0sTUFBTSxLQUFLOzs7O1FBSXpDLE9BQU8sR0FBRyxPQUFPLElBQUksTUFBTTs7Ozs7Ozs7TUFRN0IsU0FBUyxXQUFXO1FBQ2xCLE9BQU8sQ0FBQyxDQUFDLFlBQVksT0FBTyxRQUFRLEtBQUs7Ozs7Ozs7Ozs7TUFVM0MsUUFBUSxTQUFTLE9BQU8sUUFBUTtRQUM5QixRQUFRLFNBQVM7OztRQUdqQixHQUFHLENBQUMsVUFBVTtVQUNaLE9BQU87OztlQUdGLEdBQUcsaUJBQWlCLFFBQVE7VUFDakMsT0FBTyxDQUFDLENBQUMsU0FBUyxLQUFLLE1BQU07OztlQUd4QixHQUFHLE9BQU8sVUFBVSxVQUFVOzs7VUFHbkMsR0FBRyxNQUFNLE1BQU0sYUFBYTtZQUMxQixJQUFJLFNBQVMsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPO1lBQzFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsS0FBSyxNQUFNLElBQUksT0FBTzs7O2lCQUduQztZQUNMLElBQUksY0FBYztlQUNmLE1BQU07ZUFDTixJQUFJLFNBQVMsTUFBTTtnQkFDbEIsR0FBRyxTQUFTLEtBQUs7a0JBQ2YsT0FBTzt1QkFDRixHQUFHLFNBQVMsTUFBTTtrQkFDdkIsT0FBTzt1QkFDRjtrQkFDTCxPQUFPOzs7ZUFHVixLQUFLOztZQUVSLE9BQU8sQ0FBQyxDQUFDLFNBQVMsS0FBSyxNQUFNLElBQUksT0FBTzs7Ozs7UUFLNUMsT0FBTzs7OztJQUlYLE9BQU87Ozs7QUFJWDs7QUNobEJBOztBQUVBLElBQUksZ0JBQWdCLFFBQVE7O0FBRTVCLE9BQU8sVUFBVSxDQUFDLFVBQVUsYUFBYSxjQUFjLFNBQVMsUUFBUSxXQUFXLFlBQVk7RUFDN0YsSUFBSSxPQUFPLFVBQVU7OztFQUdyQixJQUFJLFFBQVE7Ozs7O0VBS1osSUFBSSxVQUFVLFdBQVc7SUFDdkIsSUFBSSxVQUFVLE9BQU87O0lBRXJCLEdBQUcsV0FBVyxRQUFRLEtBQUs7TUFDekIsSUFBSTtNQUNKLE9BQU8sUUFBUTs7O01BR2YsSUFBSSxTQUFTLFFBQVEsVUFBVTtNQUMvQixJQUFJLFFBQVE7TUFDWixJQUFJLElBQUksUUFBUSxRQUFRO1FBQ3RCLElBQUksS0FBSyxJQUFJLE9BQU8sSUFBSSxNQUFNO1FBQzlCLEdBQUcsS0FBSyxNQUFNLEtBQUs7VUFDakIsT0FBTyxLQUFLLFFBQVEsSUFBSSxPQUFPO2VBQzFCO1VBQ0wsTUFBTSxRQUFRLE9BQU87Ozs7TUFJekIsVUFBVSxLQUFLO01BQ2YsVUFBVSxPQUFPOztNQUVqQixPQUFPLFVBQVU7Ozs7Ozs7RUFPckIsTUFBTSxTQUFTLFdBQVc7SUFDeEI7Ozs7OztFQU1GLE1BQU0sV0FBVyxXQUFXO0lBQzFCLElBQUksVUFBVTtJQUNkLElBQUksVUFBVSxVQUFVOztJQUV4QixHQUFHLFlBQVksU0FBUztNQUN0QixPQUFPOztNQUVQLE9BQU8sVUFBVTtNQUNqQixXQUFXLFdBQVc7Ozs7O0VBSzFCLE9BQU8sS0FBSyxTQUFTLFNBQVMsTUFBTTtJQUNsQztJQUNBOzs7RUFHRixPQUFPOztBQUVUOztBQ3JFQTs7O0FBR0EsSUFBSSx1QkFBdUI7OztBQUczQixJQUFJLFdBQVc7Ozs7O0FBS2YsSUFBSSxXQUFXOzs7Ozs7Ozs7O0FBVWYsSUFBSSxnQkFBZ0IsU0FBUyxPQUFPOzs7RUFHbEMsR0FBRyxVQUFVLFFBQVE7SUFDbkIsT0FBTzs7O1NBR0YsR0FBRyxVQUFVLFNBQVM7SUFDM0IsT0FBTzs7O1NBR0YsR0FBRyxVQUFVLFFBQVE7SUFDMUIsT0FBTzs7O1NBR0YsR0FBRyxNQUFNLE1BQU0sV0FBVztJQUMvQixPQUFPLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTzs7O1NBRy9CLEdBQUcsTUFBTSxNQUFNLFdBQVc7SUFDL0IsT0FBTyxDQUFDOzs7U0FHSCxHQUFHLFVBQVUsT0FBTztJQUN6QixPQUFPOzs7Ozs7O0VBT1QsT0FBTzs7OztBQUlULElBQUksV0FBVyxTQUFTLEtBQUs7OztFQUczQixNQUFNLElBQUksUUFBUSxRQUFRLElBQUksUUFBUSxRQUFROztFQUU5QyxHQUFHLElBQUksTUFBTSxvQkFBb0IsTUFBTTtJQUNyQyxNQUFNLElBQUksTUFBTTs7O0VBR2xCLElBQUksZUFBZSxTQUFTLE1BQU07SUFDaEMsT0FBTyxLQUFLLFFBQVEsbUJBQW1CLElBQUksUUFBUSxhQUFhOzs7RUFHbEUsSUFBSSxnQkFBZ0IsU0FBUyxPQUFPO0lBQ2xDLElBQUksTUFBTSxNQUFNLFFBQVEsWUFBWSxJQUFJLFFBQVEsUUFBUTtJQUN4RCxPQUFPLGNBQWM7OztFQUd2QixPQUFPLElBQUksTUFBTSxzQkFBc0IsSUFBSSxTQUFTLE1BQU0sR0FBRyxNQUFNO0lBQ2pFLE9BQU8sRUFBRSxNQUFNLElBQUksYUFBYSxRQUFRLGNBQWM7Ozs7Ozs7OztBQVMxRCxJQUFJLGFBQWEsU0FBUyxLQUFLO0VBQzdCLE1BQU0sT0FBTzs7O0VBR2IsSUFBSSxRQUFROztFQUVaLFNBQVMsS0FBSyxRQUFRLFNBQVMsTUFBTSxHQUFHLE1BQU07SUFDNUMsR0FBRyxFQUFFLE1BQU0sR0FBRztNQUNaLE1BQU0sUUFBUSxLQUFLLEVBQUU7Ozs7RUFJekIsT0FBTzs7O0FBR1QsT0FBTyxVQUFVOztBQUVqQixPQUFPLFFBQVEsZUFBZTtBQUM5QixPQUFPLFFBQVEsVUFBVTtBQUN6Qjs7QUN2R0E7Ozs7O0FBS0EsSUFBSSxlQUFlLFdBQVc7RUFDNUIsSUFBSSxRQUFRO0VBQ1osSUFBSSxRQUFROztFQUVaLElBQUksUUFBUTs7Ozs7Ozs7SUFRVixLQUFLLFNBQVMsU0FBUztNQUNyQixHQUFHLFdBQVcsUUFBUSxnQkFBZ0IsT0FBTztRQUMzQyxRQUFRLE1BQU0sT0FBTzthQUNoQjtRQUNMLE1BQU0sS0FBSzs7TUFFYixPQUFPOzs7Ozs7Ozs7SUFTVCxNQUFNLFNBQVMsTUFBTTtNQUNuQixRQUFRO01BQ1IsT0FBTzs7Ozs7Ozs7O0lBU1QsU0FBUyxTQUFTLFVBQVU7TUFDMUIsSUFBSTtNQUNKLElBQUksZ0JBQWdCLE1BQU0sTUFBTSxHQUFHLEtBQUssU0FBUyxHQUFHLEdBQUc7UUFDckQsT0FBTyxDQUFDLEVBQUUsWUFBWSxNQUFNLEVBQUUsWUFBWTs7O01BRzVDLGNBQWMsV0FBVztRQUN2QixJQUFJLFVBQVUsY0FBYzs7O1FBRzVCLEdBQUcsQ0FBQyxTQUFTO1VBQ1gsU0FBUzs7O2VBR0o7VUFDTCxRQUFRLEtBQUssTUFBTSxPQUFPLFNBQVMsS0FBSzs7WUFFdEMsR0FBRyxLQUFLO2NBQ04sU0FBUzs7O21CQUdKO2NBQ0w7Ozs7OztNQU1SOzs7OztFQUtKLE9BQU87OztBQUdULE9BQU8sVUFBVSxhQUFhOzs7QUMvRTlCOztBQUVBLElBQUksTUFBTSxRQUFROzs7OztBQUtsQixTQUFTLGdCQUFnQjtFQUN2QixLQUFLLFlBQVk7RUFDakIsS0FBSyxRQUFRO0VBQ2IsS0FBSyxVQUFVOzs7Ozs7Ozs7QUFTakIsY0FBYyxVQUFVLE1BQU0sU0FBUyxTQUFTLEtBQUs7RUFDbkQsVUFBVSxXQUFXO0VBQ3JCLElBQUksUUFBUTtFQUNaLElBQUksSUFBSSxLQUFLLFVBQVU7O0VBRXZCLElBQUk7RUFDSixJQUFJLFNBQVM7O0VBRWIsR0FBRyxRQUFRLFFBQVEsU0FBUyxDQUFDLEdBQUc7SUFDOUIsWUFBWSxJQUFJLFNBQVMsT0FBTyxNQUFNOztTQUVqQztJQUNMLFlBQVksSUFBSSxTQUFTLE9BQU8sTUFBTTs7OztFQUl4QyxJQUFJLGFBQWE7OztFQUdqQixDQUFDLFVBQVUsUUFBUSxTQUFTLE9BQU8sR0FBRztJQUNwQyxHQUFHLElBQUksR0FBRztNQUNSLGNBQWM7OztJQUdoQixHQUFHLE1BQU0sT0FBTyxLQUFLO01BQ25CLGNBQWM7TUFDZCxPQUFPLE1BQU0sVUFBVSxNQUFNLElBQUksT0FBTzs7V0FFbkM7TUFDTCxjQUFjOzs7OztFQUtsQixjQUFjOztFQUVkLEtBQUssVUFBVSxLQUFLLElBQUksT0FBTztFQUMvQixLQUFLLE1BQU0sS0FBSztFQUNoQixLQUFLLFFBQVEsS0FBSzs7Ozs7Ozs7OztBQVVwQixjQUFjLFVBQVUsU0FBUyxTQUFTLEtBQUssVUFBVTtFQUN2RCxNQUFNLE9BQU87RUFDYixJQUFJLElBQUksSUFBSSxLQUFLO0VBQ2pCLElBQUksSUFBSSxJQUFJLEtBQUs7O0VBRWpCLElBQUksUUFBUTs7O0VBR1osSUFBSSxlQUFlLFNBQVMsT0FBTztJQUNqQyxRQUFRLFNBQVM7SUFDakIsSUFBSSxJQUFJLEVBQUUsTUFBTSxVQUFVLE9BQU8sR0FBRyxHQUFHLEdBQUcsS0FBSztNQUM3QyxHQUFHLE1BQU0sTUFBTSxNQUFNLFVBQVUsUUFBUSxNQUFNO1FBQzNDLE9BQU87OztJQUdYLE9BQU8sQ0FBQzs7O0VBR1YsSUFBSSxJQUFJLGFBQWE7OztFQUdyQixHQUFHLE1BQU0sQ0FBQyxHQUFHOzs7SUFHWCxJQUFJLFNBQVM7SUFDYixJQUFJLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSTtNQUM1QixJQUFJLGNBQWMsS0FBSyxRQUFRLEdBQUc7TUFDbEMsSUFBSSxXQUFXLENBQUMsSUFBSSxNQUFNLGdCQUFnQixJQUFJLFNBQVM7TUFDdkQsSUFBSSxXQUFXLFNBQVMsTUFBTSxLQUFLO01BQ25DLE9BQU8sS0FBSzs7OztJQUlkLFNBQVMsUUFBUSxPQUFPLEdBQUc7O0lBRTNCLE9BQU87TUFDTCxLQUFLO01BQ0wsS0FBSyxLQUFLLE1BQU07TUFDaEIsUUFBUTs7OztTQUlMO0lBQ0wsT0FBTzs7OztBQUlYLE9BQU8sVUFBVTtBQUNqQjs7QUNuSEE7O0FBRUEsU0FBUyxJQUFJLEtBQUs7RUFDaEIsTUFBTSxPQUFPOzs7RUFHYixJQUFJLFFBQVE7Ozs7Ozs7SUFPVixNQUFNLFdBQVc7TUFDZixPQUFPLElBQUksUUFBUSxTQUFTLENBQUMsSUFBSSxNQUFNLElBQUksVUFBVSxHQUFHLElBQUksUUFBUTs7Ozs7Ozs7SUFRdEUsYUFBYSxXQUFXO01BQ3RCLE9BQU8sSUFBSSxRQUFRLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxVQUFVLElBQUksUUFBUSxLQUFLOzs7Ozs7OztJQVF2RSxhQUFhLFdBQVc7TUFDdEIsSUFBSSxRQUFRLE1BQU0sY0FBYyxNQUFNO01BQ3RDLElBQUksU0FBUzs7TUFFYixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxRQUFRLEtBQUs7UUFDaEMsR0FBRyxNQUFNLE9BQU8sSUFBSTtRQUNwQixJQUFJLFlBQVksTUFBTSxHQUFHLE1BQU07UUFDL0IsT0FBTyxVQUFVLE1BQU0sQ0FBQyxPQUFPLFVBQVUsT0FBTyxlQUFlLFVBQVUsT0FBTyxNQUFNLE9BQU8sVUFBVTs7O01BR3pHLE9BQU87Ozs7RUFJWCxPQUFPOzs7QUFHVCxPQUFPLFVBQVU7QUFDakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgZnVuY3Rpb24gKCRzdGF0ZSkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBJbnN0YW50aWF0ZSBtb2R1bGVcbmFuZ3VsYXIubW9kdWxlKCdhbmd1bGFyLXN0YXRlLXJvdXRlcicsIFtdKVxuXG4gIC5wcm92aWRlcignJHN0YXRlJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXInKSlcblxuICAuZmFjdG9yeSgnJHVybE1hbmFnZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3VybC1tYW5hZ2VyJykpXG5cbiAgLmZhY3RvcnkoJyRyZXNvbHV0aW9uJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9yZXNvbHV0aW9uJykpXG5cbiAgLnJ1bihbJyRyb290U2NvcGUnLCAnJHN0YXRlJywgJyR1cmxNYW5hZ2VyJywgJyRyZXNvbHV0aW9uJywgZnVuY3Rpb24oJHJvb3RTY29wZSwgJHN0YXRlLCAkdXJsTWFuYWdlciwgJHJlc29sdXRpb24pIHtcbiAgICAvLyBVcGRhdGUgbG9jYXRpb24gY2hhbmdlc1xuICAgICRyb290U2NvcGUuJG9uKCckbG9jYXRpb25DaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24oKSB7XG4gICAgICAkdXJsTWFuYWdlci5sb2NhdGlvbihhcmd1bWVudHMpO1xuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZVxuICAgICRzdGF0ZS4kcmVhZHkoKTtcbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHEnLCAnJGluamVjdG9yJywgJyRzdGF0ZScsIGZ1bmN0aW9uKCRxLCAkaW5qZWN0b3IsICRzdGF0ZSkge1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICByZXNvbHZlIEEgaGFzaCBPYmplY3Qgb2YgaXRlbXMgdG8gcmVzb2x2ZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0ZW1wbGF0ZXMgcmV0aXJldmVkXG4gICAqL1xuICB2YXIgX3Jlc29sdmUgPSBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgdmFyIHJlc29sdmVzUHJvbWlzZXMgPSB7fTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvbHZlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlLCBudWxsLCBudWxsLCBrZXkpO1xuICAgICAgcmVzb2x2ZXNQcm9taXNlc1trZXldID0gJHEud2hlbihyZXNvbHV0aW9uKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwocmVzb2x2ZXNQcm9taXNlcyk7XG4gIH07XG4gIF9zZWxmLnJlc29sdmUgPSBfcmVzb2x2ZTtcblxuICAvKipcbiAgICogTWlkZGxld2FyZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlcXVlc3QgQSBkYXRhIE9iamVjdFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gbmV4dCAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX3JlZ2lzdGVyID0gZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlKGN1cnJlbnQucmVzb2x2ZSB8fCB7fSkudGhlbihmdW5jdGlvbihsb2NhbHMpIHtcbiAgICAgIGFuZ3VsYXIuZXh0ZW5kKHJlcXVlc3QubG9jYWxzLCBsb2NhbHMpO1xuICAgICAgbmV4dCgpO1xuXG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcmVzb2x2aW5nIHN0YXRlJykpO1xuICAgIH0pO1xuICB9O1xuICBfcmVnaXN0ZXIucHJpb3JpdHkgPSAxMDA7XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShfcmVnaXN0ZXIpO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcbnZhciBRdWV1ZUhhbmRsZXIgPSByZXF1aXJlKCcuLi91dGlscy9xdWV1ZS1oYW5kbGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIFByb3ZpZGVyXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIENvbmZpZ3VyYXRpb24sIGdsb2JhbCBvcHRpb25zXG4gIHZhciBfY29uZmlndXJhdGlvbiA9IHtcbiAgICBoaXN0b3J5TGVuZ3RoOiA1XG4gIH07XG5cbiAgLy8gU3RhdGUgZGVmaW5pdGlvbiBsaWJyYXJ5XG4gIHZhciBfc3RhdGVMaWJyYXJ5ID0ge307XG4gIHZhciBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCB0byBzdGF0ZSBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lUGFyYW1zIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgQSBuYW1lIHN0cmluZyBhbmQgcGFyYW0gT2JqZWN0XG4gICAqL1xuICB2YXIgX3BhcnNlTmFtZSA9IGZ1bmN0aW9uKG5hbWVQYXJhbXMpIHtcbiAgICBpZihuYW1lUGFyYW1zICYmIG5hbWVQYXJhbXMubWF0Y2goL15bYS16QS1aMC05X1xcLl0qXFwoLipcXCkkLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWVQYXJhbXMuc3Vic3RyaW5nKDAsIG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWVQYXJhbXMuc3Vic3RyaW5nKG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKzEsIG5hbWVQYXJhbXMubGFzdEluZGV4T2YoJyknKSkgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbnBhcnQsXG4gICAgICAgIHBhcmFtczogcHBhcnRcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbmFtZVBhcmFtcyxcbiAgICAgICAgcGFyYW1zOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgYSA9IGEgfHwge307XG4gICAgYiA9IGIgfHwge307XG4gICAgcmV0dXJuIGEubmFtZSA9PT0gYi5uYW1lICYmIGFuZ3VsYXIuZXF1YWxzKGEucGFyYW1zLCBiLnBhcmFtcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9zdGF0ZUNhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX3N0YXRlQ2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG5cbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiBfc3RhdGVMaWJyYXJ5W25hbWVdO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICAgIHJldHVybiAhIXBhcmVudDtcbiAgICAgIH0pO1xuXG4gICAgLy8gV2FsayB1cCBjaGVja2luZyBpbmhlcml0YW5jZVxuICAgIGZvcih2YXIgaT1zdGF0ZUNoYWluLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKHN0YXRlQ2hhaW5baV0pIHtcbiAgICAgICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShzdGF0ZUNoYWluW2ldKTtcbiAgICAgICAgZGVsZXRlKG5leHRTdGF0ZS5yZXNvbHZlKTtcbiAgICAgICAgc3RhdGUgPSBhbmd1bGFyLm1lcmdlKG5leHRTdGF0ZSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiBzdGF0ZS5pbmhlcml0ID09PSBmYWxzZSkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfc3RhdGVDYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uLiAgUGFyYW1ldGVycyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gZGF0YSBPYmplY3Qgbm90IHN0YXRlIG5hbWUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfc3RhdGVMaWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICAvLyBSZXNldCBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlID0ge307XG5cbiAgICAvLyBVUkwgbWFwcGluZ1xuICAgIGlmKHN0YXRlLnVybCkge1xuICAgICAgX3VybERpY3Rpb25hcnkuYWRkKHN0YXRlLnVybCwgc3RhdGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBkYXRhIHBhcmFtZXRlcnMgZm9yIFN0YXRlUm91dGVyXG4gICAqXG4gICAqIEluY2x1ZGluZyBwYXJhbWV0ZXJzOlxuICAgKiBcbiAgICogLSBoaXN0b3J5TGVuZ3RoICAge051bWJlcn0gRGVmYXVsdHMgdG8gNVxuICAgKiAtIGluaXRpYWxMb2NhdGlvbiB7T2JqZWN0fSBBbiBPYmplY3R7bmFtZTpTdHJpbmcsIHBhcmFtczpPYmplY3R9IGZvciBpbml0aWFsIHN0YXRlIHRyYW5zaXRpb25cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIG9wdGlvbnMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5vcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGFuZ3VsYXIuZXh0ZW5kKF9jb25maWd1cmF0aW9uLCBvcHRpb25zIHx8IHt9KTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAqIFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuc3RhdGUgPSBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgIGlmKCFzdGF0ZSkge1xuICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICB9XG4gICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgaW5pdGlhbGl6YXRpb24gcGFyYW1ldGVyczsgZGVmZXJyZWQgdG8gJHJlYWR5KClcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBuYW1lICAgQSBpbmlpdGFsIHN0YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBwYXJhbXMgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgX2NvbmZpZ3VyYXRpb24uaW5pdGlhbExvY2F0aW9uID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgaW5zdGFuY2VcbiAgICovXG4gIHRoaXMuJGdldCA9IFsnJHJvb3RTY29wZScsICckbG9jYXRpb24nLCAnJHEnLCBmdW5jdGlvbiBTdGF0ZVJvdXRlckZhY3RvcnkoJHJvb3RTY29wZSwgJGxvY2F0aW9uLCAkcSkge1xuXG4gICAgLy8gQ3VycmVudCBzdGF0ZVxuICAgIHZhciBfY3VycmVudDtcblxuICAgIHZhciBfb3B0aW9ucztcbiAgICB2YXIgX2luaXRhbExvY2F0aW9uO1xuICAgIHZhciBfaGlzdG9yeSA9IFtdO1xuICAgIHZhciBfaXNJbml0ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAgICogXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBfcHVzaEhpc3RvcnkgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgICAgIHZhciBoaXN0b3J5TGVuZ3RoID0gX29wdGlvbnMuaGlzdG9yeUxlbmd0aCB8fCA1O1xuXG4gICAgICBpZihkYXRhKSB7XG4gICAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IGhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIGhpc3RvcnlMZW5ndGgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHRvIHN0YXRlLiAgUGFyYW1ldGVycyBpbiBgcGFyYW1zYCB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgc3RhdGUtbm90YXRpb24gYG5hbWVgIGV4cHJlc3Npb24uICBcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb24gaW5jbHVkaW5nIG9wdGlvbmFsIHBhcmFtZXRlcnNcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgICAgICAgIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gc3RhdGUgY2hhbmdlIG9jY3Vyc1xuICAgICAqL1xuICAgIHZhciBfY2hhbmdlU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuICAgICAgLy8gUGFyc2Ugc3RhdGUtbm90YXRpb24gZXhwcmVzc2lvblxuICAgICAgdmFyIG5hbWVFeHByID0gX3BhcnNlTmFtZShuYW1lKTtcbiAgICAgIG5hbWUgPSBuYW1lRXhwci5uYW1lO1xuICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQobmFtZUV4cHIucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuXG4gICAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgICAgdmFyIHJlcXVlc3QgPSB7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgICBsb2NhbHM6IHt9XG4gICAgICB9O1xuXG4gICAgICAvLyBDb21waWxlIGV4ZWN1dGlvbiBwaGFzZXNcbiAgICAgIHZhciBxdWV1ZSA9IFF1ZXVlSGFuZGxlcigpLmRhdGEocmVxdWVzdCk7XG5cbiAgICAgIHZhciBuZXh0U3RhdGUgPSBhbmd1bGFyLmNvcHkoX2dldFN0YXRlKG5hbWUpKTtcbiAgICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgICAgaWYobmV4dFN0YXRlKSB7XG4gICAgICAgIC8vIFNldCBsb2NhbHNcbiAgICAgICAgbmV4dFN0YXRlLmxvY2FscyA9IHJlcXVlc3QubG9jYWxzO1xuICAgICAgICBcbiAgICAgICAgLy8gU2V0IHBhcmFtZXRlcnNcbiAgICAgICAgbmV4dFN0YXRlLnBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5leHRTdGF0ZS5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG4gICAgICB9XG5cbiAgICAgIC8vIERvZXMgbm90IGV4aXN0XG4gICAgICBpZihuZXh0U3RhdGUgPT09IG51bGwpIHtcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcblxuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRXJyb3JOb3RGb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcbiAgICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgICB9IGVsc2UgaWYoX2NvbXBhcmVTdGF0ZXMocHJldlN0YXRlLCBuZXh0U3RhdGUpKSB7XG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAvLyBWYWxpZCBzdGF0ZSBleGlzdHNcbiAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgLy8gTWFrZSBzdGF0ZSBjaGFuZ2VcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBpZihwcmV2U3RhdGUpIF9wdXNoSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuICAgICAgICAgIFxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUHJvY2VzcyBzdGFydGVkXG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VCZWdpbicsIHJlcXVlc3QpO1xuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgICAgcXVldWUuYWRkKF9sYXllckxpc3QpO1xuXG4gICAgICAgIC8vIFByb2Nlc3MgZW5kZWRcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVuZCcsIHJlcXVlc3QpO1xuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJ1blxuICAgICAgcXVldWUuZXhlY3V0ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvcicsIGVyciwgcmVxdWVzdCk7XG4gICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlcXVlc3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VDb21wbGV0ZScsIHJlcXVlc3QpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICAvLyBJbnN0YW5jZVxuICAgIHZhciBfaW5zdDtcbiAgICBfaW5zdCA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBHZXQgb3B0aW9uc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBjb25maWd1cmVkIG9wdGlvbnNcbiAgICAgICAqL1xuICAgICAgb3B0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIEhhc24ndCBiZWVuIGluaXRpYWxpemVkXG4gICAgICAgIGlmKCFfb3B0aW9ucykge1xuICAgICAgICAgIF9vcHRpb25zID0gYW5ndWxhci5jb3B5KF9jb25maWd1cmF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfb3B0aW9ucztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0L2dldCBzdGF0ZVxuICAgICAgICovXG4gICAgICBzdGF0ZTogZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICAgICAgaWYoIXN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBhZGQgbWlkZGxld2FyZSwgZXhlY3V0aW5nIG5leHQoZXJyKTtcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIGhhbmRsZXIgQSBjYWxsYmFjaywgZnVuY3Rpb24ocmVxdWVzdCwgbmV4dClcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICR1c2U6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgICAgaWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pZGRsZXdhcmUgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgX2xheWVyTGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBwZXJmb3JtIGluaXRpYWxpemF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHJlYWR5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYoIV9pc0luaXQpIHtcbiAgICAgICAgICBfaXNJbml0ID0gdHJ1ZTtcblxuICAgICAgICAgIC8vIENvbmZpZ3VyYXRpb25cbiAgICAgICAgICBpZighX29wdGlvbnMpIHtcbiAgICAgICAgICAgIF9vcHRpb25zID0gYW5ndWxhci5jb3B5KF9jb25maWd1cmF0aW9uKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgaWYoX29wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2luaXRpYWxMb2NhdGlvbicpKSB7XG4gICAgICAgICAgICBfaW5pdGFsTG9jYXRpb24gPSBhbmd1bGFyLmNvcHkoX29wdGlvbnMuaW5pdGlhbExvY2F0aW9uKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgcmVhZHlEZWZlcnJlZCA9IG51bGw7XG5cbiAgICAgICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICAgICAgaWYoJGxvY2F0aW9uLnVybCgpICE9PSAnJykge1xuICAgICAgICAgICAgcmVhZHlEZWZlcnJlZCA9IF9pbnN0LiRsb2NhdGlvbigkbG9jYXRpb24udXJsKCkpO1xuXG4gICAgICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICAgICAgfSBlbHNlIGlmKF9pbml0YWxMb2NhdGlvbikge1xuICAgICAgICAgICAgcmVhZHlEZWZlcnJlZCA9IF9jaGFuZ2VTdGF0ZShfaW5pdGFsTG9jYXRpb24ubmFtZSwgX2luaXRhbExvY2F0aW9uLnBhcmFtcyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgJHEud2hlbihyZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVJbml0Jyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvLyBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgICAgcGFyc2U6IF9wYXJzZU5hbWUsXG5cbiAgICAgIC8vIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAgICBsaWJyYXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9zdGF0ZUxpYnJhcnk7XG4gICAgICB9LFxuXG4gICAgICAvLyBWYWxpZGF0aW9uXG4gICAgICB2YWxpZGF0ZToge1xuICAgICAgICBuYW1lOiBfdmFsaWRhdGVTdGF0ZU5hbWUsXG4gICAgICAgIHF1ZXJ5OiBfdmFsaWRhdGVTdGF0ZVF1ZXJ5XG4gICAgICB9LFxuXG4gICAgICAvLyBSZXRyaWV2ZSBoaXN0b3J5XG4gICAgICBoaXN0b3J5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9oaXN0b3J5O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBDaGFuZ2Ugc3RhdGUsIGFzeW5jaHJvbm91cyBvcGVyYXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9ICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgY2hhbmdlOiBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIF9jaGFuZ2VTdGF0ZShuYW1lLCBwYXJhbXMpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY2hhbmdlIHN0YXRlIGJhc2VkIG9uICRsb2NhdGlvbi51cmwoKSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvbiB1c2luZyBpbnRlcm5hbCBtZXRob2RzLCBxdWlldCBmYWxsYmFjay4gIFxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgdXJsICAgICAgICBBIHVybCBtYXRjaGluZyBkZWZpbmQgc3RhdGVzXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgW2NhbGxiYWNrXSBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9ICAgICAgICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkbG9jYXRpb246IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICB2YXIgZGF0YSA9IF91cmxEaWN0aW9uYXJ5Lmxvb2t1cCh1cmwpO1xuXG4gICAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgICB2YXIgc3RhdGUgPSBkYXRhLnJlZjtcblxuICAgICAgICAgIGlmKHN0YXRlKSB7XG4gICAgICAgICAgICAvLyBQYXJzZSBwYXJhbXMgZnJvbSB1cmxcbiAgICAgICAgICAgIHJldHVybiBfY2hhbmdlU3RhdGUoc3RhdGUubmFtZSwgZGF0YS5wYXJhbXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAkcS5yZWplY3QobmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBsb2NhdGlvbiBpbiBsaWJyYXJ5JykpO1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgLyoqXG4gICAgICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBjdXJyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICghX2N1cnJlbnQpID8gbnVsbCA6IGFuZ3VsYXIuY29weShfY3VycmVudCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENoZWNrIHF1ZXJ5IGFnYWluc3QgY3VycmVudCBzdGF0ZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgIEEgdHJ1ZSBpZiBzdGF0ZSBpcyBwYXJlbnQgdG8gY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBhY3RpdmU6IGZ1bmN0aW9uKHF1ZXJ5LCBwYXJhbXMpIHtcbiAgICAgICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICAgICAgXG4gICAgICAgIC8vIE5vIHN0YXRlXG4gICAgICAgIGlmKCFfY3VycmVudCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgICAgIH0gZWxzZSBpZihxdWVyeSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gocXVlcnkpO1xuXG4gICAgICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgICAgIH0gZWxzZSBpZih0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKSB7XG5cbiAgICAgICAgICAvLyBDYXN0IHN0cmluZyB0byBSZWdFeHBcbiAgICAgICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgICAgICB2YXIgY2FzdGVkID0gcXVlcnkuc3Vic3RyKDEsIHF1ZXJ5Lmxlbmd0aC0yKTtcbiAgICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cChjYXN0ZWQpKTtcblxuICAgICAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSBxdWVyeVxuICAgICAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtID09PSAnKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9dKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKGl0ZW0gPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9cXFxcLl0qJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKHRyYW5zZm9ybWVkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm9uLW1hdGNoaW5nXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIF9pbnN0O1xuICB9XTtcblxufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsICckbG9jYXRpb24nLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCRzdGF0ZSwgJGxvY2F0aW9uLCAkcm9vdFNjb3BlKSB7XG4gIHZhciBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgVVJMIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICB2YXIgX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKGN1cnJlbnQgJiYgY3VycmVudC51cmwpIHtcbiAgICAgIHZhciBwYXRoO1xuICAgICAgcGF0aCA9IGN1cnJlbnQudXJsO1xuXG4gICAgICAvLyBBZGQgcGFyYW1ldGVycyBvciB1c2UgZGVmYXVsdCBwYXJhbWV0ZXJzXG4gICAgICB2YXIgcGFyYW1zID0gY3VycmVudC5wYXJhbXMgfHwge307XG4gICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgIGZvcih2YXIgbmFtZSBpbiBwYXJhbXMpIHtcbiAgICAgICAgdmFyIHJlID0gbmV3IFJlZ0V4cCgnOicrbmFtZSwgJ2cnKTtcbiAgICAgICAgaWYocGF0aC5tYXRjaChyZSkpIHtcbiAgICAgICAgICBwYXRoID0gcGF0aC5yZXBsYWNlKHJlLCBwYXJhbXNbbmFtZV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHF1ZXJ5W25hbWVdID0gcGFyYW1zW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgICRsb2NhdGlvbi5wYXRoKHBhdGgpO1xuICAgICAgJGxvY2F0aW9uLnNlYXJjaChxdWVyeSk7XG4gICAgICBcbiAgICAgIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIERldGVjdCBVUkwgY2hhbmdlIGFuZCBkaXNwYXRjaCBzdGF0ZSBjaGFuZ2VcbiAgICovXG4gIF9zZWxmLmxvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxhc3RVcmwgPSBfdXJsO1xuICAgIHZhciBuZXh0VXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gICAgaWYobmV4dFVybCAhPT0gbGFzdFVybCkge1xuICAgICAgX3VybCA9IG5leHRVcmw7XG5cbiAgICAgICRzdGF0ZS4kbG9jYXRpb24oX3VybCk7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRsb2NhdGlvblN0YXRlVXBkYXRlJyk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIF91cGRhdGUoKTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBQYXJzZSBPYmplY3QgbGl0ZXJhbCBuYW1lLXZhbHVlIHBhaXJzXG52YXIgcmVQYXJzZU9iamVjdExpdGVyYWwgPSAvKFsse11cXHMqKChcInwnKSguKj8pXFwzfFxcdyopfCg6XFxzKihbKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/fHRydWV8ZmFsc2V8bnVsbHwoXCJ8JykoLio/KVxcN3xcXFtbXlxcXV0qXFxdKSkpL2c7XG5cbi8vIE1hdGNoIFN0cmluZ3NcbnZhciByZVN0cmluZyA9IC9eKFwifCcpKC4qPylcXDEkLztcblxuLy8gVE9ETyBBZGQgZXNjYXBlZCBzdHJpbmcgcXVvdGVzIFxcJyBhbmQgXFxcIiB0byBzdHJpbmcgbWF0Y2hlclxuXG4vLyBNYXRjaCBOdW1iZXIgKGludC9mbG9hdC9leHBvbmVudGlhbClcbnZhciByZU51bWJlciA9IC9eWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspPyQvO1xuXG4vKipcbiAqIFBhcnNlIHN0cmluZyB2YWx1ZSBpbnRvIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsLlxuICpcbiAqIFN0cmluZ3MgYXJlIHN1cnJvdW5kZWQgYnkgYSBwYWlyIG9mIG1hdGNoaW5nIHF1b3Rlc1xuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHZhbHVlIEEgU3RyaW5nIHZhbHVlIHRvIHBhcnNlXG4gKiBAcmV0dXJuIHtNaXhlZH0gICAgICAgIEEgQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGxcbiAqL1xudmFyIF9yZXNvbHZlVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXG4gIC8vIEJvb2xlYW46IHRydWVcbiAgaWYodmFsdWUgPT09ICd0cnVlJykge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIC8vIEJvb2xlYW46IGZhbHNlXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ2ZhbHNlJykge1xuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBOdWxsXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ251bGwnKSB7XG4gICAgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RyaW5nXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZVN0cmluZykpIHtcbiAgICByZXR1cm4gdmFsdWUuc3Vic3RyKDEsIHZhbHVlLmxlbmd0aC0yKTtcblxuICAvLyBOdW1iZXJcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlTnVtYmVyKSkge1xuICAgIHJldHVybiArdmFsdWU7XG5cbiAgLy8gTmFOXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ05hTicpIHtcbiAgICByZXR1cm4gTmFOO1xuXG4gIC8vIFRPRE8gYWRkIG1hdGNoaW5nIHdpdGggQXJyYXlzIGFuZCBwYXJzZVxuICBcbiAgfVxuXG4gIC8vIFVuYWJsZSB0byByZXNvbHZlXG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIEZpbmQgdmFsdWVzIGluIGFuIG9iamVjdCBsaXRlcmFsXG52YXIgX2xpc3RpZnkgPSBmdW5jdGlvbihzdHIpIHtcblxuICAvLyBUcmltXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcblxuICBpZihzdHIubWF0Y2goL15cXHMqey4qfVxccyokLykgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhcmFtZXRlcnMgZXhwZWN0cyBhbiBPYmplY3QnKTtcbiAgfVxuXG4gIHZhciBzYW5pdGl6ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvXltcXHssXT9cXHMqW1wiJ10/LywgJycpLnJlcGxhY2UoL1tcIiddP1xccyokLywgJycpO1xuICB9O1xuXG4gIHZhciBzYW5pdGl6ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc3RyID0gdmFsdWUucmVwbGFjZSgvXig6KT9cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuICAgIHJldHVybiBfcmVzb2x2ZVZhbHVlKHN0cik7XG4gIH07XG5cbiAgcmV0dXJuIHN0ci5tYXRjaChyZVBhcnNlT2JqZWN0TGl0ZXJhbCkubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICByZXR1cm4gaSUyID09PSAwID8gc2FuaXRpemVOYW1lKGl0ZW0pIDogc2FuaXRpemVWYWx1ZShpdGVtKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIHBhcmFtcyBPYmplY3QgZnJvbSBzdHJpbmdcbiAqIFxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBBIHN0cmluZ2lmaWVkIHZlcnNpb24gb2YgT2JqZWN0IGxpdGVyYWxcbiAqL1xudmFyIFBhcmFtZXRlcnMgPSBmdW5jdGlvbihzdHIpIHtcbiAgc3RyID0gc3RyIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIF9saXN0aWZ5KHN0cikuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgaWYoaSUyID09PSAwKSB7XG4gICAgICBfc2VsZltpdGVtXSA9IGxpc3RbaSsxXTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyYW1ldGVycztcblxubW9kdWxlLmV4cG9ydHMucmVzb2x2ZVZhbHVlID0gX3Jlc29sdmVWYWx1ZTtcbm1vZHVsZS5leHBvcnRzLmxpc3RpZnkgPSBfbGlzdGlmeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBFeGVjdXRlIGEgc2VyaWVzIG9mIGZ1bmN0aW9uczsgdXNlZCBpbiB0YW5kZW0gd2l0aCBtaWRkbGV3YXJlXG4gKi9cbnZhciBRdWV1ZUhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIF9saXN0ID0gW107XG4gIHZhciBfZGF0YSA9IG51bGw7XG5cbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogQWRkIGEgaGFuZGxlclxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7TWl4ZWR9ICAgICAgICAgaGFuZGxlciBBIEZ1bmN0aW9uIG9yIGFuIEFycmF5IG9mIEZ1bmN0aW9ucyB0byBhZGQgdG8gdGhlIHF1ZXVlXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgYWRkOiBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEYXRhIG9iamVjdFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIGRhdGEgb2JqZWN0IG1hZGUgYXZhaWxhYmxlIHRvIGVhY2ggaGFuZGxlclxuICAgICAqIEByZXR1cm4ge1F1ZXVlSGFuZGxlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAqL1xuICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBCZWdpbiBleGVjdXRpb24gYW5kIHRyaWdnZXIgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgZXhlY3V0ZTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgIHZhciBleGVjdXRpb25MaXN0ID0gX2xpc3Quc2xpY2UoMCkuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiAoYS5wcmlvdGl0eSB8fCAxKSA8IChiLnByaW90aXR5IHx8IDEpO1xuICAgICAgfSk7XG5cbiAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBoYW5kbGVyID0gZXhlY3V0aW9uTGlzdC5zaGlmdCgpO1xuXG4gICAgICAgIC8vIENvbXBsZXRlXG4gICAgICAgIGlmKCFoYW5kbGVyKSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgLy8gTmV4dCBoYW5kbGVyXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFuZGxlci5jYWxsKG51bGwsIF9kYXRhLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgfVxuXG4gIH07XG4gIFxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSGFuZGxlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmwgPSByZXF1aXJlKCcuL3VybCcpO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFVybERpY3Rpb25hcnkoKSB7XG4gIHRoaXMuX3BhdHRlcm5zID0gW107XG4gIHRoaXMuX3JlZnMgPSBbXTtcbiAgdGhpcy5fcGFyYW1zID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuICB2YXIgcGFyYW1zID0ge307XG5cbiAgaWYocGF0dGVybi5pbmRleE9mKCc/JykgPT09IC0xKSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuXG4gIH0gZWxzZSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuICB9XG5cbiAgLy8gU3RhcnRcbiAgdmFyIHNlYXJjaEV4cHIgPSAnXic7XG5cbiAgLy8gSXRlbXNcbiAgKHBhdGhDaGFpbi5mb3JFYWNoKGZ1bmN0aW9uKGNodW5rLCBpKSB7XG4gICAgaWYoaSE9PTApIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1xcXFwvJztcbiAgICB9XG5cbiAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdbXlxcXFwvP10qJztcbiAgICAgIHBhcmFtc1tjaHVuay5zdWJzdHJpbmcoMSldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZWFyY2hFeHByICs9IGNodW5rO1xuICAgIH1cbiAgfSkpO1xuXG4gIC8vIEVuZFxuICBzZWFyY2hFeHByICs9ICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbiAgdGhpcy5fcGFyYW1zW2ldID0gcGFyYW1zO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgcmVmZXJlbmNlIGFjY29yZGluZyB0byBhIFVSTCBwYXR0ZXJuIGFuZCByZXRyaWV2ZSBwYXJhbXMgZGVmaW5lZCBpbiBVUkxcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB1cmwgPSB1cmwgfHwgJyc7XG4gIHZhciBwID0gVXJsKHVybCkucGF0aCgpO1xuICB2YXIgcSA9IFVybCh1cmwpLnF1ZXJ5cGFyYW1zKCk7XG5cbiAgdmFyIF9zZWxmID0gdGhpcztcblxuICAvLyBDaGVjayBkaWN0aW9uYXJ5XG4gIHZhciBfZmluZFBhdHRlcm4gPSBmdW5jdGlvbihjaGVjaykge1xuICAgIGNoZWNrID0gY2hlY2sgfHwgJyc7XG4gICAgZm9yKHZhciBpPV9zZWxmLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihjaGVjay5tYXRjaChfc2VsZi5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgdmFyIGkgPSBfZmluZFBhdHRlcm4ocCk7XG4gIFxuICAvLyBNYXRjaGluZyBwYXR0ZXJuIGZvdW5kXG4gIGlmKGkgIT09IC0xKSB7XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcGF0dGVybiBtYXRjaFxuICAgIHZhciBwYXJhbXMgPSB7fTtcbiAgICBmb3IodmFyIG4gaW4gdGhpcy5fcGFyYW1zW2ldKSB7XG4gICAgICB2YXIgcGFyYW1QYXJzZXIgPSB0aGlzLl9wYXJhbXNbaV1bbl07XG4gICAgICB2YXIgdXJsTWF0Y2ggPSAodXJsLm1hdGNoKHBhcmFtUGFyc2VyKSB8fCBbXSkucG9wKCkgfHwgJyc7XG4gICAgICB2YXIgdmFyTWF0Y2ggPSB1cmxNYXRjaC5zcGxpdCgnLycpLnBvcCgpO1xuICAgICAgcGFyYW1zW25dID0gdmFyTWF0Y2g7XG4gICAgfVxuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHF1ZXJ5c3RyaW5nIG1hdGNoXG4gICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQocSwgcGFyYW1zKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIHJlZjogdGhpcy5fcmVmc1tpXSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcblxuICAvLyBOb3QgaW4gZGljdGlvbmFyeVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/IHVybCA6IHVybC5zdWJzdHJpbmcoMCwgdXJsLmluZGV4T2YoJz8nKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlzdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJycgOiB1cmwuc3Vic3RyaW5nKHVybC5pbmRleE9mKCc/JykrMSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkwgcGFyYW1ldGVycyBhcyBhIGhhc2hcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlwYXJhbXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhaXJzID0gX3NlbGYucXVlcnlzdHJpbmcoKS5zcGxpdCgnJicpO1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBmb3IodmFyIGk9MDsgaTxwYWlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihwYWlyc1tpXSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmFtZVZhbHVlID0gcGFpcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgcGFyYW1zW25hbWVWYWx1ZVswXV0gPSAodHlwZW9mIG5hbWVWYWx1ZVsxXSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmFtZVZhbHVlWzFdID09PSAnJykgPyB0cnVlIDogbmFtZVZhbHVlWzFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
