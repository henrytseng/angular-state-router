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

module.exports = [function() {
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
   * Queue history and correct length
   * 
   * @param  {Object} data An Object
   */
  var _queueHistory = function(data) {
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
        if(prevState) _queueHistory(prevState);
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
      _queueHistory(null);
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
   * Initialize, asynchronous operation.  Definition is done, initialize.  
   * 
   * @param  {String}      name   An initial state to start in.  
   * @param  {Object}      [data] A data object
   * @return {StateRouter}        Itself; chainable
   */
  _self.init = function(name, data) {
    process.nextTick(function() {
    
      // Initialize with state
      if(name) {
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
      $stateRouter.$location(_url, _self);


      // TODO parse params to state data






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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcHJvY2Vzcy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3VybC1kaWN0aW9uYXJ5LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvdXJsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QVVsQixjQUFjLFVBQVUsU0FBUyxTQUFTLEtBQUssVUFBVTtFQUN2RCxJQUFJLFlBQVksSUFBSSxPQUFPLElBQUk7O0VBRS9CLElBQUksSUFBSSxFQUFFLEtBQUssVUFBVSxPQUFPLEdBQUcsR0FBRyxHQUFHLEtBQUs7SUFDNUMsR0FBRyxVQUFVLE1BQU0sS0FBSyxVQUFVLFFBQVEsTUFBTTtNQUM5QyxPQUFPLEtBQUssTUFBTTs7OztFQUl0QixPQUFPOzs7QUFHVCxPQUFPLFVBQVU7QUFDakI7O0FDckVBOztBQUVBLFNBQVMsSUFBSSxLQUFLO0VBQ2hCLE1BQU0sT0FBTzs7RUFFYixPQUFPOzs7Ozs7O0lBT0wsTUFBTSxXQUFXO01BQ2YsSUFBSSxZQUFZLElBQUksUUFBUSxRQUFRO01BQ3BDLE9BQU87Ozs7Ozs7O0lBUVQsYUFBYSxXQUFXO01BQ3RCLElBQUksWUFBWSxJQUFJLFFBQVEsUUFBUTtNQUNwQyxPQUFPOzs7OztBQUtiLE9BQU8sVUFBVTtBQUNqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZVJvdXRlcicsIGZ1bmN0aW9uICgkc3RhdGVSb3V0ZXIpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZVJvdXRlci5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gUG9seWZpbGxcbnJlcXVpcmUoJy4vdXRpbHMvcHJvY2VzcycpO1xuXG4vLyBJbnN0YW50aWF0ZSBtb2R1bGVcbmFuZ3VsYXIubW9kdWxlKCdhbmd1bGFyLXN0YXRlLXJvdXRlcicsIFtdKVxuXG4gIC5mYWN0b3J5KCckc3RhdGVSb3V0ZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3N0YXRlLXJvdXRlcicpKVxuXG4gIC5mYWN0b3J5KCckdXJsTWFuYWdlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvdXJsLW1hbmFnZXInKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckdXJsTWFuYWdlcicsIGZ1bmN0aW9uKCRyb290U2NvcGUsICR1cmxNYW5hZ2VyKSB7XG4gICAgJHJvb3RTY29wZS4kb24oJyRsb2NhdGlvbkNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbigpIHtcbiAgICAgICR1cmxNYW5hZ2VyLmxvY2F0aW9uKGFyZ3VtZW50cyk7XG4gICAgfSk7XG4gIH1dKVxuXG4gIC5kaXJlY3RpdmUoJ3NyZWYnLCByZXF1aXJlKCcuL2RpcmVjdGl2ZXMvc3JlZicpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFtmdW5jdGlvbigpIHtcbiAgLy8gQ3VycmVudCBzdGF0ZVxuICB2YXIgX2N1cnJlbnQ7XG5cbiAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gIHZhciBfaGlzdG9yeUxlbmd0aCA9IDU7XG4gIHZhciBfaGlzdG9yeSA9IFtdO1xuXG4gIC8vIExpYnJhcnlcbiAgdmFyIF9saWJyYXJ5ID0ge307XG4gIHZhciBfY2FjaGUgPSB7fTtcblxuICAvLyBVUkwgZGljdGlvbmFyeVxuICB2YXIgX3VybERpY3Rpb25hcnkgPSBuZXcgVXJsRGljdGlvbmFyeSgpO1xuXG4gIC8vIE1pZGRsZXdhcmUgbGF5ZXJzXG4gIHZhciBfbGF5ZXJMaXN0ID0gW107XG5cbiAgLy8gSW5zdGFuY2Ugb2YgRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG5cbiAgLyoqXG4gICAqIEFkZCBkZWZhdWx0IHZhbHVlcyB0byBhIHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICBBbiBPYmplY3RcbiAgICovXG4gIHZhciBfc2V0U3RhdGVEZWZhdWx0cyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05XSsvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHN0YXRlIHF1ZXJ5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHF1ZXJ5ICBBIHF1ZXJ5IGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlUXVlcnkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHF1ZXJ5ID0gcXVlcnkgfHwgJyc7XG4gICAgXG4gICAgLy8gVE9ETyBvcHRpbWl6ZSB3aXRoIFJlZ0V4cFxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IHF1ZXJ5LnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC8oXFwqKFxcKik/fFthLXpBLVowLTldKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgdmFyIF9jb3B5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gQ29weVxuICAgICAgZGF0YSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgICAgLy8gVHJhY2sgcmVzb2x2ZVxuICAgICAgaWYoZGF0YSAmJiBkYXRhLnJlc29sdmUpIHtcbiAgICAgICAgZm9yKHZhciBuIGluIGRhdGEucmVzb2x2ZSkge1xuICAgICAgICAgIGRhdGEucmVzb2x2ZVtuXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfTtcbiAgICB2YXIgYWkgPSBfY29weShhKTtcbiAgICB2YXIgYmkgPSBfY29weShiKTtcblxuICAgIHJldHVybiBhbmd1bGFyLmVxdWFscyhhaSwgYmkpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIHBhcmVudCBzdGF0ZXNcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgIEFuIEFycmF5IG9mIHBhcmVudCBzdGF0ZXNcbiAgICovXG4gIHZhciBfZ2V0TmFtZUNoYWluID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBuYW1lTGlzdCA9IG5hbWUuc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBuYW1lTGlzdFxuICAgICAgLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgICAgIHJldHVybiBsaXN0LnNsaWNlKDAsIGkrMSkuam9pbignLicpO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbnVsbDtcbiAgICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY3Jhd2wgbGlicmFyeSBoZWlyYXJjaHlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICB2YXIgc3RhdGUgPSBudWxsO1xuXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgcXVlcmllc1xuICAgIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIC8vIFVzZSBjYWNoZSBpZiBleGlzdHNcbiAgICB9IGVsc2UgaWYoX2NhY2hlW25hbWVdKSB7XG4gICAgICByZXR1cm4gX2NhY2hlW25hbWVdO1xuICAgIH1cblxuICAgIHZhciBuYW1lQ2hhaW4gPSBfZ2V0TmFtZUNoYWluKG5hbWUpO1xuXG4gICAgdmFyIHN0YXRlQ2hhaW4gPSBuYW1lQ2hhaW5cbiAgICAgIC5tYXAoZnVuY3Rpb24ocG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIF9saWJyYXJ5W3BuYW1lXTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gcGFyZW50ICE9PSBudWxsO1xuICAgICAgfSk7XG5cbiAgICAvLyBXYWxrIHVwIGNoZWNraW5nIGluaGVyaXRhbmNlXG4gICAgZm9yKHZhciBpPXN0YXRlQ2hhaW4ubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoc3RhdGVDaGFpbltpXSkge1xuICAgICAgICBzdGF0ZSA9IGFuZ3VsYXIuZXh0ZW5kKGFuZ3VsYXIuY29weShzdGF0ZUNoYWluW2ldKSwgc3RhdGUgfHwge30pO1xuICAgICAgfVxuXG4gICAgICBpZihzdGF0ZSAmJiAhc3RhdGUuaW5oZXJpdCkgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gU3RvcmUgaW4gY2FjaGVcbiAgICBfY2FjaGVbbmFtZV0gPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHN0b3JlIGEgc3RhdGUgZGVmaW5pdGlvblxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbZGF0YV0gQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgT2JqZWN0LCBvcHRpb25hbFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2RlZmluZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKG5hbWUgPT09IG51bGwgfHwgdHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05hbWUgY2Fubm90IGJlIG51bGwuJyk7XG4gICAgXG4gICAgLy8gT25seSB1c2UgdmFsaWQgc3RhdGUgbmFtZXNcbiAgICB9IGVsc2UgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0YXRlIG5hbWUuJyk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHN0YXRlXG4gICAgdmFyIHN0YXRlID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXG4gICAgLy8gVXNlIGRlZmF1bHRzXG4gICAgX3NldFN0YXRlRGVmYXVsdHMoc3RhdGUpO1xuXG4gICAgLy8gTmFtZWQgc3RhdGVcbiAgICBzdGF0ZS5uYW1lID0gbmFtZTtcblxuICAgIC8vIFNldCBkZWZpbml0aW9uXG4gICAgX2xpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIC8vIENsZWFyIGNhY2hlIG9uIHVwZGF0ZXNcbiAgICBfY2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIFF1ZXVlIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3F1ZXVlSGlzdG9yeSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZihkYXRhKSB7XG4gICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBfaGlzdG9yeUxlbmd0aCkge1xuICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIF9oaXN0b3J5TGVuZ3RoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSBzZXJpZXMgb2YgZnVuY3Rpb25zOyB1c2VkIGluIHRhbmRlbSB3aXRoIG1pZGRsZXdhcmVcbiAgICovXG4gIHZhciBfUXVldWVIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIF9saXN0ID0gW107XG4gICAgdmFyIF9kYXRhID0gbnVsbDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgICAgaWYoaGFuZGxlciAmJiBoYW5kbGVyLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9saXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICBkYXRhOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB2YXIgbmV4dEhhbmRsZXI7XG4gICAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGhhbmRsZXIgPSBfbGlzdC5zaGlmdCgpO1xuXG4gICAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuXG4gICAgICAgICAgICAvLyBFcnJvclxuICAgICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAgIF9zZWxmLmVtaXQoJ2Vycm9yJywgZXJyLCBfZGF0YSk7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cbiAgICAgICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFxuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBjaGFuZ2UgdG8gc3RhdGUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBkYXRhICAgICAgICAgIEEgZGF0YSBvYmplY3RcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gIHVzZU1pZGRsZXdhcmUgQSBmbGFnIHRvIHRyaWdnZXIgbWlkZGxld2FyZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSwgdXNlTWlkZGxld2FyZSwgY2FsbGJhY2spIHtcbiAgICB1c2VNaWRkbGV3YXJlID0gdHlwZW9mIHVzZU1pZGRsZXdhcmUgPT09ICd1bmRlZmluZWQnID8gdHJ1ZSA6IHVzZU1pZGRsZXdhcmU7XG5cbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciByZXF1ZXN0ID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9O1xuXG4gICAgdmFyIG5leHRTdGF0ZSA9IF9nZXRTdGF0ZShuYW1lKTtcbiAgICB2YXIgcHJldlN0YXRlID0gX2N1cnJlbnQ7XG5cbiAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgIG5leHRTdGF0ZSA9IG5leHRTdGF0ZSAhPT0gbnVsbCA/IGFuZ3VsYXIuZXh0ZW5kKHt9LCBuZXh0U3RhdGUsIGRhdGEpIDogbnVsbDtcblxuICAgIC8vIENvbXBpbGUgZXhlY3V0aW9uIHBoYXNlc1xuICAgIHZhciBxdWV1ZSA9IF9RdWV1ZUhhbmRsZXIoKS5kYXRhKHJlcXVlc3QpO1xuXG4gICAgLy8gRG9lcyBub3QgZXhpc3RcbiAgICBpZighbmV4dFN0YXRlKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuXG4gICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICBfc2VsZi5lbWl0KCdlcnJvcjpub3Rmb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcblxuICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgLy8gU3RhdGUgbm90IGNoYW5nZWRcbiAgICB9IGVsc2UgaWYoX2NvbXBhcmVTdGF0ZXMocHJldlN0YXRlLCBuZXh0U3RhdGUpKSB7XG4gICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcblxuICAgIC8vIEV4aXN0c1xuICAgIH0gZWxzZSB7XG5cbiAgICAgIC8vIFByb2Nlc3Mgc3RhcnRlZFxuICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnY2hhbmdlOmJlZ2luJywgcmVxdWVzdCk7XG5cbiAgICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICAgIGlmKHByZXZTdGF0ZSkgX3F1ZXVlSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcblxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgIGlmKHVzZU1pZGRsZXdhcmUpIHtcbiAgICAgICAgcXVldWUuYWRkKF9sYXllckxpc3QpO1xuICAgICAgfVxuXG4gICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6ZW5kJywgcmVxdWVzdCk7XG4gICAgICAgIG5leHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFJ1blxuICAgIHF1ZXVlLmV4ZWN1dGUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6Y29tcGxldGUnLCBlcnIsIHJlcXVlc3QpO1xuXG4gICAgICBpZihjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgY29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBTdGF0ZVJvdXRlclxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIHBhcmFtcyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLm9wdGlvbnMgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG5cbiAgICBpZihwYXJhbXMuaGFzT3duUHJvcGVydHkoJ2hpc3RvcnlMZW5ndGgnKSkge1xuICAgICAgX2hpc3RvcnlMZW5ndGggPSBwYXJhbXMuaGlzdG9yeUxlbmd0aDtcbiAgICAgIF9xdWV1ZUhpc3RvcnkobnVsbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlIGRhdGEuICBEZWZpbmUgdGhlIHN0YXRlcy4gIFxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbZGF0YV0gQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgb2JqZWN0LCBvcHRpb25hbFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZighZGF0YSkge1xuICAgICAgcmV0dXJuIF9nZXRTdGF0ZShuYW1lKTtcbiAgICB9XG4gICAgX2RlZmluZVN0YXRlKG5hbWUsIGRhdGEpO1xuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gIERlZmluaXRpb24gaXMgZG9uZSwgaW5pdGlhbGl6ZS4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICBBbiBpbml0aWFsIHN0YXRlIHRvIHN0YXJ0IGluLiAgXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbZGF0YV0gQSBkYXRhIG9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5pbml0ID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgXG4gICAgICAvLyBJbml0aWFsaXplIHdpdGggc3RhdGVcbiAgICAgIGlmKG5hbWUpIHtcbiAgICAgICAgX2NoYW5nZVN0YXRlKG5hbWUsIGRhdGEsIHRydWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9zZWxmLmVtaXQoJ2luaXQnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIEluaXRpYWxpemUgb25seVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGFuZ2Ugc3RhdGUsIGFzeW5jaHJvbm91cyBvcGVyYXRpb25cbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtkYXRhXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuY2hhbmdlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIHByb2Nlc3MubmV4dFRpY2soYW5ndWxhci5iaW5kKG51bGwsIF9jaGFuZ2VTdGF0ZSwgbmFtZSwgZGF0YSwgdHJ1ZSkpO1xuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogQ2hhbmdlIHN0YXRlIGJhc2VkIG9uICRsb2NhdGlvbi51cmwoKSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gIFVzZWQgaW50ZXJuYWxseSBieSAkdXJsTWFuYWdlci5cbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICB1cmwgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi4kbG9jYXRpb24gPSBmdW5jdGlvbih1cmwsIGRhdGEpIHtcbiAgICB2YXIgc3RhdGUgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcbiAgICBpZihzdGF0ZSkge1xuICAgICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBzdGF0ZS5uYW1lLCBkYXRhLCBmYWxzZSkpO1xuICAgIH1cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBtaWRkbGV3YXJlLCBleGVjdXRpbmcgbmV4dChlcnIpO1xuICAgKiBcbiAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIGhhbmRsZXIgQSBjYWxsYmFjaywgZnVuY3Rpb24ocmVxdWVzdCwgbmV4dClcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLiR1c2UgPSBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgaWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBfbGF5ZXJMaXN0LnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICovXG4gIF9zZWxmLmN1cnJlbnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gIV9jdXJyZW50ID8gbnVsbCA6IGFuZ3VsYXIuY29weShfY3VycmVudCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrIHF1ZXJ5IGFnYWluc3QgY3VycmVudCBzdGF0ZVxuICAgKlxuICAgKiBAcGFyYW0gIHtNaXhlZH0gICBxdWVyeSAgQSBzdHJpbmcgdXNpbmcgc3RhdGUgbm90YXRpb24gb3IgYSBSZWdFeHBcbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgIEEgdHJ1ZSBpZiBzdGF0ZSBpcyBwYXJlbnQgdG8gY3VycmVudCBzdGF0ZVxuICAgKi9cbiAgX3NlbGYuYWN0aXZlID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIE5vIHN0YXRlXG4gICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBVc2UgUmVnRXhwIG1hdGNoaW5nXG4gICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKHF1ZXJ5KTtcblxuICAgIC8vIFN0cmluZzsgc3RhdGUgZG90LW5vdGF0aW9uXG4gICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgLy8gQ2FzdCBzdHJpbmcgdG8gUmVnRXhwXG4gICAgICBpZihxdWVyeS5tYXRjaCgvXlxcLy4qXFwvJC8pKSB7XG4gICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAoY2FzdGVkKSk7XG5cbiAgICAgIC8vIFRyYW5zZm9ybSB0byBzdGF0ZSBub3RhdGlvblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gcXVlcnlcbiAgICAgICAgICAuc3BsaXQoJy4nKVxuICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgaWYoaXRlbSA9PT0gJyonKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOV0qJztcbiAgICAgICAgICAgIH0gZWxzZSBpZihpdGVtID09PSAnKionKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWjAtOVxcXFwuXSonO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAqIFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgaGFzaCBvZiBzdGF0ZXNcbiAgICovXG4gIF9zZWxmLmxpYnJhcnkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX2xpYnJhcnk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRpb25cbiAgICovXG4gIF9zZWxmLnZhbGlkYXRlID0ge1xuICAgIG5hbWU6IF92YWxpZGF0ZVN0YXRlTmFtZSxcbiAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBoaXN0b3J5XG4gICAqIFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgaGFzaCBvZiBzdGF0ZXNcbiAgICovXG4gIF9zZWxmLmhpc3RvcnkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX2hpc3Rvcnk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGluc3RhbmNlXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGVSb3V0ZXInLCAnJGxvY2F0aW9uJywgZnVuY3Rpb24oJHN0YXRlUm91dGVyLCAkbG9jYXRpb24pIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2Ugb2YgRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG5cbiAgLyoqXG4gICAqIERldGVjdCBVUkwgY2hhbmdlIGFuZCBkaXNwYXRjaCBzdGF0ZSBjaGFuZ2VcbiAgICovXG4gIHZhciBfZGV0ZWN0Q2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxhc3RVcmwgPSBfdXJsO1xuICAgIHZhciBuZXh0VXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gICAgaWYobmV4dFVybCAhPT0gbGFzdFVybCkge1xuICAgICAgX3VybCA9IG5leHRVcmw7XG4gICAgICAkc3RhdGVSb3V0ZXIuJGxvY2F0aW9uKF91cmwsIF9zZWxmKTtcblxuXG4gICAgICAvLyBUT0RPIHBhcnNlIHBhcmFtcyB0byBzdGF0ZSBkYXRhXG5cblxuXG5cblxuXG4gICAgICBfc2VsZi5lbWl0KCd1cGRhdGU6bG9jYXRpb24nKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBVUkwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIHZhciBfdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXRlID0gJHN0YXRlUm91dGVyLmN1cnJlbnQoKTtcblxuICAgIGlmKHN0YXRlICYmIHN0YXRlLnVybCkge1xuICAgICAgX3VybCA9IHN0YXRlLnVybDtcblxuICAgICAgLy8gVE9ETyBBZGQgcGFyYW1ldGVycyBvciB1c2UgZGVmYXVsdCBwYXJhbWV0ZXJzXG5cblxuXG5cblxuXG5cbiAgICAgICRsb2NhdGlvbi51cmwoX3VybCk7XG4gICAgfVxuXG4gICAgX3NlbGYuZW1pdCgndXBkYXRlJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogTG9jYXRpb24gd2FzIHVwZGF0ZWQ7IGZvcmNlIHVwZGF0ZSBkZXRlY3Rpb25cbiAgICovXG4gIF9zZWxmLmxvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgX2RldGVjdENoYW5nZShhcmd1bWVudHMpO1xuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlUm91dGVyLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIF91cGRhdGUoKTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgd2luZG93OmZhbHNlICovXG4vKiBnbG9iYWwgcHJvY2VzczpmYWxzZSAqL1xuLyogZ2xvYmFsIHNldEltbWVkaWF0ZTpmYWxzZSAqL1xuLyogZ2xvYmFsIHNldFRpbWVvdXQ6ZmFsc2UgKi9cblxuLy8gUG9seWZpbGwgcHJvY2Vzcy5uZXh0VGljaygpXG5cbmlmKHdpbmRvdykge1xuICBpZighd2luZG93LnByb2Nlc3MpIHtcblxuICAgIHZhciBfcHJvY2VzcyA9IHtcbiAgICAgIG5leHRUaWNrOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gRXhwb3J0XG4gICAgd2luZG93LnByb2Nlc3MgPSBfcHJvY2VzcztcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsID0gcmVxdWlyZSgnLi91cmwnKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBVcmxEaWN0aW9uYXJ5KCkge1xuICB0aGlzLl9wYXR0ZXJucyA9IFtdO1xuICB0aGlzLl9yZWZzID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuXG4gIGlmKHBhdHRlcm4uaW5kZXhPZignPycpID09PSAtMSkge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcblxuICB9IGVsc2Uge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcbiAgfVxuXG4gIC8vIFVSTCBtYXRjaGluZ1xuICB2YXIgZXhwciA9IFxuICAgICdeJyArXG4gICAgKHBhdGhDaGFpbi5tYXAoZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgIGlmKGNodW5rWzBdID09PSAnOicpIHtcbiAgICAgICAgcmV0dXJuICdbYS16QS1aMC05XFxcXC1fXFxcXC5+XSsnO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICB9XG4gICAgfSkuam9pbignXFxcXC8nKSkgK1xuICAgICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChleHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbn07XG5cbi8qKlxuICogRmluZCBhIHJlZmVyZW5jZSBhY2NvcmRpbmcgdG8gYSBVUkwgcGF0dGVyblxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgIEEgVVJMIHRvIHRlc3QgZm9yXG4gKiBAcGFyYW0gIHtPYmplY3R9IGRlZmF1bHRzIEEgZGF0YSBPYmplY3Qgb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIEEgcmVmZXJlbmNlIHRvIGEgc3RvcmVkIG9iamVjdFxuICovXG5VcmxEaWN0aW9uYXJ5LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbih1cmwsIGRlZmF1bHRzKSB7XG4gIHZhciBpbmZsZWN0ZWQgPSBVcmwodXJsIHx8ICcnKS5wYXRoKCk7XG5cbiAgZm9yKHZhciBpPXRoaXMuX3BhdHRlcm5zLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICBpZihpbmZsZWN0ZWQubWF0Y2godGhpcy5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcmVmc1tpXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsRGljdGlvbmFyeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVXJsKHVybCkge1xuICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgcmV0dXJuIHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbmZsZWN0ZWQgPSB1cmwucmVwbGFjZSgvXFw/LiovLCAnJyk7XG4gICAgICByZXR1cm4gaW5mbGVjdGVkO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5c3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbmZsZWN0ZWQgPSB1cmwucmVwbGFjZSgvLipcXD8vLCAnJyk7XG4gICAgICByZXR1cm4gaW5mbGVjdGVkO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmw7XG4iXX0=
