StateRouter
===========

[![Build Status](https://travis-ci.org/henrytseng/angular-state-router.svg?branch=master)](https://travis-ci.org/henrytseng/angular-state-router) [![Join the chat at https://gitter.im/henrytseng/angular-state-router](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/henrytseng/angular-state-router?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 

An AngularJS state-based router designed for flexibility and ease of use.  

[StateRouter](https://www.npmjs.com/package/angular-state-router) is designed to be used in a modular integration with components:

* [StateView](https://www.npmjs.com/package/angular-state-view)
	* Provides nested view management with template support
* [StateLoadable](https://www.npmjs.com/package/angular-state-loadable)
	* A lightweight and flexible AngularJS lazy loading scheme.

While not required, StateRouter was originally developed with Browserify.  



Installation
------------

To install in your project, simply install from npm 

	npm install angular-state-router --save



Example
-------

[See an example here](http://henrytseng.github.io/angular-state-router).  


Quick Start
-----------

Include the `state-router.min.js` script tag in your `.html`:

	<html ng-app="myApp">
	  <head>
	    <script src="/node_modules/angular/angular.min.js"></script>
	    <script src="/node_modules/angular-state-router/dist/state-router.min.js"></script>
	    <script src="/js/app.js"></script>
	  </head>
	  <body>
	    ...
	  </body>
	</html>

In `app.js` add `angular-state-router` as a dependency when your application module is instantiated.  

And **define** your states and optionally an **default initial location**

	angular.module('myApp', ['angular-state-router']);
	  .config(function($stateProvider) {

	    $stateProvider

	      // Define states
	      .state('landing', {
	        url: '/'
	      })

	      .state('products.listing', {
	        url: '/products', 
	        params: {
	        	catalog: '1b'
	        }
	      })

	      .state('products', {
	        url: '/products/:id'
	      })

	      .state('account', {
	        url: '/account'
	      })

	      // Set initialization location; optionally
	      .init('landing');

	  })
	  
	  .controller('MyController', function($state) {
	  
	  	 // Get the current state
	    var current = $state.current();
	    
	  });



States
------

StateRouter is design for building applications that can be represented with a [finite-state machine model](https://en.wikipedia.org/wiki/Finite-state_machine) (FSM), a computational model.  

States are represented through data objects with an associated dot-notation name.  Child states inherit from parent states by default.  

### Definition

States must be first defined.  This is usually done in the angular **configuration phase** with `$stateProvider` but *can* also be done later with `$state`.   

	angular.module('myApp')
	  .config(function($stateProvider) {
	  
	    $stateProvider
	      .state('account', {
	        url: '/accounts',
	        params: { endpoint: '2998293e' }
	      })
	      
	      .state('account.profile', {
	        url: '/accounts/:id'
	      })
	      
	      .state('account.transactions', {
	        url: '/accounts/:id/transactions',
	        inherit: false
	      });
	  });

Once a state is defined a transition to the state can be made.

	angular.module('myApp')
	  .controller('MyController', function($scope, $state) {

	    $scope.buttonClick = function() {
	    
	      // Update
	      $state.change('products.catalogs.items.variations', { 
	        item: '423', 
	        catalog: 'e534', 
	        variation: '320902'
	      });
	      
	    };
	    
	  });



### Initialization

Initialization occurs automatically when the application is kicked-started.  

`$location.url()` will be checked for an initial location during initialization, if $location.url() has not been set then an alternative default initial location is used if it exists.  

The initialization process is as follows:

1. Configuration Phase
	- Define states
	- Optionally define "initial location"
2. Run Phase
	- Initialization, during application kick-started
	- Initial state set as `$location.url()`, if not empty
	- Initial state falls back to "initial location"

An initialization `$stateInit` event is broadcasted on `$rootScope`.  

To listen to the init event:

	angular.module('myApp')
	  .controller('MyController', function($rootScope) {
	  
	    $rootScope.$on('$stateInit', function() {
	    
	    	// Responding code
	    
	    });
	  
	  });



### Usage

After states are defined a transition can be made

	// Change state
	$state.change('account.profile', { employee: 'e92792-2389' });

State changes are *asynchronous* operations.  

Current states can be checked using the `active` method which accepts a state notation query

	<li ng-class="{'active': $state.active('company') }"><a href="#" sref="company">Company</a></li>

And in the same method a state can be triggered using the `sref` attribute.  

	<a href="#" sref="company">Company</a>

Parameters can be sent similarly

	<a href="#" sref="company({id:'Lorem ipsum'})">Company</a>



### Inheritance

States inherit from each other through a parent-child relationship by default; where `campus` is the parent of `campus.classrooms` state.  

A child state will inherit from it's each of its parents until a `inherit` value of `false` value is encountered (with exception to `resolve` and `templates` properties).  

For example, given this definition

	angular.module('myApp')
	  .config(function($stateProvider) {
	  
	    $stateProvider
	      .state('campus', {
	        url: '/campus',
	        params: { availability: false }
	      })
	      
	      .state('campus.classrooms', {
	        url: '/campus/rms/:id',
	        params: { size: 30 }
	      });

	  });

We see that `campus.classrooms` will have a `params` value

	{ 
	  availability: false,
	  size: 30
	}

Where `availability` is inherited from `campus`, its parent



Resolve
-------

States that include a resolve property will resolve all promises and store results in the `locals` Object, where they can be accessed `$state.current().locals`.  

	angular.module('myApp')
	  .config(function($stateProvider) {
	  
	    $stateProvider
	      .state('stories', {
	        url: '/storyteller/stories',
	        
	        resolve: {
	          story: function(StoryService) {
	            return StoryService.get();
	          }
	
	        }
	      });
	  })
	  .controller('StoryController', function($state) {
	    console.log($state.current().locals);
	  });
	
`locals` is has with the following value at the completion of the state transition:
	
	{
	  story: 'Lorem ipsum'
	}



Events
------

Events are broadcast on the `$rootScope`.  


### $stateInit

This event is emitted when $state is initialized.  If an initial state is specified `$stateInit` occurs after the current state is set.  



### $stateChangeBegin

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted when a requested change to a valid state exists.  



### $stateChangeError

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted whenever an error occurs.  



### $stateChangeErrorNotFound

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted when a state cannot be found and no parent state(s) exist.  



### $stateChangeErrorResolve

This event is emitted when an error occurred during resolve.  



### $stateChangeEnd

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event occurs when a valid state change successfully finishes.  This event does not trigger when an error was encountered.  Use the `'change'` event for all change requests.  



### $stateChangeComplete

* `error`   *Object* Null if successful, `Error` object if error occurs
* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event occurs when a state change is finished.  This event is always triggered on any change request.  Also occurs *after* 'error' is emitted.  



API Services
------------

### $stateProvider

`Configuration` phase setup of StateRouter.  


### $stateProvider#options(options)

* @param  {Object}         options A data Object
* @return {$stateProvider}         Itself; chainable

Set configuration data parameters for StateRouter

Available options include

   * historyLength   {Number} Defaults to 5
   * initialLocation {Object} An Object{name:String, params:Object} for initial state transition

Chainable.  


### $stateProvider#state

* @param  {String} name A unique identifier for the state; using state-notation
* @param  {Object} data A state definition data Object
* @return {$stateProvider} Itself; chainable

Define or get a state.  Chainable.  


### $stateProvider#init

* @param  {String}         name   A iniital state
* @param  {Object}         params A data object of params
* @return {$stateProvider}        Itself; chainable

Set initialization parameters; deferred to $ready()


### $state

`Run` phase access to StateRouter.  


### $state#options

* @return {Object} A configured options

Get options


### $state#state

* @param  {String} name A unique identifier for the state; using state-notation
* @param  {Object} data A state definition data Object
* @return {$state}      Itself; chainable

Set/get state. Reloads state if current state is affected by defined state (when redefining parent or current state)


### $state#$use

* @param  {Function} handler  A callback, function(request, next)
* @param  {Number}   priority A number denoting priority
* @return {$state}            Itself; chainable

Internal method to add middleware; called during state transition


### $state#change

* @param  {String}      name     A unique identifier for the state; using dot-notation
* @param  {Object}      [params] A parameters data object
* @return {Promise}              A promise fulfilled when state change complete

Request state transition, asynchronous operation


### $state#$location

* @param  {String}      url        A url matching defind states
* @param  {Function}    [callback] A callback, function(err)
* @return {$state}                 Itself; chainable

Internal method to change state based on $location.url(), asynchronous operation using internal methods, quiet fallback.  


### $state#current

* @return {Object} A copy of current state

Retrieve copy of current state


### $state#active

* @param  {Mixed}   query  A string using state notation or a RegExp
* @param  {Object}  params A parameters data object
* @return {Boolean}        A true if state is parent to current state

Check query against current state



API Directives
--------------

### sref

* sref {String} A defined state to transition to, using state name notation

Request a state transition when clicked.

##### Example
	
A state transition to `products.items` with parameters `{catalog:'1-aeff', item:'e32537'}`
	
	<a sref="products.items({catalog:'1-aeff', item:'e32537'})">Product</a>



State Notation
--------------

States use dot-notation where state names are `/[a-zA-Z0-9_]*/` strings separated by dots `.` and are case sensitive.  

The following are examples of valid unique state names:

	ochestra1.trombone.position.6
	ochestra1.clarinet
	ochestra56.clarinet
	ochestra1


### Parameters

Data Objects can be included in an expression (not query) given by Object literal notation.  Using name-value pairs of Boolean/Number/String/null.

They are expressed using parenthesis `()` surrounding the Object literal at the end of a state expression.  

	ochestra1.trombone.position.6({id:'49829f', color:329, custom:true})


### Queries

The following are examples of state notation queries that would match the state `ochestra1.trombone.position.6`

	ochestra1
	ochestra1.trombone
	ochestra1.trombone.position
	ochestra1.trombone.position.6


### Wildcards

Queries can also use wildcards `*` to match any one state or `**` to match any pattern of states following or preceding.  

Both of the following will match the state `catalog.index.list`

	catalog.*.list
	catalog.**



URLs
----

URLs in state definitions take the form:

	$stateProvider.state('events.details', {
	  url: '/events/:eventid',
	    params: {
	      eventid: 'init'
	    }
	  })

Where parameters are specified in URLs using variable names starting with a colon, e.g. - `:id`.  And a default value can be specified using a `params` Object.  

To retrieve the current state and its parameter values use (e.g. - for example finding the value of `eventid`):

	$state.current().params.eventid


### Query String

Query string values are also set in the params object.  

Given the URL `http://test.com/#/events/birthday_event?color=blue`

	assert(params).equal({
		eventid: 'birthday_event',
		color: 'blue'
	});



Components
----------

Components register themselves as middleware layers and respond to state changes.  

* [StateView](https://www.npmjs.com/package/angular-state-view)
* [StateLoadable](https://www.npmjs.com/package/angular-state-loadable)

### Building a Custom Component

To build your own components simply register your the middleware with the `$state.$use()` method.  

`$use` expects a function signature `function(request, next)` where `request` is data Object containing data for the current state transition and `next` is a completion callback.  

	angular.module('myComponent', ['angular-state-router'])

	  .factory(function($state) {

	    // Register middleware layer
	    $state.$use(function(request, next) {
	    
	      // ... Perform work
	    
	      // Asynchronous completion
	      next();

	    });

	  });

Component operate asynchronously and `next` must be called.  


Browserify
----------

To use Browserify you can easily `require` the `src/index.js` file.  



Contribute
----------

If you've got ideas on how to make StateRouter better create an issue and mark an enhancement in Github.  

If there are any unreported errors please let us know.  We'd like StateRouter to give as much feedback as possible to eliminate common problems that may occur during development.  

To get start programming, build

	npm install
	gulp

To get started watch files for programming

	gulp watch

To host the example

	npm run-script example

Then using your browser visit [http://localhost:3000/index.html](http://localhost:3000/index.html)



License
-------

Copyright (c) 2015 Henry Tseng

Released under the MIT license. See LICENSE for details.