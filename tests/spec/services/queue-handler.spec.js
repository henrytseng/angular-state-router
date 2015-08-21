'use strict';

describe('$queueHandler', function() {

  beforeEach(angular.mock.module('angular-state-router'));

  describe('#create', function() {

    it('Should create a Queue instance', function(done) {
      angular.mock.inject(function ($queueHandler) {
        
        var queue = $queueHandler.create();
        expect(queue).toBeDefined();
        expect(queue.add).toBeDefined();
        expect(queue.data).toBeDefined();
        expect(queue.execute).toBeDefined();

        done();
      });
    });
  });

  describe('Queue', function() {
    it('Should send data to each middleware layer and call completion callback', function(done) {
      angular.mock.inject(function ($queueHandler, $rootScope) {
        var myData = {};
        var middlewareData;
        var onComplete = jasmine.createSpy('onComplete');

        var queue = $queueHandler.create().data(myData);

        queue.add(function(data, next) {
          middlewareData = data;
          next();
        });
        queue.execute(onComplete);

        $rootScope.$digest();

        expect(middlewareData).toBe(myData);
        expect(onComplete).toHaveBeenCalledWith(null);
        done();
      });
    });

    it('Should process each step of the layer of middleware in queue and call completion callback', function(done) {
      angular.mock.inject(function ($queueHandler, $rootScope) {
        var myData = {};
        var order = [];
        var onComplete = jasmine.createSpy('onComplete');

        var queue = $queueHandler.create().data(myData);

        queue.add(function(data, next) {
          expect(data).toBe(myData);
          order.push(1);
          next();
        });
        queue.add(function(data, next) {
          expect(data).toBe(myData);
          order.push(2);
          next();
        });
        queue.add(function(data, next) {
          expect(data).toBe(myData);
          order.push(3);
          next();
        });
        queue.execute(onComplete);

        $rootScope.$digest();

        expect(order).toEqual([1,2,3]);
        expect(onComplete).toHaveBeenCalledWith(null);
        done();
      });
    });

    it('Should interupt send error to completion callback', function(done) {
      angular.mock.inject(function ($queueHandler, $rootScope) {
        var myError = new Error('Custom error');
        var onSkip = jasmine.createSpy('onSkip');
        var onComplete = jasmine.createSpy('onComplete');

        var queue = $queueHandler.create();

        queue.add(function(data, next) {
          next(myError);
        });
        queue.add(onSkip);
        queue.execute(onComplete);

        $rootScope.$digest();

        expect(onSkip).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledWith(myError);
        done();
      });
    });
  });
});
