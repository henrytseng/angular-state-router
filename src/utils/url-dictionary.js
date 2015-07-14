'use strict';

/**
 * Constructor
 */
function UrlDictionary() {
  this._patterns = [];
  this._refs = [];
  this._params = [];
}

/**
 * Associate a URL pattern with a reference
 * 
 * @param  {String} pattern A URL pattern
 * @param  {Object} ref     A data Object
 */
UrlDictionary.prototype.add = function(pattern, ref) {
  pattern = pattern || '';
  var _self = this;
  var i = this._patterns.length;

  var pathChain, queryChain;

  if(pattern.indexOf('?') === -1) {
    pathChain = UrlDictionary.path(pattern).split('/');

  } else {
    pathChain = UrlDictionary.path(pattern).split('/');
    queryChain = UrlDictionary.querystring(pattern).split('&');
  }

  // URL matching
  var expr = 
    '^' +
    (pathChain.map(function(chunk) {
      if(chunk[0] === ':') {
        return '[a-zA-Z0-9\\-_\\.~]+';

      } else {
        return chunk;
      }
    }).join('\\/')) +
    '[\\/]?$';

  // Params
  

  // Querystring


  this._patterns[i] = new RegExp(expr);
  this._refs[i] = ref;
};

/**
 * Find a reference according to a URL pattern
 * 
 * @param  {String} url      A URL to test for
 * @param  {Object} defaults A data Object of default parameter values
 * @return {Object}          A reference to a stored object
 */
UrlDictionary.prototype.lookup = function(url, defaults) {
  var inflected = UrlDictionary.path(url || '');

  for(var i=this._patterns.length-1; i>=0; i--) {
    if(inflected.match(this._patterns[i]) !== null) {
      return this._refs[i];
    }
  }

  return null;
};

/**
 * Get the path of a URL
 * 
 * @param  {String} url A URL to test for
 * @return {String}     A querystring from URL
 */
UrlDictionary.path = function(url) {
  var inflected = (url || '').replace(/\?.*/, '');
  return inflected;
};

/**
 * Get the querystring of a URL
 * 
 * @param  {String} url A URL to test for
 * @return {String}     A querystring from URL
 */
UrlDictionary.querystring = function(url) {
  var inflected = (url || '').replace(/.*\?/, '');
  return inflected;
};

module.exports = UrlDictionary;
