StateRouter
===========

[![Build Status](https://travis-ci.org/henrytseng/angular-state-router.svg?branch=master)](https://travis-ci.org/henrytseng/angular-state-router)

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



State Notation
--------------

States use dot-notation where state names are `[a-zA-Z0-9]*` strings separated by dots `.`

The following are examples of valid state definitions:

	catalog.index.list
	ochestra1.trombone.position.6

The following are examples of state notation queries that would match

	catalog.*.list
	ochestra1.trombone



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