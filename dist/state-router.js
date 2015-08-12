(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
'use strict';

var process = require('../utils/process');

module.exports = ['$state', '$rootScope', function ($state, $rootScope) {
  $state.on('change:complete', function() {
    $rootScope.$apply();
  });

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

},{"../utils/process":8}],3:[function(require,module,exports){
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

},{"./directives/sref":2,"./services/resolution":4,"./services/state-router":5,"./services/url-manager":6}],4:[function(require,module,exports){
'use strict';

module.exports = ['$q', '$injector', '$state', '$log', function($q, $injector, $state, $log) {

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

},{}],5:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var process = require('../utils/process');
var UrlDictionary = require('../utils/url-dictionary');
var Parameters = require('../utils/parameters');
var QueueHandler = require('../utils/queue-handler');

module.exports = function StateRouterProvider() {
  // Instance
  var _provider = this;

  // Current state
  var _current;

  // Options
  var _options = {
    historyLength: 5
  };

  // Library
  var _library = {};
  var _cache = {};

  // URL to state dictionary
  var _urlDictionary = new UrlDictionary();

  // Middleware layers
  var _layerList = [];

  // Delegated EventEmitter
  var _dispatcher = new EventEmitter();

  // Inital location
  var _initialLocation;

  // Wrap provider methods
  [
    'addListener', 
    'on', 
    'once', 
    'removeListener', 
    'removeAllListeners', 
    'listeners', 
    'emit', 
  ].forEach(function(method) {
    _provider[method] = angular.bind(_dispatcher, _dispatcher[method]);
  });

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
   * @param  {String} name   A unique identifier for the state; using dot-notation
   * @return {Boolean}       True if name is valid, false if not
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
   * @param  {String} query  A query for the state; using dot-notation
   * @return {Boolean}       True if name is valid, false if not
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
    return angular.equals(a, b);
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
    } else if(_cache[name]) {
      return _cache[name];
    }

    var nameChain = _getNameChain(name);

    var stateChain = nameChain
      .map(function(pname) {
        return _library[pname];
      })
      .filter(function(parent) {
        return parent !== null;
      });

    // Walk up checking inheritance
    for(var i=stateChain.length-1; i>=0; i--) {
      if(stateChain[i]) {
        state = angular.extend(angular.copy(stateChain[i]), state || {});
      }

      if(state && !state.inherit) break;
    }

    // Store in cache
    _cache[name] = state;

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
    _library[name] = state;

    // Reset cache
    _cache = {};

    // URL mapping
    if(state.url) {
      _urlDictionary.add(state.url, state);
    }

    return data;
  };

  /**
   * Set configuration data parameters for StateRouter
   *
   * @param  {Object}         options A data Object
   * @return {$stateProvider}         Itself; chainable
   */
  this.options = function(options) {
    options = options || {};

    if(options.hasOwnProperty('historyLength')) {
      _options.historyLength = options.historyLength;
    }

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
    _initialLocation = {
      name: name,
      params: params
    };
    return _provider;
  };

  /**
   * Get instance
   */
  this.$get = ['$location', '$q', '$injector', function StateRouterFactory($location) {

    var _instOptions;
    var _instInitialLocation;
    var _history = [];
    var _isInit = false;

    /**
     * Internal method to add history and correct length
     * 
     * @param  {Object} data An Object
     */
    var _pushHistory = function(data) {
      // Keep the last n states (e.g. - defaults 5)
      var historyLength = _instOptions.historyLength || 5;

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
     * @param  {String}   name          A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}   params        A data object of params
     * @param  {Function} [callback]    A callback, function(err)
     */
    var _changeState = function(name, params, callback) {
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

          _dispatcher.emit('error:notfound', error, request);
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
          _dispatcher.emit('change:begin', request);
          next();
        });

        // Add middleware
        queue.add(_layerList);

        // Process ended
        queue.add(function(data, next) {
          _dispatcher.emit('change:end', request);
          next();
        });
      }

      // Run
      queue.execute(function(err) {
        if(err) {
          _dispatcher.emit('error', err, request);
        }

        _dispatcher.emit('change:complete', err, request);

        if(callback) {
          callback(err);
        }
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
        if(!_instOptions) {
          _instOptions = angular.copy(_options);
        }

        return _instOptions;
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
          _instOptions = angular.copy(_options);
          if(_initialLocation) _instInitialLocation = angular.copy(_initialLocation);

          console.log('$ready');

          // Initial location
          if($location.url() !== '') {
            _inst.$location($location.url(), function() {
              _dispatcher.emit('init');
            });

          // Initialize with state
          } else if(_instInitialLocation) {
            _changeState(_instInitialLocation.name, _instInitialLocation.params, function() {
              _dispatcher.emit('init');
            });

          // Initialize only
          } else {
            _dispatcher.emit('init');
          }
        }

        return _inst;
      },

      // Parse state notation name-params.  
      parse: _parseName,

      // Retrieve definition of states
      library: function() {
        return _library;
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
        process.nextTick(angular.bind(null, _changeState, name, params));
        return _inst;
      },

      /**
       * Internal method to change state based on $location.url(), asynchronous operation using internal methods, quiet fallback.  
       * 
       * @param  {String}      url        A url matching defind states
       * @param  {Function}    [callback] A callback, function(err)
       * @return {$state}                 Itself; chainable
       */
      $location: function(url, callback) {
        var data = _urlDictionary.lookup(url);

        if(data) {
          var state = data.ref;

          if(state) {
            // Parse params from url
            process.nextTick(angular.bind(null, _changeState, state.name, data.params, callback));
          }
        }

        return _inst;
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

    // Wrap instance methods
    [
      'addListener', 
      'on', 
      'once', 
      'removeListener', 
      'removeAllListeners', 
      'listeners', 
      'emit', 
    ].forEach(function(method) {
      _inst[method] = angular.bind(_dispatcher, _dispatcher[method]);
    });

    return _inst;
  }];

};

},{"../utils/parameters":7,"../utils/process":8,"../utils/queue-handler":9,"../utils/url-dictionary":10,"events":1}],6:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var UrlDictionary = require('../utils/url-dictionary');

