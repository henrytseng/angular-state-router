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
      if(!nameChain[i].match(/[a-zA-Z0-9]+/)) {
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
      if(!nameChain[i].match(/(\*(\*)?|[a-zA-Z0-9]+)/)) {
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
    var _copy = function(data) {
      // Copy
      data = angular.copy(data);

      // Track resolve
      if(data && data.resolve) {
        for(var n in data.resolve) {
          data.resolve[n] = true;
        }
      }

      return data;
    };
    var ai = _copy(a);
    var bi = _copy(b);

    return angular.equals(ai, bi);
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
   * @param  {String} name   A unique identifier for the state; using dot-notation
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
   * Internal method to store a state definition
   * 
   * @param  {String} name   A unique identifier for the state; using dot-notation
   * @param  {Object} [data] A state definition data Object, optional
   * @return {Object}        A state data Object
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

    // Clear cache on updates
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
   * Internal change to state.  
   * 
   * @param  {String}   name          A unique identifier for the state; using dot-notation
   * @param  {Object}   data          A data object
   * @param  {Boolean}  useMiddleware A flag to trigger middleware
   * @param  {Function} [callback]    A callback, function(err)
   */
  var _changeState = function(name, data, useMiddleware, callback) {
    useMiddleware = typeof useMiddleware === 'undefined' ? true : useMiddleware;

    var error = null;
    var request = {
      name: name,
      data: data
    };

    var nextState = _getState(name);
    var prevState = _current;

    // Set parameters
    nextState = nextState !== null ? angular.extend({}, nextState, data) : null;

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
   * Set configuration options for StateRouter
   * 
   * @param  {Object}      params A data Object
   * @return {StateRouter}        Itself; chainable
   */
  _self.options = function(params) {
    params = params || {};

    if(params.hasOwnProperty('historyLength')) {
      _historyLength = params.historyLength;
      _pushHistory(null);
    }

    return _self;
  };

  /**
   * Set/get state data.  Define the states.  
   *
   * @param  {String}      name   A unique identifier for the state; using dot-notation
   * @param  {Object}      [data] A state definition data object, optional
   * @return {StateRouter}        Itself; chainable
   */
  _self.state = function(name, data) {
    if(!data) {
      return _getState(name);
    }
    _defineState(name, data);
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
    return !_current ? null : angular.copy(_current);
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
              return '[a-zA-Z0-9]*';
            } else if(item === '**') {
              return '[a-zA-Z0-9\\.]*';
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
   * Assume all parameter values are strings; equivalent to URL querystring translation.  
   * 
   * @param  {String} name A name-params string
   * @return {Array}       A name string and param Object
   */
  _self.parse = function(name) {
    if(name && name.match(/[a-zA-Z0-9\.]*\(.*\)/)) {
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcGFyYW1ldGVycy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3Byb2Nlc3MuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3VybC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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OiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlUm91dGVyJywgZnVuY3Rpb24gKCRzdGF0ZVJvdXRlcikge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlUm91dGVyLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBQb2x5ZmlsbFxucmVxdWlyZSgnLi91dGlscy9wcm9jZXNzJyk7XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLmZhY3RvcnkoJyRzdGF0ZVJvdXRlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5ydW4oWyckcm9vdFNjb3BlJywgJyR1cmxNYW5hZ2VyJywgZnVuY3Rpb24oJHJvb3RTY29wZSwgJHVybE1hbmFnZXIpIHtcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgcHJvY2VzczpmYWxzZSAqL1xuXG52YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG52YXIgUGFyYW1ldGVycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3BhcmFtZXRlcnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRsb2NhdGlvbicsIGZ1bmN0aW9uKCRsb2NhdGlvbikge1xuICAvLyBDdXJyZW50IHN0YXRlXG4gIHZhciBfY3VycmVudDtcblxuICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgdmFyIF9oaXN0b3J5TGVuZ3RoID0gNTtcbiAgdmFyIF9oaXN0b3J5ID0gW107XG5cbiAgLy8gTGlicmFyeVxuICB2YXIgX2xpYnJhcnkgPSB7fTtcbiAgdmFyIF9jYWNoZSA9IHt9O1xuXG4gIC8vIFVSTCBkaWN0aW9uYXJ5XG4gIHZhciBfdXJsRGljdGlvbmFyeSA9IG5ldyBVcmxEaWN0aW9uYXJ5KCk7XG5cbiAgLy8gTWlkZGxld2FyZSBsYXllcnNcbiAgdmFyIF9sYXllckxpc3QgPSBbXTtcblxuICAvLyBJbnN0YW5jZSBvZiBFdmVudEVtaXR0ZXJcbiAgdmFyIF9zZWxmID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGRhdGEuaW5oZXJpdCA9ICh0eXBlb2YgZGF0YS5pbmhlcml0ID09PSAndW5kZWZpbmVkJykgPyB0cnVlIDogZGF0YS5pbmhlcml0O1xuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIG5hbWVcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goL1thLXpBLVowLTldKy8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgcXVlcnlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcXVlcnkgIEEgcXVlcnkgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV0rKS8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGFyZSB0d28gc3RhdGVzLCBjb21wYXJlcyB2YWx1ZXMuICBcbiAgICogXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3RhdGVzIGFyZSB0aGUgc2FtZSwgZmFsc2UgaWYgc3RhdGVzIGFyZSBkaWZmZXJlbnRcbiAgICovXG4gIHZhciBfY29tcGFyZVN0YXRlcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICB2YXIgX2NvcHkgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAvLyBDb3B5XG4gICAgICBkYXRhID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXG4gICAgICAvLyBUcmFjayByZXNvbHZlXG4gICAgICBpZihkYXRhICYmIGRhdGEucmVzb2x2ZSkge1xuICAgICAgICBmb3IodmFyIG4gaW4gZGF0YS5yZXNvbHZlKSB7XG4gICAgICAgICAgZGF0YS5yZXNvbHZlW25dID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9O1xuICAgIHZhciBhaSA9IF9jb3B5KGEpO1xuICAgIHZhciBiaSA9IF9jb3B5KGIpO1xuXG4gICAgcmV0dXJuIGFuZ3VsYXIuZXF1YWxzKGFpLCBiaSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9nZXRTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIHZhciBzdGF0ZSA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBxdWVyaWVzXG4gICAgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgLy8gVXNlIGNhY2hlIGlmIGV4aXN0c1xuICAgIH0gZWxzZSBpZihfY2FjaGVbbmFtZV0pIHtcbiAgICAgIHJldHVybiBfY2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG5cbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihwbmFtZSkge1xuICAgICAgICByZXR1cm4gX2xpYnJhcnlbcG5hbWVdO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICAgIHJldHVybiBwYXJlbnQgIT09IG51bGw7XG4gICAgICB9KTtcblxuICAgIC8vIFdhbGsgdXAgY2hlY2tpbmcgaW5oZXJpdGFuY2VcbiAgICBmb3IodmFyIGk9c3RhdGVDaGFpbi5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihzdGF0ZUNoYWluW2ldKSB7XG4gICAgICAgIHN0YXRlID0gYW5ndWxhci5leHRlbmQoYW5ndWxhci5jb3B5KHN0YXRlQ2hhaW5baV0pLCBzdGF0ZSB8fCB7fSk7XG4gICAgICB9XG5cbiAgICAgIGlmKHN0YXRlICYmICFzdGF0ZS5pbmhlcml0KSBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbiBjYWNoZVxuICAgIF9jYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtkYXRhXSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3QsIG9wdGlvbmFsXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfbGlicmFyeVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgLy8gQ2xlYXIgY2FjaGUgb24gdXBkYXRlc1xuICAgIF9jYWNoZSA9IHt9O1xuXG4gICAgLy8gVVJMIG1hcHBpbmdcbiAgICBpZihzdGF0ZS51cmwpIHtcbiAgICAgIF91cmxEaWN0aW9uYXJ5LmFkZChzdGF0ZS51cmwsIHN0YXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmKGRhdGEpIHtcbiAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IF9oaXN0b3J5TGVuZ3RoKSB7XG4gICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gX2hpc3RvcnlMZW5ndGgpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogRXhlY3V0ZSBhIHNlcmllcyBvZiBmdW5jdGlvbnM7IHVzZWQgaW4gdGFuZGVtIHdpdGggbWlkZGxld2FyZVxuICAgKi9cbiAgdmFyIF9RdWV1ZUhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2xpc3QgPSBbXTtcbiAgICB2YXIgX2RhdGEgPSBudWxsO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZDogZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgX2xpc3QgPSBfbGlzdC5jb25jYXQoaGFuZGxlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgX2RhdGEgPSBkYXRhO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgICAgbmV4dEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgaGFuZGxlciA9IF9saXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgICBpZighaGFuZGxlcikge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGhhbmRsZXIuY2FsbChudWxsLCBfZGF0YSwgZnVuY3Rpb24oZXJyKSB7XG5cbiAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgX3NlbGYuZW1pdCgnZXJyb3InLCBlcnIsIF9kYXRhKTtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgbmV4dEhhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBjaGFuZ2UgdG8gc3RhdGUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBkYXRhICAgICAgICAgIEEgZGF0YSBvYmplY3RcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gIHVzZU1pZGRsZXdhcmUgQSBmbGFnIHRvIHRyaWdnZXIgbWlkZGxld2FyZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSwgdXNlTWlkZGxld2FyZSwgY2FsbGJhY2spIHtcbiAgICB1c2VNaWRkbGV3YXJlID0gdHlwZW9mIHVzZU1pZGRsZXdhcmUgPT09ICd1bmRlZmluZWQnID8gdHJ1ZSA6IHVzZU1pZGRsZXdhcmU7XG5cbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciByZXF1ZXN0ID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9O1xuXG4gICAgdmFyIG5leHRTdGF0ZSA9IF9nZXRTdGF0ZShuYW1lKTtcbiAgICB2YXIgcHJldlN0YXRlID0gX2N1cnJlbnQ7XG5cbiAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgIG5leHRTdGF0ZSA9IG5leHRTdGF0ZSAhPT0gbnVsbCA/IGFuZ3VsYXIuZXh0ZW5kKHt9LCBuZXh0U3RhdGUsIGRhdGEpIDogbnVsbDtcblxuICAgIC8vIENvbXBpbGUgZXhlY3V0aW9uIHBoYXNlc1xuICAgIHZhciBxdWV1ZSA9IF9RdWV1ZUhhbmRsZXIoKS5kYXRhKHJlcXVlc3QpO1xuXG4gICAgLy8gRG9lcyBub3QgZXhpc3RcbiAgICBpZighbmV4dFN0YXRlKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuXG4gICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICBfc2VsZi5lbWl0KCdlcnJvcjpub3Rmb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcblxuICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICB9IGVsc2UgaWYoX2NvbXBhcmVTdGF0ZXMocHJldlN0YXRlLCBuZXh0U3RhdGUpKSB7XG4gICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcblxuICAgIC8vIEV4aXN0c1xuICAgIH0gZWxzZSB7XG5cbiAgICAgIC8vIFByb2Nlc3Mgc3RhcnRlZFxuICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnY2hhbmdlOmJlZ2luJywgcmVxdWVzdCk7XG5cbiAgICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICAgIGlmKHByZXZTdGF0ZSkgX3B1c2hIaXN0b3J5KHByZXZTdGF0ZSk7XG4gICAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuXG4gICAgICAgIG5leHQoKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBZGQgbWlkZGxld2FyZVxuICAgICAgaWYodXNlTWlkZGxld2FyZSkge1xuICAgICAgICBxdWV1ZS5hZGQoX2xheWVyTGlzdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFByb2Nlc3MgZW5kZWRcbiAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgIF9zZWxmLmVtaXQoJ2NoYW5nZTplbmQnLCByZXF1ZXN0KTtcbiAgICAgICAgbmV4dCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUnVuXG4gICAgcXVldWUuZXhlY3V0ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgIF9zZWxmLmVtaXQoJ2NoYW5nZTpjb21wbGV0ZScsIGVyciwgcmVxdWVzdCk7XG5cbiAgICAgIGlmKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBjb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIFN0YXRlUm91dGVyXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgcGFyYW1zIEEgZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYub3B0aW9ucyA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuICAgIGlmKHBhcmFtcy5oYXNPd25Qcm9wZXJ0eSgnaGlzdG9yeUxlbmd0aCcpKSB7XG4gICAgICBfaGlzdG9yeUxlbmd0aCA9IHBhcmFtcy5oaXN0b3J5TGVuZ3RoO1xuICAgICAgX3B1c2hIaXN0b3J5KG51bGwpO1xuICAgIH1cblxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0L2dldCBzdGF0ZSBkYXRhLiAgRGVmaW5lIHRoZSBzdGF0ZXMuICBcbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW2RhdGFdIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIG9iamVjdCwgb3B0aW9uYWxcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuc3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYoIWRhdGEpIHtcbiAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgfVxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBkYXRhKTtcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgd2l0aCBjdXJyZW50IGFkZHJlc3MgYW5kIGZhbGxiYWNrIHRvIGRlZmF1bHQsIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBbiBpbml0aWFsIHN0YXRlIHRvIHN0YXJ0IGluLiAgXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcblxuICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgdmFyIGluaXRhbExvY2F0aW9uID0gX3VybERpY3Rpb25hcnkubG9va3VwKCRsb2NhdGlvbi51cmwoKSk7XG4gICAgICBpZihpbml0YWxMb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICBfY2hhbmdlU3RhdGUoaW5pdGFsTG9jYXRpb24ubmFtZSwgcGFyYW1zLCB0cnVlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfc2VsZi5lbWl0KCdpbml0Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAvLyBJbml0aWFsaXplIHdpdGggc3RhdGVcbiAgICAgIH0gZWxzZSBpZihuYW1lKSB7XG4gICAgICAgIF9jaGFuZ2VTdGF0ZShuYW1lLCBwYXJhbXMsIHRydWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9zZWxmLmVtaXQoJ2luaXQnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIEluaXRpYWxpemUgb25seVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGFuZ2Ugc3RhdGUsIGFzeW5jaHJvbm91cyBvcGVyYXRpb25cbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuY2hhbmdlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBuYW1lLCBwYXJhbXMsIHRydWUpKTtcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uICBVc2VkIGludGVybmFsbHkgYnkgJHVybE1hbmFnZXIuXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgdXJsICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuJGxvY2F0aW9uID0gZnVuY3Rpb24odXJsLCBwYXJhbXMpIHtcbiAgICB2YXIgc3RhdGUgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcbiAgICBpZihzdGF0ZSkge1xuICAgICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBzdGF0ZS5uYW1lLCBwYXJhbXMsIGZhbHNlKSk7XG4gICAgfVxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIG1pZGRsZXdhcmUsIGV4ZWN1dGluZyBuZXh0KGVycik7XG4gICAqIFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgaGFuZGxlciBBIGNhbGxiYWNrLCBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KVxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuJHVzZSA9IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaWRkbGV3YXJlIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgIH1cblxuICAgIF9sYXllckxpc3QucHVzaChoYW5kbGVyKTtcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgKi9cbiAgX3NlbGYuY3VycmVudCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAhX2N1cnJlbnQgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAqXG4gICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICBBIHRydWUgaWYgc3RhdGUgaXMgcGFyZW50IHRvIGN1cnJlbnQgc3RhdGVcbiAgICovXG4gIF9zZWxmLmFjdGl2ZSA9IGZ1bmN0aW9uKHF1ZXJ5LCBwYXJhbXMpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIE5vIHN0YXRlXG4gICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKHF1ZXJ5KTtcblxuICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgLy8gQ2FzdCBzdHJpbmcgdG8gUmVnRXhwXG4gICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAoY2FzdGVkKSk7XG5cbiAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gcXVlcnlcbiAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgaWYoaXRlbSA9PT0gJyonKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV0qJztcbiAgICAgICAgICAgIH0gZWxzZSBpZihpdGVtID09PSAnKionKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOVxcXFwuXSonO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAqIFxuICAgKiBBc3N1bWUgYWxsIHBhcmFtZXRlciB2YWx1ZXMgYXJlIHN0cmluZ3M7IGVxdWl2YWxlbnQgdG8gVVJMIHF1ZXJ5c3RyaW5nIHRyYW5zbGF0aW9uLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgQSBuYW1lLXBhcmFtcyBzdHJpbmdcbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgIEEgbmFtZSBzdHJpbmcgYW5kIHBhcmFtIE9iamVjdFxuICAgKi9cbiAgX3NlbGYucGFyc2UgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYobmFtZSAmJiBuYW1lLm1hdGNoKC9bYS16QS1aMC05XFwuXSpcXCguKlxcKS8pKSB7XG4gICAgICB2YXIgbnBhcnQgPSBuYW1lLnN1YnN0cigwLCBuYW1lLmluZGV4T2YoJygnKSk7XG4gICAgICB2YXIgcHBhcnQgPSBQYXJhbWV0ZXJzKCBuYW1lLnN1YnN0cihuYW1lLmluZGV4T2YoJygnKSsxKSApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBucGFydCxcbiAgICAgICAgcGFyYW1zOiBwcGFydFxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBwYXJhbXM6IG51bGxcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBkZWZpbml0aW9uIG9mIHN0YXRlc1xuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGhhc2ggb2Ygc3RhdGVzXG4gICAqL1xuICBfc2VsZi5saWJyYXJ5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9saWJyYXJ5O1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0aW9uXG4gICAqL1xuICBfc2VsZi52YWxpZGF0ZSA9IHtcbiAgICBuYW1lOiBfdmFsaWRhdGVTdGF0ZU5hbWUsXG4gICAgcXVlcnk6IF92YWxpZGF0ZVN0YXRlUXVlcnlcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgaGlzdG9yeVxuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGhhc2ggb2Ygc3RhdGVzXG4gICAqL1xuICBfc2VsZi5oaXN0b3J5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9oaXN0b3J5O1xuICB9O1xuXG4gIC8vIFJldHVybiBpbnN0YW5jZVxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlUm91dGVyJywgJyRsb2NhdGlvbicsIGZ1bmN0aW9uKCRzdGF0ZVJvdXRlciwgJGxvY2F0aW9uKSB7XG4gIHZhciBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gIC8vIEluc3RhbmNlIG9mIEV2ZW50RW1pdHRlclxuICB2YXIgX3NlbGYgPSBuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcigpO1xuXG4gIC8qKlxuICAgKiBEZXRlY3QgVVJMIGNoYW5nZSBhbmQgZGlzcGF0Y2ggc3RhdGUgY2hhbmdlXG4gICAqL1xuICB2YXIgX2RldGVjdENoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsYXN0VXJsID0gX3VybDtcbiAgICB2YXIgbmV4dFVybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAgIGlmKG5leHRVcmwgIT09IGxhc3RVcmwpIHtcbiAgICAgIF91cmwgPSBuZXh0VXJsO1xuXG4gICAgICAvLyBUT0RPIHBhcnNlIHBhcmFtcyB0byBzdGF0ZSBkYXRhXG5cblxuICAgICAgXG5cblxuXG5cblxuXG5cbiAgICAgICRzdGF0ZVJvdXRlci4kbG9jYXRpb24oX3VybCwgX3NlbGYpO1xuXG4gICAgICBfc2VsZi5lbWl0KCd1cGRhdGU6bG9jYXRpb24nKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXRlID0gJHN0YXRlUm91dGVyLmN1cnJlbnQoKTtcblxuICAgIGlmKHN0YXRlICYmIHN0YXRlLnVybCkge1xuICAgICAgX3VybCA9IHN0YXRlLnVybDtcblxuICAgICAgLy8gVE9ETyBBZGQgcGFyYW1ldGVycyBvciB1c2UgZGVmYXVsdCBwYXJhbWV0ZXJzXG5cblxuXG5cblxuXG5cbiAgICAgICRsb2NhdGlvbi51cmwoX3VybCk7XG4gICAgfVxuXG4gICAgX3NlbGYuZW1pdCgndXBkYXRlJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogTG9jYXRpb24gd2FzIHVwZGF0ZWQ7IGZvcmNlIHVwZGF0ZSBkZXRlY3Rpb25cbiAgICovXG4gIF9zZWxmLmxvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgX2RldGVjdENoYW5nZShhcmd1bWVudHMpO1xuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlUm91dGVyLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIF91cGRhdGUoKTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBQYXJzZSBPYmplY3QgbGl0ZXJhbCBuYW1lLXZhbHVlIHBhaXJzXG52YXIgcmVQYXJzZU9iamVjdExpdGVyYWwgPSAvKFsse11cXHMqKChcInwnKSguKj8pXFwzfFxcdyopfCg6XFxzKihbKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/fHRydWV8ZmFsc2V8bnVsbHwoXCJ8JykoLio/KVxcN3xcXFtbXlxcXV0qXFxdKSkpL2c7XG5cbi8vIE1hdGNoIFN0cmluZ3NcbnZhciByZVN0cmluZyA9IC9eKFwifCcpKC4qPylcXDEkLztcblxuLy8gVE9ETyBBZGQgZXNjYXBlZCBzdHJpbmcgcXVvdGVzIFxcJyBhbmQgXFxcIiB0byBzdHJpbmcgbWF0Y2hlclxuXG4vLyBNYXRjaCBOdW1iZXIgKGludC9mbG9hdC9leHBvbmVudGlhbClcbnZhciByZU51bWJlciA9IC9eWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspPyQvO1xuXG4vKipcbiAqIFBhcnNlIHN0cmluZyB2YWx1ZSBpbnRvIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsLlxuICpcbiAqIFN0cmluZ3MgYXJlIHN1cnJvdW5kZWQgYnkgYSBwYWlyIG9mIG1hdGNoaW5nIHF1b3Rlc1xuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHZhbHVlIEEgU3RyaW5nIHZhbHVlIHRvIHBhcnNlXG4gKiBAcmV0dXJuIHtNaXhlZH0gICAgICAgIEEgQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGxcbiAqL1xudmFyIF9yZXNvbHZlVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXG4gIC8vIEJvb2xlYW46IHRydWVcbiAgaWYodmFsdWUgPT09ICd0cnVlJykge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIC8vIEJvb2xlYW46IGZhbHNlXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ2ZhbHNlJykge1xuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBOdWxsXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ251bGwnKSB7XG4gICAgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RyaW5nXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZVN0cmluZykpIHtcbiAgICByZXR1cm4gdmFsdWUuc3Vic3RyKDEsIHZhbHVlLmxlbmd0aC0yKTtcblxuICAvLyBOdW1iZXJcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlTnVtYmVyKSkge1xuICAgIHJldHVybiArdmFsdWU7XG5cbiAgLy8gTmFOXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ05hTicpIHtcbiAgICByZXR1cm4gTmFOO1xuXG4gIC8vIFRPRE8gYWRkIG1hdGNoaW5nIHdpdGggQXJyYXlzIGFuZCBwYXJzZVxuICBcbiAgfVxuXG4gIC8vIFVuYWJsZSB0byByZXNvbHZlXG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIEZpbmQgdmFsdWVzIGluIGFuIG9iamVjdCBsaXRlcmFsXG52YXIgX2xpc3RpZnkgPSBmdW5jdGlvbihzdHIpIHtcbiAgdmFyIHNhbml0aXplTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9eW1xceyxdP1xccypbXCInXT8vLCAnJykucmVwbGFjZSgvW1wiJ10/XFxzKiQvLCAnJyk7XG4gIH07XG5cbiAgdmFyIHNhbml0aXplVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzdHIgPSB2YWx1ZS5yZXBsYWNlKC9eKDopP1xccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgcmV0dXJuIF9yZXNvbHZlVmFsdWUoc3RyKTtcbiAgfTtcblxuICByZXR1cm4gc3RyLm1hdGNoKHJlUGFyc2VPYmplY3RMaXRlcmFsKS5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIHJldHVybiBpJTIgPT09IDAgPyBzYW5pdGl6ZU5hbWUoaXRlbSkgOiBzYW5pdGl6ZVZhbHVlKGl0ZW0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFyYW1zIE9iamVjdCBmcm9tIHN0cmluZ1xuICogXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5naWZpZWQgdmVyc2lvbiBvZiBPYmplY3QgbGl0ZXJhbFxuICovXG52YXIgUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHN0cikge1xuICBzdHIgPSBzdHIgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgX2xpc3RpZnkoc3RyKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICBpZihpJTIgPT09IDApIHtcbiAgICAgIF9zZWxmW2l0ZW1dID0gbGlzdFtpKzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYXJhbWV0ZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5yZXNvbHZlVmFsdWUgPSBfcmVzb2x2ZVZhbHVlO1xubW9kdWxlLmV4cG9ydHMubGlzdGlmeSA9IF9saXN0aWZ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgd2luZG93OmZhbHNlICovXG4vKiBnbG9iYWwgcHJvY2VzczpmYWxzZSAqL1xuLyogZ2xvYmFsIHNldEltbWVkaWF0ZTpmYWxzZSAqL1xuLyogZ2xvYmFsIHNldFRpbWVvdXQ6ZmFsc2UgKi9cblxuLy8gUG9seWZpbGwgcHJvY2Vzcy5uZXh0VGljaygpXG5cbmlmKHdpbmRvdykge1xuICBpZighd2luZG93LnByb2Nlc3MpIHtcblxuICAgIHZhciBfcHJvY2VzcyA9IHtcbiAgICAgIG5leHRUaWNrOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gRXhwb3J0XG4gICAgd2luZG93LnByb2Nlc3MgPSBfcHJvY2VzcztcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsID0gcmVxdWlyZSgnLi91cmwnKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBVcmxEaWN0aW9uYXJ5KCkge1xuICB0aGlzLl9wYXR0ZXJucyA9IFtdO1xuICB0aGlzLl9yZWZzID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuXG4gIGlmKHBhdHRlcm4uaW5kZXhPZignPycpID09PSAtMSkge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcblxuICB9IGVsc2Uge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcbiAgfVxuXG4gIC8vIFVSTCBtYXRjaGluZ1xuICB2YXIgZXhwciA9IFxuICAgICdeJyArXG4gICAgKHBhdGhDaGFpbi5tYXAoZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgIGlmKGNodW5rWzBdID09PSAnOicpIHtcbiAgICAgICAgcmV0dXJuICdbYS16QS1aMC05XFxcXC1fXFxcXC5+XSsnO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICB9XG4gICAgfSkuam9pbignXFxcXC8nKSkgK1xuICAgICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChleHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbn07XG5cbi8qKlxuICogRmluZCBhIHJlZmVyZW5jZSBhY2NvcmRpbmcgdG8gYSBVUkwgcGF0dGVyblxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgIEEgVVJMIHRvIHRlc3QgZm9yXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRlZmF1bHRzIEEgZGF0YSBPYmplY3Qgb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIEEgcmVmZXJlbmNlIHRvIGEgc3RvcmVkIG9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbih1cmwsIGRlZmF1bHRzKSB7XG4gIHZhciBpbmZsZWN0ZWQgPSBVcmwodXJsIHx8ICcnKS5wYXRoKCk7XG5cbiAgZm9yKHZhciBpPXRoaXMuX3BhdHRlcm5zLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICBpZihpbmZsZWN0ZWQubWF0Y2godGhpcy5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcmVmc1tpXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsRGljdGlvbmFyeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVXJsKHVybCkge1xuICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgcmV0dXJuIHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbmZsZWN0ZWQgPSB1cmwucmVwbGFjZSgvXFw/LiovLCAnJyk7XG4gICAgICByZXR1cm4gaW5mbGVjdGVkO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5c3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbmZsZWN0ZWQgPSB1cmwucmVwbGFjZSgvLipcXD8vLCAnJyk7XG4gICAgICByZXR1cm4gaW5mbGVjdGVkO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmw7XG4iXX0=
