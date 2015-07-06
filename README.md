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

To instal from NPM 



Quick Start
-----------

To use `StateRouter` with your application `myApp`

HTML view:

	<html>
	  <head>
	    <script src="node_modules/angular-state-router/dist/state-router.min.js"></script>
	  </head>
	  <body>
	  	
	  </body>
	</html>

	app.module('myApp', ['angular-state-router'])

_stateRouter

        // A state
        .state('dashboard', {
          url: '/dashboard'
        })

        // With parameters
        .state('profile', {
          url: '/profile?p&j&sd',
          params: {
            p: 0,
            j: 'lorem'
          }
        })

        // Detail view with required id
        .state('product', {
          url: '/product/:id'
        })

        // Index listing and detail view (optional "id")
        .state('catalog', {
          url: '/catelog/[:id]'
        })

        // Sub-state without parent state
        .state('terms.legal.', {
          url: '/legal'
        });



Contribute
----------

If you've got ideas on how to make hostr better create an issue and mark an enhancement in Github.  

If there are any unreported errors please let us know.  We'd like StateRouter to give as much feedback as possible to eliminate common problems that may occur during development.  


License
-------

Copyright (c) 2014 Henry Tseng

Released under the MIT license. See LICENSE for details.