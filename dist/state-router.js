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

},{"../utils/process":7}],3:[function(require,module,exports){
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

  .run(['$rootScope', '$urlManager', '$state', function($rootScope, $urlManager, $state) {
    // Update location changes
    $rootScope.$on('$locationChangeSuccess', function() {
      $urlManager.location(arguments);
    });

    // Initialize
    $state.$ready();
  }])

  .directive('sref', require('./directives/sref'));

},{"./directives/sref":2,"./services/state-router":4,"./services/url-manager":5}],4:[function(require,module,exports){
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
  this.$get = ['$location', function StateRouterFactory($location) {

    var _iOptions;
    var _iInitialLocation;
    var _history = [];
    var _isInit = false;

    /**
     * Internal method to add history and correct length
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
        params: params
      };

      // Compile execution phases
      var queue = QueueHandler().data(request);

      var nextState = angular.copy(_getState(name));
      var prevState = _current;

      // Set parameters
      if(nextState) {
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
              _changeState(_iInitialLocation.name, _iInitialLocation.params, function() {
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

},{"../utils/parameters":6,"../utils/process":7,"../utils/queue-handler":8,"../utils/url-dictionary":9,"events":1}],5:[function(require,module,exports){
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

},{"../utils/url-dictionary":9,"events":1}],6:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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
      var executionList = _list.slice(0);

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

},{"../utils/process":7}],9:[function(require,module,exports){
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

},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL2RpcmVjdGl2ZXMvc3JlZi5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL2luZGV4LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvc3RhdGUtcm91dGVyLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvc2VydmljZXMvdXJsLW1hbmFnZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy9wYXJhbWV0ZXJzLmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXJvdXRlci9zcmMvdXRpbHMvcHJvY2Vzcy5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3F1ZXVlLWhhbmRsZXIuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtcm91dGVyL3NyYy91dGlscy91cmwtZGljdGlvbmFyeS5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS1yb3V0ZXIvc3JjL3V0aWxzL3VybC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBOztBQUVBLElBQUksVUFBVSxRQUFROztBQUV0QixPQUFPLFVBQVUsQ0FBQyxVQUFVLGNBQWMsVUFBVSxRQUFRLFlBQVk7RUFDdEUsT0FBTyxHQUFHLG1CQUFtQixXQUFXO0lBQ3RDLFdBQVc7OztFQUdiLE9BQU87SUFDTCxVQUFVO0lBQ1YsT0FBTzs7SUFFUCxNQUFNLFNBQVMsT0FBTyxTQUFTLE9BQU87TUFDcEMsUUFBUSxJQUFJLFVBQVU7TUFDdEIsUUFBUSxHQUFHLFNBQVMsU0FBUyxHQUFHO1FBQzlCLE9BQU8sT0FBTyxNQUFNO1FBQ3BCLEVB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QUNqQjs7QUNuSEE7O0FBRUEsU0FBUyxJQUFJLEtBQUs7RUFDaEIsTUFBTSxPQUFPOzs7RUFHYixJQUFJLFFBQVE7Ozs7Ozs7SUFPVixNQUFNLFdBQVc7TUFDZixPQUFPLElBQUksUUFBUSxTQUFTLENBQUMsSUFBSSxNQUFNLElBQUksVUFBVSxHQUFHLElBQUksUUFBUTs7Ozs7Ozs7SUFRdEUsYUFBYSxXQUFXO01BQ3RCLE9BQU8sSUFBSSxRQUFRLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxVQUFVLElBQUksUUFBUSxLQUFLOzs7Ozs7OztJQVF2RSxhQUFhLFdBQVc7TUFDdEIsSUFBSSxRQUFRLE1BQU0sY0FBYyxNQUFNO01BQ3RDLElBQUksU0FBUzs7TUFFYixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxRQUFRLEtBQUs7UUFDaEMsR0FBRyxNQUFNLE9BQU8sSUFBSTtRQUNwQixJQUFJLFlBQVksTUFBTSxHQUFHLE1BQU07UUFDL0IsT0FBTyxVQUFVLE1BQU0sQ0FBQyxPQUFPLFVBQVUsT0FBTyxlQUFlLFVBQVUsT0FBTyxNQUFNLE9BQU8sVUFBVTs7O01BR3pHLE9BQU87Ozs7RUFJWCxPQUFPOzs7QUFHVCxPQUFPLFVBQVU7QUFDakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcHJvY2VzcyA9IHJlcXVpcmUoJy4uL3V0aWxzL3Byb2Nlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBbJyRzdGF0ZScsICckcm9vdFNjb3BlJywgZnVuY3Rpb24gKCRzdGF0ZSwgJHJvb3RTY29wZSkge1xuICAkc3RhdGUub24oJ2NoYW5nZTpjb21wbGV0ZScsIGZ1bmN0aW9uKCkge1xuICAgICRyb290U2NvcGUuJGFwcGx5KCk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdBJyxcbiAgICBzY29wZToge1xuICAgIH0sXG4gICAgbGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG4gICAgICBlbGVtZW50LmNzcygnY3Vyc29yJywgJ3BvaW50ZXInKTtcbiAgICAgIGVsZW1lbnQub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAkc3RhdGUuY2hhbmdlKGF0dHJzLnNyZWYpO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgfTtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgYW5ndWxhcjpmYWxzZSAqL1xuXG4vLyBDb21tb25KU1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIGV4cG9ydHMgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgPT09IGV4cG9ydHMpe1xuICBtb2R1bGUuZXhwb3J0cyA9ICdhbmd1bGFyLXN0YXRlLXJvdXRlcic7XG59XG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtcm91dGVyJywgW10pXG5cbiAgLnByb3ZpZGVyKCckc3RhdGUnLCByZXF1aXJlKCcuL3NlcnZpY2VzL3N0YXRlLXJvdXRlcicpKVxuXG4gIC5mYWN0b3J5KCckdXJsTWFuYWdlcicsIHJlcXVpcmUoJy4vc2VydmljZXMvdXJsLW1hbmFnZXInKSlcblxuICAucnVuKFsnJHJvb3RTY29wZScsICckdXJsTWFuYWdlcicsICckc3RhdGUnLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkdXJsTWFuYWdlciwgJHN0YXRlKSB7XG4gICAgLy8gVXBkYXRlIGxvY2F0aW9uIGNoYW5nZXNcbiAgICAkcm9vdFNjb3BlLiRvbignJGxvY2F0aW9uQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuICAgICAgJHVybE1hbmFnZXIubG9jYXRpb24oYXJndW1lbnRzKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWxpemVcbiAgICAkc3RhdGUuJHJlYWR5KCk7XG4gIH1dKVxuXG4gIC5kaXJlY3RpdmUoJ3NyZWYnLCByZXF1aXJlKCcuL2RpcmVjdGl2ZXMvc3JlZicpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBwcm9jZXNzID0gcmVxdWlyZSgnLi4vdXRpbHMvcHJvY2VzcycpO1xudmFyIFVybERpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi91dGlscy91cmwtZGljdGlvbmFyeScpO1xudmFyIFBhcmFtZXRlcnMgPSByZXF1aXJlKCcuLi91dGlscy9wYXJhbWV0ZXJzJyk7XG52YXIgUXVldWVIYW5kbGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvcXVldWUtaGFuZGxlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIFN0YXRlUm91dGVyUHJvdmlkZXIoKSB7XG4gIC8vIEluc3RhbmNlXG4gIHZhciBfcHJvdmlkZXIgPSB0aGlzO1xuXG4gIC8vIEN1cnJlbnQgc3RhdGVcbiAgdmFyIF9jdXJyZW50O1xuXG4gIC8vIE9wdGlvbnNcbiAgdmFyIF9vcHRpb25zID0ge1xuICAgIGhpc3RvcnlMZW5ndGg6IDVcbiAgfTtcblxuICAvLyBMaWJyYXJ5XG4gIHZhciBfbGlicmFyeSA9IHt9O1xuICB2YXIgX2NhY2hlID0ge307XG5cbiAgLy8gVVJMIHRvIHN0YXRlIGRpY3Rpb25hcnlcbiAgdmFyIF91cmxEaWN0aW9uYXJ5ID0gbmV3IFVybERpY3Rpb25hcnkoKTtcblxuICAvLyBNaWRkbGV3YXJlIGxheWVyc1xuICB2YXIgX2xheWVyTGlzdCA9IFtdO1xuXG4gIC8vIERlbGVnYXRlZCBFdmVudEVtaXR0ZXJcbiAgdmFyIF9kaXNwYXRjaGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuXG4gIC8vIEluaXRhbCBsb2NhdGlvblxuICB2YXIgX2luaXRpYWxMb2NhdGlvbjtcblxuICAvLyBXcmFwIHByb3ZpZGVyIG1ldGhvZHNcbiAgW1xuICAgICdhZGRMaXN0ZW5lcicsIFxuICAgICdvbicsIFxuICAgICdvbmNlJywgXG4gICAgJ3JlbW92ZUxpc3RlbmVyJywgXG4gICAgJ3JlbW92ZUFsbExpc3RlbmVycycsIFxuICAgICdsaXN0ZW5lcnMnLCBcbiAgICAnZW1pdCcsIFxuICBdLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgX3Byb3ZpZGVyW21ldGhvZF0gPSBhbmd1bGFyLmJpbmQoX2Rpc3BhdGNoZXIsIF9kaXNwYXRjaGVyW21ldGhvZF0pO1xuICB9KTtcblxuICAvKipcbiAgICogUGFyc2Ugc3RhdGUgbm90YXRpb24gbmFtZS1wYXJhbXMuICBcbiAgICogXG4gICAqIEFzc3VtZSBhbGwgcGFyYW1ldGVyIHZhbHVlcyBhcmUgc3RyaW5nc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lUGFyYW1zIEEgbmFtZS1wYXJhbXMgc3RyaW5nXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgQSBuYW1lIHN0cmluZyBhbmQgcGFyYW0gT2JqZWN0XG4gICAqL1xuICB2YXIgX3BhcnNlTmFtZSA9IGZ1bmN0aW9uKG5hbWVQYXJhbXMpIHtcbiAgICBpZihuYW1lUGFyYW1zICYmIG5hbWVQYXJhbXMubWF0Y2goL15bYS16QS1aMC05X1xcLl0qXFwoLipcXCkkLykpIHtcbiAgICAgIHZhciBucGFydCA9IG5hbWVQYXJhbXMuc3Vic3RyaW5nKDAsIG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKTtcbiAgICAgIHZhciBwcGFydCA9IFBhcmFtZXRlcnMoIG5hbWVQYXJhbXMuc3Vic3RyaW5nKG5hbWVQYXJhbXMuaW5kZXhPZignKCcpKzEsIG5hbWVQYXJhbXMubGFzdEluZGV4T2YoJyknKSkgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbnBhcnQsXG4gICAgICAgIHBhcmFtczogcHBhcnRcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogbmFtZVBhcmFtcyxcbiAgICAgICAgcGFyYW1zOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQWRkIGRlZmF1bHQgdmFsdWVzIHRvIGEgc3RhdGVcbiAgICogXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgIEFuIE9iamVjdFxuICAgKi9cbiAgdmFyIF9zZXRTdGF0ZURlZmF1bHRzID0gZnVuY3Rpb24oZGF0YSkge1xuXG4gICAgLy8gRGVmYXVsdCB2YWx1ZXNcbiAgICBkYXRhLmluaGVyaXQgPSAodHlwZW9mIGRhdGEuaW5oZXJpdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IGRhdGEuaW5oZXJpdDtcblxuICAgIHJldHVybiBkYXRhO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBuYW1lXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICBUcnVlIGlmIG5hbWUgaXMgdmFsaWQsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgdmFyIF92YWxpZGF0ZVN0YXRlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbmFtZSB8fCAnJztcblxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgZm9yKHZhciBpPTA7IGk8bmFtZUNoYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZighbmFtZUNoYWluW2ldLm1hdGNoKC9bYS16QS1aMC05X10rLykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzdGF0ZSBxdWVyeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBxdWVyeSAgQSBxdWVyeSBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgVHJ1ZSBpZiBuYW1lIGlzIHZhbGlkLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHZhciBfdmFsaWRhdGVTdGF0ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgIFxuICAgIC8vIFRPRE8gb3B0aW1pemUgd2l0aCBSZWdFeHBcblxuICAgIHZhciBuYW1lQ2hhaW4gPSBxdWVyeS5zcGxpdCgnLicpO1xuICAgIGZvcih2YXIgaT0wOyBpPG5hbWVDaGFpbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoIW5hbWVDaGFpbltpXS5tYXRjaCgvKFxcKihcXCopP3xbYS16QS1aMC05X10rKS8pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGFyZSB0d28gc3RhdGVzLCBjb21wYXJlcyB2YWx1ZXMuICBcbiAgICogXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3RhdGVzIGFyZSB0aGUgc2FtZSwgZmFsc2UgaWYgc3RhdGVzIGFyZSBkaWZmZXJlbnRcbiAgICovXG4gIHZhciBfY29tcGFyZVN0YXRlcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gYW5ndWxhci5lcXVhbHMoYSwgYik7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBhIGxpc3Qgb2YgcGFyZW50IHN0YXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBkb3Qtbm90YXRpb25cbiAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgQW4gQXJyYXkgb2YgcGFyZW50IHN0YXRlc1xuICAgKi9cbiAgdmFyIF9nZXROYW1lQ2hhaW4gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG5hbWVMaXN0ID0gbmFtZS5zcGxpdCgnLicpO1xuXG4gICAgcmV0dXJuIG5hbWVMaXN0XG4gICAgICAubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Quc2xpY2UoMCwgaSsxKS5qb2luKCcuJyk7XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBudWxsO1xuICAgICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBjcmF3bCBsaWJyYXJ5IGhlaXJhcmNoeVxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lICAgQSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHN0YXRlOyB1c2luZyBzdGF0ZS1ub3RhdGlvblxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBBIHN0YXRlIGRhdGEgT2JqZWN0XG4gICAqL1xuICB2YXIgX2dldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgdmFyIHN0YXRlID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIHF1ZXJpZXNcbiAgICBpZighX3ZhbGlkYXRlU3RhdGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBcbiAgICAvLyBVc2UgY2FjaGUgaWYgZXhpc3RzXG4gICAgfSBlbHNlIGlmKF9jYWNoZVtuYW1lXSkge1xuICAgICAgcmV0dXJuIF9jYWNoZVtuYW1lXTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZUNoYWluID0gX2dldE5hbWVDaGFpbihuYW1lKTtcblxuICAgIHZhciBzdGF0ZUNoYWluID0gbmFtZUNoYWluXG4gICAgICAubWFwKGZ1bmN0aW9uKHBuYW1lKSB7XG4gICAgICAgIHJldHVybiBfbGlicmFyeVtwbmFtZV07XG4gICAgICB9KVxuICAgICAgLmZpbHRlcihmdW5jdGlvbihwYXJlbnQpIHtcbiAgICAgICAgcmV0dXJuIHBhcmVudCAhPT0gbnVsbDtcbiAgICAgIH0pO1xuXG4gICAgLy8gV2FsayB1cCBjaGVja2luZyBpbmhlcml0YW5jZVxuICAgIGZvcih2YXIgaT1zdGF0ZUNoYWluLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgIGlmKHN0YXRlQ2hhaW5baV0pIHtcbiAgICAgICAgc3RhdGUgPSBhbmd1bGFyLmV4dGVuZChhbmd1bGFyLmNvcHkoc3RhdGVDaGFpbltpXSksIHN0YXRlIHx8IHt9KTtcbiAgICAgIH1cblxuICAgICAgaWYoc3RhdGUgJiYgIXN0YXRlLmluaGVyaXQpIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFN0b3JlIGluIGNhY2hlXG4gICAgX2NhY2hlW25hbWVdID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBzdG9yZSBhIHN0YXRlIGRlZmluaXRpb24uICBQYXJhbWV0ZXJzIHNob3VsZCBiZSBpbmNsdWRlZCBpbiBkYXRhIE9iamVjdCBub3Qgc3RhdGUgbmFtZS4gIFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIEEgc3RhdGUgZGVmaW5pdGlvbiBkYXRhIE9iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgQSBzdGF0ZSBkYXRhIE9iamVjdFxuICAgKi9cbiAgdmFyIF9kZWZpbmVTdGF0ZSA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICBpZihuYW1lID09PSBudWxsIHx8IHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOYW1lIGNhbm5vdCBiZSBudWxsLicpO1xuICAgIFxuICAgIC8vIE9ubHkgdXNlIHZhbGlkIHN0YXRlIG5hbWVzXG4gICAgfSBlbHNlIGlmKCFfdmFsaWRhdGVTdGF0ZU5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdGF0ZSBuYW1lLicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzdGF0ZVxuICAgIHZhciBzdGF0ZSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblxuICAgIC8vIFVzZSBkZWZhdWx0c1xuICAgIF9zZXRTdGF0ZURlZmF1bHRzKHN0YXRlKTtcblxuICAgIC8vIE5hbWVkIHN0YXRlXG4gICAgc3RhdGUubmFtZSA9IG5hbWU7XG5cbiAgICAvLyBTZXQgZGVmaW5pdGlvblxuICAgIF9saWJyYXJ5W25hbWVdID0gc3RhdGU7XG5cbiAgICAvLyBSZXNldCBjYWNoZVxuICAgIF9jYWNoZSA9IHt9O1xuXG4gICAgLy8gVVJMIG1hcHBpbmdcbiAgICBpZihzdGF0ZS51cmwpIHtcbiAgICAgIF91cmxEaWN0aW9uYXJ5LmFkZChzdGF0ZS51cmwsIHN0YXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGNvbmZpZ3VyYXRpb24gZGF0YSBwYXJhbWV0ZXJzIGZvciBTdGF0ZVJvdXRlclxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgb3B0aW9ucyBBIGRhdGEgT2JqZWN0XG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLm9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBpZihvcHRpb25zLmhhc093blByb3BlcnR5KCdoaXN0b3J5TGVuZ3RoJykpIHtcbiAgICAgIF9vcHRpb25zLmhpc3RvcnlMZW5ndGggPSBvcHRpb25zLmhpc3RvcnlMZW5ndGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0L2dldCBzdGF0ZVxuICAgKiBcbiAgICogQHJldHVybiB7JHN0YXRlUHJvdmlkZXJ9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAqL1xuICB0aGlzLnN0YXRlID0gZnVuY3Rpb24obmFtZSwgc3RhdGUpIHtcbiAgICBpZighc3RhdGUpIHtcbiAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgfVxuICAgIF9kZWZpbmVTdGF0ZShuYW1lLCBzdGF0ZSk7XG4gICAgcmV0dXJuIF9wcm92aWRlcjtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGluaXRpYWxpemF0aW9uIHBhcmFtZXRlcnM7IGRlZmVycmVkIHRvICRyZWFkeSgpXG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgbmFtZSAgIEEgaW5paXRhbCBzdGF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgcGFyYW1zIEEgZGF0YSBvYmplY3Qgb2YgcGFyYW1zXG4gICAqIEByZXR1cm4geyRzdGF0ZVByb3ZpZGVyfSAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICovXG4gIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykge1xuICAgIF9pbml0aWFsTG9jYXRpb24gPSB7XG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICB9O1xuICAgIHJldHVybiBfcHJvdmlkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBpbnN0YW5jZVxuICAgKi9cbiAgdGhpcy4kZ2V0ID0gWyckbG9jYXRpb24nLCBmdW5jdGlvbiBTdGF0ZVJvdXRlckZhY3RvcnkoJGxvY2F0aW9uKSB7XG5cbiAgICB2YXIgX2lPcHRpb25zO1xuICAgIHZhciBfaUluaXRpYWxMb2NhdGlvbjtcbiAgICB2YXIgX2hpc3RvcnkgPSBbXTtcbiAgICB2YXIgX2lzSW5pdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGFkZCBoaXN0b3J5IGFuZCBjb3JyZWN0IGxlbmd0aFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBbiBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgX3B1c2hIaXN0b3J5ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgLy8gS2VlcCB0aGUgbGFzdCBuIHN0YXRlcyAoZS5nLiAtIGRlZmF1bHRzIDUpXG4gICAgICB2YXIgaGlzdG9yeUxlbmd0aCA9IF9pT3B0aW9ucy5oaXN0b3J5TGVuZ3RoIHx8IDU7XG5cbiAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgX2hpc3RvcnkucHVzaChkYXRhKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGxlbmd0aFxuICAgICAgaWYoX2hpc3RvcnkubGVuZ3RoID4gaGlzdG9yeUxlbmd0aCkge1xuICAgICAgICBfaGlzdG9yeS5zcGxpY2UoMCwgX2hpc3RvcnkubGVuZ3RoIC0gaGlzdG9yeUxlbmd0aCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIG1ldGhvZCB0byBjaGFuZ2UgdG8gc3RhdGUuICBQYXJhbWV0ZXJzIGluIGBwYXJhbXNgIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBzdGF0ZS1ub3RhdGlvbiBgbmFtZWAgZXhwcmVzc2lvbi4gIFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gICBuYW1lICAgICAgICAgIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBzdGF0ZTsgdXNpbmcgc3RhdGUtbm90YXRpb24gaW5jbHVkaW5nIG9wdGlvbmFsIHBhcmFtZXRlcnNcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcGFyYW1zICAgICAgICBBIGRhdGEgb2JqZWN0IG9mIHBhcmFtc1xuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdICAgIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKGVycilcbiAgICAgKi9cbiAgICB2YXIgX2NoYW5nZVN0YXRlID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zLCBjYWxsYmFjaykge1xuICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgICAvLyBQYXJzZSBzdGF0ZS1ub3RhdGlvbiBleHByZXNzaW9uXG4gICAgICB2YXIgbmFtZUV4cHIgPSBfcGFyc2VOYW1lKG5hbWUpO1xuICAgICAgbmFtZSA9IG5hbWVFeHByLm5hbWU7XG4gICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuYW1lRXhwci5wYXJhbXMgfHwge30sIHBhcmFtcyk7XG5cbiAgICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgICB2YXIgcmVxdWVzdCA9IHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICAgIH07XG5cbiAgICAgIC8vIENvbXBpbGUgZXhlY3V0aW9uIHBoYXNlc1xuICAgICAgdmFyIHF1ZXVlID0gUXVldWVIYW5kbGVyKCkuZGF0YShyZXF1ZXN0KTtcblxuICAgICAgdmFyIG5leHRTdGF0ZSA9IGFuZ3VsYXIuY29weShfZ2V0U3RhdGUobmFtZSkpO1xuICAgICAgdmFyIHByZXZTdGF0ZSA9IF9jdXJyZW50O1xuXG4gICAgICAvLyBTZXQgcGFyYW1ldGVyc1xuICAgICAgaWYobmV4dFN0YXRlKSB7XG4gICAgICAgIG5leHRTdGF0ZS5wYXJhbXMgPSBhbmd1bGFyLmV4dGVuZChuZXh0U3RhdGUucGFyYW1zIHx8IHt9LCBwYXJhbXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBEb2VzIG5vdCBleGlzdFxuICAgICAgaWYobmV4dFN0YXRlID09PSBudWxsKSB7XG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlcXVlc3RlZCBzdGF0ZSB3YXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgZXJyb3IuY29kZSA9ICdub3Rmb3VuZCc7XG5cbiAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdlcnJvcjpub3Rmb3VuZCcsIGVycm9yLCByZXF1ZXN0KTtcbiAgICAgICAgICBuZXh0KGVycm9yKTtcbiAgICAgICAgfSk7XG5cbiAgICAgIC8vIFN0YXRlIG5vdCBjaGFuZ2VkXG4gICAgICB9IGVsc2UgaWYoX2NvbXBhcmVTdGF0ZXMocHJldlN0YXRlLCBuZXh0U3RhdGUpKSB7XG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgX2N1cnJlbnQgPSBuZXh0U3RhdGU7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAvLyBWYWxpZCBzdGF0ZSBleGlzdHNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE1ha2Ugc3RhdGUgY2hhbmdlXG4gICAgICAgIHF1ZXVlLmFkZChmdW5jdGlvbihkYXRhLCBuZXh0KSB7XG4gICAgICAgICAgaWYocHJldlN0YXRlKSBfcHVzaEhpc3RvcnkocHJldlN0YXRlKTtcbiAgICAgICAgICBfY3VycmVudCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICBcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFByb2Nlc3Mgc3RhcnRlZFxuICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24oZGF0YSwgbmV4dCkge1xuICAgICAgICAgIF9kaXNwYXRjaGVyLmVtaXQoJ2NoYW5nZTpiZWdpbicsIHJlcXVlc3QpO1xuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIG1pZGRsZXdhcmVcbiAgICAgICAgcXVldWUuYWRkKF9sYXllckxpc3QpO1xuXG4gICAgICAgIC8vIFByb2Nlc3MgZW5kZWRcbiAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uKGRhdGEsIG5leHQpIHtcbiAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdjaGFuZ2U6ZW5kJywgcmVxdWVzdCk7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gUnVuXG4gICAgICBxdWV1ZS5leGVjdXRlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdlcnJvcicsIGVyciwgcmVxdWVzdCk7XG4gICAgICAgIH1cblxuICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdjaGFuZ2U6Y29tcGxldGUnLCBlcnIsIHJlcXVlc3QpO1xuXG4gICAgICAgIGlmKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcblxuXG4gICAgLy8gSW5zdGFuY2VcbiAgICB2YXIgX2luc3Q7XG4gICAgX2luc3QgPSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogR2V0IG9wdGlvbnNcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29uZmlndXJlZCBvcHRpb25zXG4gICAgICAgKi9cbiAgICAgIG9wdGlvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBIYXNuJ3QgYmVlbiBpbml0aWFsaXplZFxuICAgICAgICBpZighX2lPcHRpb25zKSB7XG4gICAgICAgICAgX2lPcHRpb25zID0gYW5ndWxhci5jb3B5KF9vcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfaU9wdGlvbnM7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldC9nZXQgc3RhdGVcbiAgICAgICAqL1xuICAgICAgc3RhdGU6IGZ1bmN0aW9uKG5hbWUsIHN0YXRlKSB7XG4gICAgICAgIGlmKCFzdGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfZ2V0U3RhdGUobmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgX2RlZmluZVN0YXRlKG5hbWUsIHN0YXRlKTtcbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gYWRkIG1pZGRsZXdhcmUsIGV4ZWN1dGluZyBuZXh0KGVycik7XG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSAgICBoYW5kbGVyIEEgY2FsbGJhY2ssIGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9ICAgICAgICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAgICovXG4gICAgICAkdXNlOiBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgICAgIGlmKHR5cGVvZiBoYW5kbGVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaWRkbGV3YXJlIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9sYXllckxpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgICAgcmV0dXJuIF9pbnN0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcGVyZm9ybSBpbml0aWFsaXphdGlvblxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHskc3RhdGV9IEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgICRyZWFkeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKCFfaXNJbml0KSB7XG4gICAgICAgICAgX2lzSW5pdCA9IHRydWU7XG5cbiAgICAgICAgICAvLyBDb25maWd1cmF0aW9uXG4gICAgICAgICAgX2lPcHRpb25zID0gYW5ndWxhci5jb3B5KF9vcHRpb25zKTtcbiAgICAgICAgICBpZihfaW5pdGlhbExvY2F0aW9uKSBfaUluaXRpYWxMb2NhdGlvbiA9IGFuZ3VsYXIuY29weShfaW5pdGlhbExvY2F0aW9uKTtcblxuICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWwgbG9jYXRpb25cbiAgICAgICAgICAgIGlmKCRsb2NhdGlvbi51cmwoKSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgX2luc3QuJGxvY2F0aW9uKCRsb2NhdGlvbi51cmwoKSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnaW5pdCcpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSB3aXRoIHN0YXRlXG4gICAgICAgICAgICB9IGVsc2UgaWYoX2lJbml0aWFsTG9jYXRpb24pIHtcbiAgICAgICAgICAgICAgX2NoYW5nZVN0YXRlKF9pSW5pdGlhbExvY2F0aW9uLm5hbWUsIF9pSW5pdGlhbExvY2F0aW9uLnBhcmFtcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX2Rpc3BhdGNoZXIuZW1pdCgnaW5pdCcpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBvbmx5XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBfZGlzcGF0Y2hlci5lbWl0KCdpbml0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuXG4gICAgICAvLyBQYXJzZSBzdGF0ZSBub3RhdGlvbiBuYW1lLXBhcmFtcy4gIFxuICAgICAgcGFyc2U6IF9wYXJzZU5hbWUsXG5cbiAgICAgIC8vIFJldHJpZXZlIGRlZmluaXRpb24gb2Ygc3RhdGVzXG4gICAgICBsaWJyYXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9saWJyYXJ5O1xuICAgICAgfSxcblxuICAgICAgLy8gVmFsaWRhdGlvblxuICAgICAgdmFsaWRhdGU6IHtcbiAgICAgICAgbmFtZTogX3ZhbGlkYXRlU3RhdGVOYW1lLFxuICAgICAgICBxdWVyeTogX3ZhbGlkYXRlU3RhdGVRdWVyeVxuICAgICAgfSxcblxuICAgICAgLy8gUmV0cmlldmUgaGlzdG9yeVxuICAgICAgaGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfaGlzdG9yeTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hhbmdlIHN0YXRlLCBhc3luY2hyb25vdXMgb3BlcmF0aW9uXG4gICAgICAgKiBcbiAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gICAgICBuYW1lICAgICBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc3RhdGU7IHVzaW5nIGRvdC1ub3RhdGlvblxuICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtwYXJhbXNdIEEgcGFyYW1ldGVycyBkYXRhIG9iamVjdFxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICAgKi9cbiAgICAgIGNoYW5nZTogZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soYW5ndWxhci5iaW5kKG51bGwsIF9jaGFuZ2VTdGF0ZSwgbmFtZSwgcGFyYW1zKSk7XG4gICAgICAgIHJldHVybiBfaW5zdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgbWV0aG9kIHRvIGNoYW5nZSBzdGF0ZSBiYXNlZCBvbiAkbG9jYXRpb24udXJsKCksIGFzeW5jaHJvbm91cyBvcGVyYXRpb24gdXNpbmcgaW50ZXJuYWwgbWV0aG9kcywgcXVpZXQgZmFsbGJhY2suICBcbiAgICAgICAqIFxuICAgICAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIHVybCAgICAgICAgQSB1cmwgbWF0Y2hpbmcgZGVmaW5kIHN0YXRlc1xuICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259ICAgIFtjYWxsYmFja10gQSBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgICAgICogQHJldHVybiB7JHN0YXRlfSAgICAgICAgICAgICAgICAgSXRzZWxmOyBjaGFpbmFibGVcbiAgICAgICAqL1xuICAgICAgJGxvY2F0aW9uOiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkYXRhID0gX3VybERpY3Rpb25hcnkubG9va3VwKHVybCk7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgIHZhciBzdGF0ZSA9IGRhdGEucmVmO1xuXG4gICAgICAgICAgaWYoc3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtcyBmcm9tIHVybFxuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhhbmd1bGFyLmJpbmQobnVsbCwgX2NoYW5nZVN0YXRlLCBzdGF0ZS5uYW1lLCBkYXRhLnBhcmFtcywgY2FsbGJhY2spKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2luc3Q7XG4gICAgICB9LFxuICAgICAgXG4gICAgICAvKipcbiAgICAgICAqIFJldHJpZXZlIGNvcHkgb2YgY3VycmVudCBzdGF0ZVxuICAgICAgICogXG4gICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEEgY29weSBvZiBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGN1cnJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKCFfY3VycmVudCkgPyBudWxsIDogYW5ndWxhci5jb3B5KF9jdXJyZW50KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2hlY2sgcXVlcnkgYWdhaW5zdCBjdXJyZW50IHN0YXRlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICB7TWl4ZWR9ICAgcXVlcnkgIEEgc3RyaW5nIHVzaW5nIHN0YXRlIG5vdGF0aW9uIG9yIGEgUmVnRXhwXG4gICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBwYXJhbXMgQSBwYXJhbWV0ZXJzIGRhdGEgb2JqZWN0XG4gICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgQSB0cnVlIGlmIHN0YXRlIGlzIHBhcmVudCB0byBjdXJyZW50IHN0YXRlXG4gICAgICAgKi9cbiAgICAgIGFjdGl2ZTogZnVuY3Rpb24ocXVlcnksIHBhcmFtcykge1xuICAgICAgICBxdWVyeSA9IHF1ZXJ5IHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgLy8gTm8gc3RhdGVcbiAgICAgICAgaWYoIV9jdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIFVzZSBSZWdFeHAgbWF0Y2hpbmdcbiAgICAgICAgfSBlbHNlIGlmKHF1ZXJ5IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChxdWVyeSk7XG5cbiAgICAgICAgLy8gU3RyaW5nOyBzdGF0ZSBkb3Qtbm90YXRpb25cbiAgICAgICAgfSBlbHNlIGlmKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIC8vIENhc3Qgc3RyaW5nIHRvIFJlZ0V4cFxuICAgICAgICAgIGlmKHF1ZXJ5Lm1hdGNoKC9eXFwvLipcXC8kLykpIHtcbiAgICAgICAgICAgIHZhciBjYXN0ZWQgPSBxdWVyeS5zdWJzdHIoMSwgcXVlcnkubGVuZ3RoLTIpO1xuICAgICAgICAgICAgcmV0dXJuICEhX2N1cnJlbnQubmFtZS5tYXRjaChuZXcgUmVnRXhwKGNhc3RlZCkpO1xuXG4gICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHN0YXRlIG5vdGF0aW9uXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHF1ZXJ5XG4gICAgICAgICAgICAgIC5zcGxpdCgnLicpXG4gICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0gPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X10qJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYoaXRlbSA9PT0gJyoqJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdbYS16QS1aMC05X1xcXFwuXSonO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5qb2luKCdcXFxcLicpO1xuXG4gICAgICAgICAgICByZXR1cm4gISFfY3VycmVudC5uYW1lLm1hdGNoKG5ldyBSZWdFeHAodHJhbnNmb3JtZWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tbWF0Y2hpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBXcmFwIGluc3RhbmNlIG1ldGhvZHNcbiAgICBbXG4gICAgICAnYWRkTGlzdGVuZXInLCBcbiAgICAgICdvbicsIFxuICAgICAgJ29uY2UnLCBcbiAgICAgICdyZW1vdmVMaXN0ZW5lcicsIFxuICAgICAgJ3JlbW92ZUFsbExpc3RlbmVycycsIFxuICAgICAgJ2xpc3RlbmVycycsIFxuICAgICAgJ2VtaXQnLCBcbiAgICBdLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgICBfaW5zdFttZXRob2RdID0gYW5ndWxhci5iaW5kKF9kaXNwYXRjaGVyLCBfZGlzcGF0Y2hlclttZXRob2RdKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBfaW5zdDtcbiAgfV07XG5cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgVXJsRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL3V0aWxzL3VybC1kaWN0aW9uYXJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckc3RhdGUnLCAnJGxvY2F0aW9uJywgZnVuY3Rpb24oJHN0YXRlLCAkbG9jYXRpb24pIHtcbiAgdmFyIF91cmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgLy8gSW5zdGFuY2Ugb2YgRXZlbnRFbWl0dGVyXG4gIHZhciBfc2VsZiA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxuICAvKipcbiAgICogRGV0ZWN0IFVSTCBjaGFuZ2UgYW5kIGRpc3BhdGNoIHN0YXRlIGNoYW5nZVxuICAgKi9cbiAgdmFyIF9kZXRlY3RDaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGFzdFVybCA9IF91cmw7XG4gICAgdmFyIG5leHRVcmwgPSAkbG9jYXRpb24udXJsKCk7XG5cbiAgICBpZihuZXh0VXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICBfdXJsID0gbmV4dFVybDtcblxuICAgICAgJHN0YXRlLiRsb2NhdGlvbihfdXJsKTtcbiAgICAgIF9zZWxmLmVtaXQoJ3VwZGF0ZTpsb2NhdGlvbicpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlIFVSTCBiYXNlZCBvbiBzdGF0ZVxuICAgKi9cbiAgdmFyIF91cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhdGUgPSAkc3RhdGUuY3VycmVudCgpO1xuXG4gICAgaWYoc3RhdGUgJiYgc3RhdGUudXJsKSB7XG4gICAgICBfdXJsID0gc3RhdGUudXJsO1xuXG4gICAgICAvLyBBZGQgcGFyYW1ldGVycyBvciB1c2UgZGVmYXVsdCBwYXJhbWV0ZXJzXG4gICAgICB2YXIgcGFyYW1zID0gc3RhdGUucGFyYW1zIHx8IHt9O1xuICAgICAgZm9yKHZhciBuYW1lIGluIHBhcmFtcykge1xuICAgICAgICBfdXJsID0gX3VybC5yZXBsYWNlKG5ldyBSZWdFeHAoJzonK25hbWUsICdnJyksIHBhcmFtc1tuYW1lXSk7XG4gICAgICB9XG5cbiAgICAgICRsb2NhdGlvbi51cmwoX3VybCk7XG4gICAgfVxuXG4gICAgX3NlbGYuZW1pdCgndXBkYXRlJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB1cmwgYmFzZWQgb24gc3RhdGVcbiAgICovXG4gIF9zZWxmLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIF91cGRhdGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogTG9jYXRpb24gd2FzIHVwZGF0ZWQ7IGZvcmNlIHVwZGF0ZSBkZXRlY3Rpb25cbiAgICovXG4gIF9zZWxmLmxvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgX2RldGVjdENoYW5nZShhcmd1bWVudHMpO1xuICB9O1xuXG4gIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgJHN0YXRlLiR1c2UoZnVuY3Rpb24ocmVxdWVzdCwgbmV4dCkge1xuICAgIF91cGRhdGUoKTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn1dO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBQYXJzZSBPYmplY3QgbGl0ZXJhbCBuYW1lLXZhbHVlIHBhaXJzXG52YXIgcmVQYXJzZU9iamVjdExpdGVyYWwgPSAvKFsse11cXHMqKChcInwnKSguKj8pXFwzfFxcdyopfCg6XFxzKihbKy1dPyg/PVxcLlxcZHxcXGQpKD86XFxkKyk/KD86XFwuP1xcZCopKD86W2VFXVsrLV0/XFxkKyk/fHRydWV8ZmFsc2V8bnVsbHwoXCJ8JykoLio/KVxcN3xcXFtbXlxcXV0qXFxdKSkpL2c7XG5cbi8vIE1hdGNoIFN0cmluZ3NcbnZhciByZVN0cmluZyA9IC9eKFwifCcpKC4qPylcXDEkLztcblxuLy8gVE9ETyBBZGQgZXNjYXBlZCBzdHJpbmcgcXVvdGVzIFxcJyBhbmQgXFxcIiB0byBzdHJpbmcgbWF0Y2hlclxuXG4vLyBNYXRjaCBOdW1iZXIgKGludC9mbG9hdC9leHBvbmVudGlhbClcbnZhciByZU51bWJlciA9IC9eWystXT8oPz1cXC5cXGR8XFxkKSg/OlxcZCspPyg/OlxcLj9cXGQqKSg/OltlRV1bKy1dP1xcZCspPyQvO1xuXG4vKipcbiAqIFBhcnNlIHN0cmluZyB2YWx1ZSBpbnRvIEJvb2xlYW4vTnVtYmVyL0FycmF5L1N0cmluZy9udWxsLlxuICpcbiAqIFN0cmluZ3MgYXJlIHN1cnJvdW5kZWQgYnkgYSBwYWlyIG9mIG1hdGNoaW5nIHF1b3Rlc1xuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHZhbHVlIEEgU3RyaW5nIHZhbHVlIHRvIHBhcnNlXG4gKiBAcmV0dXJuIHtNaXhlZH0gICAgICAgIEEgQm9vbGVhbi9OdW1iZXIvQXJyYXkvU3RyaW5nL251bGxcbiAqL1xudmFyIF9yZXNvbHZlVmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXG4gIC8vIEJvb2xlYW46IHRydWVcbiAgaWYodmFsdWUgPT09ICd0cnVlJykge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIC8vIEJvb2xlYW46IGZhbHNlXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ2ZhbHNlJykge1xuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBOdWxsXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ251bGwnKSB7XG4gICAgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RyaW5nXG4gIH0gZWxzZSBpZih2YWx1ZS5tYXRjaChyZVN0cmluZykpIHtcbiAgICByZXR1cm4gdmFsdWUuc3Vic3RyKDEsIHZhbHVlLmxlbmd0aC0yKTtcblxuICAvLyBOdW1iZXJcbiAgfSBlbHNlIGlmKHZhbHVlLm1hdGNoKHJlTnVtYmVyKSkge1xuICAgIHJldHVybiArdmFsdWU7XG5cbiAgLy8gTmFOXG4gIH0gZWxzZSBpZih2YWx1ZSA9PT0gJ05hTicpIHtcbiAgICByZXR1cm4gTmFOO1xuXG4gIC8vIFRPRE8gYWRkIG1hdGNoaW5nIHdpdGggQXJyYXlzIGFuZCBwYXJzZVxuICBcbiAgfVxuXG4gIC8vIFVuYWJsZSB0byByZXNvbHZlXG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIEZpbmQgdmFsdWVzIGluIGFuIG9iamVjdCBsaXRlcmFsXG52YXIgX2xpc3RpZnkgPSBmdW5jdGlvbihzdHIpIHtcblxuICAvLyBUcmltXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcblxuICBpZihzdHIubWF0Y2goL15cXHMqey4qfVxccyokLykgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhcmFtZXRlcnMgZXhwZWN0cyBhbiBPYmplY3QnKTtcbiAgfVxuXG4gIHZhciBzYW5pdGl6ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvXltcXHssXT9cXHMqW1wiJ10/LywgJycpLnJlcGxhY2UoL1tcIiddP1xccyokLywgJycpO1xuICB9O1xuXG4gIHZhciBzYW5pdGl6ZVZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc3RyID0gdmFsdWUucmVwbGFjZSgvXig6KT9cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xuICAgIHJldHVybiBfcmVzb2x2ZVZhbHVlKHN0cik7XG4gIH07XG5cbiAgcmV0dXJuIHN0ci5tYXRjaChyZVBhcnNlT2JqZWN0TGl0ZXJhbCkubWFwKGZ1bmN0aW9uKGl0ZW0sIGksIGxpc3QpIHtcbiAgICByZXR1cm4gaSUyID09PSAwID8gc2FuaXRpemVOYW1lKGl0ZW0pIDogc2FuaXRpemVWYWx1ZShpdGVtKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIHBhcmFtcyBPYmplY3QgZnJvbSBzdHJpbmdcbiAqIFxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBBIHN0cmluZ2lmaWVkIHZlcnNpb24gb2YgT2JqZWN0IGxpdGVyYWxcbiAqL1xudmFyIFBhcmFtZXRlcnMgPSBmdW5jdGlvbihzdHIpIHtcbiAgc3RyID0gc3RyIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHt9O1xuXG4gIF9saXN0aWZ5KHN0cikuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpLCBsaXN0KSB7XG4gICAgaWYoaSUyID09PSAwKSB7XG4gICAgICBfc2VsZltpdGVtXSA9IGxpc3RbaSsxXTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBfc2VsZjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyYW1ldGVycztcblxubW9kdWxlLmV4cG9ydHMucmVzb2x2ZVZhbHVlID0gX3Jlc29sdmVWYWx1ZTtcbm1vZHVsZS5leHBvcnRzLmxpc3RpZnkgPSBfbGlzdGlmeTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHdpbmRvdzpmYWxzZSAqL1xuLyogZ2xvYmFsIHByb2Nlc3M6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRJbW1lZGlhdGU6ZmFsc2UgKi9cbi8qIGdsb2JhbCBzZXRUaW1lb3V0OmZhbHNlICovXG5cbnZhciBfcHJvY2VzcyA9IHtcbiAgbmV4dFRpY2s6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gX3Byb2Nlc3M7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcHJvY2VzcyA9IHJlcXVpcmUoJy4uL3V0aWxzL3Byb2Nlc3MnKTtcblxuLyoqXG4gKiBFeGVjdXRlIGEgc2VyaWVzIG9mIGZ1bmN0aW9uczsgdXNlZCBpbiB0YW5kZW0gd2l0aCBtaWRkbGV3YXJlXG4gKi9cbnZhciBRdWV1ZUhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIF9saXN0ID0gW107XG4gIHZhciBfZGF0YSA9IG51bGw7XG5cbiAgdmFyIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogQWRkIGEgaGFuZGxlclxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7TWl4ZWR9ICAgICAgICAgaGFuZGxlciBBIEZ1bmN0aW9uIG9yIGFuIEFycmF5IG9mIEZ1bmN0aW9ucyB0byBhZGQgdG8gdGhlIHF1ZXVlXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgYWRkOiBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgICBpZihoYW5kbGVyICYmIGhhbmRsZXIuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgIF9saXN0ID0gX2xpc3QuY29uY2F0KGhhbmRsZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2xpc3QucHVzaChoYW5kbGVyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEYXRhIG9iamVjdFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBBIGRhdGEgb2JqZWN0IG1hZGUgYXZhaWxhYmxlIHRvIGVhY2ggaGFuZGxlclxuICAgICAqIEByZXR1cm4ge1F1ZXVlSGFuZGxlcn0gICAgICAgICBJdHNlbGY7IGNoYWluYWJsZVxuICAgICAqL1xuICAgIGRhdGE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIF9kYXRhID0gZGF0YTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBCZWdpbiBleGVjdXRpb24gYW5kIHRyaWdnZXIgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGNhbGxiYWNrLCBmdW5jdGlvbihlcnIpXG4gICAgICogQHJldHVybiB7UXVldWVIYW5kbGVyfSAgICAgICAgIEl0c2VsZjsgY2hhaW5hYmxlXG4gICAgICovXG4gICAgZXhlY3V0ZTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBuZXh0SGFuZGxlcjtcbiAgICAgIHZhciBleGVjdXRpb25MaXN0ID0gX2xpc3Quc2xpY2UoMCk7XG5cbiAgICAgIG5leHRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBoYW5kbGVyID0gZXhlY3V0aW9uTGlzdC5zaGlmdCgpO1xuXG4gICAgICAgIC8vIENvbXBsZXRlXG4gICAgICAgIGlmKCFoYW5kbGVyKSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgLy8gTmV4dCBoYW5kbGVyXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFuZGxlci5jYWxsKG51bGwsIF9kYXRhLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIC8vIEVycm9yXG4gICAgICAgICAgICBpZihlcnIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblxuICAgICAgICAgICAgLy8gQ29udGludWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIG5leHRIYW5kbGVyKCk7XG4gICAgfVxuXG4gIH07XG4gIFxuICByZXR1cm4gX3NlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSGFuZGxlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBVcmwgPSByZXF1aXJlKCcuL3VybCcpO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFVybERpY3Rpb25hcnkoKSB7XG4gIHRoaXMuX3BhdHRlcm5zID0gW107XG4gIHRoaXMuX3JlZnMgPSBbXTtcbiAgdGhpcy5fcGFyYW1zID0gW107XG59XG5cbi8qKlxuICogQXNzb2NpYXRlIGEgVVJMIHBhdHRlcm4gd2l0aCBhIHJlZmVyZW5jZVxuICogXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdHRlcm4gQSBVUkwgcGF0dGVyblxuICogQHBhcmFtICB7T2JqZWN0fSByZWYgICAgIEEgZGF0YSBPYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ocGF0dGVybiwgcmVmKSB7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuICB2YXIgX3NlbGYgPSB0aGlzO1xuICB2YXIgaSA9IHRoaXMuX3BhdHRlcm5zLmxlbmd0aDtcblxuICB2YXIgcGF0aENoYWluO1xuICB2YXIgcGFyYW1zID0ge307XG5cbiAgaWYocGF0dGVybi5pbmRleE9mKCc/JykgPT09IC0xKSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuXG4gIH0gZWxzZSB7XG4gICAgcGF0aENoYWluID0gVXJsKHBhdHRlcm4pLnBhdGgoKS5zcGxpdCgnLycpO1xuICB9XG5cbiAgLy8gU3RhcnRcbiAgdmFyIHNlYXJjaEV4cHIgPSAnXic7XG5cbiAgLy8gSXRlbXNcbiAgKHBhdGhDaGFpbi5mb3JFYWNoKGZ1bmN0aW9uKGNodW5rLCBpKSB7XG4gICAgaWYoaSE9PTApIHtcbiAgICAgIHNlYXJjaEV4cHIgKz0gJ1xcXFwvJztcbiAgICB9XG5cbiAgICBpZihjaHVua1swXSA9PT0gJzonKSB7XG4gICAgICBzZWFyY2hFeHByICs9ICdbXlxcXFwvP10qJztcbiAgICAgIHBhcmFtc1tjaHVuay5zdWJzdHJpbmcoMSldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZWFyY2hFeHByICs9IGNodW5rO1xuICAgIH1cbiAgfSkpO1xuXG4gIC8vIEVuZFxuICBzZWFyY2hFeHByICs9ICdbXFxcXC9dPyQnO1xuXG4gIHRoaXMuX3BhdHRlcm5zW2ldID0gbmV3IFJlZ0V4cChzZWFyY2hFeHByKTtcbiAgdGhpcy5fcmVmc1tpXSA9IHJlZjtcbiAgdGhpcy5fcGFyYW1zW2ldID0gcGFyYW1zO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgcmVmZXJlbmNlIGFjY29yZGluZyB0byBhIFVSTCBwYXR0ZXJuIGFuZCByZXRyaWV2ZSBwYXJhbXMgZGVmaW5lZCBpbiBVUkxcbiAqIFxuICogQHBhcmFtICB7U3RyaW5nfSB1cmwgICAgICBBIFVSTCB0byB0ZXN0IGZvclxuICogQHBhcmFtICB7T2JqZWN0fSBkZWZhdWx0cyBBIGRhdGEgT2JqZWN0IG9mIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlc1xuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICBBIHJlZmVyZW5jZSB0byBhIHN0b3JlZCBvYmplY3RcbiAqL1xuVXJsRGljdGlvbmFyeS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24odXJsLCBkZWZhdWx0cykge1xuICB1cmwgPSB1cmwgfHwgJyc7XG4gIHZhciBwID0gVXJsKHVybCkucGF0aCgpO1xuICB2YXIgcSA9IFVybCh1cmwpLnF1ZXJ5cGFyYW1zKCk7XG5cbiAgdmFyIF9zZWxmID0gdGhpcztcblxuICAvLyBDaGVjayBkaWN0aW9uYXJ5XG4gIHZhciBfZmluZFBhdHRlcm4gPSBmdW5jdGlvbihjaGVjaykge1xuICAgIGNoZWNrID0gY2hlY2sgfHwgJyc7XG4gICAgZm9yKHZhciBpPV9zZWxmLl9wYXR0ZXJucy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICBpZihjaGVjay5tYXRjaChfc2VsZi5fcGF0dGVybnNbaV0pICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgdmFyIGkgPSBfZmluZFBhdHRlcm4ocCk7XG4gIFxuICAvLyBNYXRjaGluZyBwYXR0ZXJuIGZvdW5kXG4gIGlmKGkgIT09IC0xKSB7XG5cbiAgICAvLyBSZXRyaWV2ZSBwYXJhbXMgaW4gcGF0dGVybiBtYXRjaFxuICAgIHZhciBwYXJhbXMgPSB7fTtcbiAgICBmb3IodmFyIG4gaW4gdGhpcy5fcGFyYW1zW2ldKSB7XG4gICAgICB2YXIgcGFyYW1QYXJzZXIgPSB0aGlzLl9wYXJhbXNbaV1bbl07XG4gICAgICB2YXIgdXJsTWF0Y2ggPSAodXJsLm1hdGNoKHBhcmFtUGFyc2VyKSB8fCBbXSkucG9wKCkgfHwgJyc7XG4gICAgICB2YXIgdmFyTWF0Y2ggPSB1cmxNYXRjaC5zcGxpdCgnLycpLnBvcCgpO1xuICAgICAgcGFyYW1zW25dID0gdmFyTWF0Y2g7XG4gICAgfVxuXG4gICAgLy8gUmV0cmlldmUgcGFyYW1zIGluIHF1ZXJ5c3RyaW5nIG1hdGNoXG4gICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQocSwgcGFyYW1zKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIHJlZjogdGhpcy5fcmVmc1tpXSxcbiAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgfTtcblxuICAvLyBOb3QgaW4gZGljdGlvbmFyeVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybERpY3Rpb25hcnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFVybCh1cmwpIHtcbiAgdXJsID0gdXJsIHx8ICcnO1xuXG4gIC8vIEluc3RhbmNlXG4gIHZhciBfc2VsZiA9IHtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGF0aCBvZiBhIFVSTFxuICAgICAqIFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgIEEgcXVlcnlzdHJpbmcgZnJvbSBVUkxcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID09PSAtMSA/IHVybCA6IHVybC5zdWJzdHJpbmcoMCwgdXJsLmluZGV4T2YoJz8nKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkxcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlzdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJycgOiB1cmwuc3Vic3RyaW5nKHVybC5pbmRleE9mKCc/JykrMSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcXVlcnlzdHJpbmcgb2YgYSBVUkwgcGFyYW1ldGVycyBhcyBhIGhhc2hcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBBIHF1ZXJ5c3RyaW5nIGZyb20gVVJMXG4gICAgICovXG4gICAgcXVlcnlwYXJhbXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhaXJzID0gX3NlbGYucXVlcnlzdHJpbmcoKS5zcGxpdCgnJicpO1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBmb3IodmFyIGk9MDsgaTxwYWlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihwYWlyc1tpXSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmFtZVZhbHVlID0gcGFpcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgcGFyYW1zW25hbWVWYWx1ZVswXV0gPSAodHlwZW9mIG5hbWVWYWx1ZVsxXSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmFtZVZhbHVlWzFdID09PSAnJykgPyB0cnVlIDogbmFtZVZhbHVlWzFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gX3NlbGY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJsO1xuIl19
