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
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
'use strict';

/* global angular:false */

// CommonJS
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'angular-state-router';
}

// Polyfill
require('./utils/process');

// Instantiate module
angular.module('angular-state-router', [])

  .provider('$state', require('./services/state-router'))

  .factory('$urlManager', require('./services/url-manager'))

  .run(['$rootScope', '$urlManager', '$state', function($rootScope, $urlManager, $state) {
    // Update location changes
    $rootScope.$on('$locationChangeSuccess', function() {
      $urlManager.location(arguments);
    });

    // Initialize
    $state.$ready();
  }])

  .directive('sref', require('./directives/sref'));

},{"./directives/sref":3,"./services/state-router":5,"./services/url-manager":6,"./utils/process":8}],5:[function(require,module,exports){
(function (process){
'use strict';

/* global process:false */

var events = require('events');
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
  var _dispatcher = new events.EventEmitter();

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
  this.$get = ['$location', function StateRouterFactory($location) {

    // Internal variables
    var _iOptions;
    var _iInitialLocation;
    var _history = [];
    var _isInit = false;

    /**
     * Add history and correct length
     * 
     * @param  {Object} data An Object
     */
    var _pushHistory = function(data) {
      // Keep the last n states (e.g. - defaults 5)
      var historyLength = _iOptions.historyLength || 5;

      if(data) {
        _history.push(data);
      }

      // Update length
      if(_history.length > historyLength) {
        _history.splice(0, _history.length - historyLength);
      }
    };

    /**
     * Internal change to state.  Parameters in `params` takes precedence over state-notation `name` expression.  
     * 
     * @param  {String}   name          A unique identifier for the state; using state-notation including optional parameters
     * @param  {Object}   params        A data object of params
     * @param  {Boolean}  useMiddleware A flag to trigger middleware
     * @param  {Function} [callback]    A callback, function(err)
     */
    var _changeState = function(name, params, useMiddleware, callback) {
      params = params || {};
      useMiddleware = typeof useMiddleware === 'undefined' ? true : useMiddleware;

      // Parse state-notation expression
      var nameExpr = _parseName(name);
      name = nameExpr.name;
      params = angular.extend(nameExpr.params || {}, params);

      var error = null;
      var request = {
        name: name,
        params: params
      };

      var nextState = angular.copy(_getState(name));
      var prevState = _current;

      // Set parameters
      if(nextState) {
        nextState.params = angular.extend(nextState.params || {}, params);
      }

      // Compile execution phases
      var queue = QueueHandler().data(request);

      // Does not exist
      if(!nextState) {
        error = new Error('Requested state was not defined.');
        error.code = 'notfound';

        queue.add(function(data, next) {
          _dispatcher.emit('error:notfound', error, request);

          next(error);
        });

      // State not changed
      } else if(_compareStates(prevState, nextState)) {
        _current = nextState;

      // Exists
      } else {

        // Process started
        queue.add(function(data, next) {
          _dispatcher.emit('change:begin', request);

          // Valid state exists
          if(prevState) _pushHistory(prevState);
          _current = nextState;

          next();
        });

        // Add middleware
        if(useMiddleware) {
          queue.add(_layerList);
        }

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
        if(!_iOptions) {
          _iOptions = angular.copy(_options);
        }

        return _iOptions;
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
          _iOptions = angular.copy(_options);
          if(_initialLocation) _iInitialLocation = angular.copy(_initialLocation);

          process.nextTick(function() {

            // Initial location
            if($location.url() !== '') {
              _inst.$location($location.url(), function() {
                _dispatcher.emit('init');
              });

            // Initialize with state
            } else if(_iInitialLocation) {
              _changeState(_iInitialLocation.name, _iInitialLocation.params, true, function() {
                _dispatcher.emit('init');
              });

            // Initialize only
            } else {
              _dispatcher.emit('init');
            }
          });
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
        process.nextTick(angular.bind(null, _changeState, name, params, true));
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
            process.nextTick(angular.bind(null, _changeState, state.name, data.params, false, callback));
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

}).call(this,require('_process'))

},{"../utils/parameters":7,"../utils/queue-handler":9,"../utils/url-dictionary":10,"_process":2,"events":1}],6:[function(require,module,exports){
'use strict';

var events = require('events');
var UrlDictionary = require('../utils/url-dictionary');

module.exports = ['$state', '$location', function($state, $location) {
  var _url = $location.url();

  // Instance of EventEmitter
  var _self = new events.EventEmitter();

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
    var state = $state.current();

    if(state && state.url) {
      _url = state.url;

      // Add parameters or use default parameters
      var params = state.params || {};
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

// Polyfill process.nextTick()

if(window) {
  if(!window.process) {

    var _process = {
      nextTick: function(callback) {
        setTimeout(callback, 0);
      }
    };

    // Export
    window.process = _process;
  }
}

},{}],9:[function(require,module,exports){
'use strict';

/**
 * Execute a series of functions; used in tandem with middleware
 */
var QueueHandler = function() {
  var _list = [];
  var _data = null;

  var _self = {
    add: function(handler) {
      if(handler && handler.constructor === Array) {
        _list = _list.concat(handler);
      } else {
        _list.push(handler);
      }
      return this;
    },

    data: function(data) {
      _data = data;
      return this;
    },

    execute: function(callback) {
      var nextHandler;
      nextHandler = function() {
        var handler = _list.shift();

        if(!handler) {
          return callback(null);
        }

        handler.call(null, _data, function(err) {

          // Error
          if(err) {
            callback(err);

          // Continue
          } else {
            nextHandler();
          }
        });
      };

      nextHandler();
    }

  };
  
  return _self;
};

module.exports = QueueHandler;

},{}],10:[function(require,module,exports){
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

},{}]},{},[4])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcGFyYW1ldGVycy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3Byb2Nlc3MuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9xdWV1ZS1oYW5kbGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLWRpY3Rpb25hcnkuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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OztNQUd6RyxPQUFPOzs7O0VBSVgsT0FBTzs7O0FBR1QsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgZnVuY3Rpb24gKCRzdGF0ZSkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBQb2x5ZmlsbFxucmVxdWlyZSgnLi91dGlscy9wcm9jZXNzJyk7XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLnByb3ZpZGVyKCckc3RhdGUnLCByZXF1aXJlKCcuL3NlcnZpY2VzL3N0YXRlLXJvdXRlcicpKVxuXG4gIC5mYWN0b3J5KCckdXJsTWFuYWdlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvdXJsLW1hbmFnZXInKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckdXJsTWFuYWdlcicsICckc3RhdGUnLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkdXJsTWFuYWdlciwgJHN0YXRlKSB7XG4gICAgLy8gVXBkYXRlIGxvY2F0aW9uIGNoYW5nZXNcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWxpemVcbiAgICAkc3RhdGUuJHJlYWR5KCk7XG4gIH1dKVxuXG4gIC5kaXJlY3RpdmUoJ3NyZWYnLCByZXF1aXJlKCcuL2RpcmVjdGl2ZXMvc3JlZicpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xudmFyIFBhcmFtZXRlcnMgPSByZXF1aXJlKCcuLi91dGlscy9wYXJhbWV0ZXJzJyk7XG52YXIgUXVldWVIYW5kbGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvcXVldWUtaGFuZGxlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIEluc3RhbmNlXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIEN1cnJlbnQgc3RhdGVcbiAgdmFyIF9jdXJyZW50O1xuXG4gIC8vIE9wdGlvbnNcbiAgdmFyIF9vcHRpb25zID0ge1xuICAgIGhpc3RvcnlMZW5ndGg6IDVcbiAgfTtcblxuICAvLyBMaWJyYXJ5XG4gIHZhciBfbGlicmFyeSA9IHt9O1xuICB2YXIgX2NhY2hlID0ge307XG5cbiAgLy8gVVJMIHRvIHN0YXRlIGRpY3Rpb25hcnlcbiAgdmFyIF91cmxEaWN0aW9uYXJ5ID0gbmV3IFVybERpY3Rpb25hcnkoKTtcblxuICAvLyBNaWRkbGV3YXJlIGxheWVyc1xuICB2YXIgX2xheWVyTGlzdCA9IFtdO1xuXG4gIC8vIERlbGVnYXRlZCBFdmVudEVtaXR0ZXJcbiAgdmFyIF9kaXNwYXRjaGVyID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcblxuICAvLyBJbml0YWwgbG9jYXRpb25cbiAgdmFyIF9pbml0aWFsTG9jYXRpb247XG5cbiAgLy8gV3JhcCBwcm92aWRlciBtZXRob2RzXG4gIFtcbiAgICAnYWRkTGlzdGVuZXInLCBcbiAgICAnb24nLCBcbiAgICAnb25jZScsIFxuICAgICdyZW1vdmVMaXN0ZW5lcicsIFxuICAgICdyZW1vdmVBbGxMaXN0ZW5lcnMnLCBcbiAgICAnbGlzdGVuZXJzJywgXG4gICAgJ2VtaXQnLCBcbiAgXS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIF9wcm92aWRlclttZXRob2RdID0gYW5ndWxhci5iaW5kKF9kaXNwYXRjaGVyLCBfZGlzcGF0Y2hlclttZXRob2RdKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAqIFxuICAgKiBBc3N1bWUgYWxsIHBhcmFtZXRlciB2YWx1ZXMgYXJlIHN0cmluZ3NcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVBhcmFtcyBBIG5hbWUtcGFyYW1zIHN0cmluZ1xuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgIEEgbmFtZSBzdHJpbmcgYW5kIHBhcmFtIE9iamVjdFxuICAgKi9cbiAgdmFyIF9wYXJzZU5hbWUgPSBmdW5jdGlvbihuYW1lUGFyYW1zKSB7XG4gICAgaWYobmFtZVBhcmFtcyAmJiBuYW1lUGFyYW1zLm1hdGNoKC9eW2EtekEtWjAtOV9cXC5dKlxcKC4qXFwpJC8pKSB7XG4gICAgICB2YXIgbnBhcnQgPSBuYW1lUGFyYW1zLnN1YnN0cmluZygwLCBuYW1lUGFyYW1zLmluZGV4T2YoJygnKSk7XG4gICAgICB2YXIgcHBhcnQgPSBQYXJhbWV0ZXJzKCBuYW1lUGFyYW1zLnN1YnN0cmluZyhuYW1lUGFyYW1zLmluZGV4T2YoJygnKSsxLCBuYW1lUGFyYW1zLmxhc3RJbmRleE9mKCcpJykpICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5wYXJ0LFxuICAgICAgICBwYXJhbXM6IHBwYXJ0XG4gICAgICB9O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5hbWVQYXJhbXMsXG4gICAgICAgIHBhcmFtczogbnVsbFxuICAgICAgfTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBkZWZhdWx0IHZhbHVlcyB0byBhIHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBbiBPYmplY3RcbiAgICovXG4gIHZhciBfc2V0U3RhdGVEZWZhdWx0cyA9IGZ1bmN0aW9uKGRhdGEpIHtcblxuICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gbmFtZS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvW2EtekEtWjAtOV9dKy8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgcXVlcnlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcXVlcnkgIEEgcXVlcnkgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGFuZ3VsYXIuZXF1YWxzKGEsIGIpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIHBhcmVudCBzdGF0ZXNcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgIEFuIEFycmF5IG9mIHBhcmVudCBzdGF0ZXNcbiAgICovXG4gIHZhciBfZ2V0TmFtZUNoYWluID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBuYW1lTGlzdCA9IG5hbWUuc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBuYW1lTGlzdFxuICAgICAgLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgICAgIHJldHVybiBsaXN0LnNsaWNlKDAsIGkrMSkuam9pbignLicpO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbnVsbDtcbiAgICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY3Jhd2wgbGlicmFyeSBoZWlyYXJjaHlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9nZXRTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIHZhciBzdGF0ZSA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBxdWVyaWVzXG4gICAgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgLy8gVXNlIGNhY2hlIGlmIGV4aXN0c1xuICAgIH0gZWxzZSBpZihfY2FjaGVbbmFtZV0pIHtcbiAgICAgIHJldHVybiBfY2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG5cbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihwbmFtZSkge1xuICAgICAgICByZXR1cm4gX2xpYnJhcnlbcG5hbWVdO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICAgIHJldHVybiBwYXJlbnQgIT09IG51bGw7XG4gICAgICB9KTtcblxuICAgIC8vIFdhbGsgdXAgY2hlY2tpbmcgaW5oZXJpdGFuY2VcbiAgICBmb3IodmFyIGk9c3RhdGVDaGFpbi5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihzdGF0ZUNoYWluW2ldKSB7XG4gICAgICAgIHN0YXRlID0gYW5ndWxhci5leHRlbmQoYW5ndWxhci5jb3B5KHN0YXRlQ2hhaW5baV0pLCBzdGF0ZSB8fCB7fSk7XG4gICAgICB9XG5cbiAgICAgIGlmKHN0YXRlICYmICFzdGF0ZS5pbmhlcml0KSBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbiBjYWNoZVxuICAgIF9jYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uLiAgUGFyYW1ldGVycyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gZGF0YSBPYmplY3Qgbm90IHN0YXRlIG5hbWUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfbGlicmFyeVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgLy8gUmVzZXQgY2FjaGVcbiAgICBfY2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBjb25maWd1cmF0aW9uIGRhdGEgcGFyYW1ldGVycyBmb3IgU3RhdGVSb3V0ZXJcbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIG9wdGlvbnMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5vcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaGlzdG9yeUxlbmd0aCcpKSB7XG4gICAgICBfb3B0aW9ucy5oaXN0b3J5TGVuZ3RoID0gb3B0aW9ucy5oaXN0b3J5TGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldC9nZXQgc3RhdGVcbiAgICogXG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgdGhpcy5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgaWYoIXN0YXRlKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBpbml0aWFsaXphdGlvbiBwYXJhbWV0ZXJzOyBkZWZlcnJlZCB0byAkcmVhZHkoKVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIG5hbWUgICBBIGluaWl0YWwgc3RhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIHBhcmFtcyBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgKiBAcmV0dXJuIHskc3RhdGVQcm92aWRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLmluaXQgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBfaW5pdGlhbExvY2F0aW9uID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcbiAgICByZXR1cm4gX3Byb3ZpZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgaW5zdGFuY2VcbiAgICovXG4gIHRoaXMuJGdldCA9IFsnJGxvY2F0aW9uJywgZnVuY3Rpb24gU3RhdGVSb3V0ZXJGYWN0b3J5KCRsb2NhdGlvbikge1xuXG4gICAgLy8gSW50ZXJuYWwgdmFyaWFibGVzXG4gICAgdmFyIF9pT3B0aW9ucztcbiAgICB2YXIgX2lJbml0aWFsTG9jYXRpb247XG4gICAgdmFyIF9oaXN0b3J5ID0gW107XG4gICAgdmFyIF9pc0luaXQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9pT3B0aW9ucy5oaXN0b3J5TGVuZ3RoIHx8IDU7XG5cbiAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgX2hpc3RvcnkucHVzaChkYXRhKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgICAgaWYoX2hpc3RvcnkubGVuZ3RoID4gaGlzdG9yeUxlbmd0aCkge1xuICAgICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gaGlzdG9yeUxlbmd0aCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIGNoYW5nZSB0byBzdGF0ZS4gIFBhcmFtZXRlcnMgaW4gYHBhcmFtc2AgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHN0YXRlLW5vdGF0aW9uIGBuYW1lYCBleHByZXNzaW9uLiAgXG4gICAgICogXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSAgIG5hbWUgICAgICAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvbiBpbmNsdWRpbmcgb3B0aW9uYWwgcGFyYW1ldGVyc1xuICAgICAqIEBwYXJhbSAge09iamVjdH0gICBwYXJhbXMgICAgICAgIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAgICogQHBhcmFtICB7Qm9vbGVhbn0gIHVzZU1pZGRsZXdhcmUgQSBmbGFnIHRvIHRyaWdnZXIgbWlkZGxld2FyZVxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdICAgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zLCB1c2VNaWRkbGV3YXJlLCBjYWxsYmFjaykge1xuICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuICAgICAgdXNlTWlkZGxld2FyZSA9IHR5cGVvZiB1c2VNaWRkbGV3YXJlID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiB1c2VNaWRkbGV3YXJlO1xuXG4gICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgICAgbmFtZSA9IG5hbWVFeHByLm5hbWU7XG4gICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICAgIH07XG5cbiAgICAgIHZhciBuZXh0U3RhdGUgPSBhbmd1bGFyLmNvcHkoX2dldFN0YXRlKG5hbWUpKTtcbiAgICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgICAgLy8gU2V0IHBhcmFtZXRlcnNcbiAgICAgIGlmKG5leHRTdGF0ZSkge1xuICAgICAgICBuZXh0U3RhdGUucGFyYW1zID0gYW5ndWxhci5leHRlbmQobmV4dFN0YXRlLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29tcGlsZSBleGVjdXRpb24gcGhhc2VzXG4gICAgICB2YXIgcXVldWUgPSBRdWV1ZUhhbmRsZXIoKS5kYXRhKHJlcXVlc3QpO1xuXG4gICAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgICAgaWYoIW5leHRTdGF0ZSkge1xuICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG5cbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdlcnJvcjpub3Rmb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcblxuICAgICAgICAgIG5leHQoZXJyb3IpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICAgIH0gZWxzZSBpZihfY29tcGFyZVN0YXRlcyhwcmV2U3RhdGUsIG5leHRTdGF0ZSkpIHtcbiAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG5cbiAgICAgIC8vIEV4aXN0c1xuICAgICAgfSBlbHNlIHtcblxuICAgICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdjaGFuZ2U6YmVnaW4nLCByZXF1ZXN0KTtcblxuICAgICAgICAgIC8vIFZhbGlkIHN0YXRlIGV4aXN0c1xuICAgICAgICAgIGlmKHByZXZTdGF0ZSkgX3B1c2hIaXN0b3J5KHByZXZTdGF0ZSk7XG4gICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG5cbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBtaWRkbGV3YXJlXG4gICAgICAgIGlmKHVzZU1pZGRsZXdhcmUpIHtcbiAgICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnY2hhbmdlOmVuZCcsIHJlcXVlc3QpO1xuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJ1blxuICAgICAgcXVldWUuZXhlY3V0ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnZXJyb3InLCBlcnIsIHJlcXVlc3QpO1xuICAgICAgICB9XG4gICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2NoYW5nZTpjb21wbGV0ZScsIGVyciwgcmVxdWVzdCk7XG5cbiAgICAgICAgaWYoY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gSW5zdGFuY2VcbiAgICB2YXIgX2luc3Q7XG4gICAgX2luc3QgPSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogR2V0IG9wdGlvbnNcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29uZmlndXJlZCBvcHRpb25zXG4gICAgICAgKi9cbiAgICAgIG9wdGlvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBIYXNuJ3QgYmVlbiBpbml0aWFsaXplZFxuICAgICAgICBpZighX2lPcHRpb25zKSB7XG4gICAgICAgICAgX2lPcHRpb25zID0gYW5ndWxhci5jb3B5KF9vcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfaU9wdGlvbnM7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldC9nZXQgc3RhdGVcbiAgICAgICAqL1xuICAgICAgc3RhdGU6IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgICAgIGlmKCFzdGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIG1pZGRsZXdhcmUsIGV4ZWN1dGluZyBuZXh0KGVycik7XG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSAgICBoYW5kbGVyIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9ICAgICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkdXNlOiBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgICAgIGlmKHR5cGVvZiBoYW5kbGVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaWRkbGV3YXJlIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9sYXllckxpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcGVyZm9ybSBpbml0aWFsaXphdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRyZWFkeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKCFfaXNJbml0KSB7XG4gICAgICAgICAgX2lzSW5pdCA9IHRydWU7XG5cbiAgICAgICAgICAvLyBDb25maWd1cmF0aW9uXG4gICAgICAgICAgX2lPcHRpb25zID0gYW5ndWxhci5jb3B5KF9vcHRpb25zKTtcbiAgICAgICAgICBpZihfaW5pdGlhbExvY2F0aW9uKSBfaUluaXRpYWxMb2NhdGlvbiA9IGFuZ3VsYXIuY29weShfaW5pdGlhbExvY2F0aW9uKTtcblxuICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICAgIGlmKCRsb2NhdGlvbi51cmwoKSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgX2luc3QuJGxvY2F0aW9uKCRsb2NhdGlvbi51cmwoKSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnaW5pdCcpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICAgICAgICB9IGVsc2UgaWYoX2lJbml0aWFsTG9jYXRpb24pIHtcbiAgICAgICAgICAgICAgX2NoYW5nZVN0YXRlKF9pSW5pdGlhbExvY2F0aW9uLm5hbWUsIF9pSW5pdGlhbExvY2F0aW9uLnBhcmFtcywgdHJ1ZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnaW5pdCcpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBvbmx5XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdpbml0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvLyBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgICAgcGFyc2U6IF9wYXJzZU5hbWUsXG5cbiAgICAgIC8vIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAgICBsaWJyYXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9saWJyYXJ5O1xuICAgICAgfSxcblxuICAgICAgLy8gVmFsaWRhdGlvblxuICAgICAgdmFsaWRhdGU6IHtcbiAgICAgICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgICAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICAgICAgfSxcblxuICAgICAgLy8gUmV0cmlldmUgaGlzdG9yeVxuICAgICAgaGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfaGlzdG9yeTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soYW5ndWxhci5iaW5kKG51bGwsIF9jaGFuZ2VTdGF0ZSwgbmFtZSwgcGFyYW1zLCB0cnVlKSk7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkYXRhID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICAgICAgaWYoc3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtcyBmcm9tIHVybFxuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcywgZmFsc2UsIGNhbGxiYWNrKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgLyoqXG4gICAgICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICAgICAqIFxuICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBjdXJyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICghX2N1cnJlbnQpID8gbnVsbCA6IGFuZ3VsYXIuY29weShfY3VycmVudCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENoZWNrIHF1ZXJ5IGFnYWluc3QgY3VycmVudCBzdGF0ZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgIEEgdHJ1ZSBpZiBzdGF0ZSBpcyBwYXJlbnQgdG8gY3VycmVudCBzdGF0ZVxuICAgICAgICovXG4gICAgICBhY3RpdmU6IGZ1bmN0aW9uKHF1ZXJ5LCBwYXJhbXMpIHtcbiAgICAgICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICAgICAgXG4gICAgICAgIC8vIE5vIHN0YXRlXG4gICAgICAgIGlmKCFfY3VycmVudCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgICAgIH0gZWxzZSBpZihxdWVyeSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gocXVlcnkpO1xuXG4gICAgICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgICAgIH0gZWxzZSBpZih0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKSB7XG5cbiAgICAgICAgICAvLyBDYXN0IHN0cmluZyB0byBSZWdFeHBcbiAgICAgICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgICAgICB2YXIgY2FzdGVkID0gcXVlcnkuc3Vic3RyKDEsIHF1ZXJ5Lmxlbmd0aC0yKTtcbiAgICAgICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cChjYXN0ZWQpKTtcblxuICAgICAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSBxdWVyeVxuICAgICAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtID09PSAnKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9dKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKGl0ZW0gPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9cXFxcLl0qJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKHRyYW5zZm9ybWVkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm9uLW1hdGNoaW5nXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gV3JhcCBpbnN0YW5jZSBtZXRob2RzXG4gICAgW1xuICAgICAgJ2FkZExpc3RlbmVyJywgXG4gICAgICAnb24nLCBcbiAgICAgICdvbmNlJywgXG4gICAgICAncmVtb3ZlTGlzdGVuZXInLCBcbiAgICAgICdyZW1vdmVBbGxMaXN0ZW5lcnMnLCBcbiAgICAgICdsaXN0ZW5lcnMnLCBcbiAgICAgICdlbWl0JywgXG4gICAgXS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgICAgX2luc3RbbWV0aG9kXSA9IGFuZ3VsYXIuYmluZChfZGlzcGF0Y2hlciwgX2Rpc3BhdGNoZXJbbWV0aG9kXSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gX2luc3Q7XG4gIH1dO1xuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGUnLCAnJGxvY2F0aW9uJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24pIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2Ugb2YgRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG5cbiAgLyoqXG4gICAqIERldGVjdCBVUkwgY2hhbmdlIGFuZCBkaXNwYXRjaCBzdGF0ZSBjaGFuZ2VcbiAgICovXG4gIHZhciBfZGV0ZWN0Q2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxhc3RVcmwgPSBfdXJsO1xuICAgIHZhciBuZXh0VXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gICAgaWYobmV4dFVybCAhPT0gbGFzdFVybCkge1xuICAgICAgX3VybCA9IG5leHRVcmw7XG5cbiAgICAgICRzdGF0ZS4kbG9jYXRpb24oX3VybCk7XG4gICAgICBfc2VsZi5lbWl0KCd1cGRhdGU6bG9jYXRpb24nKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXRlID0gJHN0YXRlLmN1cnJlbnQoKTtcblxuICAgIGlmKHN0YXRlICYmIHN0YXRlLnVybCkge1xuICAgICAgX3VybCA9IHN0YXRlLnVybDtcblxuICAgICAgLy8gQWRkIHBhcmFtZXRlcnMgb3IgdXNlIGRlZmF1bHQgcGFyYW1ldGVyc1xuICAgICAgdmFyIHBhcmFtcyA9IHN0YXRlLnBhcmFtcyB8fCB7fTtcbiAgICAgIGZvcih2YXIgbmFtZSBpbiBwYXJhbXMpIHtcbiAgICAgICAgX3VybCA9IF91cmwucmVwbGFjZShuZXcgUmVnRXhwKCc6JytuYW1lLCAnZycpLCBwYXJhbXNbbmFtZV0pO1xuICAgICAgfVxuXG4gICAgICAkbG9jYXRpb24udXJsKF91cmwpO1xuICAgIH1cblxuICAgIF9zZWxmLmVtaXQoJ3VwZGF0ZScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvY2F0aW9uIHdhcyB1cGRhdGVkOyBmb3JjZSB1cGRhdGUgZGV0ZWN0aW9uXG4gICAqL1xuICBfc2VsZi5sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIF9kZXRlY3RDaGFuZ2UoYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZS4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICBfdXBkYXRlKCk7XG4gICAgbmV4dCgpO1xuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUGFyc2UgT2JqZWN0IGxpdGVyYWwgbmFtZS12YWx1ZSBwYWlyc1xudmFyIHJlUGFyc2VPYmplY3RMaXRlcmFsID0gLyhbLHtdXFxzKigoXCJ8JykoLio/KVxcM3xcXHcqKXwoOlxccyooWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspP3x0cnVlfGZhbHNlfG51bGx8KFwifCcpKC4qPylcXDd8XFxbW15cXF1dKlxcXSkpKS9nO1xuXG4vLyBNYXRjaCBTdHJpbmdzXG52YXIgcmVTdHJpbmcgPSAvXihcInwnKSguKj8pXFwxJC87XG5cbi8vIFRPRE8gQWRkIGVzY2FwZWQgc3RyaW5nIHF1b3RlcyBcXCcgYW5kIFxcXCIgdG8gc3RyaW5nIG1hdGNoZXJcblxuLy8gTWF0Y2ggTnVtYmVyIChpbnQvZmxvYXQvZXhwb25lbnRpYWwpXG52YXIgcmVOdW1iZXIgPSAvXlsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT8kLztcblxuLyoqXG4gKiBQYXJzZSBzdHJpbmcgdmFsdWUgaW50byBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbC5cbiAqXG4gKiBTdHJpbmdzIGFyZSBzdXJyb3VuZGVkIGJ5IGEgcGFpciBvZiBtYXRjaGluZyBxdW90ZXNcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB2YWx1ZSBBIFN0cmluZyB2YWx1ZSB0byBwYXJzZVxuICogQHJldHVybiB7TWl4ZWR9ICAgICAgICBBIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsXG4gKi9cbnZhciBfcmVzb2x2ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcblxuICAvLyBCb29sZWFuOiB0cnVlXG4gIGlmKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICAvLyBCb29sZWFuOiBmYWxzZVxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTnVsbFxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdudWxsJykge1xuICAgIHJldHVybiBudWxsO1xuXG4gIC8vIFN0cmluZ1xuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVTdHJpbmcpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnN1YnN0cigxLCB2YWx1ZS5sZW5ndGgtMik7XG5cbiAgLy8gTnVtYmVyXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZU51bWJlcikpIHtcbiAgICByZXR1cm4gK3ZhbHVlO1xuXG4gIC8vIE5hTlxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdOYU4nKSB7XG4gICAgcmV0dXJuIE5hTjtcblxuICAvLyBUT0RPIGFkZCBtYXRjaGluZyB3aXRoIEFycmF5cyBhbmQgcGFyc2VcbiAgXG4gIH1cblxuICAvLyBVbmFibGUgdG8gcmVzb2x2ZVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyBGaW5kIHZhbHVlcyBpbiBhbiBvYmplY3QgbGl0ZXJhbFxudmFyIF9saXN0aWZ5ID0gZnVuY3Rpb24oc3RyKSB7XG5cbiAgLy8gVHJpbVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG5cbiAgaWYoc3RyLm1hdGNoKC9eXFxzKnsuKn1cXHMqJC8pID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQYXJhbWV0ZXJzIGV4cGVjdHMgYW4gT2JqZWN0Jyk7XG4gIH1cblxuICB2YXIgc2FuaXRpemVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBuYW1lLnJlcGxhY2UoL15bXFx7LF0/XFxzKltcIiddPy8sICcnKS5yZXBsYWNlKC9bXCInXT9cXHMqJC8sICcnKTtcbiAgfTtcblxuICB2YXIgc2FuaXRpemVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHN0ciA9IHZhbHVlLnJlcGxhY2UoL14oOik/XFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbiAgICByZXR1cm4gX3Jlc29sdmVWYWx1ZShzdHIpO1xuICB9O1xuXG4gIHJldHVybiBzdHIubWF0Y2gocmVQYXJzZU9iamVjdExpdGVyYWwpLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgcmV0dXJuIGklMiA9PT0gMCA/IHNhbml0aXplTmFtZShpdGVtKSA6IHNhbml0aXplVmFsdWUoaXRlbSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBwYXJhbXMgT2JqZWN0IGZyb20gc3RyaW5nXG4gKiBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQSBzdHJpbmdpZmllZCB2ZXJzaW9uIG9mIE9iamVjdCBsaXRlcmFsXG4gKi9cbnZhciBQYXJhbWV0ZXJzID0gZnVuY3Rpb24oc3RyKSB7XG4gIHN0ciA9IHN0ciB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICBfbGlzdGlmeShzdHIpLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIGlmKGklMiA9PT0gMCkge1xuICAgICAgX3NlbGZbaXRlbV0gPSBsaXN0W2krMV07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcmFtZXRlcnM7XG5cbm1vZHVsZS5leHBvcnRzLnJlc29sdmVWYWx1ZSA9IF9yZXNvbHZlVmFsdWU7XG5tb2R1bGUuZXhwb3J0cy5saXN0aWZ5ID0gX2xpc3RpZnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCB3aW5kb3c6ZmFsc2UgKi9cbi8qIGdsb2JhbCBwcm9jZXNzOmZhbHNlICovXG4vKiBnbG9iYWwgc2V0SW1tZWRpYXRlOmZhbHNlICovXG4vKiBnbG9iYWwgc2V0VGltZW91dDpmYWxzZSAqL1xuXG4vLyBQb2x5ZmlsbCBwcm9jZXNzLm5leHRUaWNrKClcblxuaWYod2luZG93KSB7XG4gIGlmKCF3aW5kb3cucHJvY2Vzcykge1xuXG4gICAgdmFyIF9wcm9jZXNzID0ge1xuICAgICAgbmV4dFRpY2s6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBFeHBvcnRcbiAgICB3aW5kb3cucHJvY2VzcyA9IF9wcm9jZXNzO1xuICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogRXhlY3V0ZSBhIHNlcmllcyBvZiBmdW5jdGlvbnM7IHVzZWQgaW4gdGFuZGVtIHdpdGggbWlkZGxld2FyZVxuICovXG52YXIgUXVldWVIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gIHZhciBfbGlzdCA9IFtdO1xuICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gIHZhciBfc2VsZiA9IHtcbiAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgIGlmKGhhbmRsZXIgJiYgaGFuZGxlci5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfbGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgdmFyIG5leHRIYW5kbGVyO1xuICAgICAgbmV4dEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBfbGlzdC5zaGlmdCgpO1xuXG4gICAgICAgIGlmKCFoYW5kbGVyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFuZGxlci5jYWxsKG51bGwsIF9kYXRhLCBmdW5jdGlvbihlcnIpIHtcblxuICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICB9XG5cbiAgfTtcbiAgXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVIYW5kbGVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybCA9IHJlcXVpcmUoJy4vdXJsJyk7XG5cbi8qKlxuICogQ29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVXJsRGljdGlvbmFyeSgpIHtcbiAgdGhpcy5fcGF0dGVybnMgPSBbXTtcbiAgdGhpcy5fcmVmcyA9IFtdO1xuICB0aGlzLl9wYXJhbXMgPSBbXTtcbn1cblxuLyoqXG4gKiBBc3NvY2lhdGUgYSBVUkwgcGF0dGVybiB3aXRoIGEgcmVmZXJlbmNlXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gcGF0dGVybiBBIFVSTCBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtPYmplY3R9IHJlZiAgICAgQSBkYXRhIE9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihwYXR0ZXJuLCByZWYpIHtcbiAgcGF0dGVybiA9IHBhdHRlcm4gfHwgJyc7XG4gIHZhciBfc2VsZiA9IHRoaXM7XG4gIHZhciBpID0gdGhpcy5fcGF0dGVybnMubGVuZ3RoO1xuXG4gIHZhciBwYXRoQ2hhaW47XG4gIHZhciBwYXJhbXMgPSB7fTtcblxuICBpZihwYXR0ZXJuLmluZGV4T2YoJz8nKSA9PT0gLTEpIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG5cbiAgfSBlbHNlIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG4gIH1cblxuICAvLyBTdGFydFxuICB2YXIgc2VhcmNoRXhwciA9ICdeJztcblxuICAvLyBJdGVtc1xuICAocGF0aENoYWluLmZvckVhY2goZnVuY3Rpb24oY2h1bmssIGkpIHtcbiAgICBpZihpIT09MCkge1xuICAgICAgc2VhcmNoRXhwciArPSAnXFxcXC8nO1xuICAgIH1cblxuICAgIGlmKGNodW5rWzBdID09PSAnOicpIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1teXFxcXC8/XSonO1xuICAgICAgcGFyYW1zW2NodW5rLnN1YnN0cmluZygxKV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gY2h1bms7XG4gICAgfVxuICB9KSk7XG5cbiAgLy8gRW5kXG4gIHNlYXJjaEV4cHIgKz0gJ1tcXFxcL10/JCc7XG5cbiAgdGhpcy5fcGF0dGVybnNbaV0gPSBuZXcgUmVnRXhwKHNlYXJjaEV4cHIpO1xuICB0aGlzLl9yZWZzW2ldID0gcmVmO1xuICB0aGlzLl9wYXJhbXNbaV0gPSBwYXJhbXM7XG59O1xuXG4vKipcbiAqIEZpbmQgYSByZWZlcmVuY2UgYWNjb3JkaW5nIHRvIGEgVVJMIHBhdHRlcm4gYW5kIHJldHJpZXZlIHBhcmFtcyBkZWZpbmVkIGluIFVSTFxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgIEEgVVJMIHRvIHRlc3QgZm9yXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRlZmF1bHRzIEEgZGF0YSBPYmplY3Qgb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIEEgcmVmZXJlbmNlIHRvIGEgc3RvcmVkIG9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbih1cmwsIGRlZmF1bHRzKSB7XG4gIHVybCA9IHVybCB8fCAnJztcbiAgdmFyIHAgPSBVcmwodXJsKS5wYXRoKCk7XG4gIHZhciBxID0gVXJsKHVybCkucXVlcnlwYXJhbXMoKTtcblxuICB2YXIgX3NlbGYgPSB0aGlzO1xuXG4gIC8vIENoZWNrIGRpY3Rpb25hcnlcbiAgdmFyIF9maW5kUGF0dGVybiA9IGZ1bmN0aW9uKGNoZWNrKSB7XG4gICAgY2hlY2sgPSBjaGVjayB8fCAnJztcbiAgICBmb3IodmFyIGk9X3NlbGYuX3BhdHRlcm5zLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKGNoZWNrLm1hdGNoKF9zZWxmLl9wYXR0ZXJuc1tpXSkgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICB2YXIgaSA9IF9maW5kUGF0dGVybihwKTtcbiAgXG4gIC8vIE1hdGNoaW5nIHBhdHRlcm4gZm91bmRcbiAgaWYoaSAhPT0gLTEpIHtcblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBwYXR0ZXJuIG1hdGNoXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xuICAgIGZvcih2YXIgbiBpbiB0aGlzLl9wYXJhbXNbaV0pIHtcbiAgICAgIHZhciBwYXJhbVBhcnNlciA9IHRoaXMuX3BhcmFtc1tpXVtuXTtcbiAgICAgIHZhciB1cmxNYXRjaCA9ICh1cmwubWF0Y2gocGFyYW1QYXJzZXIpIHx8IFtdKS5wb3AoKSB8fCAnJztcbiAgICAgIHZhciB2YXJNYXRjaCA9IHVybE1hdGNoLnNwbGl0KCcvJykucG9wKCk7XG4gICAgICBwYXJhbXNbbl0gPSB2YXJNYXRjaDtcbiAgICB9XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcXVlcnlzdHJpbmcgbWF0Y2hcbiAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChxLCBwYXJhbXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgcmVmOiB0aGlzLl9yZWZzW2ldLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuXG4gIC8vIE5vdCBpbiBkaWN0aW9uYXJ5XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsRGljdGlvbmFyeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVXJsKHVybCkge1xuICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwYXRoIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHBhdGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gdXJsIDogdXJsLnN1YnN0cmluZygwLCB1cmwuaW5kZXhPZignPycpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXN0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnJyA6IHVybC5zdWJzdHJpbmcodXJsLmluZGV4T2YoJz8nKSsxKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTCBwYXJhbWV0ZXJzIGFzIGEgaGFzaFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXBhcmFtczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGFpcnMgPSBfc2VsZi5xdWVyeXN0cmluZygpLnNwbGl0KCcmJyk7XG4gICAgICB2YXIgcGFyYW1zID0ge307XG5cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBhaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHBhaXJzW2ldID09PSAnJykgY29udGludWU7XG4gICAgICAgIHZhciBuYW1lVmFsdWUgPSBwYWlyc1tpXS5zcGxpdCgnPScpO1xuICAgICAgICBwYXJhbXNbbmFtZVZhbHVlWzBdXSA9ICh0eXBlb2YgbmFtZVZhbHVlWzFdID09PSAndW5kZWZpbmVkJyB8fCBuYW1lVmFsdWVbMV0gPT09ICcnKSA/IHRydWUgOiBuYW1lVmFsdWVbMV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBfc2VsZjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmw7XG4iXX0=
