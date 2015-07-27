'use strict';

describe('$urlManager', function() {
  var _urlManager;
  var $location;

  beforeEach(angular.mock.module('angular-state-router'));

  beforeEach(angular.mock.inject(function($urlManager, _$location_) {
    _urlManager = $urlManager;
    $location = _$location_;
  }));

  describe('#update', function() {

    it('Should update URL location according to state', function() {

    });

  });

  describe('#location', function() {

    it('Should set state according to URL location', function() {

    });

  });
});
