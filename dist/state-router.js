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

/* global angular:false */

// CommonJS
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'angular-state-router';
}

// Polyfill
require('./utils/object');
require('./utils/process');
require('./utils/function');

// Instantiate module
angular.module('angular-state-router', [])

  .factory('$stateRouter', require('./services/state-router'))

  .factory('$urlManager', require('./services/url-manager'));

},{"./services/state-router":4,"./services/url-manager":5,"./utils/function":6,"./utils/object":7,"./utils/process":8}],4:[function(require,module,exports){
(function (process){
'use strict';

/* global process:false */

var events = require('events');
var clone = require('../utils/object').clone;

module.exports = [function() {
  // Current state
  var _current;

  // Keep the last n states (e.g. - defaults 5)
  var _historyLength = 5;
  var _history = [];

  var _library = {};
  var _emitter = new events.EventEmitter();

  // Extend from EventEmitter
  var _self = Object.create(_emitter);

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
   * Internal method to crawl library heirarchy
   * 
   * @param {String} name   A unique identifier for the state; using dot-notation
   */
  var _getState = function(name) {
    return _library[name];
  };

  /**
   * Internal method to crawl library heirarchy
   * 
   * @param  {String}      name   A unique identifier for the state; using dot-notation
   * @param  {Object}      [data] A state definition data object, optional
   */
  var _defineState = function(name, data) {
    if(name === null || typeof name === 'undefined') {
      throw new Error('Name cannot be null');
    }

    var state = clone(data);

    // Use defaults
    _setStateDefaults(state);

    // Named state
    state.name = name;

    _library[name] = state;

    return state;
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
   * Internal change to state
   * 
   * @param  {String}   name       A unique identifier for the state; using dot-notation
   * @param  {Object}   [params]   A parameters data object
   * @param  {Function} [callback] A callback, function(err)
   */
  var _changeState = function(name, params, callback) {
    var error = null;
    var requestData = {
      name: name,
      params: params
    };

    var nextState = _library[name];
    var prevState = _current;

    // Does not exist
    if(!nextState) {
      error = new Error('Requested state was not defined.');
      error.code = 'notfound';
      _self.emit('error:notfound', error, requestData);
      _self.emit('error', error, requestData);

    // Exists
    } else {
      // Process started
      _self.emit('change:begin', requestData);

      // Valid state exists
      if(prevState) _queueHistory(prevState);
      _current = nextState;

      

      // TODO change URL values



      // TODO implement loadable interface
      _self.emit('load:start');
      _self.emit('load:progress');
      _self.emit('load:end');
      //_self.emit('error:load');


      // TODO resolve 
      _self.emit('resolve:start');
      //_self.emit('error:resolve');
      _self.emit('resolve:end');




      // Rendered view
      _self.emit('render', requestData);




      //_self.emit('error', new Error('An unknown error occurred.'), requestData);

      // Process ended
      _self.emit('change:end', requestData);
    }

    // Completion
    if(callback) callback(error);
    _self.emit('change:complete', requestData);
  };

  /**
   * Set configuration options
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
   * Sett/get state data.  Define the states.  
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
   * @param  {String}      name     An initial state to start in.  
   * @param  {Object}      [params] A parameters data object
   * @return {StateRouter}          Itself; chainable
   */
  _self.init = function(name, params) {
    process.nextTick(function() {
    
      // Initialize with state
      if(name) {
        _changeState(name, params, function() {
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
   * Public method to change state, asynchronous operation
   * 
   * @param  {String} name     A unique identifier for the state; using dot-notation
   * @param  {Object} [params] A parameters data object
   */
  _self.change = function(name, params) {
    process.nextTick(_changeState.bind(null, name, params));
    return _self;
  };

  /**
   * Retrieve copy of current state
   * 
   * @return {Object} A copy of current state
   */
  _self.current = function() {
    return !_current ? null : clone(_current);
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

},{"../utils/object":7,"_process":2,"events":1}],5:[function(require,module,exports){
'use strict';

module.exports = [function() {


  return {

    // TODO get url and match to existing state; set state


  };

}];

},{}],6:[function(require,module,exports){
'use strict';

// Polyfill Function.prototype.bind()
if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs   = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP    = function() {},
        fBound  = function() {
          return fToBind.apply(
            this instanceof fNOP ? this : oThis,
            aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

},{}],7:[function(require,module,exports){
'use strict';

// Polyfill Object.create()
if (typeof Object.create !== 'function') {
  // Production steps of ECMA-262, Edition 5, 15.2.3.5
  // Reference: http://es5.github.io/#x15.2.3.5
  Object.create = (function() {
    // To save on memory, use a shared constructor
    function Temp() {}

    // make a safe reference to Object.prototype.hasOwnProperty
    var hasOwn = Object.prototype.hasOwnProperty;

    return function (O) {
      // 1. If Type(O) is not Object or Null throw a TypeError exception.
      if (typeof O !== 'object') {
        throw new TypeError('Object prototype may only be an Object or null');
      }

      // 2. Let obj be the result of creating a new object as if by the
      //    expression new Object() where Object is the standard built-in
      //    constructor with that name
      // 3. Set the [[Prototype]] internal property of obj to O.
      Temp.prototype = O;
      var obj = new Temp();
      Temp.prototype = null; // Let's not keep a stray reference to O...

      // 4. If the argument Properties is present and not undefined, add
      //    own properties to obj as if by calling the standard built-in
      //    function Object.defineProperties with arguments obj and
      //    Properties.
      if (arguments.length > 1) {
        // Object.defineProperties does ToObject on its first argument.
        var Properties = Object(arguments[1]);
        for (var prop in Properties) {
          if (hasOwn.call(Properties, prop)) {
            obj[prop] = Properties[prop];
          }
        }
      }

      // 5. Return obj
      return obj;
    };
  })();
}

/**
 * Clone an object, recursive
 * 
 * @param  {Object} obj An Object
 * @return {Object}     A cloned Object
 */
module.exports.clone = function clone(obj, level) {
  var copy;
  level = level || 0;

  if(level > 256) {
    throw new Error('Cloning object more than 256 levels');
  }

  // Handle the 3 simple types, and null or undefined
  if (null === obj || "object" != typeof obj) return obj;

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = clone(obj[i], level+1);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr], level+1);
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
};

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

},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3N0YXRlLXJvdXRlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3NlcnZpY2VzL3VybC1tYW5hZ2VyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvZnVuY3Rpb24uanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9vYmplY3QuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9wcm9jZXNzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FD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QUFPLEtBQUssWUFBWSxPQUFPO1lBQ2pDLElBQUksUUFBUSxXQUFXOzs7Ozs7TUFNN0IsT0FBTzs7Ozs7Ozs7Ozs7QUFXYixPQUFPLFFBQVEsUUFBUSxTQUFTLE1BQU0sS0FBSyxPQUFPO0VBQ2hELElBQUk7RUFDSixRQUFRLFNBQVM7O0VBRWpCLEdBQUcsUUFBUSxLQUFLO0lBQ2QsTUFBTSxJQUFJLE1BQU07Ozs7RUFJbEIsSUFBSSxTQUFTLE9BQU8sWUFBWSxPQUFPLEtBQUssT0FBTzs7O0VBR25ELElBQUksZUFBZSxNQUFNO0lBQ3ZCLE9BQU8sSUFBSTtJQUNYLEtBQUssUUFBUSxJQUFJO0lBQ2pCLE9BQU87Ozs7RUFJVCxJQUFJLGVBQWUsT0FBTztJQUN4QixPQUFPO0lBQ1AsS0FBSyxJQUFJLElBQUksR0FBRyxNQUFNLElBQUksUUFBUSxJQUFJLEtBQUssS0FBSztNQUM5QyxLQUFLLEtBQUssTUFBTSxJQUFJLElBQUksTUFBTTs7SUFFaEMsT0FBTzs7OztFQUlULElBQUksZUFBZSxRQUFRO0lBQ3pCLE9BQU87SUFDUCxLQUFLLElBQUksUUFBUSxLQUFLO01BQ3BCLElBQUksSUFBSSxlQUFlLE9BQU8sS0FBSyxRQUFRLE1BQU0sSUFBSSxPQUFPLE1BQU07O0lBRXBFLE9BQU87OztFQUdULE1BQU0sSUFBSSxNQUFNOztBQUVsQjs7QUMzRkE7Ozs7Ozs7OztBQVNBLEdBQUcsUUFBUTtFQUNULEdBQUcsQ0FBQyxPQUFPLFNBQVM7O0lBRWxCLElBQUksV0FBVztNQUNiLFVBQVUsU0FBUyxVQUFVO1FBQzNCLFdBQVcsVUFBVTs7Ozs7SUFLekIsT0FBTyxVQUFVOzs7QUFHckIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyOmZhbHNlICovXG5cbi8vIENvbW1vbkpTXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZXhwb3J0cyl7XG4gIG1vZHVsZS5leHBvcnRzID0gJ2FuZ3VsYXItc3RhdGUtcm91dGVyJztcbn1cblxuLy8gUG9seWZpbGxcbnJlcXVpcmUoJy4vdXRpbHMvb2JqZWN0Jyk7XG5yZXF1aXJlKCcuL3V0aWxzL3Byb2Nlc3MnKTtcbnJlcXVpcmUoJy4vdXRpbHMvZnVuY3Rpb24nKTtcblxuLy8gSW5zdGFudGlhdGUgbW9kdWxlXG5hbmd1bGFyLm1vZHVsZSgnYW5ndWxhci1zdGF0ZS1yb3V0ZXInLCBbXSlcblxuICAuZmFjdG9yeSgnJHN0YXRlUm91dGVyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy9zdGF0ZS1yb3V0ZXInKSlcblxuICAuZmFjdG9yeSgnJHVybE1hbmFnZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL3VybC1tYW5hZ2VyJykpO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBwcm9jZXNzOmZhbHNlICovXG5cbnZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4uL3V0aWxzL29iamVjdCcpLmNsb25lO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFtmdW5jdGlvbigpIHtcbiAgLy8gQ3VycmVudCBzdGF0ZVxuICB2YXIgX2N1cnJlbnQ7XG5cbiAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gIHZhciBfaGlzdG9yeUxlbmd0aCA9IDU7XG4gIHZhciBfaGlzdG9yeSA9IFtdO1xuXG4gIHZhciBfbGlicmFyeSA9IHt9O1xuICB2YXIgX2VtaXR0ZXIgPSBuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcigpO1xuXG4gIC8vIEV4dGVuZCBmcm9tIEV2ZW50RW1pdHRlclxuICB2YXIgX3NlbGYgPSBPYmplY3QuY3JlYXRlKF9lbWl0dGVyKTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGRhdGEuaW5oZXJpdCA9ICh0eXBlb2YgZGF0YS5pbmhlcml0ID09PSAndW5kZWZpbmVkJykgPyB0cnVlIDogZGF0YS5pbmhlcml0O1xuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKi9cbiAgdmFyIF9nZXRTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gX2xpYnJhcnlbbmFtZV07XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW2RhdGFdIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIG9iamVjdCwgb3B0aW9uYWxcbiAgICovXG4gIHZhciBfZGVmaW5lU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYobmFtZSA9PT0gbnVsbCB8fCB0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTmFtZSBjYW5ub3QgYmUgbnVsbCcpO1xuICAgIH1cblxuICAgIHZhciBzdGF0ZSA9IGNsb25lKGRhdGEpO1xuXG4gICAgLy8gVXNlIGRlZmF1bHRzXG4gICAgX3NldFN0YXRlRGVmYXVsdHMoc3RhdGUpO1xuXG4gICAgLy8gTmFtZWQgc3RhdGVcbiAgICBzdGF0ZS5uYW1lID0gbmFtZTtcblxuICAgIF9saWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFF1ZXVlIGhpc3RvcnkgYW5kIGNvcnJlY3QgbGVuZ3RoXG4gICAqIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3F1ZXVlSGlzdG9yeSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZihkYXRhKSB7XG4gICAgICBfaGlzdG9yeS5wdXNoKGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBsZW5ndGhcbiAgICBpZihfaGlzdG9yeS5sZW5ndGggPiBfaGlzdG9yeUxlbmd0aCkge1xuICAgICAgX2hpc3Rvcnkuc3BsaWNlKDAsIF9oaXN0b3J5Lmxlbmd0aCAtIF9oaXN0b3J5TGVuZ3RoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIGNoYW5nZSB0byBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIG5hbWUgICAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIFtwYXJhbXNdICAgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICovXG4gIHZhciBfY2hhbmdlU3RhdGUgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGVycm9yID0gbnVsbDtcbiAgICB2YXIgcmVxdWVzdERhdGEgPSB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuXG4gICAgdmFyIG5leHRTdGF0ZSA9IF9saWJyYXJ5W25hbWVdO1xuICAgIHZhciBwcmV2U3RhdGUgPSBfY3VycmVudDtcblxuICAgIC8vIERvZXMgbm90IGV4aXN0XG4gICAgaWYoIW5leHRTdGF0ZSkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICBlcnJvci5jb2RlID0gJ25vdGZvdW5kJztcbiAgICAgIF9zZWxmLmVtaXQoJ2Vycm9yOm5vdGZvdW5kJywgZXJyb3IsIHJlcXVlc3REYXRhKTtcbiAgICAgIF9zZWxmLmVtaXQoJ2Vycm9yJywgZXJyb3IsIHJlcXVlc3REYXRhKTtcblxuICAgIC8vIEV4aXN0c1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBQcm9jZXNzIHN0YXJ0ZWRcbiAgICAgIF9zZWxmLmVtaXQoJ2NoYW5nZTpiZWdpbicsIHJlcXVlc3REYXRhKTtcblxuICAgICAgLy8gVmFsaWQgc3RhdGUgZXhpc3RzXG4gICAgICBpZihwcmV2U3RhdGUpIF9xdWV1ZUhpc3RvcnkocHJldlN0YXRlKTtcbiAgICAgIF9jdXJyZW50ID0gbmV4dFN0YXRlO1xuXG4gICAgICBcblxuICAgICAgLy8gVE9ETyBjaGFuZ2UgVVJMIHZhbHVlc1xuXG5cblxuICAgICAgLy8gVE9ETyBpbXBsZW1lbnQgbG9hZGFibGUgaW50ZXJmYWNlXG4gICAgICBfc2VsZi5lbWl0KCdsb2FkOnN0YXJ0Jyk7XG4gICAgICBfc2VsZi5lbWl0KCdsb2FkOnByb2dyZXNzJyk7XG4gICAgICBfc2VsZi5lbWl0KCdsb2FkOmVuZCcpO1xuICAgICAgLy9fc2VsZi5lbWl0KCdlcnJvcjpsb2FkJyk7XG5cblxuICAgICAgLy8gVE9ETyByZXNvbHZlIFxuICAgICAgX3NlbGYuZW1pdCgncmVzb2x2ZTpzdGFydCcpO1xuICAgICAgLy9fc2VsZi5lbWl0KCdlcnJvcjpyZXNvbHZlJyk7XG4gICAgICBfc2VsZi5lbWl0KCdyZXNvbHZlOmVuZCcpO1xuXG5cblxuXG4gICAgICAvLyBSZW5kZXJlZCB2aWV3XG4gICAgICBfc2VsZi5lbWl0KCdyZW5kZXInLCByZXF1ZXN0RGF0YSk7XG5cblxuXG5cbiAgICAgIC8vX3NlbGYuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ0FuIHVua25vd24gZXJyb3Igb2NjdXJyZWQuJyksIHJlcXVlc3REYXRhKTtcblxuICAgICAgLy8gUHJvY2VzcyBlbmRlZFxuICAgICAgX3NlbGYuZW1pdCgnY2hhbmdlOmVuZCcsIHJlcXVlc3REYXRhKTtcbiAgICB9XG5cbiAgICAvLyBDb21wbGV0aW9uXG4gICAgaWYoY2FsbGJhY2spIGNhbGxiYWNrKGVycm9yKTtcbiAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6Y29tcGxldGUnLCByZXF1ZXN0RGF0YSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCBjb25maWd1cmF0aW9uIG9wdGlvbnNcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBwYXJhbXMgQSBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtTdGF0ZVJvdXRlcn0gICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5vcHRpb25zID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgaWYocGFyYW1zLmhhc093blByb3BlcnR5KCdoaXN0b3J5TGVuZ3RoJykpIHtcbiAgICAgIF9oaXN0b3J5TGVuZ3RoID0gcGFyYW1zLmhpc3RvcnlMZW5ndGg7XG4gICAgICBfcXVldWVIaXN0b3J5KG51bGwpO1xuICAgIH1cblxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0dC9nZXQgc3RhdGUgZGF0YS4gIERlZmluZSB0aGUgc3RhdGVzLiAgXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtkYXRhXSBBIHN0YXRlIGRlZmluaXRpb24gZGF0YSBvYmplY3QsIG9wdGlvbmFsXG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLnN0YXRlID0gZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuICAgIGlmKCFkYXRhKSB7XG4gICAgICByZXR1cm4gX2dldFN0YXRlKG5hbWUpO1xuICAgIH1cbiAgICBfZGVmaW5lU3RhdGUobmFtZSwgZGF0YSk7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiAgRGVmaW5pdGlvbiBpcyBkb25lLCBpbml0aWFsaXplLiAgXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgICAgQW4gaW5pdGlhbCBzdGF0ZSB0byBzdGFydCBpbi4gIFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuaW5pdCA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgXG4gICAgICAvLyBJbml0aWFsaXplIHdpdGggc3RhdGVcbiAgICAgIGlmKG5hbWUpIHtcbiAgICAgICAgX2NoYW5nZVN0YXRlKG5hbWUsIHBhcmFtcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3NlbGYuZW1pdCgnaW5pdCcpO1xuICAgICAgICB9KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBvbmx5XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfc2VsZi5lbWl0KCdpbml0Jyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIFB1YmxpYyBtZXRob2QgdG8gY2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gW3BhcmFtc10gQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAqL1xuICBfc2VsZi5jaGFuZ2UgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKF9jaGFuZ2VTdGF0ZS5iaW5kKG51bGwsIG5hbWUsIHBhcmFtcykpO1xuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAqIFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAqL1xuICBfc2VsZi5jdXJyZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICFfY3VycmVudCA/IG51bGwgOiBjbG9uZShfY3VycmVudCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAqIFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgaGFzaCBvZiBzdGF0ZXNcbiAgICovXG4gIF9zZWxmLmxpYnJhcnkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX2xpYnJhcnk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGhpc3RvcnlcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIHN0YXRlc1xuICAgKi9cbiAgX3NlbGYuaGlzdG9yeSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfaGlzdG9yeTtcbiAgfTtcblxuICAvLyBSZXR1cm4gaW5zdGFuY2VcbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uKCkge1xuXG5cbiAgcmV0dXJuIHtcblxuICAgIC8vIFRPRE8gZ2V0IHVybCBhbmQgbWF0Y2ggdG8gZXhpc3Rpbmcgc3RhdGU7IHNldCBzdGF0ZVxuXG5cbiAgfTtcblxufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBvbHlmaWxsIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kKClcbmlmICghRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpIHtcbiAgRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbihvVGhpcykge1xuICAgIGlmICh0eXBlb2YgdGhpcyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gY2xvc2VzdCB0aGluZyBwb3NzaWJsZSB0byB0aGUgRUNNQVNjcmlwdCA1XG4gICAgICAvLyBpbnRlcm5hbCBJc0NhbGxhYmxlIGZ1bmN0aW9uXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGdW5jdGlvbi5wcm90b3R5cGUuYmluZCAtIHdoYXQgaXMgdHJ5aW5nIHRvIGJlIGJvdW5kIGlzIG5vdCBjYWxsYWJsZScpO1xuICAgIH1cblxuICAgIHZhciBhQXJncyAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgICAgZlRvQmluZCA9IHRoaXMsXG4gICAgICAgIGZOT1AgICAgPSBmdW5jdGlvbigpIHt9LFxuICAgICAgICBmQm91bmQgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIGZUb0JpbmQuYXBwbHkoXG4gICAgICAgICAgICB0aGlzIGluc3RhbmNlb2YgZk5PUCA/IHRoaXMgOiBvVGhpcyxcbiAgICAgICAgICAgIGFBcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgIH07XG5cbiAgICBmTk9QLnByb3RvdHlwZSA9IHRoaXMucHJvdG90eXBlO1xuICAgIGZCb3VuZC5wcm90b3R5cGUgPSBuZXcgZk5PUCgpO1xuXG4gICAgcmV0dXJuIGZCb3VuZDtcbiAgfTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUG9seWZpbGwgT2JqZWN0LmNyZWF0ZSgpXG5pZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgIT09ICdmdW5jdGlvbicpIHtcbiAgLy8gUHJvZHVjdGlvbiBzdGVwcyBvZiBFQ01BLTI2MiwgRWRpdGlvbiA1LCAxNS4yLjMuNVxuICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuMi4zLjVcbiAgT2JqZWN0LmNyZWF0ZSA9IChmdW5jdGlvbigpIHtcbiAgICAvLyBUbyBzYXZlIG9uIG1lbW9yeSwgdXNlIGEgc2hhcmVkIGNvbnN0cnVjdG9yXG4gICAgZnVuY3Rpb24gVGVtcCgpIHt9XG5cbiAgICAvLyBtYWtlIGEgc2FmZSByZWZlcmVuY2UgdG8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuICAgIHZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChPKSB7XG4gICAgICAvLyAxLiBJZiBUeXBlKE8pIGlzIG5vdCBPYmplY3Qgb3IgTnVsbCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICBpZiAodHlwZW9mIE8gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdCBwcm90b3R5cGUgbWF5IG9ubHkgYmUgYW4gT2JqZWN0IG9yIG51bGwnKTtcbiAgICAgIH1cblxuICAgICAgLy8gMi4gTGV0IG9iaiBiZSB0aGUgcmVzdWx0IG9mIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBhcyBpZiBieSB0aGVcbiAgICAgIC8vICAgIGV4cHJlc3Npb24gbmV3IE9iamVjdCgpIHdoZXJlIE9iamVjdCBpcyB0aGUgc3RhbmRhcmQgYnVpbHQtaW5cbiAgICAgIC8vICAgIGNvbnN0cnVjdG9yIHdpdGggdGhhdCBuYW1lXG4gICAgICAvLyAzLiBTZXQgdGhlIFtbUHJvdG90eXBlXV0gaW50ZXJuYWwgcHJvcGVydHkgb2Ygb2JqIHRvIE8uXG4gICAgICBUZW1wLnByb3RvdHlwZSA9IE87XG4gICAgICB2YXIgb2JqID0gbmV3IFRlbXAoKTtcbiAgICAgIFRlbXAucHJvdG90eXBlID0gbnVsbDsgLy8gTGV0J3Mgbm90IGtlZXAgYSBzdHJheSByZWZlcmVuY2UgdG8gTy4uLlxuXG4gICAgICAvLyA0LiBJZiB0aGUgYXJndW1lbnQgUHJvcGVydGllcyBpcyBwcmVzZW50IGFuZCBub3QgdW5kZWZpbmVkLCBhZGRcbiAgICAgIC8vICAgIG93biBwcm9wZXJ0aWVzIHRvIG9iaiBhcyBpZiBieSBjYWxsaW5nIHRoZSBzdGFuZGFyZCBidWlsdC1pblxuICAgICAgLy8gICAgZnVuY3Rpb24gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgd2l0aCBhcmd1bWVudHMgb2JqIGFuZFxuICAgICAgLy8gICAgUHJvcGVydGllcy5cbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICAvLyBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBkb2VzIFRvT2JqZWN0IG9uIGl0cyBmaXJzdCBhcmd1bWVudC5cbiAgICAgICAgdmFyIFByb3BlcnRpZXMgPSBPYmplY3QoYXJndW1lbnRzWzFdKTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBQcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKFByb3BlcnRpZXMsIHByb3ApKSB7XG4gICAgICAgICAgICBvYmpbcHJvcF0gPSBQcm9wZXJ0aWVzW3Byb3BdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyA1LiBSZXR1cm4gb2JqXG4gICAgICByZXR1cm4gb2JqO1xuICAgIH07XG4gIH0pKCk7XG59XG5cbi8qKlxuICogQ2xvbmUgYW4gb2JqZWN0LCByZWN1cnNpdmVcbiAqIFxuICogQHBhcmFtICB7T2JqZWN0fSBvYmogQW4gT2JqZWN0XG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICBBIGNsb25lZCBPYmplY3RcbiAqL1xubW9kdWxlLmV4cG9ydHMuY2xvbmUgPSBmdW5jdGlvbiBjbG9uZShvYmosIGxldmVsKSB7XG4gIHZhciBjb3B5O1xuICBsZXZlbCA9IGxldmVsIHx8IDA7XG5cbiAgaWYobGV2ZWwgPiAyNTYpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nsb25pbmcgb2JqZWN0IG1vcmUgdGhhbiAyNTYgbGV2ZWxzJyk7XG4gIH1cblxuICAvLyBIYW5kbGUgdGhlIDMgc2ltcGxlIHR5cGVzLCBhbmQgbnVsbCBvciB1bmRlZmluZWRcbiAgaWYgKG51bGwgPT09IG9iaiB8fCBcIm9iamVjdFwiICE9IHR5cGVvZiBvYmopIHJldHVybiBvYmo7XG5cbiAgLy8gSGFuZGxlIERhdGVcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICBjb3B5ID0gbmV3IERhdGUoKTtcbiAgICBjb3B5LnNldFRpbWUob2JqLmdldFRpbWUoKSk7XG4gICAgcmV0dXJuIGNvcHk7XG4gIH1cblxuICAvLyBIYW5kbGUgQXJyYXlcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgY29weSA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBvYmoubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvcHlbaV0gPSBjbG9uZShvYmpbaV0sIGxldmVsKzEpO1xuICAgIH1cbiAgICByZXR1cm4gY29weTtcbiAgfVxuXG4gIC8vIEhhbmRsZSBPYmplY3RcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgIGNvcHkgPSB7fTtcbiAgICBmb3IgKHZhciBhdHRyIGluIG9iaikge1xuICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShhdHRyKSkgY29weVthdHRyXSA9IGNsb25lKG9ialthdHRyXSwgbGV2ZWwrMSk7XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGNvcHkgb2JqISBJdHMgdHlwZSBpc24ndCBzdXBwb3J0ZWQuXCIpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHdpbmRvdzpmYWxzZSAqL1xuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRJbW1lZGlhdGU6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRUaW1lb3V0OmZhbHNlICovXG5cbi8vIFBvbHlmaWxsIHByb2Nlc3MubmV4dFRpY2soKVxuXG5pZih3aW5kb3cpIHtcbiAgaWYoIXdpbmRvdy5wcm9jZXNzKSB7XG5cbiAgICB2YXIgX3Byb2Nlc3MgPSB7XG4gICAgICBuZXh0VGljazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIEV4cG9ydFxuICAgIHdpbmRvdy5wcm9jZXNzID0gX3Byb2Nlc3M7XG4gIH1cbn1cbiJdfQ==
