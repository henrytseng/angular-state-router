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
   * Check active 
   *
   * @param  {Mixed}   query  A string using state notation or a RegExp
   * @return {Boolean}        A true if state is parent to current state
   */
  _self.active = function(query) {
    query = query || '';
    
    // No state
    if(_current === null) {
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
            return item === '*' ? '[a-zA-Z0-9]*' : item;
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
