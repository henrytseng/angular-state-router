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

module.exports = ['$stateRouter', function ($stateRouter) {
  return {
    restrict: 'A',
    scope: {
    },
    link: function(scope, element, attrs) {
      element.css('cursor', 'pointer');
      element.on('click', function(e) {
        $stateRouter.change(attrs.sref);
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

  .factory('$stateRouter', require('./services/state-router'))

  .factory('$urlManager', require('./services/url-manager'))

  .run(['$rootScope', '$urlManager', function($rootScope, $urlManager) {
    $rootScope.$on('$locationChangeSuccess', function() {
      $urlManager.location(arguments);
    });
  }])

  .directive('sref', require('./directives/sref'));

},{"./directives/sref":3,"./services/state-router":5,"./services/url-manager":6,"./utils/process":8}],5:[function(require,module,exports){
(function (process){
'use strict';

/* global process:false */

var events = require('events');
var UrlDictionary = require('../utils/url-dictionary');
var Parameters = require('../utils/parameters');

module.exports = ['$location', function($location) {
  // Current state
  var _current;

  // Keep the last n states (e.g. - defaults 5)
  var _historyLength = 5;
  var _history = [];

  // Library
  var _library = {};
  var _cache = {};

  // URL dictionary
  var _urlDictionary = new UrlDictionary();

  // Middleware layers
  var _layerList = [];

  // Instance of EventEmitter
  var _self = new events.EventEmitter();

  /**
   * Parse state notation name-params.  
   * 
   * Assume all parameter values are strings
   * 
   * @param  {String} name A name-params string
   * @return {Array}       A name string and param Object
   */
  var _parseName = function(name) {
    if(name && name.match(/[a-zA-Z0-9_\.]*\(.*\)/)) {
      var npart = name.substr(0, name.indexOf('('));
      var ppart = Parameters( name.substr(name.indexOf('(')+1) );

      return {
        name: npart,
        params: ppart
      };

    } else {
      return {
        name: name,
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
   * Add history and correct length
   * 
   * @param  {Object} data An Object
   */
  var _pushHistory = function(data) {
    if(data) {
      _history.push(data);
    }

    // Update length
    if(_history.length > _historyLength) {
      _history.splice(0, _history.length - _historyLength);
    }
  };

  /**
   * Execute a series of functions; used in tandem with middleware
   */
  var _QueueHandler = function() {
    var _list = [];
    var _data = null;

    return {
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
              _self.emit('error', err, _data);
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
    var queue = _QueueHandler().data(request);

    // Does not exist
    if(!nextState) {
      error = new Error('Requested state was not defined.');
      error.code = 'notfound';

      queue.add(function(data, next) {
        _self.emit('error:notfound', error, request);

        next(error);
      });

    // State not changed
    } else if(_compareStates(prevState, nextState)) {
      _current = nextState;

    // Exists
    } else {

      // Process started
      queue.add(function(data, next) {
        _self.emit('change:begin', request);

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
        _self.emit('change:end', request);
        next();
      });
    }

    // Run
    queue.execute(function(err) {
      _self.emit('change:complete', err, request);

      if(callback) {
        callback(err);
      }
    });
  };

  /**
   * Set configuration data parameters for StateRouter
   * 
   * @param  {Object}      options A data Object
   * @return {StateRouter}         Itself; chainable
   */
  _self.options = function(options) {
    options = options || {};

    if(options.hasOwnProperty('historyLength')) {
      _historyLength = options.historyLength;
      _pushHistory(null);
    }

    return _self;
  };

  /**
   * Set/get state data.  Define the states.  
   *
   * @param  {String}      name    A unique identifier for the state; using dot-notation
   * @param  {Object}      [state] A state definition data object, optional
   * @return {StateRouter}         Itself; chainable
   */
  _self.state = function(name, state) {
    if(!state) {
      return _getState(name);
    }
    _defineState(name, state);
    return _self;
  };

  /**
   * Initialize with current address and fallback to default, asynchronous operation.  
   * 
   * @param  {String}      name     An initial state to start in.  
   * @param  {Object}      [params] A parameters data object
   * @return {StateRouter}          Itself; chainable
   */
  _self.init = function(name, params) {
    process.nextTick(function() {

      // Initial location
      var initalLocation = _urlDictionary.lookup($location.url());
      if(initalLocation !== null) {
        _changeState(initalLocation.name, params, true, function() {
          _self.emit('init');
        });

      // Initialize with state
      } else if(name) {
        _changeState(name, params, true, function() {
          _self.emit('init');
        });

      // Initialize only
      } else {
        _self.emit('init');
      }
    });

    return _self;
  };

  /**
   * Change state, asynchronous operation
   * 
   * @param  {String}      name     A unique identifier for the state; using dot-notation
   * @param  {Object}      [params] A parameters data object
   * @return {StateRouter}          Itself; chainable
   */
  _self.change = function(name, params) {
    process.nextTick(angular.bind(null, _changeState, name, params, true));
    return _self;
  };

  /**
   * Change state based on $location.url(), asynchronous operation.  Used internally by $urlManager.
   * 
   * @param  {String}      url      A url matching defind states
   * @param  {Object}      [params] A parameters data object
   * @return {StateRouter}          Itself; chainable
   */
  _self.$location = function(url, params) {
    var state = _urlDictionary.lookup(url);
    if(state) {
      process.nextTick(angular.bind(null, _changeState, state.name, params, false));
    }
    return _self;
  };

  /**
   * Add middleware, executing next(err);
   * 
   * @param  {Function}    handler A callback, function(request, next)
   * @return {StateRouter}         Itself; chainable
   */
  _self.$use = function(handler) {
    if(typeof handler !== 'function') {
      throw new Error('Middleware must be a function');
    }

    _layerList.push(handler);
    return _self;
  };

  /**
   * Retrieve copy of current state
   * 
   * @return {Object} A copy of current state
   */
  _self.current = function() {
    return (!_current) ? null : angular.copy(_current);
  };

  /**
   * Check query against current state
   *
   * @param  {Mixed}   query  A string using state notation or a RegExp
   * @param  {Object}  params A parameters data object
   * @return {Boolean}        A true if state is parent to current state
   */
  _self.active = function(query, params) {
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
  };

  /**
   * Parse state notation name-params.  
   * 
   * Assume all parameter values are strings
   * 
   * @param  {String} name A name-params string
   * @return {Array}       A name string and param Object
   */
  _self.parse = _parseName;

  /**
   * Retrieve definition of states
   * 
   * @return {Object} A hash of states
   */
  _self.library = function() {
    return _library;
  };

  /**
   * Validation
   */
  _self.validate = {
    name: _validateStateName,
    query: _validateStateQuery
  };

  /**
   * Retrieve history
   * 
   * @return {Object} A hash of states
   */
  _self.history = function() {
    return _history;
  };

  // Return instance
  return _self;
}];

}).call(this,require('_process'))

},{"../utils/parameters":7,"../utils/url-dictionary":9,"_process":2,"events":1}],6:[function(require,module,exports){
'use strict';

var events = require('events');
var UrlDictionary = require('../utils/url-dictionary');

module.exports = ['$stateRouter', '$location', function($stateRouter, $location) {
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

      // TODO parse params to state data


      







      $stateRouter.$location(_url, _self);

      _self.emit('update:location');
    }
  };

  /**
   * Update URL based on state
   */
  var _update = function() {
    var state = $stateRouter.current();

    if(state && state.url) {
      _url = state.url;

      // TODO Add parameters or use default parameters







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
  $stateRouter.$use(function(request, next) {
    _update();
    next();
  });

  return _self;
}];

},{"../utils/url-dictionary":9,"events":1}],7:[function(require,module,exports){
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

var Url = require('./url');

/**
 * Constructor
 */
function UrlDictionary() {
  this._patterns = [];
  this._refs = [];
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

  if(pattern.indexOf('?') === -1) {
    pathChain = Url(pattern).path().split('/');

  } else {
    pathChain = Url(pattern).path().split('/');
  }

  // URL matching
  var expr = 
    '^' +
    (pathChain.map(function(chunk) {
      if(chunk[0] === ':') {
        return '[a-zA-Z0-9\\-_\\.~]+';

      } else {
        return chunk;
      }
    }).join('\\/')) +
    '[\\/]?$';

  this._patterns[i] = new RegExp(expr);
  this._refs[i] = ref;
};

/**
 * Find a reference according to a URL pattern
 * 
 * @param  {String} url      A URL to test for
 * @param  {Object} defaults A data Object of default parameter values
 * @return {Object}          A reference to a stored object
 */
UrlDictionary.prototype.lookup = function(url, defaults) {
  var inflected = Url(url || '').path();

  for(var i=this._patterns.length-1; i>=0; i--) {
    if(inflected.match(this._patterns[i]) !== null) {
      return this._refs[i];
    }
  }

  return null;
};

module.exports = UrlDictionary;

},{"./url":10}],10:[function(require,module,exports){
'use strict';

function Url(url) {
  url = url || '';

  return {

    /**
     * Get the path of a URL
     * 
     * @return {String}     A querystring from URL
     */
    path: function() {
      var inflected = url.replace(/\?.*/, '');
      return inflected;
    },

    /**
     * Get the querystring of a URL
     * 
     * @return {String}     A querystring from URL
     */
    querystring: function() {
      var inflected = url.replace(/.*\?/, '');
      return inflected;
    }
  };
}

module.exports = Url;

},{}]},{},[4])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcGFyYW1ldGVycy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3Byb2Nlc3MuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3VybC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUFROzs7Ozs7Ozs7QUFTZixjQUFjLFVBQVUsTUFBTSxTQUFTLFNBQVMsS0FBSztFQUNuRCxVQUFVLFdBQVc7RUFDckIsSUFBSSxRQUFRO0VBQ1osSUFBSSxJQUFJLEtBQUssVUFBVTs7RUFFdkIsSUFBSTs7RUFFSixHQUFHLFFBQVEsUUFBUSxTQUFTLENBQUMsR0FBRztJQUM5QixZQUFZLElBQUksU0FBUyxPQUFPLE1BQU07O1NBRWpDO0lBQ0wsWUFBWSxJQUFJLFNBQVMsT0FBTyxNQUFNOzs7O0VBSXhDLElBQUk7SUFDRjtLQUNDLFVBQVUsSUFBSSxTQUFTLE9BQU87TUFDN0IsR0FBRyxNQUFNLE9BQU8sS0FBSztRQUNuQixPQUFPOzthQUVGO1FBQ0wsT0FBTzs7T0FFUixLQUFLO0lBQ1I7O0VBRUYsS0FBSyxVQUFVLEtBQUssSUFBSSxPQUFPO0VBQy9CLEtBQUssTUFBTSxLQUFLOzs7Ozs7Ozs7O0FBVWxCLGNBQWMsVUFBVSxTQUFTLFNBQVMsS0FBSyxVQUFVO0VBQ3ZELElBQUksWUFBWSxJQUFJLE9BQU8sSUFBSTs7RUFFL0IsSUFBSSxJQUFJLEVBQUUsS0FBSyxVQUFVLE9BQU8sR0FBRyxHQUFHLEdBQUcsS0FBSztJQUM1QyxHQUFHLFVBQVUsTUFBTSxLQUFLLFVBQVUsUUFBUSxNQUFNO01BQzlDLE9BQU8sS0FBSyxNQUFNOzs7O0VBSXRCLE9BQU87OztBQUdULE9BQU8sVUFBVTtBQUNqQjs7QUNyRUE7O0FBRUEsU0FBUyxJQUFJLEtBQUs7RUFDaEIsTUFBTSxPQUFPOztFQUViLE9BQU87Ozs7Ozs7SUFPTCxNQUFNLFdBQVc7TUFDZixJQUFJLFlBQVksSUFBSSxRQUFRLFFBQVE7TUFDcEMsT0FBTzs7Ozs7Ozs7SUFRVCxhQUFhLFdBQVc7TUFDdEIsSUFBSSxZQUFZLElBQUksUUFBUSxRQUFRO01BQ3BDLE9BQU87Ozs7O0FBS2IsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlUm91dGVyJywgZnVuY3Rpb24gKCRzdGF0ZVJvdXRlcikge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlUm91dGVyLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBQb2x5ZmlsbFxucmVxdWlyZSgnLi91dGlscy9wcm9jZXNzJyk7XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLmZhY3RvcnkoJyRzdGF0ZVJvdXRlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5ydW4oWyckcm9vdFNjb3BlJywgJyR1cmxNYW5hZ2VyJywgZnVuY3Rpb24oJHJvb3RTY29wZSwgJHVybE1hbmFnZXIpIHtcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgcHJvY2VzczpmYWxzZSAqL1xuXG52YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRsb2NhdGlvbicsIGZ1bmN0aW9uKCRsb2NhdGlvbikge1xuICAvLyBDdXJyZW50IHN0YXRlXG4gIHZhciBfY3VycmVudDtcblxuICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgdmFyIF9oaXN0b3J5TGVuZ3RoID0gNTtcbiAgdmFyIF9oaXN0b3J5ID0gW107XG5cbiAgLy8gTGlicmFyeVxuICB2YXIgX2xpYnJhcnkgPSB7fTtcbiAgdmFyIF9jYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvLyBJbnN0YW5jZSBvZiBFdmVudEVtaXR0ZXJcbiAgdmFyIF9zZWxmID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIHZhciBfcGFyc2VOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGlmKG5hbWUgJiYgbmFtZS5tYXRjaCgvW2EtekEtWjAtOV9cXC5dKlxcKC4qXFwpLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWUuc3Vic3RyKDAsIG5hbWUuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWUuc3Vic3RyKG5hbWUuaW5kZXhPZignKCcpKzEpICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5wYXJ0LFxuICAgICAgICBwYXJhbXM6IHBwYXJ0XG4gICAgICB9O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHBhcmFtczogbnVsbFxuICAgICAgfTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBkZWZhdWx0IHZhbHVlcyB0byBhIHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBbiBPYmplY3RcbiAgICovXG4gIHZhciBfc2V0U3RhdGVEZWZhdWx0cyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSAgQSBxdWVyeSBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBxdWVyeS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvKFxcKihcXCopP3xbYS16QS1aMC05X10rKS8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGFyZSB0d28gc3RhdGVzLCBjb21wYXJlcyB2YWx1ZXMuICBcbiAgICogXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3RhdGVzIGFyZSB0aGUgc2FtZSwgZmFsc2UgaWYgc3RhdGVzIGFyZSBkaWZmZXJlbnRcbiAgICovXG4gIHZhciBfY29tcGFyZVN0YXRlcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gYW5ndWxhci5lcXVhbHMoYSwgYik7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9jYWNoZVtuYW1lXSkge1xuICAgICAgcmV0dXJuIF9jYWNoZVtuYW1lXTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZUNoYWluID0gX2dldE5hbWVDaGFpbihuYW1lKTtcblxuICAgIHZhciBzdGF0ZUNoYWluID0gbmFtZUNoYWluXG4gICAgICAubWFwKGZ1bmN0aW9uKHBuYW1lKSB7XG4gICAgICAgIHJldHVybiBfbGlicmFyeVtwbmFtZV07XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihwYXJlbnQpIHtcbiAgICAgICAgcmV0dXJuIHBhcmVudCAhPT0gbnVsbDtcbiAgICAgIH0pO1xuXG4gICAgLy8gV2FsayB1cCBjaGVja2luZyBpbmhlcml0YW5jZVxuICAgIGZvcih2YXIgaT1zdGF0ZUNoYWluLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKHN0YXRlQ2hhaW5baV0pIHtcbiAgICAgICAgc3RhdGUgPSBhbmd1bGFyLmV4dGVuZChhbmd1bGFyLmNvcHkoc3RhdGVDaGFpbltpXSksIHN0YXRlIHx8IHt9KTtcbiAgICAgIH1cblxuICAgICAgaWYoc3RhdGUgJiYgIXN0YXRlLmluaGVyaXQpIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFN0b3JlIGluIGNhY2hlXG4gICAgX2NhY2hlW25hbWVdID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBzdG9yZSBhIHN0YXRlIGRlZmluaXRpb24uICBQYXJhbWV0ZXJzIHNob3VsZCBiZSBpbmNsdWRlZCBpbiBkYXRhIE9iamVjdCBub3Qgc3RhdGUgbmFtZS4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9kZWZpbmVTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZihuYW1lID09PSBudWxsIHx8IHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOYW1lIGNhbm5vdCBiZSBudWxsLicpO1xuICAgIFxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIG5hbWVzXG4gICAgfSBlbHNlIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdGF0ZSBuYW1lLicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzdGF0ZVxuICAgIHZhciBzdGF0ZSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgIC8vIFVzZSBkZWZhdWx0c1xuICAgIF9zZXRTdGF0ZURlZmF1bHRzKHN0YXRlKTtcblxuICAgIC8vIE5hbWVkIHN0YXRlXG4gICAgc3RhdGUubmFtZSA9IG5hbWU7XG5cbiAgICAvLyBTZXQgZGVmaW5pdGlvblxuICAgIF9saWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICAvLyBSZXNldCBjYWNoZVxuICAgIF9jYWNoZSA9IHt9O1xuXG4gICAgLy8gVVJMIG1hcHBpbmdcbiAgICBpZihzdGF0ZS51cmwpIHtcbiAgICAgIF91cmxEaWN0aW9uYXJ5LmFkZChzdGF0ZS51cmwsIHN0YXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmKGRhdGEpIHtcbiAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IF9oaXN0b3J5TGVuZ3RoKSB7XG4gICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gX2hpc3RvcnlMZW5ndGgpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogRXhlY3V0ZSBhIHNlcmllcyBvZiBmdW5jdGlvbnM7IHVzZWQgaW4gdGFuZGVtIHdpdGggbWlkZGxld2FyZVxuICAgKi9cbiAgdmFyIF9RdWV1ZUhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2xpc3QgPSBbXTtcbiAgICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZDogZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgX2RhdGEgPSBkYXRhO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgICAgbmV4dEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgaGFuZGxlciA9IF9saXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgICBpZighaGFuZGxlcikge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGhhbmRsZXIuY2FsbChudWxsLCBfZGF0YSwgZnVuY3Rpb24oZXJyKSB7XG5cbiAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgX3NlbGYuZW1pdCgnZXJyb3InLCBlcnIsIF9kYXRhKTtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBjaGFuZ2UgdG8gc3RhdGUuICBQYXJhbWV0ZXJzIGluIGBwYXJhbXNgIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBzdGF0ZS1ub3RhdGlvbiBgbmFtZWAgZXhwcmVzc2lvbi4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIG5hbWUgICAgICAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvbiBpbmNsdWRpbmcgb3B0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcGFyYW1zICAgICAgICBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgdXNlTWlkZGxld2FyZSBBIGZsYWcgdG8gdHJpZ2dlciBtaWRkbGV3YXJlXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdICAgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICovXG4gIHZhciBfY2hhbmdlU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMsIHVzZU1pZGRsZXdhcmUsIGNhbGxiYWNrKSB7XG4gICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuICAgIHVzZU1pZGRsZXdhcmUgPSB0eXBlb2YgdXNlTWlkZGxld2FyZSA9PT0gJ3VuZGVmaW5lZCcgPyB0cnVlIDogdXNlTWlkZGxld2FyZTtcblxuICAgIC8vIFBhcnNlIHN0YXRlLW5vdGF0aW9uIGV4cHJlc3Npb25cbiAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgIG5hbWUgPSBuYW1lRXhwci5uYW1lO1xuICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5hbWVFeHByLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcblxuICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgdmFyIHJlcXVlc3QgPSB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuXG4gICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShfZ2V0U3RhdGUobmFtZSkpO1xuICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgIC8vIFNldCBwYXJhbWV0ZXJzXG4gICAgaWYobmV4dFN0YXRlKSB7XG4gICAgICBuZXh0U3RhdGUucGFyYW1zID0gYW5ndWxhci5leHRlbmQobmV4dFN0YXRlLnBhcmFtcyB8fCB7fSwgcGFyYW1zKTtcbiAgICB9XG5cbiAgICAvLyBDb21waWxlIGV4ZWN1dGlvbiBwaGFzZXNcbiAgICB2YXIgcXVldWUgPSBfUXVldWVIYW5kbGVyKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgIC8vIERvZXMgbm90IGV4aXN0XG4gICAgaWYoIW5leHRTdGF0ZSkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcblxuICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnZXJyb3I6bm90Zm91bmQnLCBlcnJvciwgcmVxdWVzdCk7XG5cbiAgICAgICAgbmV4dChlcnJvcik7XG4gICAgICB9KTtcblxuICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgfSBlbHNlIGlmKF9jb21wYXJlU3RhdGVzKHByZXZTdGF0ZSwgbmV4dFN0YXRlKSkge1xuICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG5cbiAgICAvLyBFeGlzdHNcbiAgICB9IGVsc2Uge1xuXG4gICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgIF9zZWxmLmVtaXQoJ2NoYW5nZTpiZWdpbicsIHJlcXVlc3QpO1xuXG4gICAgICAgIC8vIFZhbGlkIHN0YXRlIGV4aXN0c1xuICAgICAgICBpZihwcmV2U3RhdGUpIF9wdXNoSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcblxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgIGlmKHVzZU1pZGRsZXdhcmUpIHtcbiAgICAgICAgcXVldWUuYWRkKF9sYXllckxpc3QpO1xuICAgICAgfVxuXG4gICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6ZW5kJywgcmVxdWVzdCk7XG4gICAgICAgIG5leHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFJ1blxuICAgIHF1ZXVlLmV4ZWN1dGUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6Y29tcGxldGUnLCBlcnIsIHJlcXVlc3QpO1xuXG4gICAgICBpZihjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBkYXRhIHBhcmFtZXRlcnMgZm9yIFN0YXRlUm91dGVyXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgb3B0aW9ucyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5vcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaGlzdG9yeUxlbmd0aCcpKSB7XG4gICAgICBfaGlzdG9yeUxlbmd0aCA9IG9wdGlvbnMuaGlzdG9yeUxlbmd0aDtcbiAgICAgIF9wdXNoSGlzdG9yeShudWxsKTtcbiAgICB9XG5cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldC9nZXQgc3RhdGUgZGF0YS4gIERlZmluZSB0aGUgc3RhdGVzLiAgXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbc3RhdGVdIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIG9iamVjdCwgb3B0aW9uYWxcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLnN0YXRlID0gZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICBpZighc3RhdGUpIHtcbiAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgfVxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHdpdGggY3VycmVudCBhZGRyZXNzIGFuZCBmYWxsYmFjayB0byBkZWZhdWx0LCBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQW4gaW5pdGlhbCBzdGF0ZSB0byBzdGFydCBpbi4gIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuaW5pdCA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG5cbiAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgIHZhciBpbml0YWxMb2NhdGlvbiA9IF91cmxEaWN0aW9uYXJ5Lmxvb2t1cCgkbG9jYXRpb24udXJsKCkpO1xuICAgICAgaWYoaW5pdGFsTG9jYXRpb24gIT09IG51bGwpIHtcbiAgICAgICAgX2NoYW5nZVN0YXRlKGluaXRhbExvY2F0aW9uLm5hbWUsIHBhcmFtcywgdHJ1ZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICB9IGVsc2UgaWYobmFtZSkge1xuICAgICAgICBfY2hhbmdlU3RhdGUobmFtZSwgcGFyYW1zLCB0cnVlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfc2VsZi5lbWl0KCdpbml0Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAvLyBJbml0aWFsaXplIG9ubHlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9zZWxmLmVtaXQoJ2luaXQnKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogQ2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLmNoYW5nZSA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIHByb2Nlc3MubmV4dFRpY2soYW5ndWxhci5iaW5kKG51bGwsIF9jaGFuZ2VTdGF0ZSwgbmFtZSwgcGFyYW1zLCB0cnVlKSk7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGFuZ2Ugc3RhdGUgYmFzZWQgb24gJGxvY2F0aW9uLnVybCgpLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiAgVXNlZCBpbnRlcm5hbGx5IGJ5ICR1cmxNYW5hZ2VyLlxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgIEEgdXJsIG1hdGNoaW5nIGRlZmluZCBzdGF0ZXNcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLiRsb2NhdGlvbiA9IGZ1bmN0aW9uKHVybCwgcGFyYW1zKSB7XG4gICAgdmFyIHN0YXRlID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG4gICAgaWYoc3RhdGUpIHtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soYW5ndWxhci5iaW5kKG51bGwsIF9jaGFuZ2VTdGF0ZSwgc3RhdGUubmFtZSwgcGFyYW1zLCBmYWxzZSkpO1xuICAgIH1cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBtaWRkbGV3YXJlLCBleGVjdXRpbmcgbmV4dChlcnIpO1xuICAgKiBcbiAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIGhhbmRsZXIgQSBjYWxsYmFjaywgZnVuY3Rpb24ocmVxdWVzdCwgbmV4dClcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLiR1c2UgPSBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgaWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBfbGF5ZXJMaXN0LnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICovXG4gIF9zZWxmLmN1cnJlbnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAqXG4gICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICBBIHRydWUgaWYgc3RhdGUgaXMgcGFyZW50IHRvIGN1cnJlbnQgc3RhdGVcbiAgICovXG4gIF9zZWxmLmFjdGl2ZSA9IGZ1bmN0aW9uKHF1ZXJ5LCBwYXJhbXMpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIE5vIHN0YXRlXG4gICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKHF1ZXJ5KTtcblxuICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgLy8gQ2FzdCBzdHJpbmcgdG8gUmVnRXhwXG4gICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAoY2FzdGVkKSk7XG5cbiAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gcXVlcnlcbiAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgaWYoaXRlbSA9PT0gJyonKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV9dKic7XG4gICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICByZXR1cm4gJ1thLXpBLVowLTlfXFxcXC5dKic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cCh0cmFuc2Zvcm1lZCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE5vbi1tYXRjaGluZ1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIF9zZWxmLnBhcnNlID0gX3BhcnNlTmFtZTtcblxuICAvKipcbiAgICogUmV0cmlldmUgZGVmaW5pdGlvbiBvZiBzdGF0ZXNcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIHN0YXRlc1xuICAgKi9cbiAgX3NlbGYubGlicmFyeSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfbGlicmFyeTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGlvblxuICAgKi9cbiAgX3NlbGYudmFsaWRhdGUgPSB7XG4gICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgIHF1ZXJ5OiBfdmFsaWRhdGVTdGF0ZVF1ZXJ5XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGhpc3RvcnlcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIHN0YXRlc1xuICAgKi9cbiAgX3NlbGYuaGlzdG9yeSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfaGlzdG9yeTtcbiAgfTtcblxuICAvLyBSZXR1cm4gaW5zdGFuY2VcbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZVJvdXRlcicsICckbG9jYXRpb24nLCBmdW5jdGlvbigkc3RhdGVSb3V0ZXIsICRsb2NhdGlvbikge1xuICB2YXIgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAvLyBJbnN0YW5jZSBvZiBFdmVudEVtaXR0ZXJcbiAgdmFyIF9zZWxmID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgdmFyIF9kZXRlY3RDaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgLy8gVE9ETyBwYXJzZSBwYXJhbXMgdG8gc3RhdGUgZGF0YVxuXG5cbiAgICAgIFxuXG5cblxuXG5cblxuXG4gICAgICAkc3RhdGVSb3V0ZXIuJGxvY2F0aW9uKF91cmwsIF9zZWxmKTtcblxuICAgICAgX3NlbGYuZW1pdCgndXBkYXRlOmxvY2F0aW9uJyk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgVVJMIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICB2YXIgX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGF0ZSA9ICRzdGF0ZVJvdXRlci5jdXJyZW50KCk7XG5cbiAgICBpZihzdGF0ZSAmJiBzdGF0ZS51cmwpIHtcbiAgICAgIF91cmwgPSBzdGF0ZS51cmw7XG5cbiAgICAgIC8vIFRPRE8gQWRkIHBhcmFtZXRlcnMgb3IgdXNlIGRlZmF1bHQgcGFyYW1ldGVyc1xuXG5cblxuXG5cblxuXG4gICAgICAkbG9jYXRpb24udXJsKF91cmwpO1xuICAgIH1cblxuICAgIF9zZWxmLmVtaXQoJ3VwZGF0ZScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvY2F0aW9uIHdhcyB1cGRhdGVkOyBmb3JjZSB1cGRhdGUgZGV0ZWN0aW9uXG4gICAqL1xuICBfc2VsZi5sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIF9kZXRlY3RDaGFuZ2UoYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZVJvdXRlci4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICBfdXBkYXRlKCk7XG4gICAgbmV4dCgpO1xuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUGFyc2UgT2JqZWN0IGxpdGVyYWwgbmFtZS12YWx1ZSBwYWlyc1xudmFyIHJlUGFyc2VPYmplY3RMaXRlcmFsID0gLyhbLHtdXFxzKigoXCJ8JykoLio/KVxcM3xcXHcqKXwoOlxccyooWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspP3x0cnVlfGZhbHNlfG51bGx8KFwifCcpKC4qPylcXDd8XFxbW15cXF1dKlxcXSkpKS9nO1xuXG4vLyBNYXRjaCBTdHJpbmdzXG52YXIgcmVTdHJpbmcgPSAvXihcInwnKSguKj8pXFwxJC87XG5cbi8vIFRPRE8gQWRkIGVzY2FwZWQgc3RyaW5nIHF1b3RlcyBcXCcgYW5kIFxcXCIgdG8gc3RyaW5nIG1hdGNoZXJcblxuLy8gTWF0Y2ggTnVtYmVyIChpbnQvZmxvYXQvZXhwb25lbnRpYWwpXG52YXIgcmVOdW1iZXIgPSAvXlsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT8kLztcblxuLyoqXG4gKiBQYXJzZSBzdHJpbmcgdmFsdWUgaW50byBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbC5cbiAqXG4gKiBTdHJpbmdzIGFyZSBzdXJyb3VuZGVkIGJ5IGEgcGFpciBvZiBtYXRjaGluZyBxdW90ZXNcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB2YWx1ZSBBIFN0cmluZyB2YWx1ZSB0byBwYXJzZVxuICogQHJldHVybiB7TWl4ZWR9ICAgICAgICBBIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsXG4gKi9cbnZhciBfcmVzb2x2ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcblxuICAvLyBCb29sZWFuOiB0cnVlXG4gIGlmKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICAvLyBCb29sZWFuOiBmYWxzZVxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTnVsbFxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdudWxsJykge1xuICAgIHJldHVybiBudWxsO1xuXG4gIC8vIFN0cmluZ1xuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVTdHJpbmcpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnN1YnN0cigxLCB2YWx1ZS5sZW5ndGgtMik7XG5cbiAgLy8gTnVtYmVyXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZU51bWJlcikpIHtcbiAgICByZXR1cm4gK3ZhbHVlO1xuXG4gIC8vIE5hTlxuICB9IGVsc2UgaWYodmFsdWUgPT09ICdOYU4nKSB7XG4gICAgcmV0dXJuIE5hTjtcblxuICAvLyBUT0RPIGFkZCBtYXRjaGluZyB3aXRoIEFycmF5cyBhbmQgcGFyc2VcbiAgXG4gIH1cblxuICAvLyBVbmFibGUgdG8gcmVzb2x2ZVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyBGaW5kIHZhbHVlcyBpbiBhbiBvYmplY3QgbGl0ZXJhbFxudmFyIF9saXN0aWZ5ID0gZnVuY3Rpb24oc3RyKSB7XG4gIHZhciBzYW5pdGl6ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvXltcXHssXT9cXHMqW1wiJ10/LywgJycpLnJlcGxhY2UoL1tcIiddP1xccyokLywgJycpO1xuICB9O1xuXG4gIHZhciBzYW5pdGl6ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc3RyID0gdmFsdWUucmVwbGFjZSgvXig6KT9cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuICAgIHJldHVybiBfcmVzb2x2ZVZhbHVlKHN0cik7XG4gIH07XG5cbiAgcmV0dXJuIHN0ci5tYXRjaChyZVBhcnNlT2JqZWN0TGl0ZXJhbCkubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICByZXR1cm4gaSUyID09PSAwID8gc2FuaXRpemVOYW1lKGl0ZW0pIDogc2FuaXRpemVWYWx1ZShpdGVtKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIHBhcmFtcyBPYmplY3QgZnJvbSBzdHJpbmdcbiAqIFxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBBIHN0cmluZ2lmaWVkIHZlcnNpb24gb2YgT2JqZWN0IGxpdGVyYWxcbiAqL1xudmFyIFBhcmFtZXRlcnMgPSBmdW5jdGlvbihzdHIpIHtcbiAgc3RyID0gc3RyIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIF9saXN0aWZ5KHN0cikuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgaWYoaSUyID09PSAwKSB7XG4gICAgICBfc2VsZltpdGVtXSA9IGxpc3RbaSsxXTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyYW1ldGVycztcblxubW9kdWxlLmV4cG9ydHMucmVzb2x2ZVZhbHVlID0gX3Jlc29sdmVWYWx1ZTtcbm1vZHVsZS5leHBvcnRzLmxpc3RpZnkgPSBfbGlzdGlmeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHdpbmRvdzpmYWxzZSAqL1xuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRJbW1lZGlhdGU6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRUaW1lb3V0OmZhbHNlICovXG5cbi8vIFBvbHlmaWxsIHByb2Nlc3MubmV4dFRpY2soKVxuXG5pZih3aW5kb3cpIHtcbiAgaWYoIXdpbmRvdy5wcm9jZXNzKSB7XG5cbiAgICB2YXIgX3Byb2Nlc3MgPSB7XG4gICAgICBuZXh0VGljazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIEV4cG9ydFxuICAgIHdpbmRvdy5wcm9jZXNzID0gX3Byb2Nlc3M7XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybCA9IHJlcXVpcmUoJy4vdXJsJyk7XG5cbi8qKlxuICogQ29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVXJsRGljdGlvbmFyeSgpIHtcbiAgdGhpcy5fcGF0dGVybnMgPSBbXTtcbiAgdGhpcy5fcmVmcyA9IFtdO1xufVxuXG4vKipcbiAqIEFzc29jaWF0ZSBhIFVSTCBwYXR0ZXJuIHdpdGggYSByZWZlcmVuY2VcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSBwYXR0ZXJuIEEgVVJMIHBhdHRlcm5cbiAqIEBwYXJhbSAge09iamVjdH0gcmVmICAgICBBIGRhdGEgT2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHBhdHRlcm4sIHJlZikge1xuICBwYXR0ZXJuID0gcGF0dGVybiB8fCAnJztcbiAgdmFyIF9zZWxmID0gdGhpcztcbiAgdmFyIGkgPSB0aGlzLl9wYXR0ZXJucy5sZW5ndGg7XG5cbiAgdmFyIHBhdGhDaGFpbjtcblxuICBpZihwYXR0ZXJuLmluZGV4T2YoJz8nKSA9PT0gLTEpIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG5cbiAgfSBlbHNlIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG4gIH1cblxuICAvLyBVUkwgbWF0Y2hpbmdcbiAgdmFyIGV4cHIgPSBcbiAgICAnXicgK1xuICAgIChwYXRoQ2hhaW4ubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICAgIHJldHVybiAnW2EtekEtWjAtOVxcXFwtX1xcXFwufl0rJztcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgfVxuICAgIH0pLmpvaW4oJ1xcXFwvJykpICtcbiAgICAnW1xcXFwvXT8kJztcblxuICB0aGlzLl9wYXR0ZXJuc1tpXSA9IG5ldyBSZWdFeHAoZXhwcik7XG4gIHRoaXMuX3JlZnNbaV0gPSByZWY7XG59O1xuXG4vKipcbiAqIEZpbmQgYSByZWZlcmVuY2UgYWNjb3JkaW5nIHRvIGEgVVJMIHBhdHRlcm5cbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB2YXIgaW5mbGVjdGVkID0gVXJsKHVybCB8fCAnJykucGF0aCgpO1xuXG4gIGZvcih2YXIgaT10aGlzLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgaWYoaW5mbGVjdGVkLm1hdGNoKHRoaXMuX3BhdHRlcm5zW2ldKSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3JlZnNbaV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIHJldHVybiB7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBhdGggb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5mbGVjdGVkID0gdXJsLnJlcGxhY2UoL1xcPy4qLywgJycpO1xuICAgICAgcmV0dXJuIGluZmxlY3RlZDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXN0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5mbGVjdGVkID0gdXJsLnJlcGxhY2UoLy4qXFw/LywgJycpO1xuICAgICAgcmV0dXJuIGluZmxlY3RlZDtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
