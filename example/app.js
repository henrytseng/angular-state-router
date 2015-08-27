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
            layout: 'layouts/one-col.html',

            // Nested Children
            contentBody: 'screens/landing.html',
            contentFooter: 'common/footer.html'

          }
        })

        .state('about', {
          url: '/about',
          templates: {
            layout: 'layouts/one-col.html',
            contentBody: 'screens/about.html',
            contentFooter: 'common/footer.html'
          }
        })

        .state('products', {
          url: '/products',
          params: {

            // Inherit by default
            catalog: '1-aeff'

          },
          templates: {
            layout: 'layouts/one-col.html',
            contentBody: 'screens/products.html',
            contentFooter: 'common/footer.html'
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
            layout: 'layouts/one-col.html',
            contentBody: 'screens/products-item.html',
            contentFooter: '/common/footer.html'
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
            layout: 'layouts/one-col.html',
            contentBody: 'screens/contact.html',
            contentFooter: 'common/footer.html'
          }
        })

        .state('account.profile', {
          url: '/account',
          templates: {
            layout: 'layouts/two-col.html',
            sideBar: 'screens/account/side.html',
            mainBody: 'screens/account/profile.html'
          }
        })

        .state('account.preferences', {
          url: '/account/preferences',
          templates: {
            layout: 'layouts/two-col.html',
            sideBar: 'screens/account/side.html',
            mainBody: 'screens/account/preferences.html'
          }
        })

        .state('account.login', {
          url: '/login',
          templates: {
            layout: 'layouts/one-col.html',
            contentBody: 'screens/login.html'
          }
        })

        .state('search', {
          url: '/search',
          load: ['components/search.js']
        })

        .state('notfound', {

          // Defined templates
          templates: {
            layout: 'layouts/error.html'
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
    .controller('FrameController', function($rootScope, $scope, $state, $urlManager, $viewManager, $log, $location, Product) {

      // Products catalog
      $scope.products = Product.list();

      // Login state
      $scope.isAuthenticated = false;

      // Direct call to state
      $scope.login = function() {
        $scope.isAuthenticated = true;
        Product.getRandom().then(function(product) {
          $state.change('products.items', {
            catalog: product.catalog,
            item: product.item
          });
        });
      };

      // Direct call to location
      $scope.logout = function() {
        $scope.isAuthenticated = false;
        $location.url('/');
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
      
      // Show error page
      $rootScope.$on('$stateChangeErrorNotFound', function() {
        $state.change('notfound');
      });
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

          // Search through each
          if(criteria && criteria !== '') {
            _listing.forEach(function(item) {
              for(var name in item) {
                if(item[name].toLowerCase().indexOf(criteria.toLowerCase()) !== -1 && results.indexOf(item) === -1) {
                  results.push(item);
                }
              }
            });
          }

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
