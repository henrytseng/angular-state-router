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

},{"./directives/sref":3,"./services/state-router":5,"./services/url-manager":6,"./utils/process":7}],5:[function(require,module,exports){
(function (process){
'use strict';

/* global process:false */

var events = require('events');
var UrlDictionary = require('../utils/url-dictionary');

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
   * @param  {String}      name   An initial state to start in.  
   * @param  {Object}      [data] A data object
   * @return {StateRouter}        Itself; chainable
   */
  _self.init = function(name, data) {
    process.nextTick(function() {

      // Initial location
      var initalLocation = _urlDictionary.lookup($location.url());
      if(initalLocation !== null) {
        _changeState(initalLocation.name, data, true, function() {
          _self.emit('init');
        });

      // Initialize with state
      } else if(name) {
        _changeState(name, data, true, function() {
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
   * @param  {String}      name   A unique identifier for the state; using dot-notation
   * @param  {Object}      [data] A parameters data object
   * @return {StateRouter}        Itself; chainable
   */
  _self.change = function(name, data) {
    process.nextTick(angular.bind(null, _changeState, name, data, true));
    return _self;
  };

  /**
   * Change state based on $location.url(), asynchronous operation.  Used internally by $urlManager.
   * 
   * @param  {String}      url A url matching defind states
   * @return {StateRouter}     Itself; chainable
   */
  _self.$location = function(url, data) {
    var state = _urlDictionary.lookup(url);
    if(state) {
      process.nextTick(angular.bind(null, _changeState, state.name, data, false));
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
   * @return {Boolean}        A true if state is parent to current state
   */
  _self.active = function(query) {
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

},{"../utils/url-dictionary":8,"_process":2,"events":1}],6:[function(require,module,exports){
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

},{"../utils/url-dictionary":8,"events":1}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{"./url":9}],9:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcHJvY2Vzcy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3VybC1kaWN0aW9uYXJ5LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUFNLE9BQU8sS0FBSztRQUNuQixPQUFPOzthQUVGO1FBQ0wsT0FBTzs7T0FFUixLQUFLO0lBQ1I7O0VBRUYsS0FBSyxVQUFVLEtBQUssSUFBSSxPQUFPO0VBQy9CLEtBQUssTUFBTSxLQUFLOzs7Ozs7Ozs7O0FBVWxCLGNBQWMsVUFBVSxTQUFTLFNBQVMsS0FBSyxVQUFVO0VBQ3ZELElBQUksWUFBWSxJQUFJLE9BQU8sSUFBSTs7RUFFL0IsSUFBSSxJQUFJLEVBQUUsS0FBSyxVQUFVLE9BQU8sR0FBRyxHQUFHLEdBQUcsS0FBSztJQUM1QyxHQUFHLFVBQVUsTUFBTSxLQUFLLFVBQVUsUUFBUSxNQUFNO01BQzlDLE9BQU8sS0FBSyxNQUFNOzs7O0VBSXRCLE9BQU87OztBQUdULE9BQU8sVUFBVTtBQUNqQjs7QUNyRUE7O0FBRUEsU0FBUyxJQUFJLEtBQUs7RUFDaEIsTUFBTSxPQUFPOztFQUViLE9BQU87Ozs7Ozs7SUFPTCxNQUFNLFdBQVc7TUFDZixJQUFJLFlBQVksSUFBSSxRQUFRLFFBQVE7TUFDcEMsT0FBTzs7Ozs7Ozs7SUFRVCxhQUFhLFdBQVc7TUFDdEIsSUFBSSxZQUFZLElBQUksUUFBUSxRQUFRO01BQ3BDLE9BQU87Ozs7O0FBS2IsT0FBTyxVQUFVO0FBQ2pCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlUm91dGVyJywgZnVuY3Rpb24gKCRzdGF0ZVJvdXRlcikge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgc2NvcGU6IHtcbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgZWxlbWVudC5jc3MoJ2N1cnNvcicsICdwb2ludGVyJyk7XG4gICAgICBlbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJHN0YXRlUm91dGVyLmNoYW5nZShhdHRycy5zcmVmKTtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS1yb3V0ZXInO1xufVxuXG4vLyBQb2x5ZmlsbFxucmVxdWlyZSgnLi91dGlscy9wcm9jZXNzJyk7XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLmZhY3RvcnkoJyRzdGF0ZVJvdXRlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5ydW4oWyckcm9vdFNjb3BlJywgJyR1cmxNYW5hZ2VyJywgZnVuY3Rpb24oJHJvb3RTY29wZSwgJHVybE1hbmFnZXIpIHtcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcbiAgfV0pXG5cbiAgLmRpcmVjdGl2ZSgnc3JlZicsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zcmVmJykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgcHJvY2VzczpmYWxzZSAqL1xuXG52YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckbG9jYXRpb24nLCBmdW5jdGlvbigkbG9jYXRpb24pIHtcbiAgLy8gQ3VycmVudCBzdGF0ZVxuICB2YXIgX2N1cnJlbnQ7XG5cbiAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gIHZhciBfaGlzdG9yeUxlbmd0aCA9IDU7XG4gIHZhciBfaGlzdG9yeSA9IFtdO1xuXG4gIC8vIExpYnJhcnlcbiAgdmFyIF9saWJyYXJ5ID0ge307XG4gIHZhciBfY2FjaGUgPSB7fTtcblxuICAvLyBVUkwgZGljdGlvbmFyeVxuICB2YXIgX3VybERpY3Rpb25hcnkgPSBuZXcgVXJsRGljdGlvbmFyeSgpO1xuXG4gIC8vIE1pZGRsZXdhcmUgbGF5ZXJzXG4gIHZhciBfbGF5ZXJMaXN0ID0gW107XG5cbiAgLy8gSW5zdGFuY2Ugb2YgRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG5cbiAgLyoqXG4gICAqIEFkZCBkZWZhdWx0IHZhbHVlcyB0byBhIHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBbiBPYmplY3RcbiAgICovXG4gIHZhciBfc2V0U3RhdGVEZWZhdWx0cyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05XSsvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIHF1ZXJ5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHF1ZXJ5ICBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlUXVlcnkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IHF1ZXJ5LnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC8oXFwqKFxcKik/fFthLXpBLVowLTldKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgdmFyIF9jb3B5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gQ29weVxuICAgICAgZGF0YSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgICAgLy8gVHJhY2sgcmVzb2x2ZVxuICAgICAgaWYoZGF0YSAmJiBkYXRhLnJlc29sdmUpIHtcbiAgICAgICAgZm9yKHZhciBuIGluIGRhdGEucmVzb2x2ZSkge1xuICAgICAgICAgIGRhdGEucmVzb2x2ZVtuXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfTtcbiAgICB2YXIgYWkgPSBfY29weShhKTtcbiAgICB2YXIgYmkgPSBfY29weShiKTtcblxuICAgIHJldHVybiBhbmd1bGFyLmVxdWFscyhhaSwgYmkpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIHBhcmVudCBzdGF0ZXNcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgIEFuIEFycmF5IG9mIHBhcmVudCBzdGF0ZXNcbiAgICovXG4gIHZhciBfZ2V0TmFtZUNoYWluID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBuYW1lTGlzdCA9IG5hbWUuc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBuYW1lTGlzdFxuICAgICAgLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgICAgIHJldHVybiBsaXN0LnNsaWNlKDAsIGkrMSkuam9pbignLicpO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbnVsbDtcbiAgICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY3Jhd2wgbGlicmFyeSBoZWlyYXJjaHlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICB2YXIgc3RhdGUgPSBudWxsO1xuXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgcXVlcmllc1xuICAgIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIC8vIFVzZSBjYWNoZSBpZiBleGlzdHNcbiAgICB9IGVsc2UgaWYoX2NhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX2NhY2hlW25hbWVdO1xuICAgIH1cblxuICAgIHZhciBuYW1lQ2hhaW4gPSBfZ2V0TmFtZUNoYWluKG5hbWUpO1xuXG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24ocG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIF9saWJyYXJ5W3BuYW1lXTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gcGFyZW50ICE9PSBudWxsO1xuICAgICAgfSk7XG5cbiAgICAvLyBXYWxrIHVwIGNoZWNraW5nIGluaGVyaXRhbmNlXG4gICAgZm9yKHZhciBpPXN0YXRlQ2hhaW4ubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoc3RhdGVDaGFpbltpXSkge1xuICAgICAgICBzdGF0ZSA9IGFuZ3VsYXIuZXh0ZW5kKGFuZ3VsYXIuY29weShzdGF0ZUNoYWluW2ldKSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiAhc3RhdGUuaW5oZXJpdCkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfY2FjaGVbbmFtZV0gPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHN0b3JlIGEgc3RhdGUgZGVmaW5pdGlvblxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbZGF0YV0gQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0LCBvcHRpb25hbFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2RlZmluZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKG5hbWUgPT09IG51bGwgfHwgdHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05hbWUgY2Fubm90IGJlIG51bGwuJyk7XG4gICAgXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgbmFtZXNcbiAgICB9IGVsc2UgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0YXRlIG5hbWUuJyk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHN0YXRlXG4gICAgdmFyIHN0YXRlID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXG4gICAgLy8gVXNlIGRlZmF1bHRzXG4gICAgX3NldFN0YXRlRGVmYXVsdHMoc3RhdGUpO1xuXG4gICAgLy8gTmFtZWQgc3RhdGVcbiAgICBzdGF0ZS5uYW1lID0gbmFtZTtcblxuICAgIC8vIFNldCBkZWZpbml0aW9uXG4gICAgX2xpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIC8vIENsZWFyIGNhY2hlIG9uIHVwZGF0ZXNcbiAgICBfY2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9wdXNoSGlzdG9yeSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZihkYXRhKSB7XG4gICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBfaGlzdG9yeUxlbmd0aCkge1xuICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIF9oaXN0b3J5TGVuZ3RoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSBzZXJpZXMgb2YgZnVuY3Rpb25zOyB1c2VkIGluIHRhbmRlbSB3aXRoIG1pZGRsZXdhcmVcbiAgICovXG4gIHZhciBfUXVldWVIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIF9saXN0ID0gW107XG4gICAgdmFyIF9kYXRhID0gbnVsbDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgICAgaWYoaGFuZGxlciAmJiBoYW5kbGVyLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9saXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICBkYXRhOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB2YXIgbmV4dEhhbmRsZXI7XG4gICAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGhhbmRsZXIgPSBfbGlzdC5zaGlmdCgpO1xuXG4gICAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuXG4gICAgICAgICAgICAvLyBFcnJvclxuICAgICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAgIF9zZWxmLmVtaXQoJ2Vycm9yJywgZXJyLCBfZGF0YSk7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cbiAgICAgICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgY2hhbmdlIHRvIHN0YXRlLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgbmFtZSAgICAgICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgZGF0YSAgICAgICAgICBBIGRhdGEgb2JqZWN0XG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICB1c2VNaWRkbGV3YXJlIEEgZmxhZyB0byB0cmlnZ2VyIG1pZGRsZXdhcmVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYWxsYmFja10gICAgQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgKi9cbiAgdmFyIF9jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEsIHVzZU1pZGRsZXdhcmUsIGNhbGxiYWNrKSB7XG4gICAgdXNlTWlkZGxld2FyZSA9IHR5cGVvZiB1c2VNaWRkbGV3YXJlID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiB1c2VNaWRkbGV3YXJlO1xuXG4gICAgdmFyIGVycm9yID0gbnVsbDtcbiAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgICBkYXRhOiBkYXRhXG4gICAgfTtcblxuICAgIHZhciBuZXh0U3RhdGUgPSBfZ2V0U3RhdGUobmFtZSk7XG4gICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgLy8gU2V0IHBhcmFtZXRlcnNcbiAgICBuZXh0U3RhdGUgPSBuZXh0U3RhdGUgIT09IG51bGwgPyBhbmd1bGFyLmV4dGVuZCh7fSwgbmV4dFN0YXRlLCBkYXRhKSA6IG51bGw7XG5cbiAgICAvLyBDb21waWxlIGV4ZWN1dGlvbiBwaGFzZXNcbiAgICB2YXIgcXVldWUgPSBfUXVldWVIYW5kbGVyKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgIC8vIERvZXMgbm90IGV4aXN0XG4gICAgaWYoIW5leHRTdGF0ZSkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcblxuICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnZXJyb3I6bm90Zm91bmQnLCBlcnJvciwgcmVxdWVzdCk7XG5cbiAgICAgICAgbmV4dChlcnJvcik7XG4gICAgICB9KTtcblxuICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgfSBlbHNlIGlmKF9jb21wYXJlU3RhdGVzKHByZXZTdGF0ZSwgbmV4dFN0YXRlKSkge1xuICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG5cbiAgICAvLyBFeGlzdHNcbiAgICB9IGVsc2Uge1xuXG4gICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgIF9zZWxmLmVtaXQoJ2NoYW5nZTpiZWdpbicsIHJlcXVlc3QpO1xuXG4gICAgICAgIC8vIFZhbGlkIHN0YXRlIGV4aXN0c1xuICAgICAgICBpZihwcmV2U3RhdGUpIF9wdXNoSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcblxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgIGlmKHVzZU1pZGRsZXdhcmUpIHtcbiAgICAgICAgcXVldWUuYWRkKF9sYXllckxpc3QpO1xuICAgICAgfVxuXG4gICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6ZW5kJywgcmVxdWVzdCk7XG4gICAgICAgIG5leHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFJ1blxuICAgIHF1ZXVlLmV4ZWN1dGUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6Y29tcGxldGUnLCBlcnIsIHJlcXVlc3QpO1xuXG4gICAgICBpZihjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBTdGF0ZVJvdXRlclxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIHBhcmFtcyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLm9wdGlvbnMgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG5cbiAgICBpZihwYXJhbXMuaGFzT3duUHJvcGVydHkoJ2hpc3RvcnlMZW5ndGgnKSkge1xuICAgICAgX2hpc3RvcnlMZW5ndGggPSBwYXJhbXMuaGlzdG9yeUxlbmd0aDtcbiAgICAgIF9wdXNoSGlzdG9yeShudWxsKTtcbiAgICB9XG5cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldC9nZXQgc3RhdGUgZGF0YS4gIERlZmluZSB0aGUgc3RhdGVzLiAgXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtkYXRhXSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBvYmplY3QsIG9wdGlvbmFsXG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLnN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKCFkYXRhKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgZGF0YSk7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHdpdGggY3VycmVudCBhZGRyZXNzIGFuZCBmYWxsYmFjayB0byBkZWZhdWx0LCBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgIEFuIGluaXRpYWwgc3RhdGUgdG8gc3RhcnQgaW4uICBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtkYXRhXSBBIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLmluaXQgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcblxuICAgICAgLy8gSW5pdGlhbCBsb2NhdGlvblxuICAgICAgdmFyIGluaXRhbExvY2F0aW9uID0gX3VybERpY3Rpb25hcnkubG9va3VwKCRsb2NhdGlvbi51cmwoKSk7XG4gICAgICBpZihpbml0YWxMb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICBfY2hhbmdlU3RhdGUoaW5pdGFsTG9jYXRpb24ubmFtZSwgZGF0YSwgdHJ1ZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICB9IGVsc2UgaWYobmFtZSkge1xuICAgICAgICBfY2hhbmdlU3RhdGUobmFtZSwgZGF0YSwgdHJ1ZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBvbmx5XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfc2VsZi5lbWl0KCdpbml0Jyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoYW5nZSBzdGF0ZSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvblxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW2RhdGFdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5jaGFuZ2UgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBuYW1lLCBkYXRhLCB0cnVlKSk7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGFuZ2Ugc3RhdGUgYmFzZWQgb24gJGxvY2F0aW9uLnVybCgpLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiAgVXNlZCBpbnRlcm5hbGx5IGJ5ICR1cmxNYW5hZ2VyLlxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCBBIHVybCBtYXRjaGluZyBkZWZpbmQgc3RhdGVzXG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLiRsb2NhdGlvbiA9IGZ1bmN0aW9uKHVybCwgZGF0YSkge1xuICAgIHZhciBzdGF0ZSA9IF91cmxEaWN0aW9uYXJ5Lmxvb2t1cCh1cmwpO1xuICAgIGlmKHN0YXRlKSB7XG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGFuZ3VsYXIuYmluZChudWxsLCBfY2hhbmdlU3RhdGUsIHN0YXRlLm5hbWUsIGRhdGEsIGZhbHNlKSk7XG4gICAgfVxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIG1pZGRsZXdhcmUsIGV4ZWN1dGluZyBuZXh0KGVycik7XG4gICAqIFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgaGFuZGxlciBBIGNhbGxiYWNrLCBmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KVxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuJHVzZSA9IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICBpZih0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaWRkbGV3YXJlIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgIH1cblxuICAgIF9sYXllckxpc3QucHVzaChoYW5kbGVyKTtcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgKi9cbiAgX3NlbGYuY3VycmVudCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAhX2N1cnJlbnQgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAqXG4gICAqIEBwYXJhbSAge01peGVkfSAgIHF1ZXJ5ICBBIHN0cmluZyB1c2luZyBzdGF0ZSBub3RhdGlvbiBvciBhIFJlZ0V4cFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAqL1xuICBfc2VsZi5hY3RpdmUgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgXG4gICAgLy8gTm8gc3RhdGVcbiAgICBpZighX2N1cnJlbnQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICB9IGVsc2UgaWYocXVlcnkgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gocXVlcnkpO1xuXG4gICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICB9IGVsc2UgaWYodHlwZW9mIHF1ZXJ5ID09PSAnc3RyaW5nJykge1xuXG4gICAgICAvLyBDYXN0IHN0cmluZyB0byBSZWdFeHBcbiAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgdmFyIGNhc3RlZCA9IHF1ZXJ5LnN1YnN0cigxLCBxdWVyeS5sZW5ndGgtMik7XG4gICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cChjYXN0ZWQpKTtcblxuICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSBxdWVyeVxuICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICBpZihpdGVtID09PSAnKicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05XSonO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGl0ZW0gPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05XFxcXC5dKic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgIHJldHVybiAhIV9jdXJyZW50Lm5hbWUubWF0Y2gobmV3IFJlZ0V4cCh0cmFuc2Zvcm1lZCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE5vbi1tYXRjaGluZ1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgZGVmaW5pdGlvbiBvZiBzdGF0ZXNcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIHN0YXRlc1xuICAgKi9cbiAgX3NlbGYubGlicmFyeSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfbGlicmFyeTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGlvblxuICAgKi9cbiAgX3NlbGYudmFsaWRhdGUgPSB7XG4gICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgIHF1ZXJ5OiBfdmFsaWRhdGVTdGF0ZVF1ZXJ5XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGhpc3RvcnlcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIHN0YXRlc1xuICAgKi9cbiAgX3NlbGYuaGlzdG9yeSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfaGlzdG9yeTtcbiAgfTtcblxuICAvLyBSZXR1cm4gaW5zdGFuY2VcbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZVJvdXRlcicsICckbG9jYXRpb24nLCBmdW5jdGlvbigkc3RhdGVSb3V0ZXIsICRsb2NhdGlvbikge1xuICB2YXIgX3VybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAvLyBJbnN0YW5jZSBvZiBFdmVudEVtaXR0ZXJcbiAgdmFyIF9zZWxmID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgdmFyIF9kZXRlY3RDaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgLy8gVE9ETyBwYXJzZSBwYXJhbXMgdG8gc3RhdGUgZGF0YVxuXG5cbiAgICAgIFxuXG5cblxuXG5cblxuXG4gICAgICAkc3RhdGVSb3V0ZXIuJGxvY2F0aW9uKF91cmwsIF9zZWxmKTtcblxuICAgICAgX3NlbGYuZW1pdCgndXBkYXRlOmxvY2F0aW9uJyk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgVVJMIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICB2YXIgX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGF0ZSA9ICRzdGF0ZVJvdXRlci5jdXJyZW50KCk7XG5cbiAgICBpZihzdGF0ZSAmJiBzdGF0ZS51cmwpIHtcbiAgICAgIF91cmwgPSBzdGF0ZS51cmw7XG5cbiAgICAgIC8vIFRPRE8gQWRkIHBhcmFtZXRlcnMgb3IgdXNlIGRlZmF1bHQgcGFyYW1ldGVyc1xuXG5cblxuXG5cblxuXG4gICAgICAkbG9jYXRpb24udXJsKF91cmwpO1xuICAgIH1cblxuICAgIF9zZWxmLmVtaXQoJ3VwZGF0ZScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgdXJsIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICBfc2VsZi51cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICBfdXBkYXRlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvY2F0aW9uIHdhcyB1cGRhdGVkOyBmb3JjZSB1cGRhdGUgZGV0ZWN0aW9uXG4gICAqL1xuICBfc2VsZi5sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIF9kZXRlY3RDaGFuZ2UoYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZVJvdXRlci4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICBfdXBkYXRlKCk7XG4gICAgbmV4dCgpO1xuICB9KTtcblxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHdpbmRvdzpmYWxzZSAqL1xuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRJbW1lZGlhdGU6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRUaW1lb3V0OmZhbHNlICovXG5cbi8vIFBvbHlmaWxsIHByb2Nlc3MubmV4dFRpY2soKVxuXG5pZih3aW5kb3cpIHtcbiAgaWYoIXdpbmRvdy5wcm9jZXNzKSB7XG5cbiAgICB2YXIgX3Byb2Nlc3MgPSB7XG4gICAgICBuZXh0VGljazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIEV4cG9ydFxuICAgIHdpbmRvdy5wcm9jZXNzID0gX3Byb2Nlc3M7XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVybCA9IHJlcXVpcmUoJy4vdXJsJyk7XG5cbi8qKlxuICogQ29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVXJsRGljdGlvbmFyeSgpIHtcbiAgdGhpcy5fcGF0dGVybnMgPSBbXTtcbiAgdGhpcy5fcmVmcyA9IFtdO1xufVxuXG4vKipcbiAqIEFzc29jaWF0ZSBhIFVSTCBwYXR0ZXJuIHdpdGggYSByZWZlcmVuY2VcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSBwYXR0ZXJuIEEgVVJMIHBhdHRlcm5cbiAqIEBwYXJhbSAge09iamVjdH0gcmVmICAgICBBIGRhdGEgT2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHBhdHRlcm4sIHJlZikge1xuICBwYXR0ZXJuID0gcGF0dGVybiB8fCAnJztcbiAgdmFyIF9zZWxmID0gdGhpcztcbiAgdmFyIGkgPSB0aGlzLl9wYXR0ZXJucy5sZW5ndGg7XG5cbiAgdmFyIHBhdGhDaGFpbjtcblxuICBpZihwYXR0ZXJuLmluZGV4T2YoJz8nKSA9PT0gLTEpIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG5cbiAgfSBlbHNlIHtcbiAgICBwYXRoQ2hhaW4gPSBVcmwocGF0dGVybikucGF0aCgpLnNwbGl0KCcvJyk7XG4gIH1cblxuICAvLyBVUkwgbWF0Y2hpbmdcbiAgdmFyIGV4cHIgPSBcbiAgICAnXicgK1xuICAgIChwYXRoQ2hhaW4ubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICAgIHJldHVybiAnW2EtekEtWjAtOVxcXFwtX1xcXFwufl0rJztcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgfVxuICAgIH0pLmpvaW4oJ1xcXFwvJykpICtcbiAgICAnW1xcXFwvXT8kJztcblxuICB0aGlzLl9wYXR0ZXJuc1tpXSA9IG5ldyBSZWdFeHAoZXhwcik7XG4gIHRoaXMuX3JlZnNbaV0gPSByZWY7XG59O1xuXG4vKipcbiAqIEZpbmQgYSByZWZlcmVuY2UgYWNjb3JkaW5nIHRvIGEgVVJMIHBhdHRlcm5cbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB2YXIgaW5mbGVjdGVkID0gVXJsKHVybCB8fCAnJykucGF0aCgpO1xuXG4gIGZvcih2YXIgaT10aGlzLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgaWYoaW5mbGVjdGVkLm1hdGNoKHRoaXMuX3BhdHRlcm5zW2ldKSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3JlZnNbaV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIHJldHVybiB7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBhdGggb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5mbGVjdGVkID0gdXJsLnJlcGxhY2UoL1xcPy4qLywgJycpO1xuICAgICAgcmV0dXJuIGluZmxlY3RlZDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBxdWVyeXN0cmluZyBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBxdWVyeXN0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5mbGVjdGVkID0gdXJsLnJlcGxhY2UoLy4qXFw/LywgJycpO1xuICAgICAgcmV0dXJuIGluZmxlY3RlZDtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
