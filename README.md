StateRouter
===========

[![Build Status](https://travis-ci.org/henrytseng/angular-state-router.svg?branch=master)](https://travis-ci.org/henrytseng/angular-state-router) [![Join the chat at https://gitter.im/henrytseng/angular-state-router](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/henrytseng/angular-state-router?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 

An AngularJS state-based router designed for flexibility and ease of use.  

[StateRouter](https://www.npmjs.com/package/angular-state-router) is designed to be used in a modular integration with components:

* [StateView](https://www.npmjs.com/package/angular-state-view)
	* A view rendering engine
* [StateLoadable](https://www.npmjs.com/package/angular-state-loadable)
	* A lazy loading scheme

While not required, StateRouter was originally developed with Browserify.  



Installation
------------

To install in your project, simply install from npm 

	npm install angular-state-router --save



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
	        params: { endpoint: 'test.com' }
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
	  .controller(function($scope, $state) {
	    $scope.buttonClick = function() {
	      $state.change('products.catalogs.items.variations', { 
	        item: '423', 
	        catalog: 'e534', 
	        variation: '320902'
	      });
	    };
	  });



### Initialization

Initialization occurs when the application is kickedstarted.  This is why it is *often* important to define all possible deep linked states during the **configuration phase**.  

An initialization `'init'` event is emitted from the StateRouter.  

To listen to the init event:

	angular.module('myApp')
	  .run(function($state) {
	    $state.on('init', function() {  });
	  });

Or also register during the **configuration phase**

	angular.module('myApp')
	  .config(function($stateProvider) {
	    $stateProvider.on('init', function() {  });
	  });



### Use

After states are defined they can be retrieved

	// Change state
	$state.change('account.profile', { employee: 'e92792-2389' });

State changes are asynchronous operations.  



### Inheritance

States inherit from each other through a parent-child relationship by default; where `account` is the parent of `account.profile` state.  

A child state will inherit from it's each of its parents until a `inherit` value of `false` value is encountered.  

For example, in definition above the `params` value 

	{ endpoint: 'test.com' }

Will be inherited by in the `account.profile` state but not the `account.transactions` state.  



Events
------

Events are emit from $state; where $state inherits from [events.EventEmitter](https://nodejs.org/api/events.html).  

To listen to events 

	$state.on('change:complete', function() {
		// ...
	});



Event: 'init'
-------------

This event is emitted when $state is initialized.  If an initial state is specified `'init'` occurs current state is set.  



Event: 'change:begin'
---------------------

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted when a requested change to a valid state exists.  



Event: 'resolve:start'
----------------------

This event is emitted when a states starts resolve.  



Event: 'resolve:end'
--------------------

This event is emitted when a states ends resolve.  



Event: 'error'
--------------

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted whenever an error occurs.  



Event: 'error:notfound'
-----------------------

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted when a state cannot be found and no parent state(s) exist.  



Event: 'error:resolve'
----------------------

This event is emitted when an error occurred during resolve.  



Event: 'error:load'
-------------------

This event is emitted when an error occurred during loading of a loadable.  



Event: 'change:end'
-------------------

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event occurs when a valid state change successfully finishes.  This event does not trigger when an error was encountered.  Use the `'change'` event for all change requests.  



Event: 'change:complete'
------------------------

* `error`   *Object* Null if successful, `Error` object if error occurs
* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event occurs when a state change is finished.  This event is always triggered on any change request.  Also occurs *after* `'error'` is emitted.  



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



Views
-----

Current states can be checked using the `active` method which accepts a state notation query

	<li ng-class="{'active': $state.active('company') }"><a href="#" sref="company">Company</a></li>

And in the same method a state can be triggered using the `sref` attribute.  

	<a href="#" sref="company">Company</a>

Parameters can be sent similarly

	<a href="#" sref="company({id:'Lorem ipsum'})">Company</a>



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