module.exports = ['$state', '$location', function($state, $location) {
  var _url = $location.url();

  // Instance of EventEmitter
  var _self = new EventEmitter();

  /**
   * Detect URL change and dispatch state change
   */
  var _detectChange = function() {
    var lastUrl = _url;
    var nextUrl = $location.url();

    if(nextUrl !== lastUrl) {
      _url = nextUrl;

      $state.$location(_url);
      _self.emit('update:location');
    }
  };

  /**
   * Update URL based on state
   */
  var _update = function() {
    var current = $state.current();

    if(current && current.url) {
      _url = current.url;

      // Add parameters or use default parameters
      var params = current.params || {};
      for(var name in params) {
        _url = _url.replace(new RegExp(':'+name, 'g'), params[name]);
      }

      $location.url(_url);
    }

    _self.emit('update');
  };

  /**
   * Update url based on state
   */
  _self.update = function() {
    _update();
  };

  /**
   * Location was updated; force update detection
   */
  _self.location = function() {
    _detectChange(arguments);
  };

  // Register middleware layer
  $state.$use(function(request, next) {
    _update();
    next();
  });

  return _self;
}];

},{"../utils/url-dictionary":10,"events":1}],7:[function(require,module,exports){
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

/* global window:false */
/* global process:false */
/* global setImmediate:false */
/* global setTimeout:false */

var _process = {
  nextTick: function(callback) {
    setTimeout(callback, 0);
  }
};

module.exports = _process;

},{}],9:[function(require,module,exports){
'use strict';

var process = require('../utils/process');

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

},{"../utils/process":8}],10:[function(require,module,exports){
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

},{"./url":11}],11:[function(require,module,exports){
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

},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL2RpcmVjdGl2ZXMvc3JlZi5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL2luZGV4LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvcmVzb2x1dGlvbi5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcGFyYW1ldGVycy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3Byb2Nlc3MuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9xdWV1ZS1oYW5kbGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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LFNBQVMsQ0FBQyxJQUFJLE1BQU0sSUFBSSxVQUFVLEdBQUcsSUFBSSxRQUFROzs7Ozs7OztJQVF0RSxhQUFhLFdBQVc7TUFDdEIsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxRQUFRLEtBQUs7Ozs7Ozs7O0lBUXZFLGFBQWEsV0FBVztNQUN0QixJQUFJLFFBQVEsTUFBTSxjQUFjLE1BQU07TUFDdEMsSUFBSSxTQUFTOztNQUViLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLFFBQVEsS0FBSztRQUNoQyxHQUFHLE1BQU0sT0FBTyxJQUFJO1FBQ3BCLElBQUksWUFBWSxNQUFNLEdBQUcsTUFBTTtRQUMvQixPQUFPLFVBQVUsTUFBTSxDQUFDLE9BQU8sVUFBVSxPQUFPLGVBQWUsVUFBVSxPQUFPLE1BQU0sT0FBTyxVQUFVOzs7TUFHekcsT0FBTzs7OztFQUlYLE9BQU87OztBQUdULE9BQU8sVUFBVTtBQUNqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBwcm9jZXNzID0gcmVxdWlyZSgnLi4vdXRpbHMvcHJvY2VzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbiAoJHN0YXRlLCAkcm9vdFNjb3BlKSB7XG4gICRzdGF0ZS5vbignY2hhbmdlOmNvbXBsZXRlJywgZnVuY3Rpb24oKSB7XG4gICAgJHJvb3RTY29wZS4kYXBwbHkoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZS5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gSW5zdGFudGlhdGUgbW9kdWxlXG5hbmd1bGFyLm1vZHVsZSgnYW5ndWxhci1zdGF0ZS1yb3V0ZXInLCBbXSlcblxuICAucHJvdmlkZXIoJyRzdGF0ZScsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5mYWN0b3J5KCckcmVzb2x1dGlvbicsIHJlcXVpcmUoJy4vc2VydmljZXMvcmVzb2x1dGlvbicpKVxuXG4gIC5ydW4oWyckcm9vdFNjb3BlJywgJyRzdGF0ZScsICckdXJsTWFuYWdlcicsICckcmVzb2x1dGlvbicsIGZ1bmN0aW9uKCRyb290U2NvcGUsICRzdGF0ZSwgJHVybE1hbmFnZXIsICRyZXNvbHV0aW9uKSB7XG4gICAgLy8gVXBkYXRlIGxvY2F0aW9uIGNoYW5nZXNcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWxpemVcbiAgICAkc3RhdGUuJHJlYWR5KCk7XG4gIH1dKVxuXG4gIC5kaXJlY3RpdmUoJ3NyZWYnLCByZXF1aXJlKCcuL2RpcmVjdGl2ZXMvc3JlZicpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRxJywgJyRpbmplY3RvcicsICckc3RhdGUnLCAnJGxvZycsIGZ1bmN0aW9uKCRxLCAkaW5qZWN0b3IsICRzdGF0ZSwgJGxvZykge1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICByZXNvbHZlIEEgaGFzaCBPYmplY3Qgb2YgaXRlbXMgdG8gcmVzb2x2ZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0ZW1wbGF0ZXMgcmV0aXJldmVkXG4gICAqL1xuICB2YXIgX3Jlc29sdmUgPSBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgdmFyIHJlc29sdmVzUHJvbWlzZXMgPSB7fTtcblxuICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvbHZlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGFuZ3VsYXIuaXNTdHJpbmcodmFsdWUpID8gJGluamVjdG9yLmdldCh2YWx1ZSkgOiAkaW5qZWN0b3IuaW52b2tlKHZhbHVlLCBudWxsLCBudWxsLCBrZXkpO1xuICAgICAgcmVzb2x2ZXNQcm9taXNlc1trZXldID0gJHEud2hlbihyZXNvbHV0aW9uKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAkcS5hbGwocmVzb2x2ZXNQcm9taXNlcyk7XG4gIH07XG4gIF9zZWxmLnJlc29sdmUgPSBfcmVzb2x2ZTtcblxuICAvKipcbiAgICogTWlkZGxld2FyZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlcXVlc3QgQSBkYXRhIE9iamVjdFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gbmV4dCAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX3JlZ2lzdGVyID0gZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIHZhciBjdXJyZW50ID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKCFjdXJyZW50KSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlKGN1cnJlbnQucmVzb2x2ZSB8fCB7fSkudGhlbihmdW5jdGlvbihsb2NhbHMpIHtcbiAgICAgIGFuZ3VsYXIuZXh0ZW5kKHJlcXVlc3QubG9jYWxzLCBsb2NhbHMpO1xuICAgICAgbmV4dCgpO1xuXG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBuZXh0KG5ldyBFcnJvcignRXJyb3IgcmVzb2x2aW5nIHN0YXRlJykpO1xuICAgIH0pO1xuICB9O1xuICBfcmVnaXN0ZXIucHJpb3JpdHkgPSAxMDA7XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGUuJHVzZShfcmVnaXN0ZXIpO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xudmFyIHByb2Nlc3MgPSByZXF1aXJlKCcuLi91dGlscy9wcm9jZXNzJyk7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcbnZhciBRdWV1ZUhhbmRsZXIgPSByZXF1aXJlKCcuLi91dGlscy9xdWV1ZS1oYW5kbGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gU3RhdGVSb3V0ZXJQcm92aWRlcigpIHtcbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9wcm92aWRlciA9IHRoaXM7XG5cbiAgLy8gQ3VycmVudCBzdGF0ZVxuICB2YXIgX2N1cnJlbnQ7XG5cbiAgLy8gT3B0aW9uc1xuICB2YXIgX29wdGlvbnMgPSB7XG4gICAgaGlzdG9yeUxlbmd0aDogNVxuICB9O1xuXG4gIC8vIExpYnJhcnlcbiAgdmFyIF9saWJyYXJ5ID0ge307XG4gIHZhciBfY2FjaGUgPSB7fTtcblxuICAvLyBVUkwgdG8gc3RhdGUgZGljdGlvbmFyeVxuICB2YXIgX3VybERpY3Rpb25hcnkgPSBuZXcgVXJsRGljdGlvbmFyeSgpO1xuXG4gIC8vIE1pZGRsZXdhcmUgbGF5ZXJzXG4gIHZhciBfbGF5ZXJMaXN0ID0gW107XG5cbiAgLy8gRGVsZWdhdGVkIEV2ZW50RW1pdHRlclxuICB2YXIgX2Rpc3BhdGNoZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbiAgLy8gSW5pdGFsIGxvY2F0aW9uXG4gIHZhciBfaW5pdGlhbExvY2F0aW9uO1xuXG4gIC8vIFdyYXAgcHJvdmlkZXIgbWV0aG9kc1xuICBbXG4gICAgJ2FkZExpc3RlbmVyJywgXG4gICAgJ29uJywgXG4gICAgJ29uY2UnLCBcbiAgICAncmVtb3ZlTGlzdGVuZXInLCBcbiAgICAncmVtb3ZlQWxsTGlzdGVuZXJzJywgXG4gICAgJ2xpc3RlbmVycycsIFxuICAgICdlbWl0JywgXG4gIF0uZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBfcHJvdmlkZXJbbWV0aG9kXSA9IGFuZ3VsYXIuYmluZChfZGlzcGF0Y2hlciwgX2Rpc3BhdGNoZXJbbWV0aG9kXSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgKiBcbiAgICogQXNzdW1lIGFsbCBwYXJhbWV0ZXIgdmFsdWVzIGFyZSBzdHJpbmdzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVQYXJhbXMgQSBuYW1lLXBhcmFtcyBzdHJpbmdcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIHZhciBfcGFyc2VOYW1lID0gZnVuY3Rpb24obmFtZVBhcmFtcykge1xuICAgIGlmKG5hbWVQYXJhbXMgJiYgbmFtZVBhcmFtcy5tYXRjaCgvXlthLXpBLVowLTlfXFwuXSpcXCguKlxcKSQvKSkge1xuICAgICAgdmFyIG5wYXJ0ID0gbmFtZVBhcmFtcy5zdWJzdHJpbmcoMCwgbmFtZVBhcmFtcy5pbmRleE9mKCcoJykpO1xuICAgICAgdmFyIHBwYXJ0ID0gUGFyYW1ldGVycyggbmFtZVBhcmFtcy5zdWJzdHJpbmcobmFtZVBhcmFtcy5pbmRleE9mKCcoJykrMSwgbmFtZVBhcmFtcy5sYXN0SW5kZXhPZignKScpKSApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBucGFydCxcbiAgICAgICAgcGFyYW1zOiBwcGFydFxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuYW1lUGFyYW1zLFxuICAgICAgICBwYXJhbXM6IG51bGxcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgZGVmYXVsdCB2YWx1ZXMgdG8gYSBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3NldFN0YXRlRGVmYXVsdHMgPSBmdW5jdGlvbihkYXRhKSB7XG5cbiAgICAvLyBEZWZhdWx0IHZhbHVlc1xuICAgIGRhdGEuaW5oZXJpdCA9ICh0eXBlb2YgZGF0YS5pbmhlcml0ID09PSAndW5kZWZpbmVkJykgPyB0cnVlIDogZGF0YS5pbmhlcml0O1xuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIG5hbWVcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goL1thLXpBLVowLTlfXSsvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIHF1ZXJ5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHF1ZXJ5ICBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlUXVlcnkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IHF1ZXJ5LnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC8oXFwqKFxcKik/fFthLXpBLVowLTlfXSspLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDb21wYXJlIHR3byBzdGF0ZXMsIGNvbXBhcmVzIHZhbHVlcy4gIFxuICAgKiBcbiAgICogQHJldHVybiB7Qm9vbGVhbn0gVHJ1ZSBpZiBzdGF0ZXMgYXJlIHRoZSBzYW1lLCBmYWxzZSBpZiBzdGF0ZXMgYXJlIGRpZmZlcmVudFxuICAgKi9cbiAgdmFyIF9jb21wYXJlU3RhdGVzID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBhbmd1bGFyLmVxdWFscyhhLCBiKTtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGEgbGlzdCBvZiBwYXJlbnQgc3RhdGVzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtBcnJheX0gICAgICAgICBBbiBBcnJheSBvZiBwYXJlbnQgc3RhdGVzXG4gICAqL1xuICB2YXIgX2dldE5hbWVDaGFpbiA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbmFtZUxpc3QgPSBuYW1lLnNwbGl0KCcuJyk7XG5cbiAgICByZXR1cm4gbmFtZUxpc3RcbiAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgICAgICByZXR1cm4gbGlzdC5zbGljZSgwLCBpKzEpLmpvaW4oJy4nKTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0gIT09IG51bGw7XG4gICAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNyYXdsIGxpYnJhcnkgaGVpcmFyY2h5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICB2YXIgc3RhdGUgPSBudWxsO1xuXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgcXVlcmllc1xuICAgIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIC8vIFVzZSBjYWNoZSBpZiBleGlzdHNcbiAgICB9IGVsc2UgaWYoX2NhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX2NhY2hlW25hbWVdO1xuICAgIH1cblxuICAgIHZhciBuYW1lQ2hhaW4gPSBfZ2V0TmFtZUNoYWluKG5hbWUpO1xuXG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24ocG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIF9saWJyYXJ5W3BuYW1lXTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gcGFyZW50ICE9PSBudWxsO1xuICAgICAgfSk7XG5cbiAgICAvLyBXYWxrIHVwIGNoZWNraW5nIGluaGVyaXRhbmNlXG4gICAgZm9yKHZhciBpPXN0YXRlQ2hhaW4ubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoc3RhdGVDaGFpbltpXSkge1xuICAgICAgICBzdGF0ZSA9IGFuZ3VsYXIuZXh0ZW5kKGFuZ3VsYXIuY29weShzdGF0ZUNoYWluW2ldKSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiAhc3RhdGUuaW5oZXJpdCkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfY2FjaGVbbmFtZV0gPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHN0b3JlIGEgc3RhdGUgZGVmaW5pdGlvbi4gIFBhcmFtZXRlcnMgc2hvdWxkIGJlIGluY2x1ZGVkIGluIGRhdGEgT2JqZWN0IG5vdCBzdGF0ZSBuYW1lLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2RlZmluZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKG5hbWUgPT09IG51bGwgfHwgdHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05hbWUgY2Fubm90IGJlIG51bGwuJyk7XG4gICAgXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgbmFtZXNcbiAgICB9IGVsc2UgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0YXRlIG5hbWUuJyk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHN0YXRlXG4gICAgdmFyIHN0YXRlID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXG4gICAgLy8gVXNlIGRlZmF1bHRzXG4gICAgX3NldFN0YXRlRGVmYXVsdHMoc3RhdGUpO1xuXG4gICAgLy8gTmFtZWQgc3RhdGVcbiAgICBzdGF0ZS5uYW1lID0gbmFtZTtcblxuICAgIC8vIFNldCBkZWZpbml0aW9uXG4gICAgX2xpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIC8vIFJlc2V0IGNhY2hlXG4gICAgX2NhY2hlID0ge307XG5cbiAgICAvLyBVUkwgbWFwcGluZ1xuICAgIGlmKHN0YXRlLnVybCkge1xuICAgICAgX3VybERpY3Rpb25hcnkuYWRkKHN0YXRlLnVybCwgc3RhdGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBkYXRhIHBhcmFtZXRlcnMgZm9yIFN0YXRlUm91dGVyXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBvcHRpb25zIEEgZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMub3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIGlmKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2hpc3RvcnlMZW5ndGgnKSkge1xuICAgICAgX29wdGlvbnMuaGlzdG9yeUxlbmd0aCA9IG9wdGlvbnMuaGlzdG9yeUxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlXG4gICAqIFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuc3RhdGUgPSBmdW5jdGlvbihuYW1lLCBzdGF0ZSkge1xuICAgIGlmKCFzdGF0ZSkge1xuICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICB9XG4gICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgaW5pdGlhbGl6YXRpb24gcGFyYW1ldGVyczsgZGVmZXJyZWQgdG8gJHJlYWR5KClcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBuYW1lICAgQSBpbmlpdGFsIHN0YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBwYXJhbXMgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgX2luaXRpYWxMb2NhdGlvbiA9IHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGluc3RhbmNlXG4gICAqL1xuICB0aGlzLiRnZXQgPSBbJyRsb2NhdGlvbicsICckcScsICckaW5qZWN0b3InLCBmdW5jdGlvbiBTdGF0ZVJvdXRlckZhY3RvcnkoJGxvY2F0aW9uKSB7XG5cbiAgICB2YXIgX2luc3RPcHRpb25zO1xuICAgIHZhciBfaW5zdEluaXRpYWxMb2NhdGlvbjtcbiAgICB2YXIgX2hpc3RvcnkgPSBbXTtcbiAgICB2YXIgX2lzSW5pdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9pbnN0T3B0aW9ucy5oaXN0b3J5TGVuZ3RoIHx8IDU7XG5cbiAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgX2hpc3RvcnkucHVzaChkYXRhKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgICAgaWYoX2hpc3RvcnkubGVuZ3RoID4gaGlzdG9yeUxlbmd0aCkge1xuICAgICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gaGlzdG9yeUxlbmd0aCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIG1ldGhvZCB0byBjaGFuZ2UgdG8gc3RhdGUuICBQYXJhbWV0ZXJzIGluIGBwYXJhbXNgIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBzdGF0ZS1ub3RhdGlvbiBgbmFtZWAgZXhwcmVzc2lvbi4gIFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb24gaW5jbHVkaW5nIG9wdGlvbmFsIHBhcmFtZXRlcnNcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcGFyYW1zICAgICAgICBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdICAgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zLCBjYWxsYmFjaykge1xuICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgICAgbmFtZSA9IG5hbWVFeHByLm5hbWU7XG4gICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgIGxvY2Fsczoge31cbiAgICAgIH07XG5cbiAgICAgIC8vIENvbXBpbGUgZXhlY3V0aW9uIHBoYXNlc1xuICAgICAgdmFyIHF1ZXVlID0gUXVldWVIYW5kbGVyKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShfZ2V0U3RhdGUobmFtZSkpO1xuICAgICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgICBpZihuZXh0U3RhdGUpIHtcbiAgICAgICAgLy8gU2V0IGxvY2Fsc1xuICAgICAgICBuZXh0U3RhdGUubG9jYWxzID0gcmVxdWVzdC5sb2NhbHM7XG4gICAgICAgICAgXG4gICAgICAgIC8vIFNldCBwYXJhbWV0ZXJzXG4gICAgICAgIG5leHRTdGF0ZS5wYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuZXh0U3RhdGUucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgICAgaWYobmV4dFN0YXRlID09PSBudWxsKSB7XG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG5cbiAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdlcnJvcjpub3Rmb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcbiAgICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgICB9IGVsc2UgaWYoX2NvbXBhcmVTdGF0ZXMocHJldlN0YXRlLCBuZXh0U3RhdGUpKSB7XG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAvLyBWYWxpZCBzdGF0ZSBleGlzdHNcbiAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgLy8gTWFrZSBzdGF0ZSBjaGFuZ2VcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBpZihwcmV2U3RhdGUpIF9wdXNoSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuICAgICAgICAgIFxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUHJvY2VzcyBzdGFydGVkXG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnY2hhbmdlOmJlZ2luJywgcmVxdWVzdCk7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBZGQgbWlkZGxld2FyZVxuICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG5cbiAgICAgICAgLy8gUHJvY2VzcyBlbmRlZFxuICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2NoYW5nZTplbmQnLCByZXF1ZXN0KTtcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBSdW5cbiAgICAgIHF1ZXVlLmV4ZWN1dGUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmKGVycikge1xuICAgICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2Vycm9yJywgZXJyLCByZXF1ZXN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2NoYW5nZTpjb21wbGV0ZScsIGVyciwgcmVxdWVzdCk7XG5cbiAgICAgICAgaWYoY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICAvLyBJbnN0YW5jZVxuICAgIHZhciBfaW5zdDtcbiAgICBfaW5zdCA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBHZXQgb3B0aW9uc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBjb25maWd1cmVkIG9wdGlvbnNcbiAgICAgICAqL1xuICAgICAgb3B0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIEhhc24ndCBiZWVuIGluaXRpYWxpemVkXG4gICAgICAgIGlmKCFfaW5zdE9wdGlvbnMpIHtcbiAgICAgICAgICBfaW5zdE9wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX29wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0T3B0aW9ucztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0L2dldCBzdGF0ZVxuICAgICAgICovXG4gICAgICBzdGF0ZTogZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICAgICAgaWYoIXN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBhZGQgbWlkZGxld2FyZSwgZXhlY3V0aW5nIG5leHQoZXJyKTtcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIGhhbmRsZXIgQSBjYWxsYmFjaywgZnVuY3Rpb24ocmVxdWVzdCwgbmV4dClcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICR1c2U6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgICAgaWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pZGRsZXdhcmUgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgX2xheWVyTGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byBwZXJmb3JtIGluaXRpYWxpemF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEByZXR1cm4geyRzdGF0ZX0gSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJHJlYWR5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYoIV9pc0luaXQpIHtcbiAgICAgICAgICBfaXNJbml0ID0gdHJ1ZTtcblxuICAgICAgICAgIC8vIENvbmZpZ3VyYXRpb25cbiAgICAgICAgICBfaW5zdE9wdGlvbnMgPSBhbmd1bGFyLmNvcHkoX29wdGlvbnMpO1xuICAgICAgICAgIGlmKF9pbml0aWFsTG9jYXRpb24pIF9pbnN0SW5pdGlhbExvY2F0aW9uID0gYW5ndWxhci5jb3B5KF9pbml0aWFsTG9jYXRpb24pO1xuXG4gICAgICAgICAgY29uc29sZS5sb2coJyRyZWFkeScpO1xuXG4gICAgICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgICAgIGlmKCRsb2NhdGlvbi51cmwoKSAhPT0gJycpIHtcbiAgICAgICAgICAgIF9pbnN0LiRsb2NhdGlvbigkbG9jYXRpb24udXJsKCksIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdpbml0Jyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIEluaXRpYWxpemUgd2l0aCBzdGF0ZVxuICAgICAgICAgIH0gZWxzZSBpZihfaW5zdEluaXRpYWxMb2NhdGlvbikge1xuICAgICAgICAgICAgX2NoYW5nZVN0YXRlKF9pbnN0SW5pdGlhbExvY2F0aW9uLm5hbWUsIF9pbnN0SW5pdGlhbExvY2F0aW9uLnBhcmFtcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2luaXQnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gSW5pdGlhbGl6ZSBvbmx5XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2luaXQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvLyBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgICAgcGFyc2U6IF9wYXJzZU5hbWUsXG5cbiAgICAgIC8vIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAgICBsaWJyYXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9saWJyYXJ5O1xuICAgICAgfSxcblxuICAgICAgLy8gVmFsaWRhdGlvblxuICAgICAgdmFsaWRhdGU6IHtcbiAgICAgICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgICAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICAgICAgfSxcblxuICAgICAgLy8gUmV0cmlldmUgaGlzdG9yeVxuICAgICAgaGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfaGlzdG9yeTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soYW5ndWxhci5iaW5kKG51bGwsIF9jaGFuZ2VTdGF0ZSwgbmFtZSwgcGFyYW1zKSk7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkYXRhID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICAgICAgaWYoc3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtcyBmcm9tIHVybFxuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcywgY2FsbGJhY2spKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuICAgICAgXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGN1cnJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7TWl4ZWR9ICAgcXVlcnkgIEEgc3RyaW5nIHVzaW5nIHN0YXRlIG5vdGF0aW9uIG9yIGEgUmVnRXhwXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGFjdGl2ZTogZnVuY3Rpb24ocXVlcnksIHBhcmFtcykge1xuICAgICAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgLy8gTm8gc3RhdGVcbiAgICAgICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICAgICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAgICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICAgICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X10qJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBXcmFwIGluc3RhbmNlIG1ldGhvZHNcbiAgICBbXG4gICAgICAnYWRkTGlzdGVuZXInLCBcbiAgICAgICdvbicsIFxuICAgICAgJ29uY2UnLCBcbiAgICAgICdyZW1vdmVMaXN0ZW5lcicsIFxuICAgICAgJ3JlbW92ZUFsbExpc3RlbmVycycsIFxuICAgICAgJ2xpc3RlbmVycycsIFxuICAgICAgJ2VtaXQnLCBcbiAgICBdLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgICBfaW5zdFttZXRob2RdID0gYW5ndWxhci5iaW5kKF9kaXNwYXRjaGVyLCBfZGlzcGF0Y2hlclttZXRob2RdKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBfaW5zdDtcbiAgfV07XG5cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGUnLCAnJGxvY2F0aW9uJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24pIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2Ugb2YgRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgdmFyIF9kZXRlY3RDaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgJHN0YXRlLiRsb2NhdGlvbihfdXJsKTtcbiAgICAgIF9zZWxmLmVtaXQoJ3VwZGF0ZTpsb2NhdGlvbicpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlIFVSTCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgdmFyIF91cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZihjdXJyZW50ICYmIGN1cnJlbnQudXJsKSB7XG4gICAgICBfdXJsID0gY3VycmVudC51cmw7XG5cbiAgICAgIC8vIEFkZCBwYXJhbWV0ZXJzIG9yIHVzZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAgICAgIHZhciBwYXJhbXMgPSBjdXJyZW50LnBhcmFtcyB8fCB7fTtcbiAgICAgIGZvcih2YXIgbmFtZSBpbiBwYXJhbXMpIHtcbiAgICAgICAgX3VybCA9IF91cmwucmVwbGFjZShuZXcgUmVnRXhwKCc6JytuYW1lLCAnZycpLCBwYXJhbXNbbmFtZV0pO1xuICAgICAgfVxuXG4gICAgICAkbG9jYXRpb24udXJsKF91cmwpO1xuICAgIH1cblxuICAgIF9zZWxmLmVtaXQoJ3VwZGF0ZScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvY2F0aW9uIHdhcyB1cGRhdGVkOyBmb3JjZSB1cGRhdGUgZGV0ZWN0aW9uXG4gICAqL1xuICBfc2VsZi5sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIF9kZXRlY3RDaGFuZ2UoYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZS4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICBfdXBkYXRlKCk7XG4gICAgbmV4dCgpO1xuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUGFyc2UgT2JqZWN0IGxpdGVyYWwgbmFtZS12YWx1ZSBwYWlyc1xudmFyIHJlUGFyc2VPYmplY3RMaXRlcmFsID0gLyhbLHtdXFxzKigoXCJ8JykoLio/KVxcM3xcXHcqKXwoOlxccyooWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspP3x0cnVlfGZhbHNlfG51bGx8KFwifCcpKC4qPylcXDd8XFxbW15cXF1dKlxcXSkpKS9nO1xuXG4vLyBNYXRjaCBTdHJpbmdzXG52YXIgcmVTdHJpbmcgPSAvXihcInwnKSguKj8pXFwxJC87XG5cbi8vIFRPRE8gQWRkIGVzY2FwZWQgc3RyaW5nIHF1b3RlcyBcXCcgYW5kIFxcXCIgdG8gc3RyaW5nIG1hdGNoZXJcblxuLy8gTWF0Y2ggTnVtYmVyIChpbnQvZmxvYXQvZXhwb25lbnRpYWwpXG52YXIgcmVOdW1iZXIgPSAvXlsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT8kLztcblxuLyoqXG4gKiBQYXJzZSBzdHJpbmcgdmFsdWUgaW50byBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbC5cbiAqXG4gKiBTdHJpbmdzIGFyZSBzdXJyb3VuZGVkIGJ5IGEgcGFpciBvZiBtYXRjaGluZyBxdW90ZXNcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB2YWx1ZSBBIFN0cmluZyB2YWx1ZSB0byBwYXJzZVxuICogQHJldHVybiB7TWl4ZWR9ICAgICAgICBBIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsXG4gKi9cbnZhciBfcmVzb2x2ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcblxuICAvLyBCb29sZWFuOiB0cnVlXG4gIGlmKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICAvLyBCb29sZWFuOiBmYWxzZVxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTnVsbFxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdudWxsJykge1xuICAgIHJldHVybiBudWxsO1xuXG4gIC8vIFN0cmluZ1xuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVTdHJpbmcpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnN1YnN0cigxLCB2YWx1ZS5sZW5ndGgtMik7XG5cbiAgLy8gTnVtYmVyXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZU51bWJlcikpIHtcbiAgICByZXR1cm4gK3ZhbHVlO1xuXG4gIC8vIE5hTlxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdOYU4nKSB7XG4gICAgcmV0dXJuIE5hTjtcblxuICAvLyBUT0RPIGFkZCBtYXRjaGluZyB3aXRoIEFycmF5cyBhbmQgcGFyc2VcbiAgXG4gIH1cblxuICAvLyBVbmFibGUgdG8gcmVzb2x2ZVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyBGaW5kIHZhbHVlcyBpbiBhbiBvYmplY3QgbGl0ZXJhbFxudmFyIF9saXN0aWZ5ID0gZnVuY3Rpb24oc3RyKSB7XG5cbiAgLy8gVHJpbVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG5cbiAgaWYoc3RyLm1hdGNoKC9eXFxzKnsuKn1cXHMqJC8pID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQYXJhbWV0ZXJzIGV4cGVjdHMgYW4gT2JqZWN0Jyk7XG4gIH1cblxuICB2YXIgc2FuaXRpemVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBuYW1lLnJlcGxhY2UoL15bXFx7LF0/XFxzKltcIiddPy8sICcnKS5yZXBsYWNlKC9bXCInXT9cXHMqJC8sICcnKTtcbiAgfTtcblxuICB2YXIgc2FuaXRpemVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHN0ciA9IHZhbHVlLnJlcGxhY2UoL14oOik/XFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbiAgICByZXR1cm4gX3Jlc29sdmVWYWx1ZShzdHIpO1xuICB9O1xuXG4gIHJldHVybiBzdHIubWF0Y2gocmVQYXJzZU9iamVjdExpdGVyYWwpLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgcmV0dXJuIGklMiA9PT0gMCA/IHNhbml0aXplTmFtZShpdGVtKSA6IHNhbml0aXplVmFsdWUoaXRlbSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBwYXJhbXMgT2JqZWN0IGZyb20gc3RyaW5nXG4gKiBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQSBzdHJpbmdpZmllZCB2ZXJzaW9uIG9mIE9iamVjdCBsaXRlcmFsXG4gKi9cbnZhciBQYXJhbWV0ZXJzID0gZnVuY3Rpb24oc3RyKSB7XG4gIHN0ciA9IHN0ciB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICBfbGlzdGlmeShzdHIpLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIGlmKGklMiA9PT0gMCkge1xuICAgICAgX3NlbGZbaXRlbV0gPSBsaXN0W2krMV07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcmFtZXRlcnM7XG5cbm1vZHVsZS5leHBvcnRzLnJlc29sdmVWYWx1ZSA9IF9yZXNvbHZlVmFsdWU7XG5tb2R1bGUuZXhwb3J0cy5saXN0aWZ5ID0gX2xpc3RpZnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCB3aW5kb3c6ZmFsc2UgKi9cbi8qIGdsb2JhbCBwcm9jZXNzOmZhbHNlICovXG4vKiBnbG9iYWwgc2V0SW1tZWRpYXRlOmZhbHNlICovXG4vKiBnbG9iYWwgc2V0VGltZW91dDpmYWxzZSAqL1xuXG52YXIgX3Byb2Nlc3MgPSB7XG4gIG5leHRUaWNrOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IF9wcm9jZXNzOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIHByb2Nlc3MgPSByZXF1aXJlKCcuLi91dGlscy9wcm9jZXNzJyk7XG5cbi8qKlxuICogRXhlY3V0ZSBhIHNlcmllcyBvZiBmdW5jdGlvbnM7IHVzZWQgaW4gdGFuZGVtIHdpdGggbWlkZGxld2FyZVxuICovXG52YXIgUXVldWVIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gIHZhciBfbGlzdCA9IFtdO1xuICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gIHZhciBfc2VsZiA9IHtcblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGhhbmRsZXJcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge01peGVkfSAgICAgICAgIGhhbmRsZXIgQSBGdW5jdGlvbiBvciBhbiBBcnJheSBvZiBGdW5jdGlvbnMgdG8gYWRkIHRvIHRoZSBxdWV1ZVxuICAgICAqIEByZXR1cm4ge1F1ZXVlSGFuZGxlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAqL1xuICAgIGFkZDogZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgaWYoaGFuZGxlciAmJiBoYW5kbGVyLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICBfbGlzdCA9IF9saXN0LmNvbmNhdChoYW5kbGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9saXN0LnB1c2goaGFuZGxlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRGF0YSBvYmplY3RcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBkYXRhIG9iamVjdCBtYWRlIGF2YWlsYWJsZSB0byBlYWNoIGhhbmRsZXJcbiAgICAgKiBAcmV0dXJuIHtRdWV1ZUhhbmRsZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgKi9cbiAgICBkYXRhOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBfZGF0YSA9IGRhdGE7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQmVnaW4gZXhlY3V0aW9uIGFuZCB0cmlnZ2VyIGNhbGxiYWNrIGF0IHRoZSBlbmRcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAqIEByZXR1cm4ge1F1ZXVlSGFuZGxlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAqL1xuICAgIGV4ZWN1dGU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICB2YXIgbmV4dEhhbmRsZXI7XG4gICAgICB2YXIgZXhlY3V0aW9uTGlzdCA9IF9saXN0LnNsaWNlKDApLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gKGEucHJpb3RpdHkgfHwgMSkgPCAoYi5wcmlvdGl0eSB8fCAxKTtcbiAgICAgIH0pO1xuXG4gICAgICBuZXh0SGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaGFuZGxlciA9IGV4ZWN1dGlvbkxpc3Quc2hpZnQoKTtcblxuICAgICAgICAvLyBDb21wbGV0ZVxuICAgICAgICBpZighaGFuZGxlcikge1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuXG4gICAgICAgIC8vIE5leHQgaGFuZGxlclxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhbmRsZXIuY2FsbChudWxsLCBfZGF0YSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAvLyBFcnJvclxuICAgICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cbiAgICAgICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBuZXh0SGFuZGxlcigpO1xuICAgIH1cblxuICB9O1xuICBcbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWV1ZUhhbmRsZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsID0gcmVxdWlyZSgnLi91cmwnKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBVcmxEaWN0aW9uYXJ5KCkge1xuICB0aGlzLl9wYXR0ZXJucyA9IFtdO1xuICB0aGlzLl9yZWZzID0gW107XG4gIHRoaXMuX3BhcmFtcyA9IFtdO1xufVxuXG4vKipcbiAqIEFzc29jaWF0ZSBhIFVSTCBwYXR0ZXJuIHdpdGggYSByZWZlcmVuY2VcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSBwYXR0ZXJuIEEgVVJMIHBhdHRlcm5cbiAqIEBwYXJhbSAge09iamVjdH0gcmVmICAgICBBIGRhdGEgT2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHBhdHRlcm4sIHJlZikge1xuICBwYXR0ZXJuID0gcGF0dGVybiB8fCAnJztcbiAgdmFyIF9zZWxmID0gdGhpcztcbiAgdmFyIGkgPSB0aGlzLl9wYXR0ZXJucy5sZW5ndGg7XG5cbiAgdmFyIHBhdGhDaGFpbjtcbiAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gIGlmKHBhdHRlcm4uaW5kZXhPZignPycpID09PSAtMSkge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcblxuICB9IGVsc2Uge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcbiAgfVxuXG4gIC8vIFN0YXJ0XG4gIHZhciBzZWFyY2hFeHByID0gJ14nO1xuXG4gIC8vIEl0ZW1zXG4gIChwYXRoQ2hhaW4uZm9yRWFjaChmdW5jdGlvbihjaHVuaywgaSkge1xuICAgIGlmKGkhPT0wKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdcXFxcLyc7XG4gICAgfVxuXG4gICAgaWYoY2h1bmtbMF0gPT09ICc6Jykge1xuICAgICAgc2VhcmNoRXhwciArPSAnW15cXFxcLz9dKic7XG4gICAgICBwYXJhbXNbY2h1bmsuc3Vic3RyaW5nKDEpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc2VhcmNoRXhwciArPSBjaHVuaztcbiAgICB9XG4gIH0pKTtcblxuICAvLyBFbmRcbiAgc2VhcmNoRXhwciArPSAnW1xcXFwvXT8kJztcblxuICB0aGlzLl9wYXR0ZXJuc1tpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG4gIHRoaXMuX3JlZnNbaV0gPSByZWY7XG4gIHRoaXMuX3BhcmFtc1tpXSA9IHBhcmFtcztcbn07XG5cbi8qKlxuICogRmluZCBhIHJlZmVyZW5jZSBhY2NvcmRpbmcgdG8gYSBVUkwgcGF0dGVybiBhbmQgcmV0cmlldmUgcGFyYW1zIGRlZmluZWQgaW4gVVJMXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdXJsICAgICAgQSBVUkwgdG8gdGVzdCBmb3JcbiAqIEBwYXJhbSAge09iamVjdH0gZGVmYXVsdHMgQSBkYXRhIE9iamVjdCBvZiBkZWZhdWx0IHBhcmFtZXRlciB2YWx1ZXNcbiAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgQSByZWZlcmVuY2UgdG8gYSBzdG9yZWQgb2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uKHVybCwgZGVmYXVsdHMpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuICB2YXIgcCA9IFVybCh1cmwpLnBhdGgoKTtcbiAgdmFyIHEgPSBVcmwodXJsKS5xdWVyeXBhcmFtcygpO1xuXG4gIHZhciBfc2VsZiA9IHRoaXM7XG5cbiAgLy8gQ2hlY2sgZGljdGlvbmFyeVxuICB2YXIgX2ZpbmRQYXR0ZXJuID0gZnVuY3Rpb24oY2hlY2spIHtcbiAgICBjaGVjayA9IGNoZWNrIHx8ICcnO1xuICAgIGZvcih2YXIgaT1fc2VsZi5fcGF0dGVybnMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoY2hlY2subWF0Y2goX3NlbGYuX3BhdHRlcm5zW2ldKSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIHZhciBpID0gX2ZpbmRQYXR0ZXJuKHApO1xuICBcbiAgLy8gTWF0Y2hpbmcgcGF0dGVybiBmb3VuZFxuICBpZihpICE9PSAtMSkge1xuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHBhdHRlcm4gbWF0Y2hcbiAgICB2YXIgcGFyYW1zID0ge307XG4gICAgZm9yKHZhciBuIGluIHRoaXMuX3BhcmFtc1tpXSkge1xuICAgICAgdmFyIHBhcmFtUGFyc2VyID0gdGhpcy5fcGFyYW1zW2ldW25dO1xuICAgICAgdmFyIHVybE1hdGNoID0gKHVybC5tYXRjaChwYXJhbVBhcnNlcikgfHwgW10pLnBvcCgpIHx8ICcnO1xuICAgICAgdmFyIHZhck1hdGNoID0gdXJsTWF0Y2guc3BsaXQoJy8nKS5wb3AoKTtcbiAgICAgIHBhcmFtc1tuXSA9IHZhck1hdGNoO1xuICAgIH1cblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBxdWVyeXN0cmluZyBtYXRjaFxuICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHEsIHBhcmFtcyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdXJsOiB1cmwsXG4gICAgICByZWY6IHRoaXMuX3JlZnNbaV0sXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG5cbiAgLy8gTm90IGluIGRpY3Rpb25hcnlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcmxEaWN0aW9uYXJ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBVcmwodXJsKSB7XG4gIHVybCA9IHVybCB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBhdGggb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyB1cmwgOiB1cmwuc3Vic3RyaW5nKDAsIHVybC5pbmRleE9mKCc/JykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5c3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICcnIDogdXJsLnN1YnN0cmluZyh1cmwuaW5kZXhPZignPycpKzEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMIHBhcmFtZXRlcnMgYXMgYSBoYXNoXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5cGFyYW1zOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYWlycyA9IF9zZWxmLnF1ZXJ5c3RyaW5nKCkuc3BsaXQoJyYnKTtcbiAgICAgIHZhciBwYXJhbXMgPSB7fTtcblxuICAgICAgZm9yKHZhciBpPTA7IGk8cGFpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYocGFpcnNbaV0gPT09ICcnKSBjb250aW51ZTtcbiAgICAgICAgdmFyIG5hbWVWYWx1ZSA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgIHBhcmFtc1tuYW1lVmFsdWVbMF1dID0gKHR5cGVvZiBuYW1lVmFsdWVbMV0gPT09ICd1bmRlZmluZWQnIHx8IG5hbWVWYWx1ZVsxXSA9PT0gJycpID8gdHJ1ZSA6IG5hbWVWYWx1ZVsxXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIF9zZWxmO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVybDtcbiJdfQ==
