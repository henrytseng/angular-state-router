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
      console.log(arguments);
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

  // URL to state dictionary
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
      if($location.url() !== '') {
        _self.$location($location.url(), function() {
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
   * Change state based on $location.url(), asynchronous operation using internal methods, quiet fallback.  
   * 
   * @param  {String}      url        A url matching defind states
   * @param  {Function}    [callback] A callback, function(err)
   * @return {StateRouter}            Itself; chainable
   */
  _self.$location = function(url, callback) {
    var data = _urlDictionary.lookup(url);

    if(data) {
      var state = data.ref;

      if(state) {
        // Parse params from url
        process.nextTick(angular.bind(null, _changeState, state.name, data.params, false, callback));
      }
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
   * @param  {String} nameParams A name-params string
   * @return {Object}             A name string and param Object
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

      $stateRouter.$location(_url);
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

},{"./url":10}],10:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyZWYuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcGFyYW1ldGVycy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3Byb2Nlc3MuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3VybC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTs7QUFFQSxPQUFPLFVBQVUsQ0FBQyxnQkFBZ0IsVUFBVSxjQUFjO0VBQ3hELE9BQU87SUFDTCxVQUFVO0lBQ1YsT0FBTzs7SUFFUCxNQUFNLFNBQVMsT0FBTyxTQUFTLE9BQU87TUFDcEMsUUFBUSxJQUFJLFVBQVU7TUFDdEIsUUFBUSxHQUFHLFNBQVMsU0FBUyxHQUFHO1FBQzlCLGFBQWEsT0FBTyxNQUFNO1FBQzFCLEVBQUU7Ozs7OztBQU1WOztBQ2pCQTs7Ozs7QUFLQSxJQUFJLE9BQU8sV0FBVyxlQUFlLE9BQU8sWUFBWSxlQUFlLE9BQU8sWUFBWSxRQUFRO0VBQ2hHLE9BQU8sVUFBVTs7OztBQUluQixRQUFROzs7QUFHUixRQUFRLE9BQU8sd0JBQXdCOztHQUVwQyxRQUFRLGdCQUFnQixRQUFROztHQUVoQyxRQUFRLGVBQWUsUUFBUTs7R0FFL0IsSUFBSSxDQUFDLGNBQWMsZUFBZSxTQUFTLFlBQVksYUFBYTtJQUNuRSxXQUFXLElBQUksMEJBQTBCLFdBQVc7TUFDbEQsUUFBUSxJQUFJO01BQ1osWUFBWSxTQUFTOzs7O0dBSXhCLFVBQVUsUUFBUSxRQUFRO0FBQzdCOzs7QUMzQkE7Ozs7QUFJQSxJQUFJLFNBQVMsUUFBUTtBQUNyQixJQUFJLGdCQUFnQixRQUFRO0FBQzVCLElBQUksYUFBYSxRQUFROztBQUV6QixPQUFPLFVBQVUsQ0FBQyxhQUFhLFNBQVMsV0FBVzs7RUFFakQsSUFBSTs7O0VBR0osSUFBSSxpQkFBaUI7RUFDckIsSUFBSSxXQUFXOzs7RUFHZixJQUFJLFdBQVc7RUFDZixJQUFJLFNBQVM7OztFQUdiLElBQUksaUJBQWlCLElBQUk7OztFQUd6QixJQUFJLGFBQWE7OztFQUdqQixJQUFJLFFBQVEsSUFBSSxPQUFPOzs7Ozs7Ozs7O0VBVXZCLElBQUksYUFBYSxTQUFTLFlBQVk7SUFDcEMsR0FBRyxjQUFjLFdBQVcsTUFBTSw0QkFBNEI7TUFDNUQsSUFBSSxRQUFRLFdBQVcsVUFBVSxHQUFHLFdBQVcsUUFBUTtNQUN2RCxJQUFJLFFBQVEsWUFBWSxXQUFXLFVBQVUsV0FBVyxRQUFRLEtBQUssR0FBRyxXQUFXLFlBQVk7O01BRS9GLE9BQU87UUFDTCxNQUFNO1FBQ04sUUFBUTs7O1dBR0w7TUFDTCxPQUFPO1FBQ0wsTUFBTTtRQUNOLFFBQVE7Ozs7Ozs7Ozs7O0VBV2QsSUFBSSxvQkFBb0IsU0FBUyxNQUFNO0lBQ3JDLEtBQUssVUFBVSxDQUFDLE9BQU8sS0FBSyxZQUFZLGVBQWUsT0FBTyxLQUFLOztJQUVuRSxPQUFPOzs7Ozs7Ozs7RUFTVCxJQUFJLHFCQUFxQixTQUFTLE1BQU07SUFDdEMsT0FBTyxRQUFROzs7O0lBSWYsSUFBSSxZQUFZLEtBQUssTUFBTTtJQUMzQixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxRQUFRLEtBQUs7TUFDcEMsR0FBRyxDQUFDLFVBQVUsR0FBRyxNQUFNLGtCQUFrQjtRQUN2QyxPQUFPOzs7O0lBSVgsT0FBTzs7Ozs7Ozs7O0VBU1QsSUFBSSxzQkFBc0IsU0FBUyxPQUFPO0lBQ3hDLFFBQVEsU0FBUzs7OztJQUlqQixJQUFJLFlBQVksTUFBTSxNQUFNO0lBQzVCLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLFFBQVEsS0FBSztNQUNwQyxHQUFHLENBQUMsVUFBVSxHQUFHLE1BQU0sNEJBQTRCO1FBQ2pELE9BQU87Ozs7SUFJWCxPQUFPOzs7Ozs7OztFQVFULElBQUksaUJBQWlCLFNBQVMsR0FBRyxHQUFHO0lBQ2xDLE9BQU8sUUFBUSxPQUFPLEdBQUc7Ozs7Ozs7OztFQVMzQixJQUFJLGdCQUFnQixTQUFTLE1BQU07SUFDakMsSUFBSSxXQUFXLEtBQUssTUFBTTs7SUFFMUIsT0FBTztPQUNKLElBQUksU0FBUyxNQUFNLEdBQUcsTUFBTTtRQUMzQixPQUFPLEtBQUssTUFBTSxHQUFHLEVBQUUsR0FBRyxLQUFLOztPQUVoQyxPQUFPLFNBQVMsTUFBTTtRQUNyQixPQUFPLFNBQVM7Ozs7Ozs7Ozs7RUFVdEIsSUFBSSxZQUFZLFNBQVMsTUFBTTtJQUM3QixPQUFPLFFBQVE7O0lBRWYsSUFBSSxRQUFROzs7SUFHWixHQUFHLENBQUMsbUJBQW1CLE9BQU87TUFDNUIsT0FBTzs7O1dBR0YsR0FBRyxPQUFPLE9BQU87TUFDdEIsT0FBTyxPQUFPOzs7SUFHaEIsSUFBSSxZQUFZLGNBQWM7O0lBRTlCLElBQUksYUFBYTtPQUNkLElBQUksU0FBUyxPQUFPO1FBQ25CLE9BQU8sU0FBUzs7T0FFakIsT0FBTyxTQUFTLFFBQVE7UUFDdkIsT0FBTyxXQUFXOzs7O0lBSXRCLElBQUksSUFBSSxFQUFFLFdBQVcsT0FBTyxHQUFHLEdBQUcsR0FBRyxLQUFLO01BQ3hDLEdBQUcsV0FBVyxJQUFJO1FBQ2hCLFFBQVEsUUFBUSxPQUFPLFFBQVEsS0FBSyxXQUFXLEtBQUssU0FBUzs7O01BRy9ELEdBQUcsU0FBUyxDQUFDLE1BQU0sU0FBUzs7OztJQUk5QixPQUFPLFFBQVE7O0lBRWYsT0FBTzs7Ozs7Ozs7OztFQVVULElBQUksZUFBZSxTQUFTLE1BQU0sTUFBTTtJQUN0QyxHQUFHLFNBQVMsUUFBUSxPQUFPLFNBQVMsYUFBYTtNQUMvQyxNQUFNLElBQUksTUFBTTs7O1dBR1gsR0FBRyxDQUFDLG1CQUFtQixPQUFPO01BQ25DLE1BQU0sSUFBSSxNQUFNOzs7O0lBSWxCLElBQUksUUFBUSxRQUFRLEtBQUs7OztJQUd6QixrQkFBa0I7OztJQUdsQixNQUFNLE9BQU87OztJQUdiLFNBQVMsUUFBUTs7O0lBR2pCLFNBQVM7OztJQUdULEdBQUcsTUFBTSxLQUFLO01BQ1osZUFBZSxJQUFJLE1BQU0sS0FBSzs7O0lBR2hDLE9BQU87Ozs7Ozs7O0VBUVQsSUFBSSxlQUFlLFNBQVMsTUFBTTtJQUNoQyxHQUFHLE1BQU07TUFDUCxTQUFTLEtBQUs7Ozs7SUFJaEIsR0FBRyxTQUFTLFNBQVMsZ0JBQWdCO01BQ25DLFNBQVMsT0FBTyxHQUFHLFNBQVMsU0FBUzs7Ozs7OztFQU96QyxJQUFJLGdCQUFnQixXQUFXO0lBQzdCLElBQUksUUFBUTtJQUNaLElBQUksUUFBUTs7SUFFWixPQUFPO01BQ0wsS0FBSyxTQUFTLFNBQVM7UUFDckIsR0FBRyxXQUFXLFFBQVEsZ0JBQWdCLE9BQU87VUFDM0MsUUFBUSxNQUFNLE9BQU87ZUFDaEI7VUFDTCxNQUFNLEtBQUs7O1FBRWIsT0FBTzs7O01BR1QsTUFBTSxTQUFTLE1BQU07UUFDbkIsUUFBUTtRQUNSLE9BQU87OztNQUdULFNBQVMsU0FBUyxVQUFVO1FBQzFCLElBQUk7UUFDSixjQUFjLFdBQVc7VUFDdkIsSUFBSSxVQUFVLE1BQU07O1VBRXBCLEdBQUcsQ0FBQyxTQUFTO1lBQ1gsT0FBTyxTQUFTOzs7VUFHbEIsUUFBUSxLQUFLLE1BQU0sT0FBTyxTQUFTLEtBQUs7OztZQUd0QyxHQUFHLEtBQUs7Y0FDTixNQUFNLEtBQUssU0FBUyxLQUFLO2NBQ3pCLFNBQVM7OzttQkFHSjtjQUNMOzs7OztRQUtOOzs7Ozs7Ozs7Ozs7O0VBYU4sSUFBSSxlQUFlLFNBQVMsTUFBTSxRQUFRLGVBQWUsVUFBVTtJQUNqRSxTQUFTLFVBQVU7SUFDbkIsZ0JBQWdCLE9BQU8sa0JBQWtCLGNBQWMsT0FBTzs7O0lBRzlELElBQUksV0FBVyxXQUFXO0lBQzFCLE9BQU8sU0FBUztJQUNoQixTQUFTLFFBQVEsT0FBTyxTQUFTLFVBQVUsSUFBSTs7SUFFL0MsSUFBSSxRQUFRO0lBQ1osSUFBSSxVQUFVO01BQ1osTUFBTTtNQUNOLFFBQVE7OztJQUdWLElBQUksWUFBWSxRQUFRLEtBQUssVUFBVTtJQUN2QyxJQUFJLFlBQVk7OztJQUdoQixHQUFHLFdBQVc7TUFDWixVQUFVLFNBQVMsUUFBUSxPQUFPLFVBQVUsVUFBVSxJQUFJOzs7O0lBSTVELElBQUksUUFBUSxnQkFBZ0IsS0FBSzs7O0lBR2pDLEdBQUcsQ0FBQyxXQUFXO01BQ2IsUUFBUSxJQUFJLE1BQU07TUFDbEIsTUFBTSxPQUFPOztNQUViLE1BQU0sSUFBSSxTQUFTLE1BQU0sTUFBTTtRQUM3QixNQUFNLEtBQUssa0JBQWtCLE9BQU87O1FBRXBDLEtBQUs7Ozs7V0FJRixHQUFHLGVBQWUsV0FBVyxZQUFZO01BQzlDLFdBQVc7OztXQUdOOzs7TUFHTCxNQUFNLElBQUksU0FBUyxNQUFNLE1BQU07UUFDN0IsTUFBTSxLQUFLLGdCQUFnQjs7O1FBRzNCLEdBQUcsV0FBVyxhQUFhO1FBQzNCLFdBQVc7O1FBRVg7Ozs7TUFJRixHQUFHLGVBQWU7UUFDaEIsTUFBTSxJQUFJOzs7O01BSVosTUFBTSxJQUFJLFNBQVMsTUFBTSxNQUFNO1FBQzdCLE1BQU0sS0FBSyxjQUFjO1FBQ3pCOzs7OztJQUtKLE1BQU0sUUFBUSxTQUFTLEtBQUs7TUFDMUIsTUFBTSxLQUFLLG1CQUFtQixLQUFLOztNQUVuQyxHQUFHLFVBQVU7UUFDWCxTQUFTOzs7Ozs7Ozs7OztFQVdmLE1BQU0sVUFBVSxTQUFTLFNBQVM7SUFDaEMsVUFBVSxXQUFXOztJQUVyQixHQUFHLFFBQVEsZUFBZSxrQkFBa0I7TUFDMUMsaUJBQWlCLFFBQVE7TUFDekIsYUFBYTs7O0lBR2YsT0FBTzs7Ozs7Ozs7OztFQVVULE1BQU0sUUFBUSxTQUFTLE1BQU0sT0FBTztJQUNsQyxHQUFHLENBQUMsT0FBTztNQUNULE9BQU8sVUFBVTs7SUFFbkIsYUFBYSxNQUFNO0lBQ25CLE9BQU87Ozs7Ozs7Ozs7RUFVVCxNQUFNLE9BQU8sU0FBUyxNQUFNLFFBQVE7SUFDbEMsUUFBUSxTQUFTLFdBQVc7OztNQUcxQixHQUFHLFVBQVUsVUFBVSxJQUFJO1FBQ3pCLE1BQU0sVUFBVSxVQUFVLE9BQU8sV0FBVztVQUMxQyxNQUFNLEtBQUs7Ozs7YUFJUixHQUFHLE1BQU07UUFDZCxhQUFhLE1BQU0sUUFBUSxNQUFNLFdBQVc7VUFDMUMsTUFBTSxLQUFLOzs7O2FBSVI7UUFDTCxNQUFNLEtBQUs7Ozs7SUFJZixPQUFPOzs7Ozs7Ozs7O0VBVVQsTUFBTSxTQUFTLFNBQVMsTUFBTSxRQUFRO0lBQ3BDLFFBQVEsU0FBUyxRQUFRLEtBQUssTUFBTSxjQUFjLE1BQU0sUUFBUTtJQUNoRSxPQUFPOzs7Ozs7Ozs7O0VBVVQsTUFBTSxZQUFZLFNBQVMsS0FBSyxVQUFVO0lBQ3hDLElBQUksT0FBTyxlQUFlLE9BQU87O0lBRWpDLEdBQUcsTUFBTTtNQUNQLElBQUksUUFBUSxLQUFLOztNQUVqQixHQUFHLE9BQU87O1FBRVIsUUFBUSxTQUFTLFFBQVEsS0FBSyxNQUFNLGNBQWMsTUFBTSxNQUFNLEtBQUssUUFBUSxPQUFPOzs7O0lBSXRGLE9BQU87Ozs7Ozs7OztFQVNULE1BQU0sT0FBTyxTQUFTLFNBQVM7SUFDN0IsR0FBRyxPQUFPLFlBQVksWUFBWTtNQUNoQyxNQUFNLElBQUksTUFBTTs7O0lBR2xCLFdBQVcsS0FBSztJQUNoQixPQUFPOzs7Ozs7OztFQVFULE1BQU0sVUFBVSxXQUFXO0lBQ3pCLE9BQU8sQ0FBQyxDQUFDLFlBQVksT0FBTyxRQUFRLEtBQUs7Ozs7Ozs7Ozs7RUFVM0MsTUFBTSxTQUFTLFNBQVMsT0FBTyxRQUFRO0lBQ3JDLFFBQVEsU0FBUzs7O0lBR2pCLEdBQUcsQ0FBQyxVQUFVO01BQ1osT0FBTzs7O1dBR0YsR0FBRyxpQkFBaUIsUUFBUTtNQUNqQyxPQUFPLENBQUMsQ0FBQyxTQUFTLEtBQUssTUFBTTs7O1dBR3hCLEdBQUcsT0FBTyxVQUFVLFVBQVU7OztNQUduQyxHQUFHLE1BQU0sTUFBTSxhQUFhO1FBQzFCLElBQUksU0FBUyxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU87UUFDMUMsT0FBTyxDQUFDLENBQUMsU0FBUyxLQUFLLE1BQU0sSUFBSSxPQUFPOzs7YUFHbkM7UUFDTCxJQUFJLGNBQWM7V0FDZixNQUFNO1dBQ04sSUFBSSxTQUFTLE1BQU07WUFDbEIsR0FBRyxTQUFTLEtBQUs7Y0FDZixPQUFPO21CQUNGLEdBQUcsU0FBUyxNQUFNO2NBQ3ZCLE9BQU87bUJBQ0Y7Y0FDTCxPQUFPOzs7V0FHVixLQUFLOztRQUVSLE9BQU8sQ0FBQyxDQUFDLFNBQVMsS0FBSyxNQUFNLElBQUksT0FBTzs7Ozs7SUFLNUMsT0FBTzs7Ozs7Ozs7Ozs7RUFXVCxNQUFNLFFBQVE7Ozs7Ozs7RUFPZCxNQUFNLFVBQVUsV0FBVztJQUN6QixPQUFPOzs7Ozs7RUFNVCxNQUFNLFdBQVc7SUFDZixNQUFNO0lBQ04sT0FBTzs7Ozs7Ozs7RUFRVCxNQUFNLFVBQVUsV0FBVztJQUN6QixPQUFPOzs7O0VBSVQsT0FBTzs7QUFFVDs7OztBQ3BrQkE7O0FBRUEsSUFBSSxTQUFTLFFBQVE7QUFDckIsSUFBSSxnQkFBZ0IsUUFBUTs7QUFFNUIsT0FBTyxVQUFVLENBQUMsZ0JBQWdCLGFBQWEsU0FBUyxjQUFjLFdBQVc7RUFDL0UsSUFBSSxPQUFPLFVBQVU7OztFQUdyQixJQUFJLFFBQVEsSUFBSSxPQUFPOzs7OztFQUt2QixJQUFJLGdCQUFnQixXQUFXO0lBQzdCLElBQUksVUFBVTtJQUNkLElBQUksVUFBVSxVQUFVOztJQUV4QixHQUFHLFlBQVksU0FBUztNQUN0QixPQUFPOztNQUVQLGFBQWEsVUFBVTtNQUN2QixNQUFNLEtBQUs7Ozs7Ozs7RUFPZixJQUFJLFVBQVUsV0FBVztJQUN2QixJQUFJLFFBQVEsYUFBYTs7SUFFekIsR0FBRyxTQUFTLE1BQU0sS0FBSztNQUNyQixPQUFPLE1BQU07OztNQUdiLElBQUksU0FBUyxNQUFNLFVBQVU7TUFDN0IsSUFBSSxJQUFJLFFBQVEsUUFBUTtRQUN0QixPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxNQUFNLE1BQU0sT0FBTzs7O01BR3hELFVBQVUsSUFBSTs7O0lBR2hCLE1BQU0sS0FBSzs7Ozs7O0VBTWIsTUFBTSxTQUFTLFdBQVc7SUFDeEI7Ozs7OztFQU1GLE1BQU0sV0FBVyxXQUFXO0lBQzFCLGNBQWM7Ozs7RUFJaEIsYUFBYSxLQUFLLFNBQVMsU0FBUyxNQUFNO0lBQ3hDO0lBQ0E7OztFQUdGLE9BQU87O0FBRVQ7O0FDckVBOzs7QUFHQSxJQUFJLHVCQUF1Qjs7O0FBRzNCLElBQUksV0FBVzs7Ozs7QUFLZixJQUFJLFdBQVc7Ozs7Ozs7Ozs7QUFVZixJQUFJLGdCQUFnQixTQUFTLE9BQU87OztFQUdsQyxHQUFHLFVBQVUsUUFBUTtJQUNuQixPQUFPOzs7U0FHRixHQUFHLFVBQVUsU0FBUztJQUMzQixPQUFPOzs7U0FHRixHQUFHLFVBQVUsUUFBUTtJQUMxQixPQUFPOzs7U0FHRixHQUFHLE1BQU0sTUFBTSxXQUFXO0lBQy9CLE9BQU8sTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPOzs7U0FHL0IsR0FBRyxNQUFNLE1BQU0sV0FBVztJQUMvQixPQUFPLENBQUM7OztTQUdILEdBQUcsVUFBVSxPQUFPO0lBQ3pCLE9BQU87Ozs7Ozs7RUFPVCxPQUFPOzs7O0FBSVQsSUFBSSxXQUFXLFNBQVMsS0FBSzs7O0VBRzNCLE1BQU0sSUFBSSxRQUFRLFFBQVEsSUFBSSxRQUFRLFFBQVE7O0VBRTlDLEdBQUcsSUFBSSxNQUFNLG9CQUFvQixNQUFNO0lBQ3JDLE1BQU0sSUFBSSxNQUFNOzs7RUFHbEIsSUFBSSxlQUFlLFNBQVMsTUFBTTtJQUNoQyxPQUFPLEtBQUssUUFBUSxtQkFBbUIsSUFBSSxRQUFRLGFBQWE7OztFQUdsRSxJQUFJLGdCQUFnQixTQUFTLE9BQU87SUFDbEMsSUFBSSxNQUFNLE1BQU0sUUFBUSxZQUFZLElBQUksUUFBUSxRQUFRO0lBQ3hELE9BQU8sY0FBYzs7O0VBR3ZCLE9BQU8sSUFBSSxNQUFNLHNCQUFzQixJQUFJLFNBQVMsTUFBTSxHQUFHLE1BQU07SUFDakUsT0FBTyxFQUFFLE1BQU0sSUFBSSxhQUFhLFFBQVEsY0FBYzs7Ozs7Ozs7O0FBUzFELElBQUksYUFBYSxTQUFTLEtBQUs7RUFDN0IsTUFBTSxPQUFPOzs7RUFHYixJQUFJLFFBQVE7O0VBRVosU0FBUyxLQUFLLFFBQVEsU0FBUyxNQUFNLEdBQUcsTUFBTTtJQUM1QyxHQUFHLEVBQUUsTUFBTSxHQUFHO01BQ1osTUFBTSxRQUFRLEtBQUssRUFBRTs7OztFQUl6QixPQUFPOzs7QUFHVCxPQUFPLFVBQVU7O0FBRWpCLE9BQU8sUUFBUSxlQUFlO0FBQzlCLE9BQU8sUUFBUSxVQUFVO0FBQ3pCOztBQ3ZHQTs7Ozs7Ozs7O0FBU0EsR0FBRyxRQUFRO0VBQ1QsR0FBRyxDQUFDLE9BQU8sU0FBUzs7SUFFbEIsSUFBSSxXQUFXO01BQ2IsVUFBVSxTQUFTLFVBQVU7UUFDM0IsV0FBVyxVQUFVOzs7OztJQUt6QixPQUFPLFVBQVU7OztBQUdyQjs7QUN0QkE7O0FBRUEsSUFBSSxNQUFNLFFBQVE7Ozs7O0FBS2xCLFNBQVMsZ0JBQWdCO0VBQ3ZCLEtBQUssWUFBWTtFQUNqQixLQUFLLFFBQVE7RUFDYixLQUFLLFVBQVU7Ozs7Ozs7OztBQVNqQixjQUFjLFVBQVUsTUFBTSxTQUFTLFNBQVMsS0FBSztFQUNuRCxVQUFVLFdBQVc7RUFDckIsSUFBSSxRQUFRO0VBQ1osSUFBSSxJQUFJLEtBQUssVUFBVTs7RUFFdkIsSUFBSTtFQUNKLElBQUksU0FBUzs7RUFFYixHQUFHLFFBQVEsUUFBUSxTQUFTLENBQUMsR0FBRztJQUM5QixZQUFZLElBQUksU0FBUyxPQUFPLE1BQU07O1NBRWpDO0lBQ0wsWUFBWSxJQUFJLFNBQVMsT0FBTyxNQUFNOzs7O0VBSXhDLElBQUksYUFBYTs7O0VBR2pCLENBQUMsVUFBVSxRQUFRLFNBQVMsT0FBTyxHQUFHO0lBQ3BDLEdBQUcsSUFBSSxHQUFHO01BQ1IsY0FBYzs7O0lBR2hCLEdBQUcsTUFBTSxPQUFPLEtBQUs7TUFDbkIsY0FBYztNQUNkLE9BQU8sTUFBTSxVQUFVLE1BQU0sSUFBSSxPQUFPOztXQUVuQztNQUNMLGNBQWM7Ozs7O0VBS2xCLGNBQWM7O0VBRWQsS0FBSyxVQUFVLEtBQUssSUFBSSxPQUFPO0VBQy9CLEtBQUssTUFBTSxLQUFLO0VBQ2hCLEtBQUssUUFBUSxLQUFLOzs7Ozs7Ozs7O0FBVXBCLGNBQWMsVUFBVSxTQUFTLFNBQVMsS0FBSyxVQUFVO0VBQ3ZELE1BQU0sT0FBTztFQUNiLElBQUksSUFBSSxJQUFJLEtBQUs7RUFDakIsSUFBSSxJQUFJLElBQUksS0FBSzs7RUFFakIsSUFBSSxRQUFROzs7RUFHWixJQUFJLGVBQWUsU0FBUyxPQUFPO0lBQ2pDLFFBQVEsU0FBUztJQUNqQixJQUFJLElBQUksRUFBRSxNQUFNLFVBQVUsT0FBTyxHQUFHLEdBQUcsR0FBRyxLQUFLO01BQzdDLEdBQUcsTUFBTSxNQUFNLE1BQU0sVUFBVSxRQUFRLE1BQU07UUFDM0MsT0FBTzs7O0lBR1gsT0FBTyxDQUFDOzs7RUFHVixJQUFJLElBQUksYUFBYTs7O0VBR3JCLEdBQUcsTUFBTSxDQUFDLEdBQUc7OztJQUdYLElBQUksU0FBUztJQUNiLElBQUksSUFBSSxLQUFLLEtBQUssUUFBUSxJQUFJO01BQzVCLElBQUksY0FBYyxLQUFLLFFBQVEsR0FBRztNQUNsQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLE1BQU0sZ0JBQWdCLElBQUksU0FBUztNQUN2RCxJQUFJLFdBQVcsU0FBUyxNQUFNLEtBQUs7TUFDbkMsT0FBTyxLQUFLOzs7O0lBSWQsU0FBUyxRQUFRLE9BQU8sR0FBRzs7SUFFM0IsT0FBTztNQUNMLEtBQUs7TUFDTCxLQUFLLEtBQUssTUFBTTtNQUNoQixRQUFROzs7O1NBSUw7SUFDTCxPQUFPOzs7O0FBSVgsT0FBTyxVQUFVO0FBQ2pCOztBQ25IQTs7QUFFQSxTQUFTLElBQUksS0FBSztFQUNoQixNQUFNLE9BQU87OztFQUdiLElBQUksUUFBUTs7Ozs7OztJQU9WLE1BQU0sV0FBVztNQUNmLE9BQU8sSUFBSSxRQUFRLFNBQVMsQ0FBQyxJQUFJLE1BQU0sSUFBSSxVQUFVLEdBQUcsSUFBSSxRQUFROzs7Ozs7OztJQVF0RSxhQUFhLFdBQVc7TUFDdEIsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxRQUFRLEtBQUs7Ozs7Ozs7O0lBUXZFLGFBQWEsV0FBVztNQUN0QixJQUFJLFFBQVEsTUFBTSxjQUFjLE1BQU07TUFDdEMsSUFBSSxTQUFTOztNQUViLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLFFBQVEsS0FBSztRQUNoQyxHQUFHLE1BQU0sT0FBTyxJQUFJO1FBQ3BCLElBQUksWUFBWSxNQUFNLEdBQUcsTUFBTTtRQUMvQixPQUFPLFVBQVUsTUFBTSxDQUFDLE9BQU8sVUFBVSxPQUFPLGVBQWUsVUFBVSxPQUFPLE1BQU0sT0FBTyxVQUFVOzs7TUFHekcsT0FBTzs7OztFQUlYLE9BQU87OztBQUdULE9BQU8sVUFBVTtBQUNqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZVJvdXRlcicsIGZ1bmN0aW9uICgkc3RhdGVSb3V0ZXIpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICRzdGF0ZVJvdXRlci5jaGFuZ2UoYXR0cnMuc3JlZik7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICB9O1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gUG9seWZpbGxcbnJlcXVpcmUoJy4vdXRpbHMvcHJvY2VzcycpO1xuXG4vLyBJbnN0YW50aWF0ZSBtb2R1bGVcbmFuZ3VsYXIubW9kdWxlKCdhbmd1bGFyLXN0YXRlLXJvdXRlcicsIFtdKVxuXG4gIC5mYWN0b3J5KCckc3RhdGVSb3V0ZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3N0YXRlLXJvdXRlcicpKVxuXG4gIC5mYWN0b3J5KCckdXJsTWFuYWdlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvdXJsLW1hbmFnZXInKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckdXJsTWFuYWdlcicsIGZ1bmN0aW9uKCRyb290U2NvcGUsICR1cmxNYW5hZ2VyKSB7XG4gICAgJHJvb3RTY29wZS4kb24oJyRsb2NhdGlvbkNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUubG9nKGFyZ3VtZW50cyk7XG4gICAgICAkdXJsTWFuYWdlci5sb2NhdGlvbihhcmd1bWVudHMpO1xuICAgIH0pO1xuICB9XSlcblxuICAuZGlyZWN0aXZlKCdzcmVmJywgcmVxdWlyZSgnLi9kaXJlY3RpdmVzL3NyZWYnKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBwcm9jZXNzOmZhbHNlICovXG5cbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciBVcmxEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vdXRpbHMvdXJsLWRpY3Rpb25hcnknKTtcbnZhciBQYXJhbWV0ZXJzID0gcmVxdWlyZSgnLi4vdXRpbHMvcGFyYW1ldGVycycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJGxvY2F0aW9uJywgZnVuY3Rpb24oJGxvY2F0aW9uKSB7XG4gIC8vIEN1cnJlbnQgc3RhdGVcbiAgdmFyIF9jdXJyZW50O1xuXG4gIC8vIEtlZXAgdGhlIGxhc3QgbiBzdGF0ZXMgKGUuZy4gLSBkZWZhdWx0cyA1KVxuICB2YXIgX2hpc3RvcnlMZW5ndGggPSA1O1xuICB2YXIgX2hpc3RvcnkgPSBbXTtcblxuICAvLyBMaWJyYXJ5XG4gIHZhciBfbGlicmFyeSA9IHt9O1xuICB2YXIgX2NhY2hlID0ge307XG5cbiAgLy8gVVJMIHRvIHN0YXRlIGRpY3Rpb25hcnlcbiAgdmFyIF91cmxEaWN0aW9uYXJ5ID0gbmV3IFVybERpY3Rpb25hcnkoKTtcblxuICAvLyBNaWRkbGV3YXJlIGxheWVyc1xuICB2YXIgX2xheWVyTGlzdCA9IFtdO1xuXG4gIC8vIEluc3RhbmNlIG9mIEV2ZW50RW1pdHRlclxuICB2YXIgX3NlbGYgPSBuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcigpO1xuXG4gIC8qKlxuICAgKiBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgKiBcbiAgICogQXNzdW1lIGFsbCBwYXJhbWV0ZXIgdmFsdWVzIGFyZSBzdHJpbmdzXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVQYXJhbXMgQSBuYW1lLXBhcmFtcyBzdHJpbmdcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgICBBIG5hbWUgc3RyaW5nIGFuZCBwYXJhbSBPYmplY3RcbiAgICovXG4gIHZhciBfcGFyc2VOYW1lID0gZnVuY3Rpb24obmFtZVBhcmFtcykge1xuICAgIGlmKG5hbWVQYXJhbXMgJiYgbmFtZVBhcmFtcy5tYXRjaCgvXlthLXpBLVowLTlfXFwuXSpcXCguKlxcKSQvKSkge1xuICAgICAgdmFyIG5wYXJ0ID0gbmFtZVBhcmFtcy5zdWJzdHJpbmcoMCwgbmFtZVBhcmFtcy5pbmRleE9mKCcoJykpO1xuICAgICAgdmFyIHBwYXJ0ID0gUGFyYW1ldGVycyggbmFtZVBhcmFtcy5zdWJzdHJpbmcobmFtZVBhcmFtcy5pbmRleE9mKCcoJykrMSwgbmFtZVBhcmFtcy5sYXN0SW5kZXhPZignKScpKSApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBucGFydCxcbiAgICAgICAgcGFyYW1zOiBwcGFydFxuICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBuYW1lUGFyYW1zLFxuICAgICAgICBwYXJhbXM6IG51bGxcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgZGVmYXVsdCB2YWx1ZXMgdG8gYSBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3NldFN0YXRlRGVmYXVsdHMgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgbmFtZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gbmFtZS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvW2EtekEtWjAtOV9dKy8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogVmFsaWRhdGUgc3RhdGUgcXVlcnlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcXVlcnkgIEEgcXVlcnkgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgIFRydWUgaWYgbmFtZSBpcyB2YWxpZCwgZmFsc2UgaWYgbm90XG4gICAqL1xuICB2YXIgX3ZhbGlkYXRlU3RhdGVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBUT0RPIG9wdGltaXplIHdpdGggUmVnRXhwXG5cbiAgICB2YXIgbmFtZUNoYWluID0gcXVlcnkuc3BsaXQoJy4nKTtcbiAgICBmb3IodmFyIGk9MDsgaTxuYW1lQ2hhaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCFuYW1lQ2hhaW5baV0ubWF0Y2goLyhcXCooXFwqKT98W2EtekEtWjAtOV9dKykvKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgdHdvIHN0YXRlcywgY29tcGFyZXMgdmFsdWVzLiAgXG4gICAqIFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBUcnVlIGlmIHN0YXRlcyBhcmUgdGhlIHNhbWUsIGZhbHNlIGlmIHN0YXRlcyBhcmUgZGlmZmVyZW50XG4gICAqL1xuICB2YXIgX2NvbXBhcmVTdGF0ZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGFuZ3VsYXIuZXF1YWxzKGEsIGIpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIHBhcmVudCBzdGF0ZXNcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgIEFuIEFycmF5IG9mIHBhcmVudCBzdGF0ZXNcbiAgICovXG4gIHZhciBfZ2V0TmFtZUNoYWluID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBuYW1lTGlzdCA9IG5hbWUuc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBuYW1lTGlzdFxuICAgICAgLm1hcChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgICAgIHJldHVybiBsaXN0LnNsaWNlKDAsIGkrMSkuam9pbignLicpO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbnVsbDtcbiAgICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gY3Jhd2wgbGlicmFyeSBoZWlyYXJjaHlcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9nZXRTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIHZhciBzdGF0ZSA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBxdWVyaWVzXG4gICAgaWYoIV92YWxpZGF0ZVN0YXRlTmFtZShuYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgLy8gVXNlIGNhY2hlIGlmIGV4aXN0c1xuICAgIH0gZWxzZSBpZihfY2FjaGVbbmFtZV0pIHtcbiAgICAgIHJldHVybiBfY2FjaGVbbmFtZV07XG4gICAgfVxuXG4gICAgdmFyIG5hbWVDaGFpbiA9IF9nZXROYW1lQ2hhaW4obmFtZSk7XG5cbiAgICB2YXIgc3RhdGVDaGFpbiA9IG5hbWVDaGFpblxuICAgICAgLm1hcChmdW5jdGlvbihwbmFtZSkge1xuICAgICAgICByZXR1cm4gX2xpYnJhcnlbcG5hbWVdO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICAgIHJldHVybiBwYXJlbnQgIT09IG51bGw7XG4gICAgICB9KTtcblxuICAgIC8vIFdhbGsgdXAgY2hlY2tpbmcgaW5oZXJpdGFuY2VcbiAgICBmb3IodmFyIGk9c3RhdGVDaGFpbi5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihzdGF0ZUNoYWluW2ldKSB7XG4gICAgICAgIHN0YXRlID0gYW5ndWxhci5leHRlbmQoYW5ndWxhci5jb3B5KHN0YXRlQ2hhaW5baV0pLCBzdGF0ZSB8fCB7fSk7XG4gICAgICB9XG5cbiAgICAgIGlmKHN0YXRlICYmICFzdGF0ZS5pbmhlcml0KSBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbiBjYWNoZVxuICAgIF9jYWNoZVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gc3RvcmUgYSBzdGF0ZSBkZWZpbml0aW9uLiAgUGFyYW1ldGVycyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gZGF0YSBPYmplY3Qgbm90IHN0YXRlIG5hbWUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIHN0YXRlLW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEEgc3RhdGUgZGF0YSBPYmplY3RcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbC4nKTtcbiAgICBcbiAgICAvLyBPbmx5IHVzZSB2YWxpZCBzdGF0ZSBuYW1lc1xuICAgIH0gZWxzZSBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RhdGUgbmFtZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3RhdGVcbiAgICB2YXIgc3RhdGUgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgLy8gU2V0IGRlZmluaXRpb25cbiAgICBfbGlicmFyeVtuYW1lXSA9IHN0YXRlO1xuXG4gICAgLy8gUmVzZXQgY2FjaGVcbiAgICBfY2FjaGUgPSB7fTtcblxuICAgIC8vIFVSTCBtYXBwaW5nXG4gICAgaWYoc3RhdGUudXJsKSB7XG4gICAgICBfdXJsRGljdGlvbmFyeS5hZGQoc3RhdGUudXJsLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9wdXNoSGlzdG9yeSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZihkYXRhKSB7XG4gICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBfaGlzdG9yeUxlbmd0aCkge1xuICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIF9oaXN0b3J5TGVuZ3RoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSBzZXJpZXMgb2YgZnVuY3Rpb25zOyB1c2VkIGluIHRhbmRlbSB3aXRoIG1pZGRsZXdhcmVcbiAgICovXG4gIHZhciBfUXVldWVIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIF9saXN0ID0gW107XG4gICAgdmFyIF9kYXRhID0gbnVsbDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGQ6IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgICAgaWYoaGFuZGxlciAmJiBoYW5kbGVyLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9saXN0LnB1c2goaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICBkYXRhOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuXG4gICAgICBleGVjdXRlOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB2YXIgbmV4dEhhbmRsZXI7XG4gICAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGhhbmRsZXIgPSBfbGlzdC5zaGlmdCgpO1xuXG4gICAgICAgICAgaWYoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBoYW5kbGVyLmNhbGwobnVsbCwgX2RhdGEsIGZ1bmN0aW9uKGVycikge1xuXG4gICAgICAgICAgICAvLyBFcnJvclxuICAgICAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgICAgIF9zZWxmLmVtaXQoJ2Vycm9yJywgZXJyLCBfZGF0YSk7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cbiAgICAgICAgICAgIC8vIENvbnRpbnVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXh0SGFuZGxlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgY2hhbmdlIHRvIHN0YXRlLiAgUGFyYW1ldGVycyBpbiBgcGFyYW1zYCB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgc3RhdGUtbm90YXRpb24gYG5hbWVgIGV4cHJlc3Npb24uICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb24gaW5jbHVkaW5nIG9wdGlvbmFsIHBhcmFtZXRlcnNcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHBhcmFtcyAgICAgICAgQSBkYXRhIG9iamVjdCBvZiBwYXJhbXNcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gIHVzZU1pZGRsZXdhcmUgQSBmbGFnIHRvIHRyaWdnZXIgbWlkZGxld2FyZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgICBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqL1xuICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zLCB1c2VNaWRkbGV3YXJlLCBjYWxsYmFjaykge1xuICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcbiAgICB1c2VNaWRkbGV3YXJlID0gdHlwZW9mIHVzZU1pZGRsZXdhcmUgPT09ICd1bmRlZmluZWQnID8gdHJ1ZSA6IHVzZU1pZGRsZXdhcmU7XG5cbiAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgdmFyIG5hbWVFeHByID0gX3BhcnNlTmFtZShuYW1lKTtcbiAgICBuYW1lID0gbmFtZUV4cHIubmFtZTtcbiAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciByZXF1ZXN0ID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcblxuICAgIHZhciBuZXh0U3RhdGUgPSBhbmd1bGFyLmNvcHkoX2dldFN0YXRlKG5hbWUpKTtcbiAgICB2YXIgcHJldlN0YXRlID0gX2N1cnJlbnQ7XG5cbiAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgIGlmKG5leHRTdGF0ZSkge1xuICAgICAgbmV4dFN0YXRlLnBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKG5leHRTdGF0ZS5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSBleGVjdXRpb24gcGhhc2VzXG4gICAgdmFyIHF1ZXVlID0gX1F1ZXVlSGFuZGxlcigpLmRhdGEocmVxdWVzdCk7XG5cbiAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgIGlmKCFuZXh0U3RhdGUpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKCdSZXF1ZXN0ZWQgc3RhdGUgd2FzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG5cbiAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgIF9zZWxmLmVtaXQoJ2Vycm9yOm5vdGZvdW5kJywgZXJyb3IsIHJlcXVlc3QpO1xuXG4gICAgICAgIG5leHQoZXJyb3IpO1xuICAgICAgfSk7XG5cbiAgICAvLyBTdGF0ZSBub3QgY2hhbmdlZFxuICAgIH0gZWxzZSBpZihfY29tcGFyZVN0YXRlcyhwcmV2U3RhdGUsIG5leHRTdGF0ZSkpIHtcbiAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuXG4gICAgLy8gRXhpc3RzXG4gICAgfSBlbHNlIHtcblxuICAgICAgLy8gUHJvY2VzcyBzdGFydGVkXG4gICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6YmVnaW4nLCByZXF1ZXN0KTtcblxuICAgICAgICAvLyBWYWxpZCBzdGF0ZSBleGlzdHNcbiAgICAgICAgaWYocHJldlN0YXRlKSBfcHVzaEhpc3RvcnkocHJldlN0YXRlKTtcbiAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG5cbiAgICAgICAgbmV4dCgpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBtaWRkbGV3YXJlXG4gICAgICBpZih1c2VNaWRkbGV3YXJlKSB7XG4gICAgICAgIHF1ZXVlLmFkZChfbGF5ZXJMaXN0KTtcbiAgICAgIH1cblxuICAgICAgLy8gUHJvY2VzcyBlbmRlZFxuICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgX3NlbGYuZW1pdCgnY2hhbmdlOmVuZCcsIHJlcXVlc3QpO1xuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBSdW5cbiAgICBxdWV1ZS5leGVjdXRlKGZ1bmN0aW9uKGVycikge1xuICAgICAgX3NlbGYuZW1pdCgnY2hhbmdlOmNvbXBsZXRlJywgZXJyLCByZXF1ZXN0KTtcblxuICAgICAgaWYoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGNvbmZpZ3VyYXRpb24gZGF0YSBwYXJhbWV0ZXJzIGZvciBTdGF0ZVJvdXRlclxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIG9wdGlvbnMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYub3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIGlmKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2hpc3RvcnlMZW5ndGgnKSkge1xuICAgICAgX2hpc3RvcnlMZW5ndGggPSBvcHRpb25zLmhpc3RvcnlMZW5ndGg7XG4gICAgICBfcHVzaEhpc3RvcnkobnVsbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQvZ2V0IHN0YXRlIGRhdGEuICBEZWZpbmUgdGhlIHN0YXRlcy4gIFxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3N0YXRlXSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBvYmplY3QsIG9wdGlvbmFsXG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5zdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgaWYoIXN0YXRlKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgc3RhdGUpO1xuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB3aXRoIGN1cnJlbnQgYWRkcmVzcyBhbmQgZmFsbGJhY2sgdG8gZGVmYXVsdCwgYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICAgIEFuIGluaXRpYWwgc3RhdGUgdG8gc3RhcnQgaW4uICBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLmluaXQgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uKCkge1xuXG4gICAgICAvLyBJbml0aWFsIGxvY2F0aW9uXG4gICAgICBpZigkbG9jYXRpb24udXJsKCkgIT09ICcnKSB7XG4gICAgICAgIF9zZWxmLiRsb2NhdGlvbigkbG9jYXRpb24udXJsKCksIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9zZWxmLmVtaXQoJ2luaXQnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIEluaXRpYWxpemUgd2l0aCBzdGF0ZVxuICAgICAgfSBlbHNlIGlmKG5hbWUpIHtcbiAgICAgICAgX2NoYW5nZVN0YXRlKG5hbWUsIHBhcmFtcywgdHJ1ZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBvbmx5XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfc2VsZi5lbWl0KCdpbml0Jyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoYW5nZSBzdGF0ZSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvblxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5jaGFuZ2UgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGFuZ3VsYXIuYmluZChudWxsLCBfY2hhbmdlU3RhdGUsIG5hbWUsIHBhcmFtcywgdHJ1ZSkpO1xuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogQ2hhbmdlIHN0YXRlIGJhc2VkIG9uICRsb2NhdGlvbi51cmwoKSwgYXN5bmNocm9ub3VzIG9wZXJhdGlvbiB1c2luZyBpbnRlcm5hbCBtZXRob2RzLCBxdWlldCBmYWxsYmFjay4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gICAgW2NhbGxiYWNrXSBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi4kbG9jYXRpb24gPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRhdGEgPSBfdXJsRGljdGlvbmFyeS5sb29rdXAodXJsKTtcblxuICAgIGlmKGRhdGEpIHtcbiAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICBpZihzdGF0ZSkge1xuICAgICAgICAvLyBQYXJzZSBwYXJhbXMgZnJvbSB1cmxcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcywgZmFsc2UsIGNhbGxiYWNrKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgbWlkZGxld2FyZSwgZXhlY3V0aW5nIG5leHQoZXJyKTtcbiAgICogXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSAgICBoYW5kbGVyIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpXG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi4kdXNlID0gZnVuY3Rpb24oaGFuZGxlcikge1xuICAgIGlmKHR5cGVvZiBoYW5kbGVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pZGRsZXdhcmUgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgX2xheWVyTGlzdC5wdXNoKGhhbmRsZXIpO1xuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAqIFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAqL1xuICBfc2VsZi5jdXJyZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICghX2N1cnJlbnQpID8gbnVsbCA6IGFuZ3VsYXIuY29weShfY3VycmVudCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrIHF1ZXJ5IGFnYWluc3QgY3VycmVudCBzdGF0ZVxuICAgKlxuICAgKiBAcGFyYW0gIHtNaXhlZH0gICBxdWVyeSAgQSBzdHJpbmcgdXNpbmcgc3RhdGUgbm90YXRpb24gb3IgYSBSZWdFeHBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcGFyYW1zIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAqL1xuICBfc2VsZi5hY3RpdmUgPSBmdW5jdGlvbihxdWVyeSwgcGFyYW1zKSB7XG4gICAgcXVlcnkgPSBxdWVyeSB8fCAnJztcbiAgICBcbiAgICAvLyBObyBzdGF0ZVxuICAgIGlmKCFfY3VycmVudCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gVXNlIFJlZ0V4cCBtYXRjaGluZ1xuICAgIH0gZWxzZSBpZihxdWVyeSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAvLyBTdHJpbmc7IHN0YXRlIGRvdC1ub3RhdGlvblxuICAgIH0gZWxzZSBpZih0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKSB7XG5cbiAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgaWYocXVlcnkubWF0Y2goL15cXC8uKlxcLyQvKSkge1xuICAgICAgICB2YXIgY2FzdGVkID0gcXVlcnkuc3Vic3RyKDEsIHF1ZXJ5Lmxlbmd0aC0yKTtcbiAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAvLyBUcmFuc2Zvcm0gdG8gc3RhdGUgbm90YXRpb25cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgLnNwbGl0KCcuJylcbiAgICAgICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICByZXR1cm4gJ1thLXpBLVowLTlfXSonO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGl0ZW0gPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuam9pbignXFxcXC4nKTtcblxuICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlIHN0YXRlIG5vdGF0aW9uIG5hbWUtcGFyYW1zLiAgXG4gICAqIFxuICAgKiBBc3N1bWUgYWxsIHBhcmFtZXRlciB2YWx1ZXMgYXJlIHN0cmluZ3NcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVBhcmFtcyBBIG5hbWUtcGFyYW1zIHN0cmluZ1xuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgIEEgbmFtZSBzdHJpbmcgYW5kIHBhcmFtIE9iamVjdFxuICAgKi9cbiAgX3NlbGYucGFyc2UgPSBfcGFyc2VOYW1lO1xuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBkZWZpbml0aW9uIG9mIHN0YXRlc1xuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGhhc2ggb2Ygc3RhdGVzXG4gICAqL1xuICBfc2VsZi5saWJyYXJ5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9saWJyYXJ5O1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0aW9uXG4gICAqL1xuICBfc2VsZi52YWxpZGF0ZSA9IHtcbiAgICBuYW1lOiBfdmFsaWRhdGVTdGF0ZU5hbWUsXG4gICAgcXVlcnk6IF92YWxpZGF0ZVN0YXRlUXVlcnlcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgaGlzdG9yeVxuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGhhc2ggb2Ygc3RhdGVzXG4gICAqL1xuICBfc2VsZi5oaXN0b3J5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9oaXN0b3J5O1xuICB9O1xuXG4gIC8vIFJldHVybiBpbnN0YW5jZVxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlUm91dGVyJywgJyRsb2NhdGlvbicsIGZ1bmN0aW9uKCRzdGF0ZVJvdXRlciwgJGxvY2F0aW9uKSB7XG4gIHZhciBfdXJsID0gJGxvY2F0aW9uLnVybCgpO1xuXG4gIC8vIEluc3RhbmNlIG9mIEV2ZW50RW1pdHRlclxuICB2YXIgX3NlbGYgPSBuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcigpO1xuXG4gIC8qKlxuICAgKiBEZXRlY3QgVVJMIGNoYW5nZSBhbmQgZGlzcGF0Y2ggc3RhdGUgY2hhbmdlXG4gICAqL1xuICB2YXIgX2RldGVjdENoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsYXN0VXJsID0gX3VybDtcbiAgICB2YXIgbmV4dFVybCA9ICRsb2NhdGlvbi51cmwoKTtcblxuICAgIGlmKG5leHRVcmwgIT09IGxhc3RVcmwpIHtcbiAgICAgIF91cmwgPSBuZXh0VXJsO1xuXG4gICAgICAkc3RhdGVSb3V0ZXIuJGxvY2F0aW9uKF91cmwpO1xuICAgICAgX3NlbGYuZW1pdCgndXBkYXRlOmxvY2F0aW9uJyk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgVVJMIGJhc2VkIG9uIHN0YXRlXG4gICAqL1xuICB2YXIgX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGF0ZSA9ICRzdGF0ZVJvdXRlci5jdXJyZW50KCk7XG5cbiAgICBpZihzdGF0ZSAmJiBzdGF0ZS51cmwpIHtcbiAgICAgIF91cmwgPSBzdGF0ZS51cmw7XG5cbiAgICAgIC8vIEFkZCBwYXJhbWV0ZXJzIG9yIHVzZSBkZWZhdWx0IHBhcmFtZXRlcnNcbiAgICAgIHZhciBwYXJhbXMgPSBzdGF0ZS5wYXJhbXMgfHwge307XG4gICAgICBmb3IodmFyIG5hbWUgaW4gcGFyYW1zKSB7XG4gICAgICAgIF91cmwgPSBfdXJsLnJlcGxhY2UobmV3IFJlZ0V4cCgnOicrbmFtZSwgJ2cnKSwgcGFyYW1zW25hbWVdKTtcbiAgICAgIH1cblxuICAgICAgJGxvY2F0aW9uLnVybChfdXJsKTtcbiAgICB9XG5cbiAgICBfc2VsZi5lbWl0KCd1cGRhdGUnKTtcbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlIHVybCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgX3NlbGYudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgX3VwZGF0ZSgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb2NhdGlvbiB3YXMgdXBkYXRlZDsgZm9yY2UgdXBkYXRlIGRldGVjdGlvblxuICAgKi9cbiAgX3NlbGYubG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICBfZGV0ZWN0Q2hhbmdlKGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBsYXllclxuICAkc3RhdGVSb3V0ZXIuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgX3VwZGF0ZSgpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBhcnNlIE9iamVjdCBsaXRlcmFsIG5hbWUtdmFsdWUgcGFpcnNcbnZhciByZVBhcnNlT2JqZWN0TGl0ZXJhbCA9IC8oWyx7XVxccyooKFwifCcpKC4qPylcXDN8XFx3Kil8KDpcXHMqKFsrLV0/KD89XFwuXFxkfFxcZCkoPzpcXGQrKT8oPzpcXC4/XFxkKikoPzpbZUVdWystXT9cXGQrKT98dHJ1ZXxmYWxzZXxudWxsfChcInwnKSguKj8pXFw3fFxcW1teXFxdXSpcXF0pKSkvZztcblxuLy8gTWF0Y2ggU3RyaW5nc1xudmFyIHJlU3RyaW5nID0gL14oXCJ8JykoLio/KVxcMSQvO1xuXG4vLyBUT0RPIEFkZCBlc2NhcGVkIHN0cmluZyBxdW90ZXMgXFwnIGFuZCBcXFwiIHRvIHN0cmluZyBtYXRjaGVyXG5cbi8vIE1hdGNoIE51bWJlciAoaW50L2Zsb2F0L2V4cG9uZW50aWFsKVxudmFyIHJlTnVtYmVyID0gL15bKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/JC87XG5cbi8qKlxuICogUGFyc2Ugc3RyaW5nIHZhbHVlIGludG8gQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGwuXG4gKlxuICogU3RyaW5ncyBhcmUgc3Vycm91bmRlZCBieSBhIHBhaXIgb2YgbWF0Y2hpbmcgcXVvdGVzXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdmFsdWUgQSBTdHJpbmcgdmFsdWUgdG8gcGFyc2VcbiAqIEByZXR1cm4ge01peGVkfSAgICAgICAgQSBCb29sZWFuL051bWJlci9BcnJheS9TdHJpbmcvbnVsbFxuICovXG52YXIgX3Jlc29sdmVWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cbiAgLy8gQm9vbGVhbjogdHJ1ZVxuICBpZih2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgLy8gQm9vbGVhbjogZmFsc2VcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE51bGxcbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnbnVsbCcpIHtcbiAgICByZXR1cm4gbnVsbDtcblxuICAvLyBTdHJpbmdcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlU3RyaW5nKSkge1xuICAgIHJldHVybiB2YWx1ZS5zdWJzdHIoMSwgdmFsdWUubGVuZ3RoLTIpO1xuXG4gIC8vIE51bWJlclxuICB9IGVsc2UgaWYodmFsdWUubWF0Y2gocmVOdW1iZXIpKSB7XG4gICAgcmV0dXJuICt2YWx1ZTtcblxuICAvLyBOYU5cbiAgfSBlbHNlIGlmKHZhbHVlID09PSAnTmFOJykge1xuICAgIHJldHVybiBOYU47XG5cbiAgLy8gVE9ETyBhZGQgbWF0Y2hpbmcgd2l0aCBBcnJheXMgYW5kIHBhcnNlXG4gIFxuICB9XG5cbiAgLy8gVW5hYmxlIHRvIHJlc29sdmVcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gRmluZCB2YWx1ZXMgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbnZhciBfbGlzdGlmeSA9IGZ1bmN0aW9uKHN0cikge1xuXG4gIC8vIFRyaW1cbiAgc3RyID0gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuXG4gIGlmKHN0ci5tYXRjaCgvXlxccyp7Lip9XFxzKiQvKSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVycyBleHBlY3RzIGFuIE9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHNhbml0aXplTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9eW1xceyxdP1xccypbXCInXT8vLCAnJykucmVwbGFjZSgvW1wiJ10/XFxzKiQvLCAnJyk7XG4gIH07XG5cbiAgdmFyIHNhbml0aXplVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzdHIgPSB2YWx1ZS5yZXBsYWNlKC9eKDopP1xccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgcmV0dXJuIF9yZXNvbHZlVmFsdWUoc3RyKTtcbiAgfTtcblxuICByZXR1cm4gc3RyLm1hdGNoKHJlUGFyc2VPYmplY3RMaXRlcmFsKS5tYXAoZnVuY3Rpb24oaXRlbSwgaSwgbGlzdCkge1xuICAgIHJldHVybiBpJTIgPT09IDAgPyBzYW5pdGl6ZU5hbWUoaXRlbSkgOiBzYW5pdGl6ZVZhbHVlKGl0ZW0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFyYW1zIE9iamVjdCBmcm9tIHN0cmluZ1xuICogXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5naWZpZWQgdmVyc2lvbiBvZiBPYmplY3QgbGl0ZXJhbFxuICovXG52YXIgUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHN0cikge1xuICBzdHIgPSBzdHIgfHwgJyc7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgX2xpc3RpZnkoc3RyKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICBpZihpJTIgPT09IDApIHtcbiAgICAgIF9zZWxmW2l0ZW1dID0gbGlzdFtpKzFdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYXJhbWV0ZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5yZXNvbHZlVmFsdWUgPSBfcmVzb2x2ZVZhbHVlO1xubW9kdWxlLmV4cG9ydHMubGlzdGlmeSA9IF9saXN0aWZ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgd2luZG93OmZhbHNlICovXG4vKiBnbG9iYWwgcHJvY2VzczpmYWxzZSAqL1xuLyogZ2xvYmFsIHNldEltbWVkaWF0ZTpmYWxzZSAqL1xuLyogZ2xvYmFsIHNldFRpbWVvdXQ6ZmFsc2UgKi9cblxuLy8gUG9seWZpbGwgcHJvY2Vzcy5uZXh0VGljaygpXG5cbmlmKHdpbmRvdykge1xuICBpZighd2luZG93LnByb2Nlc3MpIHtcblxuICAgIHZhciBfcHJvY2VzcyA9IHtcbiAgICAgIG5leHRUaWNrOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gRXhwb3J0XG4gICAgd2luZG93LnByb2Nlc3MgPSBfcHJvY2VzcztcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXJsID0gcmVxdWlyZSgnLi91cmwnKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBVcmxEaWN0aW9uYXJ5KCkge1xuICB0aGlzLl9wYXR0ZXJucyA9IFtdO1xuICB0aGlzLl9yZWZzID0gW107XG4gIHRoaXMuX3BhcmFtcyA9IFtdO1xufVxuXG4vKipcbiAqIEFzc29jaWF0ZSBhIFVSTCBwYXR0ZXJuIHdpdGggYSByZWZlcmVuY2VcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSBwYXR0ZXJuIEEgVVJMIHBhdHRlcm5cbiAqIEBwYXJhbSAge09iamVjdH0gcmVmICAgICBBIGRhdGEgT2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHBhdHRlcm4sIHJlZikge1xuICBwYXR0ZXJuID0gcGF0dGVybiB8fCAnJztcbiAgdmFyIF9zZWxmID0gdGhpcztcbiAgdmFyIGkgPSB0aGlzLl9wYXR0ZXJucy5sZW5ndGg7XG5cbiAgdmFyIHBhdGhDaGFpbjtcbiAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gIGlmKHBhdHRlcm4uaW5kZXhPZignPycpID09PSAtMSkge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcblxuICB9IGVsc2Uge1xuICAgIHBhdGhDaGFpbiA9IFVybChwYXR0ZXJuKS5wYXRoKCkuc3BsaXQoJy8nKTtcbiAgfVxuXG4gIC8vIFN0YXJ0XG4gIHZhciBzZWFyY2hFeHByID0gJ14nO1xuXG4gIC8vIEl0ZW1zXG4gIChwYXRoQ2hhaW4uZm9yRWFjaChmdW5jdGlvbihjaHVuaywgaSkge1xuICAgIGlmKGkhPT0wKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdcXFxcLyc7XG4gICAgfVxuXG4gICAgaWYoY2h1bmtbMF0gPT09ICc6Jykge1xuICAgICAgc2VhcmNoRXhwciArPSAnW15cXFxcLz9dKic7XG4gICAgICBwYXJhbXNbY2h1bmsuc3Vic3RyaW5nKDEpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc2VhcmNoRXhwciArPSBjaHVuaztcbiAgICB9XG4gIH0pKTtcblxuICAvLyBFbmRcbiAgc2VhcmNoRXhwciArPSAnW1xcXFwvXT8kJztcblxuICB0aGlzLl9wYXR0ZXJuc1tpXSA9IG5ldyBSZWdFeHAoc2VhcmNoRXhwcik7XG4gIHRoaXMuX3JlZnNbaV0gPSByZWY7XG4gIHRoaXMuX3BhcmFtc1tpXSA9IHBhcmFtcztcbn07XG5cbi8qKlxuICogRmluZCBhIHJlZmVyZW5jZSBhY2NvcmRpbmcgdG8gYSBVUkwgcGF0dGVybiBhbmQgcmV0cmlldmUgcGFyYW1zIGRlZmluZWQgaW4gVVJMXG4gKiBcbiAqIEBwYXJhbSAge1N0cmluZ30gdXJsICAgICAgQSBVUkwgdG8gdGVzdCBmb3JcbiAqIEBwYXJhbSAge09iamVjdH0gZGVmYXVsdHMgQSBkYXRhIE9iamVjdCBvZiBkZWZhdWx0IHBhcmFtZXRlciB2YWx1ZXNcbiAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgQSByZWZlcmVuY2UgdG8gYSBzdG9yZWQgb2JqZWN0XG4gKi9cblVybERpY3Rpb25hcnkucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uKHVybCwgZGVmYXVsdHMpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuICB2YXIgcCA9IFVybCh1cmwpLnBhdGgoKTtcbiAgdmFyIHEgPSBVcmwodXJsKS5xdWVyeXBhcmFtcygpO1xuXG4gIHZhciBfc2VsZiA9IHRoaXM7XG5cbiAgLy8gQ2hlY2sgZGljdGlvbmFyeVxuICB2YXIgX2ZpbmRQYXR0ZXJuID0gZnVuY3Rpb24oY2hlY2spIHtcbiAgICBjaGVjayA9IGNoZWNrIHx8ICcnO1xuICAgIGZvcih2YXIgaT1fc2VsZi5fcGF0dGVybnMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgaWYoY2hlY2subWF0Y2goX3NlbGYuX3BhdHRlcm5zW2ldKSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIHZhciBpID0gX2ZpbmRQYXR0ZXJuKHApO1xuICBcbiAgLy8gTWF0Y2hpbmcgcGF0dGVybiBmb3VuZFxuICBpZihpICE9PSAtMSkge1xuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHBhdHRlcm4gbWF0Y2hcbiAgICB2YXIgcGFyYW1zID0ge307XG4gICAgZm9yKHZhciBuIGluIHRoaXMuX3BhcmFtc1tpXSkge1xuICAgICAgdmFyIHBhcmFtUGFyc2VyID0gdGhpcy5fcGFyYW1zW2ldW25dO1xuICAgICAgdmFyIHVybE1hdGNoID0gKHVybC5tYXRjaChwYXJhbVBhcnNlcikgfHwgW10pLnBvcCgpIHx8ICcnO1xuICAgICAgdmFyIHZhck1hdGNoID0gdXJsTWF0Y2guc3BsaXQoJy8nKS5wb3AoKTtcbiAgICAgIHBhcmFtc1tuXSA9IHZhck1hdGNoO1xuICAgIH1cblxuICAgIC8vIFJldHJpZXZlIHBhcmFtcyBpbiBxdWVyeXN0cmluZyBtYXRjaFxuICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHEsIHBhcmFtcyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdXJsOiB1cmwsXG4gICAgICByZWY6IHRoaXMuX3JlZnNbaV0sXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG5cbiAgLy8gTm90IGluIGRpY3Rpb25hcnlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcmxEaWN0aW9uYXJ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBVcmwodXJsKSB7XG4gIHVybCA9IHVybCB8fCAnJztcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBhdGggb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyB1cmwgOiB1cmwuc3Vic3RyaW5nKDAsIHVybC5pbmRleE9mKCc/JykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5c3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICcnIDogdXJsLnN1YnN0cmluZyh1cmwuaW5kZXhPZignPycpKzEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHF1ZXJ5c3RyaW5nIG9mIGEgVVJMIHBhcmFtZXRlcnMgYXMgYSBoYXNoXG4gICAgICogXG4gICAgICogQHJldHVybiB7U3RyaW5nfSAgICAgQSBxdWVyeXN0cmluZyBmcm9tIFVSTFxuICAgICAqL1xuICAgIHF1ZXJ5cGFyYW1zOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYWlycyA9IF9zZWxmLnF1ZXJ5c3RyaW5nKCkuc3BsaXQoJyYnKTtcbiAgICAgIHZhciBwYXJhbXMgPSB7fTtcblxuICAgICAgZm9yKHZhciBpPTA7IGk8cGFpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYocGFpcnNbaV0gPT09ICcnKSBjb250aW51ZTtcbiAgICAgICAgdmFyIG5hbWVWYWx1ZSA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgIHBhcmFtc1tuYW1lVmFsdWVbMF1dID0gKHR5cGVvZiBuYW1lVmFsdWVbMV0gPT09ICd1bmRlZmluZWQnIHx8IG5hbWVWYWx1ZVsxXSA9PT0gJycpID8gdHJ1ZSA6IG5hbWVWYWx1ZVsxXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIF9zZWxmO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVybDtcbiJdfQ==
