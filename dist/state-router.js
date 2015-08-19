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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3Jlc29sdXRpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9zZXJ2aWNlcy91cmwtbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3BhcmFtZXRlcnMuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9xdWV1ZS1oYW5kbGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFPLFVB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SUFBSSxRQUFRLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxVQUFVLElBQUksUUFBUSxLQUFLOzs7Ozs7OztJQVF2RSxhQUFhLFdBQVc7TUFDdEIsSUFBSSxRQUFRLE1BQU0sY0FBYyxNQUFNO01BQ3RDLElBQUksU0FBUzs7TUFFYixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxRQUFRLEtBQUs7UUFDaEMsR0FBRyxNQUFNLE9BQU8sSUFBSTtRQUNwQixJQUFJLFlBQVksTUFBTSxHQUFHLE1BQU07UUFDL0IsT0FBTyxVQUFVLE1BQU0sQ0FBQyxPQUFPLFVBQVUsT0FBTyxlQUFlLFVBQVUsT0FBTyxNQUFNLE9BQU8sVUFBVTs7O01BR3pHLE9BQU87Ozs7RUFJWCxPQUFPOzs7QUFHVCxPQUFPLFVBQVU7QUFDakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgZnVuY3Rpb24gKCRzdGF0ZSkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBJbnN0YW50aWF0ZSBtb2R1bGVcbmFuZ3VsYXIubW9kdWxlKCdhbmd1bGFyLXN0YXRlLXJvdXRlcicsIFtdKVxuXG4gIC5wcm92aWRlcignJHN0YXRlJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXInKSlcblxuICAuZmFjdG9yeSgnJHVybE1hbmFnZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3VybC1tYW5hZ2VyJykpXG5cbiAgLmZhY3RvcnkoJyRyZXNvbHV0aW9uJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9yZXNvbHV0aW9uJykpXG5cbiAgLnJ1bihbJyRyb290U2NvcGUnLCAnJHN0YXRlJywgJyR1cmxNYW5hZ2VyJywgJyRyZXNvbHV0aW9uJywgZnVuY3Rpb24oJHJvb3RTY29wZSwgJHN0YXRlLCAkdXJsTWFuYWdlciwgJHJlc29sdXRpb24pIHtcbiAgICAvLyBVcGRhdGUgbG9jYXRpb24gY2hhbmdlc1xuICAgICRyb290U2NvcGUuJG9uKCckbG9jYXRpb25DaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24oKSB7XG4gICAgICAkdXJsTWFuYWdlci5sb2NhdGlvbihhcmd1bWVudHMpO1xuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZVxuICAgICRzdGF0ZS4kcmVhZHkoKTtcbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHEnLCAnJGluamVjdG9yJywgJyRzdGF0ZScsIGZ1bmN0aW9uKCRxLCAkaW5qZWN0b3IsICRzdGF0ZSkge1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICByZXNvbHZlIEEgaGFzaCBPYmplY3Qgb2YgaXRlbXMgdG8gcmVzb2x2ZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0ZW1wbGF0ZXMgcmV0aXJldmVkXG4gICAqL1xuICB2YXIgX3Jlc29sdmUgPSBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgdmFyIHJlc29sdmVzUHJvbWlzZXMgPSB7fTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvbHZlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlLCBudWxsLCBudWxsLCBrZXkpO1xuICAgICAgcmVzb2x2ZXNQcm9taXNlc1trZXldID0gJHEud2hlbihyZXNvbHV0aW9uKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwocmVzb2x2ZXNQcm9taXNlcyk7XG4gIH07XG4gIF9zZWxmLnJlc29sdmUgPSBfcmVzb2x2ZTtcblxuICAvKipcbiAgICogTWlkZGxld2FyZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlcXVlc3QgQSBkYXRhIE9iamVjdFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gbmV4dCAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX3JlZ2lzdGVyID0gZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlKGN1cnJlbnQucmVzb2x2ZSB8fCB7fSkudGhlbihmdW5jdGlvbihsb2NhbHMpIHtcbiAgICAgIGFuZ3VsYXIuZXh0ZW5kKHJlcXVlc3QubG9jYWxzLCBsb2NhbHMpO1xuICAgICAgbmV4dCgpO1xuXG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcmVzb2x2aW5nIHN0YXRlJykpO1xuICAgIH0pO1xuICB9O1xuICBfcmVnaXN0ZXIucHJpb3JpdHkgPSAxMDA7XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShfcmVnaXN0ZXIpO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcbnZhciBRdWV1ZUhhbmRsZXIgPSByZXF1aXJlKCcuLi91dGlscy9xdWV1ZS1oYW5kbGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIFByb3ZpZGVyXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIENvbmZpZ3VyYXRpb24sIGdsb2JhbCBvcHRpb25zXG4gIHZhciBfY29uZmlndXJhdGlvbiA9IHtcbiAgICBoaXN0b3J5TGVuZ3RoOiA1XG4gIH07XG5cbiAgLy8gU3RhdGUgZGVmaW5pdGlvbiBsaWJyYXJ5XG4gIHZhciBfc3RhdGVMaWJyYXJ5ID0ge307XG4gIHZhciBfc3RhdGVDYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCB0byBzdGF0ZSBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lUGFyYW1zIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgQSBuYW1lIHN0cmluZyBhbmQgcGFyYW0gT2JqZWN0XG4gICAqL1xuICB2YXIgX3BhcnNlTmFtZSA9IGZ1bmN0aW9uKG5hbWVQYXJhbXMpIHtcbiAgICBpZihuYW1lUGFyYW1zICYmIG5hbWVQYXJhbXMubWF0Y2goL15bYS16QS1aMC05X1xcLl0qXFwoLipcXCkkLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWVQYXJhbXMuc3Vic3RyaW5nKDAsIG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWVQYXJhbXMuc3Vic3RyaW5nKG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKzEsIG5hbWVQYXJhbXMubGFzdEluZGV4T2YoJyknKSkgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbnBhcnQsXG4gICAgICAgIHBhcmFtczogcHBhcnRcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbmFtZVBhcmFtcyxcbiAgICAgICAgcGFyYW1zOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgYSA9IGEgfHwge307XG4gICAgYiA9IGIgfHwge307XG4gICAgcmV0dXJuIGEubmFtZSA9PT0gYi5uYW1lICYmIGFuZ3VsYXIuZXF1YWxzKGEucGFyYW1zLCBiLnBhcmFtcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9zdGF0ZUNhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX3N0YXRlQ2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24obmFtZSwgaSkge1xuICAgICAgICB2YXIgaXRlbSA9IGFuZ3VsYXIuY29weShfc3RhdGVMaWJyYXJ5W25hbWVdKTtcblxuICAgICAgICBpZihpdGVtICYmIGkgIT09IG5hbWVDaGFpbi5sZW5ndGgtMSkge1xuICAgICAgICAgIGRlbGV0ZShpdGVtLnJlc29sdmUpO1xuICAgICAgICAgIGRlbGV0ZShpdGVtLnRlbXBsYXRlcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gISFwYXJlbnQ7XG4gICAgICB9KTtcblxuICAgIC8vIFdhbGsgdXAgY2hlY2tpbmcgaW5oZXJpdGFuY2VcbiAgICBmb3IodmFyIGk9c3RhdGVDaGFpbi5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihzdGF0ZUNoYWluW2ldKSB7XG4gICAgICAgIHZhciBuZXh0U3RhdGUgPSBzdGF0ZUNoYWluW2ldO1xuICAgICAgICBzdGF0ZSA9IGFuZ3VsYXIubWVyZ2UobmV4dFN0YXRlLCBzdGF0ZSB8fCB7fSk7XG4gICAgICB9XG5cbiAgICAgIGlmKHN0YXRlICYmIHN0YXRlLmluaGVyaXQgPT09IGZhbHNlKSBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbiBjYWNoZVxuICAgIF9zdGF0ZUNhY2hlW25hbWVdID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBzdG9yZSBhIHN0YXRlIGRlZmluaXRpb24uICBQYXJhbWV0ZXJzIHNob3VsZCBiZSBpbmNsdWRlZCBpbiBkYXRhIE9iamVjdCBub3Qgc3RhdGUgbmFtZS4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9kZWZpbmVTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZihuYW1lID09PSBudWxsIHx8IHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOYW1lIGNhbm5vdCBiZSBudWxsLicpO1xuICAgIFxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIG5hbWVzXG4gICAgfSBlbHNlIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdGF0ZSBuYW1lLicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzdGF0ZVxuICAgIHZhciBzdGF0ZSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgIC8vIFVzZSBkZWZhdWx0c1xuICAgIF9zZXRTdGF0ZURlZmF1bHRzKHN0YXRlKTtcblxuICAgIC8vIE5hbWVkIHN0YXRlXG4gICAgc3RhdGUubmFtZSA9IG5hbWU7XG5cbiAgICAvLyBTZXQgZGVmaW5pdGlvblxuICAgIF9zdGF0ZUxpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIC8vIFJlc2V0IGNhY2hlXG4gICAgX3N0YXRlQ2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBjb25maWd1cmF0aW9uIGRhdGEgcGFyYW1ldGVycyBmb3IgU3RhdGVSb3V0ZXJcbiAgICpcbiAgICogSW5jbHVkaW5nIHBhcmFtZXRlcnM6XG4gICAqIFxuICAgKiAtIGhpc3RvcnlMZW5ndGggICB7TnVtYmVyfSBEZWZhdWx0cyB0byA1XG4gICAqIC0gaW5pdGlhbExvY2F0aW9uIHtPYmplY3R9IEFuIE9iamVjdHtuYW1lOlN0cmluZywgcGFyYW1zOk9iamVjdH0gZm9yIGluaXRpYWwgc3RhdGUgdHJhbnNpdGlvblxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgb3B0aW9ucyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLm9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgYW5ndWxhci5leHRlbmQoX2NvbmZpZ3VyYXRpb24sIG9wdGlvbnMgfHwge30pO1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldC9nZXQgc3RhdGVcbiAgICogXG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgaWYoIXN0YXRlKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBpbml0aWFsaXphdGlvbiBwYXJhbWV0ZXJzOyBkZWZlcnJlZCB0byAkcmVhZHkoKVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIG5hbWUgICBBIGluaWl0YWwgc3RhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLmluaXQgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBfY29uZmlndXJhdGlvbi5pbml0aWFsTG9jYXRpb24gPSB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBpbnN0YW5jZVxuICAgKi9cbiAgdGhpcy4kZ2V0ID0gWyckcm9vdFNjb3BlJywgJyRsb2NhdGlvbicsICckcScsIGZ1bmN0aW9uIFN0YXRlUm91dGVyRmFjdG9yeSgkcm9vdFNjb3BlLCAkbG9jYXRpb24sICRxKSB7XG5cbiAgICAvLyBDdXJyZW50IHN0YXRlXG4gICAgdmFyIF9jdXJyZW50O1xuXG4gICAgdmFyIF9vcHRpb25zO1xuICAgIHZhciBfaW5pdGFsTG9jYXRpb247XG4gICAgdmFyIF9oaXN0b3J5ID0gW107XG4gICAgdmFyIF9pc0luaXQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIG1ldGhvZCB0byBhZGQgaGlzdG9yeSBhbmQgY29ycmVjdCBsZW5ndGhcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAgICovXG4gICAgdmFyIF9wdXNoSGlzdG9yeSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIC8vIEtlZXAgdGhlIGxhc3QgbiBzdGF0ZXMgKGUuZy4gLSBkZWZhdWx0cyA1KVxuICAgICAgdmFyIGhpc3RvcnlMZW5ndGggPSBfb3B0aW9ucy5oaXN0b3J5TGVuZ3RoIHx8IDU7XG5cbiAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgX2hpc3RvcnkucHVzaChkYXRhKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgICAgaWYoX2hpc3RvcnkubGVuZ3RoID4gaGlzdG9yeUxlbmd0aCkge1xuICAgICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gaGlzdG9yeUxlbmd0aCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIG1ldGhvZCB0byBjaGFuZ2UgdG8gc3RhdGUuICBQYXJhbWV0ZXJzIGluIGBwYXJhbXNgIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBzdGF0ZS1ub3RhdGlvbiBgbmFtZWAgZXhwcmVzc2lvbi4gIFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgICAgICAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvbiBpbmNsdWRpbmcgb3B0aW9uYWwgcGFyYW1ldGVyc1xuICAgICAqIEBwYXJhbSAge09iamVjdH0gIHBhcmFtcyAgICAgICAgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBzdGF0ZSBjaGFuZ2Ugb2NjdXJzXG4gICAgICovXG4gICAgdmFyIF9jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgICAgbmFtZSA9IG5hbWVFeHByLm5hbWU7XG4gICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgIGxvY2Fsczoge31cbiAgICAgIH07XG5cbiAgICAgIC8vIENvbXBpbGUgZXhlY3V0aW9uIHBoYXNlc1xuICAgICAgdmFyIHF1ZXVlID0gUXVldWVIYW5kbGVyKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShfZ2V0U3RhdGUobmFtZSkpO1xuICAgICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgICBpZihuZXh0U3RhdGUpIHtcbiAgICAgICAgLy8gU2V0IGxvY2Fsc1xuICAgICAgICBuZXh0U3RhdGUubG9jYWxzID0gcmVxdWVzdC5sb2NhbHM7XG4gICAgICAgIFxuICAgICAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgICAgICBuZXh0U3RhdGUucGFyYW1zID0gYW5ndWxhci5leHRlbmQobmV4dFN0YXRlLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcbiAgICAgIH1cblxuICAgICAgLy8gRG9lcyBub3QgZXhpc3RcbiAgICAgIGlmKG5leHRTdGF0ZSA9PT0gbnVsbCkge1xuICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuXG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckc3RhdGVDaGFuZ2VFcnJvck5vdEZvdW5kJywgZXJyb3IsIHJlcXVlc3QpO1xuICAgICAgICAgIG5leHQoZXJyb3IpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICAgIH0gZWxzZSBpZihfY29tcGFyZVN0YXRlcyhwcmV2U3RhdGUsIG5leHRTdGF0ZSkpIHtcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgIC8vIFZhbGlkIHN0YXRlIGV4aXN0c1xuICAgICAgfSBlbHNlIHtcblxuICAgICAgICAvLyBNYWtlIHN0YXRlIGNoYW5nZVxuICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgIGlmKHByZXZTdGF0ZSkgX3B1c2hIaXN0b3J5KHByZXZTdGF0ZSk7XG4gICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgXG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUJlZ2luJywgcmVxdWVzdCk7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBZGQgbWlkZGxld2FyZVxuICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG5cbiAgICAgICAgLy8gUHJvY2VzcyBlbmRlZFxuICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHN0YXRlQ2hhbmdlRW5kJywgcmVxdWVzdCk7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gUnVuXG4gICAgICBxdWV1ZS5leGVjdXRlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUVycm9yJywgZXJyLCByZXF1ZXN0KTtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVxdWVzdCk7XG4gICAgICAgIH1cblxuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUNoYW5nZUNvbXBsZXRlJywgcmVxdWVzdCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIC8vIEluc3RhbmNlXG4gICAgdmFyIF9pbnN0O1xuICAgIF9pbnN0ID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBvcHRpb25zXG4gICAgICAgKlxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvbmZpZ3VyZWQgb3B0aW9uc1xuICAgICAgICovXG4gICAgICBvcHRpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gSGFzbid0IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgaWYoIV9vcHRpb25zKSB7XG4gICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9vcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIHN0YXRlOiBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgICAgICBpZighc3RhdGUpIHtcbiAgICAgICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBtaWRkbGV3YXJlLCBleGVjdXRpbmcgbmV4dChlcnIpO1xuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgaGFuZGxlciBBIGNhbGxiYWNrLCBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHVzZTogZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBfbGF5ZXJMaXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHBlcmZvcm0gaW5pdGlhbGl6YXRpb25cbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkcmVhZHk6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZighX2lzSW5pdCkge1xuICAgICAgICAgIF9pc0luaXQgPSB0cnVlO1xuXG4gICAgICAgICAgLy8gQ29uZmlndXJhdGlvblxuICAgICAgICAgIGlmKCFfb3B0aW9ucykge1xuICAgICAgICAgICAgX29wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX2NvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICBpZihfb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaW5pdGlhbExvY2F0aW9uJykpIHtcbiAgICAgICAgICAgIF9pbml0YWxMb2NhdGlvbiA9IGFuZ3VsYXIuY29weShfb3B0aW9ucy5pbml0aWFsTG9jYXRpb24pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciByZWFkeURlZmVycmVkID0gbnVsbDtcblxuICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICBpZigkbG9jYXRpb24udXJsKCkgIT09ICcnKSB7XG4gICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2luc3QuJGxvY2F0aW9uKCRsb2NhdGlvbi51cmwoKSk7XG5cbiAgICAgICAgICAvLyBJbml0aWFsaXplIHdpdGggc3RhdGVcbiAgICAgICAgICB9IGVsc2UgaWYoX2luaXRhbExvY2F0aW9uKSB7XG4gICAgICAgICAgICByZWFkeURlZmVycmVkID0gX2NoYW5nZVN0YXRlKF9pbml0YWxMb2NhdGlvbi5uYW1lLCBfaW5pdGFsTG9jYXRpb24ucGFyYW1zKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkcS53aGVuKHJlYWR5RGVmZXJyZWQpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyRzdGF0ZUluaXQnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAgICBwYXJzZTogX3BhcnNlTmFtZSxcblxuICAgICAgLy8gUmV0cmlldmUgZGVmaW5pdGlvbiBvZiBzdGF0ZXNcbiAgICAgIGxpYnJhcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX3N0YXRlTGlicmFyeTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFZhbGlkYXRpb25cbiAgICAgIHZhbGlkYXRlOiB7XG4gICAgICAgIG5hbWU6IF92YWxpZGF0ZVN0YXRlTmFtZSxcbiAgICAgICAgcXVlcnk6IF92YWxpZGF0ZVN0YXRlUXVlcnlcbiAgICAgIH0sXG5cbiAgICAgIC8vIFJldHJpZXZlIGhpc3RvcnlcbiAgICAgIGhpc3Rvcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gX2hpc3Rvcnk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENoYW5nZSBzdGF0ZSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICBjaGFuZ2U6IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgICAgICByZXR1cm4gX2NoYW5nZVN0YXRlKG5hbWUsIHBhcmFtcyk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBjaGFuZ2Ugc3RhdGUgYmFzZWQgb24gJGxvY2F0aW9uLnVybCgpLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uIHVzaW5nIGludGVybmFsIG1ldGhvZHMsIHF1aWV0IGZhbGxiYWNrLiAgXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICB1cmwgICAgICAgIEEgdXJsIG1hdGNoaW5nIGRlZmluZCBzdGF0ZXNcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSAgICBbY2FsbGJhY2tdIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRsb2NhdGlvbjogZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHZhciBkYXRhID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICAgICAgaWYoc3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtcyBmcm9tIHVybFxuICAgICAgICAgICAgcmV0dXJuIF9jaGFuZ2VTdGF0ZShzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICRxLnJlamVjdChuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIGxvY2F0aW9uIGluIGxpYnJhcnknKSk7XG4gICAgICB9LFxuICAgICAgXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGN1cnJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7TWl4ZWR9ICAgcXVlcnkgIEEgc3RyaW5nIHVzaW5nIHN0YXRlIG5vdGF0aW9uIG9yIGEgUmVnRXhwXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGFjdGl2ZTogZnVuY3Rpb24ocXVlcnksIHBhcmFtcykge1xuICAgICAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgLy8gTm8gc3RhdGVcbiAgICAgICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICAgICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAgICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICAgICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X10qJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gX2luc3Q7XG4gIH1dO1xuXG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyRsb2NhdGlvbicsICckcm9vdFNjb3BlJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24sICRyb290U2NvcGUpIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYoY3VycmVudCAmJiBjdXJyZW50LnVybCkge1xuICAgICAgdmFyIHBhdGg7XG4gICAgICBwYXRoID0gY3VycmVudC51cmw7XG5cbiAgICAgIC8vIEFkZCBwYXJhbWV0ZXJzIG9yIHVzZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAgICAgIHZhciBwYXJhbXMgPSBjdXJyZW50LnBhcmFtcyB8fCB7fTtcbiAgICAgIHZhciBxdWVyeSA9IHt9O1xuICAgICAgZm9yKHZhciBuYW1lIGluIHBhcmFtcykge1xuICAgICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKCc6JytuYW1lLCAnZycpO1xuICAgICAgICBpZihwYXRoLm1hdGNoKHJlKSkge1xuICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UocmUsIHBhcmFtc1tuYW1lXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcXVlcnlbbmFtZV0gPSBwYXJhbXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgJGxvY2F0aW9uLnBhdGgocGF0aCk7XG4gICAgICAkbG9jYXRpb24uc2VhcmNoKHF1ZXJ5KTtcbiAgICAgIFxuICAgICAgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgX3NlbGYubG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgJHN0YXRlLiRsb2NhdGlvbihfdXJsKTtcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvY2F0aW9uU3RhdGVVcGRhdGUnKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgX3VwZGF0ZSgpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBhcnNlIE9iamVjdCBsaXRlcmFsIG5hbWUtdmFsdWUgcGFpcnNcbnZhciByZVBhcnNlT2JqZWN0TGl0ZXJhbCA9IC8oWyx7XVxccyooKFwifCcpKC4qPylcXDN8XFx3Kil8KDpcXHMqKFsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT98dHJ1ZXxmYWxzZXxudWxsfChcInwnKSguKj8pXFw3fFxcW1teXFxdXSpcXF0pKSkvZztcblxuLy8gTWF0Y2ggU3RyaW5nc1xudmFyIHJlU3RyaW5nID0gL14oXCJ8JykoLio/KVxcMSQvO1xuXG4vLyBUT0RPIEFkZCBlc2NhcGVkIHN0cmluZyBxdW90ZXMgXFwnIGFuZCBcXFwiIHRvIHN0cmluZyBtYXRjaGVyXG5cbi8vIE1hdGNoIE51bWJlciAoaW50L2Zsb2F0L2V4cG9uZW50aWFsKVxudmFyIHJlTnVtYmVyID0gL15bKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/JC87XG5cbi8qKlxuICogUGFyc2Ugc3RyaW5nIHZhbHVlIGludG8gQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGwuXG4gKlxuICogU3RyaW5ncyBhcmUgc3Vycm91bmRlZCBieSBhIHBhaXIgb2YgbWF0Y2hpbmcgcXVvdGVzXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdmFsdWUgQSBTdHJpbmcgdmFsdWUgdG8gcGFyc2VcbiAqIEByZXR1cm4ge01peGVkfSAgICAgICAgQSBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbFxuICovXG52YXIgX3Jlc29sdmVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cbiAgLy8gQm9vbGVhbjogdHJ1ZVxuICBpZih2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgLy8gQm9vbGVhbjogZmFsc2VcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE51bGxcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnbnVsbCcpIHtcbiAgICByZXR1cm4gbnVsbDtcblxuICAvLyBTdHJpbmdcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlU3RyaW5nKSkge1xuICAgIHJldHVybiB2YWx1ZS5zdWJzdHIoMSwgdmFsdWUubGVuZ3RoLTIpO1xuXG4gIC8vIE51bWJlclxuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVOdW1iZXIpKSB7XG4gICAgcmV0dXJuICt2YWx1ZTtcblxuICAvLyBOYU5cbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnTmFOJykge1xuICAgIHJldHVybiBOYU47XG5cbiAgLy8gVE9ETyBhZGQgbWF0Y2hpbmcgd2l0aCBBcnJheXMgYW5kIHBhcnNlXG4gIFxuICB9XG5cbiAgLy8gVW5hYmxlIHRvIHJlc29sdmVcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gRmluZCB2YWx1ZXMgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbnZhciBfbGlzdGlmeSA9IGZ1bmN0aW9uKHN0cikge1xuXG4gIC8vIFRyaW1cbiAgc3RyID0gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuXG4gIGlmKHN0ci5tYXRjaCgvXlxccyp7Lip9XFxzKiQvKSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVycyBleHBlY3RzIGFuIE9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHNhbml0aXplTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9eW1xceyxdP1xccypbXCInXT8vLCAnJykucmVwbGFjZSgvW1wiJ10/XFxzKiQvLCAnJyk7XG4gIH07XG5cbiAgdmFyIHNhbml0aXplVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzdHIgPSB2YWx1ZS5yZXBsYWNlKC9eKDopP1xccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgcmV0dXJuIF9yZXNvbHZlVmFsdWUoc3RyKTtcbiAgfTtcblxuICByZXR1cm4gc3RyLm1hdGNoKHJlUGFyc2VPYmplY3RMaXRlcmFsKS5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIHJldHVybiBpJTIgPT09IDAgPyBzYW5pdGl6ZU5hbWUoaXRlbSkgOiBzYW5pdGl6ZVZhbHVlKGl0ZW0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFyYW1zIE9iamVjdCBmcm9tIHN0cmluZ1xuICogXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5naWZpZWQgdmVyc2lvbiBvZiBPYmplY3QgbGl0ZXJhbFxuICovXG52YXIgUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHN0cikge1xuICBzdHIgPSBzdHIgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgX2xpc3RpZnkoc3RyKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICBpZihpJTIgPT09IDApIHtcbiAgICAgIF9zZWxmW2l0ZW1dID0gbGlzdFtpKzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYXJhbWV0ZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5yZXNvbHZlVmFsdWUgPSBfcmVzb2x2ZVZhbHVlO1xubW9kdWxlLmV4cG9ydHMubGlzdGlmeSA9IF9saXN0aWZ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEV4ZWN1dGUgYSBzZXJpZXMgb2YgZnVuY3Rpb25zOyB1c2VkIGluIHRhbmRlbSB3aXRoIG1pZGRsZXdhcmVcbiAqL1xudmFyIFF1ZXVlSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgX2xpc3QgPSBbXTtcbiAgdmFyIF9kYXRhID0gbnVsbDtcblxuICB2YXIgX3NlbGYgPSB7XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBoYW5kbGVyXG4gICAgICogXG4gICAgICogQHBhcmFtIHtNaXhlZH0gICAgICAgICBoYW5kbGVyIEEgRnVuY3Rpb24gb3IgYW4gQXJyYXkgb2YgRnVuY3Rpb25zIHRvIGFkZCB0byB0aGUgcXVldWVcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZUhhbmRsZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgKi9cbiAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgIGlmKGhhbmRsZXIgJiYgaGFuZGxlci5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfbGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIERhdGEgb2JqZWN0XG4gICAgICogXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgZGF0YSBvYmplY3QgbWFkZSBhdmFpbGFibGUgdG8gZWFjaCBoYW5kbGVyXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgZGF0YTogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgX2RhdGEgPSBkYXRhO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEJlZ2luIGV4ZWN1dGlvbiBhbmQgdHJpZ2dlciBjYWxsYmFjayBhdCB0aGUgZW5kXG4gICAgICogXG4gICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZUhhbmRsZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgKi9cbiAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgdmFyIG5leHRIYW5kbGVyO1xuICAgICAgdmFyIGV4ZWN1dGlvbkxpc3QgPSBfbGlzdC5zbGljZSgwKS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIChhLnByaW90aXR5IHx8IDEpIDwgKGIucHJpb3RpdHkgfHwgMSk7XG4gICAgICB9KTtcblxuICAgICAgbmV4dEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBleGVjdXRpb25MaXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgLy8gQ29tcGxldGVcbiAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsKTtcblxuICAgICAgICAvLyBOZXh0IGhhbmRsZXJcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgLy8gRXJyb3JcbiAgICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICAvLyBDb250aW51ZVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICB9XG5cbiAgfTtcbiAgXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVIYW5kbGVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybCA9IHJlcXVpcmUoJy4vdXJsJyk7XG5cbi8qKlxuICogQ29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVXJsRGljdGlvbmFyeSgpIHtcbiAgdGhpcy5fcGF0dGVybnMgPSBbXTtcbiAgdGhpcy5fcmVmcyA9IFtdO1xuICB0aGlzLl9wYXJhbXMgPSBbXTtcbn1cblxuLyoqXG4gKiBBc3NvY2lhdGUgYSBVUkwgcGF0dGVybiB3aXRoIGEgcmVmZXJlbmNlXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gcGF0dGVybiBBIFVSTCBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHJlZiAgICAgQSBkYXRhIE9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihwYXR0ZXJuLCByZWYpIHtcbiAgcGF0dGVybiA9IHBhdHRlcm4gfHwgJyc7XG4gIHZhciBfc2VsZiA9IHRoaXM7XG4gIHZhciBpID0gdGhpcy5fcGF0dGVybnMubGVuZ3RoO1xuXG4gIHZhciBwYXRoQ2hhaW47XG4gIHZhciBwYXJhbXMgPSB7fTtcblxuICBpZihwYXR0ZXJuLmluZGV4T2YoJz8nKSA9PT0gLTEpIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG5cbiAgfSBlbHNlIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG4gIH1cblxuICAvLyBTdGFydFxuICB2YXIgc2VhcmNoRXhwciA9ICdeJztcblxuICAvLyBJdGVtc1xuICAocGF0aENoYWluLmZvckVhY2goZnVuY3Rpb24oY2h1bmssIGkpIHtcbiAgICBpZihpIT09MCkge1xuICAgICAgc2VhcmNoRXhwciArPSAnXFxcXC8nO1xuICAgIH1cblxuICAgIGlmKGNodW5rWzBdID09PSAnOicpIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1teXFxcXC8/XSonO1xuICAgICAgcGFyYW1zW2NodW5rLnN1YnN0cmluZygxKV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gY2h1bms7XG4gICAgfVxuICB9KSk7XG5cbiAgLy8gRW5kXG4gIHNlYXJjaEV4cHIgKz0gJ1tcXFxcL10/JCc7XG5cbiAgdGhpcy5fcGF0dGVybnNbaV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuICB0aGlzLl9yZWZzW2ldID0gcmVmO1xuICB0aGlzLl9wYXJhbXNbaV0gPSBwYXJhbXM7XG59O1xuXG4vKipcbiAqIEZpbmQgYSByZWZlcmVuY2UgYWNjb3JkaW5nIHRvIGEgVVJMIHBhdHRlcm4gYW5kIHJldHJpZXZlIHBhcmFtcyBkZWZpbmVkIGluIFVSTFxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgIEEgVVJMIHRvIHRlc3QgZm9yXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRlZmF1bHRzIEEgZGF0YSBPYmplY3Qgb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIEEgcmVmZXJlbmNlIHRvIGEgc3RvcmVkIG9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbih1cmwsIGRlZmF1bHRzKSB7XG4gIHVybCA9IHVybCB8fCAnJztcbiAgdmFyIHAgPSBVcmwodXJsKS5wYXRoKCk7XG4gIHZhciBxID0gVXJsKHVybCkucXVlcnlwYXJhbXMoKTtcblxuICB2YXIgX3NlbGYgPSB0aGlzO1xuXG4gIC8vIENoZWNrIGRpY3Rpb25hcnlcbiAgdmFyIF9maW5kUGF0dGVybiA9IGZ1bmN0aW9uKGNoZWNrKSB7XG4gICAgY2hlY2sgPSBjaGVjayB8fCAnJztcbiAgICBmb3IodmFyIGk9X3NlbGYuX3BhdHRlcm5zLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKGNoZWNrLm1hdGNoKF9zZWxmLl9wYXR0ZXJuc1tpXSkgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICB2YXIgaSA9IF9maW5kUGF0dGVybihwKTtcbiAgXG4gIC8vIE1hdGNoaW5nIHBhdHRlcm4gZm91bmRcbiAgaWYoaSAhPT0gLTEpIHtcblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBwYXR0ZXJuIG1hdGNoXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xuICAgIGZvcih2YXIgbiBpbiB0aGlzLl9wYXJhbXNbaV0pIHtcbiAgICAgIHZhciBwYXJhbVBhcnNlciA9IHRoaXMuX3BhcmFtc1tpXVtuXTtcbiAgICAgIHZhciB1cmxNYXRjaCA9ICh1cmwubWF0Y2gocGFyYW1QYXJzZXIpIHx8IFtdKS5wb3AoKSB8fCAnJztcbiAgICAgIHZhciB2YXJNYXRjaCA9IHVybE1hdGNoLnNwbGl0KCcvJykucG9wKCk7XG4gICAgICBwYXJhbXNbbl0gPSB2YXJNYXRjaDtcbiAgICB9XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcXVlcnlzdHJpbmcgbWF0Y2hcbiAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChxLCBwYXJhbXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgcmVmOiB0aGlzLl9yZWZzW2ldLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuXG4gIC8vIE5vdCBpbiBkaWN0aW9uYXJ5XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsRGljdGlvbmFyeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVXJsKHVybCkge1xuICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwYXRoIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHBhdGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gdXJsIDogdXJsLnN1YnN0cmluZygwLCB1cmwuaW5kZXhPZignPycpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXN0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnJyA6IHVybC5zdWJzdHJpbmcodXJsLmluZGV4T2YoJz8nKSsxKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTCBwYXJhbWV0ZXJzIGFzIGEgaGFzaFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXBhcmFtczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGFpcnMgPSBfc2VsZi5xdWVyeXN0cmluZygpLnNwbGl0KCcmJyk7XG4gICAgICB2YXIgcGFyYW1zID0ge307XG5cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBhaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHBhaXJzW2ldID09PSAnJykgY29udGludWU7XG4gICAgICAgIHZhciBuYW1lVmFsdWUgPSBwYWlyc1tpXS5zcGxpdCgnPScpO1xuICAgICAgICBwYXJhbXNbbmFtZVZhbHVlWzBdXSA9ICh0eXBlb2YgbmFtZVZhbHVlWzFdID09PSAndW5kZWZpbmVkJyB8fCBuYW1lVmFsdWVbMV0gPT09ICcnKSA/IHRydWUgOiBuYW1lVmFsdWVbMV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBfc2VsZjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmw7XG4iXX0=
