StateRouter
===========

[![Build Status](https://travis-ci.org/henrytseng/angular-state-router.svg?branch=master)](https://travis-ci.org/henrytseng/angular-state-router) [![Join the chat at https://gitter.im/henrytseng/angular-state-router](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/henrytseng/angular-state-router?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 

StateRouter is an AngularJS state-based router designed for flexibility and ease of use.  

StateRouter is designed to be used in a modular integration with:

* StateView
	* A view rendering engine
* StateLoadable
	* A lazy loading scheme

While not required, StateRouter was originally developed with Browserify.  



Install
-------

To install in your project, simply install from NPM 

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

Add StateRouter as a dependency when your application module is instantiated

	angular.module('myApp', ['angular-state-router']);

Then **define** your states and **initialize** StateRouter

	angular.module('myApp')
	  .run(function($stateRouter) {

	    $stateRouter

	      // Define states
	      .state('landing', {
	        url: '/'
	      })

	      .state('products.listing', {
	        url: '/products'
	      })

	      .state('products', {
	        url: '/products/:id'
	      })

	      .state('account', {
	        url: '/account'
	      })

	      // Initialization
	      .init('landing');

	  });



States
------

States are data objects with an associated dot-notation name.  Child states inherit from parent states.  

### Definition

States must be first defined.  This is usually done in the angular `run` phase.  

	angular.module('myApp')
	  .run(function($stateRouter) {
	    $stateRouter
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


### Initialization

Initialization should occur before StateRouter API calls are made.  An initialization `'init'` event is emitted from the StateRouter.  

To listen to the init event:

	$stateRouter.on('init', function() {  });


### Use

After states are defined they can be retrieved

	var accountState = $stateRouter.state('account.profile');

`StateRouter#state` returns a cached data object with values inherited from its parents.  


### Inheritance

States inherit from each other through a parent-child relationship by default; where `account` is the parent of `account.profile` state.  

A child state will inherit from it's each of its parents until a `inherit` value of `false` value is encountered.  

For example, in definition above the `params` value 

	{ endpoint: 'test.com' }

Will be inherited by in the `account.profile` state but not the `account.transactions` state.  



Events
------

Events are emit from $stateRouter; where $stateRouter inherits from [events.EventEmitter](https://nodejs.org/api/events.html).  

To listen to events 

	$stateRouter.on('change:complete', function() {
		// ...
	});



Event: 'init'
-------------

This event is emitted when $stateRouter is initialized.  If an initial state is specified `'init'` occurs current state is set.  



Event: 'change:begin'
---------------------

* `request` *Object* Requested data `{ name: 'nextState', params: {} }`

This event is emitted when a requested change to a valid state exists.  



Event: 'load:start'
-------------------

This event is emitted when a loadable object starts loading.  



Event: 'load:progress'
----------------------

This event is emitted when a loadable object progresses loading.  This event must occur once before `'end'` is emitted.  



Event: 'load:end'
-----------------

This event is emitted when a loadable object completes loading.  



Event: 'resolve:start'
----------------------

This event is emitted when a states starts resolve.  



Event: 'resolve:end'
--------------------

This event is emitted when a states ends resolve.  



Event: 'render'
---------------

This event is emitted when the view is rendered.  



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

States use dot-notation where state names are `/[a-zA-Z0-9]*/` strings separated by dots `.` and are case sensitive.  

The following are examples of valid unique state names:

	ochestra1.trombone.position.6
	ochestra1.clarinet
	ochestra56.clarinet
	ochestra1



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



Running Tests
-------------

To run tests 

	npm install
	gulp test



Contribute
----------

If you've got ideas on how to make hostr better create an issue and mark an enhancement in Github.  

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

Copyright (c) 2014 Henry Tseng

Released under the MIT license. See LICENSE for details.