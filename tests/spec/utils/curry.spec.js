'use strict';

describe('Curry', function() {
  var Curry = require('../../../src/utils/curry');

  it('Should create a curried function', function() {
    var add = function(a, b) {
      return a + b;
    };

    var adder5 = Curry(add, 5);

    expect(adder5(6)).toBe(11);
  });

  it('Should accept multiple arguments', function() {
    var sum3 = Curry(function(a, b, c) {
      return a + b + c;
    });

    expect(sum3(6, 1, 23)).toBe(30);
  });

});
