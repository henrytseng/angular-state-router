'use strict';

describe('UrlDictionary', function() {
  var UrlDictionary = require('../../../src/utils/url-dictionary');

  describe('#add', function() {
    it('Should associate a url with a reference', function() {
      var ud = new UrlDictionary();

      ud.add('/products/:id', {
        lorem: 'ipsum'
      });
    });
  });

  describe('#lookup', function() {
    it('Should retrieve added references according to the url pattern', function() {
      var ud = new UrlDictionary();
      var data1, data2, data3, data4;

      // Match parameter variable
      ud.add('/pets/:id', data1 = { dolor: 'sed' });
      expect(ud.lookup('/pets/cat').ref).toBe(data1);

      // Match parameter variable
      ud.add('/pets/:id/color', data2 = { lorem: 'sed' });
      expect(ud.lookup('/pets/cat/color').ref).toBe(data2);
      expect(ud.lookup('/pets/cat/color').params).toEqual({
        id: 'cat'
      });

      // Match special characters
      ud.add('/pets/:id/color/:color', data1 = { dolor: 'sed' });
      expect(ud.lookup('/pets/cat/color/yellow%20purple').ref).toBe(data1);
      expect(ud.lookup('/pets/cat/color/yellow%20purple').params).toEqual({
        id: 'cat',
        color: 'yellow%20purple'
      });

      // Matches newest
      ud.add('/pets/:id/color?hue', data3 = { ut: 'sed' });
      expect(ud.lookup('/pets/cat/color?hue=green').ref).toBe(data3);
      expect(ud.lookup('/pets/cat/color?hue=green')).not.toBe(data2);
      expect(ud.lookup('/pets/cat/color?hue=green').params).toEqual({
        id: 'cat',
        hue: 'green'
      });

      // Including escape characters
      ud.add('/pets/:id/variety%20type/:type', data4 = { ipsum: 'sed' });
      expect(ud.lookup('/pets/dog/variety%20type/poodle').ref).toBe(data4);
      expect(ud.lookup('/pets/dog/variety%20type/poodle').params).toEqual({
        id: 'dog',
        'type': 'poodle'
      });
    });
  });

});
