'use strict';

/* global process:false */

describe('process', function() {
  describe('#nextTick', function() {

    it('Should add items according to event loop', function(done) {
      expect(process).toBeDefined();
      expect(process.nextTick).toBeDefined();

      var list = [];
      list.push('a');

      process.nextTick(function() {
        list.push('b');
      });

      list.push('c');

      // Complete
      process.nextTick(function() {
        expect(list).toEqual(['a', 'c', 'b']);
        done();
      });
    });

  });
});
