'use strict';

describe('Parameters', function() {
  var Parameters = require('../../../src/utils/parameters');

  describe('#Parameters', function() {
    it('Should parse a Parameters-object in string-form into its equivalent Object-form', function() {
      expect(Parameters("{ lorem:'ipsum', 'sed': 3214, 'Excepteur': \"Adipiscing\", \"dolor\": 'ut'}")).toEqual(
        { 
          lorem:'ipsum', 
          sed: 3214, 
          Excepteur: "Adipiscing", 
          dolor: 'ut'
        }
      );
    });
  });

  describe('#resolveValue', function() {
    it('Should parse string value and return boolean, number, string, or null', function() {
      
      // Boolean
      expect(Parameters.resolveValue('true')).toBe(true);
      expect(Parameters.resolveValue('false')).toBe(false);

      // Number      
      expect(Parameters.resolveValue('193')).toBe(193);
      expect(Parameters.resolveValue('-203')).toBe(-203);
      expect(Parameters.resolveValue('5.6')).toBe(5.6);
      expect(Parameters.resolveValue('1.0')).toBe(1.0);
      expect(Parameters.resolveValue('0.33333e1')).toBe(0.33333e1);
      expect(Parameters.resolveValue('.33333e1')).toBe(0.33333e1);
      expect(Parameters.resolveValue('.33333e-15')).toBe(0.33333e-15);
      expect(isNaN(Parameters.resolveValue('NaN'))).toBe(true);
      expect(Parameters.resolveValue('0.0')).toBe(0);

      // String
      expect(Parameters.resolveValue('-')).toBe('-');
      expect(Parameters.resolveValue('.e1')).toBe('.e1');
      expect(Parameters.resolveValue('0.33333ee131')).toBe('0.33333ee131');
      expect(Parameters.resolveValue('0.33333e')).toBe('0.33333e');
      expect(Parameters.resolveValue('0..1')).toBe('0..1');

      // Null
      expect(Parameters.resolveValue('null')).toBe(null);
    });
  });

  describe('#listify', function() {
    it('Should parse string name-value in Object literal', function() {
      expect(Parameters.listify('{"lorem": "ipsum"}')).toEqual(["lorem", "ipsum"]);
      expect(Parameters.listify('{ "lorem":"ipsum"}')).toEqual(["lorem", "ipsum"]);
      expect(Parameters.listify('{ "lorem":  "ipsum"}')).toEqual(["lorem", "ipsum"]);
    });

    // Future feature to add escaped characters in strings \" and \'
    xit('Should parse string name-value in Object literal', function() {
      expect(Parameters.listify('{ "lorem":  "i\"psum"}')).toEqual(["lorem", "ipsum"]);
      expect(Parameters.listify("{ 'lorem':  'i\'psum'}")).toEqual(["lorem", "ipsum"]);
    });

    it('Should parse string literals name-value in Object literal', function() {
      expect(Parameters.listify('{"lorem":"ipsum sed\'", "dolo\'r": "s[e]d", "u{t}": "lorem ipsum"}')).toEqual(["lorem", "ipsum sed'", "dolo'r", "s[e]d", "u{t}", "lorem ipsum"]);
    });

    it('Should parse special characters in Object literal', function() {
      expect(Parameters.listify('{"idÓ":"non:value","id‰": \'non{key\'}')).toEqual(["idÓ", "non:value", "id‰", 'non{key']);
      expect(Parameters.listify('{"idÓ":"val uÁe3$","id‰": \'$v%al:ue4$$\'}')).toEqual(["idÓ", "val uÁe3$", "id‰", '$v%al:ue4$$']);
    });

    it('Should parse non-quoted names in Object literal', function() {
      expect(Parameters.listify('{lorem: "ipsum"}')).toEqual(["lorem", "ipsum"]);
    });

    it('Should parse matching quotes in Object literal', function() {
      expect(Parameters.listify('{"l\'orem": \'ip"sum\', "s\'e\'d": \'u"lorem"t\'}')).toEqual(["l'orem", 'ip"sum', "s'e'd", 'u"lorem"t']);
    });

    it('Should parse number values in Object literal', function() {
      expect(Parameters.listify('{"lorem": 123, "sed": \'0\'}')).toEqual(["lorem", 123, "sed", '0']);
      expect(Parameters.listify('{dolor: 321.0e1, dolores : -321.1e1, eius : -31 }')).toEqual(['dolor', 321.0e1, 'dolores', -321.1e1, 'eius', -31]);
    });

    // Future feature support for Arrays
    xit('Should parse Array (single-level) and its values in Object literal', function() {
      expect(Parameters.listify('{"list1": [], "list2": [1,2,3], "list3": ["1", "2", "3"]}')).toEqual(["list1", [], "list2", [1,2,3], "list3", ["1", "2", "3"]]);
    });

    it('Should parse null and booleans in Object literal', function() {
      expect(Parameters.listify('{"name1": null, "name2": true, "name3": false}')).toEqual(["name1", null, "name2", true, "name3", false]);
      expect(Parameters.listify('{"name1": "null", "name2": "true", "name3": "false"}')).toEqual(["name1", "null", "name2", "true", "name3", "false"]);
    });

  });
});
