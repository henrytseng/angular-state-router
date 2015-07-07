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
      element.on('click', function() {
        $stateRouter.change(attrs.srRef);
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
require('./utils/object');
require('./utils/process');
require('./utils/function');

// Instantiate module
angular.module('angular-state-router', [])

  .factory('$stateRouter', require('./services/state-router'))

  .factory('$urlManager', require('./services/url-manager'))

  .directive('srRef', require('./directives/sr-ref'));

},{"./directives/sr-ref":3,"./services/state-router":5,"./services/url-manager":6,"./utils/function":7,"./utils/object":8,"./utils/process":9}],5:[function(require,module,exports){
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

},{"../utils/object":8,"_process":2,"events":1}],6:[function(require,module,exports){
'use strict';

module.exports = [function() {

  return {

    // TODO get url and match to existing state; set state


  };

}];

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}]},{},[4])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy9kaXJlY3RpdmVzL3NyLXJlZi5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL2luZGV4LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvc3RhdGUtcm91dGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvdXJsLW1hbmFnZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9mdW5jdGlvbi5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL29iamVjdC5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3Byb2Nlc3MuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QUFRO0VBQ1QsR0FBRyxDQUFDLE9BQU8sU0FBUzs7SUFFbEIsSUFBSSxXQUFXO01BQ2IsVUFBVSxTQUFTLFVBQVU7UUFDM0IsV0FBVyxVQUFVOzs7OztJQUt6QixPQUFPLFVBQVU7OztBQUdyQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZVJvdXRlcicsIGZ1bmN0aW9uICgkc3RhdGVSb3V0ZXIpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0EnLFxuICAgIHNjb3BlOiB7XG4gICAgfSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIGVsZW1lbnQuY3NzKCdjdXJzb3InLCAncG9pbnRlcicpO1xuICAgICAgZWxlbWVudC5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgJHN0YXRlUm91dGVyLmNoYW5nZShhdHRycy5zclJlZik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgfTtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgYW5ndWxhcjpmYWxzZSAqL1xuXG4vLyBDb21tb25KU1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIGV4cG9ydHMgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgPT09IGV4cG9ydHMpe1xuICBtb2R1bGUuZXhwb3J0cyA9ICdhbmd1bGFyLXN0YXRlLXJvdXRlcic7XG59XG5cbi8vIFBvbHlmaWxsXG5yZXF1aXJlKCcuL3V0aWxzL29iamVjdCcpO1xucmVxdWlyZSgnLi91dGlscy9wcm9jZXNzJyk7XG5yZXF1aXJlKCcuL3V0aWxzL2Z1bmN0aW9uJyk7XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLmZhY3RvcnkoJyRzdGF0ZVJvdXRlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvc3RhdGUtcm91dGVyJykpXG5cbiAgLmZhY3RvcnkoJyR1cmxNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy91cmwtbWFuYWdlcicpKVxuXG4gIC5kaXJlY3RpdmUoJ3NyUmVmJywgcmVxdWlyZSgnLi9kaXJlY3RpdmVzL3NyLXJlZicpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cblxudmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xudmFyIGNsb25lID0gcmVxdWlyZSgnLi4vdXRpbHMvb2JqZWN0JykuY2xvbmU7XG5cbm1vZHVsZS5leHBvcnRzID0gW2Z1bmN0aW9uKCkge1xuICAvLyBDdXJyZW50IHN0YXRlXG4gIHZhciBfY3VycmVudDtcblxuICAvLyBLZWVwIHRoZSBsYXN0IG4gc3RhdGVzIChlLmcuIC0gZGVmYXVsdHMgNSlcbiAgdmFyIF9oaXN0b3J5TGVuZ3RoID0gNTtcbiAgdmFyIF9oaXN0b3J5ID0gW107XG5cbiAgdmFyIF9saWJyYXJ5ID0ge307XG4gIHZhciBfZW1pdHRlciA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG5cbiAgLy8gRXh0ZW5kIGZyb20gRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IE9iamVjdC5jcmVhdGUoX2VtaXR0ZXIpO1xuXG4gIC8qKlxuICAgKiBBZGQgZGVmYXVsdCB2YWx1ZXMgdG8gYSBzdGF0ZVxuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEFuIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQW4gT2JqZWN0XG4gICAqL1xuICB2YXIgX3NldFN0YXRlRGVmYXVsdHMgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgZGF0YS5pbmhlcml0ID0gKHR5cGVvZiBkYXRhLmluaGVyaXQgPT09ICd1bmRlZmluZWQnKSA/IHRydWUgOiBkYXRhLmluaGVyaXQ7XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNyYXdsIGxpYnJhcnkgaGVpcmFyY2h5XG4gICAqIFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBfbGlicmFyeVtuYW1lXTtcbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNyYXdsIGxpYnJhcnkgaGVpcmFyY2h5XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgbmFtZSAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgZG90LW5vdGF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbZGF0YV0gQSBzdGF0ZSBkZWZpbml0aW9uIGRhdGEgb2JqZWN0LCBvcHRpb25hbFxuICAgKi9cbiAgdmFyIF9kZWZpbmVTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZihuYW1lID09PSBudWxsIHx8IHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOYW1lIGNhbm5vdCBiZSBudWxsJyk7XG4gICAgfVxuXG4gICAgdmFyIHN0YXRlID0gY2xvbmUoZGF0YSk7XG5cbiAgICAvLyBVc2UgZGVmYXVsdHNcbiAgICBfc2V0U3RhdGVEZWZhdWx0cyhzdGF0ZSk7XG5cbiAgICAvLyBOYW1lZCBzdGF0ZVxuICAgIHN0YXRlLm5hbWUgPSBuYW1lO1xuXG4gICAgX2xpYnJhcnlbbmFtZV0gPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfTtcblxuICAvKipcbiAgICogUXVldWUgaGlzdG9yeSBhbmQgY29ycmVjdCBsZW5ndGhcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICovXG4gIHZhciBfcXVldWVIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmKGRhdGEpIHtcbiAgICAgIF9oaXN0b3J5LnB1c2goZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgIGlmKF9oaXN0b3J5Lmxlbmd0aCA+IF9oaXN0b3J5TGVuZ3RoKSB7XG4gICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gX2hpc3RvcnlMZW5ndGgpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogSW50ZXJuYWwgY2hhbmdlIHRvIHN0YXRlXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgbmFtZSAgICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgW3BhcmFtc10gICBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgKi9cbiAgdmFyIF9jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcywgY2FsbGJhY2spIHtcbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciByZXF1ZXN0RGF0YSA9IHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgICBwYXJhbXM6IHBhcmFtc1xuICAgIH07XG5cbiAgICB2YXIgbmV4dFN0YXRlID0gX2xpYnJhcnlbbmFtZV07XG4gICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgLy8gRG9lcyBub3QgZXhpc3RcbiAgICBpZighbmV4dFN0YXRlKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignUmVxdWVzdGVkIHN0YXRlIHdhcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgIGVycm9yLmNvZGUgPSAnbm90Zm91bmQnO1xuICAgICAgX3NlbGYuZW1pdCgnZXJyb3I6bm90Zm91bmQnLCBlcnJvciwgcmVxdWVzdERhdGEpO1xuICAgICAgX3NlbGYuZW1pdCgnZXJyb3InLCBlcnJvciwgcmVxdWVzdERhdGEpO1xuXG4gICAgLy8gRXhpc3RzXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByb2Nlc3Mgc3RhcnRlZFxuICAgICAgX3NlbGYuZW1pdCgnY2hhbmdlOmJlZ2luJywgcmVxdWVzdERhdGEpO1xuXG4gICAgICAvLyBWYWxpZCBzdGF0ZSBleGlzdHNcbiAgICAgIGlmKHByZXZTdGF0ZSkgX3F1ZXVlSGlzdG9yeShwcmV2U3RhdGUpO1xuICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG5cbiAgICAgIFxuXG4gICAgICAvLyBUT0RPIGNoYW5nZSBVUkwgdmFsdWVzXG5cblxuXG4gICAgICAvLyBUT0RPIGltcGxlbWVudCBsb2FkYWJsZSBpbnRlcmZhY2VcbiAgICAgIF9zZWxmLmVtaXQoJ2xvYWQ6c3RhcnQnKTtcbiAgICAgIF9zZWxmLmVtaXQoJ2xvYWQ6cHJvZ3Jlc3MnKTtcbiAgICAgIF9zZWxmLmVtaXQoJ2xvYWQ6ZW5kJyk7XG4gICAgICAvL19zZWxmLmVtaXQoJ2Vycm9yOmxvYWQnKTtcblxuXG4gICAgICAvLyBUT0RPIHJlc29sdmUgXG4gICAgICBfc2VsZi5lbWl0KCdyZXNvbHZlOnN0YXJ0Jyk7XG4gICAgICAvL19zZWxmLmVtaXQoJ2Vycm9yOnJlc29sdmUnKTtcbiAgICAgIF9zZWxmLmVtaXQoJ3Jlc29sdmU6ZW5kJyk7XG5cblxuXG5cbiAgICAgIC8vIFJlbmRlcmVkIHZpZXdcbiAgICAgIF9zZWxmLmVtaXQoJ3JlbmRlcicsIHJlcXVlc3REYXRhKTtcblxuXG5cblxuICAgICAgLy9fc2VsZi5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQW4gdW5rbm93biBlcnJvciBvY2N1cnJlZC4nKSwgcmVxdWVzdERhdGEpO1xuXG4gICAgICAvLyBQcm9jZXNzIGVuZGVkXG4gICAgICBfc2VsZi5lbWl0KCdjaGFuZ2U6ZW5kJywgcmVxdWVzdERhdGEpO1xuICAgIH1cblxuICAgIC8vIENvbXBsZXRpb25cbiAgICBpZihjYWxsYmFjaykgY2FsbGJhY2soZXJyb3IpO1xuICAgIF9zZWxmLmVtaXQoJ2NoYW5nZTpjb21wbGV0ZScsIHJlcXVlc3REYXRhKTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuICAgKiBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIHBhcmFtcyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4ge1N0YXRlUm91dGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIF9zZWxmLm9wdGlvbnMgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG5cbiAgICBpZihwYXJhbXMuaGFzT3duUHJvcGVydHkoJ2hpc3RvcnlMZW5ndGgnKSkge1xuICAgICAgX2hpc3RvcnlMZW5ndGggPSBwYXJhbXMuaGlzdG9yeUxlbmd0aDtcbiAgICAgIF9xdWV1ZUhpc3RvcnkobnVsbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXR0L2dldCBzdGF0ZSBkYXRhLiAgRGVmaW5lIHRoZSBzdGF0ZXMuICBcbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgW2RhdGFdIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIG9iamVjdCwgb3B0aW9uYWxcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgKi9cbiAgX3NlbGYuc3RhdGUgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgaWYoIWRhdGEpIHtcbiAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgfVxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBkYXRhKTtcbiAgICByZXR1cm4gX3NlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUsIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uICBEZWZpbml0aW9uIGlzIGRvbmUsIGluaXRpYWxpemUuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBbiBpbml0aWFsIHN0YXRlIHRvIHN0YXJ0IGluLiAgXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICogQHJldHVybiB7U3RhdGVSb3V0ZXJ9ICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICBfc2VsZi5pbml0ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICBcbiAgICAgIC8vIEluaXRpYWxpemUgd2l0aCBzdGF0ZVxuICAgICAgaWYobmFtZSkge1xuICAgICAgICBfY2hhbmdlU3RhdGUobmFtZSwgcGFyYW1zLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfc2VsZi5lbWl0KCdpbml0Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAvLyBJbml0aWFsaXplIG9ubHlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9zZWxmLmVtaXQoJ2luaXQnKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBfc2VsZjtcbiAgfTtcblxuICAvKipcbiAgICogUHVibGljIG1ldGhvZCB0byBjaGFuZ2Ugc3RhdGUsIGFzeW5jaHJvbm91cyBvcGVyYXRpb25cbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAgICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbcGFyYW1zXSBBIHBhcmFtZXRlcnMgZGF0YSBvYmplY3RcbiAgICovXG4gIF9zZWxmLmNoYW5nZSA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIHByb2Nlc3MubmV4dFRpY2soX2NoYW5nZVN0YXRlLmJpbmQobnVsbCwgbmFtZSwgcGFyYW1zKSk7XG4gICAgcmV0dXJuIF9zZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBjb3B5IG9mIGN1cnJlbnQgc3RhdGVcbiAgICovXG4gIF9zZWxmLmN1cnJlbnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gIV9jdXJyZW50ID8gbnVsbCA6IGNsb25lKF9jdXJyZW50KTtcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgZGVmaW5pdGlvbiBvZiBzdGF0ZXNcbiAgICogXG4gICAqIEByZXR1cm4ge09iamVjdH0gQSBoYXNoIG9mIHN0YXRlc1xuICAgKi9cbiAgX3NlbGYubGlicmFyeSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfbGlicmFyeTtcbiAgfTtcblxuICAvKipcbiAgICogUmV0cmlldmUgaGlzdG9yeVxuICAgKiBcbiAgICogQHJldHVybiB7T2JqZWN0fSBBIGhhc2ggb2Ygc3RhdGVzXG4gICAqL1xuICBfc2VsZi5oaXN0b3J5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9oaXN0b3J5O1xuICB9O1xuXG4gIC8vIFJldHVybiBpbnN0YW5jZVxuICByZXR1cm4gX3NlbGY7XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBbZnVuY3Rpb24oKSB7XG5cbiAgcmV0dXJuIHtcblxuICAgIC8vIFRPRE8gZ2V0IHVybCBhbmQgbWF0Y2ggdG8gZXhpc3Rpbmcgc3RhdGU7IHNldCBzdGF0ZVxuXG5cbiAgfTtcblxufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIFBvbHlmaWxsIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kKClcbmlmICghRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpIHtcbiAgRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbihvVGhpcykge1xuICAgIGlmICh0eXBlb2YgdGhpcyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gY2xvc2VzdCB0aGluZyBwb3NzaWJsZSB0byB0aGUgRUNNQVNjcmlwdCA1XG4gICAgICAvLyBpbnRlcm5hbCBJc0NhbGxhYmxlIGZ1bmN0aW9uXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGdW5jdGlvbi5wcm90b3R5cGUuYmluZCAtIHdoYXQgaXMgdHJ5aW5nIHRvIGJlIGJvdW5kIGlzIG5vdCBjYWxsYWJsZScpO1xuICAgIH1cblxuICAgIHZhciBhQXJncyAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgICAgZlRvQmluZCA9IHRoaXMsXG4gICAgICAgIGZOT1AgICAgPSBmdW5jdGlvbigpIHt9LFxuICAgICAgICBmQm91bmQgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIGZUb0JpbmQuYXBwbHkoXG4gICAgICAgICAgICB0aGlzIGluc3RhbmNlb2YgZk5PUCA/IHRoaXMgOiBvVGhpcyxcbiAgICAgICAgICAgIGFBcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgIH07XG5cbiAgICBmTk9QLnByb3RvdHlwZSA9IHRoaXMucHJvdG90eXBlO1xuICAgIGZCb3VuZC5wcm90b3R5cGUgPSBuZXcgZk5PUCgpO1xuXG4gICAgcmV0dXJuIGZCb3VuZDtcbiAgfTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gUG9seWZpbGwgT2JqZWN0LmNyZWF0ZSgpXG5pZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgIT09ICdmdW5jdGlvbicpIHtcbiAgLy8gUHJvZHVjdGlvbiBzdGVwcyBvZiBFQ01BLTI2MiwgRWRpdGlvbiA1LCAxNS4yLjMuNVxuICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuMi4zLjVcbiAgT2JqZWN0LmNyZWF0ZSA9IChmdW5jdGlvbigpIHtcbiAgICAvLyBUbyBzYXZlIG9uIG1lbW9yeSwgdXNlIGEgc2hhcmVkIGNvbnN0cnVjdG9yXG4gICAgZnVuY3Rpb24gVGVtcCgpIHt9XG5cbiAgICAvLyBtYWtlIGEgc2FmZSByZWZlcmVuY2UgdG8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuICAgIHZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChPKSB7XG4gICAgICAvLyAxLiBJZiBUeXBlKE8pIGlzIG5vdCBPYmplY3Qgb3IgTnVsbCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICBpZiAodHlwZW9mIE8gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdCBwcm90b3R5cGUgbWF5IG9ubHkgYmUgYW4gT2JqZWN0IG9yIG51bGwnKTtcbiAgICAgIH1cblxuICAgICAgLy8gMi4gTGV0IG9iaiBiZSB0aGUgcmVzdWx0IG9mIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBhcyBpZiBieSB0aGVcbiAgICAgIC8vICAgIGV4cHJlc3Npb24gbmV3IE9iamVjdCgpIHdoZXJlIE9iamVjdCBpcyB0aGUgc3RhbmRhcmQgYnVpbHQtaW5cbiAgICAgIC8vICAgIGNvbnN0cnVjdG9yIHdpdGggdGhhdCBuYW1lXG4gICAgICAvLyAzLiBTZXQgdGhlIFtbUHJvdG90eXBlXV0gaW50ZXJuYWwgcHJvcGVydHkgb2Ygb2JqIHRvIE8uXG4gICAgICBUZW1wLnByb3RvdHlwZSA9IE87XG4gICAgICB2YXIgb2JqID0gbmV3IFRlbXAoKTtcbiAgICAgIFRlbXAucHJvdG90eXBlID0gbnVsbDsgLy8gTGV0J3Mgbm90IGtlZXAgYSBzdHJheSByZWZlcmVuY2UgdG8gTy4uLlxuXG4gICAgICAvLyA0LiBJZiB0aGUgYXJndW1lbnQgUHJvcGVydGllcyBpcyBwcmVzZW50IGFuZCBub3QgdW5kZWZpbmVkLCBhZGRcbiAgICAgIC8vICAgIG93biBwcm9wZXJ0aWVzIHRvIG9iaiBhcyBpZiBieSBjYWxsaW5nIHRoZSBzdGFuZGFyZCBidWlsdC1pblxuICAgICAgLy8gICAgZnVuY3Rpb24gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgd2l0aCBhcmd1bWVudHMgb2JqIGFuZFxuICAgICAgLy8gICAgUHJvcGVydGllcy5cbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICAvLyBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBkb2VzIFRvT2JqZWN0IG9uIGl0cyBmaXJzdCBhcmd1bWVudC5cbiAgICAgICAgdmFyIFByb3BlcnRpZXMgPSBPYmplY3QoYXJndW1lbnRzWzFdKTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBQcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKFByb3BlcnRpZXMsIHByb3ApKSB7XG4gICAgICAgICAgICBvYmpbcHJvcF0gPSBQcm9wZXJ0aWVzW3Byb3BdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyA1LiBSZXR1cm4gb2JqXG4gICAgICByZXR1cm4gb2JqO1xuICAgIH07XG4gIH0pKCk7XG59XG5cbi8qKlxuICogQ2xvbmUgYW4gb2JqZWN0LCByZWN1cnNpdmVcbiAqIFxuICogQHBhcmFtICB7T2JqZWN0fSBvYmogQW4gT2JqZWN0XG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICBBIGNsb25lZCBPYmplY3RcbiAqL1xubW9kdWxlLmV4cG9ydHMuY2xvbmUgPSBmdW5jdGlvbiBjbG9uZShvYmosIGxldmVsKSB7XG4gIHZhciBjb3B5O1xuICBsZXZlbCA9IGxldmVsIHx8IDA7XG5cbiAgaWYobGV2ZWwgPiAyNTYpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nsb25pbmcgb2JqZWN0IG1vcmUgdGhhbiAyNTYgbGV2ZWxzJyk7XG4gIH1cblxuICAvLyBIYW5kbGUgdGhlIDMgc2ltcGxlIHR5cGVzLCBhbmQgbnVsbCBvciB1bmRlZmluZWRcbiAgaWYgKG51bGwgPT09IG9iaiB8fCBcIm9iamVjdFwiICE9IHR5cGVvZiBvYmopIHJldHVybiBvYmo7XG5cbiAgLy8gSGFuZGxlIERhdGVcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICBjb3B5ID0gbmV3IERhdGUoKTtcbiAgICBjb3B5LnNldFRpbWUob2JqLmdldFRpbWUoKSk7XG4gICAgcmV0dXJuIGNvcHk7XG4gIH1cblxuICAvLyBIYW5kbGUgQXJyYXlcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgY29weSA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBvYmoubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvcHlbaV0gPSBjbG9uZShvYmpbaV0sIGxldmVsKzEpO1xuICAgIH1cbiAgICByZXR1cm4gY29weTtcbiAgfVxuXG4gIC8vIEhhbmRsZSBPYmplY3RcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgIGNvcHkgPSB7fTtcbiAgICBmb3IgKHZhciBhdHRyIGluIG9iaikge1xuICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShhdHRyKSkgY29weVthdHRyXSA9IGNsb25lKG9ialthdHRyXSwgbGV2ZWwrMSk7XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGNvcHkgb2JqISBJdHMgdHlwZSBpc24ndCBzdXBwb3J0ZWQuXCIpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHdpbmRvdzpmYWxzZSAqL1xuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRJbW1lZGlhdGU6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRUaW1lb3V0OmZhbHNlICovXG5cbi8vIFBvbHlmaWxsIHByb2Nlc3MubmV4dFRpY2soKVxuXG5pZih3aW5kb3cpIHtcbiAgaWYoIXdpbmRvdy5wcm9jZXNzKSB7XG5cbiAgICB2YXIgX3Byb2Nlc3MgPSB7XG4gICAgICBuZXh0VGljazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIEV4cG9ydFxuICAgIHdpbmRvdy5wcm9jZXNzID0gX3Byb2Nlc3M7XG4gIH1cbn1cbiJdfQ==
