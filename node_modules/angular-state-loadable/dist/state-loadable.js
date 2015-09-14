(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/* global angular:false */

// CommonJS
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'angular-state-loadable';
}

// Assume polyfill used in StateRouter exists

// Instantiate module
angular.module('angular-state-loadable', ['angular-state-router'])

  .factory('$loadableManager', require('./services/loadable-manager'))

  .run(['$loadableManager', function($loadableManager) {
    $loadableManager.$ready();
  }]);

},{"./services/loadable-manager":2}],2:[function(require,module,exports){
'use strict';

/* global document:false */

module.exports = ['$state', '$q', '$rootScope', function($state, $q, $rootScope) {

  // DOM target
  var _head;

  // Instance
  var _self = {};

  // Library
  var _loadableHash = {};

  // Progress
  var _loadingList = [];
  var _completedList = [];

  /**
   * A loaded resource, adds self to DOM, self manage progress
   * 
   * @return {_Loadable} An instance
   */
  var _Loadable = function(src) {
    var _deferred = $q.defer();

    // Instance
    var _loadable = {

      src: src,

      // Loading completion flag
      isComplete: false,

      promise: _deferred.promise,

      // TODO switch to $document
      $element: document.createElement('script')
    };

    // Build DOM element
    _loadable.$element.src = src;
    _loadable.$element.type = 'text/javascript';
    _loadable.$element.async = false;

    _head.insertBefore(_loadable.$element, _head.firstChild);

    // Mark loading in progress
    _loadingList.push(_loadable);

    // Completion
    _loadable.$element.onload = _loadable.$element.onreadystatechange = function() {

      if(!_loadable.isComplete && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete")) {
        _loadable.isComplete = true;
        _loadable.$element.onload = _loadable.$element.onreadystatechange = null;
        
        if(_head && _loadable.$element.parentNode) {
          _head.removeChild(_loadable.$element);
        }

        // Mark complete
        var i = _loadingList.indexOf(_loadable);
        if(i !== -1) {
          _loadingList.splice(i, 1);
        }
        _completedList.push(_loadable);

        _deferred.resolve(_loadable);
      }
    };

    return _loadable;
  };

  /**
   * Get progress
   * 
   * @return {Number} A number 0..1 denoting progress
   */
  var _getProgress = function() {
    var loaded = _loadingList.length;
    var total = _loadingList.length + _completedList.length;
    return Math.min(1, Math.max(0, loaded/total));
  };

  /**
   * Create a _Loadable.  Does not replace previously created instances.  
   * 
   * @param  {String}    src A source path for script asset
   * @return {_Loadable}     A loadable instance
   */
  var _createLoadable = function(src) {
    var loadable;

    // Valid state name required
    if(!src || src === '') {
      var error;
      error = new Error('Loadable requires a valid source.');
      error.code = 'invalidname';
      throw error;
    }

    // Already exists
    if(_loadableHash[src]) {
      loadable = _loadableHash[src];

    // Create new
    } else {
      // Create new instance
      loadable = new _Loadable(src);
      _loadableHash[src] = loadable;

      // Broadcast creation, progress
      $rootScope.$broadcast('$loadableCreated', loadable);
      $rootScope.$broadcast('$loadableProgress', _getProgress());

      // Completion
      loadable.promise.then(function() {

        // Broadcast complete
        $rootScope.$broadcast('$loadableProgress', _getProgress());
        if(_loadingList.length === 0) {
          $rootScope.$broadcast('$loadableComplete', loadable);
        }
      });
    }

    return loadable;
  };

  /**
   * Load all required items
   * 
   * @return {Promise} A promise fulfilled when the resources are loaded
   */
  var _load = function() {
    var deferred = $q.defer();

    var current = $state.current();

    // Evaluate
    if(current) {
      var sources = (typeof current.load === 'string' ? [current.load] : current.load) || [];
      
      // Get promises
      $q.all(sources
        .map(function(src) {
          return _createLoadable(src);
        })
        .filter(function(loadable) {
          return !loadable.isComplete;
        })
        .map(function(loadable) {
          return loadable.promise;
        })
      )
          .then(function() {
            deferred.resolve();

          }, function(err) {
            $rootScope.$broadcast('$loadableError', err);
            deferred.reject(err);
          });

    // No state
    } else {
      deferred.resolve();
    }

    return deferred.promise;
  };
  _self.$load = _load;

  /**
   * Create a loadable, get reference to existing methods
   * 
   * @param  {String}    src A source path for script asset
   * @return {Promise}       A promise fulfilled when the resource is loaded
   */
  _self.get = function(src) {
    return _createLoadable(src).promise;
  };

  /**
   * Get progress
   * 
   * @return {Number} A number 0..1 denoting current progress
   */
  _self.progress = _getProgress;

  /**
   * Ready
   */
  _self.$ready = function() {
    _head = angular.element(document.querySelector('head'))[0];

    // Register middleware layer
    $state.$use(function(request, next) {
      next();

      // Load after state change is finished to avoid collision
      request.promise.then(function() {
        _load();
      });

    }, 1);

    // Refresh after all loadables are done
    $rootScope.$on('$loadableComplete', function() {
      $state.reload();
    });
  };

  return _self;
}];

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtbG9hZGFibGUvc3JjL2luZGV4LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLWxvYWRhYmxlL3NyYy9zZXJ2aWNlcy9sb2FkYWJsZS1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7Ozs7O0FBS0EsSUFBSSxPQUFPLFdBQVcsZUFBZSxPQUFPLFlBQVksZUFBZSxPQUFPLFlBQVksUUFBUTtFQUNoRyxPQUFPLFVBQVU7Ozs7OztBQU1uQixRQUFRLE9BQU8sMEJBQTBCLENBQUM7O0dBRXZDLFFBQVEsb0JBQW9CLFFBQVE7O0dBRXBDLElBQUksQ0FBQyxvQkFBb0IsU0FBUyxrQkFBa0I7SUFDbkQsaUJBQWlCOztBQUVyQjs7QUNuQkE7Ozs7QUFJQSxPQUFPLFVBQVUsQ0FBQyxVQUFVLE1BQU0sY0FBYyxTQUFTLFFBQVEsSUFBSSxZQUFZOzs7RUFHL0UsSUFBSTs7O0VBR0osSUFBSSxRQUFROzs7RUFHWixJQUFJLGdCQUFnQjs7O0VBR3BCLElBQUksZUFBZTtFQUNuQixJQUFJLGlCQUFpQjs7Ozs7OztFQU9yQixJQUFJLFlBQVksU0FBUyxLQUFLO0lBQzVCLElBQUksWUFBWSxHQUFHOzs7SUFHbkIsSUFBSSxZQUFZOztNQUVkLEtBQUs7OztNQUdMLFlBQVk7O01BRVosU0FBUyxVQUFVOzs7TUFHbkIsVUFBVSxTQUFTLGNBQWM7Ozs7SUFJbkMsVUFBVSxTQUFTLE1BQU07SUFDekIsVUFBVSxTQUFTLE9BQU87SUFDMUIsVUFBVSxTQUFTLFFBQVE7O0lBRTNCLE1BQU0sYUFBYSxVQUFVLFVBQVUsTUFBTTs7O0lBRzdDLGFBQWEsS0FBSzs7O0lBR2xCLFVBQVUsU0FBUyxTQUFTLFVBQVUsU0FBUyxxQkFBcUIsV0FBVzs7TUFFN0UsR0FBRyxDQUFDLFVBQVUsZUFBZSxDQUFDLEtBQUssY0FBYyxLQUFLLGVBQWUsWUFBWSxLQUFLLGVBQWUsYUFBYTtRQUNoSCxVQUFVLGFBQWE7UUFDdkIsVUFBVSxTQUFTLFNBQVMsVUFBVSxTQUFTLHFCQUFxQjs7UUFFcEUsR0FBRyxTQUFTLFVBQVUsU0FBUyxZQUFZO1VBQ3pDLE1BQU0sWUFBWSxVQUFVOzs7O1FBSTlCLElBQUksSUFBSSxhQUFhLFFBQVE7UUFDN0IsR0FBRyxNQUFNLENBQUMsR0FBRztVQUNYLGFBQWEsT0FBTyxHQUFHOztRQUV6QixlQUFlLEtBQUs7O1FBRXBCLFVBQVUsUUFBUTs7OztJQUl0QixPQUFPOzs7Ozs7OztFQVFULElBQUksZUFBZSxXQUFXO0lBQzVCLElBQUksU0FBUyxhQUFhO0lBQzFCLElBQUksUUFBUSxhQUFhLFNBQVMsZUFBZTtJQUNqRCxPQUFPLEtBQUssSUFBSSxHQUFHLEtBQUssSUFBSSxHQUFHLE9BQU87Ozs7Ozs7OztFQVN4QyxJQUFJLGtCQUFrQixTQUFTLEtBQUs7SUFDbEMsSUFBSTs7O0lBR0osR0FBRyxDQUFDLE9BQU8sUUFBUSxJQUFJO01BQ3JCLElBQUk7TUFDSixRQUFRLElBQUksTUFBTTtNQUNsQixNQUFNLE9BQU87TUFDYixNQUFNOzs7O0lBSVIsR0FBRyxjQUFjLE1BQU07TUFDckIsV0FBVyxjQUFjOzs7V0FHcEI7O01BRUwsV0FBVyxJQUFJLFVBQVU7TUFDekIsY0FBYyxPQUFPOzs7TUFHckIsV0FBVyxXQUFXLG9CQUFvQjtNQUMxQyxXQUFXLFdBQVcscUJBQXFCOzs7TUFHM0MsU0FBUyxRQUFRLEtBQUssV0FBVzs7O1FBRy9CLFdBQVcsV0FBVyxxQkFBcUI7UUFDM0MsR0FBRyxhQUFhLFdBQVcsR0FBRztVQUM1QixXQUFXLFdBQVcscUJBQXFCOzs7OztJQUtqRCxPQUFPOzs7Ozs7OztFQVFULElBQUksUUFBUSxXQUFXO0lBQ3JCLElBQUksV0FBVyxHQUFHOztJQUVsQixJQUFJLFVBQVUsT0FBTzs7O0lBR3JCLEdBQUcsU0FBUztNQUNWLElBQUksVUFBVSxDQUFDLE9BQU8sUUFBUSxTQUFTLFdBQVcsQ0FBQyxRQUFRLFFBQVEsUUFBUSxTQUFTOzs7TUFHcEYsR0FBRyxJQUFJO1NBQ0osSUFBSSxTQUFTLEtBQUs7VUFDakIsT0FBTyxnQkFBZ0I7O1NBRXhCLE9BQU8sU0FBUyxVQUFVO1VBQ3pCLE9BQU8sQ0FBQyxTQUFTOztTQUVsQixJQUFJLFNBQVMsVUFBVTtVQUN0QixPQUFPLFNBQVM7OztXQUdmLEtBQUssV0FBVztZQUNmLFNBQVM7O2FBRVIsU0FBUyxLQUFLO1lBQ2YsV0FBVyxXQUFXLGtCQUFrQjtZQUN4QyxTQUFTLE9BQU87Ozs7V0FJakI7TUFDTCxTQUFTOzs7SUFHWCxPQUFPLFNBQVM7O0VBRWxCLE1BQU0sUUFBUTs7Ozs7Ozs7RUFRZCxNQUFNLE1BQU0sU0FBUyxLQUFLO0lBQ3hCLE9BQU8sZ0JBQWdCLEtBQUs7Ozs7Ozs7O0VBUTlCLE1BQU0sV0FBVzs7Ozs7RUFLakIsTUFBTSxTQUFTLFdBQVc7SUFDeEIsUUFBUSxRQUFRLFFBQVEsU0FBUyxjQUFjLFNBQVM7OztJQUd4RCxPQUFPLEtBQUssU0FBUyxTQUFTLE1BQU07TUFDbEM7OztNQUdBLFFBQVEsUUFBUSxLQUFLLFdBQVc7UUFDOUI7OztPQUdEOzs7SUFHSCxXQUFXLElBQUkscUJBQXFCLFdBQVc7TUFDN0MsT0FBTzs7OztFQUlYLE9BQU87O0FBRVQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgYW5ndWxhcjpmYWxzZSAqL1xuXG4vLyBDb21tb25KU1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIGV4cG9ydHMgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgPT09IGV4cG9ydHMpe1xuICBtb2R1bGUuZXhwb3J0cyA9ICdhbmd1bGFyLXN0YXRlLWxvYWRhYmxlJztcbn1cblxuLy8gQXNzdW1lIHBvbHlmaWxsIHVzZWQgaW4gU3RhdGVSb3V0ZXIgZXhpc3RzXG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtbG9hZGFibGUnLCBbJ2FuZ3VsYXItc3RhdGUtcm91dGVyJ10pXG5cbiAgLmZhY3RvcnkoJyRsb2FkYWJsZU1hbmFnZXInLCByZXF1aXJlKCcuL3NlcnZpY2VzL2xvYWRhYmxlLW1hbmFnZXInKSlcblxuICAucnVuKFsnJGxvYWRhYmxlTWFuYWdlcicsIGZ1bmN0aW9uKCRsb2FkYWJsZU1hbmFnZXIpIHtcbiAgICAkbG9hZGFibGVNYW5hZ2VyLiRyZWFkeSgpO1xuICB9XSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBkb2N1bWVudDpmYWxzZSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyRxJywgJyRyb290U2NvcGUnLCBmdW5jdGlvbigkc3RhdGUsICRxLCAkcm9vdFNjb3BlKSB7XG5cbiAgLy8gRE9NIHRhcmdldFxuICB2YXIgX2hlYWQ7XG5cbiAgLy8gSW5zdGFuY2VcbiAgdmFyIF9zZWxmID0ge307XG5cbiAgLy8gTGlicmFyeVxuICB2YXIgX2xvYWRhYmxlSGFzaCA9IHt9O1xuXG4gIC8vIFByb2dyZXNzXG4gIHZhciBfbG9hZGluZ0xpc3QgPSBbXTtcbiAgdmFyIF9jb21wbGV0ZWRMaXN0ID0gW107XG5cbiAgLyoqXG4gICAqIEEgbG9hZGVkIHJlc291cmNlLCBhZGRzIHNlbGYgdG8gRE9NLCBzZWxmIG1hbmFnZSBwcm9ncmVzc1xuICAgKiBcbiAgICogQHJldHVybiB7X0xvYWRhYmxlfSBBbiBpbnN0YW5jZVxuICAgKi9cbiAgdmFyIF9Mb2FkYWJsZSA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHZhciBfZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgLy8gSW5zdGFuY2VcbiAgICB2YXIgX2xvYWRhYmxlID0ge1xuXG4gICAgICBzcmM6IHNyYyxcblxuICAgICAgLy8gTG9hZGluZyBjb21wbGV0aW9uIGZsYWdcbiAgICAgIGlzQ29tcGxldGU6IGZhbHNlLFxuXG4gICAgICBwcm9taXNlOiBfZGVmZXJyZWQucHJvbWlzZSxcblxuICAgICAgLy8gVE9ETyBzd2l0Y2ggdG8gJGRvY3VtZW50XG4gICAgICAkZWxlbWVudDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0JylcbiAgICB9O1xuXG4gICAgLy8gQnVpbGQgRE9NIGVsZW1lbnRcbiAgICBfbG9hZGFibGUuJGVsZW1lbnQuc3JjID0gc3JjO1xuICAgIF9sb2FkYWJsZS4kZWxlbWVudC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gICAgX2xvYWRhYmxlLiRlbGVtZW50LmFzeW5jID0gZmFsc2U7XG5cbiAgICBfaGVhZC5pbnNlcnRCZWZvcmUoX2xvYWRhYmxlLiRlbGVtZW50LCBfaGVhZC5maXJzdENoaWxkKTtcblxuICAgIC8vIE1hcmsgbG9hZGluZyBpbiBwcm9ncmVzc1xuICAgIF9sb2FkaW5nTGlzdC5wdXNoKF9sb2FkYWJsZSk7XG5cbiAgICAvLyBDb21wbGV0aW9uXG4gICAgX2xvYWRhYmxlLiRlbGVtZW50Lm9ubG9hZCA9IF9sb2FkYWJsZS4kZWxlbWVudC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcblxuICAgICAgaWYoIV9sb2FkYWJsZS5pc0NvbXBsZXRlICYmICghdGhpcy5yZWFkeVN0YXRlIHx8IHRoaXMucmVhZHlTdGF0ZSA9PT0gXCJsb2FkZWRcIiB8fCB0aGlzLnJlYWR5U3RhdGUgPT09IFwiY29tcGxldGVcIikpIHtcbiAgICAgICAgX2xvYWRhYmxlLmlzQ29tcGxldGUgPSB0cnVlO1xuICAgICAgICBfbG9hZGFibGUuJGVsZW1lbnQub25sb2FkID0gX2xvYWRhYmxlLiRlbGVtZW50Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICBpZihfaGVhZCAmJiBfbG9hZGFibGUuJGVsZW1lbnQucGFyZW50Tm9kZSkge1xuICAgICAgICAgIF9oZWFkLnJlbW92ZUNoaWxkKF9sb2FkYWJsZS4kZWxlbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNYXJrIGNvbXBsZXRlXG4gICAgICAgIHZhciBpID0gX2xvYWRpbmdMaXN0LmluZGV4T2YoX2xvYWRhYmxlKTtcbiAgICAgICAgaWYoaSAhPT0gLTEpIHtcbiAgICAgICAgICBfbG9hZGluZ0xpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICAgIF9jb21wbGV0ZWRMaXN0LnB1c2goX2xvYWRhYmxlKTtcblxuICAgICAgICBfZGVmZXJyZWQucmVzb2x2ZShfbG9hZGFibGUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gX2xvYWRhYmxlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZXQgcHJvZ3Jlc3NcbiAgICogXG4gICAqIEByZXR1cm4ge051bWJlcn0gQSBudW1iZXIgMC4uMSBkZW5vdGluZyBwcm9ncmVzc1xuICAgKi9cbiAgdmFyIF9nZXRQcm9ncmVzcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsb2FkZWQgPSBfbG9hZGluZ0xpc3QubGVuZ3RoO1xuICAgIHZhciB0b3RhbCA9IF9sb2FkaW5nTGlzdC5sZW5ndGggKyBfY29tcGxldGVkTGlzdC5sZW5ndGg7XG4gICAgcmV0dXJuIE1hdGgubWluKDEsIE1hdGgubWF4KDAsIGxvYWRlZC90b3RhbCkpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBfTG9hZGFibGUuICBEb2VzIG5vdCByZXBsYWNlIHByZXZpb3VzbHkgY3JlYXRlZCBpbnN0YW5jZXMuICBcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgc3JjIEEgc291cmNlIHBhdGggZm9yIHNjcmlwdCBhc3NldFxuICAgKiBAcmV0dXJuIHtfTG9hZGFibGV9ICAgICBBIGxvYWRhYmxlIGluc3RhbmNlXG4gICAqL1xuICB2YXIgX2NyZWF0ZUxvYWRhYmxlID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgdmFyIGxvYWRhYmxlO1xuXG4gICAgLy8gVmFsaWQgc3RhdGUgbmFtZSByZXF1aXJlZFxuICAgIGlmKCFzcmMgfHwgc3JjID09PSAnJykge1xuICAgICAgdmFyIGVycm9yO1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ0xvYWRhYmxlIHJlcXVpcmVzIGEgdmFsaWQgc291cmNlLicpO1xuICAgICAgZXJyb3IuY29kZSA9ICdpbnZhbGlkbmFtZSc7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG5cbiAgICAvLyBBbHJlYWR5IGV4aXN0c1xuICAgIGlmKF9sb2FkYWJsZUhhc2hbc3JjXSkge1xuICAgICAgbG9hZGFibGUgPSBfbG9hZGFibGVIYXNoW3NyY107XG5cbiAgICAvLyBDcmVhdGUgbmV3XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENyZWF0ZSBuZXcgaW5zdGFuY2VcbiAgICAgIGxvYWRhYmxlID0gbmV3IF9Mb2FkYWJsZShzcmMpO1xuICAgICAgX2xvYWRhYmxlSGFzaFtzcmNdID0gbG9hZGFibGU7XG5cbiAgICAgIC8vIEJyb2FkY2FzdCBjcmVhdGlvbiwgcHJvZ3Jlc3NcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvYWRhYmxlQ3JlYXRlZCcsIGxvYWRhYmxlKTtcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvYWRhYmxlUHJvZ3Jlc3MnLCBfZ2V0UHJvZ3Jlc3MoKSk7XG5cbiAgICAgIC8vIENvbXBsZXRpb25cbiAgICAgIGxvYWRhYmxlLnByb21pc2UudGhlbihmdW5jdGlvbigpIHtcblxuICAgICAgICAvLyBCcm9hZGNhc3QgY29tcGxldGVcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCckbG9hZGFibGVQcm9ncmVzcycsIF9nZXRQcm9ncmVzcygpKTtcbiAgICAgICAgaWYoX2xvYWRpbmdMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvYWRhYmxlQ29tcGxldGUnLCBsb2FkYWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBsb2FkYWJsZTtcbiAgfTtcblxuICAvKipcbiAgICogTG9hZCBhbGwgcmVxdWlyZWQgaXRlbXNcbiAgICogXG4gICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0aGUgcmVzb3VyY2VzIGFyZSBsb2FkZWRcbiAgICovXG4gIHZhciBfbG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICAvLyBFdmFsdWF0ZVxuICAgIGlmKGN1cnJlbnQpIHtcbiAgICAgIHZhciBzb3VyY2VzID0gKHR5cGVvZiBjdXJyZW50LmxvYWQgPT09ICdzdHJpbmcnID8gW2N1cnJlbnQubG9hZF0gOiBjdXJyZW50LmxvYWQpIHx8IFtdO1xuICAgICAgXG4gICAgICAvLyBHZXQgcHJvbWlzZXNcbiAgICAgICRxLmFsbChzb3VyY2VzXG4gICAgICAgIC5tYXAoZnVuY3Rpb24oc3JjKSB7XG4gICAgICAgICAgcmV0dXJuIF9jcmVhdGVMb2FkYWJsZShzcmMpO1xuICAgICAgICB9KVxuICAgICAgICAuZmlsdGVyKGZ1bmN0aW9uKGxvYWRhYmxlKSB7XG4gICAgICAgICAgcmV0dXJuICFsb2FkYWJsZS5pc0NvbXBsZXRlO1xuICAgICAgICB9KVxuICAgICAgICAubWFwKGZ1bmN0aW9uKGxvYWRhYmxlKSB7XG4gICAgICAgICAgcmV0dXJuIGxvYWRhYmxlLnByb21pc2U7XG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG5cbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJGxvYWRhYmxlRXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgfSk7XG5cbiAgICAvLyBObyBzdGF0ZVxuICAgIH0gZWxzZSB7XG4gICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH07XG4gIF9zZWxmLiRsb2FkID0gX2xvYWQ7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGxvYWRhYmxlLCBnZXQgcmVmZXJlbmNlIHRvIGV4aXN0aW5nIG1ldGhvZHNcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgc3JjIEEgc291cmNlIHBhdGggZm9yIHNjcmlwdCBhc3NldFxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICBBIHByb21pc2UgZnVsZmlsbGVkIHdoZW4gdGhlIHJlc291cmNlIGlzIGxvYWRlZFxuICAgKi9cbiAgX3NlbGYuZ2V0ID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgcmV0dXJuIF9jcmVhdGVMb2FkYWJsZShzcmMpLnByb21pc2U7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdldCBwcm9ncmVzc1xuICAgKiBcbiAgICogQHJldHVybiB7TnVtYmVyfSBBIG51bWJlciAwLi4xIGRlbm90aW5nIGN1cnJlbnQgcHJvZ3Jlc3NcbiAgICovXG4gIF9zZWxmLnByb2dyZXNzID0gX2dldFByb2dyZXNzO1xuXG4gIC8qKlxuICAgKiBSZWFkeVxuICAgKi9cbiAgX3NlbGYuJHJlYWR5ID0gZnVuY3Rpb24oKSB7XG4gICAgX2hlYWQgPSBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaGVhZCcpKVswXTtcblxuICAgIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgbGF5ZXJcbiAgICAkc3RhdGUuJHVzZShmdW5jdGlvbihyZXF1ZXN0LCBuZXh0KSB7XG4gICAgICBuZXh0KCk7XG5cbiAgICAgIC8vIExvYWQgYWZ0ZXIgc3RhdGUgY2hhbmdlIGlzIGZpbmlzaGVkIHRvIGF2b2lkIGNvbGxpc2lvblxuICAgICAgcmVxdWVzdC5wcm9taXNlLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIF9sb2FkKCk7XG4gICAgICB9KTtcblxuICAgIH0sIDEpO1xuXG4gICAgLy8gUmVmcmVzaCBhZnRlciBhbGwgbG9hZGFibGVzIGFyZSBkb25lXG4gICAgJHJvb3RTY29wZS4kb24oJyRsb2FkYWJsZUNvbXBsZXRlJywgZnVuY3Rpb24oKSB7XG4gICAgICAkc3RhdGUucmVsb2FkKCk7XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iXX0=
