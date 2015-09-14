(function() {
  'use strict';

  // Instantiate app
  var example = {
    myApp: angular.module('myApp', [
      'angular-state-router',
      'angular-state-view',
      'angular-state-loadable'
    ])
  };

  // Publicize in unique namespace
  window.example = example;

  // Configuration
  example.myApp

    .config(function($stateProvider, $controllerProvider, $compileProvider, $filterProvider, $provide) {

      // Export for late registration
      example.myApp.deferred = {
        controller: $controllerProvider.register,
        directive: $compileProvider.directive,
        filter: $filterProvider.register,
        factory: $provide.factory,
        service: $provide.service
      };

      // Define states
      $stateProvider

        .state('landing', {
          url: '/',

          // Defined templates
          templates: {

            // Parent
            layout: 'angular-state-router/layouts/one-col.html',

            // Nested Children
            contentBody: 'angular-state-router/screens/landing.html',
            contentFooter: 'angular-state-router/common/footer.html'

          }
        })

        .state('about', {
          url: '/about',
          templates: {
            layout: 'angular-state-router/layouts/one-col.html',
            contentBody: 'angular-state-router/screens/about.html',
            contentFooter: 'angular-state-router/common/footer.html'
          }
        })

        .state('products', {
          url: '/products',
          params: {

            // Inherit by default
            catalog: '1-aeff'

          },
          templates: {
            layout: 'angular-state-router/layouts/one-col.html',
            contentBody: 'angular-state-router/screens/products.html',
            contentFooter: 'angular-state-router/common/footer.html'
          },
          controllers: {

            // Inline controller
            contentBody: function($scope, Product) {
              Product.list().then(function(list) {
                $scope.products = list;
              });
            }

          }
        })

        .state('products.items', {
          url: '/products/:catalog/:item',
          templates: {
            layout: 'angular-state-router/layouts/one-col.html',
            contentBody: 'angular-state-router/screens/products-item.html',
            contentFooter: 'angular-state-router/common/footer.html'
          },

          controllers: {

            // Referenced controller
            layout: 'ProductItemController'

          },

          resolve: {
            productItem: function(Product, $state) {
              return Product.get($state.current().params.item);
            }, 

            itemRecommendations: function(Product, $state) {
              return Product.recommend($state.current().params.item);
            }
          }
        })

        .state('contact', {
          url: '/contact',
          templates: {
            layout: 'angular-state-router/layouts/one-col.html',
            contentBody: 'angular-state-router/screens/contact.html',
            contentFooter: 'angular-state-router/common/footer.html'
          }
        })

        .state('account.profile', {
          url: '/account',
          templates: {
            layout: 'angular-state-router/layouts/two-col.html',
            sideBar: 'angular-state-router/screens/account/side.html',
            mainBody: 'angular-state-router/screens/account/profile.html'
          }
        })

        .state('account.preferences', {
          url: '/account/preferences',
          templates: {
            layout: 'langular-state-router/ayouts/two-col.html',
            sideBar: 'angular-state-router/screens/account/side.html',
            mainBody: 'angular-state-router/screens/account/preferences.html'
          }
        })

        .state('account.login', {
          url: '/login',
          templates: {
            layout: 'angular-state-router/layouts/one-col.html',
            contentBody: 'angular-state-router/screens/login.html'
          }
        })

        .state('account.logout', {
          url: '/logout',
          actions: [
            function(Auth, $state) {
              Auth.logout().then(function() {
                $state.change('landing');
              });
            }
          ]
        })

        .state('search', {
          url: '/search',
          load: ['angular-state-router/components/search.js']
        })

        .state('notfound', {

          // Defined templates
          templates: {
            layout: 'angular-state-router/layouts/error.html'
          }
        })

        // Set default initial location
        .init('landing');
    })

    // Run
    .run(function($rootScope, $state) {
      example.myApp.deferred.state = $state.state;
      $rootScope.$state = $state;
    })

    // Main
    .controller('FrameController', function($rootScope, $scope, $state, $urlManager, $viewManager, $log, $location, Product, Auth) {

      // Products catalog
      $scope.products = Product.list();

      // Initial login state
      $scope.isAuthenticated = Auth.isAuthenticated();

      // Login with credentials
      $scope.login = function() {
        Auth.login().then(function() {
          $scope.isAuthenticated = Auth.isAuthenticated();

          // Direct call to state
          $state.change('account.profile');

        });
      };

      // Debug messages
      $scope.messages = [];

      // Clear debugging messages
      $scope.clearDebug = function() {
        $scope.messages = [];
      };

      var _addDebug = function(message) {
        return function(e) {
          var now = new Date();
          $log.log(e.name);
          $scope.messages.unshift({
            title: e.name,
            body: message
          });
        };
      };

      // Initialization
      $rootScope.$on('$stateInit', _addDebug('State has initialized.'));

      // State transition
      $rootScope.$on('$stateChangeBegin', _addDebug('State transition process started.'));
      $rootScope.$on('$stateChangeEnd', _addDebug('State transition process ended.'));
      $rootScope.$on('$stateChangeComplete', _addDebug('State change request has been completed.'));

      // Error
      $rootScope.$on('$stateChangeError', _addDebug('Error occurred.'));
      $rootScope.$on('$stateChangeErrorNotFound', _addDebug('Error state could not be found.'));
      
      // Resolve
      $rootScope.$on('$stateResolveBegin', _addDebug('Resolution started.'));
      $rootScope.$on('$stateResolveEnd', _addDebug('Resolution ended.'));
      $rootScope.$on('$stateResolveError', _addDebug('Error encountered in resolve.'));
      
      // Action
      $rootScope.$on('$stateActionBegin', _addDebug('Actions started.'));
      $rootScope.$on('$stateActionEnd', _addDebug('Actions ended.'));
      $rootScope.$on('$stateActionError', _addDebug('Error encountered in action.'));
      
      // Show error page
      $rootScope.$on('$stateChangeErrorNotFound', function() {
        $state.change('notfound');
      });
    })

    // Auth Service
    .factory('Auth', function($q) {
      var _isAuthenticated = false;

      return {

        isAuthenticated: function() {
          return _isAuthenticated;
        },

        login: function() {
          _isAuthenticated = true;
          return $q.when(_isAuthenticated);
        },

        logout: function() {
          _isAuthenticated = false;
          return $q.when(_isAuthenticated);
        }

      };
    })

    // Product Service
    .factory('Product', function($q) {
      var _listing = [
        {item: 'k43131', catalog: '1-aeff', name: 'Phasellus', description: 'Purus sodales ultricies.'},
        {item: 'u43131', catalog: '1-aeff', name: 'Adipiscing', description: 'Facilisis in pretium.'},
        {item: 'e32537', catalog: '1-aeff', name: 'Cras', description: 'Dapibus ac facilisis in.'},
        {item: 'a231', catalog: '1-aeff', name: 'Egestas', description: 'Elit non mi porta.'}, 
        {item: 'r20', catalog: '1-aeff', name: 'Ut', description: 'Sed ut'},
        {item: 's4312', catalog: '1-aeff', name: 'Donec id', description: 'Gravida at eget metus'},
        {item: 'h975', catalog: '1-aeff', name: 'Nullam', description: 'Id dolor id nibh ultricies'},
        {item: 'j239032-1', catalog: '1-aeff', name: 'Dolor', description: 'Nibh ultricies'},
        {item: 'j239032-2', catalog: '1-aeff', name: 'Ipsum', description: 'Eget metus'}
      ];

      return {
        // List all
        list: function() {
          return $q.when(_listing.slice(0));
        },

        // Get item      
        get: function(item) {
          for(var i=0; i<_listing.length; i++) {
            if(_listing[i].item === item) return $q.when(_listing[i]);
          }
          return null;
        },

        // Get random item
        getRandom: function() {
          var i = Math.floor(_listing.length-1 * Math.random());
          return $q.when(_listing[i]);
        },

        // Search for a product
        search: function(criteria) {
          var results = [];

          criteria = angular.isArray(criteria) ? criteria : [criteria];

          // Search through each
          criteria.forEach(function(q) {
            if(q && q !== '') {

              _listing.forEach(function(item) {
                for(var name in item) {
                  if(item[name].toLowerCase().indexOf(q.toLowerCase()) !== -1 && results.indexOf(item) === -1) {
                    results.push(item);
                  }
                }
              });
            }
          });

          return $q.when(results);
        },

        // Get recommendations
        recommend: function(item) {
          var list = _listing.slice(0);
          return $q.when(list
            .filter(function(entity) {
              return entity.item !== item;
            })
            .sort(function() {
              return Math.random() > 0.5;
            })
            .splice(0,6));
        }
      };
    })

    // Product Item Controller
    .controller('ProductItemController', function($scope, $state, productItem, itemRecommendations) {
      // Get product
      $scope.product = productItem;

      // Get recommendations based on product
      $scope.recommendations = itemRecommendations;
    });

})();
