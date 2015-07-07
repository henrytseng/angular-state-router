StateRouter
===========

StateRouter is an AngularJS state-based router designed for flexibility and ease of use.  

StateRouter is designed to be used in a modular integration with:

* StateView
	* A nested view rendering engine
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
	    <script src="/node_modules/dist/state-router.min.js"></script>
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




Building
--------

To build the project

	npm install
	gulp


Running Tests
-------------

To run tests 

	npm install
	gulp test


Contribute
----------

If you've got ideas on how to make hostr better create an issue and mark an enhancement in Github.  

If there are any unreported errors please let us know.  We'd like StateRouter to give as much feedback as possible to eliminate common problems that may occur during development.  

To get started programming

	npm install
	gulp watch

To host the example

	npm run-script example

Then using your browser visit [http://localhost:3000/example/index.html](http://localhost:3000/example/index.html)


License
-------

Copyright (c) 2014 Henry Tseng

Released under the MIT license. See LICENSE for details.